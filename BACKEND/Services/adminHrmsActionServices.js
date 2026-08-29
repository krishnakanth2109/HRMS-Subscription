// ============================================================================
// 🏢 ADMIN HRMS ACTION SERVICES — Universal Business Execution Engine
// All Admin Portal Write / Update / Delete / Approval Operations
// 100% Dynamic MongoDB Database Operations with Live WebSockets & Audit Logs
// ============================================================================

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import LeaveRequest from "../models/LeaveRequest.js";
import WorkModeRequest from "../models/WorkModeRequest.js";
import Expense from "../models/Expense.js";
import Overtime from "../models/Overtime.js";
import Attendance from "../models/Attendance.js";
import AttendanceRequest from "../models/AttendanceRequest.js";
import PunchOutRequest from "../models/PunchOutRequest.js";
import Employee from "../models/employeeModel.js";
import Notice from "../models/Notice.js";
import TechnicalIssue from "../models/TechnicalIssue.js";
import Resignation from "../models/Resignation.js";
import Shift from "../models/shiftModel.js";
import Holiday from "../models/Holiday.js";
import Rule from "../models/Rule.js";
import Notification from "../models/notificationModel.js";

/* =========================================================================
   1. LEAVE APPROVAL & REJECTION
========================================================================= */
export const adminServiceApproveLeave = async ({ loggedAdmin, leaveId, adminComment = "", io = null }) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  let query = { _id: leaveId };
  if (companyId) {
    query.$or = [{ adminId }, { companyId }];
  }

  const leave = await LeaveRequest.findOne(query);
  if (!leave) {
    throw new Error("Leave request not found or does not belong to your organization.");
  }

  if (leave.status === "Approved") {
    throw new Error("This leave request is already approved.");
  }

  leave.status = "Approved";
  leave.actionDate = new Date();
  if (adminComment) leave.adminComment = adminComment;
  await leave.save();

  // Create notification for employee
  try {
    const emp = await Employee.findOne({
      $or: [{ employeeId: leave.employeeId }, { _id: mongoose.isValidObjectId(leave.employeeId) ? leave.employeeId : null }],
    });
    if (emp) {
      await Notification.create({
        recipientId: emp._id,
        recipientRole: "employee",
        senderId: adminId,
        senderRole: "admin",
        type: "leave_status",
        title: "Leave Request Approved",
        message: `Your leave request for ${leave.from} to ${leave.to} (${leave.leaveType}) has been approved.`,
        relatedId: leave._id,
        companyId,
      });
    }
  } catch (notifErr) {
    console.warn("⚠️ Notification creation skipped:", notifErr.message);
  }

  if (io) {
    io.emit("hrmsLeavesUpdated", { leaveId: leave._id, status: "Approved", employeeId: leave.employeeId });
    io.emit("leave:statusChanged", { leaveId: leave._id, status: "Approved" });
  }

  return {
    success: true,
    message: `Leave request for ${leave.requesterName || leave.employeeId} (${leave.from} to ${leave.to}) approved successfully.`,
    leave,
  };
};

export const adminServiceRejectLeave = async ({ loggedAdmin, leaveId, reason = "Rejected by administrator", io = null }) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  let query = { _id: leaveId };
  if (companyId) {
    query.$or = [{ adminId }, { companyId }];
  }

  const leave = await LeaveRequest.findOne(query);
  if (!leave) {
    throw new Error("Leave request not found or does not belong to your organization.");
  }

  leave.status = "Rejected";
  leave.actionDate = new Date();
  leave.rejectionReason = reason;
  await leave.save();

  try {
    const emp = await Employee.findOne({
      $or: [{ employeeId: leave.employeeId }, { _id: mongoose.isValidObjectId(leave.employeeId) ? leave.employeeId : null }],
    });
    if (emp) {
      await Notification.create({
        recipientId: emp._id,
        recipientRole: "employee",
        senderId: adminId,
        senderRole: "admin",
        type: "leave_status",
        title: "Leave Request Rejected",
        message: `Your leave request for ${leave.from} to ${leave.to} was rejected. Reason: ${reason}`,
        relatedId: leave._id,
        companyId,
      });
    }
  } catch (notifErr) {
    console.warn("⚠️ Notification creation skipped:", notifErr.message);
  }

  if (io) {
    io.emit("hrmsLeavesUpdated", { leaveId: leave._id, status: "Rejected", employeeId: leave.employeeId });
    io.emit("leave:statusChanged", { leaveId: leave._id, status: "Rejected" });
  }

  return {
    success: true,
    message: `Leave request for ${leave.requesterName || leave.employeeId} rejected.`,
    leave,
  };
};

