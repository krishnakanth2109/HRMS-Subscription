import mongoose from "mongoose";

const punchOutRequestSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  employeeName: { type: String, required: true },
  originalDate: { type: String, required: true }, // Date of the shift (YYYY-MM-DD)
  requestDate: { type: Date, default: Date.now },
  requestedPunchOut: { type: Date, required: true }, // The time they want to set
  reason: { type: String, required: true },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
  },
});

const PunchOutRequest = mongoose.model("PunchOutRequest", punchOutRequestSchema);

export default PunchOutRequest;
