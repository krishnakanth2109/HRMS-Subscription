import express from "express";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import {
  getInductionHistory,
  getInductionById,
  deleteInductionRecord,
} from "../controllers/inductionController.js";

const router = express.Router();

// All induction routes require admin authentication
router.use(protect);
router.use(onlyAdmin);

// @route   GET /api/induction
// @desc    Get all induction history
router.get("/", getInductionHistory);

// @route   GET /api/induction/:id
// @desc    Get details of a specific induction dispatch
router.get("/:id", getInductionById);

// @route   DELETE /api/induction/:id
// @desc    Delete an induction record
router.delete("/:id", deleteInductionRecord);

export default router;
