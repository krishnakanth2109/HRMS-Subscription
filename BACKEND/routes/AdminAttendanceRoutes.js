// --- START OF FILE routes/AdminAttendanceRoutes.js ---
import express from "express";
import Attendance from "../models/Attendance.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect); // Ensure logged in

// ✅ Admin fetch attendance by date range with location data (Scoped)
router.get("/by-range", onlyAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required." });
    }

    // Aggregation Pipeline scoped to Admin
    const result = await Attendance.aggregate([
      // Stage 0: Filter by Admin ID
      {
        $match: {
            adminId: req.user._id 
        }
      },
      // Stage 1: Deconstruct the 'attendance' array
      {
        $unwind: "$attendance"
      },
      // Stage 2: Filter dates
      {
        $match: {
          "attendance.date": {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      // Stage 3: Sort
      {
        $sort: {
          "attendance.date": 1,
          "employeeName": 1
        }
      },
      // Stage 4: Reshape
      {
        $project: {
          _id: 0,
          employeeName: "$employeeName",
          employeeId: "$employeeId",
          date: "$attendance.date",
          punchIn: "$attendance.punchIn",
          punchOut: "$attendance.punchOut",
          displayTime: "$attendance.displayTime",
          loginStatus: "$attendance.loginStatus",
          workedStatus: "$attendance.workedStatus",
          status: "$attendance.status",
          punchInLocation: "$attendance.punchInLocation",
          punchOutLocation: "$attendance.punchOutLocation"
        }
      }
    ]);

    res.json(result);

  } catch (err) {
    console.error("Error fetching attendance by range:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;