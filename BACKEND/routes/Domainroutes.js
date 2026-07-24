// --- START OF FILE routes/domainRoutes.js ---
import express from "express";

// ✅ CRITICAL FIX: Import protect from authController (NOT authMiddleware.js)
// Reason: adminAuthController.loginAdmin signs token as jwt.sign({ id, role }, ...)
//         authController.protect decodes via decoded.id — matching that exact shape.
//         authMiddleware.protect uses a different decode shape → causes the 401.
import { protect } from "../controllers/authController.js";

import {
  createDomain,
  getMyDomain,
  updateDomain,
  disableDomain,
  enableDomain,
  checkSubdomainAvailability,
} from "../controllers/Domaincontroller.js";

const router = express.Router();

/* ==================== PUBLIC ROUTES (no auth) ==================== */

// Real-time subdomain availability check for UI
// GET /api/domain/check/:subdomain
router.get("/check/:subdomain", checkSubdomainAvailability);

/* ==================== PROTECTED ROUTES (admin JWT required) ==================== */

// Create subdomain for logged-in admin
// POST /api/domain/create
router.post("/create", protect, createDomain);

// Get logged-in admin's domain
// GET /api/domain/my-domain
router.get("/my-domain", protect, getMyDomain);

// Update subdomain
// PUT /api/domain/update
router.put("/update", protect, updateDomain);

// Soft-disable domain (isActive = false)
// DELETE /api/domain/disable
router.delete("/disable", protect, disableDomain);

// Re-enable domain
// PATCH /api/domain/enable
router.patch("/enable", protect, enableDomain);

export default router;
// --- END OF FILE routes/domainRoutes.js ---
