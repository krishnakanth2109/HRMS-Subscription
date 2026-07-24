// models/WelcomeKit.js
import mongoose from "mongoose";

let welcomeKitSchema = new mongoose.Schema(
  {
    // HIERARCHY LINKS - made optional for backward compatibility
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      index: true,
    },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    employeeCode: {
      type: String,
      required: true,
    },
    employeeName: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      default: "",
    },

    // Items received from organization
    itemsReceived: {
      laptop: { type: Boolean, default: false },
      mouse: { type: Boolean, default: false },
      keyboard: { type: Boolean, default: false },
      pen: { type: Boolean, default: false },
      book: { type: Boolean, default: false },
      cupMug: { type: Boolean, default: false },
      yearlyCalendar: { type: Boolean, default: false },
      documentFolder: { type: Boolean, default: false },
      keychain: { type: Boolean, default: false },
      waterBottle: { type: Boolean, default: false },
      other: { type: Boolean, default: false },
      otherDescription: { type: String, default: "" },
    },

    // If employee selected "I have not taken anything"
    notTakenAnything: {
      type: Boolean,
      default: false,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Create indexes for better query performance
welcomeKitSchema.index({ employeeId: 1 });
welcomeKitSchema.index({ adminId: 1, submittedAt: -1 });
welcomeKitSchema.index({ companyId: 1, submittedAt: -1 });

let WelcomeKit = mongoose.model("WelcomeKit", welcomeKitSchema);

export default WelcomeKit;