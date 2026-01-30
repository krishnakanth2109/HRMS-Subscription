// --- START OF FILE routes/masterRoutes.js ---
import express from "express";
import { 
  authMaster, 
  getAllAdmins, 
  updateMasterSettings 
} from "../controllers/masterController.js";
import { protectMaster } from "../middleware/authMasterMiddleware.js";

const router = express.Router();

// @route   POST /api/master/login
// @desc    Authenticate Master Admin
// @access  Public
router.post("/login", authMaster);

// @route   GET /api/master/admins
// @desc    Get all registered companies/admins
// @access  Private (Master Only)
router.get("/admins", protectMaster, getAllAdmins);

// @route   PUT /api/master/settings
// @desc    Update global system settings
// @access  Private (Master Only)
router.put("/settings", protectMaster, updateMasterSettings);

export default router;
// --- END OF FILE routes/masterRoutes.js ---