import express from "express";
import {
  createLeave,
  listLeaves,
  getLeaveDetails,
  updateLeaveStatus,
  adminListLeaves
} from "../controllers/leaveController.js";

const router = express.Router();

// Employee routes
router.post("/", createLeave);
router.get("/", listLeaves);
router.get("/:id/details", getLeaveDetails);

// Admin route to fetch all leaves
router.get("/admin/all", adminListLeaves);

// Admin update status
router.put("/:id/status", updateLeaveStatus);

export default router;
