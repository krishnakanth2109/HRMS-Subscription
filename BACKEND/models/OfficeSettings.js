import mongoose from "mongoose";

const officeSettingsSchema = new mongoose.Schema({
  type: { 
    type: String, 
    default: "Global", 
    unique: true 
  }, 
  officeLocation: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  allowedRadius: { 
    type: Number, 
    default: 200 
  },
  globalWorkMode: { 
    type: String, 
    enum: ["WFO", "WFH"], 
    default: "WFO" 
  },
  // Store individual employee work mode overrides
  employeeWorkModes: [{
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    workMode: { 
      type: String, 
      enum: ["WFO", "WFH", "Global"], 
      required: true 
    },
    updatedAt: { type: Date, default: Date.now }
  }],
  // ✅ NEW: Store Custom Categories (Groups)
  categories: [{
    name: { type: String, required: true },
    employeeIds: [{ type: String }] // List of employee IDs in this category
  }]
}, { timestamps: true });

export default mongoose.model("OfficeSettings", officeSettingsSchema);