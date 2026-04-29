import User from "../models/User.js";
import redis from "../../config/redis.js";

/* ===================== HELPER: PRESENCE ===================== */
const getPresence = async (userId, userDoc = null) => {
    let isOnline = false;
    let lastSeen = null;

    try {
        // ✅ Check online users in Redis
        isOnline = await redis.sismember("online_users", userId);

        // ✅ If offline → fetch lastSeen
        if (!isOnline) {
            const redisLastSeen = await redis.get(`last_seen:${userId}`);

            if (redisLastSeen) {
                lastSeen = parseInt(redisLastSeen);
            } else if (userDoc?.lastSeen) {
                lastSeen = new Date(userDoc.lastSeen).getTime();
            }
        }
    } catch (err) {
        console.error("[PRESENCE] Error:", err);
    }

    return { isOnline, lastSeen };
};

/* ===================== SMART USER PROFILE ===================== */
export async function getUserProfile(req, res) {
    try {
        const { userId } = req.params;
        const relationship = req.relationship; // set by middleware

        console.log("[GET_USER_PROFILE]", { userId, relationship });

        const user = await User.findById(userId)
            .select("-password -email")
            .populate("friends", "fullName profilePic")
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const friendsCount = user.friends?.length || 0;

        // ✅ Get presence
        const { isOnline, lastSeen } = await getPresence(userId, user);

        /* ===================== STRANGER (PUBLIC VIEW) ===================== */
        if (relationship === "stranger") {
            return res.status(200).json({
                success: true,
                relationship,
                user: {
                    _id: user._id,
                    fullName: user.fullName,
                    bio: user.bio,
                    profilePic: user.profilePic,
                    friendsCount,
                },
            });
        }

        /* ===================== FRIEND / SELF (PRIVATE VIEW) ===================== */
        return res.status(200).json({
            success: true,
            relationship,
            user: {
                _id: user._id,
                fullName: user.fullName,
                bio: user.bio,
                profilePic: user.profilePic,
                location: user.location,
                isOnboarded: user.isOnboarded,
                isOnline,
                lastSeen,
                friendsCount,
                friends: user.friends, // full list
                createdAt: user.createdAt,
            },
        });

    } catch (error) {
        console.error("[GET_USER_PROFILE] Error:", {
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