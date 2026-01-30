// --- START OF FILE models/PunchOutRequest.js ---
import mongoose from "mongoose";

const punchOutRequestSchema = new mongoose.Schema({
  // HIERARCHY LINKS
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

  employeeId: { type: String, required: true },
  employeeName: { type: String, required: true },
  originalDate: { type: String, required: true }, // YYYY-MM-DD
  requestDate: { type: Date, default: Date.now },
  requestedPunchOut: { type: Date, required: true }, 
  reason: { type: String, required: true },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
  },
});

const PunchOutRequest = mongoose.model("PunchOutRequest", punchOutRequestSchema);

export default PunchOutRequest;