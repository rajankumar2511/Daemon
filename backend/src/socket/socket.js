import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import User from "../models/User.js";
import Message from "../models/Message.js";
import redis, { redisSub, redisPub } from "../../config/redis.js";

let io;

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const CURRENT_LOG_LEVEL = IS_PRODUCTION ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

const log = (level, tag, message, context = {}) => {
  if (LOG_LEVELS[level] <= CURRENT_LOG_LEVEL) {
    const entry = { timestamp: new Date().toISOString(), tag, message, ...context };
    if (level === "ERROR") console.error(JSON.stringify(entry));
    else if (level === "WARN") console.warn(JSON.stringify(entry));
    else console.log(JSON.stringify(entry));
  }
};

const logError = (tag, error, context = {}) => log("ERROR", tag, error.message, { ...context, stack: IS_PRODUCTION ? undefined : error.stack });

const CONFIG = {
  OFFLINE_GRACE_MS: 3000,
  RATE_LIMIT_MAX: 60,
  RATE_LIMIT_WINDOW_MS: 10000,
  MAX_MESSAGE_LENGTH: 2000,
  TYPING_TIMEOUT_SEC: 3,
  MEMORY_CLEANUP_INTERVAL_MS: 3600000,
  ORPHAN_CLEANUP_INTERVAL_MS: 10000,
  PING_TIMEOUT: 20000,
  PING_INTERVAL: 25000,
  HEARTBEAT_TIMEOUT: 30000,
};

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173").split(",").map(o => o.trim());

const onlineUsers = new Map(); // userId -> Set(socketIds)
const offlineTimers = new Map(); // userId -> timer
const rateLimitMap = new Map(); // userId -> { count, resetAt }
const lastPresenceBroadcast = new Map(); // userId -> { isOnline, lastEmit }

// ✅ NEW: Track recently marked-seen chats to avoid redundant updates
const chatMarkSeenTracker = new Map(); // chatId -> { timestamp, messageIds }

const safeRedis = async (fn, op, ctx = {}, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) {
        logError("REDIS", err, { op, ...ctx, retries });
        return null;
      }
      await new Promise(r => setTimeout(r, 100 * (i + 1)));
    }
  }
};

export const emitToUser = (userId, event, data) => {
  if (!io) {
    log("WARN", "EMIT", "Cannot emit: io is not initialized", { userId, event });
    return;
  }

  const sockets = onlineUsers.get(String(userId));
  if (!sockets?.size) {
    log("WARN", "EMIT", `No sockets for user ${userId}`, { event });
    return;
  }

  let emitCount = 0;
  for (const socketId of sockets) {
    try {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket || !socket.connected) {
        log("WARN", "EMIT", `Socket disconnected, removing from tracking`, { 
          userId, 
          socketId, 
          connected: socket?.connected 
        });
        sockets.delete(socketId);
        continue;
      }

      // ✅ Check write buffer size (backpressure)
      const bufferSize = socket.writableLength || 0;
      if (bufferSize > 65536) {  // 64KB threshold
        log("WARN", "EMIT", "Socket buffer backpressure detected", {
          userId,
          socketId,
          bufferSize,
          event,
        });
        // Don't emit if backpressure too high, let next retry handle it
        continue;
      }

      // ✅ Emit with volatile flag to prevent queuing on error
      socket.volatile.emit(event, data);
      emitCount++;
    } catch (err) {
      log("ERROR", "EMIT", `Failed to emit to socket`, { 
        userId, 
        socketId, 
        event, 
        error: err.message 
      });
    }
  }

  if (emitCount === 0) {
    log("WARN", "EMIT", `No sockets available for user after checks`, { userId, event });
  }
};


const cacheUserFriends = async (userId) => {
  const user = await User.findById(userId).select("friends");

  if (!user?.friends?.length) return;

  const key = `friends:${userId}`;

  await redis.del(key); // reset
  await redis.sadd(key, ...user.friends.map(id => id.toString()));
};

