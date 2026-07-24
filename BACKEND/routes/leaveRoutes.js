// --- UPDATED FILE: routes/leaveRoutes.js ---

import express from "express";
import {
  createLeave,
  listLeavesForEmployee,
  adminListAllLeaves,
  getLeaveDetails,
  updateLeaveStatus,
  cancelLeave,
  // ✅ NEW — Leave Policy
  getLeavePolicyForAdmin,
  upsertLeavePolicy,
  resetUsedPaidDays,
  getLeavePolicyBalanceForEmployee,
} from "../controllers/leaveController.js";

import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();

// 🔐 All routes require login
router.use(protect);

/* ============================================================================
   📌 ADMIN → GET ALL LEAVES
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
   ✅ NEW — EMPLOYEE → GET LEAVE BALANCE (paid days remaining per type)
   GET /api/leaves/balance
============================================================================ */
router.get("/balance", getLeavePolicyBalanceForEmployee);

/* ============================================================================
   ✅ NEW — ADMIN → GET LEAVE POLICY
   GET /api/leaves/policy
============================================================================ */
router.get("/policy", onlyAdmin, getLeavePolicyForAdmin);

/* ============================================================================
   ✅ NEW — ADMIN → CREATE / UPDATE LEAVE POLICY
   PUT /api/leaves/policy
   Body: { policies: [{ leaveType, paidDaysLimit }], resetMonth: "01" }
============================================================================ */
router.put("/policy", onlyAdmin, upsertLeavePolicy);

/* ============================================================================
   ✅ NEW — ADMIN → MANUALLY RESET usedPaidDays COUNTER
   POST /api/leaves/policy/reset
   Body (optional): { leaveType: "CASUAL" }  — omit to reset all
============================================================================ */
router.post("/policy/reset", onlyAdmin, resetUsedPaidDays);

/* ============================================================================
   📄 GET LEAVE DETAILS (Admin + Employee who owns leave)
============================================================================ */
router.get("/:id/details", getLeaveDetails);

/* ============================================================================
   🟩 ADMIN → APPROVE or REJECT LEAVE
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
   🔁 Legacy Route → Get leaves of specific employee (Admin only)
============================================================================ */
router.get("/:employeeId", listLeavesForEmployee);

export default router;