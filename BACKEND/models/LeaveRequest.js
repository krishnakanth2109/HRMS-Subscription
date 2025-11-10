import mongoose from "mongoose";

const perDaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    leavecategory: { type: String, enum: ["Paid", "UnPaid"], default: "UnPaid" },
    leaveType: { type: String, enum: ["CASUAL", "SICK", "EMERGENCY"], default: null },
    leaveDayType: { type: String, enum: ["Full Day", "Half Day"], default: null },
  },
  { _id: false }
);

const leaveRequestSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },

    from: { type: String, required: true },
    to: { type: String, required: true },
    reason: { type: String, required: true, maxlength: 50 },

    leaveType: { type: String, enum: ["CASUAL", "SICK", "EMERGENCY"], required: true },
    leaveDayType: { type: String, enum: ["Full Day", "Half Day"], required: true },
    halfDaySession: { type: String, default: "" },

    status: { type: String, enum: ["Pending", "Approved", "Rejected", "Cancelled"], default: "Pending" },
    requestDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
    actionDate: { type: String, default: "-" },
    approvedBy: { type: String, default: "-" },

    monthKey: { type: String, required: true },

    details: { type: [perDaySchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("LeaveRequest", leaveRequestSchema);