const broadcastPresence = async (userId, isOnline, lastSeen = null) => {
  const now = Date.now();
  const last = lastPresenceBroadcast.get(userId);

  // Remove throttling for offline events to ensure immediate updates
  if (isOnline && last?.isOnline === isOnline && now - last.lastEmit < 1000) return;

  lastPresenceBroadcast.set(userId, { isOnline, lastEmit: now });

  let friends = await safeRedis(() => redis.smembers(`friends:${userId}`));
  if (!friends) {
    log("ERROR", "PRESENCE", "Redis failed", { userId });
  }
  // 🔥 fallback
  if (!friends?.length) {
    const user = await User.findById(userId).select("friends");

    if (!user?.friends?.length) {
      await safeRedis(() => redis.sadd(`friends:${userId}`, "__EMPTY__"));
      return;
    }

    friends = user.friends.map(id => id.toString());
    await safeRedis(() => redis.sadd(`friends:${userId}`, ...friends));
  }

  for (const fid of friends) {
    if (fid === "__EMPTY__") continue;
    emitToUser(fid, isOnline ? "user-online" : "user-offline", {
      userId,
      lastSeen,
    });
  }
};


const markUserOnline = async (userId, socketId) => {
  // Cancel grace timer
  if (offlineTimers.has(userId)) {
    clearTimeout(offlineTimers.get(userId));
    offlineTimers.delete(userId);
  }

  // Track socket
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socketId);

  // Update Redis
  await safeRedis(
    () => redis.sadd("online_users", userId),
    "sadd:online",
    { userId }
  );

  // 🔥 ALWAYS broadcast (CRITICAL FIX)
  await safeRedis(
    () =>
      redisPub.publish(
        "presence:online",
        JSON.stringify({
          userId,
          _origin: process.env.SERVER_ID,
        })
      ),
    "publish:presence:online",
    { userId }
  );

  broadcastPresence(userId, true);

};



const scheduleOffline = (userId) => {
  if (offlineTimers.has(userId)) return;

  offlineTimers.set(
    userId,
    setTimeout(async () => {
      offlineTimers.delete(userId);

      // ✅ 1. Check if user still has any active sockets
      const sockets = onlineUsers.get(userId);
      if (!sockets || sockets.size === 0) {
        // No sockets, proceed with offline
      } else {
        // Check if any sockets are actually connected
        const activeSockets = [...sockets].filter(id => {
          const socket = io?.sockets?.sockets?.get(id);
          return socket && socket.connected && socket.userId === userId;
        });

        if (activeSockets.length > 0) {
          // Still has active sockets, don't go offline
          return;
        }
      }

      // ✅ 2. FINAL CLEANUP
      onlineUsers.delete(userId);
      lastPresenceBroadcast.delete(userId);
      rateLimitMap.delete(userId);

      const now = Date.now();

      // 🔥 Remove from Redis (idempotent)
      await safeRedis(
        () => redis.srem("online_users", userId),
        "srem:online",
        { userId }
      );

      // 🕒 Store last seen
      await safeRedis(
        () => redis.set(`last_seen:${userId}`, now),
        "set:last_seen",
        { userId }
      );

      // 🗄️ Update DB
      try {
        await User.findByIdAndUpdate(userId, {
          lastSeen: new Date(now),
        });
      } catch (err) {
        logError("DB", err, { userId });
      }

      // 📡 Publish offline event (for other servers)
      await safeRedis(
        () =>
          redisPub.publish(
            "presence:offline",
            JSON.stringify({
              userId,
              lastSeen: now,
              _origin: process.env.SERVER_ID,
            })
          ),
        "publish:presence:offline",
        { userId }
      );

      // 🚀 Notify friends directly
      broadcastPresence(userId, false, now);

    }, CONFIG.OFFLINE_GRACE_MS)
  );
};