/* =========================================================================
   2. WFH (WORK FROM HOME) APPROVAL & REJECTION
========================================================================= */
export const adminServiceApproveWFH = async ({ loggedAdmin, requestId, adminComment = "", io = null }) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  const wfhReq = await WorkModeRequest.findOne({
    _id: requestId,
    $or: [{ adminId }, { companyId: companyId || adminId }],
  });

  if (!wfhReq) {
    throw new Error("WFH request not found or access denied.");
  }

  wfhReq.status = "Approved";
  if (adminComment) wfhReq.adminComment = adminComment;
  await wfhReq.save();

  if (io) {
    io.emit("work-mode-notification", { requestId: wfhReq._id, status: "Approved", employeeId: wfhReq.employeeId });
    io.emit("hrmsWFHUpdated", { requestId: wfhReq._id, status: "Approved" });
  }

  return {
    success: true,
    message: `WFH request for ${wfhReq.employeeName} (${wfhReq.requestedMode}) has been approved.`,
    wfhReq,
  };
};

export const adminServiceRejectWFH = async ({ loggedAdmin, requestId, reason = "Rejected by administrator", io = null }) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  const wfhReq = await WorkModeRequest.findOne({
    _id: requestId,
    $or: [{ adminId }, { companyId: companyId || adminId }],
  });

  if (!wfhReq) {
    throw new Error("WFH request not found or access denied.");
  }

  wfhReq.status = "Rejected";
  wfhReq.adminComment = reason;
  await wfhReq.save();

  if (io) {
    io.emit("work-mode-notification", { requestId: wfhReq._id, status: "Rejected", employeeId: wfhReq.employeeId });
    io.emit("hrmsWFHUpdated", { requestId: wfhReq._id, status: "Rejected" });
  }

  return {
    success: true,
    message: `WFH request for ${wfhReq.employeeName} has been rejected.`,
    wfhReq,
  };
};

/* =========================================================================
   3. EXPENSE REIMBURSEMENT APPROVAL & REJECTION
========================================================================= */
export const adminServiceApproveExpense = async ({ loggedAdmin, expenseId, allocatedAmount = null, io = null }) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  const exp = await Expense.findOne({
    _id: expenseId,
    $or: [{ adminId }, { companyId: companyId || adminId }],
  });

  if (!exp) {
    throw new Error("Expense claim not found.");
  }

  exp.status = "Approved";
  exp.actionDate = new Date();
  if (allocatedAmount !== null && !isNaN(allocatedAmount)) {
    exp.allocatedAmount = Number(allocatedAmount);
  } else {
    exp.allocatedAmount = exp.amount;
  }
  await exp.save();

  if (io) {
    io.emit("hrmsExpensesUpdated", { expenseId: exp._id, status: "Approved" });
    io.emit("expense:approved", { expenseId: exp._id });
  }

  return {
    success: true,
    message: `Expense claim of ₹${exp.allocatedAmount.toLocaleString()} (${exp.category}) for ${exp.employeeName} approved.`,
    expense: exp,
  };
};

