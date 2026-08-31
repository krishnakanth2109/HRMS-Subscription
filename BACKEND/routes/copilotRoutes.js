import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  handleCopilotChat,
  handleExecuteAction,
  handleUpdateDraftAction,
} from "../controllers/copilotController.js";

const router = express.Router();

// AI Copilot Endpoints secured by employee token
router.post("/chat", protect, handleCopilotChat);
router.post("/execute-action", protect, handleExecuteAction);
router.post("/update-draft-action", protect, handleUpdateDraftAction);

export default router;