const forceUserOffline = async (userId) => {
  if (offlineTimers.has(userId)) {
    clearTimeout(offlineTimers.get(userId));
    offlineTimers.delete(userId);
  }

  onlineUsers.delete(userId);
  lastPresenceBroadcast.delete(userId);
  rateLimitMap.delete(userId);

  const now = Date.now();

  // 🔥 remove from Redis (CRITICAL)
  await safeRedis(
    () => redis.srem("online_users", userId),
    "srem:online",
    { userId }
  );

  // 🕒 last seen
  await safeRedis(
    () => redis.set(`last_seen:${userId}`, now),
    "set:last_seen",
    { userId }
  );

  try {
    await User.findByIdAndUpdate(userId, { lastSeen: new Date(now) });
  } catch (err) {
    logError("DB", err, { userId });
  }

  // 🚀 notify
  broadcastPresence(userId, false, now);
};




const startMemoryCleanup = () => {
  setInterval(() => {
    const now = Date.now();

    for (const [userId, entry] of rateLimitMap.entries()) {
      if (now > entry.resetAt + 60000) rateLimitMap.delete(userId);
    }

    for (const [userId, state] of lastPresenceBroadcast.entries()) {
      if (now - state.lastEmit > 300000) lastPresenceBroadcast.delete(userId);
    }
  }, CONFIG.MEMORY_CLEANUP_INTERVAL_MS);
};

const startOrphanCleanup = () => {
  setInterval(() => {
    for (const [userId, sockets] of onlineUsers.entries()) {
      const valid = [...sockets].filter(id => io?.sockets?.sockets?.get(id));

      if (!valid.length && !offlineTimers.has(userId)) {
        scheduleOffline(userId);
        log("WARN", "CLEANUP", "Orphan → offline", { userId });
      } else if (valid.length !== sockets.size) {
        onlineUsers.set(userId, new Set(valid));
      }
    }
  }, CONFIG.ORPHAN_CLEANUP_INTERVAL_MS);
};



const handleTyping = async (userId, to, chatId, isStarting) => {
  if (isRateLimited(userId, "typing")) return;
  if (!to || !chatId || String(to) === String(userId)) return;

  const key = `typing:${chatId}:${userId}`;
  const channel = isStarting ? "typing:start" : "typing:stop";

  if (isStarting) {
    await safeRedis(() => redis.setex(key, CONFIG.TYPING_TIMEOUT_SEC, "1"), "set:typing", { userId, chatId });
  } else {
    await safeRedis(() => redis.del(key), "del:typing", { userId, chatId });
  }

  await safeRedis(() => redisPub.publish(channel, JSON.stringify({ to, from: userId, chatId, _origin: process.env.SERVER_ID })), "publish", { userId });
  emitToUser(to, isStarting ? "user-typing" : "user-stop-typing", { from: userId, chatId });
};


const validateMessage = (c) => {
  if (!c || typeof c !== "string") return { valid: false, error: "Invalid" };
  const t = c.trim();
  if (!t) return { valid: false, error: "Empty" };
  if (t.length > CONFIG.MAX_MESSAGE_LENGTH) return { valid: false, error: "Too long" };
  return { valid: true, content: t };
};

const serializeMessage = (m) => ({
  _id: m._id?.toString(),
  chatId: m.chatId?.toString(),
  sender: m.sender?.toString(),
  content: m.content,
  type: m.type || "text",
  status: m.status,
  createdAt: m.createdAt?.toISOString?.() || m.createdAt,
  updatedAt: m.updatedAt?.toISOString?.() || m.updatedAt,
});


const isRateLimited = (userId, event) => {
  const now = Date.now();
  const key = `${userId}:${event}`;
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + CONFIG.RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (rateLimitMap.size > 10000) rateLimitMap.clear();
  if (entry.count >= CONFIG.RATE_LIMIT_MAX) {
    log("WARN", "RATE_LIMIT", "User rate limited", { userId, event });
    return true;
  }
  entry.count++;
  return false;
};


const authenticate = (socket) => {
  try {
    const raw = socket.handshake.headers.cookie;
    if (!raw) return null;

    let cookies = {};
    try {
      cookies = cookie.parse(raw);
    } catch {
      return null;
    }

    const token = cookies.jwt || cookies.token || cookies.accessToken;
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const userId = decoded.userId || decoded._id || decoded.id;
    return userId ? String(userId) : null;
  } catch (err) {
    if (err.name !== "TokenExpiredError") logError("AUTH", err);
    return null;
  }
};


