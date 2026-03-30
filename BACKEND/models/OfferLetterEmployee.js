import mongoose from "mongoose";

const compensationSchema = new mongoose.Schema({
  ctc: { type: Number, default: 0 },
  basic_salary: { type: Number, default: 0 },
  hra: { type: Number, default: 0 },
  conveyance: { type: Number, default: 0 },
  medical_allowance: { type: Number, default: 0 },
  special_allowance: { type: Number, default: 0 },
  gross_salary: { type: Number, default: 0 },
  pt: { type: Number, default: 0 },
  pf: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  net_salary: { type: Number, default: 0 },
}, { _id: false });

const offerLetterEmployeeSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
  },
  emp_id: { type: String, default: "" },
  name: { type: String, required: true },
  email: { type: String, required: true },
  designation: { type: String, default: "" },
  department: { type: String, default: "" },
  joining_date: { type: Date, default: null },
  location: { type: String, default: "" },
  employment_type: { type: String, default: "Full Time" },
  status: { type: String, default: "Pending" }, // Pending, Offer Sent, Accepted, Rejected
  compensation: { type: compensationSchema, default: () => ({}) },
  // Email tracking
  sent_at: { type: Date, default: null },
  expires_at: { type: Date, default: null },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    default: null,
  },
  accepted_at: { type: Date, default: null },
  rejected_at: { type: Date, default: null },
  rejection_reason: { type: String, default: "" },
  // Token for accept/reject
  offer_token: { type: String, default: null },
  pdfUrl: { type: String, default: "" },
}, { timestamps: true });

// Ensure unique email per admin
offerLetterEmployeeSchema.index({ adminId: 1, email: 1 }, { unique: true });

export default mongoose.model("OfferLetterEmployee", offerLetterEmployeeSchema);
