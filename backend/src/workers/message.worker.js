// src/workers/message.worker.js

import mongoose from "mongoose";
import { Worker } from "bullmq";
import { bullRedis, redisPub } from "../../config/redis.js";
import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import redis from "../../config/redis.js";
import { drainQueueToDatabase, checkQueueHealth } from "../lib/messageRecovery.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import "../models/User.js"; 

// 🔥 CONNECT MONGODB FIRST
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Worker MongoDB connected");
  } catch (err) {
    console.error("❌ Worker DB connection failed:", err.message);
    process.exit(1);
  }
};

// Wait for connection
await connectDB();

// Create Worker
const worker = new Worker(
  "message-queue",
  async (job) => {
    console.log(`📨 Processing job ${job.id}:`, job.data);
    
    const { chatId, senderId, receiverId, text, tempId } = job.data;

    try {
      // 1️⃣ Save message to DB (IDEMPOTENT: retries update same doc)
      const message = await Message.findOneAndUpdate(
        { chatId, tempId }, // Unique key prevents duplicates
        {
          $setOnInsert: {
            chatId,
            sender: senderId,
            content: text,
            status: "sent",
            tempId, // Include in insert
          }
        },
        { 
          upsert: true, 
          new: true, 
          setDefaultsOnInsert: true 
        }
      );

      console.log(`💾 Message saved/updated: ${message._id} (tempId: ${tempId})`);

      // ✅ OPTIMIZED: Populate ONLY sender with .lean() for performance
      // Avoid slow .populate() on Mongoose documents
      const populatedMessage = await Message.findById(message._id)
        .populate("sender", "fullName profilePic _id")
        .lean(); // ✅ Return POJO instead of Mongoose doc

      // 3️⃣ Prepare message object for clients
      const messageForClient = {
        _id: populatedMessage._id.toString(),
        chatId: populatedMessage.chatId.toString(),
        content: populatedMessage.content,
        createdAt: populatedMessage.createdAt,
        sender: populatedMessage.sender,
        status: "sent",
        // ✅ CRITICAL: Include tempId for frontend deduplication
        tempId: populatedMessage.tempId,
        // ✅ Add server timestamp for sequencing (prevents race conditions)
        serverTimestamp: new Date(populatedMessage.createdAt).getTime(),
      };

      // 4️⃣ Update chat's last message
      await Chat.findByIdAndUpdate(chatId, {
        lastMessage: message._id,
        updatedAt: new Date(),
      }).lean(); // ✅ Use lean() to skip Mongoose overhead

      // 5️⃣ INVALIDATE CACHE (fire-and-forget, don't await)
      redis.del(`chat:messages:${chatId}`).catch(err => 
        console.warn(`[CACHE] Invalidation failed: ${err.message}`)
      );

      // 6️⃣ Real-time delivery to receiver (ASYNC, non-blocking)
      if (receiverId) {
        console.log(`📡 Publishing to Redis channel "message:new"`, {
          receiverId: receiverId.toString(),
          chatId: chatId.toString(),
          messageId: message._id,
        });
        
        // ✅ Use fire-and-forget publish (don't await)
        redisPub.publish(
          "message:new",
          JSON.stringify({
            receiverId: receiverId.toString(),
            chatId: chatId.toString(),
            message: messageForClient,
          })
        ).catch(err => console.error("[PUBSUB] Publish failed:", err));
      }

      // 7️⃣ ACK to sender (ASYNC, non-blocking)
      redisPub.publish(
        "message:sent",
        JSON.stringify({
          senderId: senderId.toString(),
          tempId,
          message: messageForClient,
        })
      ).catch(err => console.error("[PUBSUB] Publish failed:", err));
      
      console.log(`📤 ACK sent to sender ${senderId} (tempId: ${tempId})`);

      console.log(`✅ Job ${job.id} completed successfully`);
      return { success: true, messageId: message._id.toString() };

    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection: bullRedis,
    // ✅ CRITICAL: Increase concurrency for high-frequency loads
    concurrency: 20, // Process up to 20 jobs simultaneously (was 5!)
    // Auto-remove completed jobs to prevent memory buildup
    removeOnComplete: { count: 1000 }, // Keep last 1000 for debugging
    removeOnFail: { count: 500 },
    // Shorter lock duration for faster recovery
    lockDuration: 30000,
    lockRenewTime: 15000,
  }
);

// Worker Event Listeners
worker.on("completed", (job) => {
  console.log(`✅ Job completed: ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job failed: ${job?.id}`, err.message);
});

// ✅ NEW: Handle stalled jobs (jobs that took too long and were detected as stuck)
worker.on("stalled", (jobId, err) => {
  console.warn(`⚠️ Job stalled: ${jobId}`, err?.message);
  console.log("ℹ️ This job will be retried automatically by BullMQ");
});

// ✅ NEW: Handle worker errors
worker.on("error", (err) => {
  console.error(`❌ Worker error:`, err.message);
});

// ✅ CRITICAL: Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal} - starting graceful shutdown...`);
  
  try {
    // 1️⃣ Stop accepting new jobs
    await worker.close();
    console.log("✅ Worker closed - no new jobs will be accepted");

    // 2️⃣ Wait for remaining jobs (with timeout)
    console.log("⏳ Waiting for in-flight jobs to complete (30s timeout)...");
    
    // Get active jobs and wait for them
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    
    let pendingCount = await worker.getJobCounts("active", "waiting");
    while ((pendingCount.active > 0 || pendingCount.waiting > 0) && 
           Date.now() - startTime < maxWaitTime) {
      console.log(`⏳ Waiting for jobs... Active: ${pendingCount.active}, Waiting: ${pendingCount.waiting}`);
      await new Promise(r => setTimeout(r, 1000));
      pendingCount = await worker.getJobCounts("active", "waiting");
    }

    if (pendingCount.active > 0 || pendingCount.waiting > 0) {
      console.warn(`⚠️ Timeout reached. ${pendingCount.active} active + ${pendingCount.waiting} waiting jobs remain.`);
      console.log("📌 These jobs will be resumed when the worker restarts (BullMQ persists them in Redis)");
    } else {
      console.log("✅ All jobs completed before shutdown");
    }

    // 3️⃣ Close Redis connections
    console.log("🔌 Closing database connections...");
    await mongoose.connection.close();
    console.log("✅ MongoDB connection closed");

    console.log("✅ Graceful shutdown complete - goodbye!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Graceful shutdown error:", err.message);
    process.exit(1);
  }
};

// ✅ Handle process termination signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ✅ Handle uncaught exceptions
process.on("uncaughtException", async (err) => {
  console.error("❌ Uncaught exception:", err);
  await gracefulShutdown("UNCAUGHT_EXCEPTION");
});

// ✅ Handle unhandled rejections
process.on("unhandledRejection", async (err) => {
  console.error("❌ Unhandled rejection:", err);
  await gracefulShutdown("UNHANDLED_REJECTION");
});

console.log("🚀 Message worker started...");

// ✅ NEW: Startup recovery check
(async () => {
  try {
    console.log("\n📥 [STARTUP] Running recovery checks...");
    
    // Check queue health
    await checkQueueHealth();
    
    // Wait a moment for connections to stabilize
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("✅ [STARTUP] Recovery checks complete\n");
  } catch (err) {
    console.error("❌ [STARTUP] Recovery check error:", err.message);
  }
})();

// ✅ NEW: Periodic health check (every 5 minutes)
setInterval(async () => {
  try {
    await checkQueueHealth();
  } catch (err) {
    console.warn("[HEALTH] Check failed:", err.message);
  }
}, 5 * 60 * 1000);