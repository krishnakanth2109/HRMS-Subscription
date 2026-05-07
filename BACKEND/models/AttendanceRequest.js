import mongoose from "mongoose";

const attendanceRequestSchema = new mongoose.Schema({
  employeeId: { type: String, required: true }, // Using String to match project's employeeId format
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  employeeName: { type: String, required: true },
  
  date: { type: String, required: true }, // YYYY-MM-DD
  
  currentStatus: { 
    type: String, 
    enum: ['Absent', 'Half Day', 'Full Day', 'Working', 'Week Off', 'Holiday', 'ABSENT', 'HALF_DAY', 'FULL_DAY'], 
    required: true 
  },
  requestedStatus: { 
    type: String, 
    enum: ['Absent', 'Half Day', 'Full Day', 'Working', 'Week Off', 'Holiday', 'ABSENT', 'HALF_DAY', 'FULL_DAY'], 
    required: true 
  },
  
  currentPunchIn: { type: String, default: null },
  currentPunchOut: { type: String, default: null },
  
  requestedPunchIn: { type: String, default: null },
  requestedPunchOut: { type: String, default: null },
  
  finalPunchIn: { type: String, default: null },
  finalPunchOut: { type: String, default: null },
  finalStatus: { type: String, default: null },
  
  reason: { type: String, required: true },
  adminComment: { type: String, default: null },
  
  requestStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  
  requestedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date, default: null }
}, {
  timestamps: true
});

// Prevent duplicate pending requests for the same date/employee
attendanceRequestSchema.index({ employeeId: 1, date: 1, requestStatus: 1 }, { 
  unique: true, 
  partialFilterExpression: { requestStatus: 'pending' } 
});

const AttendanceRequest = mongoose.model("AttendanceRequest", attendanceRequestSchema);
export default AttendanceRequest;
