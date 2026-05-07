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
      // ✅ FIX: Attendance stores daily records inside an array — query at root level, then find the day inside
      const attendanceDoc = await Attendance.findOne({
        employeeId: request.employeeId,
        adminId: req.user._id,
      });

      if (attendanceDoc) {
        const dayRecord = attendanceDoc.attendance.find(
          (a) => a.date === request.originalDate
        );

        if (dayRecord) {
          const newPunchOut = new Date(request.requestedPunchOut);

          // Close any open session
          const openSession = (dayRecord.sessions || []).find((s) => !s.punchOut);
          if (openSession) {
            openSession.punchOut = newPunchOut;
            openSession.durationSeconds =
              (newPunchOut - new Date(openSession.punchIn)) / 1000;
          }

          // Set punch-out fields
          dayRecord.punchOut = newPunchOut;
          dayRecord.adminPunchOut = true;
          dayRecord.adminPunchOutBy = req.user.name || "Admin";
          dayRecord.adminPunchOutTimestamp = new Date();
          dayRecord.isOnBreak = false;

          // ✅ KEY FIX: Set isFinalPunchOut = false so the employee can punch in again
          // The flow is: approved → employee is unblocked to punch in fresh today
          dayRecord.isFinalPunchOut = false;
          dayRecord.status = "COMPLETED";

          // Recalculate total worked seconds from all sessions
          let totalSeconds = 0;
          dayRecord.sessions.forEach((sess) => {
            if (sess.punchIn && sess.punchOut) {
              const dur =
                (new Date(sess.punchOut) - new Date(sess.punchIn)) / 1000;
              if (dur > 0) totalSeconds += dur;
            }
          });

          // Fallback if sessions are empty
          if (totalSeconds <= 0 && dayRecord.punchIn) {
            const breakSecs = dayRecord.totalBreakSeconds || 0;
            totalSeconds = Math.max(
              0,
              (newPunchOut - new Date(dayRecord.punchIn)) / 1000 - breakSecs
            );
          }

          const h = Math.floor(totalSeconds / 3600);
          const m = Math.floor((totalSeconds % 3600) / 60);
          const s = Math.floor(totalSeconds % 60);

          dayRecord.workedHours = h;
          dayRecord.workedMinutes = m;
          dayRecord.workedSeconds = s;
          dayRecord.displayTime = `${h}h ${m}m ${s}s`;

          await attendanceDoc.save();
        }
      }
    }

    await request.save();
    res.json({ success: true, message: `Request ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ NEW: Employee checks the status of their own punch-out request for a given date
router.get("/status", async (req, res) => {
  try {
    const { employeeId, date } = req.query;
    if (!employeeId || !date)
      return res.status(400).json({ message: "employeeId and date are required" });

    const request = await PunchOutRequest.findOne({
      employeeId,
      originalDate: date,
    }).sort({ requestDate: -1 });

    if (!request) return res.json({ found: false });

    res.json({ found: true, status: request.status, requestedPunchOut: request.requestedPunchOut });
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