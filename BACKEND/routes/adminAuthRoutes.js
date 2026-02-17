import express from "express";
import { 
    registerAdmin, 
    loginAdmin, 
    updatePlanSettings ,
      getAllAdmins,
      getAllPlanSettings ,
      deletePlan
} from "../controllers/adminAuthController.js";

const router = express.Router();

// Public routes
router.post("/register", registerAdmin);
router.post("/login", loginAdmin); // New login route

// Dynamic Settings route (Ideally protected by a SuperAdmin middleware)
router.patch("/plan-settings", updatePlanSettings);
// Add this to your existing routes
router.get("/all-admins", getAllAdmins);
router.get("/all-plans", getAllPlanSettings);
router.delete("/delete-plan/:id", deletePlan);

export default router;