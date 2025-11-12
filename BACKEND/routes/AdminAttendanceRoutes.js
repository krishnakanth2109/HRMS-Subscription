import express from "express";
import Attendance from "../models/Attendance.js"; // Make sure this path is correct

const router = express.Router();

// ✅ NEW: Admin fetch attendance by date range
router.get("/by-range", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // 1. Validate input
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required." });
    }

    // 2. Use an Aggregation Pipeline to efficiently query the data
    const result = await Attendance.aggregate([
      // Stage 1: Deconstruct the 'attendance' array into separate documents
      {
        $unwind: "$attendance"
      },

      // Stage 2: Filter those documents to match the date range
      {
        $match: {
          "attendance.date": {
            $gte: startDate, // Greater than or equal to startDate
            $lte: endDate    // Less than or equal to endDate
          }
        }
      },
      
      // Stage 3: Sort the results by date, then by employee name
      {
        $sort: {
          "attendance.date": 1, // 1 for ascending order
          "employeeName": 1
        }
      },

      // Stage 4: Reshape the output to match the format your frontend expects
      {
        $project: {
          _id: 0, // Exclude the default _id field
          employeeName: "$employeeName",
          employeeId: "$employeeId",
          date: "$attendance.date",
          punchIn: "$attendance.punchIn",
          punchOut: "$attendance.punchOut",
          displayTime: "$attendance.displayTime",
          loginStatus: "$attendance.loginStatus",
          status: "$attendance.status",
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