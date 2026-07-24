import express from "express";
import { protect } from "../middleware/authMiddleware.js";

import {
    registerAdmin,
    loginAdmin,
    updatePlanSettings,
    getAllAdmins,
    getAllPlanSettings,
    deletePlan,
    togglePlanVisibility,
    toggleAdminLogin,
    toggleEmployeeLoginByAdmin,
    getLoginAccessStatus,
    getAdminProfile,
    updateAdminProfile,
    getMobileAccess,
    updateMobileAccess,
    getAllFeatures,
    getMyPlanFeatures,
    changeAdminPassword,
    deleteAdmin,
    getSupportAdmins,
    deleteSupportAdmin,
    registerSupportAdmin,
    updateSupportAdmin,
    freeUpgradeToOwner
} from "../controllers/adminAuthController.js";

const router = express.Router();

// Public routes
router.post("/register", registerAdmin);
router.post("/login", loginAdmin);

// Protected routes (only these two)
router.get("/profile", protect, getAdminProfile);
router.put("/profile/update", protect, updateAdminProfile);
router.get("/mobile-access", protect, getMobileAccess);
router.patch("/mobile-access", protect, updateMobileAccess);
router.post("/free-upgrade-to-owner", protect, freeUpgradeToOwner);
router.post("/support-admins", protect, registerSupportAdmin);
router.get("/support-admins", protect, getSupportAdmins);
router.put("/support-admins/:id", protect, updateSupportAdmin);
router.delete("/support-admins/:id", protect, deleteSupportAdmin);

// Public routes (no protect)
router.patch("/plan-settings", updatePlanSettings);
router.get("/all-admins", getAllAdmins);
router.get("/all-plans", getAllPlanSettings);
router.delete("/delete-plan/:id", deletePlan);
router.patch("/toggle-plan/:id", togglePlanVisibility);
router.get("/login-access", getLoginAccessStatus);
router.patch("/login-access/admin/:adminId", toggleAdminLogin);
router.patch("/login-access/employees/:adminId", toggleEmployeeLoginByAdmin);
router.get("/all-features", protect, getAllFeatures);
router.get("/my-plan-features", protect, getMyPlanFeatures);
router.patch("/change-password/:adminId", changeAdminPassword);
router.delete("/delete-admin/:adminId", deleteAdmin);

export default router;
