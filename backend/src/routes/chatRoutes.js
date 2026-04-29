import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { sendFileMessage } from "../controllers/sendFileMessage.js";
import { downloadFile } from "../controllers/downloadFile.js";

import {
  getOrCreateChat,
  getUserChats,
  sendMessage,
  getChatMessages,
  deleteMessages
} from "../controllers/chat.controller.js";

const router = express.Router();
console.log("🔥 chatRoutes loaded");

// ✅ CRITICAL: specific routes MUST come before param routes.
// Without this, GET /chats/abc123/messages matches /:friendId first
// and tries to create a chat with friendId="abc123/messages" — returning
// wrong data or 403, which is why messages disappear on refresh.

router.get("/", protect, getUserChats);

// Specific sub-paths first
router.get("/:chatId/messages", protect, getChatMessages);
router.post("/:chatId/messages", protect, sendMessage);
router.delete("/:chatId/messages/bulk", protect, deleteMessages);
router.get("/:chatId/download/*publicId", protect, downloadFile);

// ✅ File upload endpoint with proper middleware chain
router.post("/:chatId/file", 
  (req, res, next) => {
    console.log("📩 FILE ROUTE HIT - Initial middleware");
    console.log("   - chatId:", req.params.chatId);
    console.log("   - URL:", req.url);
    console.log("   - Method:", req.method);
    next();
  }, 
  protect, 
  (req, res, next) => {
    console.log("✅ Auth passed");
    console.log("   - User ID:", req.userId);
    // ✅ Multer error handling wrapper
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("❌ Multer error caught:", {
          message: err.message,
          code: err.code,
          field: err.field
        });
        return res.status(400).json({
          message: err.message,
          code: "FILE_UPLOAD_ERROR"
        });
      }
      console.log("📎 File received by multer:", {
        hasFile: !!req.file,
        fileInfo: req.file ? {
          fieldname: req.file.fieldname,
          originalname: req.file.originalname,
          encoding: req.file.encoding,
          mimetype: req.file.mimetype,
          size: req.file.size,
          path: req.file.path,
        } : "NONE"
      });
      next();
    });
  },
  sendFileMessage
);

// Generic param route LAST
router.get("/:friendId", protect, getOrCreateChat);

export default router;