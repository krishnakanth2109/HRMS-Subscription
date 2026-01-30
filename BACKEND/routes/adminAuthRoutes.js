import express from "express";
import { registerAdmin } from "../controllers/adminAuthController.js";

const router = express.Router();

// TEMP: public (lock later)
router.post("/register", registerAdmin);

export default router;