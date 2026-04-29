import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    bio: {
      type: String,
      default: "",
    },
    profilePic: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
    isOnboarded: {
      type: Boolean,
      default: false,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// 🔐 PRE-SAVE HOOK (Password Hashing)
userSchema.pre("save", async function () {
  console.log("🧠 PRE-SAVE HOOK TRIGGERED");

  if (!this.isModified("password")) {
    console.log("🔒 Password not modified, skipping hash");
    return;
  }

  console.log("🔐 Hashing password...");

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  console.log("✅ Password hashed");
});

// 🔍 PASSWORD MATCH METHOD
userSchema.methods.matchPassword = async function (enteredPassword) {
  console.log("🔍 Comparing passwords");

  const isPasswordCorrect = await bcrypt.compare(
    enteredPassword,
    this.password
  );

  console.log("🔑 Password match result:", isPasswordCorrect);

  return isPasswordCorrect;
};

const User = mongoose.model("User", userSchema);

export default User;