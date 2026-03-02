import express from "express";
import { 
    registerAdmin, 
    loginAdmin, 
    updatePlanSettings,
    getAllAdmins,
    getAllPlanSettings,
    deletePlan,
    toggleAdminLogin,
    toggleEmployeeLoginByAdmin,
    getLoginAccessStatus,
} from "../controllers/adminAuthController.js";

const router = express.Router();

// Public routes
router.post("/register", registerAdmin);
router.post("/login", loginAdmin);

// Dynamic Settings route (Ideally protected by a SuperAdmin middleware)
router.patch("/plan-settings", updatePlanSettings);

// Admin management
router.get("/all-admins", getAllAdmins);
router.get("/all-plans", getAllPlanSettings);
router.delete("/delete-plan/:id", deletePlan);

// ==================== LOGIN ACCESS CONTROL ROUTES ====================
// Get login access status for all admins (with employee counts)
router.get("/login-access", getLoginAccessStatus);

// Toggle login for a specific admin (and optionally their employees)
router.patch("/login-access/admin/:adminId", toggleAdminLogin);

// Toggle login for ALL employees under a specific admin
router.patch("/login-access/employees/:adminId", toggleEmployeeLoginByAdmin);

export default router;