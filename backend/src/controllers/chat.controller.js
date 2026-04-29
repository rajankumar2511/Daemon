import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import redis from "../../config/redis.js";
import { redisPub } from "../../config/redis.js";
import { emitToUser } from "../socket/socket.js";
import { messageQueue } from "../queues/message.queue.js"

const CHAT_MESSAGES_KEY = (chatId) => `chat:messages:${chatId}`;
const SERVER_ID = process.env.SERVER_ID || `server-${Math.random().toString(36).substring(7)}`;

const log = (tag, message, data = {}) => {
  console.log(`[${tag}] ${message}`, data);
};

const logError = (tag, error, extra = {}) => {
  console.error(`[${tag}] ERROR:`, {
    message: error.message,
    stack: error.stack,
    ...extra,
  });
};

// ===================== RATE LIMITING =====================
const checkMessageRateLimit = async (userId) => {
  try {
    const key = `rate:msg:${userId}`;
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, 1);
    }

    // Max 20 messages per second
    if (count > 20) {
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[RATE_LIMIT] Redis failed, allowing message:", err.message);
    return true;
  }
};

// ===================== GET / CREATE CHAT =====================
export const getOrCreateChat = async (req, res) => {
  const userId = req.userId;
  const { friendId } = req.params;

  try {
    log("CHAT", "getOrCreateChat called", { userId, friendId });

    if (userId === friendId) {
      return res.status(400).json({ message: "Cannot chat with yourself" });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    // Convert to ObjectId for proper comparison with friends array
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const friendObjectId = new mongoose.Types.ObjectId(friendId);

    const isFriend = await User.exists({ _id: userObjectId, friends: friendObjectId });
    if (!isFriend) {
      log("CHAT", "Unauthorized chat attempt", { userId, friendId });
      return res.status(403).json({ message: "You can only chat with friends" });
    }

    // Sort participants to match schema pre-save hook
    const sortedParticipants = [userObjectId, friendObjectId].sort((a, b) =>
      a.toString().localeCompare(b.toString())
    );

    let chat;
    try {
      chat = await Chat.findOneAndUpdate(
        { participants: sortedParticipants },
        { $setOnInsert: { participants: sortedParticipants } },
        { new: true, upsert: true, runValidators: true }
      )
        .populate("participants", "fullName profilePic email")
        .populate("lastMessage")
        .lean();
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate key error - chat already exists, fetch it
        chat = await Chat.findOne({ participants: sortedParticipants })
          .populate("participants", "fullName profilePic email")
          .populate("lastMessage")
          .lean();
      } else {
        throw err;
      }
    }

    return res.status(200).json(chat);
  } catch (error) {
    logError("CHAT:getOrCreateChat", error, { userId, friendId });
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ===================== GET USER CHATS =====================
export const getUserChats = async (req, res) => {
  const userId = req.userId;

  try {
    log("CHAT", "getUserChats", { userId });

    const chats = await Chat.find({ participants: userId })
      .populate("participants", "fullName profilePic")
      .populate("lastMessage", "content sender createdAt status")
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json(chats);
  } catch (error) {
    logError("CHAT:getUserChats", error, { userId });
    return res.status(500).json({ message: "Internal server error" });
  }
};
// ===================== SEND MESSAGE =====================

export const sendMessage = async (req, res) => {
  const userId = req.userId;
  const { chatId } = req.params;
const { text, tempId } = req.body;

  try {
    log("MESSAGE", "sendMessage request", {
      userId,
      chatId,
      textLength: text?.length,
    });

    // ❌ Empty message check
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    // ⚡ Rate limiting (KEEP)
    const isAllowed = await checkMessageRateLimit(userId);
    if (!isAllowed) {
      return res.status(429).json({
        message: "Too many messages. Please slow down.",
      });
    }

    // ✅ Validate chat
    const chat = await Chat.findById(chatId).lean();
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // ✅ Check user is participant
    if (!chat.participants.some(id => id.toString() === userId.toString())) {
      log("MESSAGE", "Unauthorized send attempt", { userId, chatId });
      return res.status(403).json({ message: "Not authorized" });
    }

    // ✅ Find receiver
    const receiverId = chat.participants.find(
      id => id.toString() !== userId.toString()
    );

    if (!receiverId) {
      return res.status(400).json({ message: "Invalid receiver" });
    }

    // 🚀 🔥 PUSH TO QUEUE (CORE LOGIC)
    const job = await messageQueue.add(
      "sendMessage",
      {
        chatId,
        senderId: userId,
        receiverId: receiverId.toString(),
        text: text.trim(),
        tempId, // ✅ Pass frontend tempId for correlation
      },
      {
        attempts: 5, // retry 5 times
        backoff: {
          type: "exponential",
          delay: 1000, // 1s → 2s → 4s → ...
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    log("QUEUE", "Message job added", {
      jobId: job.id,
      chatId,
      sender: userId,
      receiver: receiverId,
    });

    // 🔥 Invalidate cache immediately to prevent stale data
    try {
      await redis.del(CHAT_MESSAGES_KEY(chatId));
      log("CACHE", "Invalidated chat cache", { chatId });
    } catch (err) {
      console.warn("Cache invalidation failed:", err.message);
    }

    // ✅ Immediate response (NOT DB result)
    return res.status(201).json({
      success: true,
      jobId: job.id,
    });

  } catch (error) {
    logError("MESSAGE:sendMessage", error, { userId, chatId });

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
// ===================== DELETE MESSAGES (BULK) =====================
export const deleteMessages = async (req, res) => {
  const userId = req.userId;
  const { chatId } = req.params;
  const { messageIds } = req.body;

  try {
    log("MESSAGE", "deleteMessages (HARD DELETE) request", { userId, chatId, count: messageIds?.length });

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ message: "Invalid message IDs" });
    }

    const chat = await Chat.findById(chatId).lean();
    if (!chat) {
      log("MESSAGE", "Chat not found for deletion", { chatId });
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.participants.some(id => id.toString() === userId.toString())) {
      log("MESSAGE", "Unauthorized deletion attempt", { userId, chatId });
      return res.status(403).json({ message: "Not authorized" });
    }

    // ⚡ HARD DELETE from MongoDB (remove document entirely)
    // Only delete messages owned by the user in this specific chat
    const result = await Message.deleteMany({
      _id: { $in: messageIds },
      chatId: chatId,
      sender: userId
    });

    log("MESSAGE", "Messages deleted from MongoDB", { deletedCount: result.deletedCount });

    // ⚡ SYNC CHAT lastMessage: If the last message was deleted, update it
    if (chat.lastMessage && messageIds.includes(chat.lastMessage.toString())) {
      const lastMsg = await Message.findOne({ chatId })
        .sort({ createdAt: -1 })
        .select("_id")
        .lean();
      
      await Chat.findByIdAndUpdate(chatId, {
        lastMessage: lastMsg ? lastMsg._id : null
      });
      log("MESSAGE", "Chat lastMessage updated after deletion", { chatId, newLastMessage: lastMsg?._id });
    }

    // ⚡ INVALIDATE REDIS CACHE (MANDATORY)
    try {
      const cacheKey = CHAT_MESSAGES_KEY(chatId);
      const deletedFromCache = await redis.del(cacheKey);
      log("CACHE", "Invalidated chat messages cache", { chatId, cacheKey, deletedFromCache });
    } catch (err) {
      logError("CACHE:Invalidation", err, { chatId });
    }

    // 📡 Publish deletion event to all participants
    try {
      await redisPub.publish(
        "messages:deleted",
        JSON.stringify({
          chatId: chatId.toString(),
          messageIds: messageIds,
          senderId: userId.toString(),
          participants: chat.participants.map(p => p.toString()),
          _origin: SERVER_ID,
        })
      );
      log("MESSAGE", "Published deletion event to Redis", { chatId, messageCount: messageIds.length });
    } catch (err) {
      logError("REDIS_PUBLISH", err, { chatId });
    }

    return res.status(200).json({
      message: "Messages deleted permanently",
      deletedCount: result.deletedCount
    });

  } catch (error) {
    logError("MESSAGE:deleteMessages", error, { userId, chatId });
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ===================== GET CHAT MESSAGES =====================
export const getChatMessages = async (req, res) => {
  const userId = req.userId;
  const { chatId } = req.params;
  const { skipCache } = req.query; // Allow bypassing cache if needed

  try {
    log("MESSAGE", "getChatMessages - LOAD ALL", { userId, chatId, skipCache });

    const chat = await Chat.findById(chatId).lean();
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.participants.some(id => id.toString() === userId.toString())) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // 🗄️ LOAD ALL MESSAGES FROM DB (always fresh)
    const messages = await Message.find({ chatId: new mongoose.Types.ObjectId(chatId) })
      .populate("sender", "fullName profilePic")
      .sort({ createdAt: 1 }) // oldest → newest
      .lean();

    log("MESSAGE", "Loaded ALL messages from DB", { 
      count: messages.length, 
      chatId,
    });

    // 🔥 INVALIDATE OLD CACHE AND WRITE NEW
    try {
      const key = CHAT_MESSAGES_KEY(chatId);
      
      const pipeline = redis.multi();
      pipeline.del(key); // Always clear old cache first

      for (const msg of messages) {
        const serialized = {
          ...msg,
          _id: msg._id.toString(),
          chatId: msg.chatId.toString(),
          sender: msg.sender ? {
            ...msg.sender,
            _id: msg.sender._id.toString(),
          } : null,
          createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : msg.createdAt,
          updatedAt: msg.updatedAt instanceof Date ? msg.updatedAt.toISOString() : msg.updatedAt,
        };
        pipeline.rpush(key, JSON.stringify(serialized));
      }
      
      pipeline.expire(key, 600); // 10 minute cache
      await pipeline.exec();
      
      log("CACHE", "Cache rebuilt with ALL messages", { chatId, count: messages.length });
    } catch (err) {
      console.warn("[CACHE] Cache rebuild failed:", err.message);
    }

    return res.status(200).json({
      messages,
    });

  } catch (error) {
    logError("MESSAGE:getChatMessages", error, { userId, chatId });
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ===================== GET SINGLE MESSAGE =====================
export const getMessage = async (req, res) => {
  const userId = req.userId;
  const { messageId } = req.params;

  try {
    log("MESSAGE", "getMessage", { messageId });

    const message = await Message.findById(messageId)
      .populate("sender", "fullName profilePic")
      .lean();

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // 🔥 SECURITY CHECK
    const chat = await Chat.findById(message.chatId).lean();

    if (!chat || !chat.participants.some(id => id.toString() === userId.toString())) {
      return res.status(403).json({ message: "Not authorized" });
    }

    return res.status(200).json(message);

  } catch (error) {
    logError("MESSAGE:getMessage", error, { messageId });
    return res.status(500).json({ message: "Internal server error" });
  }
};