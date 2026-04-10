// models/WelcomeKit.js
import mongoose from "mongoose";

let welcomeKitSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      unique: true, // one submission per employee
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

let WelcomeKit = mongoose.model("WelcomeKit", welcomeKitSchema);

export default WelcomeKit;