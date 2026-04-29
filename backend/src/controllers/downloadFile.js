import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import https from "https";
import http from "http";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

// Load .env explicitly to ensure Cloudinary config works
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const downloadFile = async (req, res) => {
  try {
    const { chatId } = req.params;
    // With wildcard route /*publicId, value is in req.params[0]
    let publicId = req.params.publicId || req.params[0];

    // 🔥 FIX: handle array case
    if (Array.isArray(publicId)) {
      publicId = publicId.join("/");
    }
    const userId = req.userId;

    // ✅ URL-decode the publicId (in case it contains encoded characters like %2F for /)
    publicId = decodeURIComponent(publicId);

    console.log("📥 Download request details:", {
      chatId,
      publicId,
      params: req.params,
      userId,
      allParams: Object.keys(req.params)
    });

    // 1. Verify chatId format
    if (!chatId || !chatId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error("❌ Invalid Chat ID format:", chatId);
      return res.status(400).json({
        message: "Invalid Chat ID format",
        debug: { chatId }
      });
    }

    // 2. Verify user is in the chat
    const chat = await Chat.findById(chatId).lean();
    if (!chat) {
      console.error("❌ Chat not found:", chatId);
      return res.status(404).json({
        message: "Chat not found",
        debug: { chatId }
      });
    }

    const isParticipant = chat.participants.some(id => id.toString() === userId.toString());
    if (!isParticipant) {
      console.error("❌ User not participant in chat:", {
        userId,
        participants: chat.participants,
        chatId
      });
      return res.status(403).json({
        message: "Not authorized to access this file",
        debug: { userId, chatId }
      });
    }

    // 3. Find the message containing this file
    console.log("🔍 Searching for message with publicId:", publicId);

    // Try exact match first
    // 🔥 Normalize values
    const normalized = decodeURIComponent(publicId);
    const filename = normalized.split("/").pop();

    console.log("🔍 normalized:", normalized);
    console.log("🔍 filename:", filename);

    // ✅ Robust search (THIS IS THE FIX)
    let message = await Message.findOne({
      chatId,
      $or: [
        { "file.publicId": normalized },          // exact match
        { "file.publicId": filename },            // without folder
        { "file.publicId": { $regex: filename } },// partial match
        { "file.url": { $regex: filename } }      // match in URL
      ]
    }).lean();
    if (!message) {
      const all = await Message.find({ chatId, type: "file" }).lean();
      console.log("📦 DB publicIds:", all.map(m => m.file?.publicId));
    }
    if (!message) {
      console.log("⚠️  Message not found by exact publicId match, trying fuzzy match...");

      // Fallback 1: Try without leading slash if present
      const noSlashId = publicId.startsWith('/') ? publicId.substring(1) : publicId;

      // Fallback 2: Try regex match that is more flexible with slashes
      // This helps if the DB has "folder/file" but URL has "folder%2Ffile" or similar
      const fuzzyPattern = publicId.replace(/[\/\\]/g, '.*');

      message = await Message.findOne({
        chatId,
        $or: [
          { "file.publicId": noSlashId },
          { "file.publicId": { $regex: fuzzyPattern, $options: 'i' } },
          { "file.url": { $regex: publicId.split('/').pop(), $options: 'i' } } // Last resort: match filename in URL
        ]
      }).lean();
    }

    if (!message) {
      console.log("⚠️  Still not found, searching for ANY file message that might match...");
      // Extreme fallback: find any file message in this chat and check if the publicId is part of the stored one
      const fileMessages = await Message.find({ chatId, type: "file" }).lean();
      message = fileMessages.find(m =>
        m.file?.publicId?.includes(publicId) ||
        publicId.includes(m.file?.publicId || '---')
      );
    }

    if (!message) {
      console.log("⚠️  Still not found, listing all messages in this chat...");
      const allMessages = await Message.find({ chatId, type: "file" }).lean();
      console.log("📋 All file messages in chat:", allMessages.map(m => ({
        id: m._id,
        filePublicId: m.file?.publicId,
        fileName: m.file?.name
      })));

      return res.status(404).json({
        message: "File not found in this chat",
        debug: { searchedFor: publicId }
      });
    }

    if (!message.file || !message.file.url) {
      console.error("❌ Message found but no file data:", { messageId: message._id });
      return res.status(404).json({ message: "File metadata missing" });
    }

    const fileUrl = message.file.url;
    const fileName = message.file.name || "download";
    const filePublicId = message.file.publicId;

    // Determine resource_type: use stored one or detect from URL
    let resourceType = message.file.resourceType;

    if (!resourceType) {
      resourceType = "image"; // default
      if (fileUrl.includes("/raw/")) resourceType = "raw";
      if (fileUrl.includes("/video/")) resourceType = "video";
    }

    console.log("✅ Found file message:", {
      messageId: message._id,
      fileName,
      filePublicId,
      resourceType,
      fileUrl: fileUrl.substring(0, 80) + "...",
      mimeType: message.file.mimeType
    });

    // 4. Generate a signed URL to handle private/authenticated assets
    // This fixes the 401 error from Cloudinary
    console.log("🛠️  Cloudinary Config state:", {
      cloud_name: cloudinary.config().cloud_name ? "✅" : "❌",
      api_key: cloudinary.config().api_key ? "✅" : "❌",
    });

    const signedUrl = cloudinary.url(filePublicId, {
      resource_type: resourceType,
      sign_url: true,
      secure: true,
    });

    console.log("🔐 Generated signed URL:", signedUrl);

    // 5. Stream from Cloudinary to client
    const client = signedUrl.startsWith("https") ? https : http;
    const isView = req.query.view === "true";

    console.log("🔄 Attempting to stream from signed URL...", { isView, fileName, mimeType: message.file.mimeType });

    const request = client.get(signedUrl, (cloudinaryRes) => {
      console.log("📡 Cloudinary response status:", cloudinaryRes.statusCode);
      console.log("📡 Cloudinary headers:", JSON.stringify(cloudinaryRes.headers, null, 2));

      if (cloudinaryRes.statusCode !== 200) {
        console.error("❌ Cloudinary REJECTED the request even with signed URL!");
        // Consume response data to free up memory
        cloudinaryRes.resume();
        return res.status(cloudinaryRes.statusCode).json({
          message: "Cloudinary rejected the signed request",
          debug: {
            statusCode: cloudinaryRes.statusCode,
            signedUrl: signedUrl.substring(0, 100) + "..."
          }
        });
      }

      // ✅ 1. DETERMINE CONTENT-TYPE (Priority: stored mimeType > Cloudinary > default)
      let contentType = message.file.mimeType || cloudinaryRes.headers["content-type"] || "application/octet-stream";
      
      // Ensure valid MIME type format
      if (!contentType.includes("/")) {
        contentType = "application/octet-stream";
      }
      
      console.log("📋 Final Content-Type:", contentType);

      // ✅ 2. PROPER FILENAME ENCODING (RFC 5987)
      // For ASCII-only filenames, simple encoding. For Unicode, RFC 5987 format.
      const isAsciiOnly = /^[\x20-\x7E]*$/.test(fileName);
      let dispositionValue;
      
      if (isAsciiOnly) {
        // Simple ASCII filename
        dispositionValue = isView 
          ? `inline; filename="${fileName}"`
          : `attachment; filename="${fileName}"`;
      } else {
        // Unicode filename - use RFC 5987 encoding
        const encodedName = encodeURIComponent(fileName);
        dispositionValue = isView
          ? `inline; filename*=UTF-8''${encodedName}`
          : `attachment; filename*=UTF-8''${encodedName}`;
      }

      // ✅ 3. SET RESPONSE HEADERS
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", dispositionValue);
      res.setHeader("Cache-Control", isView ? "public, max-age=31536000" : "public, max-age=3600");
      res.setHeader("X-Content-Type-Options", "nosniff"); // ✅ Security: prevent MIME type sniffing
      res.setHeader("X-Frame-Options", "DENY"); // ✅ Security: prevent clickjacking

      if (cloudinaryRes.headers["content-length"]) {
        res.setHeader("Content-Length", cloudinaryRes.headers["content-length"]);
      }

      console.log("✅ Streaming file to client...", {
        fileName,
        contentType,
        disposition: dispositionValue,
        contentLength: cloudinaryRes.headers["content-length"]
      });

      // Pipe the response
      cloudinaryRes.pipe(res);
    });

    request.on("error", (err) => {
      console.error("❌ Download streaming error:", err.message, err.code);
      if (!res.headersSent) {
        res.status(500).json({ message: "Error during file download", error: err.message });
      }
    });

    // Set a timeout
    request.setTimeout(60000, () => { // Increased to 60s for larger files
      request.destroy();
      console.error("❌ Download request timeout");
      if (!res.headersSent) {
        res.status(504).json({ message: "Download timeout" });
      }
    });

  } catch (error) {
    console.error("❌ Download controller error:", error.message);
    console.error("Stack:", error.stack);
    res.status(500).json({ message: "Internal server error during download", error: error.message });
  }
};
