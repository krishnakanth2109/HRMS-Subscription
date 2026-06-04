import mongoose from "mongoose";

const DailyWorkEntrySchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    morning_title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    morning_description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    morning_time: {
      type: String,
      required: true,
      trim: true,
    },
    evening_description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 5000,
    },
    evening_time: {
      type: String,
      trim: true,
      default: "",
    },
    employee_submitted_percentage: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    daily_work_percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    percentage_generated_at: {
      type: Date,
      default: null,
    },
    percentage_mode: {
      type: String,
      enum: ["auto", "manual", "none"],
      default: "none",
    },
  },
  { timestamps: true }
);

DailyWorkEntrySchema.index({ employeeId: 1, date: 1 }, { unique: true });

export default mongoose.model("DailyWorkEntry", DailyWorkEntrySchema);
