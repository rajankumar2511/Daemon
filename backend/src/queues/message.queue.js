import { Queue } from "bullmq";
import { bullRedis } from "../../config/redis.js"; // ✅ reuse existing

export const messageQueue = new Queue("message-queue", {
  connection: bullRedis,
  // ✅ CRITICAL: Configure for high-frequency message handling
  defaultJobOptions: {
    // Retry failed jobs up to 5 times with exponential backoff (increased from 3)
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 1000, // 1s → 2s → 4s → 8s → 16s
    },
    // ✅ CRITICAL: Don't remove completed jobs - keep for recovery
    removeOnComplete: false,
    // Keep all failed jobs for analysis
    removeOnFail: false,
    // Message jobs should complete within 10 seconds (increased from 5s)
    timeout: 10000,
    // Don't delay processing
    delay: 0,
  },
  // ✅ Queue settings for high throughput & reliability
  settings: {
    // Increase max stalled count to 3 retries on stall
    maxStalledCount: 3,
    // Check for stalled jobs every 5 seconds
    stalledInterval: 5000,
    // Allow up to 100 retries per second
    maxRetriesPerSecond: 100,
    // Delay before retrying a stalled job
    retryProcessDelay: 1000,
    // Increase lock duration to prevent false stalling
    lockDuration: 30000,
    // Renew lock every 15s
    lockRenewTime: 15000,
    // How long to keep jobs in memory (1 week)
    retentionTime: 7 * 24 * 60 * 60 * 1000,
  },
});

// ✅ Cleanup old jobs periodically to prevent Redis bloat
setInterval(async () => {
  try {
    const counts = await messageQueue.clean(86400000, 0, "completed");
    if (counts.length > 0) {
      console.log(`🧹 Cleaned ${counts.length} old completed jobs from queue`);
    }
  } catch (error) {
    console.warn("[QUEUE] Cleanup error:", error.message);
  }
}, 1 * 60 * 60 * 1000); // Run every hour