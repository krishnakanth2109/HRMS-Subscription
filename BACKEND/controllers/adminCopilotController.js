// ============================================================================
// 🧠 ADMIN COPILOT CONTROLLER — Universal Natural-Language Orchestrator
// Multi-Stage Pipeline: Fast-Path Admin NLU -> Embeddings RAG -> Gemini Fallback -> Signed JWT Execution
// ============================================================================

import jwt from "jsonwebtoken";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { retrieveRelevantHRContext } from "../services/copilotRAGService.js";
import { executeAdminCopilotTool, generateAdminActionToken } from "../services/adminCopilotTools.js";
import {
  adminServiceApproveLeave,
  adminServiceRejectLeave,
  adminServiceApproveWFH,
  adminServiceRejectWFH,
  adminServiceApproveExpense,
  adminServiceRejectExpense,
  adminServiceApproveOvertime,
  adminServiceRejectOvertime,
  adminServiceApproveLateLogin,
  adminServiceRejectLateLogin,
  adminServiceApprovePunchOutRequest,
  adminServiceRejectPunchOutRequest,
  adminServiceApproveAttendanceRequest,
  adminServiceRejectAttendanceRequest,
  adminServiceAddEmployee,
  adminServiceUpdateEmployee,
  adminServiceToggleEmployeeStatus,
  adminServiceUpdateAdminProfile,
  adminServiceToggleMobileAccess,
  adminServiceAssignTask,
  adminServicePostNotice,
  adminServiceDeleteNotice,
  adminServiceUpdateIssueStatus,
  adminServiceApproveResignation,
  adminServiceRejectResignation,
  adminServiceUpdateShift,
  adminServiceAddHoliday,
  adminServicePostRule,
  adminServiceApproveWorkReport,
  adminServiceRejectWorkReport,
} from "../services/adminHrmsActionServices.js";

const JWT_SECRET = process.env.JWT_SECRET || "default_hrms_super_secret_jwt_key_2026";

const getAdminCopilotApiKeys = () => {
  return [
    process.env.COPILOT_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY,
  ].filter((k) => !!k && typeof k === "string" && k.trim() !== "");
};

const CANDIDATE_MODELS = [
  process.env.COPILOT_GEMINI_MODEL,
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro",
  "gemini-pro",
].filter((m) => !!m && typeof m === "string" && m.trim() !== "");

