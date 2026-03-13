import express from "express";
import { protect } from "../middleware/authMiddleware.js";

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
    getAdminProfile ,
    updateAdminProfile,
    getAllFeatures,
    getMyPlanFeatures
} from "../controllers/adminAuthController.js";

const router = express.Router();

// Public routes
router.post("/register", registerAdmin);
router.post("/login", loginAdmin);

// Protected routes (only these two)
router.get("/profile", protect, getAdminProfile); 
router.put("/profile/update", protect, updateAdminProfile);

// Public routes (no protect)
router.patch("/plan-settings", updatePlanSettings);
router.get("/all-admins", getAllAdmins);
router.get("/all-plans", getAllPlanSettings);
router.delete("/delete-plan/:id", deletePlan);
router.get("/login-access", getLoginAccessStatus);
router.patch("/login-access/admin/:adminId", toggleAdminLogin);
router.patch("/login-access/employees/:adminId", toggleEmployeeLoginByAdmin);
router.get("/all-features",      protect, getAllFeatures);   
router.get("/my-plan-features",  protect, getMyPlanFeatures);

export default router;