export const adminServiceRejectExpense = async ({ loggedAdmin, expenseId, reason = "Rejected by administrator", io = null }) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  const exp = await Expense.findOne({
    _id: expenseId,
    $or: [{ adminId }, { companyId: companyId || adminId }],
  });

  if (!exp) {
    throw new Error("Expense claim not found.");
  }

  exp.status = "Rejected";
  exp.actionDate = new Date();
  await exp.save();

  if (io) {
    io.emit("hrmsExpensesUpdated", { expenseId: exp._id, status: "Rejected" });
    io.emit("expense:rejected", { expenseId: exp._id });
  }

  return {
    success: true,
    message: `Expense claim of ₹${exp.amount.toLocaleString()} for ${exp.employeeName} rejected.`,
    expense: exp,
  };
};

/* =========================================================================
   4. OVERTIME APPROVAL & REJECTION
========================================================================= */
export const adminServiceApproveOvertime = async ({ loggedAdmin, overtimeId, io = null }) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  const ot = await Overtime.findOne({
    _id: overtimeId,
    $or: [{ adminId }, { companyId: companyId || adminId }],
  });

  if (!ot) {
    throw new Error("Overtime request not found.");
  }

  ot.status = "APPROVED";
  await ot.save();

  if (io) {
    io.emit("hrmsOvertimeUpdated", { overtimeId: ot._id, status: "APPROVED" });
  }

  return {
    success: true,
    message: `Overtime claim of ${ot.hours} hours on ${ot.date} for ${ot.employeeName} approved.`,
    overtime: ot,
  };
};

export const adminServiceRejectOvertime = async ({ loggedAdmin, overtimeId, io = null }) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  const ot = await Overtime.findOne({
    _id: overtimeId,
    $or: [{ adminId }, { companyId: companyId || adminId }],
  });

  if (!ot) {
    throw new Error("Overtime request not found.");
  }

  ot.status = "REJECTED";
  await ot.save();

  if (io) {
    io.emit("hrmsOvertimeUpdated", { overtimeId: ot._id, status: "REJECTED" });
  }

  return {
    success: true,
    message: `Overtime claim of ${ot.hours} hours for ${ot.employeeName} rejected.`,
    overtime: ot,
  };
};

/* =========================================================================
   5. ATTENDANCE EXCEPTIONS: LATE LOGIN & MISSING PUNCH
========================================================================= */
export const adminServiceApproveLateLogin = async ({ loggedAdmin, attendanceId, date, io = null }) => {
  const attendance = await Attendance.findById(attendanceId);
  if (!attendance) {
    throw new Error("Attendance record not found.");
  }

  const record = attendance.attendance.find((a) => a.date === date);
  if (!record || !record.lateCorrectionRequest) {
    throw new Error(`No pending late correction found for ${date}.`);
  }

  record.lateCorrectionRequest.status = "Approved";
  record.loginStatus = "ON_TIME"; // waived late penalty
  await attendance.save();

  if (io) {
    io.emit("attendance:lateApproved", { attendanceId, date, employeeId: attendance.employeeId });
    io.emit("attendance:update", { employeeId: attendance.employeeId, date, action: "late_approved" });
  }

  return {
    success: true,
    message: `Late login justification for ${date} approved. Status updated to On-Time.`,
  };
};

export const adminServiceRejectLateLogin = async ({ loggedAdmin, attendanceId, date, io = null }) => {
  const attendance = await Attendance.findById(attendanceId);
  if (!attendance) {
    throw new Error("Attendance record not found.");
  }

  const record = attendance.attendance.find((a) => a.date === date);
  if (!record || !record.lateCorrectionRequest) {
    throw new Error(`No pending late correction found for ${date}.`);
  }

  record.lateCorrectionRequest.status = "Rejected";
  await attendance.save();

  if (io) {
    io.emit("attendance:lateRejected", { attendanceId, date, employeeId: attendance.employeeId });
  }

  return {
    success: true,
    message: `Late login justification for ${date} rejected.`,
  };
};

