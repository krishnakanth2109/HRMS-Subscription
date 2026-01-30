// --- START OF FILE routes/shiftRoutes.js ---
import express from 'express';
import Shift from '../models/shiftModel.js';
import Employee from '../models/employeeModel.js';
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();
router.use(protect);

/* ============================================================
   🟥 ADMIN ONLY → CREATE / UPDATE SHIFT
============================================================ */
router.post('/create', onlyAdmin, async (req, res) => {
  try {
    const { employeeId, ...shiftData } = req.body;
    const cleanId = employeeId.trim();

    // Verify Employee belongs to Admin
    const employee = await Employee.findOne({ employeeId: cleanId, adminId: req.user._id });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    // Update or Create Shift with Hierarchy
    const shift = await Shift.findOneAndUpdate(
        { employeeId: cleanId },
        { 
            adminId: req.user._id,
            companyId: employee.company,
            ...shiftData, 
            employeeName: employee.name,
            isActive: true 
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ success: true, message: 'Shift updated', data: shift });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/* ============================================================
   🟥 ADMIN ONLY → GET ALL SHIFTS
============================================================ */
router.get('/all', onlyAdmin, async (req, res) => {
  try {
    const shifts = await Shift.find({ adminId: req.user._id, isActive: true }).sort({ employeeName: 1 });
    return res.status(200).json({ success: true, count: shifts.length, data: shifts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/* ============================================================
   👤 ADMIN → ANY EMPLOYEE SHIFT
   👤 MANAGER/EMPLOYEE → ONLY THEIR OWN SHIFT
============================================================ */
router.get('/:employeeId', async (req, res) => {
  try {
    const requestedId = req.params.employeeId;

    if (req.user.role !== "admin" && req.user.employeeId !== requestedId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const shift = await Shift.findOne({ employeeId: requestedId, isActive: true });

    if (!shift) {
      return res.status(200).json({
        success: true,
        data: {
          employeeId: requestedId,
          shiftStartTime: "09:00",
          shiftEndTime: "18:00",
          lateGracePeriod: 15,
          fullDayHours: 9, 
          halfDayHours: 4.5,
          autoExtendShift: true,
          weeklyOffDays: [0],
          timezone: "Asia/Kolkata",
          isDefault: true
        }
      });
    }

    return res.status(200).json({ success: true, data: shift });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/* ============================================================
   🟥 ADMIN ONLY → DELETE SHIFT
============================================================ */
router.delete('/:employeeId', onlyAdmin, async (req, res) => {
  try {
    await Shift.findOneAndDelete({ employeeId: req.params.employeeId, adminId: req.user._id });
    return res.status(200).json({ success: true, message: 'Shift reset to default' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/* ============================================================
   🟥 ADMIN ONLY → BULK SHIFT ASSIGN
============================================================ */
router.post('/bulk-create', onlyAdmin, async (req, res) => {
  try {
    const { employeeIds, shiftData } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds)) {
      return res.status(400).json({ success: false, message: 'Invalid Employee IDs' });
    }

    const promises = employeeIds.map(async (empId) => {
      const cleanId = empId.trim();
      const employee = await Employee.findOne({ employeeId: cleanId, adminId: req.user._id });
      if (!employee) return;

      const updateData = {
        ...shiftData,
        adminId: req.user._id,
        companyId: employee.company,
        employeeName: employee.name,
        isActive: true
      };

      await Shift.findOneAndUpdate(
        { employeeId: cleanId },
        { $set: updateData },
        { upsert: true }
      );
    });

    await Promise.all(promises);

    return res.status(200).json({ success: true, message: 'Bulk update successful' });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;