// --- START OF FILE models/shiftModel.js ---
import mongoose from "mongoose";

const ShiftSchema = new mongoose.Schema({
  // HIERARCHY LINKS
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

  employeeId: {
    type: String,
    required: true,
    unique: true,
    ref: 'Employee'
  },
  employeeName: { type: String, required: true },
  email: { type: String, required: true },
  department: { type: String, default: 'N/A' },
  role: { type: String, default: 'N/A' },
  
  // Shift Timings (IST)
  shiftStartTime: { type: String, required: true, default: "09:00" },
  shiftEndTime: { type: String, required: true, default: "18:00" },
  
  timezone: { type: String, default: "Asia/Kolkata" },
  
  lateGracePeriod: { type: Number, default: 15 },
  
  fullDayHours: { type: Number, default: 9 },
  halfDayHours: { type: Number, default: 5},
  
  autoExtendShift: { type: Boolean, default: true },
  weeklyOffDays: { type: [Number], default: [0] }, 
  
  isActive: { type: Boolean, default: true },
  
  createdBy: { type: String, default: 'SYSTEM' },
  updatedBy: { type: String, default: 'SYSTEM' },
}, { 
  timestamps: true 
});

export default mongoose.model("Shift", ShiftSchema);