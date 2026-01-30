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
  experienceLetterUrl: String, 
  employmentType: String,
});

const personalSchema = new mongoose.Schema({
  dob: String,
  gender: { type: String, enum: ["Male", "Female", "Prefer not to say"] },
  maritalStatus: String,
  nationality: String,
  panNumber: String,
  aadhaarNumber: String,
  aadhaarFileUrl: String, 
  panFileUrl: String,     
});

const bankSchema = new mongoose.Schema({
  accountNumber: String,
  bankName: String,
  ifsc: String,
  branch: String,
});

// Main Employee Schema
const EmployeeSchema = new mongoose.Schema({
  // HIERARCHY: Links to Admin and Company
  adminId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Admin", 
    required: true 
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
  // Snapshot of company details to avoid population queries for simple displays
  companyName: String,
  companyPrefix: String,

  // BASIC INFO
  employeeId: { type: String, required: true, unique: true }, // e.g., PRE-001
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: {
    type: String,
    minlength: 6,
    select: false,
    default: null, // Can be null if created by admin and not yet activated
  },
  
  phone: String,
  address: String,
  emergency: String, 
  emergencyPhone: String, 
  
  // STATUS & DEACTIVATION
  isActive: { type: Boolean, default: true },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  
  deactivationDate: { type: String, default: null },
  deactivationReason: { type: String, default: null },
  reactivationDate: { type: String, default: null },
  reactivationReason: { type: String, default: null },

  // NESTED DETAILS
  bankDetails: bankSchema,
  personalDetails: personalSchema,
  experienceDetails: [experienceSchema],

  // ROLES
  role: { type: String, enum: ["employee", "manager"], default: "employee" },
  isAdmin: { type: Boolean, default: false }, // Internal flag (e.g., Company HR), not the SaaS Admin
}, { timestamps: true });

// Hash password before save
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