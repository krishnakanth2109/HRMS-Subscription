
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
  // NEW FIELD: Control whether to enforce accurate office location for WFO
  requireAccurateLocation: {
    type: Boolean,
    // default: true // Default is enabled (strict location check)
  },
  // Store individual employee work mode overrides and schedules
  employeeWorkModes: [{
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    
    // Type of rule applied: 
    // "Global" (Default), "Permanent" (Manual Override), "Temporary" (Date Range), "Recurring" (Days of Week)
    ruleType: { 
      type: String, 
      enum: ["Global", "Permanent", "Temporary", "Recurring"], 
      default: "Global" 
    },

    // 1. Permanent Override (Old 'workMode')
    permanentMode: { type: String, enum: ["WFO", "WFH"] },

    // 2. Temporary Schedule (Date Range)
    temporary: {
      mode: { type: String, enum: ["WFO", "WFH"] },
      fromDate: { type: Date },
      toDate: { type: Date }
    },

    // 3. Recurring Schedule (Specific Days)
    recurring: {
      mode: { type: String, enum: ["WFO", "WFH"] },
      days: [{ type: Number }] // 0=Sunday, 1=Monday, ... 6=Saturday
    },

    updatedAt: { type: Date, default: Date.now }
  }],
  
  categories: [{
    name: { type: String, required: true },
    employeeIds: [{ type: String }] 
  }]
}, { timestamps: true });

export default mongoose.model("OfficeSettings", officeSettingsSchema);
