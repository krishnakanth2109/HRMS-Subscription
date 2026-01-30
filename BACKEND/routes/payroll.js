// --- START OF FILE routes/payroll.js ---
import express from 'express';
import PayrollRule from '../models/PayrollRule.js';
import PayrollRecord from '../models/PayrollRecord.js';
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();
router.use(protect);

// GET RULES (Scoped)
router.get('/rules', async (req, res) => {
  try {
    const query = req.user.role === 'admin' 
        ? { adminId: req.user._id } 
        : { companyId: req.user.company };

    const rules = await PayrollRule.findOne(query);

    if (!rules) {
      return res.status(200).json({
        basicPercentage: 40, hraPercentage: 40, conveyance: 1600, medical: 1250,
        pfCalculationMethod: 'percentage', pfPercentage: 12, employerPfPercentage: 12,
        pfFixedAmountEmployee: 0, pfFixedAmountEmployer: 0,
        ptSlab1Limit: 15000, ptSlab2Limit: 20000, ptSlab1Amount: 150, ptSlab2Amount: 200
      });
    }
    res.status(200).json(rules);
  } catch (err) {
    res.status(500).json({ message: 'Server Error fetching payroll rules' });
  }
});

// UPDATE RULES (Admin Only - Scoped)
router.put('/rules', onlyAdmin, async (req, res) => {
  try {
    const { companyId, ...data } = req.body; // Expect companyId from Admin
    // Ensure admin scopes rules to a company
    const updatedRules = await PayrollRule.findOneAndUpdate(
      { adminId: req.user._id, companyId: companyId || null },
      { 
          adminId: req.user._id,
          companyId,
          ...data 
      },
      { new: true, upsert: true }
    );
    res.status(200).json(updatedRules);
  } catch (err) {
    res.status(500).json({ message: 'Server Error updating payroll rules' });
  }
});

// SAVE BATCH (Admin Only)
router.post('/save-batch', onlyAdmin, async (req, res) => {
  try {
    const { records, period } = req.body;
    if (!records || !Array.isArray(records)) return res.status(400).json({ message: 'No records' });

    const monthIdentifier = period.start.substring(0, 7); 

    const bulkOps = records.map((record) => ({
      updateOne: {
        filter: { 
          employeeId: record.employeeId, 
          'payPeriod.monthIdentifier': monthIdentifier,
          adminId: req.user._id // Scope
        },
        update: {
          $set: {
            adminId: req.user._id,
            companyId: record.companyId, // Should come from frontend record
            employeeName: record.employeeName,
            role: record.role,
            payPeriod: { startDate: period.start, endDate: period.end, monthIdentifier },
            attendanceSummary: record.attendanceSummary,
            salaryDetails: record.salaryDetails,
            breakdown: record.breakdown,
            monthlyBreakdown: record.monthlyBreakdown
          }
        },
        upsert: true
      }
    }));

    await PayrollRecord.bulkWrite(bulkOps);
    res.status(200).json({ message: `Successfully saved ${records.length} records.` });
  } catch (err) {
    res.status(500).json({ message: 'Server Error saving payroll records' });
  }
});

// GET RECORD
router.get('/record/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month } = req.query; 
    if (!month) return res.status(400).json({ message: "Month required" });

    // Validate access (Admin or Self)
    if(req.user.role !== 'admin' && req.user.employeeId !== employeeId) return res.status(403).json({message: "Forbidden"});

    const record = await PayrollRecord.findOne({ employeeId, 'payPeriod.monthIdentifier': month });
    if (!record) return res.status(404).json({ message: "No record found." });

    res.status(200).json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server Error fetching payroll record' });
  }
});

export default router;