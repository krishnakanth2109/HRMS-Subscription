import mongoose from "mongoose";

const exitDocumentSchema = new mongoose.Schema({
  docName: { type: String, required: true },         // e.g. "Experience Letter"
  uploadedByEmployee: { type: String, default: "" }, // Cloudinary URL from employee
  uploadedByAdmin: { type: String, default: "" },    // Cloudinary URL from admin
  verifiedByAdmin: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
}, { _id: false });

const resignationSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  employeeId: { type: String, required: true },      // e.g. "ARAH001"
  employeeName: { type: String, required: true },
  employeeEmail: { type: String, required: true },
  companyName: { type: String, default: "Unknown" },
  department: { type: String, default: "" },
  designation: { type: String, default: "" },

  // Step 1: Employee submits
  resignationLetterHtml: { type: String, default: "" },  // AI-generated HTML content
  reason: { type: String, default: "" },
  submittedAt: { type: Date, default: null },

  // Step 2: Admin decision
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected", "Exit Formalities", "Completed"],
    default: "Pending"
  },
  adminRemark: { type: String, default: "" },

  // Step 3: Notice Period
  noticePeriodType: { type: String, enum: ["Immediate", "Custom"], default: null },
  noticePeriodDays: { type: Number, default: 0 },
  noticePeriodEndDate: { type: Date, default: null }, // calculated in IST
  approvedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },

  // Step 4: Acceptance letter sent to employee (AI-generated)
  acceptanceLetterHtml: { type: String, default: "" },
  acceptanceLetterSentAt: { type: Date, default: null },

  // Step 5: Exit Formalities documents
  exitDocuments: {
    type: [exitDocumentSchema], default: [
      { docName: "Experience Letter", uploadedByEmployee: "", uploadedByAdmin: "", verifiedByAdmin: false },
      { docName: "Relieving Letter", uploadedByEmployee: "", uploadedByAdmin: "", verifiedByAdmin: false },
      { docName: "NOC Certificate", uploadedByEmployee: "", uploadedByAdmin: "", verifiedByAdmin: false },
      { docName: "Asset Return Confirmation", uploadedByEmployee: "", uploadedByAdmin: "", verifiedByAdmin: false },
    ]
  },

  // Step 6: Countdown expired alert sent
  countdownAlertSent: { type: Boolean, default: false },

}, { timestamps: true });

export default mongoose.model("Resignation", resignationSchema);
