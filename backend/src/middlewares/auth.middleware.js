import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    let token;

    // 1️⃣ Authorization header (optional)
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
      console.log("🔑 Auth Middleware: Token from Header");
    }

    // 2️⃣ Cookie (main)
    if (!token && req.cookies?.jwt) {
      token = req.cookies.jwt;
      console.log("🍪 Auth Middleware: Token from Cookie");
    }

    // 3️⃣ No token
    if (!token) {
      console.warn("🚫 Auth Middleware: No token found in header or cookie");
      console.log("   - Headers:", JSON.stringify(req.headers, null, 2));
      console.log("   - Cookies:", JSON.stringify(req.cookies, null, 2));
      return res.status(401).json({ message: "Not authenticated" });
    }

    // 4️⃣ Verify
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    console.log("✅ Auth Middleware: Token verified for user:", decoded.userId);

    // 5️⃣ Load user from DB (🔥 THIS WAS MISSING)
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      console.warn("🚫 Auth Middleware: User not found in DB:", decoded.userId);
      return res.status(401).json({ message: "User not found" });
    }

    // 🔑 Attach to request
    req.user = user;
    req.userId = user._id; // optional, but useful

    next();
    //console.log("🔐 protect middleware hit");
    //console.log("🍪 cookies:", req.cookies);
    //console.log("🔑 headers auth:", req.headers.authorization);

  } catch (error) {
    console.error("Auth error:", error.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};
