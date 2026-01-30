// --- START OF FILE routes/punchOutRequestRoutes.js ---
import express from "express";
import PunchOutRequest from "../models/PunchOutRequest.js";
import Attendance from "../models/Attendance.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();
router.use(protect);

router.post("/create", async (req, res) => {
  try {
    const { employeeId, employeeName, originalDate, requestedPunchOut, reason } = req.body;
    await PunchOutRequest.create({
      adminId: req.user.adminId, // Hierarchy
      companyId: req.user.company, // Hierarchy
      employeeId,
      employeeName,
      originalDate,
      requestedPunchOut,
      reason,
    });
    res.json({ success: true, message: "Request submitted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/all", onlyAdmin, async (req, res) => {
  try {
    const requests = await PunchOutRequest.find({ adminId: req.user._id }).sort({ requestDate: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/action", onlyAdmin, async (req, res) => {
  try {
    const { requestId, status } = req.body;
    const request = await PunchOutRequest.findOne({ _id: requestId, adminId: req.user._id });

    if (!request) return res.status(404).json({ message: "Request not found" });

    request.status = status;

    if (status === "Approved") {
      const targetDate = new Date(request.originalDate); 
      // ... logic to find attendance record ...
      let attendanceRecord = await Attendance.findOne({
        employeeId: request.employeeId,
        date: request.originalDate // Simplified match
      });

      if (attendanceRecord && !attendanceRecord.punchOut) {
        attendanceRecord.punchOut = request.requestedPunchOut;
        attendanceRecord.status = "COMPLETED"; // Updated status
        attendanceRecord.adminPunchOut = true;
        await attendanceRecord.save();
      }
    }

    await request.save();
    res.json({ success: true, message: `Request ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/delete/:id", onlyAdmin, async (req, res) => {
    try {
        const result = await PunchOutRequest.findOneAndDelete({ _id: req.params.id, adminId: req.user._id });
        if (!result) return res.status(404).json({ message: "Request not found" });
        res.json({ success: true, message: "Deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;