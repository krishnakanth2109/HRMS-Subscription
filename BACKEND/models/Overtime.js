// --- START OF FILE models/Overtime.js ---
import mongoose from "mongoose";

const OvertimeSchema = new mongoose.Schema(
  {
    // HIERARCHY LINKS
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },

    date: { type: String, required: true }, // YYYY-MM-DD

    type: {
      type: String,
      enum: ["INCENTIVE_OT", "PENDING_OT"],
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Overtime", OvertimeSchema);