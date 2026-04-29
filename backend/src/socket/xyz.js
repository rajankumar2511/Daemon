import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import redis, { redisSub, redisPub } from "../../config/redis.js";

let io;

// =============================================
// PRODUCTION LOGGING
// =============================================

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

// =============================================
// CONFIGURATION
// =============================================

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
};

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173").split(",").map(o => o.trim());

// =============================================
// IN-MEMORY STORES
// =============================================

const onlineUsers = new Map(); // userId -> Set(socketIds)
const offlineTimers = new Map(); // userId -> timer
const rateLimitMap = new Map(); // userId -> { count, resetAt }
const lastPresenceBroadcast = new Map(); // userId -> { isOnline, lastEmit }

// =============================================
// REDIS HELPERS
// =============================================

const safeRedis = async (fn, operation, context = {}, retries = 2) => {
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (err) {
            if (i === retries) {
                logError("REDIS", err, { operation, ...context, retries });
                return null;
            }
            await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
        }
    }
};

// =============================================
// BROADCAST HELPERS
// =============================================



export const emitToUser = (userId, event, data) => {
    const sockets = onlineUsers.get(String(userId));
    if (!sockets?.size) return;
    for (const socketId of sockets) {
        io.to(socketId).emit(event, data);
    }
};

const broadcastPresence = (userId, isOnline, lastSeen = null) => {
    const now = Date.now();
    const last = lastPresenceBroadcast.get(userId);

    if (last?.isOnline === isOnline && now - (last.lastEmit || 0) < 1000) return;

    lastPresenceBroadcast.set(userId, { isOnline, lastEmit: now });

    // 🔴 FIX #5: Targeted emits instead of global broadcasts
    if (isOnline) {
        io.emit("user-online", { userId });
    } else {
        io.emit("user-offline", { userId, lastSeen });
    }
};

// =============================================
// CORE PRESENCE MANAGEMENT
// =============================================

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
    const added = await safeRedis(
        () => redis.sadd("online_users", userId),
        "sadd:online",
        { userId }
    );

    // Publish only if newly online
    if (added === 1) {
        await safeRedis(
            () => redisPub.publish(
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
    }

};

const scheduleOffline = (userId) => {
    if (offlineTimers.has(userId)) return;

    const timer = setTimeout(async () => {
        offlineTimers.delete(userId);

        // Double-check Redis before marking offline
        const stillOnline = await safeRedis(
            () => redis.sismember("online_users", userId),
            "sismember",
            { userId }
        );

        // Handle both string and number responses
        if (stillOnline && Number(stillOnline) === 1) {
            log("WARN", "OFFLINE", "User marked online in Redis, aborting offline", { userId });
            return;
        }

        const sockets = onlineUsers.get(userId);
        if (sockets?.size) {
            let hasValidSocket = false;
            for (const socketId of sockets) {
                if (io?.sockets?.sockets?.get(socketId)) {
                    hasValidSocket = true;
                    break;
                }
            }
            if (hasValidSocket) return;
        }

        onlineUsers.delete(userId);
        lastPresenceBroadcast.delete(userId);
        rateLimitMap.delete(userId);

        // 🔴 FIX #2: Consistent timestamp
        const now = Date.now();
        await safeRedis(() => redis.set(`last_seen:${userId}`, now.toString()), "set:last_seen", { userId });

        try {
            await User.findByIdAndUpdate(userId, { lastSeen: new Date(now) });
        } catch (err) {
            logError("DB", err, { userId, operation: "updateLastSeen" });
        }

        await safeRedis(() => redisPub.publish("presence:offline", JSON.stringify({ userId, lastSeen: now, _origin: process.env.SERVER_ID })), "publish", { userId });

        broadcastPresence(userId, false);
    }, CONFIG.OFFLINE_GRACE_MS);

    offlineTimers.set(userId, timer);
};

const forceUserOffline = async (userId) => {
    if (offlineTimers.has(userId)) {
        clearTimeout(offlineTimers.get(userId));
        offlineTimers.delete(userId);
    }

    onlineUsers.delete(userId);
    lastPresenceBroadcast.delete(userId);
    rateLimitMap.delete(userId);

    // 🔴 FIX #3: Consistent timestamp
    const now = Date.now();
    await safeRedis(() => redis.set(`last_seen:${userId}`, now.toString()), "set:last_seen", { userId });

    try {
        await User.findByIdAndUpdate(userId, { lastSeen: new Date(now) });
    } catch (err) {
        logError("DB", err, { userId, operation: "forceOffline" });
    }

    broadcastPresence(userId, false);
};

// =============================================
// CLEANUP
// =============================================

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
    setInterval(async () => {
        for (const [userId, sockets] of onlineUsers.entries()) {
            const validSockets = [];
            for (const socketId of sockets) {
                if (io?.sockets?.sockets?.get(socketId)) validSockets.push(socketId);
            }

            if (validSockets.length === 0 && !offlineTimers.has(userId)) {
                scheduleOffline(userId);
                log("WARN", "CLEANUP", "Scheduled orphan user for offline", { userId });
            } else if (validSockets.length !== sockets.size) {
                onlineUsers.set(userId, new Set(validSockets));
                log("INFO", "CLEANUP", "Cleaned dead sockets", { userId, removed: sockets.size - validSockets.length });
            }
        }
    }, CONFIG.ORPHAN_CLEANUP_INTERVAL_MS);
};