/* =========================================================================
   ⚡ DETERMINISTIC FAST-PATH ADMIN NLU INTENT CLASSIFIER (<15ms)
========================================================================= */
export const classifyAdminIntentTraditional = (message) => {
  if (!message || typeof message !== "string") return null;

  const q = message.toLowerCase().trim().replace(/[\s\-_]+/g, " ");

  // ── 1. DASHBOARD & ORG OVERVIEW ──────────────────────────────────────────
  if (
    q === "dashboard" ||
    q === "overview" ||
    q.includes("overview") ||
    q.includes("dashboard") ||
    q.includes("org summary") ||
    q.includes("organization summary") ||
    q.includes("organization overview") ||
    q.includes("org overview") ||
    q.includes("company overview") ||
    q.includes("company summary") ||
    q.includes("dashboard summary") ||
    q.includes("how many employees") ||
    q.includes("total staff") ||
    q.includes("active employees") ||
    q.includes("total employees")
  ) {
    return { action: "admin_get_dashboard_summary" };
  }

  // ── 2. LIVE ATTENDANCE / ATTENDANCE INQUIRIES ────────────────────────────
  if (
    q.includes("attendance") ||
    q.includes("who is present") ||
    q.includes("present today") ||
    q.includes("clock status") ||
    q.includes("who clocked in") ||
    q.includes("who is working") ||
    q.includes("punch status") ||
    q.includes("who punched in")
  ) {
    if (
      !q.includes("request") &&
      !q.includes("correction") &&
      !q.includes("late") &&
      !q.includes("absent") &&
      !q.includes("mobile") &&
      !q.includes("approve") &&
      !q.includes("reject")
    ) {
      let department = undefined;
      const deptMatch = message.match(/(?:administration|engineering|sales|marketing|hr|human resources|finance|operations|design|qa)\s+attendance/i) ||
                        message.match(/attendance\s+(?:in|for|of)\s+(?:the\s+)?(administration|engineering|sales|marketing|hr|finance|operations|design)/i);
      if (deptMatch) {
        department = (deptMatch[1] || deptMatch[0].replace(/attendance/i, "")).trim();
      }

      const empMatch = message.match(/(?:of|for)\s+([a-zA-Z0-9\s.-]+?)(?:[:,\n]|$|\s+today|\s+attendance)/i);
      const employeeName = (!deptMatch && empMatch) ? empMatch[1].replace(/attendance|today|for|of|employee/gi, "").trim() : "";

      return {
        action: "admin_get_today_attendance",
        employeeName: employeeName || undefined,
        department,
      };
    }
  }

  // ── 3. ABSENT EMPLOYEES ──────────────────────────────────────────────────
  if (
    q.includes("who is absent") ||
    q.includes("absent today") ||
    q.includes("absent employees") ||
    q.includes("who didn't punch in") ||
    q.includes("not clocked in") ||
    q.includes("missing attendance")
  ) {
    return { action: "admin_get_absent_employees" };
  }

  // ── 4. LATE ARRIVALS ─────────────────────────────────────────────────────
  if (
    q.includes("who is late") ||
    q.includes("late today") ||
    q.includes("late employees") ||
    q.includes("late arrivals") ||
    q.includes("late mark list")
  ) {
    return { action: "admin_get_late_employees" };
  }

  // ── 4B. IDLE TIME & LIVE ACTIVITY TRACKING ────────────────────────────────
  if (
    q.includes("idle") ||
    q.includes("live tracking") ||
    q.includes("activity tracking") ||
    q.includes("screen tracking") ||
    q.includes("who is idle") ||
    q.includes("idle employees") ||
    q.includes("idle time") ||
    q.includes("idle report")
  ) {
    const empMatch = message.match(/(?:of|for)\s+([a-zA-Z0-9\s.-]+?)(?:[:,\n]|$|\s+today|\s+idle)/i);
    const employeeName = empMatch ? empMatch[1].replace(/idle|tracking|time|report|for|of/gi, "").trim() : "";
    return {
      action: "admin_get_idle_tracking",
      employeeName: employeeName || undefined,
    };
  }

  // ── 5. PENDING APPROVALS HUB ─────────────────────────────────────────────
  if (
    q === "approvals" ||
    q === "pending approvals" ||
    q.includes("pending approvals") ||
    q.includes("what needs approval") ||
    q.includes("pending requests") ||
    q.includes("approvals list") ||
    q.includes("review pending") ||
    q.includes("review approval") ||
    q.includes("review request") ||
    q.includes("review expense") ||
    q.includes("review expenses") ||
    q.includes("review leave") ||
    q.includes("review leaves") ||
    q.includes("review wfh") ||
    q.includes("review overtime") ||
    q.includes("review resignation") ||
    q.includes("review attendance") ||
    q.includes("show expense") ||
    q.includes("show expenses") ||
    q.includes("view expense") ||
    q.includes("view expenses") ||
    q.includes("list expense") ||
    q.includes("list expenses") ||
    q.includes("pending expenses")
  ) {
    return { action: "admin_get_pending_approvals" };
  }

  // ── 6. LEAVE REQUESTS, INQUIRIES & APPROVALS ──────────────────────────────
  if (q.includes("leave") || q.includes("vacation") || q.includes("time off")) {
    if (q.includes("approve") || q.includes("accept")) {
      const match = message.match(/(?:approve|accept)\s+(?:leave\s+(?:for\s+|of\s+)?|)([a-zA-Z\s]+?)(?:'s\s+leave|\s+leave|$)/i);
      const name = match ? match[1].replace(/leave|for|of/gi, "").trim() : "";
      return { action: "admin_draft_approve_leave", employeeName: name || "all" };
    }
    if (q.includes("reject") || q.includes("deny")) {
      const match = message.match(/(?:reject|deny)\s+(?:leave\s+(?:for\s+|of\s+)?|)([a-zA-Z\s]+?)(?:'s\s+leave|\s+leave|$)/i);
      const name = match ? match[1].replace(/leave|for|of/gi, "").trim() : "";
      return { action: "admin_draft_reject_leave", employeeName: name || "all" };
    }

    const monthMatch = message.match(/(?:for|in|of)?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s*(?:month)?/i);
    const month = monthMatch ? monthMatch[1].toLowerCase() : "";

    return {
      action: "admin_get_leave_requests",
      month,
      status: q.includes("pending") ? "Pending" : (q.includes("approved") ? "Approved" : "all"),
    };
  }

  // ── 7. WFH & REMOTE WORK REQUESTS ─────────────────────────────────────────
  if (q.includes("wfh") || q.includes("work from home") || q.includes("remote")) {
    if (q.includes("approve") || q.includes("accept")) {
      const match = message.match(/(?:approve|accept)\s+(?:wfh\s+(?:for\s+|of\s+)?|)([a-zA-Z\s]+?)(?:'s\s+wfh|\s+wfh|$)/i);
      const name = match ? match[1].replace(/wfh|for|of|remote/gi, "").trim() : "";
      return { action: "admin_draft_approve_wfh", employeeName: name || "all" };
    }
    if (q.includes("reject") || q.includes("deny")) {
      const match = message.match(/(?:reject|deny)\s+(?:wfh\s+(?:for\s+|of\s+)?|)([a-zA-Z\s]+?)(?:'s\s+wfh|\s+wfh|$)/i);
      const name = match ? match[1].replace(/wfh|for|of|remote/gi, "").trim() : "";
      return { action: "admin_draft_reject_wfh", employeeName: name || "all" };
    }
    return { action: "admin_get_pending_approvals" };
  }

  // ── 8. EXPENSES, REIMBURSEMENTS & CLAIMS ─────────────────────────────────
  if (
    q.includes("expense") ||
    q.includes("expenses") ||
    q.includes("reimbursement") ||
    q.includes("reimbursements") ||
    q.includes("claim") ||
    q.includes("claims")
  ) {
    if (q.includes("approve") || q.includes("accept")) {
      const match = message.match(/(?:approve|accept)\s+(?:expense\s+(?:for\s+|of\s+)?|reimbursement\s+(?:for\s+|of\s+)?|claim\s+(?:for\s+|of\s+)?|)([a-zA-Z\s]+?)(?:'s\s+expense|'s\s+claim|\s+expense|\s+claim|$)/i);
      const name = match ? match[1].replace(/expense|claim|reimbursement|for|of/gi, "").trim() : "";
      return { action: "admin_draft_approve_expense", employeeName: name || "all" };
    }
    if (q.includes("reject") || q.includes("deny")) {
      const match = message.match(/(?:reject|deny)\s+(?:expense\s+(?:for\s+|of\s+)?|reimbursement\s+(?:for\s+|of\s+)?|claim\s+(?:for\s+|of\s+)?|)([a-zA-Z\s]+?)(?:'s\s+expense|'s\s+claim|\s+expense|\s+claim|$)/i);
      const name = match ? match[1].replace(/expense|claim|reimbursement|for|of/gi, "").trim() : "";
      return { action: "admin_draft_reject_expense", employeeName: name || "all" };
    }
    return { action: "admin_get_pending_approvals" };
  }

  // ── 8B. OVERTIME REQUESTS & APPROVALS ────────────────────────────────────
  if (q.includes("overtime") || q.includes(" ot ") || q.startsWith("ot ") || q.endsWith(" ot") || q === "ot") {
    if (q.includes("approve") || q.includes("accept")) {
      const match = message.match(/(?:approve|accept)\s+(?:overtime\s+(?:for\s+|of\s+)?|ot\s+(?:for\s+|of\s+)?|)([a-zA-Z\s]+?)(?:'s\s+overtime|\s+overtime|'s\s+ot|\s+ot|$)/i);
      const name = match ? match[1].replace(/overtime|ot|for|of/gi, "").trim() : "";
      return { action: "admin_draft_approve_overtime", employeeName: name || "all" };
    }
    return { action: "admin_get_pending_approvals" };
  }

  // ── 8C. LATE LOGIN JUSTIFICATION & REQUESTS ──────────────────────────────
  if (q.includes("late login") || q.includes("late mark") || q.includes("waive late") || q.includes("late justification") || q.includes("late request") || q.includes("late requests")) {
    if (q.includes("approve") || q.includes("accept") || q.includes("waive")) {
      const match = message.match(/(?:approve|accept|waive)\s+(?:late\s+login\s+(?:for\s+|of\s+)?|late\s+mark\s+(?:for\s+|of\s+)?|late\s+request\s+(?:for\s+|of\s+)?|)([a-zA-Z\s]+?)(?:'s\s+late|\s+late|$)/i);
      const name = match ? match[1].replace(/late|login|mark|waive|for|of|request/gi, "").trim() : "";
      return { action: "admin_draft_approve_late", employeeName: name || "all" };
    }
    return { action: "admin_get_pending_approvals" };
  }

  // ── 8D. MISSING PUNCH-OUT & FORCE PUNCH-OUT ──────────────────────────────
  if (q.includes("punch out request") || q.includes("punch out requests") || q.includes("missing punch") || q.includes("punchout request")) {
    if (q.includes("approve") || q.includes("accept")) {
      const match = message.match(/(?:approve|accept)\s+(?:punch\s+out\s+request\s+(?:for\s+|of\s+)?|missing\s+punch\s+(?:for\s+|of\s+)?|)([a-zA-Z\s]+?)(?:'s\s+punch|\s+punch|$)/i);
      const name = match ? match[1].replace(/punch|out|request|missing|for|of/gi, "").trim() : "";
      return { action: "admin_draft_approve_punch_out", employeeName: name || "all" };
    }
    return { action: "admin_get_pending_approvals" };
  }

  // ── 8E. ATTENDANCE REQUESTS & CORRECTIONS ────────────────────────────────
  if (
    q.includes("attendance request") ||
    q.includes("attendance requests") ||
    q.includes("attendance correction") ||
    q.includes("correction request") ||
    q.includes("correction requests") ||
    q.includes("status adjustment")
  ) {
    if (q.includes("approve") || q.includes("accept")) {
      const match = message.match(/(?:approve|accept)\s+(?:attendance\s+request\s+(?:for\s+|of\s+)?|attendance\s+correction\s+(?:for\s+|of\s+)?|correction\s+request\s+(?:for\s+|of\s+)?|)([a-zA-Z0-9\s]+?)(?:'s\s+attendance|'s\s+request|\s+attendance|\s+request|$)/i);
      const name = match ? match[1].replace(/attendance|request|correction|for|of/gi, "").trim() : "";
      return { action: "admin_draft_approve_attendance_request", employeeName: name || "all" };
    }
    if (q.includes("reject") || q.includes("deny")) {
      const match = message.match(/(?:reject|deny)\s+(?:attendance\s+request\s+(?:for\s+|of\s+)?|attendance\s+correction\s+(?:for\s+|of\s+)?|correction\s+request\s+(?:for\s+|of\s+)?|)([a-zA-Z0-9\s]+?)(?:'s\s+attendance|'s\s+request|\s+attendance|\s+request|$)/i);
      const name = match ? match[1].replace(/attendance|request|correction|for|of/gi, "").trim() : "";
      return { action: "admin_draft_reject_attendance_request", employeeName: name || "all" };
    }
    return { action: "admin_get_pending_approvals" };
  }

  // ── 8F. RESIGNATIONS & EXIT MANAGEMENT ─────────────────────────────────
  if (
    q.includes("resignation") ||
    q.includes("exit request") ||
    q.includes("resigned")
  ) {
    if (q.includes("approve") || q.includes("accept")) {
      const match = message.match(/(?:approve|accept)\s+(?:resignation\s+(?:for\s+|of\s+)?|exit\s+request\s+(?:for\s+|of\s+)?|)([a-zA-Z0-9\s]+?)(?:'s\s+resignation|\s+resignation|$)/i);
      const name = match ? match[1].replace(/resignation|request|exit|for|of/gi, "").trim() : "";
      return { action: "admin_draft_approve_resignation", employeeName: name || "all" };
    }
    if (q.includes("reject") || q.includes("deny")) {
      const match = message.match(/(?:reject|deny)\s+(?:resignation\s+(?:for\s+|of\s+)?|exit\s+request\s+(?:for\s+|of\s+)?|)([a-zA-Z0-9\s]+?)(?:'s\s+resignation|\s+resignation|$)/i);
      const name = match ? match[1].replace(/resignation|request|exit|for|of/gi, "").trim() : "";
      return { action: "admin_draft_reject_resignation", employeeName: name || "all" };
    }
    return { action: "admin_get_pending_approvals" };
  }

  // ── 8G. SUPPORT TICKETS & TECHNICAL ISSUES ──────────────────────────────
  if (
    q.includes("ticket") ||
    q.includes("support issue") ||
    q.includes("technical issue") ||
    q.includes("grievance")
  ) {
    if (q.includes("resolve") || q.includes("close") || q.includes("fix")) {
      const match = message.match(/(?:resolve|close|fix)\s+(?:ticket\s+|issue\s+|grievance\s+)?(.+)/i);
      const subject = match ? match[1].replace(/ticket|issue|grievance|support|technical/gi, "").trim() : "";
      return { action: "admin_draft_resolve_issue", subject };
    }
    return { action: "admin_get_pending_approvals" };
  }

  // ── 9. EMPLOYEE DIRECTORY & ADD EMPLOYEE ─────────────────────────────────
  if (
    q.startsWith("add employee") ||
    q.startsWith("create employee") ||
    q.startsWith("new employee") ||
    q.includes("add new employee") ||
    q.includes("create new employee")
  ) {
    const nameMatch = message.match(/(?:add|create|new)\s+(?:employee\s+)?([a-zA-Z]+)(?:\s+([a-zA-Z]+))?(?:\s+(?:in|department|email|with)\s+(.+))?/i);
    const firstName = nameMatch ? nameMatch[1] : "New";
    const lastName = nameMatch && nameMatch[2] ? nameMatch[2] : "Employee";
    const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
    const email = emailMatch ? emailMatch[0] : `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`;
    const deptMatch = message.match(/(?:department|dept|in)\s+([a-zA-Z]+)/i);
    const department = deptMatch ? deptMatch[1] : "Engineering";

    return {
      action: "admin_draft_add_employee",
      firstName,
      lastName,
      email,
      department,
      designation: "Software Engineer",
      salary: 50000,
    };
  }

  if (
    q.startsWith("search employee") ||
    q.startsWith("find employee") ||
    q.startsWith("view profile") ||
    q.startsWith("employee profile") ||
    q.includes("profile of ") ||
    q.includes("details of ")
  ) {
    const match = message.match(/(?:search|find|view|profile\s+of|details\s+of)\s+(?:employee\s+)?([a-zA-Z0-9\s.-]+)/i);
    const query = match ? match[1].replace(/profile|details|of|employee/gi, "").trim() : "";
    if (query) {
      return { action: "admin_get_employee_profile", query };
    }
  }

  if (q === "employees" || q === "all employees" || q === "employee directory" || q.includes("staff list") || q.includes("all staff")) {
    return { action: "admin_get_all_employees" };
  }

  // ── 9B. UPDATE ADMIN'S OWN PROFILE & PHONE / DETAILS ────────────────────
  if (
    q.includes("my phone") ||
    q.includes("my mobile") ||
    q.includes("my number") ||
    q.includes("my department") ||
    q.includes("my name") ||
    q.includes("my profile") ||
    q.includes("admin profile") ||
    ((q.includes("update") || q.includes("change") || q.includes("set")) && (q.includes("phone") || q.includes("mobile") || q.includes("number")) && !q.includes("employee")) ||
    ((q.includes("update") || q.includes("change") || q.includes("set")) && q.includes("department") && !q.includes("employee"))
  ) {
    const updates = {};
    const phoneMatch = message.match(/(?:phone(?:\s+number)?|mobile(?:\s+number)?|number)\s*(?:in\s+my\s+profile|to|is|:)?\s*([0-9+\-()\s]{6,20})/i);
    if (phoneMatch) {
      updates.phone = phoneMatch[1].replace(/[^0-9+]/g, "");
    } else {
      const numMatch = message.match(/(\d{6,15})/);
      if (numMatch) updates.phone = numMatch[1];
    }

    const deptMatch = message.match(/department\s+(?:to|is|as)?\s*([a-zA-Z\s]+)/i);
    if (deptMatch) {
      updates.department = deptMatch[1].trim();
    }

    const nameMatch = message.match(/name\s+(?:to|is|as)?\s*([a-zA-Z\s]+)/i);
    if (nameMatch && !deptMatch && !phoneMatch) {
      updates.name = nameMatch[1].trim();
    }

    if (Object.keys(updates).length > 0) {
      return {
        action: "admin_draft_update_admin_profile",
        ...updates,
      };
    }
  }

  // ── 9C. UPDATE EMPLOYEE DETAILS ──────────────────────────────────────────
  if (q.includes("update employee") || q.includes("change employee") || (q.includes("employee") && (q.includes("phone to") || q.includes("salary to") || q.includes("department to") || q.includes("designation to")))) {
    const nameMatch = message.match(/(?:update|change)?\s*employee\s+([a-zA-Z0-9\s.-]+?)(?:'s|\s+phone|\s+salary|\s+department|\s+designation|\s+to|$)/i);
    const employeeName = nameMatch ? nameMatch[1].replace(/employee|update|change/gi, "").trim() : "";

    const updates = {};
    const phoneMatch = message.match(/phone(?:\s+number)?\s+(?:to|is)?\s*([0-9+\-()\s]{6,20})/i);
    if (phoneMatch) updates.phone = phoneMatch[1].replace(/[^0-9+]/g, "");

    const salaryMatch = message.match(/salary\s+(?:to|is)?\s*(?:₹|rs\.?)?\s*([0-9,]+)/i);
    if (salaryMatch) updates.salary = Number(salaryMatch[1].replace(/,/g, ""));

    const deptMatch = message.match(/department\s+(?:to|is)?\s*([a-zA-Z\s]+)/i);
    if (deptMatch) updates.department = deptMatch[1].trim();

    const desigMatch = message.match(/designation\s+(?:to|is)?\s*([a-zA-Z\s]+)/i);
    if (desigMatch) updates.designation = desigMatch[1].trim();

    if (employeeName && Object.keys(updates).length > 0) {
      return {
        action: "admin_draft_update_employee",
        employeeName,
        ...updates,
      };
    }
  }

  // ── 9D. MOBILE ATTENDANCE ACCESS TOGGLE ──────────────────────────────────
  if (q.includes("mobile access") || q.includes("mobile punch") || q.includes("mobile attendance")) {
    if (q.includes("enable") || q.includes("turn on") || q.includes("allow")) {
      return { action: "admin_draft_toggle_mobile_access", enabled: true };
    }
    if (q.includes("disable") || q.includes("turn off") || q.includes("block") || q.includes("stop")) {
      return { action: "admin_draft_toggle_mobile_access", enabled: false };
    }
    return { action: "admin_draft_toggle_mobile_access", enabled: true };
  }

  // ── 9E. PERFORMANCE & WORK REPORTS ───────────────────────────────────────
  if (
    q.includes("work report") ||
    q.includes("work reports") ||
    q.includes("performance") ||
    q.includes("daily work") ||
    q.includes("work percentage") ||
    q.includes("task submission") ||
    q.startsWith("assign a task") ||
    q.startsWith("assign task") ||
    q.startsWith("give task") ||
    q.startsWith("create task") ||
    q.includes("assign task to") ||
    q.includes("assign a task to")
  ) {
    if (q.includes("approve") || q.includes("accept")) {
      let employeeName = "";
      const forMatch = message.match(/(?:for|of)\s+([a-zA-Z0-9\s.-]+?)(?:[:,\n]|$|\s+with|\s+at|\s+\d)/i);
      if (forMatch) {
        employeeName = forMatch[1].replace(/employee|task|work|report/gi, "").trim();
      } else {
        const directMatch = message.match(/(?:approve|accept)\s+([a-zA-Z0-9\s.-]+?)(?:'s|\s+work|\s+report|\s+task|$)/i);
        if (directMatch) employeeName = directMatch[1].replace(/work|report|task|daily/gi, "").trim();
      }

      const pctMatch = message.match(/(\d{1,3})\s*%/);
      const percentage = pctMatch ? parseInt(pctMatch[1], 10) : undefined;

      return {
        action: "admin_draft_approve_work_report",
        employeeName: employeeName || undefined,
        percentage,
      };
    }

    if (q.includes("reject") || q.includes("deny")) {
      let employeeName = "";
      const forMatch = message.match(/(?:for|of)\s+([a-zA-Z0-9\s.-]+?)(?:[:,\n]|$|\s+with|\s+at|\s+\d)/i);
      if (forMatch) {
        employeeName = forMatch[1].replace(/employee|task|work|report/gi, "").trim();
      } else {
        const directMatch = message.match(/(?:reject|deny)\s+([a-zA-Z0-9\s.-]+?)(?:'s|\s+work|\s+report|\s+task|$)/i);
        if (directMatch) employeeName = directMatch[1].replace(/work|report|task|daily/gi, "").trim();
      }

      return {
        action: "admin_draft_reject_work_report",
        employeeName: employeeName || undefined,
      };
    }

    if (
      q.startsWith("assign a task") ||
      q.startsWith("assign task") ||
      q.startsWith("give task") ||
      q.startsWith("create task") ||
      q.includes("assign task to") ||
      q.includes("assign a task to")
    ) {
      const nameMatch = message.match(/(?:to|for)\s+([a-zA-Z0-9\s.-]+?)(?:[:,\n]|$|\s+title|\s+task)/i);
      const employeeName = nameMatch ? nameMatch[1].replace(/employee|to|for/gi, "").trim() : "";

      const titleMatch = message.match(/(?:task|title|named|called|[:])\s*[:\-]?\s*([a-zA-Z0-9\s.-]+)/i);
      const title = titleMatch && titleMatch[1] && !titleMatch[1].toLowerCase().includes("to")
        ? titleMatch[1].trim()
        : "Complete Assigned Project Task";

      return {
        action: "admin_draft_assign_task",
        employeeName,
        title,
        description: `Task assigned via AI Copilot: ${title}`,
      };
    }
    return { action: "admin_get_performance_reports" };
  }

  // ── 9F. LOCATION & OFFICE SETTINGS ───────────────────────────────────────
  if (
    q.includes("location setting") ||
    q.includes("office setting") ||
    q.includes("geofence") ||
    q.includes("office radius") ||
    q.includes("office location") ||
    q.includes("work mode setting") ||
    q.includes("global work mode")
  ) {
    return { action: "admin_get_office_settings" };
  }

  // ── 9G. SUPPORT ADMIN & MANAGEMENT ───────────────────────────────────────
  if (
    q.includes("support admin") ||
    q.includes("support admins") ||
    q.includes("sub admin") ||
    q.includes("sub-admin") ||
    q.includes("management team") ||
    q.includes("admin management")
  ) {
    return { action: "admin_get_support_admins" };
  }

  // ── 10. NOTICES & ANNOUNCEMENTS (WITH TYPO TOLERANCE) ────────────────────
  const noticeKeywordRegex = /\b(?:notice|notices|announcement|announcements|annoucement|annoucements|anouncement|anouncements|anoucement|broadcast|broadcasts)\b/i;
  if (noticeKeywordRegex.test(q)) {
    if (
      q.includes("post") ||
      q.includes("send") ||
      q.includes("create") ||
      q.includes("publish") ||
      q.includes("broadcast") ||
      q.includes("make") ||
      q.includes("share")
    ) {
      const titleMatch = message.match(/(?:post|broadcast|send|create|publish|make|share)\s+(?:an?\s+)?(?:notice|notices|announcement|announcements|annoucement|annoucements|anouncement|anouncements|anoucement|broadcast)\s*[:\-]?\s*(.*)/i);
      const rawText = titleMatch && titleMatch[1] ? titleMatch[1].trim() : "";

      let title = "Company Announcement";
      let description = "Company Announcement for all team members.";

      if (rawText) {
        const splitParts = rawText.split(/[:\-\n]/);
        title = splitParts[0].trim();
        description = splitParts.slice(1).join(" ").trim() || title;
      }

      return {
        action: "admin_draft_post_notice",
        title,
        description,
        recipients: "ALL",
      };
    }
    return { action: "admin_get_notices" };
  }

  // ── 11. SHIFT TIMINGS & POLICIES ─────────────────────────────────────────
  if (
    q.includes("shift") ||
    q.includes("timing") ||
    q.includes("timings") ||
    q.includes("work hours") ||
    q.includes("working hours") ||
    q.includes("office hours")
  ) {
    const timeMatch = message.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);

    if (
      q.includes("change") ||
      q.includes("update") ||
      q.includes("set") ||
      q.includes("modify") ||
      q.includes("assign") ||
      timeMatch
    ) {
      let employeeName = "";
      const forOfMatch = message.match(/(?:for|of)\s+([a-zA-Z0-9\s.-]+?)(?:[:,\n]|$|\s+start|\s+to|\s+timing|\s+shift|\s+from|\s+hours)/i);
      if (forOfMatch) {
        employeeName = forOfMatch[1].replace(/shift|change|update|for|of|timing|timings|hours/gi, "").trim();
      } else {
        const directChangeMatch = message.match(/(?:change|update|set|modify)\s+([a-zA-Z0-9\s.-]+?)(?:'s|\s+timing|\s+timings|\s+shift|\s+to|\s+hours|:|-)/i);
        if (directChangeMatch) {
          employeeName = directChangeMatch[1].replace(/shift|change|update|set|modify|timing|timings|hours/gi, "").trim();
        }
      }

      const startTime = timeMatch ? timeMatch[1].trim() : "09:30";
      const endTime = timeMatch ? timeMatch[2].trim() : "18:30";
      const graceMatch = message.match(/(\d{1,2})\s*(?:min|mins|minutes)?\s*grace/i);
      const gracePeriod = graceMatch ? parseInt(graceMatch[1], 10) : 15;

      return {
        action: "admin_draft_update_shift",
        employeeName,
        shiftName: employeeName ? `${employeeName}'s Shift` : "General Shift",
        startTime,
        endTime,
        gracePeriod,
      };
    }
    return { action: "admin_get_shifts" };
  }

  // ── 12. HOLIDAY CALENDAR ─────────────────────────────────────────────────
  if (q.includes("holiday")) {
    if (q.startsWith("add holiday") || q.startsWith("create holiday")) {
      const match = message.match(/(?:add|create)\s+holiday\s+([a-zA-Z\s]+?)(?:\s+on|\s+date|\s+for)?\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}\s+[a-zA-Z]+(?:\s+[0-9]{4})?|$)/i);
      const name = match ? match[1].trim() : "Official Holiday";
      const date = match && match[2] ? match[2].trim() : new Date().toISOString().slice(0, 10);
      return { action: "admin_draft_add_holiday", name, date };
    }
    return { action: "admin_get_holidays" };
  }

  // ── 13. RULES & GUIDELINES ───────────────────────────────────────────────
  if (
    q.includes("rule") ||
    q.includes("rules") ||
    q.includes("guideline") ||
    q.includes("guidelines") ||
    q.includes("company policy") ||
    q.includes("company policies") ||
    q.includes("code of conduct")
  ) {
    if (
      q.startsWith("publish rule") ||
      q.startsWith("add rule") ||
      q.startsWith("post rule") ||
      q.startsWith("create rule") ||
      q.startsWith("new rule")
    ) {
      const ruleMatch = message.match(/(?:publish|add|post|create|new)\s+rule\s*[:\-]?\s*(.+)/i);
      const fullText = ruleMatch ? ruleMatch[1].trim() : "Company Rule";
      return { action: "admin_draft_post_rule", title: fullText, content: fullText };
    }
    return { action: "admin_get_company_rules" };
  }

  // ── 14. PAYROLL SUMMARY ──────────────────────────────────────────────────
  if (q.includes("payroll") || q.includes("salary outlay") || q.includes("total payout")) {
    return { action: "admin_get_payroll_summary" };
  }

  return { action: "reply", replyText: "" };
};

/* =========================================================================
   ⚡ MAIN ADMIN COPILOT CONTROLLER (Chat & Inquiry)
========================================================================= */
export const handleAdminCopilotChat = async (req, res) => {
  let actionCard = null;
  let replyText = "";
  let toolResultData = null;

  try {
    const { message } = req.body;
    const user = req.user;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required." });
    }

    if (!user || (user.role !== "admin" && user.role !== "support-admin")) {
      return res.status(403).json({ error: "Access restricted to Administrators." });
    }

    const tenantCompanyId = user.company || user.companyId || null;

    // ── STAGE 1: DETERMINISTIC FAST-PATH (<15ms) ────────────────────────────
    const deterministicIntent = classifyAdminIntentTraditional(message);

    if (deterministicIntent && deterministicIntent.action && deterministicIntent.action !== "reply") {
      const toolName = deterministicIntent.action;
      const toolArgs = { ...deterministicIntent };
      delete toolArgs.action;

      console.log(`🛡️ Executing Fast-Path Admin Tool: ${toolName}`, toolArgs);

      try {
        const toolOutput = await executeAdminCopilotTool(toolName, toolArgs, user);

        return res.json({
          reply: toolOutput.message,
          actionCard: toolOutput.actionCard || null,
          toolResult: toolOutput.data || null,
        });
      } catch (toolErr) {
        console.error("❌ Fast-path Admin tool error:", toolErr);
        return res.json({
          reply: `⚠️ Issue executing admin action: ${toolErr.message}`,
          actionCard: null,
        });
      }
    }

    // ── STAGE 2: VECTOR EMBEDDINGS / RAG RETRIEVAL (<15ms) ──────────────────
    try {
      const ragResult = await retrieveRelevantHRContext(message, tenantCompanyId, 3);
      if (ragResult?.retrievedDocs?.length > 0 && ragResult.retrievedDocs[0].score >= 0.55) {
        return res.json({
          reply: `Here is the relevant information from organization policy:\n\n${ragResult.formattedContext}`,
          sources: ragResult.retrievedDocs,
          actionCard: null,
        });
      }
    } catch (ragErr) {
      console.warn("⚠️ Admin RAG fallback:", ragErr.message);
    }

    // ── STAGE 3: GEMINI GENERATIVE AI FALLBACK (2.5s Strict Race Timeout) ───
    const apiKeys = getAdminCopilotApiKeys();
    if (apiKeys.length > 0) {
      for (const apiKey of apiKeys) {
        for (const modelName of CANDIDATE_MODELS) {
          try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: { maxOutputTokens: 250, temperature: 0.2 },
            });

            const systemPrompt = `You are VSync Admin AI Copilot for HR & Operations management. You have full access to organization data, approvals, employees, and policies. Answer professionally, concisely, and accurately.`;

            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Gemini Admin AI timeout")), 2500)
            );

            const aiPromise = model.generateContent(`${systemPrompt}\n\nAdministrator Request: "${message}"`);
            const result = await Promise.race([aiPromise, timeoutPromise]);
            const responseText = result.response.text();

            if (responseText && responseText.trim().length > 0) {
              return res.json({
                reply: responseText,
                actionCard: null,
              });
            }
          } catch (e) {
            // continue to next key/model
          }
        }
      }
    }

    // ── STAGE 4: CONTEXTUAL ADMIN ASSISTANT FALLBACK ────────────────────────
    return res.json({
      reply: `I understand your request: "${message}". As Admin Copilot, you can ask me to **approve leaves**, **review expenses**, **view absent staff**, **check live attendance**, **add employees**, **post notices**, or **update shift policies**!`,
      actionCard: null,
    });
  } catch (error) {
    console.error("Admin Copilot Chat Error:", error);
    return res.status(500).json({ error: error.message || "Failed to process admin copilot message." });
  }
};

/* =========================================================================
   🔒 EXECUTE SIGNED ADMIN ACTION TOKEN
========================================================================= */
export const handleAdminExecuteAction = async (req, res) => {
  try {
    const { actionToken } = req.body;
    const user = req.user;
    const io = req.app.get("io");

    if (!actionToken) {
      return res.status(400).json({ error: "Signed action token is required." });
    }

    let decoded;
    try {
      decoded = jwt.verify(actionToken, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: "Invalid or expired action token. Please request the action again." });
    }

    if (!decoded.actionType || !decoded.actionType.startsWith("admin_confirm_")) {
      return res.status(400).json({ error: "Invalid action token payload." });
    }

    console.log(`🛡️ Executing Signed Admin Action: ${decoded.actionType}`, decoded);

    switch (decoded.actionType) {
      case "admin_confirm_approve_leave": {
        const result = await adminServiceApproveLeave({
          loggedAdmin: user,
          leaveId: decoded.leaveId,
          adminComment: req.body?.adminComment || decoded.adminComment || "",
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_reject_leave": {
        const result = await adminServiceRejectLeave({
          loggedAdmin: user,
          leaveId: decoded.leaveId,
          reason: req.body?.reason || decoded.reason || "Rejected by administrator",
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_approve_wfh": {
        const result = await adminServiceApproveWFH({
          loggedAdmin: user,
          requestId: decoded.requestId,
          adminComment: req.body?.adminComment || decoded.adminComment || "",
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_reject_wfh": {
        const result = await adminServiceRejectWFH({
          loggedAdmin: user,
          requestId: decoded.requestId,
          reason: req.body?.reason || decoded.reason || "Rejected by administrator",
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_approve_expense": {
        const result = await adminServiceApproveExpense({
          loggedAdmin: user,
          expenseId: decoded.expenseId,
          allocatedAmount: req.body?.allocatedAmount || decoded.allocatedAmount,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_reject_expense": {
        const result = await adminServiceRejectExpense({
          loggedAdmin: user,
          expenseId: decoded.expenseId,
          reason: req.body?.reason || decoded.reason || "Rejected by administrator",
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_approve_overtime": {
        const result = await adminServiceApproveOvertime({
          loggedAdmin: user,
          overtimeId: decoded.overtimeId,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_reject_overtime": {
        const result = await adminServiceRejectOvertime({
          loggedAdmin: user,
          overtimeId: decoded.overtimeId,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_approve_late": {
        const result = await adminServiceApproveLateLogin({
          loggedAdmin: user,
          attendanceId: decoded.attendanceId,
          date: decoded.date,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_reject_late": {
        const result = await adminServiceRejectLateLogin({
          loggedAdmin: user,
          attendanceId: decoded.attendanceId,
          date: decoded.date,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_approve_punch_out": {
        const result = await adminServiceApprovePunchOutRequest({
          loggedAdmin: user,
          requestId: decoded.requestId,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_reject_punch_out": {
        const result = await adminServiceRejectPunchOutRequest({
          loggedAdmin: user,
          requestId: decoded.requestId,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_approve_attendance_request": {
        const result = await adminServiceApproveAttendanceRequest({
          loggedAdmin: user,
          requestId: decoded.requestId,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_reject_attendance_request": {
        const result = await adminServiceRejectAttendanceRequest({
          loggedAdmin: user,
          requestId: decoded.requestId,
          adminComment: req.body?.adminComment || decoded.adminComment || "Rejected by administrator",
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_add_employee": {
        const result = await adminServiceAddEmployee({
          loggedAdmin: user,
          firstName: req.body?.firstName || decoded.firstName,
          lastName: req.body?.lastName || decoded.lastName,
          email: req.body?.email || decoded.email,
          department: req.body?.department || decoded.department,
          designation: req.body?.designation || decoded.designation,
          salary: req.body?.salary || decoded.salary,
          phone: req.body?.phone || decoded.phone,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_update_employee": {
        const result = await adminServiceUpdateEmployee({
          loggedAdmin: user,
          employeeId: req.body?.employeeId || decoded.employeeId,
          updates: req.body?.updates || decoded.updates || {},
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_update_admin_profile": {
        const result = await adminServiceUpdateAdminProfile({
          loggedAdmin: user,
          updates: req.body?.updates || decoded.updates || {},
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_toggle_mobile_access": {
        const result = await adminServiceToggleMobileAccess({
          loggedAdmin: user,
          enabled: req.body?.enabled !== undefined ? req.body.enabled : decoded.enabled,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_assign_task": {
        const result = await adminServiceAssignTask({
          loggedAdmin: user,
          employeeId: req.body?.employeeId || decoded.employeeId,
          title: req.body?.title || decoded.title,
          description: req.body?.description || decoded.description,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_approve_work_report": {
        const result = await adminServiceApproveWorkReport({
          loggedAdmin: user,
          entryId: req.body?.entryId || decoded.entryId,
          employeeName: req.body?.employeeName || decoded.employeeName,
          percentage: req.body?.percentage !== undefined ? req.body.percentage : decoded.percentage,
          adminComment: req.body?.adminComment || decoded.adminComment,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_reject_work_report": {
        const result = await adminServiceRejectWorkReport({
          loggedAdmin: user,
          entryId: req.body?.entryId || decoded.entryId,
          employeeName: req.body?.employeeName || decoded.employeeName,
          adminComment: req.body?.adminComment || decoded.adminComment,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_post_notice": {
        const result = await adminServicePostNotice({
          loggedAdmin: user,
          title: req.body?.title || decoded.title,
          description: req.body?.description || decoded.description,
          meetingDate: req.body?.meetingDate || decoded.meetingDate,
          meetingTime: req.body?.meetingTime || decoded.meetingTime,
          recipients: req.body?.recipients || decoded.recipients || "ALL",
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_update_shift": {
        const result = await adminServiceUpdateShift({
          loggedAdmin: user,
          employeeName: req.body?.employeeName || decoded.employeeName || req.body?.target || decoded.target || "",
          shiftName: req.body?.shiftName || decoded.shiftName,
          startTime: req.body?.startTime || decoded.startTime,
          endTime: req.body?.endTime || decoded.endTime,
          gracePeriod: req.body?.gracePeriod || decoded.gracePeriod,
          halfDayThreshold: req.body?.halfDayThreshold || decoded.halfDayThreshold,
          fullDayThreshold: req.body?.fullDayThreshold || decoded.fullDayThreshold,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_add_holiday": {
        const result = await adminServiceAddHoliday({
          loggedAdmin: user,
          name: req.body?.name || decoded.name,
          date: req.body?.date || decoded.date,
          type: req.body?.type || decoded.type,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_post_rule": {
        const result = await adminServicePostRule({
          loggedAdmin: user,
          title: req.body?.title || decoded.title,
          content: req.body?.content || decoded.content,
          category: req.body?.category || decoded.category,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_approve_resignation": {
        const result = await adminServiceApproveResignation({
          loggedAdmin: user,
          resignationId: req.body?.resignationId || decoded.resignationId,
          lastWorkingDate: req.body?.lastWorkingDate || decoded.lastWorkingDate,
          adminRemark: req.body?.adminRemark || decoded.adminRemark,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_reject_resignation": {
        const result = await adminServiceRejectResignation({
          loggedAdmin: user,
          resignationId: req.body?.resignationId || decoded.resignationId,
          reason: req.body?.adminRemark || req.body?.reason || decoded.adminRemark || decoded.reason,
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      case "admin_confirm_resolve_issue": {
        const result = await adminServiceUpdateIssueStatus({
          loggedAdmin: user,
          issueId: req.body?.issueId || decoded.issueId,
          status: req.body?.status || decoded.status || "resolved",
          reply: req.body?.reply || decoded.reply || "",
          io,
        });
        return res.json({ success: true, message: `✅ ${result.message}`, data: result });
      }

      default:
        return res.status(400).json({ error: `Unhandled admin action type: ${decoded.actionType}` });
    }
  } catch (error) {
    console.error("Admin Action Execution Error:", error);
    return res.status(500).json({ error: error.message || "Failed to execute admin action." });
  }
};

/* =========================================================================
   ✍️ UPDATE DRAFT ADMIN ACTION (IN-PLACE EDIT)
========================================================================= */
export const handleAdminUpdateDraftAction = async (req, res) => {
  try {
    const { actionType, updatedData } = req.body;
    const user = req.user;

    if (!actionType || !updatedData) {
      return res.status(400).json({ error: "actionType and updatedData are required." });
    }

    const token = generateAdminActionToken({
      actionType,
      adminId: user._id.toString(),
      ...updatedData,
    });

    return res.json({
      success: true,
      actionCard: {
        type: actionType,
        title: "Updated Admin Action Confirmation",
        actionToken: token,
        data: updatedData,
      },
    });
  } catch (error) {
    console.error("Admin Draft Update Error:", error);
    return res.status(500).json({ error: error.message || "Failed to update draft action." });
  }
};