export const adminServiceApprovePunchOutRequest = async ({ loggedAdmin, requestId, io = null }) => {
  const req = await PunchOutRequest.findById(requestId);
  if (!req) {
    throw new Error("Missing punch-out request not found.");
  }

  req.status = "Approved";
  await req.save();

  // Apply to Attendance
  let attendance = await Attendance.findOne({
    $or: [{ employeeId: req.employeeId }, { employeeCustomId: req.employeeId }],
  });

  if (attendance) {
    let dayRecord = attendance.attendance.find((a) => a.date === req.originalDate);
    if (dayRecord) {
      dayRecord.punchOut = req.requestedPunchOut;
      dayRecord.status = "COMPLETED";
      dayRecord.isFinalPunchOut = true;
      if (dayRecord.punchIn && req.requestedPunchOut) {
        const sec = Math.max(0, (new Date(req.requestedPunchOut) - new Date(dayRecord.punchIn)) / 1000);
        dayRecord.workedHours = Math.floor(sec / 3600);
        dayRecord.workedMinutes = Math.floor((sec % 3600) / 60);
        dayRecord.workedSeconds = Math.floor(sec % 60);
        dayRecord.displayTime = `${dayRecord.workedHours}h ${dayRecord.workedMinutes}m`;
      }
      await attendance.save();
    }
  }

  if (io) {
    io.emit("attendance:punchOutRequestApproved", { requestId, employeeId: req.employeeId });
    io.emit("attendance:update", { employeeId: req.employeeId, date: req.originalDate, action: "punch_out_approved" });
  }

  return {
    success: true,
    message: `Missing punch-out request for ${req.employeeName} on ${req.originalDate} approved.`,
  };
};

export const adminServiceRejectPunchOutRequest = async ({ loggedAdmin, requestId, io = null }) => {
  const req = await PunchOutRequest.findById(requestId);
  if (!req) {
    throw new Error("Missing punch-out request not found.");
  }

  req.status = "Rejected";
  await req.save();

  if (io) {
    io.emit("attendance:punchOutRequestRejected", { requestId, employeeId: req.employeeId });
  }

  return {
    success: true,
    message: `Missing punch-out request for ${req.employeeName} rejected.`,
  };
};

export const adminServiceApproveAttendanceRequest = async ({ loggedAdmin, requestId, io = null }) => {
  const req = await AttendanceRequest.findById(requestId);
  if (!req) {
    throw new Error("Attendance request not found.");
  }

  if (req.requestStatus !== "pending") {
    throw new Error("Request has already been processed.");
  }

  req.requestStatus = "approved";
  req.reviewedAt = new Date();
  await req.save();

  // Apply to Attendance model
  const attendance = await Attendance.findOne({
    $or: [{ employeeId: req.employeeId }, { employeeCustomId: req.employeeId }],
  });

  if (attendance) {
    const dayRecord = (attendance.attendance || []).find((a) => a.date === req.date);
    if (dayRecord) {
      if (req.requestedPunchIn) {
        dayRecord.punchIn = new Date(`${req.date}T${req.requestedPunchIn}:00`);
      }
      if (req.requestedPunchOut) {
        dayRecord.punchOut = new Date(`${req.date}T${req.requestedPunchOut}:00`);
      }
      if (req.requestedStatus) {
        dayRecord.status = req.requestedStatus === "Full Day" || req.requestedStatus === "FULL_DAY" ? "COMPLETED" : dayRecord.status;
      }
      dayRecord.loginStatus = "ON_TIME";
      if (dayRecord.lateCorrectionRequest) {
        dayRecord.lateCorrectionRequest.status = "Approved";
      }
      await attendance.save();
    }
  }

  if (io) {
    io.emit("attendance:lateApproved", { requestId, employeeId: req.employeeId, date: req.date });
    io.emit("attendance:update", { employeeId: req.employeeId, date: req.date, action: "attendance_request_approved" });
  }

  return {
    success: true,
    message: `Attendance request for ${req.employeeName} (${req.date}) approved successfully.`,
    request: req,
  };
};

