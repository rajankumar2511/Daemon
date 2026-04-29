import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "file"],
      default: "text",
    },
    content: {
      type: String,
      trim: true,
      required: function () {
        return this.type === "text" && !this.isDeleted;
      },
    },

    file: {
      url: String,
      name: String,
      size: Number,       // bytes
      mimeType: String,
      publicId: String,
      resourceType: String, // ✅ Added resourceType (image, video, raw)
      downloadUrl: String,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
    seenAt: Date,
    tempId: {
      type: String,
      sparse: true, // Allow nulls, but unique when present
    },
  },
  { timestamps: true }
);

// 🔥 REQUIRED for real-time seen updates
messageSchema.index({ chatId: 1, sender: 1, status: 1 });

// 🔥 CRITICAL: Prevent duplicate messages from queue retries
messageSchema.index({ chatId: 1, tempId: 1 }, { unique: true, sparse: true });
messageSchema.index({ chatId: 1, createdAt: -1 });
const Message = mongoose.model("Message", messageSchema);
export default Message;
