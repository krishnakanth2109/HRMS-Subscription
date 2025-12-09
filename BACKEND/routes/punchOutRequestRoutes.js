// --- START OF FILE punchOutRequestRoutes.js ---

import express from "express";
import PunchOutRequest from "../models/PunchOutRequest.js";
import Attendance from "../models/Attendance.js";

const router = express.Router();

// 1. Employee: Submit a Request
router.post("/create", async (req, res) => {
  try {
    const { employeeId, employeeName, originalDate, requestedPunchOut, reason } = req.body;

    const newRequest = new PunchOutRequest({
      employeeId,
      employeeName,
      originalDate,
      requestedPunchOut,
      reason,
    });

    await newRequest.save();
    res.json({ success: true, message: "Request submitted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Admin: Get Pending Requests
router.get("/all", async (req, res) => {
  try {
    const requests = await PunchOutRequest.find().sort({ requestDate: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Admin: Approve or Reject Request
router.post("/action", async (req, res) => {
  try {
    const { requestId, status } = req.body;
    const request = await PunchOutRequest.findById(requestId);

    if (!request)
      return res.status(404).json({ success: false, message: "Request not found" });

    // Update the Request Status immediately
    request.status = status;

    if (status === "Approved") {
      const targetDate = new Date(request.originalDate); 
      const startOfDay = new Date(targetDate); startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate); endOfDay.setUTCHours(23, 59, 59, 999);

      let attendanceRecord = await Attendance.findOne({
        employeeId: request.employeeId,
        $or: [
            { punchIn: { $gte: startOfDay, $lte: endOfDay } },
            { date: { $gte: startOfDay, $lte: endOfDay } },
            { date: request.originalDate }
        ]
      });

      if (attendanceRecord && !attendanceRecord.punchOut) {
        attendanceRecord.punchOut = request.requestedPunchOut;
        attendanceRecord.status = "PRESENT"; 
        attendanceRecord.punchOutLocation = {
          latitude: 0, 
          longitude: 0,
          address: "Manual Request Approved (Admin)",
        };
        await attendanceRecord.save();
      }
    }

    await request.save();
    res.json({ success: true, message: `Request ${status} Successfully` });
  } catch (error) {
    console.error("PunchOut Request Action Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Admin: Delete Request
router.delete("/delete/:id", async (req, res) => {
    try {
        const result = await PunchOutRequest.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: "Request not found" });
        res.json({ success: true, message: "Request deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;