// =============================================
// PUB/SUB
// =============================================

const CHANNELS = [
  "typing:start",
  "typing:stop",
  "presence:online",
  "presence:offline",
  "message:new",
  "message:status",
  "message:sent",
  "messages:deleted",
  "messages:seen",
  "call:request",
  "call:answer",
  "call:ice",
  "call:end"
];

const handlers = {
  "typing:start": (d) =>
    emitToUser(d.to, "user-typing", { from: d.from, chatId: d.chatId }),

  "typing:stop": (d) =>
    emitToUser(d.to, "user-stop-typing", { from: d.from, chatId: d.chatId }),

  "presence:online": (d) => {
    if (d._origin !== process.env.SERVER_ID) {
      broadcastPresence(d.userId, true);
    }
  },

  "presence:offline": (d) => {
    if (d._origin !== process.env.SERVER_ID) {
      broadcastPresence(d.userId, false, d.lastSeen);
    }

  },
  "message:sent": (d) => {
    log("DEBUG", "PUBSUB", "message:sent received", { senderId: d.senderId, tempId: d.tempId });
    emitToUser(d.senderId, "message-sent", {
      tempId: d.tempId,
      message: d.message,
    });
  },

  "message:new": (d) => {
    log("DEBUG", "PUBSUB", "message:new received", { receiverId: d.receiverId, chatId: d.chatId, messageId: d.message._id });
    
    // ✅ Strategy: Try room broadcast FIRST, then fallback to direct emit
    let roomDelivered = false;
    let directDelivered = false;

    if (d.chatId) {
      try {
        const roomMembers = io.sockets.adapter.rooms.get(d.chatId);
        const roomSize = roomMembers?.size || 0;
        
        if (roomSize > 0) {
          log("DEBUG", "MESSAGE", "Broadcasting to room", {
            chatId: d.chatId,
            roomSize,
            roomMembers: Array.from(roomMembers || []),
            messageId: d.message._id,
          });
          
          // ✅ Get the room socket objects and check backpressure
          for (const socketId of roomMembers || []) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket && socket.connected) {
              // Use volatile to skip queuing on error
              socket.volatile.emit("new-message", d.message);
              roomDelivered = true;
            }
          }
          
          log("DEBUG", "MESSAGE", "Room broadcast completed", { 
            chatId: d.chatId,
            socketsEmitted: roomDelivered ? roomSize : 0 
          });
        } else {
          log("DEBUG", "MESSAGE", "No members in room, skipping room broadcast", { chatId: d.chatId });
        }
      } catch (err) {
        log("ERROR", "MESSAGE", "Room broadcast error", { 
          chatId: d.chatId, 
          error: err.message 
        });
      }
    }

    // ✅ CRITICAL: Always fallback to direct emit (even if room delivered)
    if (d.receiverId) {
      try {
        const receiverSockets = onlineUsers.get(String(d.receiverId));
        const onlineCount = receiverSockets?.size || 0;
        
        if (onlineCount > 0) {
          log("DEBUG", "MESSAGE", "Attempting direct emit to receiver", { 
            receiverId: d.receiverId, 
            onlineSocketCount: onlineCount,
            sockets: Array.from(receiverSockets || []),
            messageId: d.message._id 
          });
          
          emitToUser(d.receiverId, "new-message", d.message);
          directDelivered = true;
        } else {
          log("DEBUG", "MESSAGE", "Receiver not online, message saved for offline delivery", { 
            receiverId: d.receiverId 
          });
        }
      } catch (err) {
        log("ERROR", "MESSAGE", "Direct emit error", { 
          receiverId: d.receiverId, 
          error: err.message 
        });
      }
    }

    if (!roomDelivered && !directDelivered && d.receiverId) {
      log("WARN", "MESSAGE", "Message delivery failed - receiver offline and not in room", {
        messageId: d.message._id,
        receiverId: d.receiverId,
        chatId: d.chatId,
      });
    }
  },

  "message:status": (d) => {
    if (d._origin === process.env.SERVER_ID) return;
    emitToUser(d.senderId, "message-status-update", {
      messageId: d.messageId,
      status: d.status,
    });
  },

  "messages:deleted": (d) => {
    if (d.participants) {
      d.participants.forEach(userId => {
        emitToUser(userId, "messages-deleted", {
          chatId: d.chatId,
          messageIds: d.messageIds,
        });
      });
    }
  },

  "messages:seen": (d) => {
    if (d._origin === process.env.SERVER_ID) return;
    emitToUser(d.senderId, "messages-seen", {
      chatId: d.chatId,
      messageIds: d.messageIds,
    });
  },

  "call:request": (d) => {
    if (d._origin === process.env.SERVER_ID) return;
    emitToUser(d.to, "call:incoming", { from: d.from, offer: d.offer, callType: d.callType });
  },

  "call:answer": (d) => {
    if (d._origin === process.env.SERVER_ID) return;
    emitToUser(d.to, "call:answered", { from: d.from, answer: d.answer });
  },

  "call:ice": (d) => {
    if (d._origin === process.env.SERVER_ID) return;
    emitToUser(d.to, "call:ice", { from: d.from, candidate: d.candidate });
  },

  "call:end": (d) => {
    if (d._origin === process.env.SERVER_ID) return;
    emitToUser(d.to, "call:ended", { from: d.from });
  },
};

