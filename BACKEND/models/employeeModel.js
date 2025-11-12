// --- START OF FILE models/employeeModel.js ---

import mongoose from "mongoose";
import bcrypt from "bcryptjs"; // ✅ Import bcryptjs for password handling

// Sub-schemas remain the same
const experienceSchema = new mongoose.Schema({
  employeeId: String,
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
  gender: String,
  maritalStatus: String,
  nationality: String,
  panNumber: String,
  aadharNumber: String,
  aadharFileUrl: String,
  panFileUrl: String,
});

const bankSchema = new mongoose.Schema({
  accountNumber: String,
  bankName: String,
  ifsc: String,
  branch: String,
});

// Main Employee Schema with added password security
const EmployeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: {
    type: String,
    required: [true, "A password is required"],
    minlength: 6,
    select: false, // Do not send password in query results by default
  },
  phone: String,
  address: String,
  emergency: String,
  isActive: { type: Boolean, default: true },
  bankDetails: bankSchema,
  personalDetails: personalSchema,
  experienceDetails: [experienceSchema],
});

// ✅ ADDED: Middleware to automatically hash the password before saving a new employee
EmployeeSchema.pre("save", async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified("password")) return next();
  
  // Hash the password with a cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ✅ ADDED: Instance method to compare passwords during the login process
EmployeeSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

export default mongoose.model("Employee", EmployeeSchema);