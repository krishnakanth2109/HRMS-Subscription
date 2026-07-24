// --- START OF FILE models/Holiday.js ---
import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema({
  // HIERARCHY
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

  name: { type: String, required: true },
  description: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("Holiday", holidaySchema);
// --- END OF FILE models/Holiday.js ---