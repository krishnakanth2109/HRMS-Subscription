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
    ptSlab2Amount: { type: Number, default: 200 }
  },
  { timestamps: true }
);

const PayrollRule = mongoose.model('PayrollRule', payrollRuleSchema);

export default PayrollRule;