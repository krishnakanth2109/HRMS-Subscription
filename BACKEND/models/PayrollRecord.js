// --- START OF FILE models/PayrollRecord.js ---
import mongoose from 'mongoose';

const payrollRecordSchema = new mongoose.Schema(
  {
    // HIERARCHY LINKS
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    role: { type: String },
    
    payPeriod: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      monthIdentifier: { type: String, required: true } // Format: "YYYY-MM"
    },

    attendanceSummary: {
      totalDaysInMonth: Number,
      workedDays: Number,
      fullDays: Number,
      halfDays: Number,
      absentDays: Number,
      totalLeavesConsumed: Number,
      lopDays: Number,
      lateDaysCount: Number,
      latePenaltyDays: Number
    },

    salaryDetails: {
      perDaySalary: Number,
      calculatedSalary: Number,
      grossEarned: Number, 
      totalDeductions: Number,
      netPayableSalary: Number,
      lopDeduction: Number,
      lateDeduction: Number
    },

    // Detailed breakdown for Payslip generation
    breakdown: {
      basic: Number,
      hra: Number,
      conveyance: Number,
      medical: Number,
      special: Number,
      gross: Number,
      pf: Number,
      employerPf: Number,
      pt: Number
    },
    
    monthlyBreakdown: {
      basic: Number,
      hra: Number,
      conveyance: Number,
      medical: Number,
      special: Number,
      total: Number
    }
  },
  { timestamps: true }
);

// Compound index: Unique record per employee per month
payrollRecordSchema.index({ employeeId: 1, 'payPeriod.monthIdentifier': 1 }, { unique: true });

const PayrollRecord = mongoose.model('PayrollRecord', payrollRecordSchema);

export default PayrollRecord;