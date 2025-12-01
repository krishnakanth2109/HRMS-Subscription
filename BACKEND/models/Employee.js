
import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "employee" },
  phone: { type: String },
  address: { type: String },
  emergency: { type: String },
  isActive: { type: Boolean, default: true },
  status: { type: String, default: "Active" },
  
  // Existing fields from your database
  bankDetails: { type: Object },
  personalDetails: { type: Object },
  experienceDetails: [{
    role: String,
    department: String,
    startDate: String,
    lastWorkingDate: String
  }],
  
  // Deactivation/Reactivation
  deactivationDate: { type: String },
  deactivationReason: { type: String },
  reactivationDate: { type: String },
  reactivationReason: { type: String },
  
  isAdmin: { type: Boolean, default: false }
  
}, { timestamps: true });

// Prevent OverwriteModelError
const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);
export default Employee;
