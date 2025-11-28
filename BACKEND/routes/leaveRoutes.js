// --- UPDATED FILE: routes/leaveRoutes.js ---

import express from "express";
import {
  createLeave,
  listLeavesForEmployee,
  adminListAllLeaves,
  getLeaveDetails,
  updateLeaveStatus,
  cancelLeave,
} from "../controllers/leaveController.js";

import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();

// 🔐 All routes require login
router.use(protect);

/* ============================================================================
   📌 ADMIN → GET ALL LEAVES
   (Managers CANNOT access this, only admin)
============================================================================ */
router.get("/", adminListAllLeaves);

/* ============================================================================
   📝 EMPLOYEE/MANAGER → APPLY FOR LEAVE
============================================================================ */
router.post("/apply", createLeave);

/* ============================================================================
   👤 EMPLOYEE/MANAGER → GET THEIR OWN LEAVES
============================================================================ */
router.get("/my-leaves", listLeavesForEmployee);

/* ============================================================================
   📄 GET LEAVE DETAILS (Admin + Employee who owns leave)
============================================================================ */
router.get("/:id/details", getLeaveDetails);

/* ============================================================================
   🟩 ADMIN → APPROVE or REJECT LEAVE (Manager cannot)
============================================================================ */
router.patch("/:id/approve", onlyAdmin, (req, res) => {
  req.body.status = "Approved";
  updateLeaveStatus(req, res);
});

router.patch("/:id/reject", onlyAdmin, (req, res) => {
  req.body.status = "Rejected";
  updateLeaveStatus(req, res);
});

/* ============================================================================
   ❌ EMPLOYEE/MANAGER → CANCEL THEIR OWN LEAVE (if pending)
============================================================================ */
router.delete("/cancel/:id", cancelLeave);

/* ============================================================================
   🔁 Legacy Route → Get leaves of specific employee
   (Admin only)
============================================================================ */
router.get("/:employeeId", listLeavesForEmployee);

export default router;
