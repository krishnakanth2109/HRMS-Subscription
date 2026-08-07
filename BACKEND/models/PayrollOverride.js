import mongoose from "mongoose";

const payrollOverrideSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    employeeId: { type: String, required: true },

    // Earnings
    basicValueType: String,
    basicPercentage: Number,
    hraValueType: String,
    hraPercentage: Number,
    conveyanceValueType: String,
    conveyance: Number,
    medicalValueType: String,
    medical: Number,
    travellingAllowanceValueType: String,
    travellingAllowance: Number,

    // PF
    pfCalculationMethod: String,
    pfPercentage: Number,
    employerPfPercentage: Number,
    pfFixedAmountEmployee: Number,
    pfFixedAmountEmployer: Number,

    // PT
    ptSlab1Amount: Number,
    ptSlab2Amount: Number,

    // Late Penalty
    latePenaltyEnabled: Boolean,
    latePenaltyThreshold: Number,
    latePenaltyType: String,
    latePenaltyManualAmount: Number,

    // Bonus
    bonusAmount: Number,

    // Custom Fields
    customFields: { type: Array, default: [] },
    customDeductions: { type: Array, default: [] },
  },
  { timestamps: true }
);

payrollOverrideSchema.index({ adminId: 1, employeeId: 1 }, { unique: true });

export default mongoose.model("PayrollOverride", payrollOverrideSchema);
