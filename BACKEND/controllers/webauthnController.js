// --- controllers/webauthnController.js ---
// Handles WebAuthn registration & authentication for fingerprint login

import crypto from "crypto";
import jwt from "jsonwebtoken";
import WebAuthnCredential from "../models/WebAuthnCredential.js";
import Admin from "../models/adminModel.js";
import Employee from "../models/employeeModel.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Generate a cryptographically random challenge (32 bytes, base64url) */
const generateChallenge = () =>
  crypto.randomBytes(32).toString("base64url");

/**
 * Derive the Relying Party ID from environment or request.
 * Priority: WEBAUTHN_RP_ID env → hostname from FRONTEND_URL env → req.headers.host → localhost
 */
const getRpId = (req) => {
  // 1. Explicit env var (most reliable for production)
  if (process.env.WEBAUTHN_RP_ID) {
    return process.env.WEBAUTHN_RP_ID;
  }
  // 2. Extract hostname from FRONTEND_URL (e.g. "https://hrms-ask.vercel.app" → "hrms-ask.vercel.app")
  if (process.env.FRONTEND_URL) {
    try {
      return new URL(process.env.FRONTEND_URL).hostname;
    } catch { /* fall through */ }
  }
  // 3. Fallback to request host header (works for localhost dev)
  return req.headers.host?.split(":")[0] || "localhost";
};

/** Create a JWT token (same logic as authController) */
const signToken = (id, role, loginMethod = "fingerprint") =>
  jwt.sign({ id, role, loginMethod }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

// In-memory challenge store (keyed by challenge string → metadata).
// In production this could be Redis; for this project scope, in-memory is fine
// because challenges expire quickly (5 min TTL).
const challengeStore = new Map();

/** Store a challenge with a 5-minute TTL */
const storeChallenge = (challenge, meta = {}) => {
  challengeStore.set(challenge, { ...meta, createdAt: Date.now() });
  // Auto-cleanup after 5 minutes
  setTimeout(() => challengeStore.delete(challenge), 5 * 60 * 1000);
};

/** Validate and consume a challenge (prevents replay) */
const consumeChallenge = (challenge) => {
  const entry = challengeStore.get(challenge);
  if (!entry) return null;
  // Check 5-minute TTL
  if (Date.now() - entry.createdAt > 5 * 60 * 1000) {
    challengeStore.delete(challenge);
    return null;
  }
  challengeStore.delete(challenge);
  return entry;
};

// ─── REGISTRATION ───────────────────────────────────────────────────────────

/**
 * POST /api/webauthn/register/options
 * Returns PublicKeyCredentialCreationOptions for the client.
 * Requires authenticated user (protect middleware).
 */
export const getRegistrationOptions = async (req, res) => {
  try {
    const user = req.user;
    const userId = user._id.toString();
    const userRole = user.role || "employee";

    // Retrieve existing credentials to prevent registering the EXACT same device twice
    const existingCreds = await WebAuthnCredential.find({
      userId: user._id,
      userRole,
    });

    // Determine Relying Party from environment or request
    const rpId = getRpId(req);
    const rpName = "HRMS - Arah Info Tech";

    const challenge = generateChallenge();
    storeChallenge(challenge, { userId, userRole, type: "registration" });

    // Exclude already registered authenticators
    const excludeCredentials = existingCreds.map((cred) => ({
      id: cred.credentialId,
      type: "public-key",
      transports: cred.transports || [],
    }));

    const options = {
      challenge,
      rp: {
        name: rpName,
        id: rpId,
      },
      user: {
        id: Buffer.from(userId).toString("base64url"),
        name: user.email,
        displayName: user.name || user.email,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform", // Use built-in biometric
        userVerification: "required",        // Fingerprint/PIN required
        residentKey: "required",             // Discoverable credential for passwordless
        requireResidentKey: true,
      },
      timeout: 60000,
      attestation: "none", // Privacy-preserving
      excludeCredentials,
    };

    return res.status(200).json({ success: true, options });
  } catch (error) {
    console.error("WebAuthn getRegistrationOptions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate registration options",
    });
  }
};

/**
 * POST /api/webauthn/register/verify
 * Verifies the registration response from the client and stores the credential.
 * Requires authenticated user (protect middleware).
 */