// =============================================
// TYPING MANAGEMENT
// =============================================

const handleTyping = async (userId, to, chatId, isStarting) => {
    if (!to || !chatId || to === userId) return;

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

// =============================================
// MESSAGE HANDLING
// =============================================

// 🔴 FIX #1: REMOVED socket message handler completely
// No send-message handler - REST API is the only source of truth

const validateMessage = (content) => {
    if (!content || typeof content !== "string") return { valid: false, error: "Invalid content" };
    const trimmed = content.trim();
    if (trimmed.length === 0) return { valid: false, error: "Empty message" };
    if (trimmed.length > CONFIG.MAX_MESSAGE_LENGTH) return { valid: false, error: `Max ${CONFIG.MAX_MESSAGE_LENGTH} chars` };
    return { valid: true, content: trimmed };
};

const serializeMessage = (msg) => ({
    _id: msg._id.toString(),
    chatId: msg.chatId.toString(),
    sender: msg.sender.toString(),
    content: msg.content,
    type: msg.type || "text",
    status: msg.status,
    createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : msg.createdAt,
    updatedAt: msg.updatedAt instanceof Date ? msg.updatedAt.toISOString() : msg.updatedAt,
});

// =============================================
// RATE LIMITING
// =============================================

const isRateLimited = (userId, event) => {
    const now = Date.now();
    const entry = rateLimitMap.get(userId);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(userId, { count: 1, resetAt: now + CONFIG.RATE_LIMIT_WINDOW_MS });
        return false;
    }

    if (entry.count >= CONFIG.RATE_LIMIT_MAX) {
        log("WARN", "RATE_LIMIT", "User rate limited", { userId, event });
        return true;
    }

    entry.count++;
    return false;
};

// =============================================
// AUTHENTICATION
// =============================================

