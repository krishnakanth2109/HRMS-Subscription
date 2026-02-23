// --- START OF FILE routes/payroll.js ---
import express from 'express';
import PayrollRule from '../models/PayrollRule.js';
import PayrollRecord from '../models/PayrollRecord.js';
import { protect } from "../controllers/authController.js";

const router = express.Router();
router.use(protect);

// ✅ FIX: Custom Safe Admin Check (Handles "Admin" vs "admin" casing which causes 401 errors)
const safeAdminCheck = (req, res, next) => {
  if (req.user && req.user.role && req.user.role.toLowerCase() === 'admin') {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

// GET RULES (Scoped)
router.get('/rules', async (req, res) => {
  try {
    const isAdmin = req.user.role && req.user.role.toLowerCase() === 'admin';
    const query = isAdmin 
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
router.put('/rules', safeAdminCheck, async (req, res) => {
  try {
    const { companyId, ...data } = req.body; 
    
    // ✅ FIX: Safe Fallback for companyId to prevent Mongoose 500 errors
    const safeCompanyId = companyId || req.user.company || req.user.companyId || req.user._id;

    const updatedRules = await PayrollRule.findOneAndUpdate(
      { adminId: req.user._id }, 
      { 
          $set: {
            adminId: req.user._id,
            companyId: safeCompanyId,
            ...data 
          }
      },
      { new: true, upsert: true }
    );
    res.status(200).json(updatedRules);
  } catch (err) {
    console.error("Rules Update Error:", err);
    res.status(500).json({ message: 'Server Error updating payroll rules' });
  }
});

// SAVE BATCH (Admin Only)
router.post('/save-batch', safeAdminCheck, async (req, res) => {
  try {
    const { records, period } = req.body;
    if (!records || !Array.isArray(records)) return res.status(400).json({ message: 'No records' });

    const monthIdentifier = period.start.substring(0, 7); 
    const safeCompanyId = req.user.company || req.user.companyId || req.user._id;

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
            companyId: record.companyId || safeCompanyId, // ✅ FIX: Safe fallback
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
    console.error("Save Batch Error:", err);
    res.status(500).json({ message: 'Server Error saving payroll records' });
  }
});

// GET RECORD
router.get('/record/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month } = req.query; 
    if (!month) return res.status(400).json({ message: "Month required" });

    const isAdmin = req.user.role && req.user.role.toLowerCase() === 'admin';

    // Validate access (Admin or Self)
    if(!isAdmin && req.user.employeeId !== employeeId) {
        return res.status(403).json({message: "Forbidden"});
    }

    const record = await PayrollRecord.findOne({ employeeId, 'payPeriod.monthIdentifier': month });
    if (!record) return res.status(404).json({ message: "No record found." });

    res.status(200).json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server Error fetching payroll record' });
  }
});

export default router;