const setupPubSub = () => {
  const subscribe = () => redisSub.subscribe(...CHANNELS);

  subscribe();

  redisSub.on("connect", () => {
    log("INFO", "PUBSUB", "Reconnected → resubscribing");
    subscribe();
  });

  redisSub.on("message", (channel, msg) => {
    try {
      const d = JSON.parse(msg);
      if (!d) return;
      
      // Skip presence events from same server, but ALWAYS process message events
      if (["presence:online", "presence:offline"].includes(channel)) {
        if (d._origin === process.env.SERVER_ID) return;
      }

      handlers[channel]?.(d);
    } catch (err) {
      logError("PUBSUB", err);
    }
  });
};



// =============================================
// GRACEFUL SHUTDOWN
// =============================================

const setupGracefulShutdown = () => {
  const shutdown = async () => {
    log("INFO", "SYSTEM", "Shutting down...");

    try {
      if (io) {
        const sockets = await io.fetchSockets();
        await Promise.all(sockets.map(s => s.disconnect(true)));
        await io.close();
      }
      await Promise.all([
        redis.quit(),
        redisSub.quit(),
        redisPub.quit()
      ]);

      log("INFO", "SYSTEM", "Shutdown complete");
    } catch (err) {
      logError("SHUTDOWN", err);
    } finally {
      process.exit(0);
    }
  };

  ["SIGINT", "SIGTERM"].forEach(sig => process.on(sig, shutdown));
};


const startHeartbeatMonitor = () => {
  setInterval(() => {
    const now = Date.now();

    for (const sockets of onlineUsers.values()) {
      for (const socketId of sockets) {
        const socket = io?.sockets?.sockets?.get(socketId);
        if (!socket) continue;

        if (!socket.lastHeartbeat || now - socket.lastHeartbeat > CONFIG.HEARTBEAT_TIMEOUT) {
          socket.disconnect(true); // 🔥 trigger normal flow
        }
      }
    }
  }, 10000);
};




