// --- START OF FILE routes/userRoutes.js ---

import express from "express";
// ✅ Import both controller functions
import { changePassword, updateMyProfile } from "../controllers/userController.js";
import { protect } from "../controllers/authController.js";

const router = express.Router();

// All routes in this file are for the logged-in user, so they must be protected.
router.use(protect);

// POST /api/users/change-password
router.post("/change-password", changePassword);

// ✅ ADDED: Route for updating a user's own profile
// PUT /api/users/profile
router.put("/profile", updateMyProfile);

export default router;