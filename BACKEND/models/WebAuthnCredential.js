// --- models/WebAuthnCredential.js ---
// Stores WebAuthn public key credentials for fingerprint authentication

import mongoose from "mongoose";

const webAuthnCredentialSchema = new mongoose.Schema(
  {
    // Reference to the user (Admin or Employee)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // "admin" | "manager" | "employee" — determines which collection to look up
    userRole: {
      type: String,
      enum: ["admin", "manager", "employee"],
      required: true,
    },

    // WebAuthn credential ID (base64url-encoded)
    credentialId: {
      type: String,
      required: true,
      unique: true,
    },

    // COSE public key (base64url-encoded)
    publicKey: {
      type: String,
      required: true,
    },

    // Sign counter for replay-attack prevention
    counter: {
      type: Number,
      default: 0,
    },

    // Friendly label for the credential (e.g. "Work Laptop Fingerprint")
    deviceName: {
      type: String,
      default: "Fingerprint Device",
    },

    // Transports supported by the authenticator
    transports: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// Compound index: one user can have multiple credentials
webAuthnCredentialSchema.index({ userId: 1, userRole: 1 });

const WebAuthnCredential = mongoose.model(
  "WebAuthnCredential",
  webAuthnCredentialSchema
);

export default WebAuthnCredential;
