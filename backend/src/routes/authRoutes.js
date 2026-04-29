import express from "express";
const router = express.Router();
import {signup,login,logout,getLastSeen,updateLastSeen } from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

router.get("/me", protect, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});
router.get("/:userId/last-seen", protect, getLastSeen);
router.put("/:userId/last-seen", protect, updateLastSeen);
export default router;