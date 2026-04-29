import Message from "../models/Message.js";
import { messageQueue } from "../queues/message.queue.js";

/**
 * ✅ Emergency backup: Save pending queue jobs to database
 * Used when:
 * - Server is shutting down
 * - Queue is backed up
 * - Redis temporarily fails
 */

export const backupPendingMessagesToDB = async () => {
  try {
    console.log("💾 [RECOVERY] Backing up pending queue messages to database...");

    // Get all jobs that are still in queue (not yet processed)
    const waitingJobs = await messageQueue.getJobs(["waiting", "active", "delayed"], 0, -1);
    
    if (!waitingJobs.length) {
      console.log("✅ No pending jobs to backup");
      return { backed: 0 };
    }

    let backedUp = 0;
    const failed = [];

    for (const job of waitingJobs) {
      try {
        const { chatId, senderId, receiverId, text, tempId } = job.data;

        // Check if message already exists in DB
        const existingMessage = await Message.findOne({ chatId, tempId });
        
        if (existingMessage) {
          console.log(`ℹ️ Message ${tempId} already in DB, skipping backup`);
          continue;
        }

        // Save to database as backup
        const backupMessage = new Message({
          chatId,
          sender: senderId,
          content: text,
          status: "sent", // Mark as sent status so it's not lost on recovery
          tempId,
        });

        await backupMessage.save();
        console.log(`✅ Backed up message ${tempId} to database`);
        backedUp++;
      } catch (err) {
        console.error(`❌ Failed to backup job ${job.id}:`, err.message);
        failed.push(job.id);
      }
    }

    console.log(`✅ Backup complete: ${backedUp} messages backed up, ${failed.length} failed`);
    return { backed: backedUp, failed };
  } catch (err) {
    console.error("❌ [RECOVERY] Backup failed:", err.message);
    throw err;
  }
};

/**
 * ✅ Recovery: Restore messages from database that are in "sent" status
 * These are messages that were processed but might not have full delivery status
 */
export const recoverMessagesFromDB = async (chatId) => {
  try {
    console.log(`📥 [RECOVERY] Checking for recoverable messages in chat ${chatId}...`);

    const messages = await Message.find({
      chatId,
      status: "sent",
      tempId: { $exists: true }, // Only messages with tempId (were queued)
    })
      .populate("sender", "fullName profilePic")
      .lean();

    if (messages.length > 0) {
      console.log(`✅ Found ${messages.length} recoverable messages`);
    }

    return messages;
  } catch (err) {
    console.error("❌ [RECOVERY] Failed to recover messages:", err.message);
    return [];
  }
};

/**
 * ✅ Check queue health and backup if needed
 */
export const checkQueueHealth = async () => {
  try {
    const counts = await messageQueue.getJobCounts();
    const { waiting, active, delayed, completed, failed } = counts;
    const total = waiting + active + delayed;

    console.log(`📊 [QUEUE] Status:`, {
      waiting,
      active,
      delayed,
      completed,
      failed,
      totalPending: total,
    });

    // If too many jobs are stuck, trigger backup
    if (total > 1000) {
      console.warn(`⚠️  Queue has ${total} pending jobs - backing up to database...`);
      await backupPendingMessagesToDB();
    }

    return { waiting, active, delayed, completed, failed, totalPending: total };
  } catch (err) {
    console.error("❌ [RECOVERY] Health check failed:", err.message);
    return null;
  }
};

/**
 * ✅ Drain queue: Move all pending jobs to database backup
 * Use this before emergency shutdown
 */
export const drainQueueToDatabase = async () => {
  try {
    console.log("🚨 [RECOVERY] Emergency drain: Moving all queue jobs to database backup...");

    const allJobs = await messageQueue.getJobs(["waiting", "active", "delayed"], 0, -1);
    console.log(`Found ${allJobs.length} jobs to drain`);

    const backup = await backupPendingMessagesToDB();
    console.log(`✅ Drained ${backup.backed} jobs to database`);

    return backup;
  } catch (err) {
    console.error("❌ Drain failed:", err.message);
    throw err;
  }
};
