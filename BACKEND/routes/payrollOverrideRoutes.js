import express from 'express';
import PayrollOverride from '../models/PayrollOverride.js';
import { protect } from '../controllers/authController.js';

const router = express.Router();
router.use(protect);

const safeAdminCheck = (req, res, next) => {
  if (req.user && req.user.role && (req.user.role.toLowerCase() === 'admin' || req.user.role.toLowerCase() === 'support-admin')) {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

// GET all overrides for this admin
router.get('/', safeAdminCheck, async (req, res) => {
  try {
    const overrides = await PayrollOverride.find({ adminId: req.user._id }).lean();
    // Return as a map { [employeeId]: overrideData }
    const map = {};
    overrides.forEach(o => {
      const { _id, adminId, companyId, employeeId, createdAt, updatedAt, __v, ...fields } = o;
      map[employeeId] = fields;
    });
    res.status(200).json(map);
  } catch (err) {
    console.error('Get overrides error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// POST: Save or update overrides for multiple employees at once
// Body: { overrides: [{ employeeId, ...fields }] }
router.post('/bulk', safeAdminCheck, async (req, res) => {
  try {
    const { overrides } = req.body;
    if (!Array.isArray(overrides) || !overrides.length) {
      return res.status(400).json({ message: 'No overrides provided' });
    }

    const safeCompanyId = req.user.company || req.user.companyId || req.user._id;

    const bulkOps = overrides.map(({ employeeId, ...fields }) => ({
      updateOne: {
        filter: { adminId: req.user._id, employeeId },
        update: { $set: { adminId: req.user._id, companyId: safeCompanyId, employeeId, ...fields } },
        upsert: true,
      },
    }));

    await PayrollOverride.bulkWrite(bulkOps);
    res.status(200).json({ message: `${overrides.length} override(s) saved.` });
  } catch (err) {
    console.error('Bulk save overrides error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// DELETE: Remove overrides for specific employee IDs
// Body: { employeeIds: ['EMP001', 'EMP002'] }
router.delete('/bulk', safeAdminCheck, async (req, res) => {
  try {
    const { employeeIds } = req.body;
    if (!Array.isArray(employeeIds) || !employeeIds.length) {
      return res.status(400).json({ message: 'No employeeIds provided' });
    }
    await PayrollOverride.deleteMany({ adminId: req.user._id, employeeId: { $in: employeeIds } });
    res.status(200).json({ message: `${employeeIds.length} override(s) cleared.` });
  } catch (err) {
    console.error('Delete overrides error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
