// --- START OF FILE routes/overtimeRoutes.js ---
import express from "express";
import Overtime from "../models/Overtime.js"; // Note casing
import Admin from "../models/adminModel.js";
import Employee from "../models/employeeModel.js";
import Notification from "../models/notificationModel.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import { sendBrevoEmail } from "../Services/emailService.js";

const router = express.Router();
router.use(protect);

/* ======================================================
   🧑‍💼 EMPLOYEE/MANAGER APPLY
====================================================== */
router.post("/apply", async (req, res) => {
  try {
    const { employeeId, employeeName, date, type } = req.body;
    const employeeEmail = req.user?.email || "N/A";

    if (!employeeId || !employeeName || !date || !type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // CREATE WITH HIERARCHY
    const newOT = await Overtime.create({
      adminId: req.user.adminId, // Hierarchy
      companyId: req.user.company, // Hierarchy
      employeeId,
      employeeName,
      date,
      type,
      status: "PENDING",
    });

    // Notify Specific Admin
    const admin = await Admin.findById(req.user.adminId);
    if(admin) {
        await Notification.create({
            adminId: admin._id,
            companyId: req.user.company,
            userId: admin._id,
            title: "New Overtime Request",
            message: `${employeeName} requested overtime on ${date}`,
            type: "overtime",
            isRead: false
        });
        // Email logic scoped to admin.email (omitted detailed HTML for brevity but logic is here)
        await sendBrevoEmail({
            to: [{ name: admin.name, email: admin.email }],
            subject: `New Overtime Request: ${employeeName}`,
            htmlContent: `<p>${employeeName} requested overtime.</p>`
        });
    }

    res.status(201).json({ message: "Overtime request submitted", data: newOT });
  } catch (err) {
    console.error("OT CREATE ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   🟥 ADMIN ONLY → GET ALL (SCOPED)
====================================================== */
router.get("/all", onlyAdmin, async (req, res) => {
  try {
    // Only this Admin's data
    const list = await Overtime.find({ adminId: req.user._id }).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error("OT ALL FETCH ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   🟥 ADMIN ONLY → UPDATE STATUS
====================================================== */
router.put("/update-status/:id", onlyAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // Update ensuring ownership
    const updated = await Overtime.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id },
      { status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Overtime request not found" });

    // Notify Employee
    const employee = await Employee.findOne({ employeeId: updated.employeeId });
    if (employee) {
      await Notification.create({
        adminId: req.user._id,
        companyId: updated.companyId,
        userId: employee._id,
        title: "Overtime Status Update",
        message: `Your overtime request on ${updated.date} was ${status}`,
        type: "overtime-status",
        isRead: false,
      });
    }

    res.json({ message: "Status updated successfully", data: updated });
  } catch (err) {
    console.error("OT STATUS UPDATE ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   ❌ EMPLOYEE CANCEL
====================================================== */
router.patch("/cancel/:id", async (req, res) => {
  try {
    const overtime = await Overtime.findById(req.params.id);
    if (!overtime) return res.status(404).json({ message: "Overtime not found" });

    if (overtime.employeeId !== req.user.employeeId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (overtime.status !== "PENDING") {
      return res.status(400).json({ message: "Cannot cancel approved/rejected overtime" });
    }

    await Overtime.findByIdAndDelete(req.params.id);

    // Notify Admin
    const admin = await Admin.findById(overtime.adminId);
    if(admin) {
        await Notification.create({
            adminId: admin._id,
            companyId: overtime.companyId,
            userId: admin._id,
            title: "Overtime Cancelled",
            message: `${overtime.employeeName} cancelled request`,
            type: "overtime",
            isRead: false
        });
    }

    res.json({ message: "Overtime cancelled successfully" });
  } catch (error) {
    console.error("Cancel OT failed:", error);
    res.status(500).json({ message: "Failed to cancel overtime request" });
  }
});

/* ======================================================
   👤 EMPLOYEE HISTORY
====================================================== */
router.get("/:employeeId", async (req, res) => {
  try {
    if (req.user.employeeId !== req.params.employeeId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const list = await Overtime.find({ employeeId: req.params.employeeId }).sort({ date: -1 });
    res.json(list);
  } catch (err) {
    console.error("OT FETCH ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   🟥 ADMIN DELETE
====================================================== */
router.delete("/delete/:id", onlyAdmin, async (req, res) => {
  try {
    const removed = await Overtime.findOneAndDelete({ _id: req.params.id, adminId: req.user._id });
    if (!removed) return res.status(404).json({ message: "Overtime not found" });
    res.json({ message: "Overtime deleted successfully" });
  } catch (err) {
    console.error("OT DELETE ERROR →", err);
    res.status(500).json({ message: "Failed to delete overtime request" });
  }
});

export default router;