export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, credentials: true },
    pingTimeout: CONFIG.PING_TIMEOUT,
    pingInterval: CONFIG.PING_INTERVAL,
    maxHttpBufferSize: 1e6,
    transports: ["websocket", "polling"],
  });

  setupPubSub();
  setupGracefulShutdown();
  startMemoryCleanup();
  startOrphanCleanup();
  startHeartbeatMonitor();

  log("INFO", "SOCKET", "Server started - waiting for queued messages to process");

  // Notify all clients after a short delay to allow queued messages to be processed
  setTimeout(() => {
    io.emit("server-ready", { timestamp: new Date().toISOString() });
    log("INFO", "SOCKET", "Server ready - notifying all clients");
  }, 2000);

  io.use((socket, next) => {
    const userId = authenticate(socket);
    if (!userId) {
      log("WARN", "AUTH", "Socket auth failed");
      return next(new Error("AUTH_FAILED"));
    }
    socket.userId = userId;
    next();
  });



  io.on("connection", async (socket) => {
    const { userId } = socket;

    // 🔥 HEARTBEAT INIT
    socket.lastHeartbeat = Date.now();
    socket.on("heartbeat", () => {
      socket.lastHeartbeat = Date.now();
    });
    await cacheUserFriends(userId);
    log("INFO", "CONNECTION", "Client connected", { userId, socketId: socket.id });

    await markUserOnline(userId, socket.id);

    // 📡 Initial online users
    const [[, online], [, friends]] = await redis.multi()
      .smembers("online_users")
      .smembers(`friends:${userId}`)
      .exec();
    const friendSet = new Set(friends || []);
    const filtered = (online || []).filter(id => friendSet.has(id));

    socket.emit("online-users", { users: filtered });

    // ========= EVENTS =========

    socket.on("get-online-users", async () => {
      const [[, online], [, friends]] = await redis.multi()
        .smembers("online_users")
        .smembers(`friends:${userId}`)
        .exec();
      const friendSet = new Set(friends || []);
      const filtered = (online || []).filter(id => friendSet.has(id));

      socket.emit("online-users", { users: filtered });
    });

    // 🔥 JOIN/LEAVE CHAT ROOMS (CRITICAL FOR MESSAGE DELIVERY)
    socket.on("join-chat", ({ chatId }) => {
      if (!chatId) return;
      socket.join(chatId);
      
      // ✅ Log all room members after join
      const roomMembers = io.sockets.adapter.rooms.get(chatId);
      log("INFO", "CHAT", "User joined chat room", { 
        userId, 
        chatId, 
        socketId: socket.id,
        totalInRoom: roomMembers?.size || 0,
        roomMembers: Array.from(roomMembers || []).map(sid => {
          const sock = io.sockets.sockets.get(sid);
          return sock?.userId;
        })
      });
    });

    socket.on("leave-chat", ({ chatId }) => {
      if (!chatId) return;
      socket.leave(chatId);
      log("INFO", "CHAT", "User left chat room", { userId, chatId, socketId: socket.id });
    });

    socket.on("typing", ({ to, chatId }) => handleTyping(userId, to, chatId, true));
    socket.on("stop-typing", ({ to, chatId }) => handleTyping(userId, to, chatId, false));

    socket.on("message-delivered", async ({ messageId, senderId }) => {
      if (!messageId || !senderId) return;
      try {
        const updated = await Message.findOneAndUpdate(
          { _id: messageId, status: "sent" },
          { status: "delivered" },
          { new: true }
        );
        if (updated) {
          emitToUser(senderId, "message-status-update", {
            messageId: messageId.toString(),
            status: "delivered",
          });

          await redisPub.publish("message:status", JSON.stringify({
            senderId: senderId.toString(),
            messageId: messageId.toString(),
            status: "delivered",
            _origin: process.env.SERVER_ID
          }));
        }
      } catch (err) {
        logError("MESSAGE", err, { operation: "delivered", messageId });
      }
    });

    socket.on("mark-seen", async ({ chatId }) => {
      if (!chatId) return;
      
      try {
        const chatIdStr = chatId.toString();
        const now = Date.now();
        
        // ✅ Check if we've already marked this chat as seen recently
        const lastMark = chatMarkSeenTracker.get(chatIdStr);
        if (lastMark && now - lastMark.timestamp < 1000) {
          // Too soon after last mark-seen, skip to avoid redundant DB updates
          log("DEBUG", "MESSAGE", "Skipping mark-seen - too soon after last update", { 
            chatId: chatIdStr, 
            timeSinceLast: now - lastMark.timestamp 
          });
          return;
        }

        const messages = await Message.find({
          chatId,
          sender: { $ne: userId },
          status: { $ne: "seen" },
        }).lean();

        if (!messages.length) {
          log("DEBUG", "MESSAGE", "No unseen messages to mark", { chatId: chatIdStr });
          return;
        }

        log("DEBUG", "MESSAGE", "Marking messages as seen", { 
          chatId: chatIdStr, 
          count: messages.length,
          types: messages.map(m => m.type)
        });

        await Message.updateMany(
          { _id: { $in: messages.map(m => m._id) } },
          { status: "seen", seenAt: new Date() }
        );

        // ✅ Track this mark-seen for deduplication
        chatMarkSeenTracker.set(chatIdStr, { 
          timestamp: now, 
          messageIds: messages.map(m => m._id.toString()) 
        });

        // ✅ Clean up old entries after 5 seconds
        setTimeout(() => {
          chatMarkSeenTracker.delete(chatIdStr);
        }, 5000);

        const bySender = messages.reduce((acc, m) => {
          const sid = m.sender.toString();
          (acc[sid] ||= []).push(m._id.toString());
          return acc;
        }, {});

        for (const [senderId, messageIds] of Object.entries(bySender)) {
          log("DEBUG", "MESSAGE", "Sending messages-seen event to sender", {
            senderId,
            chatId: chatIdStr,
            messageCount: messageIds.length,
          });
          
          emitToUser(senderId, "messages-seen", {
            chatId: chatIdStr,
            messageIds,
          });

          await redisPub.publish("messages:seen", JSON.stringify({
            senderId,
            chatId: chatIdStr,
            messageIds,
            _origin: process.env.SERVER_ID
          }));
        }

        log("DEBUG", "MESSAGE", "Mark-seen completed", { 
          chatId: chatIdStr, 
          messagesToSenders: Object.keys(bySender).length 
        });
      } catch (err) {
        logError("MESSAGE", err, { operation: "mark-seen", userId, chatId });
      }
    });

    // 📞 WebRTC
    socket.on("call:request", async ({ to, offer, callType }) => {
      if (!to || !offer || !["audio", "video"].includes(callType)) return;
      
      emitToUser(to, "call:incoming", { from: userId, offer, callType });
      
      await safeRedis(() => redisPub.publish("call:request", JSON.stringify({
        to, from: userId, offer, callType, _origin: process.env.SERVER_ID
      })));
    });

    socket.on("call:answer", async ({ to, answer }) => {
      if (!to || !answer) return;
      
      emitToUser(to, "call:answered", { from: userId, answer });
      
      await safeRedis(() => redisPub.publish("call:answer", JSON.stringify({
        to, from: userId, answer, _origin: process.env.SERVER_ID
      })));
    });

    socket.on("call:ice", async ({ to, candidate }) => {
      if (!to || !candidate) return;
      
      emitToUser(to, "call:ice", { from: userId, candidate });
      
      await safeRedis(() => redisPub.publish("call:ice", JSON.stringify({
        to, from: userId, candidate, _origin: process.env.SERVER_ID
      })));
    });

    socket.on("call:end", async ({ to }) => {
      if (!to) return;
      
      emitToUser(to, "call:ended", { from: userId });
      
      await safeRedis(() => redisPub.publish("call:end", JSON.stringify({
        to, from: userId, _origin: process.env.SERVER_ID
      })));
    });

    socket.on("logout", async () => {
      log("INFO", "AUTH", "User logout", { userId });

      const sockets = onlineUsers.get(userId);
      if (sockets) {
        for (const sid of sockets) {
          io.sockets.sockets.get(sid)?.disconnect(true);
        }
      }

      await forceUserOffline(userId);
    });

    socket.on("disconnect", () => {
      log("INFO", "DISCONNECT", "Client disconnected", {
        userId,
        socketId: socket.id,
      });

      const sockets = onlineUsers.get(userId);
      if (!sockets) return;

      sockets.delete(socket.id);

      if (sockets.size === 0) {
        scheduleOffline(userId);
      }
    });
  });

  log("INFO", "INIT", "Socket.IO server ready", {
    origins: ALLOWED_ORIGINS,
    serverId: process.env.SERVER_ID || "single",
    env: process.env.NODE_ENV,
  });
};

export const getIO = () => io;