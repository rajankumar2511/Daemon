import Redis from "ioredis";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// go from config/ → backend/
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
// ─────────────────────────────────────────────
// ENV
// ─────────────────────────────────────────────
if (!process.env.REDIS_URL) {
  throw new Error("❌ REDIS_URL is not defined in environment variables");
}

const REDIS_URL = process.env.REDIS_URL;

// ─────────────────────────────────────────────
// RETRY STRATEGY
// Exponential backoff capped at 5 s.
// Returning null tells ioredis to stop retrying (emit "error" instead).
// ─────────────────────────────────────────────

const retryStrategy = (times) => {
  if (times > 10) {
    console.error(`[Redis] Giving up after ${times} reconnect attempts`);
    return null;
  }
  const delay = Math.min(100 * 2 ** times, 5_000);
  console.warn(`[Redis] Reconnecting... attempt ${times}, next try in ${delay} ms`);
  return delay;
};

// ─────────────────────────────────────────────
// CLIENT FACTORY
// ─────────────────────────────────────────────

const createClient = (overrides = {}) =>
  new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy,

    reconnectOnError: (err) => {
      const shouldReconnect =
        err.message.includes("READONLY") ||
        err.message.includes("ECONNRESET") ||
        err.message.includes("ECONNREFUSED");

      if (shouldReconnect) {
        console.warn("[Redis reconnectOnError]:", err.message);
      }

      return shouldReconnect;
    },

    ...overrides,
  });

// ─────────────────────────────────────────────
// MAIN REDIS CLIENT
// ─────────────────────────────────────────────

const redis = createClient();

// ─────────────────────────────────────────────
// PUB CLIENT
// ─────────────────────────────────────────────

const redisPub = createClient();

// ─────────────────────────────────────────────
// SUB CLIENT
// ─────────────────────────────────────────────

const redisSub = createClient({ maxRetriesPerRequest: null });

// ─────────────────────────────────────────────
// 🔥 BULLMQ CLIENT (ONLY ADDITION)
// ─────────────────────────────────────────────

const bullRedis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // 🚨 REQUIRED FOR BULLMQ
});

// ─────────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────────

const attachEvents = (client, label, emoji) => {
  client.on("connect", () => console.log(`${emoji} ${label} connected`));
  client.on("ready", () => console.log(`${emoji} ${label} ready`));
  client.on("reconnecting", (ms) =>
    console.warn(`⏳ ${label} reconnecting in ${ms} ms`)
  );
  client.on("error", (err) =>
    console.error(`❌ ${label} error:`, err.message)
  );
  client.on("close", () =>
    console.warn(`🔌 ${label} connection closed`)
  );
  client.on("end", () =>
    console.warn(`🏁 ${label} connection ended`)
  );
};

attachEvents(redis, "Redis (main)", "✅");
attachEvents(redisPub, "Redis (publisher)", "📤");
attachEvents(redisSub, "Redis (subscriber)", "📡");
attachEvents(bullRedis, "Redis (bullmq)", "⚙️"); // 🔥 added

// ─────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────

const shutdown = async (signal) => {
  console.log(`\n🛑 ${signal} received — shutting down Redis...`);

  const closeClient = async (client, label) => {
    try {
      await client.quit();
      console.log(`✅ ${label} closed`);
    } catch (err) {
      console.warn(`⚠️  ${label} quit error (forcing disconnect):`, err.message);
      client.disconnect();
    }
  };

  await Promise.allSettled([
    closeClient(redis, "Redis (main)"),
    closeClient(redisPub, "Redis (publisher)"),
    closeClient(redisSub, "Redis (subscriber)"),
    closeClient(bullRedis, "Redis (bullmq)"), // 🔥 added
  ]);

  console.log("✅ All Redis connections closed");
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

export default redis;
export { redisPub, redisSub, bullRedis }; // 🔥 added