import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import { uploadOnCloudinary } from "../lib/cloudinary.js";
import redis, { redisPub } from "../../config/redis.js";
import { emitToUser } from "../socket/socket.js";
import { v2 as cloudinary } from "cloudinary";
import { randomBytes } from "crypto";

const SERVER_ID =
  process.env.SERVER_ID ||
  `server-${Math.random().toString(36).substring(7)}`;

export const sendFileMessage = async (req, res) => {
  try {
    console.log("🚀 sendFileMessage controller hit");

    const { chatId } = req.params;
    const { tempId: frontendTempId } = req.body;
    const senderId = req.userId;

    /* ───────── VALIDATIONS ───────── */

    if (!senderId) {
      return res.status(401).json({
        message: "Unauthorized - no user ID",
      });
    }

    if (!chatId) {
      return res.status(400).json({
        message: "Chat ID is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "No file provided",
        code: "NO_FILE",
      });
    }

    /* ───────── CHECK CHAT ───────── */

    const chat = await Chat.findById(chatId).lean();

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
        code: "CHAT_NOT_FOUND",
      });
    }

    const isParticipant = chat.participants.some(
      (id) => id.toString() === senderId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        message: "Not authorized",
        code: "FORBIDDEN",
      });
    }

    const receiverId = chat.participants.find(
      (id) => id.toString() !== senderId.toString()
    );

    if (!receiverId) {
      return res.status(400).json({
        message: "Invalid chat",
        code: "INVALID_CHAT",
      });
    }

    /* ───────── 1️⃣ UPLOAD TO CLOUDINARY (BUFFER) ───────── */

    console.log("☁️ Uploading to Cloudinary...");
    const cloudinaryRes = await uploadOnCloudinary(req.file.buffer);

    if (!cloudinaryRes) {
      throw new Error("Cloudinary upload failed");
    }

    console.log("✅ Upload success");

    /* ───────── 2️⃣ CREATE MESSAGE ───────── */

    const receiverOnline = await redis.sismember(
      "online_users",
      receiverId.toString()
    );

    const initialStatus = receiverOnline ? "delivered" : "sent";

    let message;

    try {
      // ✅ Use the secure_url directly from Cloudinary response (already works!)
      const fileUrl = cloudinaryRes.secure_url;

      // ✅ Construct download URL from request origin
      const downloadUrl = `/chats/${chatId}/download/${cloudinaryRes.public_id}`;

      // ✅ Use frontend tempId if available to sync UI state
      const tempId = frontendTempId || `file-${randomBytes(8).toString("hex")}`;

      message = await Message.create({
        chatId,
        sender: senderId,
        type: "file",
        content: req.file.originalname,
        tempId, // ✅ Unique tempId for this file message
        file: {
          url: fileUrl,
          name: req.file.originalname,
          size: cloudinaryRes.bytes,
          mimeType: req.file.mimetype,
          publicId: cloudinaryRes.public_id,
          resourceType: cloudinaryRes.resource_type, // ✅ Added resourceType
          downloadUrl: downloadUrl, // ✅ Added downloadUrl for proxy access
        },
        status: initialStatus,
      });
    } catch (dbError) {
      console.error("❌ DB error, rolling back cloudinary...");

      // 🔥 rollback cloudinary upload
      if (cloudinaryRes?.public_id) {
        await cloudinary.uploader.destroy(cloudinaryRes.public_id);
      }

      throw dbError;
    }

    console.log("✅ Message created:", message._id);

    /* ───────── 3️⃣ UPDATE CHAT ───────── */

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    /* ───────── 4️⃣ SERIALIZE ───────── */

    const serializedMessage = {
      ...message.toObject(),
      _id: message._id.toString(),
      chatId: message.chatId.toString(),
      sender: message.sender.toString(),
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    };

    /* ───────── 5️⃣ REAL-TIME DELIVERY ───────── */

    try {
      await redisPub.publish(
        "message:new",
        JSON.stringify({
          receiverId: receiverId.toString(),
          message: serializedMessage,
          _origin: SERVER_ID,
          delivered: receiverOnline,
        })
      );

      // ✅ ACK to sender for real-time status update
      await redisPub.publish(
        "message:sent",
        JSON.stringify({
          tempId: tempId,
          message: serializedMessage,
          _origin: SERVER_ID,
        })
      );

      if (receiverOnline) {
        emitToUser(senderId.toString(), "message-status-update", {
          messageId: message._id.toString(),
          status: "delivered",
        });

        await redisPub.publish(
          "message:status",
          JSON.stringify({
            senderId: senderId.toString(),
            messageId: message._id.toString(),
            status: "delivered",
            _origin: SERVER_ID,
          })
        );
      }
    } catch (err) {
      console.error("[REDIS_ERROR]", err.message);
    }

    console.log("✅ File message sent");

    return res.status(201).json({
      success: true,
      message: serializedMessage,
    });

  } catch (error) {
    console.error("❌ File message error:", error.message);

    return res.status(500).json({
      message: "Server error while sending file",
      code: "SERVER_ERROR",
    });
  }
};
