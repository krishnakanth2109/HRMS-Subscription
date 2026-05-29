// --- START OF FILE models/PayrollRule.js ---
import mongoose from 'mongoose';

const payrollRuleSchema = new mongoose.Schema(
  {
    // HIERARCHY LINKS
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    basicPercentage: { type: Number, required: true, default: 40 },
    hraPercentage: { type: Number, required: true, default: 40 },
    conveyance: { type: Number, required: true, default: 1600 },
    medical: { type: Number, required: true, default: 1250 },
    travellingAllowance: { type: Number, required: true, default: 800 },
    otherAllowance: { type: Number, required: true, default: 1000 },

    // --- CUSTOMIZABLE FIELD LABELS ---
    customLabels: {
      basicPercentage: { type: String, default: "Basic Salary" },
      hraPercentage: { type: String, default: "HRA" },
      conveyance: { type: String, default: "Conveyance" },
      medical: { type: String, default: "Medical" },
      travellingAllowance: { type: String, default: "Travelling Allowance" },
      otherAllowance: { type: String, default: "Other Allowance" },
    },

    // --- DYNAMIC CUSTOM FIELDS ---
    customFields: [
      {
        name: { type: String, required: true },
        value: { type: Number, required: true, default: 0 },
        valueType: { type: String, enum: ['percentage', 'fixed'], default: 'fixed' },
        percentageOf: { type: String, enum: ['basic', 'total'], default: 'total' }
      }
    ],

    // --- DYNAMIC CUSTOM DEDUCTIONS ---
    customDeductions: [
      {
        name: { type: String, required: true },
        value: { type: Number, required: true, default: 0 },
        valueType: { type: String, enum: ['percentage', 'fixed'], default: 'fixed' },
        percentageOf: { type: String, enum: ['basic', 'total'], default: 'total' }
      }
    ],

    // --- PF SETTINGS ---
    pfCalculationMethod: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
      required: true
    },
    // Percentage Mode
    pfPercentage: { type: Number, default: 12 },
    employerPfPercentage: { type: Number, default: 12 },

    // Fixed Amount Mode
    pfFixedAmountEmployee: { type: Number, default: 1800 },
    pfFixedAmountEmployer: { type: Number, default: 1800 },

    // --- PT SETTINGS ---
    ptSlab1Limit: { type: Number, default: 15000 },
    ptSlab2Limit: { type: Number, default: 20000 },
    ptSlab1Amount: { type: Number, default: 150 },
    ptSlab2Amount: { type: Number, default: 200 },

    // --- LATE PENALTY SETTINGS ---
    latePenaltyEnabled: { type: Boolean, default: false },
    latePenaltyThreshold: { type: Number, default: 3 },          // # of late logins before penalty applies
    latePenaltyType: {
      type: String,
      enum: ['halfDay', 'fullDay', 'manual'],
      default: 'halfDay'
    },
    latePenaltyManualAmount: { type: Number, default: 0 }         // Fixed ₹ per penalty occurrence
  },
  { timestamps: true }
);

const PayrollRule = mongoose.model('PayrollRule', payrollRuleSchema);

export default PayrollRule;