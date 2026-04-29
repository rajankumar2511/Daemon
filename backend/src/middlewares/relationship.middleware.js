import User from "../models/User.js";

/* ===================== CHECK USER RELATIONSHIP ===================== */
export async function checkUserRelationship(req, res, next) {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?._id;

    console.log("[RELATIONSHIP] Checking:", {
      currentUserId,
      targetUserId: userId,
    });

    // ❌ No auth user → treat as stranger
    if (!currentUserId) {
      req.relationship = "stranger";
      return next();
    }

    // ✅ Self check
    if (userId === currentUserId.toString()) {
      req.relationship = "self";
      return next();
    }

    // ✅ Fetch only friends (optimized query)
    const user = await User.findById(userId)
      .select("friends")
      .lean();

    if (!user) {
      console.warn("[RELATIONSHIP] User not found:", userId);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ✅ Check friend relationship
    const isFriend = user.friends?.some(
      (friendId) => friendId.toString() === currentUserId.toString()
    );

    req.relationship = isFriend ? "friend" : "stranger";

    console.log("[RELATIONSHIP] Result:", {
      relationship: req.relationship,
    });

    return next();

  } catch (error) {
    console.error("[RELATIONSHIP] Error:", {
      message: error.message,
      stack: error.stack,
      userId: req.params.userId,
    });

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}