import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendRequests,cancelFriendRequest,
  getFriends,
  getAllUsers,
  getUserFriendsById

} from "../controllers/friend.controller.js";

const router = express.Router();

router.post("/request", protect, sendFriendRequest);
router.get("/requests", protect, getFriendRequests);
router.post("/accept/:id", protect, acceptFriendRequest);
router.post("/reject/:id", protect, rejectFriendRequest);
router.delete("/cancel/:id", protect, cancelFriendRequest);
router.get("/friendslist", protect,getFriends );
router.get("/all", protect, getAllUsers);
router.get("/:userId", protect, getUserFriendsById);
export default router;
