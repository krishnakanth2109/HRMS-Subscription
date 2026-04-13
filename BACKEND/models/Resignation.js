import mongoose from "mongoose";

const exitDocumentSchema = new mongoose.Schema({
  docName: { type: String, required: true },
  uploadedByEmployee: { type: String, default: "" }, // Cloudinary URL from employee
  uploadedByAdmin: { type: String, default: "" },    // Cloudinary URL from admin
  verifiedByAdmin: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
}, { _id: false });

// Admin-side final documents (Relieving Letter, Experience Letter, etc.)
const adminFinalDocSchema = new mongoose.Schema({
  docName: { type: String, required: true },         // Admin gives it a name
  uploadedByAdmin: { type: String, default: "" },    // Cloudinary URL
  uploadedAt: { type: Date, default: null },
}, { _id: false });

// Welcome kit item return tracking
const welcomeKitReturnSchema = new mongoose.Schema({
  itemName: { type: String, required: true },        // e.g. "Laptop", "Mouse"
  returned: { type: Boolean, default: false },
  confirmedAt: { type: Date, default: null },
}, { _id: false });

const resignationSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  employeeId: { type: String, required: true },
  employeeName: { type: String, required: true },
  employeeEmail: { type: String, required: true },
  companyName: { type: String, default: "Unknown" },
  department: { type: String, default: "" },
  designation: { type: String, default: "" },

  // Step 1: Employee submits
  resignationLetterHtml: { type: String, default: "" },
  reason: { type: String, default: "" },
  submittedAt: { type: Date, default: null },

  // Step 2: Admin decision
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected", "Exit Formalities", "Completed"],
    default: "Pending"
  },
  adminRemark: { type: String, default: "" },

  // Step 3: Acceptance letter — admin uploads a file (PDF/image) OR uses AI HTML
  acceptanceLetterHtml: { type: String, default: "" },
  acceptanceLetterFileUrl: { type: String, default: "" }, // Admin-uploaded file URL
  acceptanceLetterSentAt: { type: Date, default: null },

  // Step 4: Notice Period
  noticePeriodType: { type: String, enum: ["Immediate", "Custom"], default: null },
  noticePeriodDays: { type: Number, default: 0 },
  noticePeriodEndDate: { type: Date, default: null },
  approvedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },

  // Step 5: Exit Formalities — employee submits documents for admin verification
  // Documents are dynamic (no hardcoded names) — admin names them
  exitDocuments: { type: [exitDocumentSchema], default: [] },

  // Step 6: Welcome Kit return tracking (populated from WelcomeKit items)
  welcomeKitItems: { type: [welcomeKitReturnSchema], default: [] },
  welcomeKitSubmittedByEmployee: { type: Boolean, default: false },
  welcomeKitSubmittedAt: { type: Date, default: null },

  // Step 7: Admin uploads final docs (Relieving Letter, Experience Letter, etc.)
  adminFinalDocs: { type: [adminFinalDocSchema], default: [] },
  allDocsVerified: { type: Boolean, default: false }, // Set true when admin verifies all exit docs

  // Step 8: Final Exit
  finalExitTriggered: { type: Boolean, default: false },
  finalExitAt: { type: Date, default: null },

  // Countdown alert
  countdownAlertSent: { type: Boolean, default: false },

}, { timestamps: true });

export default mongoose.model("Resignation", resignationSchema);