import express from 'express';
import PayrollRule from '../models/PayrollRule.js';

const router = express.Router();

// @route   GET /api/payroll/rules
// @desc    Get current payroll calculation rules
// @access  Public (or Protected based on your middleware)
router.get('/rules', async (req, res) => {
  try {
    const rules = await PayrollRule.findOne();

    if (!rules) {
      return res.status(200).json({
        basicPercentage: 40,
        hraPercentage: 40,
        conveyance: 1600,
        medical: 1250,
        pfPercentage: 18,
        employerPfPercentage: 18, // Default value
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
// @access  Admin/CEO
router.put('/rules', async (req, res) => {
  try {
    const {
      basicPercentage,
      hraPercentage,
      conveyance,
      medical,
      pfPercentage,
      employerPfPercentage, // New Field
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
        pfPercentage,
        employerPfPercentage,
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

export default router;