export const adminServiceRejectAttendanceRequest = async ({ loggedAdmin, requestId, adminComment = "Rejected by administrator", io = null }) => {
  const req = await AttendanceRequest.findById(requestId);
  if (!req) {
    throw new Error("Attendance request not found.");
  }

  req.requestStatus = "rejected";
  req.adminComment = adminComment;
  req.reviewedAt = new Date();
  await req.save();

  if (io) {
    io.emit("attendance:lateRejected", { requestId, employeeId: req.employeeId, date: req.date });
    io.emit("attendance:update", { employeeId: req.employeeId, date: req.date, action: "attendance_request_rejected" });
  }

  return {
    success: true,
    message: `Attendance request for ${req.employeeName} (${req.date}) rejected.`,
    request: req,
  };
};

/* =========================================================================
   6. EMPLOYEE MANAGEMENT & LIFECYCLE
========================================================================= */
export const adminServiceAddEmployee = async ({
  loggedAdmin,
  firstName,
  lastName = "",
  email,
  password = "Password@123",
  department = "Engineering",
  designation = "Software Engineer",
  salary = 50000,
  phone = "",
  joiningDate = new Date().toISOString().slice(0, 10),
  io = null,
}) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  if (!firstName || !email) {
    throw new Error("First name and email are mandatory for new employee creation.");
  }

  const existing = await Employee.findOne({
    email: email.toLowerCase().trim(),
    $or: [{ adminId }, { companyId: companyId || adminId }],
  });

  if (existing) {
    throw new Error(`An employee with email ${email} already exists in your organization.`);
  }

  // Generate unique employeeId
  const count = await Employee.countDocuments({
    $or: [{ adminId }, { companyId: companyId || adminId }],
  });
  const generatedEmployeeId = `EMP-${String(count + 1).padStart(3, "0")}`;

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newEmp = new Employee({
    adminId,
    companyId: companyId || adminId,
    employeeId: generatedEmployeeId,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    name: `${firstName.trim()} ${lastName.trim()}`.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    department,
    designation,
    salary: Number(salary) || 0,
    phone,
    joiningDate: new Date(joiningDate),
    status: "Active",
  });

  await newEmp.save();

  if (io) {
    io.emit("hrmsEmployeeAdded", { employee: newEmp });
  }

  return {
    success: true,
    message: `Employee ${newEmp.name} (${newEmp.employeeId}) created successfully in ${newEmp.department}. Temporary password: ${password}`,
    employee: newEmp,
  };
};

export const adminServiceUpdateEmployee = async ({ loggedAdmin, employeeId, updates = {}, io = null }) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  const emp = await Employee.findOne({
    $or: [{ employeeId }, { _id: mongoose.isValidObjectId(employeeId) ? employeeId : null }],
    $and: [{ $or: [{ adminId }, { companyId: companyId || adminId }] }],
  });

  if (!emp) {
    throw new Error(`Employee ${employeeId} not found.`);
  }

  const allowedFields = ["department", "designation", "salary", "phone", "shift", "status", "firstName", "lastName", "address"];
  for (const [key, val] of Object.entries(updates)) {
    if (allowedFields.includes(key) && val !== undefined && val !== null) {
      emp[key] = val;
    }
  }

  if (updates.firstName || updates.lastName) {
    emp.name = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
  }

  await emp.save();

  if (io) {
    io.emit("hrmsEmployeeUpdated", { employeeId: emp.employeeId, updates });
  }

  return {
    success: true,
    message: `Employee ${emp.name} (${emp.employeeId}) details updated successfully.`,
    employee: emp,
  };
};

export const adminServiceToggleEmployeeStatus = async ({ loggedAdmin, employeeId, status = "Deactivated", io = null }) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  const emp = await Employee.findOne({
    $or: [{ employeeId }, { _id: mongoose.isValidObjectId(employeeId) ? employeeId : null }],
    $and: [{ $or: [{ adminId }, { companyId: companyId || adminId }] }],
  });

  if (!emp) {
    throw new Error(`Employee ${employeeId} not found.`);
  }

  emp.status = status;
  await emp.save();

  if (io) {
    io.emit("hrmsEmployeeUpdated", { employeeId: emp.employeeId, status });
  }

  return {
    success: true,
    message: `Employee ${emp.name} (${emp.employeeId}) status set to ${status}.`,
    employee: emp,
  };
};

