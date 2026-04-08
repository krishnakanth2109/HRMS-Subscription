// --- START OF FILE EmployeeattendanceRoutes.js ---

import express from 'express';
import Attendance from '../models/Attendance.js';
import Shift from '../models/shiftModel.js';
import { reverseGeocode, validateCoordinates } from '../Services/locationService.js';
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Holiday from "../models/Holiday.js";
import Overtime from "../models/Overtime.js";
import nodemailer from 'nodemailer';

const router = express.Router();

/* ==========================================================
   1. EMAIL CONFIGURATION & TRANSPORTER
   ========================================================== */

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_PORT == 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false }
});

transporter.verify((error, success) => {
  if (error) { console.error("❌ SMTP Verification Error:", error); }
  else { console.log("✅ Mail Server is ready to send messages"); }
});


/* ==========================================================
   2. EMAIL HTML TEMPLATES
   ========================================================== */

const createInsufficientHoursEmail = (employeeData) => {
  const { employeeName, date, punchIn, punchOut, workedHours, workedMinutes, workedSeconds, requiredHours, loginStatus, workedStatus } = employeeData;

  const formatTime = (dateObj) => {
    if (!dateObj) return '--';
    const utcDate = new Date(dateObj);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(utcDate.getTime() + istOffset);
    let hours = istDate.getUTCHours();
    const minutes = istDate.getUTCMinutes();
    const seconds = istDate.getUTCSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '--';
    const utcDate = new Date(dateStr);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(utcDate.getTime() + istOffset);
    return istDate.toDateString();
  };

  const getStatusBadge = (status) => {
    const colors = {
      'ON_TIME':  { bg: '#10b981', text: '#ffffff' },
      'LATE':     { bg: '#ef4444', text: '#ffffff' },
      'FULL_DAY': { bg: '#10b981', text: '#ffffff' },
      'HALF_DAY': { bg: '#f59e0b', text: '#ffffff' },
      'ABSENT':   { bg: '#ef4444', text: '#ffffff' },
    };
    const color = colors[status] || { bg: '#6b7280', text: '#ffffff' };
    return `<span style="background-color:${color.bg};color:${color.text};padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;">${status.replace(/_/g, ' ')}</span>`;
  };

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#b91c1c,#ef4444);padding:35px 30px;text-align:center;">
            <h1 style="margin:0;font-size:26px;color:#ffffff;font-weight:700;letter-spacing:0.5px;">⚠ Shortage Of Working Hours</h1>
            <p style="margin:8px 0 0 0;color:#fecaca;font-size:14px;">Attendance & Workforce Management System</p>
          </td>
        </tr>
        <tr>
          <td style="padding:35px 30px;">
            <p style="margin:0 0 18px 0;font-size:16px;color:#1f2937;">Hi <strong>${employeeName}</strong>,</p>
            <p style="margin:0 0 25px 0;font-size:15px;color:#4b5563;line-height:1.7;">
              Your are receiving this Email because we identified some irregularity in your attendance logs on ${formatDate(date)}.
              Your total worked hours for the day are less than the required ${requiredHours} hours. Please find the details below.
            </p>
            <table width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:10px;padding:20px;border:1px solid #e5e7eb;margin-bottom:25px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr><td style="padding:10px 0;color:#6b7280;">📅 Date</td><td style="padding:10px 0;text-align:right;font-weight:600;color:#111827;">${formatDate(date)}</td></tr>
                  <tr><td style="padding:10px 0;color:#6b7280;">🕘 First Punch-In</td><td style="padding:10px 0;text-align:right;font-weight:600;">${formatTime(punchIn)}</td></tr>
                  <tr><td style="padding:10px 0;color:#6b7280;">🕔 Last Punch-Out</td><td style="padding:10px 0;text-align:right;font-weight:600;">${formatTime(punchOut)}</td></tr>
                  <tr><td style="padding:10px 0;color:#6b7280;">⏱ Required Hours</td><td style="padding:10px 0;text-align:right;font-weight:600;">${requiredHours}h</td></tr>
                  <tr style="border-top:1px solid #e5e7eb;">
                    <td style="padding:12px 0;font-weight:bold;color:#111827;">⌛ Total Worked Time</td>
                    <td style="padding:12px 0;text-align:right;font-weight:bold;color:#dc2626;font-size:15px;">${workedHours}h ${workedMinutes}m ${workedSeconds}s</td>
                  </tr>
                  <tr><td style="padding:10px 0;color:#6b7280;">Login Status</td><td style="padding:10px 0;text-align:right;">${getStatusBadge(loginStatus)}</td></tr>
                  <tr><td style="padding:10px 0;color:#6b7280;">Work Status</td><td style="padding:10px 0;text-align:right;">${getStatusBadge(workedStatus)}</td></tr>
                </table>
              </td></tr>
            </table>
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-left:5px solid #f97316;border-radius:8px;padding:16px;margin-bottom:25px;">
              <p style="margin:0;font-size:13px;color:#7c2d12;line-height:1.6;">
                <strong>Note:</strong> If you do not punch in again today, this will be considered your final punch-out and will be officially recorded in our management system.
              </p>
              <p style="margin:10px 0 0 0;font-size:13px;color:#9a3412;line-height:1.6;">
                <strong>Important:</strong> Early punch-out without prior approval may impact your attendance compliance and salary processing. Please reach out to your HR/reporting manager in case you need further clarification.
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f3f4f6;padding:18px;text-align:center;font-size:12px;color:#9ca3af;">
            © ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric' })} Attendance Management System<br/>
            This is an automated notification. Please do not reply to this email.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

const createMissingAttendanceEmail = (employeeData) => {
  const { employeeName, date } = employeeData;

  const formatDate = (dateStr) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    return `${months[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}, ${days[d.getDay()]}`;
  };

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellspacing="0" cellpadding="0" style="padding:20px;max-width:600px;margin:0 auto;">
    <tr><td>
      <h2 style="color:#000000;font-size:20px;margin:0 0 20px 0;border-bottom:2px solid #3b82f6;display:inline-block;padding-bottom:4px;">Leave Deducted for Worked Hours Less Than Half Day</h2>
      <p style="margin:0 0 18px 0;font-size:15px;color:#1f2937;">Hi ${employeeName},</p>
      <p style="margin:0 0 25px 0;font-size:15px;color:#1f2937;line-height:1.6;">
        There has been a penalization of 1 leave for Worked Hours Less Than Half Day.
      </p>
      <h3 style="margin:0 0 10px 0;font-size:16px;color:#1f2937;">Leave Deduction Details</h3>
      <hr style="border:0;border-top:1px solid #d1d5db;margin:0 0 15px 0;"/>
      <p style="margin:5px 0;font-size:15px;color:#1f2937;">Penalization Date: ${formatDate(date)}</p>
      <p style="margin:5px 0;font-size:15px;color:#1f2937;">Penalization Reason: Worked Hours Less Than minimum Half day required hours</p>
      <p style="margin:5px 0;font-size:15px;color:#1f2937;">Leave Type Deducted: Unpaid Leave</p>
      <hr style="border:0;border-top:1px solid #d1d5db;margin:15px 0 25px 0;"/>
      <p style="margin:0 0 25px 0;font-size:15px;color:#1f2937;line-height:1.6;">
        In case you might have any question related to this deduction, please reach out to your Reporting Manager or HR manager for more clarity.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
};

