import FriendRequest from "../models/FriendRequest.js";
import User from "../models/User.js";

/* ===================== LOGGER ===================== */
const log = (tag, message, data = {}) => {
  console.log(`[${tag}] ${message}`, data);
};

const logError = (tag, error, data = {}) => {
  console.error(`[${tag}] ERROR`, {
    message: error.message,
    stack: error.stack,
    ...data,
  });
};

/* ===================== SEND REQUEST ===================== */
export const sendFriendRequest = async (req, res) => {
  const from = req.userId;
  const { to } = req.body;

  try {
    log("FRIEND", "Send request", { from, to });

    if (!to) {
      return res.status(400).json({ message: "Recipient is required" });
    }

    if (from === to) {
      return res.status(400).json({ message: "Cannot send request to yourself" });
    }

    const alreadyFriends = await User.exists({ _id: from, friends: to });
    if (alreadyFriends) {
      return res.status(400).json({ message: "Already friends" });
    }

    const existing = await FriendRequest.findOne({
      from,
      to,
      status: "pending",
    });

    if (existing) {
      return res.status(400).json({ message: "Request already sent" });
    }

    try {
      const request = await FriendRequest.create({ from, to });
      log("FRIEND", "Request created", { requestId: request._id });
      return res.status(201).json({
        success: true,
        request,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Request already exists" });
      }
      throw err;
    }

  } catch (error) {
    logError("FRIEND:send", error, { from, to });
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ===================== ACCEPT REQUEST ===================== */
export const acceptFriendRequest = async (req, res) => {
  const requestId = req.params.id;
  const userId = req.userId;

  try {
    log("FRIEND", "Accept request", { requestId, userId });

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.to.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "You can only accept requests sent to you",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        message: "Request already processed",
      });
    }

    await Promise.all([
      User.findByIdAndUpdate(request.from, {
        $addToSet: { friends: request.to },
      }),
      User.findByIdAndUpdate(request.to, {
        $addToSet: { friends: request.from },
      }),
    ]);

    request.status = "accepted";
    await request.save();

    log("FRIEND", "Request accepted", { requestId });

    return res.status(200).json({
      success: true,
      message: "Friend request accepted",
    });

  } catch (error) {
    logError("FRIEND:accept", error, { requestId, userId });
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ===================== REJECT REQUEST ===================== */
export const rejectFriendRequest = async (req, res) => {
  const requestId = req.params.id;
  const userId = req.userId;

  try {
    log("FRIEND", "Reject request", { requestId, userId });

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.to.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "You can only reject requests sent to you",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        message: "Request already processed",
      });
    }

    request.status = "rejected";
    await request.save();

    log("FRIEND", "Request rejected", { requestId });

    return res.status(200).json({
      success: true,
      message: "Friend request rejected",
    });

  } catch (error) {
    logError("FRIEND:reject", error, { requestId, userId });
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ===================== CANCEL REQUEST ===================== */
export const cancelFriendRequest = async (req, res) => {
  const requestId = req.params.id;
  const userId = req.userId;

  try {
    log("FRIEND", "Cancel request", { requestId, userId });

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.from.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "Only sender can cancel request",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        message: "Cannot cancel processed request",
      });
    }

    await request.deleteOne();

    log("FRIEND", "Request cancelled", { requestId });

    return res.status(200).json({
      success: true,
      message: "Friend request cancelled",
    });

  } catch (error) {
    logError("FRIEND:cancel", error, { requestId, userId });
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ===================== GET REQUESTS ===================== */
export const getFriendRequests = async (req, res) => {
  const userId = req.userId;

  try {
    log("FRIEND", "Get incoming requests", { userId });

    const requests = await FriendRequest.find({
      to: userId,
      status: "pending",
    }).populate("from", "fullName profilePic");

    return res.status(200).json({
      success: true,
      requests,
    });

  } catch (error) {
    logError("FRIEND:getRequests", error, { userId });
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ===================== GET FRIENDS ===================== */
export const getFriends = async (req, res) => {
  const userId = req.userId;

  try {
    log("FRIEND", "Get friends list", { userId });

    const user = await User.findById(userId).populate(
      "friends",
      "fullName profilePic email"
    );

    return res.status(200).json({
      success: true,
      friends: user?.friends || [],
    });

  } catch (error) {
    logError("FRIEND:getFriends", error, { userId });
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ===================== GET ALL USERS ===================== */
export const getAllUsers = async (req, res) => {
  const userId = req.userId;

  try {
    log("FRIEND", "Get all users", { userId });

    const currentUser = await User.findById(userId);

    const users = await User.find({
      _id: {
        $nin: [...currentUser.friends, currentUser._id],
      },
    }).select("-password");

    return res.status(200).json({
      success: true,
      users,
    });

  } catch (error) {
    logError("FRIEND:getAllUsers", error, { userId });
    return res.status(500).json({ message: "Internal server error" });
  }
};


export const getUserFriendsById = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).populate(
      "friends",
      "fullName profilePic"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      friends: user.friends || [],
    });

  } catch (error) {
    console.error("[getUserFriendsById]", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};