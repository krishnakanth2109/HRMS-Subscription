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
  adminServicePostNotice,
  adminServiceDeleteNotice,
  adminServiceUpdateIssueStatus,
  adminServiceApproveResignation,
  adminServiceRejectResignation,
  adminServiceUpdateShift,
  adminServiceAddHoliday,
  adminServiceDeleteHoliday,
  adminServicePostRule,
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

  // ── 2. ATTENDANCE TODAY & CLOCK STATUS ───────────────────────────────────
  if (
    q.includes("attendance status") ||
    q.includes("attendance today") ||
    q.includes("today's attendance") ||
    q.includes("who is present") ||
    q.includes("present today") ||
    q.includes("clock status") ||
    q.includes("who clocked in") ||
    q.includes("who is working") ||
    q.includes("check attendance") ||
    q.includes("show attendance") ||
    q.includes("attendance overview") ||
    q.includes("attendance summary") ||
    q === "attendance"
  ) {
    return { action: "admin_get_today_attendance" };
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

  // ── 5. PENDING APPROVALS HUB ─────────────────────────────────────────────
  if (
    q === "approvals" ||
    q === "pending approvals" ||
    q.includes("pending approvals") ||
    q.includes("what needs approval") ||
    q.includes("pending requests") ||
    q.includes("approvals list")
  ) {
    return { action: "admin_get_pending_approvals" };
  }

  // ── 6. LEAVE APPROVAL & REJECTION ────────────────────────────────────────
  if (q.includes("leave")) {
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
  }

  // ── 7. WFH APPROVAL & REJECTION ──────────────────────────────────────────
  if (q.includes("wfh") || q.includes("work from home") || q.includes("remote")) {
    if (q.includes("approve") || q.includes("accept")) {
      const match = message.match(/(?:approve|accept)\s+(?:wfh\s+(?:for\s+|of\s+)?|)([a-zA-Z\s]+?)(?:'s\s+wfh|\s+wfh|$)/i);
      const name = match ? match[1].replace(/wfh|for|of|remote/gi, "").trim() : "";
      return { action: "admin_draft_approve_wfh", employeeName: name || "all" };
    }
  }

  // ── 8. EXPENSE APPROVAL & REJECTION ──────────────────────────────────────
  if (q.includes("expense") || q.includes("reimbursement") || q.includes("claim")) {
    if (q.includes("approve") || q.includes("accept")) {
      const match = message.match(/(?:approve|accept)\s+(?:expense\s+(?:for\s+|of\s+)?|)([a-zA-Z\s]+?)(?:'s\s+expense|\s+expense|$)/i);
      const name = match ? match[1].replace(/expense|claim|for|of/gi, "").trim() : "";
      return { action: "admin_draft_approve_expense", employeeName: name || "all" };
    }
  }

  // ── 8B. OVERTIME APPROVAL ────────────────────────────────────────────────
  if (q.includes("overtime") || q.includes(" ot ")) {
    if (q.includes("approve") || q.includes("accept")) {
      const match = message.match(/(?:approve|accept)\s+(?:overtime\s+(?:for\s+|of\s+)?|ot\s+(?:for\s+|of\s+)?|)([a-zA-Z\s]+?)(?:'s\s+overtime|\s+overtime|'s\s+ot|\s+ot|$)/i);
      const name = match ? match[1].replace(/overtime|ot|for|of/gi, "").trim() : "";
      return { action: "admin_draft_approve_overtime", employeeName: name || "all" };
    }
  }

  // ── 8C. LATE LOGIN JUSTIFICATION APPROVAL ────────────────────────────────
  if (q.includes("late login") || q.includes("late mark") || q.includes("waive late")) {
    if (q.includes("approve") || q.includes("accept") || q.includes("waive")) {
      const match = message.match(/(?:approve|accept|waive)\s+(?:late\s+login\s+(?:for\s+|of\s+)?|late\s+mark\s+(?:for\s+|of\s+)?|)([a-zA-Z\s]+?)(?:'s\s+late|\s+late|$)/i);
      const name = match ? match[1].replace(/late|login|mark|waive|for|of/gi, "").trim() : "";
      return { action: "admin_draft_approve_late", employeeName: name || "all" };
    }
  }

  // ── 8D. MISSING PUNCH-OUT APPROVAL ───────────────────────────────────────
  if (q.includes("punch out request") || q.includes("missing punch")) {
    if (q.includes("approve") || q.includes("accept")) {
      const match = message.match(/(?:approve|accept)\s+(?:punch\s+out\s+request\s+(?:for\s+|of\s+)?|missing\s+punch\s+(?:for\s+|of\s+)?|)([a-zA-Z\s]+?)(?:'s\s+punch|\s+punch|$)/i);
      const name = match ? match[1].replace(/punch|out|request|missing|for|of/gi, "").trim() : "";
      return { action: "admin_draft_approve_punch_out", employeeName: name || "all" };
    }
  }

  // ── 8E. ATTENDANCE REQUESTS & CORRECTIONS ────────────────────────────────
  if (
    q.includes("attendance request") ||
    q.includes("late request") ||
    q.includes("attendance correction") ||
    q.includes("correction request") ||
    q.includes("status adjustment")
  ) {
    if (q.includes("approve") || q.includes("accept")) {
      const match = message.match(/(?:approve|accept)\s+(?:attendance\s+request\s+(?:for\s+|of\s+)?|late\s+request\s+(?:for\s+|of\s+)?|attendance\s+correction\s+(?:for\s+|of\s+)?|correction\s+request\s+(?:for\s+|of\s+)?|)([a-zA-Z0-9\s]+?)(?:'s\s+attendance|'s\s+request|\s+attendance|\s+request|$)/i);
      const name = match ? match[1].replace(/attendance|request|correction|late|for|of/gi, "").trim() : "";
      return { action: "admin_draft_approve_attendance_request", employeeName: name || "all" };
    }
    if (q.includes("reject") || q.includes("deny")) {
      const match = message.match(/(?:reject|deny)\s+(?:attendance\s+request\s+(?:for\s+|of\s+)?|late\s+request\s+(?:for\s+|of\s+)?|attendance\s+correction\s+(?:for\s+|of\s+)?|correction\s+request\s+(?:for\s+|of\s+)?|)([a-zA-Z0-9\s]+?)(?:'s\s+attendance|'s\s+request|\s+attendance|\s+request|$)/i);
      const name = match ? match[1].replace(/attendance|request|correction|late|for|of/gi, "").trim() : "";
      return { action: "admin_draft_reject_attendance_request", employeeName: name || "all" };
    }
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

  // ── 10. NOTICES & BROADCASTS ─────────────────────────────────────────────
  if (
    q.startsWith("post notice") ||
    q.startsWith("broadcast notice") ||
    q.startsWith("send notice") ||
    q.startsWith("create notice") ||
    q.startsWith("publish notice") ||
    q.includes("post a notice")
  ) {
    const titleMatch = message.match(/(?:post|broadcast|send|create|publish)\s+(?:a\s+)?notice\s*[:\-]?\s*(.+)/i);
    const fullText = titleMatch ? titleMatch[1].trim() : "Company Notice";
    const splitParts = fullText.split(/[:\-\n]/);
    const title = splitParts[0].trim();
    const description = splitParts.slice(1).join(" ").trim() || title;

    return {
      action: "admin_draft_post_notice",
      title,
      description,
      recipients: "ALL",
    };
  }

  // ── 11. SHIFT TIMINGS & POLICIES ─────────────────────────────────────────
  if (
    q.startsWith("change shift") ||
    q.startsWith("update shift") ||
    q.startsWith("set shift") ||
    q.includes("shift timing") ||
    q.includes("shift hours")
  ) {
    const timeMatch = message.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    const startTime = timeMatch ? timeMatch[1] : "09:30";
    const endTime = timeMatch ? timeMatch[2] : "18:30";
    const graceMatch = message.match(/(\d{1,2})\s*(?:min|mins|minutes)?\s*grace/i);
    const gracePeriod = graceMatch ? parseInt(graceMatch[1], 10) : 15;

    if (q.includes("change") || q.includes("update") || q.includes("set")) {
      return {
        action: "admin_draft_update_shift",
        shiftName: "General Shift",
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
  if (q.startsWith("publish rule") || q.startsWith("add rule") || q.startsWith("post rule")) {
    const ruleMatch = message.match(/(?:publish|add|post)\s+rule\s*[:\-]?\s*(.+)/i);
    const fullText = ruleMatch ? ruleMatch[1].trim() : "Company Rule";
    return { action: "admin_draft_post_rule", title: fullText, content: fullText };
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
          shiftName: req.body?.shiftName || decoded.shiftName,
          startTime: req.body?.startTime || decoded.startTime,
          endTime: req.body?.endTime || decoded.endTime,
          gracePeriod: req.body?.gracePeriod || decoded.gracePeriod,
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
