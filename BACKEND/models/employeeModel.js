// --- START OF FILE models/employeeModel.js ---

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Sub-schemas
const experienceSchema = new mongoose.Schema({
  company: String,
  role: String,
  department: String,
  years: Number,
  joiningDate: String,
  lastWorkingDate: String,
  salary: Number,
  reason: String,
  experienceLetterUrl: String, // Stores Cloudinary URL
  employmentType: String,
});

const personalSchema = new mongoose.Schema({
  dob: String,
  gender: { type: String, enum: ["Male", "Female", "Prefer not to say"] },
  maritalStatus: String,
  nationality: String,
  panNumber: String,
  aadhaarNumber: String,
  aadhaarFileUrl: String, // Stores Cloudinary URL
  panFileUrl: String,     // Stores Cloudinary URL
});

const bankSchema = new mongoose.Schema({
  accountNumber: String,
  bankName: String,
  ifsc: String,
  branch: String,
});

// Main Employee Schema
const EmployeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: {
    type: String,
    minlength: 6,
    select: false,
    default: null,
  },
  
  // ✅ NEW: Company Reference
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
  companyName: String,
  companyPrefix: String,
  
  phone: String,
  address: String,
  emergency: String, // Emergency Name
  emergencyPhone: String, // Emergency Phone
  
  // ✅ UPDATED: Status, Deactivation AND Reactivation Details
  isActive: { type: Boolean, default: true },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  
  deactivationDate: { type: String, default: null },
  deactivationReason: { type: String, default: null },

  reactivationDate: { type: String, default: null },
  reactivationReason: { type: String, default: null },

  bankDetails: bankSchema,
  personalDetails: personalSchema,
  experienceDetails: [experienceSchema],

  role: { type: String, enum: ["employee", "admin", "manager"], default: "employee" },
  isAdmin: { type: Boolean, default: false },
});

// Hash password before save (only if password exists and is modified)
EmployeeSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

EmployeeSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

export default mongoose.model("Employee", EmployeeSchema);
// --- END OF FILE models/employeeModel.js ---