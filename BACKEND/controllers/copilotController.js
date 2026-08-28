import jwt from "jsonwebtoken";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { retrieveRelevantHRContext } from "../services/copilotRAGService.js";
import { executeCopilotTool, checkEmployeeLeaveBalance } from "../services/copilotTools.js";
import {
  serviceApplyLeave,
  serviceCancelLeave,
  serviceApplyWFH,
  servicePunchIn,
  servicePunchOut,
  serviceApplyExpense,
  serviceApplyOvertime,
  serviceRequestPunchOut,
  serviceSubmitIssue,
  serviceSubmitResignation,
  serviceSubmitWorkUpdate,
} from "../services/hrmsActionServices.js";

// Dynamically load API Keys from .env
const getCopilotApiKeys = () => {
  return [
    process.env.COPILOT_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY,
  ].filter((key) => !!key && typeof key === "string" && key.trim() !== "");
};

// Candidate models to try in order
const CANDIDATE_MODELS = [
  process.env.COPILOT_GEMINI_MODEL,
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash-8b",
  "gemini-1.5-flash",
  "gemini-1.5-pro-latest",
].filter((m) => !!m && typeof m === "string" && m.trim() !== "");

/* =========================================================================
   DETERMINISTIC FALLBACK INTENT CLASSIFIER (Zero 404 / 100% Uptime Engine)
========================================================================= */
/* =========================================================================
   UNIVERSAL NATURAL LANGUAGE CLEANER & NORMALIZER — Semantic NLU Engine
   Automatically extracts core intent, strips colloquial noise/fillers,
   deduplicates repeated words, and converts to a crisp, professional description.
========================================================================= */
export const normalizeDescription = (message, domain = "general") => {
  if (!message || typeof message !== "string") return "";

  let text = message.trim();

  // 1. Remove explicit date ranges, dates, currencies and numbers first to avoid residue
  text = text
    .replace(/\b(?:from\s+)?[0-9]{1,4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,4}(?:\s*(?:to|till|until|-)\s*[0-9]{1,4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,4})?\b/gi, " ")
    .replace(/\b(?:from\s+)?\d{1,2}(?:st|nd|rd|th)?\s+(?:to|till|-)\s+\d{1,2}(?:st|nd|rd|th)?\s+[a-z]+(?:\s+\d{4})?\b/gi, " ")
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*(?:\s+\d{4})?\b/gi, " ")
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+\d{4})?\b/gi, " ")
    .replace(/(?:rs\.?|inr|₹|\$)\s*\d+(?:,\d+)*(?:\.\d+)?/gi, " ")
    .replace(/\b\d{1,7}\s*(?:rs|inr|rupees|\$)?\b/gi, " ")
    .replace(/\b(?:today|tomorrow|yesterday|next\s+week|this\s+week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, " ");

  // 2. Strip conversational command boilerplates & fillers
  const commandBoilerplates = [
    /\b(?:please|can\s+you|kindly|i\s+want\s+to|i\s+would\s+like\s+to|i\s+need\s+to|want\s+to|need\s+to|got\s+to)\b/gi,
    /\b(?:apply(?:\s+for)?|taking|take|request(?:\s+for)?|submit(?:\s+for|\s+a)?|claim(?:\s+for)?|raise(?:\s+a)?|report(?:\s+a)?|draft(?:\s+a)?)\b/gi,
    /\b(?:casual|sick|paid|annual|earned|comp[\s-]off)?\s*(?:leave|days?\s*off|half[\s-]day|wfh|work\s+from\s+home|overtime|ot|hours?\s+extra|expense|reimbursement|claim|ticket|issue|grievance|resignation|punch[\s-]out)\b/gi,
    /\b(?:for\s+(?:the\s+)?expense(?:\s+of)?|for\s+expense|for\s+reimbursement|as\s+an\s+expense)\b/gi,
  ];

  for (const re of commandBoilerplates) {
    text = text.replace(re, " ");
  }

  // 3. Strip leading connector and state fillers
  text = text
    .replace(/^(?:\s*(?:because\s+(?:of\s+)?|due\s+to\s+|as\s+(?:i\s+(?:am|have|had|feel)\s+)?|since\s+(?:i\s+(?:am|have)\s+)?|for\s+|to\s+|regarding\s+|about\s+|with\s+))+/i, "")
    .replace(/^(?:i\s+(?:am\s+(?:having\s+|suffering\s+from\s+|going\s+through\s+|dealing\s+with\s+|feeling\s+(?:a\s+bit\s+)?|experiencing\s+)?|have\s+(?:a\s+|an\s+|some\s+|to\s+attend\s+|to\s+)?|had\s+(?:a\s+|an\s+)?|got\s+(?:a\s+|an\s+)?)|having\s+(?:a\s+|an\s+)?|suffering\s+from\s+|feeling\s+)/i, "");

  // 4. Tokenize & Deduplicate repeated root/stem words (e.g. "travel ... travel", "dinner ... dinner")
  const rawTokens = text.split(/[\s,.;:!?()\[\]{}"'\-\/\\]+/).filter((t) => t.length > 0);
  const seenRoots = new Set();
  const filteredTokens = [];

  const stopWords = new Set(["a", "an", "the", "in", "on", "at", "for", "to", "of", "with", "by", "from", "my", "our", "and", "is", "it", "this", "that"]);

  for (const token of rawTokens) {
    const lower = token.toLowerCase();
    const stem = lower.length > 4 ? lower.slice(0, 4) : lower; // basic stem prefix
    if (!stopWords.has(lower)) {
      if (seenRoots.has(stem)) {
        continue; // Skip duplicate word/root
      }
      seenRoots.add(stem);
    }
    filteredTokens.push(token);
  }

  let cleaned = filteredTokens.join(" ").trim();

  // 5. Trim trailing dangling prepositions / conjunctions
  cleaned = cleaned.replace(/\b(?:for|to|at|of|with|in|on|by|and|the|a|an)\s*$/gi, "").trim();

  // 6. Professional Domain Formatter & Synthesizer
  if (domain === "expense") {
    // Specific example: "travel ... client meeting" -> "Client travel for meeting" or "Client meeting travel"
    const lowerClean = cleaned.toLowerCase();
    if (lowerClean.includes("client") && lowerClean.includes("meeting") && (lowerClean.includes("travel") || lowerClean.includes("trip"))) {
      cleaned = "Client travel for meeting";
    } else if (lowerClean.includes("team") && (lowerClean.includes("dinner") || lowerClean.includes("lunch") || lowerClean.includes("food"))) {
      cleaned = "Team meal/dinner expense";
    } else if ((lowerClean.includes("wifi") || lowerClean.includes("internet") || lowerClean.includes("broadband")) && (lowerClean.includes("bill") || lowerClean.includes("home"))) {
      cleaned = "Home internet/broadband bill";
    } else if (lowerClean.includes("cab") || lowerClean.includes("taxi") || lowerClean.includes("uber") || lowerClean.includes("ola")) {
      cleaned = lowerClean.includes("client") ? "Client visit cab fare" : "Local travel cab fare";
    }
  } else if (domain === "leave") {
    const lowerClean = cleaned.toLowerCase();
    if (lowerClean.includes("wedding") || lowerClean.includes("marriage")) {
      cleaned = lowerClean.includes("brother") ? "Brother's wedding ceremony" : lowerClean.includes("sister") ? "Sister's wedding ceremony" : "Wedding ceremony attendance";
    } else if (lowerClean.includes("fever") || lowerClean.includes("high temp")) {
      cleaned = lowerClean.includes("cold") ? "Fever and cold" : "Fever";
    } else if (lowerClean.includes("doctor") || lowerClean.includes("hospital") || lowerClean.includes("medical") || lowerClean.includes("checkup")) {
      cleaned = "Medical appointment/checkup";
    }
  } else if (domain === "overtime") {
    const lowerClean = cleaned.toLowerCase();
    if (lowerClean.includes("deploy") || lowerClean.includes("release")) {
      cleaned = "Production release deployment";
    } else if (lowerClean.includes("client") && (lowerClean.includes("demo") || lowerClean.includes("presentation"))) {
      cleaned = "Client presentation/demo preparation";
    } else if (lowerClean.includes("sprint") || lowerClean.includes("delivery")) {
      cleaned = "Sprint deliverables completion";
    }
  } else if (domain === "wfh") {
    const lowerClean = cleaned.toLowerCase();
    if (lowerClean.includes("plumb") || lowerClean.includes("repair") || lowerClean.includes("maintenance")) {
      cleaned = "Home maintenance/repair";
    } else if (lowerClean.includes("weather") || lowerClean.includes("rain") || lowerClean.includes("storm")) {
      cleaned = "Severe weather/commute difficulty";
    } else if (lowerClean.includes("focus") || lowerClean.includes("release")) {
      cleaned = "Focus on sprint release delivery";
    }
  } else if (domain === "issue") {
    const lowerClean = cleaned.toLowerCase();
    if (lowerClean.includes("ac") && (lowerClean.includes("not working") || lowerClean.includes("cooling") || lowerClean.includes("floor"))) {
      cleaned = "AC cooling issue in office/meeting room";
    } else if (lowerClean.includes("wifi") || lowerClean.includes("network") || lowerClean.includes("internet")) {
      cleaned = "Office network/Wi-Fi connectivity issue";
    }
  } else if (domain === "work") {
    cleaned = cleaned
      .replace(/^(?:update\s+(?:my\s+)?(?:todays?|today's\s+)?work\s*(?:for\s+today)?|daily\s+work\s*(?:update)?|work\s+update|submit\s+(?:my\s+)?(?:todays?|today's\s+)?work\s*(?:for\s+today)?|log\s+(?:my\s+)?(?:todays?|today's\s+)?work)\s*(?:[:\-,]\s*|\s+that\s+|\s+is\s+|\s+to\s+)?/i, "")
      .trim();
  }

  // 7. Capitalize first letter and enforce max length
  if (!cleaned || cleaned.length < 3) {
    return null;
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).slice(0, 70);
};

// ── COMPREHENSIVE DATE & PARAMETER PARSER ───────────────────────────────────
const MONTH_NAMES = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const DAY_NAMES = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

// Formats a Date object as YYYY-MM-DD in local timezone
const formatDateYMD = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Parses natural language dates (e.g. "2026-09-05", "5th Sept", "tomorrow", "next Monday", "15/09/2026")
export const parseExplicitDate = (dateStr, refDate = new Date()) => {
  if (!dateStr || typeof dateStr !== "string") return null;
  const s = dateStr.trim().toLowerCase();

  if (s === "today") return formatDateYMD(refDate);
  if (s === "tomorrow") {
    const d = new Date(refDate);
    d.setDate(d.getDate() + 1);
    return formatDateYMD(d);
  }
  if (s === "day after tomorrow") {
    const d = new Date(refDate);
    d.setDate(d.getDate() + 2);
    return formatDateYMD(d);
  }
  if (s === "yesterday") {
    const d = new Date(refDate);
    d.setDate(d.getDate() - 1);
    return formatDateYMD(d);
  }

  // 1. Standard ISO: YYYY-MM-DD
  const isoMatch = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const [_, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // 2. Day-Month-Year: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, "0");
    const m = dmyMatch[2].padStart(2, "0");
    const y = dmyMatch[3] ? (dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3]) : refDate.getFullYear();
    return `${y}-${m}-${d}`;
  }

  // 3. Month and Day (e.g. "5th Sept", "Sept 5", "5 September 2026")
  const mDayMatch = s.match(/\b(?:(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)|([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?)(?:\s+(\d{4}))?\b/i);
  if (mDayMatch) {
    const dayNum = parseInt(mDayMatch[1] || mDayMatch[4], 10);
    const monthStr = (mDayMatch[2] || mDayMatch[3]).toLowerCase();
    const yearNum = mDayMatch[5] ? parseInt(mDayMatch[5], 10) : refDate.getFullYear();

    if (MONTH_NAMES[monthStr] !== undefined && dayNum >= 1 && dayNum <= 31) {
      const monthNum = String(MONTH_NAMES[monthStr] + 1).padStart(2, "0");
      return `${yearNum}-${monthNum}-${String(dayNum).padStart(2, "0")}`;
    }
  }

  // 4. Day of the week (e.g. "Monday", "next Friday", "this Thursday")
  for (const [dayName, dayIndex] of Object.entries(DAY_NAMES)) {
    if (new RegExp(`\\b(?:next\\s+|this\\s+)?${dayName}\\b`, "i").test(s)) {
      const currentDay = refDate.getDay();
      let diff = dayIndex - currentDay;
      if (diff <= 0 || s.includes("next")) diff += 7;
      const target = new Date(refDate);
      target.setDate(refDate.getDate() + diff);
      return formatDateYMD(target);
    }
  }

  return null;
};

// Extracts explicit date ranges (e.g. "from 1st Sept to 5th Sept", "10-15 Sept", "for 3 days from tomorrow")
export const extractExplicitDateRange = (message, todayStr, tomorrowStr) => {
  const text = message.toLowerCase();
  const refDate = new Date();

  // Pattern A: "from <date1> to <date2>" / "<date1> to <date2>" / "<date1> - <date2>"
  const rangePattern = /\b(?:from\s+)?([a-z0-9\/\-\.]+)\s+(?:to|till|until|-)\s+([a-z0-9\/\-\.]+)\b/i;
  const rangeMatch = text.match(rangePattern);
  if (rangeMatch) {
    const fromParsed = parseExplicitDate(rangeMatch[1], refDate);
    const toParsed = parseExplicitDate(rangeMatch[2], refDate);
    if (fromParsed && toParsed) {
      return { from: fromParsed, to: toParsed };
    }
  }

  // Pattern B: "10 to 15 Sept" / "1st to 5th September"
  const sameMonthRange = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:to|till|-)\s+(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?\b/i;
  const sameMonthMatch = text.match(sameMonthRange);
  if (sameMonthMatch) {
    const d1 = parseInt(sameMonthMatch[1], 10);
    const d2 = parseInt(sameMonthMatch[2], 10);
    const monthStr = sameMonthMatch[3].toLowerCase();
    const year = sameMonthMatch[4] ? parseInt(sameMonthMatch[4], 10) : refDate.getFullYear();

    if (MONTH_NAMES[monthStr] !== undefined) {
      const mStr = String(MONTH_NAMES[monthStr] + 1).padStart(2, "0");
      return {
        from: `${year}-${mStr}-${String(d1).padStart(2, "0")}`,
        to: `${year}-${mStr}-${String(d2).padStart(2, "0")}`,
      };
    }
  }

  // Pattern C: "for X days from <date>"
  const durationPattern = /\bfor\s+(\d+)\s+days?(?:\s+(?:from|starting)\s+([a-z0-9\/\-\.\s]+))?\b/i;
  const durationMatch = text.match(durationPattern);
  if (durationMatch) {
    const daysCount = parseInt(durationMatch[1], 10);
    const startStr = durationMatch[2] ? durationMatch[2].trim() : "tomorrow";
    const startDateYMD = parseExplicitDate(startStr, refDate) || tomorrowStr;
    const startD = new Date(startDateYMD);
    const endD = new Date(startD);
    endD.setDate(startD.getDate() + Math.max(0, daysCount - 1));
    return {
      from: startDateYMD,
      to: formatDateYMD(endD),
    };
  }

  // Pattern D: Single explicit date
  const singleDate = parseExplicitDate(text, refDate);
  if (singleDate) {
    return { from: singleDate, to: singleDate };
  }

  // Fallback defaults
  if (text.includes("today")) {
    return { from: todayStr, to: todayStr };
  }

  return { from: tomorrowStr, to: tomorrowStr };
};

// Extracts explicit times (e.g. "6:30 pm", "from 18:00 to 20:00", "at 7 pm")
export const extractExplicitTime = (message) => {
  const text = message.toLowerCase();

  // Range: "from 6pm to 8pm" / "6:00 to 8:30"
  const timeRangeMatch = text.match(/\b(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(?:to|till|-)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
  if (timeRangeMatch) {
    const parseClock = (tStr) => {
      const m = tStr.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
      if (!m) return tStr;
      let hour = parseInt(m[1], 10);
      const min = m[2] || "00";
      const meridiem = m[3]?.toLowerCase();
      if (meridiem === "pm" && hour < 12) hour += 12;
      if (meridiem === "am" && hour === 12) hour = 0;
      return `${String(hour).padStart(2, "0")}:${min}`;
    };

    return {
      fromTime: parseClock(timeRangeMatch[1]),
      toTime: parseClock(timeRangeMatch[2]),
    };
  }

  // Single time: "at 6:30 pm" / "18:30"
  const singleTimeMatch = text.match(/\b(?:at\s+)?(\d{1,2}):(\d{2})(?:\s*(am|pm))?\b/i) || text.match(/\b(?:at\s+)(\d{1,2})\s*(am|pm)\b/i);
  if (singleTimeMatch) {
    let hour = parseInt(singleTimeMatch[1], 10);
    const min = singleTimeMatch[2] || "00";
    const meridiem = (singleTimeMatch[3] || singleTimeMatch[2])?.toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    return { time: `${String(hour).padStart(2, "0")}:${min}` };
  }

  return null;
};

const classifyIntentTraditional = (message, todayStr, tomorrowStr) => {
  const q = message.toLowerCase().trim();

  // ── 1. PUNCH IN / PUNCH OUT & MISSING PUNCH CORRECTION ────────────────────
  if (
    q === "punch in" ||
    q === "login" ||
    q === "clock in" ||
    q === "check in" ||
    q === "checkin" ||
    q.includes("punch in") ||
    q.includes("punchin") ||
    q.includes("start work") ||
    q.includes("clock in") ||
    q.includes("mark attendance") ||
    q.includes("check in")
  ) {
    const explicitNote = normalizeDescription(message, "general");
    return {
      action: "draft_punch_in",
      note: explicitNote || "Punched in via AI Copilot",
    };
  }

  if (
    q.includes("missed punch") ||
    q.includes("forgot punch") ||
    q.includes("forgot to punch") ||
    q.includes("punchout request") ||
    q.includes("punch out request") ||
    q.includes("punch correction") ||
    ((q.includes("punch out") || q.includes("punchout") || q.includes("checkout")) &&
      (q.includes("yesterday") || q.includes("miss") || q.includes("forgot") || q.includes("request") || q.includes("correct")))
  ) {
    const explicitDate = parseExplicitDate(message) || (q.includes("yesterday") ? parseExplicitDate("yesterday") : todayStr);
    const explicitTime = extractExplicitTime(message)?.time || "18:30";
    const explicitReason = normalizeDescription(message, "punch_out");
    return {
      action: "draft_punch_out_request",
      originalDate: explicitDate,
      time: explicitTime,
      reason: explicitReason || "Missing punch-out correction request",
    };
  }

  if (
    q === "punch out" ||
    q === "logout" ||
    q === "clock out" ||
    q === "check out" ||
    q === "checkout" ||
    q === "sign out" ||
    q.includes("punch out") ||
    q.includes("punchout") ||
    q.includes("done for today") ||
    q.includes("done for the day") ||
    q.includes("leaving now") ||
    q.includes("end work") ||
    q.includes("clock out")
  ) {
    const explicitNote = normalizeDescription(message, "general");
    return {
      action: "draft_punch_out",
      note: explicitNote || "Punched out via AI Copilot",
    };
  }

  // ── 2. LEAVE MANAGEMENT (QUERIES, CANCELLATION, APPLICATION) ───────────────
  if (
    q === "balance" ||
    q === "leave balance" ||
    q === "leaves" ||
    q === "my leaves" ||
    q === "leave quota" ||
    q.includes("leave balance") ||
    q.includes("how many leave") ||
    q.includes("leaves left") ||
    q.includes("remaining leave") ||
    q.includes("leave quota") ||
    q.includes("leave status")
  ) {
    return { action: "get_leave_balance" };
  }

  if (
    q === "cancel leave" ||
    q === "cancel" ||
    q.includes("cancel leave") ||
    q.includes("withdraw leave") ||
    q.includes("delete leave") ||
    q.includes("revoke leave") ||
    (q.includes("cancel") && q.includes("leave"))
  ) {
    const explicitDate = parseExplicitDate(message);
    const explicitReason = normalizeDescription(message, "leave");
    return {
      action: "draft_cancel_leave",
      from: explicitDate || undefined,
      reason: explicitReason || "Requested cancellation via AI Copilot",
    };
  }

  if (
    q === "leave" ||
    q === "apply leave" ||
    q === "sick leave" ||
    q === "casual leave" ||
    q.includes("leave") ||
    q.includes("day off") ||
    q.includes("days off") ||
    q.includes("half day") ||
    q.includes("taking off") ||
    q.includes("off tomorrow") ||
    q.includes("sick day") ||
    (q.includes("fever") && !q.includes("what")) ||
    (q.includes("unwell") && !q.includes("what"))
  ) {
    // Explicit Date Range (e.g. "from 1st to 5th Sept", "10-15 Sept", "tomorrow", "Monday to Wednesday")
    const { from, to } = extractExplicitDateRange(message, todayStr, tomorrowStr);
    
    // Explicit Leave Type
    const leaveType = (q.includes("sick") || q.includes("fever") || q.includes("ill") || q.includes("cold") || q.includes("doctor") || q.includes("hospital") || q.includes("unwell") || q.includes("sl"))
      ? "Sick Leave"
      : (q.includes("paid") || q.includes("annual") || q.includes("earned") || q.includes("pl") || q.includes("el") || q.includes("privilege"))
      ? "Paid Leave"
      : "Casual Leave";
      
    // Explicit Day Type (Half Day vs Full Day)
    const leaveDayType = q.includes("half day") || q.includes("half-day") || q.includes("first half") || q.includes("second half") || q.includes("0.5") ? "Half Day" : "Full Day";
    
    // Explicit Reason Priority
    const extractedReason = normalizeDescription(message, "leave");
    const defaultReason = leaveType === "Sick Leave" ? "Sick leave application" : "Casual leave application";
    
    return {
      action: "draft_leave_request",
      from,
      to,
      leaveType,
      leaveDayType,
      reason: extractedReason || defaultReason,
    };
  }

  // ── 3. WORK FROM HOME (WFH) ────────────────────────────────────────────────
  if (
    q === "wfh" ||
    q === "work from home" ||
    q === "remote" ||
    q.includes("wfh") ||
    q.includes("work from home") ||
    q.includes("remote work") ||
    q.includes("work remotely") ||
    q.includes("home work")
  ) {
    const { from, to } = extractExplicitDateRange(message, todayStr, tomorrowStr);
    const requestedMode = q.includes("wfo") || q.includes("work from office") ? "WFO" : "WFH";
    const extractedWfhReason = normalizeDescription(message, "wfh");
    return {
      action: "draft_wfh_request",
      fromDate: from,
      toDate: to,
      requestedMode,
      reason: extractedWfhReason || "Work from home request",
    };
  }

  // ── 4. EXPENSE REIMBURSEMENT ──────────────────────────────────────────────
  if (
    q.includes("expense") ||
    q.includes("reimburse") ||
    q.includes("claim") ||
    q.includes("bill") ||
    q.includes("receipt")
  ) {
    const amountMatch = message.match(/(?:rs\.?|inr|₹|\$)\s*(\d+(?:,\d+)*(?:\.\d+)?)/i) || message.match(/\b(\d{2,7})\s*(?:rs|inr|rupees|\$)?\b/i);
    if (amountMatch || q.includes("apply") || q.includes("submit") || q.includes("add") || q.includes("claim")) {
      const amountVal = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : 500;
      
      // Explicit Category Extraction
      let category = "General";
      if (q.includes("travel") || q.includes("cab") || q.includes("flight") || q.includes("taxi") || q.includes("hotel") || q.includes("trip") || q.includes("train") || q.includes("fuel")) category = "Travel";
      else if (q.includes("food") || q.includes("lunch") || q.includes("dinner") || q.includes("meal") || q.includes("snack") || q.includes("restaurant") || q.includes("breakfast")) category = "Food";
      else if (q.includes("internet") || q.includes("wifi") || q.includes("phone") || q.includes("broadband") || q.includes("mobile") || q.includes("recharge")) category = "Internet";
      else if (q.includes("equipment") || q.includes("hardware") || q.includes("laptop") || q.includes("mouse") || q.includes("keyboard") || q.includes("monitor")) category = "Equipment";
      else if (q.includes("stationery") || q.includes("print") || q.includes("courier") || q.includes("paper")) category = "Stationery";
      
      const explicitDate = parseExplicitDate(message) || todayStr;
      const cleanDesc = normalizeDescription(message, "expense");
      
      return {
        action: "draft_expense_request",
        amount: amountVal,
        category,
        description: cleanDesc || `${category} expense claim`,
        date: explicitDate,
      };
    }
    return { action: "get_my_expenses" };
  }

  // ── 5. OVERTIME (OT) ──────────────────────────────────────────────────────
  if (
    q.includes("overtime") ||
    q.includes(" ot ") ||
    q.startsWith("ot ") ||
    q === "ot" ||
    q === "overtime" ||
    q.includes("extra hour") ||
    q.includes("extra time")
  ) {
    const hoursMatch = message.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i) || message.match(/\b(\d+(?:\.\d+)?)\s*extra\b/i) || message.match(/\b(\d+(?:\.\d+)?)\b/);
    if (hoursMatch || q.includes("apply") || q.includes("submit") || q.includes("claim") || q.includes("worked") || q.includes("extra")) {
      const hoursVal = hoursMatch ? parseFloat(hoursMatch[1]) : 2;
      const explicitDate = parseExplicitDate(message) || (q.includes("yesterday") ? parseExplicitDate("yesterday") : todayStr);
      const timeParsed = extractExplicitTime(message);
      const fromTime = timeParsed?.fromTime || "18:00";
      const toTime = timeParsed?.toTime || "20:00";
      const cleanOtReason = normalizeDescription(message, "overtime");
      
      return {
        action: "draft_overtime_request",
        hours: hoursVal,
        date: explicitDate,
        reason: cleanOtReason || "Overtime worked",
        fromTime,
        toTime,
      };
    }
    return { action: "get_my_overtime" };
  }

  // ── 6. PAYSLIP & SALARY ───────────────────────────────────────────────────
  if (
    q === "payslip" ||
    q === "salary" ||
    q === "pay" ||
    q === "my salary" ||
    q.includes("payslip") ||
    q.includes("salary") ||
    q.includes("pay slip") ||
    q.includes("paycheck") ||
    q.includes("net pay") ||
    q.includes("take home") ||
    q.includes("ctc") ||
    q.includes("deduction") ||
    q.includes("earnings")
  ) {
    return { action: "get_my_payslip" };
  }

  // ── 7. NOTICES, ANNOUNCEMENTS & MEETINGS ──────────────────────────────────
  if (
    q === "notices" ||
    q === "notice" ||
    q === "meetings" ||
    q === "meeting" ||
    q === "announcements" ||
    q.includes("notice") ||
    q.includes("announcement") ||
    q.includes("meeting") ||
    q.includes("circular") ||
    q.includes("company update")
  ) {
    return { action: "get_my_notices" };
  }

  // ── 8. HOLIDAYS ───────────────────────────────────────────────────────────
  if (
    q === "holiday" ||
    q === "holidays" ||
    q === "next holiday" ||
    q.includes("holiday") ||
    q.includes("holidays") ||
    q.includes("vacation") ||
    q.includes("festival off")
  ) {
    return { action: "get_upcoming_holidays" };
  }

  // ── 9. SHIFTS & SCHEDULE ──────────────────────────────────────────────────
  if (
    q === "shift" ||
    q === "my shift" ||
    q === "timing" ||
    q === "work hours" ||
    q.includes("shift") ||
    q.includes("work hours") ||
    q.includes("grace period") ||
    q.includes("office timing")
  ) {
    return { action: "get_my_shifts" };
  }

  // ── 10. ATTENDANCE LOG & STATS ────────────────────────────────────────────
  if (
    q === "attendance" ||
    q === "my attendance" ||
    q.includes("attendance") ||
    q.includes("late mark") ||
    q.includes("present day") ||
    q.includes("absent day") ||
    q.includes("hours worked") ||
    q.includes("log sheet")
  ) {
    return { action: "get_my_attendance" };
  }

  // ── 11. PROFILE DETAILS ───────────────────────────────────────────────────
  if (
    q === "profile" ||
    q === "my profile" ||
    q === "emp id" ||
    q === "employee id" ||
    q === "who am i" ||
    q.includes("profile") ||
    q.includes("employee id") ||
    q.includes("emp id") ||
    q.includes("my designation") ||
    q.includes("my department") ||
    q.includes("my details")
  ) {
    return { action: "get_my_profile" };
  }

  // ── 12. SUPPORT TICKETS / ISSUES ──────────────────────────────────────────
  if (
    q.includes("ticket") ||
    q.includes("grievance") ||
    q.includes("complaint") ||
    q.includes("not working") ||
    q.includes("broken") ||
    q.includes("facing problem") ||
    q.includes("issue")
  ) {
    if (
      q.includes("raise") ||
      q.includes("report") ||
      q.includes("submit") ||
      q.includes("create") ||
      q.includes("not working") ||
      q.includes("broken") ||
      q.includes("failed") ||
      q.includes("down")
    ) {
      const cleanIssue = normalizeDescription(message, "issue") || message.slice(0, 60);
      return {
        action: "draft_issue_request",
        subject: cleanIssue,
        message: cleanIssue,
      };
    }
    return { action: "get_my_issues" };
  }

  // ── 13. RESIGNATION & EXIT ────────────────────────────────────────────────
  if (
    q === "resign" ||
    q.includes("resign") ||
    q.includes("notice period") ||
    q.includes("quit job") ||
    q.includes("exit formalit")
  ) {
    if (
      q.includes("want to resign") ||
      q.includes("submit") ||
      q.includes("apply") ||
      q.includes("tender") ||
      q.includes("draft") ||
      q === "resign" ||
      q.includes("leaving company")
    ) {
      const cleanResReason = normalizeDescription(message, "resignation") || "Personal career decision";
      return {
        action: "draft_resignation_request",
        reason: cleanResReason,
      };
    }
    return { action: "get_my_resignation" };
  }

  // ── 14. DAILY WORK UPDATE & TASK REPORT ──────────────────────────────────
  const isWorkDomain =
    /\b(?:work|task|tasks|progress|activity)\b/i.test(q) ||
    /\b(?:daily\s+work|work\s+update|task\s+update|work\s+report)\b/i.test(q);

  const isWorkAction =
    /\b(?:update|log|submit|add|fill|record|enter|save|report|complete|completed|did|done)\b/i.test(q);

  const isWorkQuery =
    /\b(?:check|view|status|did\s+i|show|get|list)\b/i.test(q);

  if (
    (isWorkDomain && (isWorkAction || /\b(?:today|todays|today's|daily|yesterday)\b/i.test(q))) ||
    /\b(?:update|log|submit|record)\b.*\b(?:work|task|tasks)\b/i.test(q) ||
    /\b(?:work|task|tasks)\b.*\b(?:update|log|report|summary|status)\b/i.test(q)
  ) {
    if (isWorkQuery && !isWorkAction) {
      return { action: "get_my_daily_work" };
    }

    const percentageMatch = message.match(/(\d{1,3})\s*%/);
    const percentageVal = percentageMatch ? parseInt(percentageMatch[1], 10) : 100;
    const cleanWorkDesc = normalizeDescription(message, "work");
    const title = cleanWorkDesc || "Daily Work Update";
    const description = cleanWorkDesc || "Completed assigned daily tasks";

    return {
      action: "draft_work_update",
      title,
      description,
      percentage: percentageVal,
      date: todayStr,
    };
  }

  return {
    action: "reply",
    replyText:
      "Hello! I am your VSync HR Copilot. Ask me to apply for leave, submit expenses, claim overtime, check payslips, update daily work, request WFH, view notices, or check attendance!",
  };
};

export const handleCopilotChat = async (req, res) => {
  try {
    const { message, chatHistory = [] } = req.body;
    const user = req.user;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required." });
    }

    if (!user) {
      return res.status(401).json({ error: "Unauthorized user." });
    }

    const apiKeys = getCopilotApiKeys();

    // 1. RAG Vector Search / Policy Context
    const tenantCompanyId = user.company || user.companyId || null;
    const { retrievedDocs, formattedContext } = await retrieveRelevantHRContext(
      message,
      tenantCompanyId,
      3
    );

    // Calculate dates on server
    const nowObj = new Date();
    const todayStr = nowObj.toISOString().slice(0, 10);
    const tomorrowObj = new Date(nowObj);
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().slice(0, 10);
    const dayOfWeekStr = nowObj.toLocaleDateString("en-US", { weekday: "long" });

    // 2. Structured Intent Prompt for Gemini
    const intentPrompt = `You are the official VSync HRMS Employee AI Copilot.
Your job is to understand employee requests, resolve relative dates, and output structured intent JSON.

SERVER CALENDAR CONTEXT:
- Today's Date: ${todayStr} (${dayOfWeekStr})
- Tomorrow's Date: ${tomorrowStr}

AVAILABLE ACTIONS:
- "draft_leave_request": apply for leave. Params: from (YYYY-MM-DD), to (YYYY-MM-DD), leaveType ("Casual Leave"|"Sick Leave"|"Paid Leave"), reason
- "draft_cancel_leave": cancel pending/approved leave. Params: leaveRequestId (optional), from (optional)
- "draft_wfh_request": apply for WFH. Params: fromDate (YYYY-MM-DD), toDate (YYYY-MM-DD), requestedMode ("WFH"), reason
- "draft_expense_request": apply for expense reimbursement. Params: amount (number), category (string), description (string), date (YYYY-MM-DD)
- "draft_overtime_request": apply for overtime hours. Params: hours (number), date (YYYY-MM-DD), reason (string), fromTime (HH:mm), toTime (HH:mm)
- "draft_punch_out_request": request missing punch out. Params: originalDate (YYYY-MM-DD), time (HH:mm), reason (string)
- "draft_issue_request": raise support ticket. Params: subject (string), message (string)
- "draft_resignation_request": submit resignation. Params: reason (string)
- "draft_punch_in": punch in attendance. Params: note (optional)
- "draft_punch_out": punch out attendance. Params: note (optional)
- "get_leave_balance": check leave balances. Params: {}
- "get_my_expenses": check expense claims. Params: {}
- "get_my_overtime": check overtime summary. Params: {}
- "get_my_payslip": check salary payslip. Params: {}
- "get_my_notices": check company notices and meetings. Params: {}
- "get_my_issues": check raised tickets. Params: {}
- "get_my_resignation": check resignation status. Params: {}
- "get_my_attendance": check attendance log. Params: {}
- "get_upcoming_holidays": check upcoming holidays. Params: {}
- "get_my_shifts": check shift schedule. Params: {}
- "get_my_profile": check profile. Params: {}
- "reply": general conversation or policy question. Params: replyText

RULES:
1. Clean and normalize all descriptions, reasons, and subjects into crisp, professional phrases (max 60 chars), removing repetitive noise words (e.g. "500 for travel expense for client meeting to travel" → "Client travel for meeting", "i am having severe fever" → "Severe fever").
2. If asking a policy question, use the HR Policy context below and output: {"action": "reply", "replyText": "Your markdown answer..."}
3. OUTPUT ONLY VALID JSON. DO NOT INCLUDE MARKDOWN CODE BLOCKS OR EXTRA TEXT.

--- RETRIEVED HR POLICY KNOWLEDGE (RAG CONTEXT) ---
${formattedContext || "No specific policy document retrieved."}

USER QUERY: "${message}"`;

    let responseText = null;

    // Try Gemini API keys & models — ALL errors are silently caught; deterministic fallback handles failures
    try {
      if (apiKeys.length > 0) {
        outer: for (const apiKey of apiKeys) {
          const genAI = new GoogleGenerativeAI(apiKey);

          for (const modelName of CANDIDATE_MODELS) {
            try {
              const model = genAI.getGenerativeModel({ model: modelName });
              const result = await model.generateContent(intentPrompt);
              if (result?.response) {
                responseText = result.response.text().trim();
                console.log(`✅ Gemini response received via model ${modelName}`);
                break outer;
              }
            } catch (err) {
              console.warn(`⚠️ Model ${modelName} failed, trying next...`);
              continue;
            }
          }
        }
      }
    } catch (geminiBlockErr) {
      // Safety net — Gemini block errors never propagate
      console.warn("⚠️ Gemini block caught unexpected error, using fallback:", geminiBlockErr.message);
    }

    let intentData = null;

    if (responseText) {
      let cleanJsonStr = responseText;
      if (cleanJsonStr.startsWith("```json")) {
        cleanJsonStr = cleanJsonStr.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleanJsonStr.startsWith("```")) {
        cleanJsonStr = cleanJsonStr.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      try {
        intentData = JSON.parse(cleanJsonStr);
      } catch (parseErr) {
        intentData = { action: "reply", replyText: responseText };
      }
    }

    // 3. Robust Intent Fallback (Guarantees zero 404 / 100% uptime)
    if (!intentData || !intentData.action) {
      console.log("ℹ️ Using deterministic intent classifier fallback.");
      intentData = classifyIntentTraditional(message, todayStr, tomorrowStr);
    }

    let replyText = "";
    let actionCard = null;
    let toolResultData = null;

    if (intentData.action && intentData.action !== "reply") {
      const toolName = intentData.action;
      const toolArgs = { ...intentData };
      delete toolArgs.action;

      // Universal NLU description sanitization & normalization
      if (toolArgs.reason) {
        const domain = toolName.includes("leave") ? "leave" : toolName.includes("wfh") ? "wfh" : toolName.includes("overtime") ? "overtime" : "general";
        toolArgs.reason = normalizeDescription(toolArgs.reason, domain) || toolArgs.reason;
      }
      if (toolArgs.description) {
        toolArgs.description = normalizeDescription(toolArgs.description, "expense") || toolArgs.description;
      }
      if (toolArgs.subject) {
        toolArgs.subject = normalizeDescription(toolArgs.subject, "issue") || toolArgs.subject;
      }

      console.log(`🤖 Executing tool action: ${toolName}`, toolArgs);

      try {
        const toolOutput = await executeCopilotTool(toolName, toolArgs, user);

        if (toolOutput.actionCard) {
          actionCard = toolOutput.actionCard;
          replyText = toolOutput.message;
        } else {
          toolResultData = toolOutput;
          replyText = toolOutput.message || "I have fetched your details.";

          if (toolName === "get_leave_balance") {
            actionCard = {
              type: "leave_balance_widget",
              title: "Your Leave Balances",
              data: toolOutput,
            };
          } else if (toolName === "get_upcoming_holidays") {
            actionCard = {
              type: "upcoming_holidays_widget",
              title: "Upcoming Holidays",
              data: toolOutput.holidays,
            };
          } else if (toolName === "get_my_expenses") {
            actionCard = {
              type: "expense_widget",
              title: "Expense Claims",
              data: toolOutput,
            };
          } else if (toolName === "get_my_overtime") {
            actionCard = {
              type: "overtime_widget",
              title: "Overtime (OT) Summary",
              data: toolOutput,
            };
          } else if (toolName === "get_my_payslip") {
            actionCard = {
              type: "payslip_widget",
              title: "Latest Payslip Breakdown",
              data: toolOutput,
            };
          } else if (toolName === "get_my_notices") {
            actionCard = {
              type: "notices_widget",
              title: "Notices & Scheduled Meetings",
              data: toolOutput,
            };
          } else if (toolName === "get_my_issues") {
            actionCard = {
              type: "issues_widget",
              title: "Support Tickets",
              data: toolOutput,
            };
          } else if (toolName === "get_my_resignation") {
            actionCard = {
              type: "resignation_widget",
              title: "Resignation Status",
              data: toolOutput,
            };
          }
        }
      } catch (toolError) {
        console.error("❌ Copilot tool execution error:", toolError);
        replyText = `I encountered an issue processing that request: ${toolError.message}`;
      }
    } else {
      replyText = intentData.replyText || intentData.reply || "How can I assist you with your HR actions?";
    }

    return res.json({
      reply: replyText,
      sources: retrievedDocs,
      actionCard,
      toolResult: toolResultData,
    });
  } catch (error) {
    console.error("❌ Copilot Chat Controller Error:", error);
    // Last resort fallback — still return a usable response, never expose raw Gemini errors
    try {
      const nowFallback = new Date();
      const todayFallback = nowFallback.toISOString().slice(0, 10);
      const tomorrowFallback = new Date(nowFallback);
      tomorrowFallback.setDate(tomorrowFallback.getDate() + 1);
      const intentFallback = classifyIntentTraditional(
        req.body?.message || "",
        todayFallback,
        tomorrowFallback.toISOString().slice(0, 10)
      );
      if (intentFallback.action && intentFallback.action !== "reply") {
        const user = req.user;
        const toolArgs = { ...intentFallback };
        delete toolArgs.action;
        const toolOutput = await executeCopilotTool(intentFallback.action, toolArgs, user);
        return res.json({
          reply: toolOutput.message || "",
          sources: [],
          actionCard: toolOutput.actionCard || null,
        });
      }
      return res.json({
        reply: intentFallback.replyText || "How can I assist you with your HR actions today?",
        sources: [],
        actionCard: null,
      });
    } catch (finalErr) {
      return res.json({
        reply: "Hello! I am your VSync HR Copilot. Ask me to apply for leave, request WFH, check your leave balance, or view upcoming holidays!",
        sources: [],
        actionCard: null,
      });
    }
  }
};

/* =========================================================================
   ⚡ DETERMINISTIC EXECUTION ENGINE (Traditional Programming Only)
========================================================================= */
export const handleExecuteAction = async (req, res) => {
  try {
    const { actionToken } = req.body;
    const user = req.user;
    const io = req.app.get("io");

    if (!user) {
      return res.status(401).json({ error: "Unauthorized user." });
    }

    if (!actionToken) {
      return res.status(400).json({ error: "Action confirmation token is required." });
    }

    let decoded;
    try {
      decoded = jwt.verify(actionToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: "Invalid or expired action confirmation token." });
    }

    const currentUserId = (user._id || user.id || "").toString();
    const currentEmpId = (user.employeeId || "").toString();
    const tokenSub = (decoded.sub || "").toString();

    if (tokenSub !== currentUserId && tokenSub !== currentEmpId) {
      console.warn("⚠️ Token subject mismatch:", { tokenSub, currentUserId, currentEmpId });
      return res.status(403).json({ error: "Unauthorized action token subject mismatch." });
    }

    console.log(`⚡ [HRMS Action Engine] Executing confirmed action: "${decoded.actionType}" for user: ${user.name || user.email} (${currentUserId})`);

    switch (decoded.actionType) {
      case "confirm_leave_application": {
        const { from, to, leaveType, leaveDayType = "Full Day", reason } = decoded;
        const leaveDoc = await serviceApplyLeave({
          loggedUser: user,
          from,
          to,
          reason,
          leaveType,
          leaveDayType,
          io,
        });

        console.log(`✅ [HRMS Action Engine] Leave successfully created in MongoDB (ID: ${leaveDoc._id})`);

        return res.json({
          success: true,
          message: `✅ Leave request successfully submitted via HRMS Action Engine for ${from} to ${to}.`,
          data: leaveDoc,
        });
      }

      case "confirm_cancel_leave": {
        const { leaveRequestId } = decoded;
        const cancelledDoc = await serviceCancelLeave({
          loggedUser: user,
          leaveRequestId,
          io,
        });

        return res.json({
          success: true,
          message: `✅ Leave request for ${cancelledDoc.from} to ${cancelledDoc.to} (${cancelledDoc.leaveType}) successfully cancelled.`,
          data: cancelledDoc,
        });
      }

      case "confirm_wfh_request": {
        const { fromDate, toDate, requestedMode = "WFH", reason } = decoded;
        const wfhDoc = await serviceApplyWFH({
          loggedUser: user,
          fromDate,
          toDate,
          requestedMode,
          reason,
          io,
        });

        return res.json({
          success: true,
          message: `✅ ${requestedMode} request successfully submitted via HRMS Action Engine for ${fromDate} to ${toDate}.`,
          data: wfhDoc,
        });
      }

      case "confirm_punch_in": {
        const result = await servicePunchIn({
          loggedUser: user,
          date: decoded.date,
          note: decoded.note,
          io,
        });

        return res.json({
          success: true,
          message: `✅ Successfully punched in for today (${result.date}) at ${new Date(result.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
          data: result,
        });
      }

      case "confirm_punch_out": {
        const result = await servicePunchOut({
          loggedUser: user,
          date: decoded.date,
          note: decoded.note,
          io,
        });

        return res.json({
          success: true,
          message: `✅ Successfully punched out for today (${result.date}) at ${new Date(result.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
          data: result,
        });
      }

      case "confirm_expense_request": {
        const { category, amount, description, date } = decoded;
        const expDoc = await serviceApplyExpense({
          loggedUser: user,
          category,
          amount,
          description,
          date,
          io,
        });

        return res.json({
          success: true,
          message: `✅ Expense claim for ₹${Number(amount).toLocaleString()} (${category}) successfully submitted for admin review.`,
          data: expDoc,
        });
      }

      case "confirm_overtime_request": {
        const { date, hours, reason, fromTime, toTime } = decoded;
        const otDoc = await serviceApplyOvertime({
          loggedUser: user,
          date,
          hours,
          reason,
          fromTime,
          toTime,
          io,
        });

        return res.json({
          success: true,
          message: `✅ Overtime claim for ${hours} hours on ${date} successfully submitted for approval.`,
          data: otDoc,
        });
      }

      case "confirm_punch_out_request": {
        const { originalDate, requestedPunchOut, reason } = decoded;
        const reqDoc = await serviceRequestPunchOut({
          loggedUser: user,
          originalDate,
          requestedPunchOut,
          reason,
          io,
        });

        return res.json({
          success: true,
          message: `✅ Missing Punch-Out Request for ${originalDate} successfully submitted for verification.`,
          data: reqDoc,
        });
      }

      case "confirm_issue_request": {
        const { subject, message } = decoded;
        const issueDoc = await serviceSubmitIssue({
          loggedUser: user,
          subject,
          message,
          io,
        });

        return res.json({
          success: true,
          message: `✅ Support ticket "${subject}" has been successfully created and sent to administration.`,
          data: issueDoc,
        });
      }

      case "confirm_resignation_request": {
        const { reason } = decoded;
        const resDoc = await serviceSubmitResignation({
          loggedUser: user,
          reason,
          io,
        });

        return res.json({
          success: true,
          message: `✅ Resignation request successfully registered and sent to HR/Management for processing.`,
          data: resDoc,
        });
      }

      case "confirm_work_update": {
        const { title, description, percentage = 100, date } = decoded;
        const workDoc = await serviceSubmitWorkUpdate({
          loggedUser: user,
          title,
          description,
          percentage,
          date,
          io,
        });

        console.log(`✅ [HRMS Action Engine] Daily work update recorded for user: ${user.name || user.email}`);

        return res.json({
          success: true,
          message: `✅ Daily work update (${percentage}% completed) successfully submitted for admin review.`,
          data: workDoc,
        });
      }

      default:
        return res.status(400).json({ error: `Unsupported action type: ${decoded.actionType}` });
    }
  } catch (error) {
    console.error("❌ Copilot Execute Action Error:", error);
    return res.status(400).json({ error: error.message || "Failed to execute action." });
  }
};

/* ============================================================================
   REGENERATE SIGNED ACTION TOKEN WITH EDITED DETAILS (Editable Confirmation Cards)
============================================================================ */
export const handleUpdateDraftAction = async (req, res) => {
  try {
    const { actionType, data } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Unauthorized user." });
    }

    if (!actionType || !data) {
      return res.status(400).json({ error: "actionType and data are required." });
    }

    const userId = user._id || user.id;
    let updatedActionCard = null;

    switch (actionType) {
      case "confirm_leave_application": {
        const { from, to, leaveType = "Casual Leave", leaveDayType = "Full Day", reason } = data;
        const d1 = new Date(from);
        const d2 = new Date(to || from);
        const diffTime = d2.getTime() - d1.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24)) + 1;
        const totalDays = leaveDayType === "Half Day" ? 0.5 : Math.max(1, diffDays);

        const adminIdObj = user.adminId || user._id;
        const empIdStr = (user.employeeId || userId).toString();
        const { remaining } = await checkEmployeeLeaveBalance(adminIdObj, empIdStr, leaveType);

        const actionToken = jwt.sign(
          {
            sub: userId.toString(),
            actionType: "confirm_leave_application",
            from,
            to: to || from,
            leaveType,
            leaveDayType,
            reason: reason || "Casual leave application",
            totalDays,
          },
          process.env.JWT_SECRET,
          { expiresIn: "30m" }
        );

        updatedActionCard = {
          type: "confirm_leave_application",
          title: "Leave Application Confirmation (Updated)",
          actionToken,
          data: {
            from,
            to: to || from,
            leaveType,
            leaveDayType,
            reason: reason || "Casual leave application",
            totalDays,
            remainingBalance: remaining,
            applicantName: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Employee",
          },
        };
        break;
      }

      case "confirm_expense_request": {
        const { category = "General", amount = 500, description, date } = data;
        const amountNum = parseFloat(amount) || 500;
        const actionToken = jwt.sign(
          {
            sub: userId.toString(),
            actionType: "confirm_expense_request",
            category,
            amount: amountNum,
            description: description || `${category} expense claim`,
            date: date || new Date().toISOString().slice(0, 10),
          },
          process.env.JWT_SECRET,
          { expiresIn: "30m" }
        );

        updatedActionCard = {
          type: "confirm_expense_request",
          title: "Expense Reimbursement (Updated)",
          actionToken,
          data: {
            category,
            amount: amountNum,
            description: description || `${category} expense claim`,
            date: date || new Date().toISOString().slice(0, 10),
          },
        };
        break;
      }

      case "confirm_overtime_request": {
        const { date, hours = 2, reason, fromTime = "18:00", toTime = "20:00" } = data;
        const hoursNum = parseFloat(hours) || 2;
        const actionToken = jwt.sign(
          {
            sub: userId.toString(),
            actionType: "confirm_overtime_request",
            date: date || new Date().toISOString().slice(0, 10),
            hours: hoursNum,
            reason: reason || "Overtime worked",
            fromTime,
            toTime,
          },
          process.env.JWT_SECRET,
          { expiresIn: "30m" }
        );

        updatedActionCard = {
          type: "confirm_overtime_request",
          title: "Overtime (OT) Claim (Updated)",
          actionToken,
          data: {
            date: date || new Date().toISOString().slice(0, 10),
            hours: hoursNum,
            reason: reason || "Overtime worked",
            fromTime,
            toTime,
          },
        };
        break;
      }

      case "confirm_wfh_request": {
        const { fromDate, toDate, requestedMode = "WFH", reason } = data;
        const actionToken = jwt.sign(
          {
            sub: userId.toString(),
            actionType: "confirm_wfh_request",
            fromDate,
            toDate: toDate || fromDate,
            requestedMode,
            reason: reason || "Work from home request",
          },
          process.env.JWT_SECRET,
          { expiresIn: "30m" }
        );

        updatedActionCard = {
          type: "confirm_wfh_request",
          title: "Remote Work / WFH (Updated)",
          actionToken,
          data: {
            fromDate,
            toDate: toDate || fromDate,
            requestedMode,
            reason: reason || "Work from home request",
          },
        };
        break;
      }

      case "confirm_punch_out_request": {
        const { originalDate, time = "18:30", reason } = data;
        const [hh, mm] = (time || "18:30").split(":");
        const pDate = new Date(originalDate || new Date());
        pDate.setHours(parseInt(hh, 10) || 18, parseInt(mm, 10) || 30, 0, 0);

        const actionToken = jwt.sign(
          {
            sub: userId.toString(),
            actionType: "confirm_punch_out_request",
            originalDate: originalDate || new Date().toISOString().slice(0, 10),
            requestedPunchOut: pDate.toISOString(),
            reason: reason || "Missing punch-out request",
          },
          process.env.JWT_SECRET,
          { expiresIn: "30m" }
        );

        updatedActionCard = {
          type: "confirm_punch_out_request",
          title: "Missing Punch-Out Request (Updated)",
          actionToken,
          data: {
            originalDate: originalDate || new Date().toISOString().slice(0, 10),
            time,
            reason: reason || "Missing punch-out request",
          },
        };
        break;
      }

      case "confirm_issue_request": {
        const { subject, message: msgText } = data;
        const actionToken = jwt.sign(
          {
            sub: userId.toString(),
            actionType: "confirm_issue_request",
            subject: subject || "Support Ticket",
            message: msgText || subject || "Support issue details",
          },
          process.env.JWT_SECRET,
          { expiresIn: "30m" }
        );

        updatedActionCard = {
          type: "confirm_issue_request",
          title: "Support Ticket (Updated)",
          actionToken,
          data: {
            subject: subject || "Support Ticket",
            message: msgText || subject || "Support issue details",
          },
        };
        break;
      }

      case "confirm_resignation_request": {
        const { reason } = data;
        const actionToken = jwt.sign(
          {
            sub: userId.toString(),
            actionType: "confirm_resignation_request",
            reason: reason || "Personal career decision",
          },
          process.env.JWT_SECRET,
          { expiresIn: "30m" }
        );

        updatedActionCard = {
          type: "confirm_resignation_request",
          title: "Resignation Request (Updated)",
          actionToken,
          data: {
            employeeName: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Employee",
            department: user.department || "General",
            reason: reason || "Personal career decision",
          },
        };
        break;
      }

      case "confirm_work_update": {
        const { title, description, percentage, date } = data;
        const actionToken = jwt.sign(
          {
            sub: userId.toString(),
            actionType: "confirm_work_update",
            title: (title || "Daily Work Update").trim(),
            description: (description || title || "Work update").trim(),
            percentage: Number(percentage) || 100,
            date: date || new Date().toISOString().slice(0, 10),
          },
          process.env.JWT_SECRET,
          { expiresIn: "30m" }
        );

        updatedActionCard = {
          type: "confirm_work_update",
          title: "Daily Work Update (Updated)",
          actionToken,
          data: {
            title: (title || "Daily Work Update").trim(),
            description: (description || title || "Work update").trim(),
            percentage: Number(percentage) || 100,
            date: date || new Date().toISOString().slice(0, 10),
            employeeName: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Employee",
          },
        };
        break;
      }

      default:
        return res.status(400).json({ error: `Cannot update action type: ${actionType}` });
    }

    return res.json({
      success: true,
      message: "Action details updated and signed token regenerated.",
      actionCard: updatedActionCard,
    });
  } catch (error) {
    console.error("❌ Update Draft Action Error:", error);
    return res.status(400).json({ error: error.message || "Failed to update draft action." });
  }
};

