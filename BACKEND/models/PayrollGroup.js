import mongoose from "mongoose";

const payrollGroupSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    groupName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    employees: [
      {
        type: String, // employeeId (e.g. "EMP001")
      }
    ],
  },
  { timestamps: true }
);

export default mongoose.model("PayrollGroup", payrollGroupSchema);
