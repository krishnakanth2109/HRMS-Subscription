import express from 'express';
import PayrollRule from '../models/PayrollRule.js';
import PayrollRecord from '../models/PayrollRecord.js';

const router = express.Router();

// @route   GET /api/payroll/rules
// @desc    Get current payroll calculation rules
// @access  Public
router.get('/rules', async (req, res) => {
  try {
    const rules = await PayrollRule.findOne();

    if (!rules) {
      return res.status(200).json({
        basicPercentage: 40,
        hraPercentage: 40,
        conveyance: 1600,
        medical: 1250,
        // PF Defaults
        pfCalculationMethod: 'percentage', 
        pfPercentage: 12,
        employerPfPercentage: 12,
        pfFixedAmountEmployee: 0,
        pfFixedAmountEmployer: 0,
        // PT Defaults
        ptSlab1Limit: 15000,
        ptSlab2Limit: 20000,
        ptSlab1Amount: 150,
        ptSlab2Amount: 200
      });
    }

    res.status(200).json(rules);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error fetching payroll rules' });
  }
});

// @route   PUT /api/payroll/rules
// @desc    Update payroll calculation rules
// @access  Admin
router.put('/rules', async (req, res) => {
  try {
    const {
      basicPercentage,
      hraPercentage,
      conveyance,
      medical,
      // PF Data
      pfCalculationMethod,
      pfPercentage,
      employerPfPercentage,
      pfFixedAmountEmployee,
      pfFixedAmountEmployer,
      // PT Data
      ptSlab1Amount,
      ptSlab2Amount
    } = req.body;

    const updatedRules = await PayrollRule.findOneAndUpdate(
      {},
      {
        basicPercentage,
        hraPercentage,
        conveyance,
        medical,
        pfCalculationMethod,
        pfPercentage,
        employerPfPercentage,
        pfFixedAmountEmployee,
        pfFixedAmountEmployer,
        ptSlab1Amount,
        ptSlab2Amount
      },
      { new: true, upsert: true }
    );

    res.status(200).json(updatedRules);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error updating payroll rules' });
  }
});

// @route   POST /api/payroll/save-batch
// @desc    Save calculated payroll records for a specific month
// @access  Admin
router.post('/save-batch', async (req, res) => {
  try {
    const { records, period } = req.body;
    
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'No payroll records provided' });
    }

    const monthIdentifier = period.start.substring(0, 7); 

    const bulkOps = records.map((record) => ({
      updateOne: {
        filter: { 
          employeeId: record.employeeId, 
          'payPeriod.monthIdentifier': monthIdentifier 
        },
        update: {
          $set: {
            employeeName: record.employeeName,
            role: record.role,
            payPeriod: {
              startDate: period.start,
              endDate: period.end,
              monthIdentifier: monthIdentifier
            },
            attendanceSummary: {
              totalDaysInMonth: record.totalDaysInMonth,
              workedDays: record.workedDays,
              fullDays: record.fullDays,
              halfDays: record.halfDays,
              absentDays: record.absentDays,
              totalLeavesConsumed: record.totalLeavesConsumed,
              lopDays: record.lopDays,
              lateDaysCount: record.lateDaysCount,
              latePenaltyDays: record.latePenaltyDays
            },
            salaryDetails: {
              perDaySalary: record.perDaySalary,
              calculatedSalary: record.calculatedSalary,
              grossEarned: record.breakdown.gross,
              totalDeductions: record.totalDeductions,
              netPayableSalary: record.netPayableSalary,
              lopDeduction: record.lopDeduction,
              lateDeduction: record.lateDeduction
            },
            breakdown: record.breakdown,
            monthlyBreakdown: record.monthlyBreakdown
          }
        },
        upsert: true
      }
    }));

    await PayrollRecord.bulkWrite(bulkOps);

    res.status(200).json({ message: `Successfully saved/updated ${records.length} payroll records.` });
  } catch (err) {
    console.error('Error saving payroll batch:', err);
    res.status(500).json({ message: 'Server Error saving payroll records' });
  }
});

// @route   GET /api/payroll/record/:employeeId
// @desc    Get a single payroll record for an employee for a specific month
router.get('/record/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month } = req.query; 

    if (!month) {
      return res.status(400).json({ message: "Month parameter is required (YYYY-MM)" });
    }

    const record = await PayrollRecord.findOne({
      employeeId: employeeId,
      'payPeriod.monthIdentifier': month
    });

    if (!record) {
      return res.status(404).json({ message: "No payroll record found for this month." });
    }

    res.status(200).json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error fetching payroll record' });
  }
});

export default router;