// --- START OF FILE routes/companyRoutes.js ---

import express from "express";
import {
  getAllCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  generateEmployeeId,
  getNextEmployeeId,
} from "../controllers/companyController.js";

const router = express.Router();

// ✅ SPECIFIC ROUTES FIRST (more specific paths before general ones)
router.post("/generate-id", generateEmployeeId);
router.get("/next-id/:companyId", getNextEmployeeId);

// ✅ CRUD ROUTES
router.post("/", createCompany);
router.get("/", getAllCompanies);
router.get("/:id", getCompanyById);
router.put("/:id", updateCompany);
router.delete("/:id", deleteCompany);

export default router;
// --- END OF FILE routes/companyRoutes.js ---
