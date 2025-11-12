// --- START OF FILE routes/leaveRoutes.js ---

import express from "express";
import {
  createLeave,
  listLeavesForEmployee,
  adminListAllLeaves,
  getLeaveDetails,
  updateLeaveStatus,
  cancelLeave,
} from "../controllers/leaveController.js";
import { protect } from "../controllers/authController.js"; // Import your security middleware

const router = express.Router();

// All leave routes require a user to be logged in, so we apply the 'protect' middleware globally.
router.use(protect);

// GET /api/leaves
// This is the route for the Admin Panel to fetch ALL leave requests.
router.get("/", adminListAllLeaves);

// POST /api/leaves/apply
// This is the route for an employee to submit a new leave request.
router.post("/apply", createLeave);

// GET /api/leaves/my-leaves (A more secure endpoint for employees)
// This lets an employee get ONLY their own leave history.
router.get("/my-leaves", listLeavesForEmployee);

// GET /api/leaves/:id/details
// Gets the day-by-day details for a specific leave request.
router.get("/:id/details", getLeaveDetails);

// PATCH /api/leaves/:id/approve
// PATCH /api/leaves/:id/reject
// These routes are for an admin to update the status of a request.
router.patch("/:id/approve", (req, res) => {
    req.body.status = "Approved";
    updateLeaveStatus(req, res);
});
router.patch("/:id/reject", (req, res) => {
    req.body.status = "Rejected";
    updateLeaveStatus(req, res);
});

// DELETE /api/leaves/cancel/:id
// This is for an employee to cancel their own PENDING leave request.
router.delete("/cancel/:id", cancelLeave);

// This route must be last to avoid conflicts with other routes like 'apply'
// GET /api/leaves/:employeeId (Legacy support if needed, but /my-leaves is better)
router.get("/:employeeId", listLeavesForEmployee);


export default router;