const createUninformedAbsenceEmail = (employeeName, absentDate) => {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f4f7f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellspacing="0" cellpadding="0" style="padding:40px 10px;">
    <tr><td align="center">
      <table width="600" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:#dc2626;padding:40px 20px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;letter-spacing:1px;">ABSENCE ALERT</h1>
            <p style="margin:10px 0 0 0;color:#fecaca;font-size:14px;">Attendance Management Notification</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 30px;">
            <p style="font-size:17px;color:#1f2937;margin-bottom:20px;">Hi <strong>${employeeName}</strong>,</p>
            <div style="background:#fff1f2;border-left:5px solid #e11d48;padding:20px;margin-bottom:30px;">
              <p style="margin:0;color:#9f1239;font-size:16px;line-height:1.6;">
                <strong>No Attendance Recorded on:</strong> ${new Date(absentDate).toDateString()}
              </p>
            </div>
            <p style="color:#4b5563;font-size:15px;line-height:1.7;">
              This is to inform you that an irregularity has been identified in your attendance records on ${new Date(absentDate).toDateString()}.
              Our records indicate that you were absent on this date without an approved leave request on file.
              <br><br>
              Please note that unreported or uninformed absences may impact team scheduling, project timelines, and overall workflow efficiency.
            </p>
            <table width="100%" style="margin:30px 0;border-top:1px solid #e5e7eb;padding-top:20px;">
              <tr><td>
                <p style="margin:0;font-size:13px;color:#6b7280;">
                  <strong>Next Steps:</strong><br>
                  1. Please discuss this absence with your Reporting Manager.<br>
                  2. If this is a technical error, contact HR/IT support immediately.<br>
                  3. Ensure all future leaves are applied and approved in advance.
                </p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px;text-align:center;color:#9ca3af;font-size:12px;">
            © ${new Date().getFullYear()} Attendance System | Automated Message - Please do not reply.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};


/* ==========================================================
   3. EMAIL SENDING FUNCTIONS (ASYNC)
   ========================================================== */

const sendInsufficientHoursEmail = async (employeeEmail, employeeData) => {
  try {
    await transporter.sendMail({
      from: `<${process.env.SMTP_USER}>`,
      to: employeeEmail,
      subject: `Shortage of Work Hours - ${employeeData.date}`,
      html: createInsufficientHoursEmail(employeeData),
    });
    console.log(`✅ Insufficient hours email sent to ${employeeEmail}`);
  } catch (error) { console.error('❌ Error sending email:', error); }
};

const sendMissingAttendanceEmail = async (employeeEmail, employeeData) => {
  try {
    await transporter.sendMail({
      from: `<${process.env.SMTP_USER}>`,
      to: employeeEmail,
      subject: `Leave Deducted for Worked Hours Less Than Half Day - ${employeeData.date}`,
      html: createMissingAttendanceEmail(employeeData),
    });
    console.log(`✅ Missing attendance (Leave Deducted) email sent to ${employeeEmail}`);
  } catch (error) { console.error('❌ Error sending missing attendance email:', error); }
};

const sendUninformedAbsenceEmail = async (employeeEmail, employeeName, absentDate) => {
  try {
    await transporter.sendMail({
      from: `<${process.env.SMTP_USER}>`,
      to: employeeEmail,
      subject: `⚠ No Attendance Recorded - ${absentDate}`,
      html: createUninformedAbsenceEmail(employeeName, absentDate),
    });
    console.log(`✅ Absence alert email sent to ${employeeEmail} for date ${absentDate}`);
  } catch (error) { console.error('❌ Error sending absence email:', error); }
};


/* ==========================================================
   4. MIDDLEWARE
   ========================================================== */

router.use(protect);


/* ==========================================================
   5. SIMPLE ADMIN — GET ALL (Scoped to admin)
   ========================================================== */

