import mongoose from 'mongoose';

const payrollRuleSchema = new mongoose.Schema(
  {
    basicPercentage: {
      type: Number,
      required: true,
      default: 40 // 40% of Total Salary
    },
    hraPercentage: {
      type: Number,
      required: true,
      default: 40 // 40% of Basic Salary
    },
    conveyance: {
      type: Number,
      required: true,
      default: 1600 // Fixed Amount
    },
    medical: {
      type: Number,
      required: true,
      default: 1250 // Fixed Amount
    },
    // --- PF SETTINGS ---
    pfCalculationMethod: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
      required: true
    },
    // Percentage Mode
    pfPercentage: {
      type: Number,
      default: 12 // Employee Share % of Basic
    },
    employerPfPercentage: {
      type: Number,
      default: 12 // Employer Share % of Basic
    },
    // Fixed Amount Mode
    pfFixedAmountEmployee: {
      type: Number,
      default: 1800 // Fixed deduction amount
    },
    pfFixedAmountEmployer: {
      type: Number,
      default: 1800 // Fixed deduction amount
    },
    // --- PT SETTINGS ---
    ptSlab1Limit: {
      type: Number,
      default: 15000
    },
    ptSlab2Limit: {
      type: Number,
      default: 20000
    },
    ptSlab1Amount: {
      type: Number,
      default: 150 // PT for 15k–20k
    },
    ptSlab2Amount: {
      type: Number,
      default: 200 // PT for >20k
    }
  },
  { timestamps: true }
);

const PayrollRule = mongoose.model('PayrollRule', payrollRuleSchema);

export default PayrollRule;