// --- START OF FILE routes/userRoutes.js ---

import express from "express";
import { changePassword } from "../controllers/userController.js";
import { protect } from "../controllers/authController.js"; // Import the security middleware

const router = express.Router();

// All routes in this file are for the logged-in user, so they must be protected.
router.use(protect);

// POST /api/users/change-password
router.post("/change-password", changePassword);

export default router;