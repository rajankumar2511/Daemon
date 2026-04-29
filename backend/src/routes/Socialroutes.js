import express from "express";

import { protect } from "../middlewares/auth.middleware.js";
import { checkUserRelationship } from "../middlewares/relationship.middleware.js";
import { getUserProfile } from "../controllers/user.controller.js";

const router = express.Router();

/* ===================== USER PROFILE ===================== */
// 🔥 ONE ROUTE → middleware decides → controller adapts response
router.get(
  "/user/:userId",
  protect,                  // attaches req.user (if logged in)
  checkUserRelationship,    // sets req.relationship
  getUserProfile            // returns public/private based on relationship
);

export default router;