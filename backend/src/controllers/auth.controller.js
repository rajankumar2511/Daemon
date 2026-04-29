import User from "../models/User.js";
import jwt from "jsonwebtoken";
import redis from "../../config/redis.js"; // Add this import at the top

/* ===================== CONFIG ===================== */
const isProd = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  sameSite: isProd ? "none" : "lax",
  secure: isProd,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET_KEY,
    { expiresIn: "7d" }
  );
};

/* ===================== SIGNUP ===================== */
export async function signup(req, res) {
  const { email, password, fullName } = req.body;

  try {
    console.log("[SIGNUP] Request received:", { email, fullName });

    if (!email || !password || !fullName) {
      console.warn("[SIGNUP] Missing fields");
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      console.warn("[SIGNUP] Weak password attempt:", email);
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.warn("[SIGNUP] Duplicate email:", email);
      return res.status(400).json({ message: "Email already exists" });
    }

    const avatarIndex = Math.floor(Math.random() * 100) + 1;
    const profilePic = `https://avatar.iran.liara.run/public/${avatarIndex}.png`;

    const newUser = await User.create({
      email,
      fullName,
      password,
      profilePic,
    });

    const token = generateToken(newUser._id);
    res.cookie("jwt", token, cookieOptions);

    const userData = newUser.toObject();
    delete userData.password;

    console.log("[SIGNUP] Success:", {
      userId: newUser._id,
      email: newUser.email,
    });

    return res.status(201).json({
      success: true,
      user: userData,
    });

  } catch (error) {
    console.error("[SIGNUP] Error:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
    });

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
}

/* ===================== LOGIN ===================== */
export async function login(req, res) {
  const { email, password } = req.body;

  try {
    console.log("[LOGIN] Attempt:", { email });

    if (!email || !password) {
      console.warn("[LOGIN] Missing credentials");
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.warn("[LOGIN] User not found:", email);
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const isPasswordCorrect = await user.matchPassword(password);
    if (!isPasswordCorrect) {
      console.warn("[LOGIN] Incorrect password:", email);
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user._id);
    res.cookie("jwt", token, cookieOptions);

    console.log("[LOGIN] Success:", {
      userId: user._id,
      email: user.email,
    });

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
    });

  } catch (error) {
    console.error("[LOGIN] Error:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
    });

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
}

/* ===================== LOGOUT ===================== */
export function logout(req, res) {
  try {
    res.clearCookie("jwt", {
      httpOnly: true,
      sameSite: cookieOptions.sameSite,
      secure: cookieOptions.secure,
      path: "/",
    });

    console.log("[LOGOUT] Success");

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });

  } catch (error) {
    console.error("[LOGOUT] Error:", {
      message: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
}

/* ===================== GET LAST SEEN ===================== */
export async function getLastSeen(req, res) {
  try {
    const { userId } = req.params;
    
    console.log("[LAST_SEEN] Fetching for user:", userId);

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: "User ID is required" 
      });
    }
    
    // Check if user is online in Redis
    let isOnline = false;
    let lastSeen = null;
    
    try {
      if (redis) {
        isOnline = await redis.sismember("online_users", userId);
        console.log("[LAST_SEEN] Redis online check:", { userId, isOnline });
      }
    } catch (redisError) {
      console.error("[LAST_SEEN] Redis error:", redisError);
    }
    
    if (isOnline) {
      console.log("[LAST_SEEN] User is online:", userId);
      return res.status(200).json({
        success: true,
        isOnline: true,
        lastSeen: null
      });
    }
    
    // Try to get last seen from Redis first
    try {
      if (redis) {
        const redisLastSeen = await redis.get(`last_seen:${userId}`);
        if (redisLastSeen) {
          lastSeen = parseInt(redisLastSeen);
          console.log("[LAST_SEEN] Found in Redis:", { userId, lastSeen });
        }
      }
    } catch (redisError) {
      console.error("[LAST_SEEN] Redis read error:", redisError);
    }
    
    // If not in Redis, get from database
    if (!lastSeen) {
      const user = await User.findById(userId).select('lastSeen');
      if (user && user.lastSeen) {
        lastSeen = new Date(user.lastSeen).getTime();
        console.log("[LAST_SEEN] Found in database:", { userId, lastSeen });
      } else {
        console.log("[LAST_SEEN] No last seen found for user:", userId);
      }
    }
    
    return res.status(200).json({
      success: true,
      isOnline: false,
      lastSeen: lastSeen || null
    });
    
  } catch (error) {
    console.error("[LAST_SEEN] Error:", {
      message: error.message,
      stack: error.stack,
      userId: req.params.userId
    });
    
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
}

/* ===================== UPDATE LAST SEEN ===================== */
export async function updateLastSeen(req, res) {
  try {
    const { userId } = req.params;
    const { lastSeen } = req.body;
    
    console.log("[UPDATE_LAST_SEEN] Updating for user:", userId);
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: "User ID is required" 
      });
    }
    
    const lastSeenDate = lastSeen ? new Date(lastSeen) : new Date();
    
    const user = await User.findByIdAndUpdate(
      userId,
      { lastSeen: lastSeenDate },
      { new: true }
    ).select('lastSeen');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }
    
    console.log("[UPDATE_LAST_SEEN] Success:", { userId, lastSeen: lastSeenDate });
    
    return res.status(200).json({
      success: true,
      lastSeen: user.lastSeen
    });
    
  } catch (error) {
    console.error("[UPDATE_LAST_SEEN] Error:", {
      message: error.message,
      stack: error.stack,
      userId: req.params.userId
    });
    
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
}