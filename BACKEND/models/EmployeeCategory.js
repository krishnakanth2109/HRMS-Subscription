// --- START OF FILE EmployeeCategory.js ---
import mongoose from "mongoose";

const EmployeeCategorySchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  
  employeeId: { type: String, required: true },
  categoryId: { type: String, default: null }
}, { timestamps: true });

export default mongoose.model("EmployeeCategory", EmployeeCategorySchema);