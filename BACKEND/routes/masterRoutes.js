// --- START OF FILE routes/masterRoutes.js ---
import express from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { 
  authMaster, 
  getAllAdmins, 
  updateMasterSettings,
  assignPlan,
  getAdminPlanDetails,
  customizePlan,
  uploadLogo,
  removeLogo
} from "../controllers/masterController.js";
import { protectMaster } from "../middleware/authMasterMiddleware.js";
import { cloudinary } from "../config/cloudinary.js";

const router = express.Router();

// Dedicated Cloudinary storage for company logos
const logoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "company_logos",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    resource_type: "image",
  },
});
const uploadLogo_mw = multer({ storage: logoStorage });

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

// @route   POST /api/master/assign-plan
// @desc    Assign plan snapshot to an admin
// @access  Private (Master Only)
router.post("/assign-plan", protectMaster, assignPlan);

// @route   GET /api/master/customize-plan/:adminId
// @desc    Get admin plan snapshot details
// @access  Private (Master Only)
router.get("/customize-plan/:adminId", protectMaster, getAdminPlanDetails);

// @route   PATCH /api/master/customize-plan/:adminId
// @desc    Customize plan snapshot for a specific admin
// @access  Private (Master Only)
router.patch("/customize-plan/:adminId", protectMaster, customizePlan);

// @route   PATCH /api/superadmin/admins/:adminId/upload-logo
// @desc    Upload / replace company logo for a specific admin
// @access  Private (Master Only)
router.patch("/admins/:adminId/upload-logo", protectMaster, uploadLogo_mw.single("logo"), uploadLogo);

// @route   DELETE /api/master/admins/:adminId/logo
// @desc    Remove custom logo and reset to default
// @access  Private (Master Only)
router.delete("/admins/:adminId/logo", protectMaster, removeLogo);

export default router;
// --- END OF FILE routes/masterRoutes.js ---