router.get('/all', onlyAdmin, async (req, res) => {
  try {
    const records = await Attendance.find({ adminId: req.user._id });
    const sortedRecords = records.map(rec => {
      rec.attendance.sort((a, b) => new Date(b.date) - new Date(a.date));
      return rec;
    });
    res.status(200).json({ success: true, count: sortedRecords.length, data: sortedRecords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ==========================================================
   6. OPTIMIZED ADMIN REPORTS (AGGREGATION PIPELINES — Scoped to adminId)
   ========================================================== */

/**
 * Export API: Get detailed flat records for a date range (scoped to admin)
 */
router.get('/admin/date-range', onlyAdmin, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ message: "start and end query params are required" });

    const pipeline = [
      { $match: { adminId: req.user._id } },
      { $unwind: "$attendance" },
      { $match: { "attendance.date": { $gte: start, $lte: end } } },
      {
        $project: {
          employeeId: 1,
          employeeName: 1,
          date: "$attendance.date",
          punchIn: "$attendance.punchIn",
          punchOut: "$attendance.punchOut",
          punchInLocation: "$attendance.punchInLocation",
          punchOutLocation: "$attendance.punchOutLocation",
          sessions: { $ifNull: ["$attendance.sessions", []] },
          isOnBreak: { $ifNull: ["$attendance.isOnBreak", false] },
          breakSessions: { $ifNull: ["$attendance.breakSessions", []] },
          workedHours: { $ifNull: ["$attendance.workedHours", 0] },
          workedMinutes: { $ifNull: ["$attendance.workedMinutes", 0] },
          workedSeconds: { $ifNull: ["$attendance.workedSeconds", 0] },
          totalBreakSeconds: { $ifNull: ["$attendance.totalBreakSeconds", 0] },
          displayTime: { $ifNull: ["$attendance.displayTime", "0h 0m 0s"] },
          status: { $ifNull: ["$attendance.status", "NOT_STARTED"] },
          isFinalPunchOut: { $ifNull: ["$attendance.isFinalPunchOut", false] },
          adminPunchOut: { $ifNull: ["$attendance.adminPunchOut", false] },
          adminPunchOutBy: { $ifNull: ["$attendance.adminPunchOutBy", null] },
          adminPunchOutTimestamp: { $ifNull: ["$attendance.adminPunchOutTimestamp", null] },
          loginStatus: { $ifNull: ["$attendance.loginStatus", "NOT_APPLICABLE"] },
          workedStatus: { $ifNull: ["$attendance.workedStatus", "NOT_APPLICABLE"] },
          attendanceCategory: { $ifNull: ["$attendance.attendanceCategory", "NOT_APPLICABLE"] },
          lateCorrectionRequest: { $ifNull: ["$attendance.lateCorrectionRequest", null] },
          statusCorrectionRequest: { $ifNull: ["$attendance.statusCorrectionRequest", null] },
        }
      },
      { $sort: { date: -1, punchIn: -1 } }
    ];

    const flatRecords = await Attendance.aggregate(pipeline);
    res.status(200).json(flatRecords);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Daily Counts: Statistics for the Admin Dashboard cards (scoped to admin)
 */
router.get('/admin/daily-counts', onlyAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "Date is required" });

    const pipeline = [
      { $match: { adminId: req.user._id } },
      { $unwind: "$attendance" },
      { $match: { "attendance.date": date } },
      {
        $group: {
          _id: null,
          workingCount: { $sum: { $cond: [{ $eq: ["$attendance.status", "WORKING"] }, 1, 0] } },
          completedCount: {
            $sum: {
              $cond: [
                { $or: [{ $eq: ["$attendance.isFinalPunchOut", true] }, { $eq: ["$attendance.adminPunchOut", true] }] },
                1, 0
              ]
            }
          },
          onBreakCount: { $sum: { $cond: [{ $eq: ["$attendance.isOnBreak", true] }, 1, 0] } },
          presentIds: { $push: "$employeeId" }
        }
      }
    ];

    const results = await Attendance.aggregate(pipeline);
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.json({ workingCount: 0, completedCount: 0, onBreakCount: 0, presentIds: [] });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Paginated Daily Log: Detailed table view with search (scoped to admin)
 */
router.get('/admin/daily-log', onlyAdmin, async (req, res) => {
  try {
    const { start, end, page = 1, limit = 10, search = '' } = req.query;

    const pipeline = [
      { $match: { adminId: req.user._id } },
      { $unwind: "$attendance" },
      { $match: { "attendance.date": { $gte: start, $lte: end } } }
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { employeeName: { $regex: search, $options: "i" } },
            { employeeId: { $regex: search, $options: "i" } }
          ]
        }
      });
    }

    pipeline.push({
      $project: {
        employeeId: 1,
        employeeName: 1,
        date: "$attendance.date",
        punchIn: "$attendance.punchIn",
        punchOut: "$attendance.punchOut",
        punchInLocation: "$attendance.punchInLocation",
        punchOutLocation: "$attendance.punchOutLocation",
        sessions: { $ifNull: ["$attendance.sessions", []] },
        isOnBreak: { $ifNull: ["$attendance.isOnBreak", false] },
        breakCount: { $size: { $ifNull: ["$attendance.breakSessions", []] } },
        workedHours: { $ifNull: ["$attendance.workedHours", 0] },
        workedMinutes: { $ifNull: ["$attendance.workedMinutes", 0] },
        workedSeconds: { $ifNull: ["$attendance.workedSeconds", 0] },
        totalBreakSeconds: { $ifNull: ["$attendance.totalBreakSeconds", 0] },
        displayTime: { $ifNull: ["$attendance.displayTime", "0h 0m 0s"] },
        status: { $ifNull: ["$attendance.status", "NOT_STARTED"] },
        isFinalPunchOut: { $ifNull: ["$attendance.isFinalPunchOut", false] },
        adminPunchOut: { $ifNull: ["$attendance.adminPunchOut", false] },
        adminPunchOutBy: { $ifNull: ["$attendance.adminPunchOutBy", null] },
        adminPunchOutTimestamp: { $ifNull: ["$attendance.adminPunchOutTimestamp", null] },
        loginStatus: { $ifNull: ["$attendance.loginStatus", "NOT_APPLICABLE"] },
        workedStatus: { $ifNull: ["$attendance.workedStatus", "NOT_APPLICABLE"] },
        lateCorrectionRequest: { $ifNull: ["$attendance.lateCorrectionRequest", null] },
        statusCorrectionRequest: { $ifNull: ["$attendance.statusCorrectionRequest", null] },
        _id: { $ifNull: ["$attendance._id", { $concat: ["$employeeId", "-", "$attendance.date"] }] }
      }
    });

    pipeline.push({ $sort: { date: -1, punchIn: -1 } });

    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: skip }, { $limit: parseInt(limit) }]
      }
    });

    const results = await Attendance.aggregate(pipeline);
    const total = results[0].metadata[0] ? results[0].metadata[0].total : 0;
    const paginatedData = results[0].data;

    res.status(200).json({ data: paginatedData, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Break History: Fetch break sessions for a specific employee/day (scoped to admin)
 */
router.get('/admin/breaks/:employeeId/:date', onlyAdmin, async (req, res) => {
  try {
    const { employeeId, date } = req.params;
    const record = await Attendance.findOne(
      { employeeId, adminId: req.user._id },
      { attendance: { $elemMatch: { date: date } } }
    );
    if (!record || !record.attendance || record.attendance.length === 0) {
      return res.status(200).json([]);
    }
    res.status(200).json(record.attendance[0].breakSessions || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Employee Batch Detail: Used for Modals/Reports for specific employees (scoped to admin)
 */
router.post('/admin/date-range-for-employees', onlyAdmin, async (req, res) => {
  try {
    const { start, end, employeeIds } = req.body;
    if (!start || !end || !employeeIds || !Array.isArray(employeeIds)) {
      return res.status(400).json({ message: "Invalid parameters" });
    }

    const records = await Attendance.aggregate([
      { $match: { adminId: req.user._id, employeeId: { $in: employeeIds } } },
      { $unwind: "$attendance" },
      { $match: { "attendance.date": { $gte: start, $lte: end } } },
      {
        $project: {
          employeeId: 1,
          employeeName: 1,
          date: "$attendance.date",
          punchIn: "$attendance.punchIn",
          punchOut: "$attendance.punchOut",
          status: "$attendance.status",
          isFinalPunchOut: "$attendance.isFinalPunchOut",
          adminPunchOut: "$attendance.adminPunchOut",
          loginStatus: "$attendance.loginStatus",
          workedStatus: "$attendance.workedStatus",
          displayTime: { $ifNull: ["$attendance.displayTime", "0h 0m 0s"] },
          workedHours: { $ifNull: ["$attendance.workedHours", 0] },
          workedMinutes: { $ifNull: ["$attendance.workedMinutes", 0] },
          workedSeconds: { $ifNull: ["$attendance.workedSeconds", 0] },
          totalBreakSeconds: { $ifNull: ["$attendance.totalBreakSeconds", 0] },
          isOnBreak: { $ifNull: ["$attendance.isOnBreak", false] },
          sessions: { $ifNull: ["$attendance.sessions", []] }
        }
      }
    ]);
    res.status(200).json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Filtered Status List: Get list of employees based on current status (scoped to admin)
 */
router.get('/admin/daily-status-list', onlyAdmin, async (req, res) => {
  try {
    const { date, type } = req.query;

    const pipeline = [
      { $match: { adminId: req.user._id } },
      { $unwind: "$attendance" },
      { $match: { "attendance.date": date } }
    ];

    if (type === 'WORKING') {
      pipeline.push({ $match: { "attendance.status": "WORKING" } });
    } else if (type === 'COMPLETED') {
      pipeline.push({
        $match: {
          $or: [{ "attendance.isFinalPunchOut": true }, { "attendance.adminPunchOut": true }]
        }
      });
    } else if (type === 'ON_BREAK') {
      pipeline.push({ $match: { "attendance.isOnBreak": true } });
    }

    pipeline.push({
      $project: {
        employeeId: 1,
        employeeName: 1,
        displayLoginStatus: "$attendance.loginStatus",
        workedStatus: "$attendance.workedStatus",
        breakSessions: "$attendance.breakSessions"
      }
    });

    const list = await Attendance.aggregate(pipeline);
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * All Status Correction Requests (scoped to admin)
 */
router.get('/admin/status-correction-requests', onlyAdmin, async (req, res) => {
  try {
    const allRecords = await Attendance.find({ adminId: req.user._id });
    const requests = [];

    allRecords.forEach(empRecord => {
      empRecord.attendance.forEach(dayLog => {
        if (
          dayLog.statusCorrectionRequest &&
          dayLog.statusCorrectionRequest.hasRequest &&
          dayLog.statusCorrectionRequest.status === "PENDING"
        ) {
          requests.push({
            employeeId: empRecord.employeeId,
            employeeName: empRecord.employeeName,
            date: dayLog.date,
            punchIn: dayLog.punchIn,
            currentStatus: dayLog.status,
            requestedPunchOut: dayLog.statusCorrectionRequest.requestedPunchOut,
            reason: dayLog.statusCorrectionRequest.reason,
            status: dayLog.statusCorrectionRequest.status
          });
        }
      });
    });

    requests.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ==========================================================
   7. UTILITIES (DATE & TIME)
   ========================================================== */

const getToday = () => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
};

const getYesterdayDate = () => {
  const date = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  date.setDate(date.getDate() - 1);
  return date.toLocaleDateString("en-CA");
};

const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

const addMinutesToTime = (timeStr, minutesToAdd) => {
  const total = timeToMinutes(timeStr) + minutesToAdd;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const getTimeDifferenceInMinutes = (punchIn, shiftStart) => {
  const t = new Date(punchIn);
  return t.getHours() * 60 + t.getMinutes() - timeToMinutes(shiftStart);
};


/* ==========================================================
   8. CORE PUNCH-IN LOGIC
   ========================================================== */

router.post('/punch-in', async (req, res) => {
  try {
    const { employeeId, employeeName, latitude, longitude } = req.body;

    if (!employeeId || !employeeName)
      return res.status(400).json({ message: 'Employee ID & Name required' });

    if (!validateCoordinates(latitude, longitude))
      return res.status(400).json({ message: "Invalid coordinates" });

    const today = getToday();
    const now = new Date();

    // Fetch shift (include isActive check from old code)
    let shift = await Shift.findOne({ employeeId, isActive: true });
    if (!shift) {
      shift = {
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
        lateGracePeriod: 15,
        autoExtendShift: true,
        fullDayHours: 8,
        halfDayHours: 4,
        quarterDayHours: 2,
        weeklyOffDays: [0]
      };
    }

    let attendance = await Attendance.findOne({ employeeId });
    if (!attendance) {
      // Inject hierarchy fields (adminId, companyId) preserved from old code
      attendance = new Attendance({
        adminId: req.user.adminId,
        companyId: req.user.company,
        employeeId,
        employeeName,
        attendance: []
      });
    }

    // --- Absence Notification Logic (Check Yesterday) ---
    const yesterday = getYesterdayDate();
    const todayRecordCheck = attendance.attendance.find(a => a.date === today);
    const isFirstPunchInToday = !todayRecordCheck || (todayRecordCheck.sessions && todayRecordCheck.sessions.length === 0);

    if (isFirstPunchInToday) {
      const yesterdayRecord = attendance.attendance.find(a => a.date === yesterday);

      if (!yesterdayRecord) {
        const yesterdayDateObj = new Date(yesterday);
        const dayNum = yesterdayDateObj.getUTCDay();

        let isWeekOff = false;
        if (shift.weeklyOffDays && Array.isArray(shift.weeklyOffDays)) {
          isWeekOff = shift.weeklyOffDays.includes(dayNum);
        } else if (shift.weekOffs && Array.isArray(shift.weekOffs)) {
          const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          const yesterdayDayName = daysOfWeek[dayNum];
          isWeekOff = shift.weekOffs.some(off =>
            String(off).toLowerCase() === yesterdayDayName.toLowerCase() || off === dayNum
          );
        } else {
          isWeekOff = (dayNum === 0);
        }

        // Check if yesterday was a Holiday
        const startOfYest = new Date(`${yesterday}T00:00:00.000Z`);
        const endOfYest   = new Date(`${yesterday}T23:59:59.999Z`);
        const isHoliday = await Holiday.findOne({
          startDate: { $lte: endOfYest },
          endDate:   { $gte: startOfYest }
        });

        const approvedLeaveYesterday = await LeaveRequest.findOne({
          employeeId: String(employeeId).trim(),
          status: "Approved",
          "details.date": yesterday
        });

        if (!isWeekOff && !isHoliday && !approvedLeaveYesterday && req.user && req.user.email) {
          sendUninformedAbsenceEmail(req.user.email, employeeName, yesterday);
        }
      }
    }

    // --- Today's Leave / WeekOff Logic ---
    const approvedLeaveToday = await LeaveRequest.findOne({
      employeeId: String(employeeId).trim(),
      status: "Approved",
      "details.date": today,
    }).lean();

    if (approvedLeaveToday) {
      if (approvedLeaveToday.leaveDayType === "Full Day") {
        return res.status(403).json({ success: false, message: "Punch-in not allowed. You are on approved leave today." });
      }
      if (approvedLeaveToday.leaveDayType === "Half Day") {
        const hour = now.getHours();
        if (approvedLeaveToday.halfDaySession === "Morning" && hour < 13) {
          return res.status(403).json({ success: false, message: "Morning half-day leave. Punch-in allowed after 1 PM." });
        }
        if (approvedLeaveToday.halfDaySession === "Afternoon" && hour >= 13) {
          return res.status(403).json({ success: false, message: "Afternoon half-day leave. Punch-in not allowed after 1 PM." });
        }
      }
    }

    // --- Week Off check for today ---
    const todayDayNum = new Date(today + "T00:00:00").getDay();
    let isTodayWeekOff = false;
    if (shift.weeklyOffDays && Array.isArray(shift.weeklyOffDays)) {
      isTodayWeekOff = shift.weeklyOffDays.includes(todayDayNum);
    } else if (shift.weekOffs && Array.isArray(shift.weekOffs)) {
      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const todayDayName = daysOfWeek[todayDayNum];
      isTodayWeekOff = shift.weekOffs.some(off =>
        String(off).toLowerCase() === todayDayName.toLowerCase() || off === todayDayNum
      );
    } else {
      isTodayWeekOff = (todayDayNum === 0);
    }

    if (isTodayWeekOff) {
      const approvedOT = await Overtime.findOne({ employeeId: String(employeeId), date: today, status: "APPROVED" });
      if (!approvedOT) {
        return res.status(403).json({
          success: false,
          isWeekOff: true,
          message: "Today is your Week Off. Punch-in is not allowed. If you want to work, please apply for Overtime and contact your admin to approve it."
        });
      }
    }

    // --- Recording the Punch-In ---
    let address = "Unknown Location";
    try { address = await reverseGeocode(latitude, longitude); } catch {}

    let todayRecord = attendance.attendance.find(a => a.date === today);

    if (!todayRecord) {
      const diffMin = getTimeDifferenceInMinutes(now, shift.shiftStartTime);
      const isLate = diffMin > shift.lateGracePeriod;

      let adjustedShiftEnd = shift.shiftEndTime;
      if (isLate && shift.autoExtendShift) {
        adjustedShiftEnd = addMinutesToTime(shift.shiftEndTime, diffMin - shift.lateGracePeriod);
      }

      todayRecord = {
        date: today,
        punchIn: now,
        punchOut: null,
        punchInLocation: { latitude, longitude, address, timestamp: now },
        sessions: [{ punchIn: now, punchOut: null, durationSeconds: 0 }],
        workedHours: 0,
        workedMinutes: 0,
        workedSeconds: 0,
        totalBreakSeconds: 0,
        displayTime: "0h 0m 0s",
        status: "WORKING",
        loginStatus: isLate ? "LATE" : "ON_TIME",
      };
      attendance.attendance.push(todayRecord);
    } else {
      if (todayRecord.workedStatus === "FULL_DAY") {
        return res.status(400).json({ message: "Your shift is completed. You cannot punch in again today." });
      }
      if (todayRecord.isFinalPunchOut) {
        return res.status(400).json({ message: "You have punched out for the day. Re-punch-in is not allowed after a final punch out." });
      }
      if (todayRecord.status === "WORKING") {
        return res.status(400).json({ message: "You are already Punched In." });
      }

      const lastSession = todayRecord.sessions[todayRecord.sessions.length - 1];
      if (lastSession && lastSession.punchOut) {
        const breakDiff = (now - new Date(lastSession.punchOut)) / 1000;
        todayRecord.totalBreakSeconds = (todayRecord.totalBreakSeconds || 0) + breakDiff;
      }

      // Close break session if open
      if (todayRecord.isOnBreak && todayRecord.breakSessions && todayRecord.breakSessions.length > 0) {
        const openBreak = [...todayRecord.breakSessions].reverse().find(b => !b.to);
        if (openBreak) {
          openBreak.to = now;
          openBreak.durationSeconds = (now - new Date(openBreak.from)) / 1000;
        }
      }
      todayRecord.isOnBreak = false;

      todayRecord.sessions.push({ punchIn: now, punchOut: null, durationSeconds: 0 });
      todayRecord.status = "WORKING";
      todayRecord.punchOut = null;
    }

    await attendance.save();
    return res.json({
      success: true,
      message: "Punch-in successful",
      data: attendance.attendance.find(a => a.date === today),
    });

  } catch (err) {
    console.error("Punch-in error:", err);
    res.status(500).json({ error: err.message });
  }
});


/* ==========================================================
   9. CORE PUNCH-OUT LOGIC
   ========================================================== */

router.post('/punch-out', async (req, res) => {
  try {
    const { employeeId, latitude, longitude } = req.body;
    if (!employeeId) return res.status(400).json({ message: "Employee ID required" });

    const today = getToday();
    const now = new Date();

    let attendance = await Attendance.findOne({ employeeId });
    if (!attendance) return res.status(404).json({ message: "No record found" });

    let todayRecord = attendance.attendance.find(a => a.date === today);
    if (!todayRecord) return res.status(400).json({ message: "No attendance record for today" });

    const sessions = todayRecord.sessions || [];
    const currentSession = sessions.find(s => !s.punchOut);

    if (!currentSession) {
      return res.status(400).json({ message: "You are already Punched Out." });
    }

    // Close current session
    currentSession.punchOut = now;
    currentSession.durationSeconds = (new Date(now) - new Date(currentSession.punchIn)) / 1000;

    todayRecord.punchOut = now;
    todayRecord.punchOutLocation = { latitude, longitude, timestamp: now };
    todayRecord.status = "COMPLETED";
    todayRecord.isFinalPunchOut = true;
    todayRecord.isOnBreak = false;

    // Recalculate total worked time from all sessions
    let totalSeconds = 0;
    todayRecord.sessions.forEach(sess => {
      if (sess.punchIn && sess.punchOut) {
        totalSeconds += (new Date(sess.punchOut) - new Date(sess.punchIn)) / 1000;
      }
    });

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    todayRecord.workedHours = h;
    todayRecord.workedMinutes = m;
    todayRecord.workedSeconds = s;
    todayRecord.displayTime = `${h}h ${m}m ${s}s`;

    // Classification
    let shift = await Shift.findOne({ employeeId });
    if (!shift) shift = { fullDayHours: 8, halfDayHours: 4, quarterDayHours: 2 };

    let attendanceCategory = "ABSENT";
    let workedStatus = "ABSENT";

    if (h >= shift.fullDayHours)         { attendanceCategory = "FULL_DAY"; workedStatus = "FULL_DAY"; }
    else if (h >= shift.halfDayHours)    { attendanceCategory = "HALF_DAY"; workedStatus = "HALF_DAY"; }
    else if (h >= (shift.quarterDayHours || 2)) { workedStatus = "HALF_DAY"; }

    todayRecord.workedStatus = workedStatus;
    todayRecord.attendanceCategory = attendanceCategory;

    await attendance.save();

    // Shortage Email Check
    if (h < shift.fullDayHours && req.user && req.user.email) {
      const emailData = {
        employeeName: attendance.employeeName,
        date: today,
        punchIn: todayRecord.punchIn,
        punchOut: todayRecord.punchOut,
        workedHours: h,
        workedMinutes: m,
        workedSeconds: s,
        requiredHours: shift.fullDayHours,
        loginStatus: todayRecord.loginStatus || 'ON_TIME',
        workedStatus: todayRecord.workedStatus
      };

      if (todayRecord.workedStatus === "ABSENT") {
        sendMissingAttendanceEmail(req.user.email, emailData);
      } else if (todayRecord.workedStatus === "HALF_DAY") {
        sendInsufficientHoursEmail(req.user.email, emailData);
      }
    }

    res.json({ success: true, message: `Punched out. Total: ${h}h ${m}m`, data: todayRecord });

  } catch (err) {
    console.error("Punch-out error:", err);
    res.status(500).json({ error: err.message });
  }
});


/* ==========================================================
   10. BREAK (LUNCH/REST) LOGIC
   ========================================================== */

router.post('/punch-break', async (req, res) => {
  try {
    const { employeeId, latitude, longitude } = req.body;
    if (!employeeId) return res.status(400).json({ message: "Employee ID required" });

    const today = getToday();
    const now = new Date();

    let attendance = await Attendance.findOne({ employeeId });
    if (!attendance) return res.status(404).json({ message: "No record found" });

    let todayRecord = attendance.attendance.find(a => a.date === today);
    if (!todayRecord) return res.status(400).json({ message: "No attendance record for today" });

    const currentSession = (todayRecord.sessions || []).find(s => !s.punchOut);
    if (!currentSession) {
      return res.status(400).json({ message: "You are already on a break." });
    }

    currentSession.punchOut = now;
    currentSession.durationSeconds = (new Date(now) - new Date(currentSession.punchIn)) / 1000;

    todayRecord.punchOut = now;
    if (latitude && longitude) {
      todayRecord.punchOutLocation = { latitude, longitude, timestamp: now };
    }
    todayRecord.status = "COMPLETED";
    todayRecord.isFinalPunchOut = false;
    todayRecord.isOnBreak = true;

    if (!todayRecord.breakSessions) todayRecord.breakSessions = [];
    todayRecord.breakSessions.push({ from: now, to: null, durationSeconds: 0 });

    // Calculate time so far
    let totalSeconds = 0;
    todayRecord.sessions.forEach(sess => {
      if (sess.punchIn && sess.punchOut) {
        totalSeconds += (new Date(sess.punchOut) - new Date(sess.punchIn)) / 1000;
      }
    });

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    todayRecord.workedHours = h;
    todayRecord.workedMinutes = m;
    todayRecord.workedSeconds = s;
    todayRecord.displayTime = `${h}h ${m}m ${s}s`;

    let shift = await Shift.findOne({ employeeId });
    if (!shift) shift = { fullDayHours: 8, halfDayHours: 4, quarterDayHours: 2 };

    let attendanceCategory = "ABSENT";
    let workedStatus = "ABSENT";

    if (h >= shift.fullDayHours)         { attendanceCategory = "FULL_DAY"; workedStatus = "FULL_DAY"; }
    else if (h >= shift.halfDayHours)    { attendanceCategory = "HALF_DAY"; workedStatus = "HALF_DAY"; }
    else if (h >= (shift.quarterDayHours || 2)) { workedStatus = "HALF_DAY"; }

    todayRecord.workedStatus = workedStatus;
    todayRecord.attendanceCategory = attendanceCategory;

    await attendance.save();
    res.json({ success: true, message: `Break started. Worked so far: ${h}h ${m}m`, data: todayRecord });

  } catch (err) {
    console.error("Punch-break error:", err);
    res.status(500).json({ error: err.message });
  }
});


/* ==========================================================
   11. ADMIN MANUAL PUNCH-OUT (Scoped to admin)
   ========================================================== */

router.post('/admin-punch-out', onlyAdmin, async (req, res) => {
  try {
    const { employeeId, punchOutTime, latitude, longitude, date } = req.body;

    if (!employeeId || !punchOutTime || !date) {
      return res.status(400).json({ message: "Employee ID, Punch Out Time and Date are required" });
    }

    const punchOutDateObj = new Date(punchOutTime);

    // Scoped: ensure Admin owns this record
    let attendance = await Attendance.findOne({ employeeId, adminId: req.user._id });
    if (!attendance) return res.status(404).json({ message: "No attendance record found for this employee" });

    let targetDateStr = date;
    if (date.includes("T")) targetDateStr = date.split("T")[0];

    let dayRecord = attendance.attendance.find(a => a.date === targetDateStr);
    if (!dayRecord) {
      return res.status(400).json({ message: `No attendance entry found for date: ${targetDateStr}` });
    }

    const sessions = dayRecord.sessions || [];
    const openSession = sessions.find(s => !s.punchOut);

    if (openSession) {
      openSession.punchOut = punchOutDateObj;
      openSession.durationSeconds = (punchOutDateObj - new Date(openSession.punchIn)) / 1000;
    }

    dayRecord.punchOut = punchOutDateObj;
    dayRecord.punchOutLocation = {
      latitude: latitude || 0,
      longitude: longitude || 0,
      address: "Admin Force Logout",
      timestamp: new Date()
    };
    dayRecord.status = "COMPLETED";
    dayRecord.adminPunchOut = true;
    dayRecord.adminPunchOutBy = req.user.name;
    dayRecord.adminPunchOutTimestamp = new Date();
    dayRecord.isFinalPunchOut = true;
    dayRecord.isOnBreak = false;

    let totalSeconds = 0;
    dayRecord.sessions.forEach(sess => {
      if (sess.punchIn && sess.punchOut) {
        totalSeconds += (new Date(sess.punchOut) - new Date(sess.punchIn)) / 1000;
      }
    });

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    dayRecord.workedHours = h;
    dayRecord.workedMinutes = m;
    dayRecord.workedSeconds = s;
    dayRecord.displayTime = `${h}h ${m}m ${s}s`;

    let shift = await Shift.findOne({ employeeId });
    if (!shift) shift = { fullDayHours: 8, halfDayHours: 4, quarterDayHours: 2 };

    let workedStatus = "ABSENT";
    if (h >= shift.fullDayHours)      workedStatus = "FULL_DAY";
    else if (h >= shift.halfDayHours) workedStatus = "HALF_DAY";
    else if (h >= (shift.quarterDayHours || 2)) workedStatus = "HALF_DAY";

    dayRecord.workedStatus = workedStatus;
    dayRecord.attendanceCategory = workedStatus === "FULL_DAY" ? "FULL_DAY" : (workedStatus === "HALF_DAY" ? "HALF_DAY" : "ABSENT");

    await attendance.save();
    res.json({ success: true, message: "Employee punched out by Admin successfully", data: dayRecord });

  } catch (err) {
    console.error("Admin Punch Out Error:", err);
    res.status(500).json({ error: err.message });
  }
});


/* ==========================================================
   12. CORRECTION REQUESTS (LATE & STATUS)
   ========================================================== */

/**
 * Submit Request for Late Login correction (3/month limit)
 */
router.post('/request-correction', async (req, res) => {
  try {
    const { employeeId, date, time, reason } = req.body;
    let attendance = await Attendance.findOne({ employeeId });
    if (!attendance) return res.status(404).json({ message: "Attendance record not found" });

    const now = new Date();
    const currentYearMonth = now.toISOString().slice(0, 7);

    const monthlyRequestCount = attendance.attendance.filter(day =>
      day.date.startsWith(currentYearMonth) &&
      day.lateCorrectionRequest?.hasRequest === true
    ).length;

    if (monthlyRequestCount >= 3) {
      return res.status(400).json({
        success: false,
        message: "Monthly limit reached. You can only submit 3 login correction requests per month."
      });
    }

    let dayRecord = attendance.attendance.find(a => a.date === date);
    if (!dayRecord) return res.status(400).json({ message: "No attendance found for this date." });

    if (dayRecord.lateCorrectionRequest?.hasRequest) {
      return res.status(400).json({ message: "A request for this date has already been submitted." });
    }

    const requestedDateObj = new Date(`${date}T${time}:00`);

    dayRecord.lateCorrectionRequest = {
      hasRequest: true,
      status: "PENDING",
      requestedTime: requestedDateObj,
      reason: reason
    };

    await attendance.save();
    res.json({ success: true, message: `Request sent to Admin. (${monthlyRequestCount + 1}/3 used this month)` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Submit Late Correction (limit-based flow used by employee portal)
 */
router.post("/submit-late-correction", async (req, res) => {
  try {
    const { employeeId, date, requestedTime, reason } = req.body;
    const attendanceRecord = await Attendance.findOne({ employeeId });
    if (!attendanceRecord) return res.status(404).json({ message: "Employee not found" });

    const dayLog = attendanceRecord.attendance.find(a => a.date === date);
    if (!dayLog) return res.status(404).json({ message: "Attendance record not found" });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthData = attendanceRecord.monthlyRequestLimits?.get(currentMonth) || { limit: 5, used: 0 };

    if (monthData.used >= monthData.limit)
      return res.status(400).json({ message: "Monthly limit reached", limitReached: true });

    dayLog.lateCorrectionRequest = {
      hasRequest: true,
      status: "PENDING",
      requestedTime: new Date(requestedTime),
      reason,
    };

    attendanceRecord.monthlyRequestLimits.set(currentMonth, { limit: monthData.limit, used: monthData.used + 1 });
    await attendanceRecord.save();
    res.json({ success: true, message: "Request submitted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Submit Request for Punch-Out Correction (Status Correction)
 */
router.post('/request-status-correction', async (req, res) => {
  try {
    const { employeeId, date, requestedPunchOut, reason } = req.body;

    if (!employeeId || !date || !requestedPunchOut || !reason) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const attendance = await Attendance.findOne({ employeeId });
    if (!attendance) return res.status(404).json({ message: "Attendance record not found" });

    const dayRecord = attendance.attendance.find(a => a.date === date);
    if (!dayRecord) return res.status(404).json({ message: "No attendance record found for this date" });
    if (!dayRecord.punchIn) return res.status(400).json({ message: "No punch-in found for this date" });

    if (dayRecord.statusCorrectionRequest?.hasRequest && dayRecord.statusCorrectionRequest?.status === "PENDING") {
      return res.status(400).json({ message: "A correction request for this date is already pending" });
    }

    const requestedPunchOutDate = new Date(requestedPunchOut);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const utcDate = new Date(requestedPunchOutDate.getTime() - istOffset);

    if (utcDate <= new Date(dayRecord.punchIn)) {
      return res.status(400).json({
        message: "Requested punch-out time must be after your punch-in time. Please check the time you entered."
      });
    }

    dayRecord.statusCorrectionRequest = {
      hasRequest: true,
      status: "PENDING",
      requestedPunchOut: utcDate,
      reason: reason
    };

    await attendance.save();
    res.json({ success: true, message: "Correction request submitted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ==========================================================
   13. ADMIN APPROVALS (Scoped to admin)
   ========================================================== */

/**
 * Admin: Approve or Reject Late Correction
 */
router.post('/approve-correction', onlyAdmin, async (req, res) => {
  try {
    const { employeeId, date, status, adminComment } = req.body;

    let attendance = await Attendance.findOne({ employeeId, adminId: req.user._id });
    if (!attendance) return res.status(404).json({ message: "Record not found" });

    let dayRecord = attendance.attendance.find(a => a.date === date);
    if (!dayRecord || !dayRecord.lateCorrectionRequest?.hasRequest) {
      return res.status(400).json({ message: "No pending request found." });
    }

    if (status === "REJECTED") {
      dayRecord.lateCorrectionRequest.status = "REJECTED";
      dayRecord.lateCorrectionRequest.adminComment = adminComment;
    } else if (status === "APPROVED") {
      const newPunchIn = new Date(dayRecord.lateCorrectionRequest.requestedTime);
      dayRecord.lateCorrectionRequest.status = "APPROVED";
      dayRecord.lateCorrectionRequest.adminComment = adminComment;

      dayRecord.punchIn = newPunchIn;
      if (dayRecord.sessions.length > 0) {
        dayRecord.sessions[0].punchIn = newPunchIn;
        if (dayRecord.sessions[0].punchOut) {
          dayRecord.sessions[0].durationSeconds = (new Date(dayRecord.sessions[0].punchOut) - newPunchIn) / 1000;
        }
      }

      let shift = await Shift.findOne({ employeeId });
      if (!shift) shift = { shiftStartTime: "09:00", lateGracePeriod: 15 };
      const diffMin = getTimeDifferenceInMinutes(newPunchIn, shift.shiftStartTime);
      dayRecord.loginStatus = diffMin <= shift.lateGracePeriod ? "ON_TIME" : "LATE";

      // Recalculate worked time
      let totalSeconds = 0;
      dayRecord.sessions.forEach(sess => {
        if (sess.punchIn && sess.punchOut) {
          totalSeconds += (new Date(sess.punchOut) - new Date(sess.punchIn)) / 1000;
        }
      });

      if (dayRecord.status === "COMPLETED") {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);
        dayRecord.workedHours = h;
        dayRecord.workedMinutes = m;
        dayRecord.workedSeconds = s;
        dayRecord.displayTime = `${h}h ${m}m ${s}s`;
      }
    }

    await attendance.save();
    res.json({ success: true, message: `Request ${status.toLowerCase()} successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Admin: Approve Status Correction (scoped to admin)
 */
router.post('/approve-status-correction', onlyAdmin, async (req, res) => {
  try {
    const { employeeId, date, adminComment } = req.body;

    const attendance = await Attendance.findOne({ employeeId, adminId: req.user._id });
    if (!attendance) return res.status(404).json({ message: "Attendance record not found" });

    const dayRecord = attendance.attendance.find(a => a.date === date);
    if (!dayRecord) return res.status(404).json({ message: "No attendance record found for this date" });
    if (!dayRecord.statusCorrectionRequest?.hasRequest) {
      return res.status(404).json({ message: "No correction request found for this date" });
    }

    const newPunchOut = new Date(dayRecord.statusCorrectionRequest.requestedPunchOut);
    const punchInTime = new Date(dayRecord.punchIn);

    if (newPunchOut <= punchInTime) {
      return res.status(400).json({
        message: "Cannot approve: requested punch-out time is not after the employee's punch-in time. Please reject and ask the employee to resubmit."
      });
    }

    dayRecord.punchOut = newPunchOut;
    dayRecord.isFinalPunchOut = true;
    dayRecord.status = "COMPLETED";

    if (dayRecord.sessions && dayRecord.sessions.length > 0) {
      const lastSession = dayRecord.sessions[dayRecord.sessions.length - 1];
      lastSession.punchOut = newPunchOut;
      const sessDuration = (newPunchOut - new Date(lastSession.punchIn)) / 1000;
      lastSession.durationSeconds = sessDuration > 0 ? sessDuration : 0;
    }

    let totalSeconds = 0;
    dayRecord.sessions.forEach(sess => {
      if (sess.punchIn && sess.punchOut) {
        const dur = (new Date(sess.punchOut) - new Date(sess.punchIn)) / 1000;
        if (dur > 0) totalSeconds += dur;
      }
    });

    if (totalSeconds <= 0) {
      const rawSeconds = (newPunchOut - punchInTime) / 1000;
      const breakSeconds = dayRecord.totalBreakSeconds || 0;
      totalSeconds = Math.max(0, rawSeconds - breakSeconds);
    }

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    dayRecord.workedHours = h;
    dayRecord.workedMinutes = m;
    dayRecord.workedSeconds = s;
    dayRecord.displayTime = `${h}h ${m}m ${s}s`;

    let shift = await Shift.findOne({ employeeId });
    if (!shift) shift = { fullDayHours: 8, halfDayHours: 4, quarterDayHours: 2 };

    let workedStatus = "ABSENT";
    let attendanceCategory = "ABSENT";

    if (h >= shift.fullDayHours)                  { workedStatus = "FULL_DAY";    attendanceCategory = "FULL_DAY"; }
    else if (h >= shift.halfDayHours)             { workedStatus = "HALF_DAY";    attendanceCategory = "HALF_DAY"; }
    else if (h >= (shift.quarterDayHours || 2))   { workedStatus = "QUARTER_DAY"; attendanceCategory = "ABSENT"; }

    dayRecord.workedStatus = workedStatus;
    dayRecord.attendanceCategory = attendanceCategory;
    dayRecord.statusCorrectionRequest.status = "APPROVED";
    dayRecord.statusCorrectionRequest.adminComment = adminComment || "Approved by Admin";

    await attendance.save();
    res.json({
      success: true,
      message: `Attendance corrected. Worked: ${h}h ${m}m ${s}s → Status: ${workedStatus}`,
      data: { employeeId, date, updatedRecord: dayRecord }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Admin: Reject Status Correction (scoped to admin)
 */
router.post('/reject-status-correction', onlyAdmin, async (req, res) => {
  try {
    const { employeeId, date, adminComment } = req.body;
    const attendance = await Attendance.findOne({ employeeId, adminId: req.user._id });
    if (!attendance) return res.status(404).json({ message: "Attendance record not found" });

    const dayRecord = attendance.attendance.find(a => a.date === date);
    if (!dayRecord || !dayRecord.statusCorrectionRequest) {
      return res.status(404).json({ message: "No request found for this date" });
    }
    dayRecord.statusCorrectionRequest.status = "REJECTED";
    dayRecord.statusCorrectionRequest.adminComment = adminComment || "Rejected by Admin";
    await attendance.save();
    res.json({ success: true, message: "Request rejected successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ==========================================================
   14. FETCHING DATA & REQUEST LIMITS
   ========================================================== */

/**
 * Get Specific Employee Record (scoped — admin sees own employees, employee sees own)
 */
router.get('/:employeeId', async (req, res) => {
  try {
    const requestedId = req.params.employeeId;
    const loggedUser = req.user;
    if (loggedUser.role !== "admin" && loggedUser.employeeId !== requestedId) {
      return res.status(403).json({ message: "Access denied." });
    }
    const record = await Attendance.findOne({ employeeId: requestedId });
    if (!record) return res.json({ success: true, data: [] });
    const sorted = record.attendance.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, data: sorted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get Monthly Correction Request Limit
 */
router.get("/request-limit/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const attendanceRecord = await Attendance.findOne({ employeeId });
    if (!attendanceRecord) return res.status(404).json({ message: "Employee not found" });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthData = attendanceRecord.monthlyRequestLimits?.get(currentMonth) || { limit: 5, used: 0 };

    res.json({
      employeeId,
      employeeName: attendanceRecord.employeeName,
      monthlyRequestLimits: { [currentMonth]: monthData }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/**
 * Set Request Limit (Admin — scoped to admin)
 */
router.post("/set-request-limit", onlyAdmin, async (req, res) => {
  try {
    const { employeeId, limit } = req.body;
    if (!employeeId || limit === undefined)
      return res.status(400).json({ message: "Employee ID and limit are required" });

    const attendanceRecord = await Attendance.findOne({ employeeId, adminId: req.user._id });
    if (!attendanceRecord) return res.status(404).json({ message: "Employee not found" });

    const currentMonth = new Date().toISOString().slice(0, 7);
    if (!attendanceRecord.monthlyRequestLimits) attendanceRecord.monthlyRequestLimits = new Map();

    const currentData = attendanceRecord.monthlyRequestLimits.get(currentMonth) || { limit: 5, used: 0 };
    if (limit < currentData.used)
      return res.status(400).json({ message: `Cannot set limit lower than used requests.` });

    attendanceRecord.monthlyRequestLimits.set(currentMonth, { limit: parseInt(limit), used: currentData.used });
    await attendanceRecord.save({ validateBeforeSave: false });

    res.json({ success: true, message: "Request limit updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
// --- END OF FILE EmployeeattendanceRoutes.js ---