// --- START OF FILE models/domainModel.js ---
import mongoose from "mongoose";

const domainSchema = new mongoose.Schema(
  {
    /* ==================== COMPANY INFO ==================== */
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },

    /* ==================== SUBDOMAIN ==================== */
    subdomain: {
      type: String,
      required: [true, "Subdomain is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$|^[a-z0-9]$/,
        "Subdomain must be lowercase letters, numbers, or hyphens only (no spaces, no leading/trailing hyphens)",
      ],
    },

    /* ==================== ADMIN REFERENCE ==================== */
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      unique: true, // One domain per admin
    },

    /* ==================== STATUS ==================== */
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

/* ==================== INDEX ==================== */
domainSchema.index({ subdomain: 1 }, { unique: true });
domainSchema.index({ adminId: 1 }, { unique: true });

const Domain = mongoose.model("Domain", domainSchema);
export default Domain;
// --- END OF FILE models/domainModel.js ---