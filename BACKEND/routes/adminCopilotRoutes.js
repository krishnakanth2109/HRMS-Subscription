import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  handleAdminCopilotChat,
  handleAdminExecuteAction,
  handleAdminUpdateDraftAction,
} from "../controllers/adminCopilotController.js";

const router = express.Router();

// Protected Admin Copilot Endpoints
router.post("/chat", protect, handleAdminCopilotChat);
router.post("/execute-action", protect, handleAdminExecuteAction);
router.post("/update-draft-action", protect, handleAdminUpdateDraftAction);

export default router;
