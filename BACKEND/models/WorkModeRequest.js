// --- START OF FILE models/WorkModeRequest.js ---
import mongoose from "mongoose";

const workModeRequestSchema = new mongoose.Schema({
  // HIERARCHY LINKS
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

  employeeId: { type: String, required: true },
  employeeName: { type: String, required: true },
  department: { type: String },
  
  requestType: { 
    type: String, 
    enum: ["Temporary", "Recurring", "Permanent"], 
    required: true 
  },
  
  // For Temporary
  fromDate: { type: Date },
  toDate: { type: Date },
  
  // For Recurring (0=Sun, 1=Mon, etc.)
  recurringDays: [{ type: Number }],
  
  requestedMode: { 
    type: String, 
    enum: ["WFO", "WFH"], 
    required: true 
  },
  
  reason: { type: String, required: true },
  
  status: { 
    type: String, 
    enum: ["Pending", "Approved", "Rejected"], 
    default: "Pending" 
  },
  adminComment: { type: String } 
}, { timestamps: true });

export default mongoose.model("WorkModeRequest", workModeRequestSchema);