/* =========================================================================
   7. NOTICES & BROADCASTS
========================================================================= */
export const adminServicePostNotice = async ({
  loggedAdmin,
  title,
  description,
  meetingDate = null,
  meetingTime = null,
  recipients = "ALL",
  io = null,
}) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  if (!title || !description) {
    throw new Error("Title and description are required for posting a notice.");
  }

  const notice = new Notice({
    adminId,
    companyId: companyId || adminId,
    title: title.trim(),
    description: description.trim(),
    meetingDate,
    meetingTime,
    createdBy: adminId,
    creatorModel: "Admin",
    recipients,
    date: new Date(),
  });

  await notice.save();

  if (io) {
    io.emit("newNotice", { notice });
    io.emit("hrmsNoticesUpdated", { notice });
  }

  return {
    success: true,
    message: `Notice '${notice.title}' posted successfully to ${recipients === "ALL" ? "all employees" : recipients}.`,
    notice,
  };
};

export const adminServiceDeleteNotice = async ({ loggedAdmin, noticeId, io = null }) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  const notice = await Notice.findOneAndDelete({
    _id: noticeId,
    $or: [{ adminId }, { companyId: companyId || adminId }],
  });

  if (!notice) {
    throw new Error("Notice not found or already deleted.");
  }

  if (io) {
    io.emit("hrmsNoticeDeleted", { noticeId });
  }

  return {
    success: true,
    message: `Notice '${notice.title}' has been deleted.`,
  };
};

/* =========================================================================
   8. SUPPORT TICKETS & ISSUES
========================================================================= */
export const adminServiceUpdateIssueStatus = async ({ loggedAdmin, issueId, status = "resolved", reply = "", io = null }) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  const issue = await TechnicalIssue.findOne({
    _id: issueId,
    $or: [{ adminId }, { companyId: companyId || adminId }],
  });

  if (!issue) {
    throw new Error("Support ticket not found.");
  }

  issue.status = status;
  if (reply) {
    issue.message = `${issue.message}\n\n[Admin Resolution Note]: ${reply}`;
  }
  await issue.save();

  if (io) {
    io.emit("hrmsIssueUpdated", { issueId: issue._id, status });
  }

  return {
    success: true,
    message: `Ticket '${issue.subject}' status updated to ${status.toUpperCase()}.`,
    issue,
  };
};

/* =========================================================================
   9. RESIGNATION & EXIT MANAGEMENT
========================================================================= */
export const adminServiceApproveResignation = async ({
  loggedAdmin,
  resignationId,
  lastWorkingDate = null,
  adminRemark = "Resignation approved by management.",
  io = null,
}) => {
  const adminId = loggedAdmin._id;
  const resDoc = await Resignation.findOne({ _id: resignationId, adminId });

  if (!resDoc) {
    throw new Error("Resignation request not found.");
  }

  resDoc.status = "Approved";
  resDoc.adminRemark = adminRemark;
  if (lastWorkingDate) resDoc.lastWorkingDate = new Date(lastWorkingDate);
  await resDoc.save();

  if (io) {
    io.emit("hrmsResignationUpdated", { resignationId: resDoc._id, status: "Approved" });
  }

  return {
    success: true,
    message: `Resignation for ${resDoc.employeeName} approved. Status set to Approved / Exit Formalities.`,
    resignation: resDoc,
  };
};

