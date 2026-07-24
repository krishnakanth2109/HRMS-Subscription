// --- routes/webauthnRoutes.js ---
// Routes for WebAuthn fingerprint registration and authentication

import express from "express";
import { protect } from "../controllers/authController.js";
import {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
  getUserCredentials,
  deleteCredential,
} from "../controllers/webauthnController.js";

const router = express.Router();

// ─── Registration (requires authentication) ─────────────────────────────────
router.post("/register/options", protect, getRegistrationOptions);
router.post("/register/verify", protect, verifyRegistration);

// ─── Authentication (public — passwordless login) ───────────────────────────
router.post("/login/options", getAuthenticationOptions);
router.post("/login/verify", verifyAuthentication);

// ─── Credential Management (requires authentication) ────────────────────────
router.get("/credentials", protect, getUserCredentials);
router.delete("/credentials/:credentialId", protect, deleteCredential);

export default router;
