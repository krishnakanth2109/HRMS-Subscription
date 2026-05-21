// --- START OF FILE routes/shiftRoutes.js ---
import express from 'express';
import Shift from '../models/shiftModel.js';
import Employee from '../models/employeeModel.js';
import SupportAdmin from '../models/supportAdminModel.js';
import Company from '../models/CompanyModel.js';
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();
router.use(protect);

const resolveShiftCandidate = async (candidateId, adminId) => {
  const cleanId = String(candidateId || "").trim();
  if (!cleanId) return null;

  const employee = await Employee.findOne({ employeeId: cleanId, adminId });
  if (employee) {
    return {
      employeeId: cleanId,
      companyId: employee.company,
      employeeName: employee.name,
      email: employee.email,
      department: employee.currentDepartment || employee.department || "N/A",
      role: employee.currentRole || employee.role || "Employee",
    };
  }

  const supportAdmin = await SupportAdmin.findOne({ _id: cleanId, adminId });
  if (!supportAdmin) return null;

  const company = await Company.findOne({ adminId, isActive: true }).sort({ createdAt: 1 });
  if (!company) {
    throw new Error("No active company found for assigning administration shift");
  }

  return {
    employeeId: cleanId,
    companyId: company._id,
    employeeName: supportAdmin.name,
    email: supportAdmin.email,
    department: supportAdmin.department || "Administration",
    role: supportAdmin.positionName || "Administration",
  };
};

/* ============================================================
   🟥 ADMIN ONLY → CREATE / UPDATE SHIFT
============================================================ */
router.post('/create', onlyAdmin, async (req, res) => {
  try {
    const { employeeId, ...shiftData } = req.body;
    const cleanId = String(employeeId || "").trim();

    const candidate = await resolveShiftCandidate(cleanId, req.user._id);
    if (!candidate) return res.status(404).json({ message: 'Employee or administration user not found' });

    // Update or Create Shift with Hierarchy
    const shift = await Shift.findOneAndUpdate(
        { employeeId: cleanId },
        { 
            adminId: req.user._id,
            companyId: candidate.companyId,
            ...shiftData, 
            employeeName: candidate.employeeName,
            email: candidate.email,
            department: candidate.department,
            role: candidate.role,
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

    if (req.user.role !== "admin" && req.user.role !== "support-admin" && req.user.employeeId !== requestedId) {
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
      const cleanId = String(empId || "").trim();
      const candidate = await resolveShiftCandidate(cleanId, req.user._id);
      if (!candidate) return;

      const updateData = {
        ...shiftData,
        adminId: req.user._id,
        companyId: candidate.companyId,
        employeeName: candidate.employeeName,
        email: candidate.email,
        department: candidate.department,
        role: candidate.role,
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