export const adminServiceRejectResignation = async ({ loggedAdmin, resignationId, reason = "Resignation retained / rejected.", io = null }) => {
  const adminId = loggedAdmin._id;
  const resDoc = await Resignation.findOne({ _id: resignationId, adminId });

  if (!resDoc) {
    throw new Error("Resignation request not found.");
  }

  resDoc.status = "Rejected";
  resDoc.adminRemark = reason;
  await resDoc.save();

  if (io) {
    io.emit("hrmsResignationUpdated", { resignationId: resDoc._id, status: "Rejected" });
  }

  return {
    success: true,
    message: `Resignation for ${resDoc.employeeName} marked as Rejected / Retained.`,
    resignation: resDoc,
  };
};

/* =========================================================================
   10. SHIFTS, HOLIDAYS & POLICIES
========================================================================= */
export const adminServiceUpdateShift = async ({
  loggedAdmin,
  shiftName = "General Shift",
  startTime = "09:30",
  endTime = "18:30",
  gracePeriod = 15,
  halfDayThreshold = 4,
  fullDayThreshold = 8,
  io = null,
}) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  let shift = await Shift.findOne({
    $or: [{ adminId }, { companyId: companyId || adminId }],
  });

  if (!shift) {
    shift = new Shift({
      adminId,
      companyId: companyId || adminId,
      shiftName,
      shiftStartTime: startTime,
      shiftEndTime: endTime,
      lateGracePeriod: Number(gracePeriod) || 15,
      halfDayThresholdHours: Number(halfDayThreshold) || 4,
      fullDayThresholdHours: Number(fullDayThreshold) || 8,
    });
  } else {
    shift.shiftName = shiftName;
    shift.shiftStartTime = startTime;
    shift.shiftEndTime = endTime;
    shift.lateGracePeriod = Number(gracePeriod) || 15;
    shift.halfDayThresholdHours = Number(halfDayThreshold) || 4;
    shift.fullDayThresholdHours = Number(fullDayThreshold) || 8;
  }

  await shift.save();

  if (io) {
    io.emit("hrmsShiftUpdated", { shift });
  }

  return {
    success: true,
    message: `Shift timings updated to ${startTime} - ${endTime} (Grace: ${gracePeriod} mins, Half-Day: ${halfDayThreshold}h, Full-Day: ${fullDayThreshold}h).`,
    shift,
  };
};

export const adminServiceAddHoliday = async ({ loggedAdmin, name, date, type = "General", io = null }) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  if (!name || !date) {
    throw new Error("Holiday name and date are required.");
  }

  const holiday = new Holiday({
    adminId,
    companyId: companyId || adminId,
    name: name.trim(),
    date: date.trim(),
    type,
  });

  await holiday.save();

  if (io) {
    io.emit("hrmsHolidayAdded", { holiday });
  }

  return {
    success: true,
    message: `Holiday '${holiday.name}' on ${holiday.date} added to holiday calendar.`,
    holiday,
  };
};

export const adminServiceDeleteHoliday = async ({ loggedAdmin, holidayId, io = null }) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  const hol = await Holiday.findOneAndDelete({
    _id: holidayId,
    $or: [{ adminId }, { companyId: companyId || adminId }],
  });

  if (!hol) {
    throw new Error("Holiday not found or already removed.");
  }

  if (io) {
    io.emit("hrmsHolidayDeleted", { holidayId });
  }

  return {
    success: true,
    message: `Holiday '${hol.name}' (${hol.date}) removed from calendar.`,
  };
};

export const adminServicePostRule = async ({ loggedAdmin, title, content, category = "General", io = null }) => {
  const adminId = loggedAdmin._id;
  const companyId = loggedAdmin.company || loggedAdmin.companyId;

  if (!title || !content) {
    throw new Error("Rule title and content are required.");
  }

  const rule = new Rule({
    adminId,
    companyId: companyId || adminId,
    title: title.trim(),
    content: content.trim(),
    category,
    createdAt: new Date(),
  });

  await rule.save();

  if (io) {
    io.emit("hrmsRuleAdded", { rule });
  }

  return {
    success: true,
    message: `Company rule '${rule.title}' published successfully.`,
    rule,
  };
};
