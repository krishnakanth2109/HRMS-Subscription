import mongoose from "mongoose";

const OvertimeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
    },

    employeeName: {
      type: String,
      required: true,
    },

    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },

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
