import mongoose from "mongoose";

const LeaveSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },

    date_from: { type: String, required: true },
    date_to: { type: String, required: true },

    leaveType: {
      type: String,
      enum: ["CASUAL", "SICK", "PAID", "UNPAID", "HALFDAY"],
      required: true,
    },

    reason: { type: String, required: true },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Leave", LeaveSchema);
