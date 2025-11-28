// --- UPDATED FILE: routes/shiftRoutes.js ---

import express from 'express';
import Shift from '../models/shiftModel.js';
import Employee from '../models/employeeModel.js';
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* ============================================================
   🔐 ALL ROUTES REQUIRE LOGIN
============================================================ */
router.use(protect);

/* ============================================================
   🟥 ADMIN ONLY → CREATE / UPDATE SHIFT
============================================================ */
router.post('/create', onlyAdmin, async (req, res) => {
  try {
    const {
      employeeId,
      shiftStartTime,
      shiftEndTime,
      lateGracePeriod,
      fullDayHours,
      halfDayHours,
      autoExtendShift,
      weeklyOffDays
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required' });
    }

    const cleanEmployeeId = employeeId.trim();
    const employee = await Employee.findOne({ employeeId: cleanEmployeeId });
    
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const latestExp = employee.experienceDetails?.length
      ? employee.experienceDetails[employee.experienceDetails.length - 1]
      : null;

    const department = latestExp?.department || employee.department || 'N/A';
    const role = latestExp?.role || employee.role || 'N/A';
    const currentUserEmail = req.user?.email || 'Admin';

    let shift = await Shift.findOne({ employeeId: cleanEmployeeId });

    const shiftData = {
      shiftStartTime: shiftStartTime || "09:00",
      shiftEndTime: shiftEndTime || "18:00",
      lateGracePeriod: Number(lateGracePeriod) || 15,
      fullDayHours: Number(fullDayHours) || 8,
      halfDayHours: Number(halfDayHours) || 4,
      autoExtendShift: autoExtendShift !== undefined ? autoExtendShift : true,
      weeklyOffDays: weeklyOffDays || [0],
      department,
      role,
      timezone: "Asia/Kolkata",
      employeeName: employee.name,
      updatedBy: currentUserEmail,
      isActive: true
    };

    if (shift) {
      Object.assign(shift, shiftData);
      await shift.save();
    } else {
      shift = await Shift.create({
        employeeId: cleanEmployeeId,
        email: employee.email,
        createdBy: currentUserEmail,
        ...shiftData
      });
    }

    return res.status(200).json({ success: true, message: 'Shift updated successfully', data: shift });

  } catch (error) {
    console.error('Shift save error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/* ============================================================
   🟥 ADMIN ONLY → GET ALL SHIFTS
============================================================ */
router.get('/all', onlyAdmin, async (req, res) => {
  try {
    const shifts = await Shift.find({ isActive: true }).sort({ employeeName: 1 });
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

    // Manager/Employee cannot access other employees' shifts
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
          fullDayHours: 8,
          halfDayHours: 4,
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
    await Shift.findOneAndDelete({ employeeId: req.params.employeeId });
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

    const cleanShiftData = {
      ...shiftData,
      lateGracePeriod: Number(shiftData.lateGracePeriod),
      fullDayHours: Number(shiftData.fullDayHours),
      halfDayHours: Number(shiftData.halfDayHours),
      timezone: "Asia/Kolkata"
    };

    const currentUserEmail = req.user?.email || "Admin";

    const promises = employeeIds.map(async (empId) => {
      const cleanId = empId.trim();
      const employee = await Employee.findOne({ employeeId: cleanId });
      if (!employee) return;

      const updateData = {
        ...cleanShiftData,
        employeeName: employee.name,
        email: employee.email,
        updatedBy: currentUserEmail,
        isActive: true
      };

      await Shift.findOneAndUpdate(
        { employeeId: cleanId },
        { $set: updateData, $setOnInsert: { createdBy: currentUserEmail } },
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

// --- END ---
