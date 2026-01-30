// --- START OF FILE models/CompanyModel.js ---

import mongoose from "mongoose";

const CompanySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Company name is required"],
    unique: true,
    trim: true,
  },
  prefix: {
    type: String,
    required: [true, "Company prefix is required"],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [4, "Prefix must be 3-4 characters"],
    minlength: [3, "Prefix must be 3-4 characters"],
  },
  description: {
    type: String,
    default: "",
  },
  email: {
    type: String,
    trim: true,
  },
  phone: String,
  address: String,
  city: String,
  state: String,
  zipCode: String,
  country: String,
  registrationNumber: String,
  website: String,
  
  // Track employee count for ID generation
  employeeCount: {
    type: Number,
    default: 0,
  },
  
  // Active status
  isActive: {
    type: Boolean,
    default: true,
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
CompanySchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("Company", CompanySchema);
// --- END OF FILE models/CompanyModel.js ---
