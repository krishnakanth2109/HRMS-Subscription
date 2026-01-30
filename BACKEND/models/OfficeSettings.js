// --- START OF FILE models/OfficeSettings.js ---
import mongoose from "mongoose";

const officeSettingsSchema = new mongoose.Schema({
  // HIERARCHY LINKS
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

  type: { 
    type: String, 
    default: "Global", 
    // unique: true // REMOVED UNIQUE CONSTRAINT globally. Uniqueness should be per company.
  }, 

  officeLocation: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  allowedRadius: { type: Number, default: 200 },
  globalWorkMode: { 
    type: String, 
    enum: ["WFO", "WFH"], 
    default: "WFO" 
  },
  
  requireAccurateLocation: {
    type: Boolean,
  },

  // Store individual employee work mode overrides and schedules
  employeeWorkModes: [{
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    
    ruleType: { 
      type: String, 
      enum: ["Global", "Permanent", "Temporary", "Recurring"], 
      default: "Global" 
    },

    // 1. Permanent Override
    permanentMode: { type: String, enum: ["WFO", "WFH"] },

    // 2. Temporary Schedule
    temporary: {
      mode: { type: String, enum: ["WFO", "WFH"] },
      fromDate: { type: Date },
      toDate: { type: Date }
    },

    // 3. Recurring Schedule
    recurring: {
      mode: { type: String, enum: ["WFO", "WFH"] },
      days: [{ type: Number }] // 0=Sunday
    },

    updatedAt: { type: Date, default: Date.now }
  }],
  
  categories: [{
    name: { type: String, required: true },
    employeeIds: [{ type: String }] 
  }]
}, { timestamps: true });

export default mongoose.model("OfficeSettings", officeSettingsSchema);