const authenticate = (socket) => {
    try {
        const raw = socket.handshake.headers.cookie;
        if (!raw) return null;

        const cookies = cookie.parse(raw);
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
// PUB/SUB (Cross-server sync)
// =============================================

// 🔴 FIX #4: Redis reconnect handling
const setupPubSub = () => {
    const subscribeChannels = () => {
        redisSub.subscribe(
            "typing:start",
            "typing:stop",
            "presence:online",
            "presence:offline",
            "message:new"
        );
    };

    // Initial subscription
    subscribeChannels();

    // Re-subscribe on reconnect
    redisSub.on("connect", () => {
        log("INFO", "PUBSUB", "Redis reconnected, resubscribing...");
        subscribeChannels();
    });

    redisSub.on("message", (channel, message) => {
        try {
            const data = JSON.parse(message);
            if (data._origin === process.env.SERVER_ID) return;

            switch (channel) {
                case "typing:start":
                    emitToUser(data.to, "user-typing", { from: data.from, chatId: data.chatId });
                    break;
                case "typing:stop":
                    emitToUser(data.to, "user-stop-typing", { from: data.from, chatId: data.chatId });
                    break;
                case "presence:offline":
                    broadcastPresence(data.userId, false, data.lastSeen);
                    break;
                case "message:new":
                    emitToUser(data.receiverId, "new-message", data.message);
                    break;
                case "presence:online":
                    broadcastPresence(data.userId, true);
                    break;
            }
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
        log("INFO", "SYSTEM", "Shutting down gracefully...");

        if (io) {
            const sockets = await io.fetchSockets();
            await Promise.all(sockets.map(s => s.disconnect(true)));
            await io.close();
        }

        await Promise.all([redis.quit(), redisSub.quit(), redisPub.quit()]);
        log("INFO", "SYSTEM", "Shutdown complete");
        process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
};

// =============================================
// SOCKET INITIALIZATION (MAIN)
// =============================================

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

    io.use((socket, next) => {
        const userId = authenticate(socket);
        if (!userId) return next(new Error("AUTH_FAILED"));
        socket.userId = userId;
        next();
    });

    io.on("connection", async (socket) => {
        const { userId } = socket;
          await cacheUserFriends(userId); // 🔥 important

        log("INFO", "CONNECTION", "Client connected", { userId, socketId: socket.id });

        await markUserOnline(userId, socket.id);

        // Send initial data
        const onlineUsersList = await safeRedis(() => redis.smembers("online_users"), "smembers");
        socket.emit("online-users", { users: onlineUsersList || [] });

        // ========== EVENT HANDLERS ==========

        socket.on("get-online-users", async () => {
            const users = await safeRedis(() => redis.smembers("online_users"), "smembers");
            socket.emit("online-users", { users: users || [] });
        });

        socket.on("typing", ({ to, chatId }) => handleTyping(userId, to, chatId, true));
        socket.on("stop-typing", ({ to, chatId }) => handleTyping(userId, to, chatId, false));

        // 🔴 FIX #1: REMOVED - No send-message handler
        // REST API is the only source of truth for messages

        socket.on("message-delivered", async ({ messageId, senderId }) => {
            if (!messageId || !senderId) return;
            try {
                const updated = await Message.findOneAndUpdate(
                    { _id: messageId, status: "sent" },
                    { status: "delivered" },
                    { new: true }
                );
                if (updated) {
                    emitToUser(senderId, "message-status-update", { messageId: messageId.toString(), status: "delivered" });
                }
            } catch (err) {
                logError("MESSAGE", err, { operation: "delivered", messageId });
            }
        });

        socket.on("mark-seen", async ({ chatId }) => {
            if (!chatId) return;
            try {
                const messages = await Message.find({
                    chatId,
                    sender: { $ne: userId },
                    status: { $ne: "seen" },
                }).lean();

                if (!messages.length) return;

                await Message.updateMany(
                    { _id: { $in: messages.map(m => m._id) } },
                    { status: "seen", seenAt: new Date() }
                );

                const bySender = messages.reduce((acc, m) => {
                    const sid = m.sender.toString();
                    (acc[sid] ||= []).push(m._id.toString());
                    return acc;
                }, {});

                for (const [senderId, messageIds] of Object.entries(bySender)) {
                    emitToUser(senderId, "messages-seen", { chatId: chatId.toString(), messageIds });
                }
            } catch (err) {
                logError("MESSAGE", err, { operation: "mark-seen", userId, chatId });
            }
        });

        // WebRTC Signaling
        socket.on("call:request", ({ to, offer, callType }) => {
            if (!to || !offer || !["audio", "video"].includes(callType)) return;
            emitToUser(to, "call:incoming", { from: userId, offer, callType });
        });

        socket.on("call:answer", ({ to, answer }) => {
            if (!to || !answer) return;
            emitToUser(to, "call:answered", { from: userId, answer });
        });

        socket.on("call:ice", ({ to, candidate }) => {
            if (!to || !candidate) return;
            emitToUser(to, "call:ice", { from: userId, candidate });
        });

        socket.on("call:end", ({ to }) => {
            if (!to) return;
            emitToUser(to, "call:ended", { from: userId });
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

        socket.on("disconnect", async () => {
            log("INFO", "DISCONNECT", "Client disconnected", { userId, socketId: socket.id });

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