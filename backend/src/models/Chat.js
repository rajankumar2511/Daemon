import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
  },
  { timestamps: true }
);

// 🔥 Ensure only 2 users
chatSchema.path("participants").validate(function (val) {
  return val.length === 2;
}, "Chat must have exactly 2 participants");

// 🔥 Sort participants BEFORE save (critical)
chatSchema.pre("save", function (next) {
  this.participants.sort();
  next();
});

// 🔥 Unique chat per pair
chatSchema.index({ participants: 1 }, { unique: true });

const Chat = mongoose.model("Chat", chatSchema);
export default Chat;