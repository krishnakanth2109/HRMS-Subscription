import mongoose from "mongoose";

const documentEntrySchema = new mongoose.Schema({
  fieldKey: { type: String, required: true }, // e.g. "resume", "pan_card"
  label: { type: String, required: true },     // e.g. "PAN Card"
  fileUrl: { type: String, default: null },
  cloudinaryPublicId: { type: String, default: null },
  uploadedAt: { type: Date, default: null },
  adminVerified: { type: Boolean, default: false },
  adminVerifiedAt: { type: Date, default: null },
});

const documentVerificationSchema = new mongoose.Schema(
  {
    // Candidate info (pre-filled from invitation)
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String },
    fullName: { type: String },
    role: { type: String },
    department: { type: String },
    employmentType: { type: String },

    // Company
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    // Invitation meta
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    invitedAt: { type: Date, default: Date.now },
    token: { type: String, unique: true }, // unique link token

    // Status
    status: {
      type: String,
      enum: ["pending", "submitted", "verified"],
      default: "pending",
    },
    submittedAt: { type: Date },

    // All document slots
    documents: [documentEntrySchema],

    // Admin notes
    adminNotes: { type: String, default: "" },
  },
  { timestamps: true }
);

documentVerificationSchema.index({ email: 1 });
documentVerificationSchema.index({ company: 1 });
documentVerificationSchema.index({ token: 1 });

export default mongoose.model("DocumentVerification", documentVerificationSchema);
