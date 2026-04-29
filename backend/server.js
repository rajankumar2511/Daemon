import dotenv from "dotenv";

// ✅ Load env (works both locally + production)
dotenv.config();

import express from "express";
import authRoutes from "./src/routes/authRoutes.js";
import friendRoutes from "./src/routes/friendreq.js";
import chatRoutes from "./src/routes/chatRoutes.js";
import { connectDB } from "./src/lib/db.js";
import { drainQueueToDatabase } from "./src/lib/messageRecovery.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { initSocket } from "./src/socket/socket.js";
import socialroutes from "./src/routes/Socialroutes.js";

const app = express();

// ✅ CORS (works locally now, will work in prod when you change env)
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

// ✅ Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ Debug logs (safe, optional but useful)
app.use((req, res, next) => {
  console.log("➡️", req.method, req.url);
  next();
});

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/social", socialroutes);

// ✅ Port (auto for prod, fixed for local)
const PORT = process.env.PORT || 5000;

let server;

// ✅ Start server
const startServer = async () => {
  try {
    console.log("🔌 Connecting to database...");
    await connectDB();
    console.log("✅ Database connected");

    server = http.createServer(app);

    // ✅ Socket.io attach
    initSocket(server);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// ✅ Graceful shutdown (important for real-world deploy)
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal} - shutting down...`);

  try {
    // Save pending messages
    try {
      console.log("💾 Saving pending messages...");
      await drainQueueToDatabase();
      console.log("✅ Messages saved");
    } catch (err) {
      console.warn("⚠️ Queue backup failed:", err.message);
    }

    // Close server
    if (server) {
      console.log("🔌 Closing server...");
      await new Promise((resolve) => server.close(resolve));
      console.log("✅ Server closed");
    }

    console.log("👋 Shutdown complete");
    process.exit(0);

  } catch (err) {
    console.error("❌ Shutdown error:", err.message);
    process.exit(1);
  }
};

// ✅ Handle termination signals
["SIGINT", "SIGTERM", "SIGQUIT"].forEach((signal) => {
  process.on(signal, () => gracefulShutdown(signal));
});

// ✅ Prevent crash on unhandled errors
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  // Optional: gracefulShutdown("uncaughtException");
});

// ✅ Run app
startServer();