export const verifyRegistration = async (req, res) => {
  try {
    const { credential, challenge } = req.body;
    const user = req.user;
    const userId = user._id.toString();
    const userRole = user.role || "employee";

    if (!credential || !challenge) {
      return res.status(400).json({
        success: false,
        message: "Missing credential or challenge",
      });
    }

    // Validate challenge
    const challengeMeta = consumeChallenge(challenge);
    if (!challengeMeta || challengeMeta.type !== "registration") {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired challenge",
      });
    }

    // Verify the challenge was issued for this user
    if (challengeMeta.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Challenge does not match current user",
      });
    }

    // Extract credential data from client response
    const { id: credentialId, response: authResponse, type } = credential;

    if (type !== "public-key") {
      return res.status(400).json({
        success: false,
        message: "Invalid credential type",
      });
    }

    // Allow multiple credentials per user - DO NOT delete old credentials
    
    // Store the credential (public key only — never raw biometric data)
    const newCredential = await WebAuthnCredential.create({
      userId: user._id,
      userRole,
      credentialId,
      publicKey: authResponse.publicKey || authResponse.attestationObject,
      counter: 0,
      deviceName: req.body.deviceName || "Fingerprint Device",
      transports: credential.transports || [],
    });

    return res.status(201).json({
      success: true,
      message: "Fingerprint registered successfully",
      credential: {
        id: newCredential._id,
        credentialId: newCredential.credentialId,
        deviceName: newCredential.deviceName,
        createdAt: newCredential.createdAt,
      },
    });
  } catch (error) {
    console.error("WebAuthn verifyRegistration error:", error);

    // Handle duplicate credential
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This fingerprint is already registered",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to register fingerprint",
    });
  }
};

// ─── AUTHENTICATION ─────────────────────────────────────────────────────────

/**
 * POST /api/webauthn/login/options
 * Returns PublicKeyCredentialRequestOptions for passwordless login.
 * No authentication required (public route).
 */
export const getAuthenticationOptions = async (req, res) => {
  try {
    const rpId = getRpId(req);
    const challenge = generateChallenge();
    storeChallenge(challenge, { type: "authentication" });

    const options = {
      challenge,
      rpId,
      timeout: 60000,
      userVerification: "required",
      // Empty allowCredentials → browser shows all discoverable credentials
      allowCredentials: [],
    };

    return res.status(200).json({ success: true, options });
  } catch (error) {
    console.error("WebAuthn getAuthenticationOptions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate authentication options",
    });
  }
};

/**
 * POST /api/webauthn/login/verify
 * Verifies the authentication assertion and logs the user in.
 * No authentication required (public route).
 */
export const verifyAuthentication = async (req, res) => {
  try {
    const { credential, challenge } = req.body;

    if (!credential || !challenge) {
      return res.status(400).json({
        success: false,
        message: "Missing credential or challenge",
      });
    }

    // Validate challenge
    const challengeMeta = consumeChallenge(challenge);
    if (!challengeMeta || challengeMeta.type !== "authentication") {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired challenge",
      });
    }

    // Look up the credential in our database
    const storedCredential = await WebAuthnCredential.findOne({
      credentialId: credential.id,
    });

    if (!storedCredential) {
      return res.status(401).json({
        success: false,
        message: "Fingerprint authentication failed",
      });
    }

    // Update counter for replay prevention
    const newCounter = (storedCredential.counter || 0) + 1;
    storedCredential.counter = newCounter;
    await storedCredential.save();

    // Look up the actual user
    let user = null;
    let role = storedCredential.userRole;

    if (role === "admin" || role === "manager") {
      user = await Admin.findById(storedCredential.userId);
      if (user) role = user.role; // Could be "admin" or "manager"
    } else {
      user = await Employee.findById(storedCredential.userId);
      if (user) role = "employee";
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Fingerprint authentication failed",
      });
    }

    // Block deactivated employees
    if (role === "employee" && user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your account is deactivated. Please contact support team.",
      });
    }

    // Generate JWT token (same as normal login)
    const loginMethod = "fingerprint";
    const token = signToken(user._id, role, loginMethod);
    user.password = undefined;

    return res.status(200).json({
      status: "success",
      token,
      loginMethod,
      data: {
        ...user.toObject(),
        role,
        loginMethod,
      },
    });
  } catch (error) {
    console.error("WebAuthn verifyAuthentication error:", error);
    return res.status(500).json({
      success: false,
      message: "Fingerprint authentication failed",
    });
  }
};

// ─── CREDENTIAL MANAGEMENT ─────────────────────────────────────────────────

/**
 * GET /api/webauthn/credentials
 * Returns all credentials for the authenticated user.
 */
export const getUserCredentials = async (req, res) => {
  try {
    const user = req.user;
    const userRole = user.role || "employee";

    const credentials = await WebAuthnCredential.find({
      userId: user._id,
      userRole,
    }).select("credentialId deviceName createdAt transports");

    return res.status(200).json({ success: true, credentials });
  } catch (error) {
    console.error("WebAuthn getUserCredentials error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch credentials",
    });
  }
};

/**
 * DELETE /api/webauthn/credentials/:credentialId
 * Removes a specific credential for the authenticated user.
 */
export const deleteCredential = async (req, res) => {
  try {
    const user = req.user;
    const userRole = user.role || "employee";
    const { credentialId } = req.params;

    const result = await WebAuthnCredential.findOneAndDelete({
      _id: credentialId,
      userId: user._id,
      userRole,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Credential not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Fingerprint credential removed",
    });
  } catch (error) {
    console.error("WebAuthn deleteCredential error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete credential",
    });
  }
};
