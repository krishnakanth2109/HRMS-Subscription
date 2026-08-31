import jwt from "jsonwebtoken";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { retrieveRelevantHRContext } from "../services/copilotRAGService.js";
import { executeCopilotTool, checkEmployeeLeaveBalance } from "../services/copilotTools.js";
import {
  serviceApplyLeave,
  serviceCancelLeave,
  serviceApplyWFH,
  serviceUpdateWFH,
  servicePunchIn,
  servicePunchOut,
  servicePunchBreak,
  serviceSubmitLateCorrection,
  serviceApplyExpense,
  serviceApplyOvertime,
  serviceRequestPunchOut,
  serviceSubmitIssue,
  serviceSubmitResignation,
  serviceSubmitWorkUpdate,
  serviceReplyNotice,
  serviceUpdateProfile,
  serviceCancelWFH,
  serviceCancelExpense,
  serviceCancelOvertime,
  serviceStartFieldWork,
  serviceEndFieldWork,
  serviceSendMessage,
  serviceRequestOnTimeLogin,
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
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro",
  "gemini-pro",
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

export const fuzzyNormalizeText = (text) => {
  if (!text || typeof text !== "string") return "";
  let t = text.toLowerCase().trim();
  
  // Common HRMS Typos & Colloquial Abbreviations
  return t
    .replace(/\b(leav|leve|levae|leev|leves|leavs)\b/g, "leave")
    .replace(/\b(atendance|atendence|atndance|attandance|attendence)\b/g, "attendance")
    .replace(/\b(expenes|expnse|expanse|expaneses|reimbersment|remburse|rembursment)\b/g, "expense")
    .replace(/\b(punc|pnch|puch|ponch)\b/g, "punch")
    .replace(/\b(overtme|ovrtime|ovetime)\b/g, "overtime")
    .replace(/\b(payslp|salry|slary|pay-slip)\b/g, "payslip")
    .replace(/\b(holidat|holida|hollyday|holydays)\b/g, "holiday")
    .replace(/\b(notic|notce|notces|announcment)\b/g, "notice")
    .replace(/\b(tommorow|tomm|tomoro|tomrw|tmrw|tmr)\b/g, "tomorrow")
    .replace(/\b(yestarday|yesturday|yday|ystrday)\b/g, "yesterday")
    .replace(/\b(resig|resing|resignaton)\b/g, "resignation")
    .replace(/\b(complnt|complaint|issu|isue)\b/g, "issue")
    .replace(/\b(linkedn|liknedin|linkdin|linkden)\b/g, "linkedin")
    .replace(/\b(githb|githup)\b/g, "github")
    .replace(/\b(instgram|insta|instagrm)\b/g, "instagram")
    .replace(/\b(websit|portfolo|portfilio)\b/g, "website")
    .replace(/\b(adhar|adharno|aadharno)\b/g, "aadhaar")
    .replace(/\b(mon|monday)\b/g, "monday")
    .replace(/\b(tue|tues|tuesday)\b/g, "tuesday")
    .replace(/\b(wed|wednesday)\b/g, "wednesday")
    .replace(/\b(thu|thur|thurs|thursday)\b/g, "thursday")
    .replace(/\b(fri|friday)\b/g, "friday");
};

export const classifyIntentTraditional = (message, todayStr, tomorrowStr, chatHistory = []) => {
  if (!message || typeof message !== "string") return null;

  const rawQ = message.toLowerCase().trim();
  const q = fuzzyNormalizeText(message);

  // ── 0. CONVERSATIONAL MULTI-TURN CONTEXT RESOLVER ──────────────────────────
  if (Array.isArray(chatHistory) && chatHistory.length > 0) {
    const lastAssistant = [...chatHistory].reverse().find((m) => m.role === "assistant")?.text?.toLowerCase() || "";
    const lastUser = [...chatHistory].reverse().find((m) => m.role === "user")?.text?.toLowerCase() || "";

    // Follow-up: "cancel that" / "withdraw that" / "cancel it" / "discard that"
    if (
      q === "cancel that" ||
      q === "cancel it" ||
      q === "withdraw that" ||
      q === "discard that" ||
      q === "cancel" ||
      q === "withdraw"
    ) {
      if (lastAssistant.includes("wfh") || lastUser.includes("wfh")) return { action: "draft_cancel_wfh" };
      if (lastAssistant.includes("expense") || lastUser.includes("expense")) return { action: "draft_cancel_expense" };
      return { action: "draft_cancel_leave" };
    }

    // Follow-up: Date / Mode amendment (e.g. "change it to monday", "make it tomorrow", "change to sick leave")
    if (
      q.startsWith("change it to") ||
      q.startsWith("change to") ||
      q.startsWith("make it") ||
      q.startsWith("set it to")
    ) {
      if (lastAssistant.includes("wfh") || lastUser.includes("wfh")) {
        const { from, to } = extractExplicitDateRange(message, todayStr, tomorrowStr);
        return { action: "draft_wfh_request", fromDate: from, toDate: to };
      }
      if (lastAssistant.includes("expense") || lastUser.includes("expense")) {
        const amountMatch = message.match(/(?:rs\.?|inr|₹|\$)\s*(\d+(?:,\d+)*(?:\.\d+)?)/i) || message.match(/\b(\d{2,7})\b/);
        if (amountMatch) {
          return { action: "draft_expense_request", amount: parseFloat(amountMatch[1].replace(/,/g, "")) };
        }
      }
      const { from, to } = extractExplicitDateRange(message, todayStr, tomorrowStr);
      return { action: "draft_leave_request", from, to };
    }
  }

  // ── 1. PUNCH IN / PUNCH OUT & MISSING PUNCH CORRECTION ────────────────────
  if (
    q.includes("on time") ||
    q.includes("ontime") ||
    q.includes("on-time") ||
    q.includes("late login") ||
    q.includes("late mark") ||
    q.includes("late entry") ||
    q.includes("late arrival") ||
    q.includes("came late") ||
    q.includes("got late") ||
    q.includes("reached late") ||
    q.includes("late request") ||
    (q.includes("late") && (q.includes("request") || q.includes("apply") || q.includes("traffic") || q.includes("reason") || q.includes("justify") || q.includes("correction") || q.includes("keep") || q.includes("put") || q.includes("submit") || q.includes("mark")))
  ) {
    const explicitDate = parseExplicitDate(message) || todayStr;
    const explicitReason = normalizeDescription(message, "general");
    return {
      action: "draft_request_ontime_login",
      date: explicitDate,
      reason: explicitReason || "On-time login requested via AI Copilot",
      requestedPunchIn: "09:30",
    };
  }

  if (
    q.includes("missed punch") ||
    q.includes("forgot punch") ||
    q.includes("forgot to punch") ||
    q.includes("punchout request") ||
    q.includes("punch out request") ||
    q.includes("punch correction") ||
    ((q.includes("punch out") || q.includes("checkout")) &&
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
    q === "punch in" ||
    q === "login" ||
    q === "clock in" ||
    q === "check in" ||
    q === "checkin" ||
    q.includes("punch in") ||
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
    q === "punch out" ||
    q === "logout" ||
    q === "clock out" ||
    q === "check out" ||
    q === "checkout" ||
    q === "sign out" ||
    q === "completed work" ||
    q === "work completed" ||
    q === "finished work" ||
    q === "work finished" ||
    q === "done with work" ||
    q.includes("punch out") ||
    q.includes("done for today") ||
    q.includes("done for the day") ||
    q.includes("completed work") ||
    q.includes("work completed") ||
    q.includes("finished work") ||
    q.includes("work finished") ||
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

  // ── 1B. REQUEST ON-TIME LOGIN / LATE LOGIN CORRECTION ───────────────────
  if (
    q === "request on time login" ||
    q === "request on-time login" ||
    q.includes("request on time login") ||
    q.includes("request on-time login") ||
    q.includes("on time login") ||
    q.includes("on-time login") ||
    q.includes("late correction") ||
    q.includes("late login request") ||
    q.includes("late login correction") ||
    q.includes("request late login") ||
    q.includes("request late correction") ||
    q.includes("waive late") ||
    q.includes("correct late login")
  ) {
    const explicitDate = parseExplicitDate(message);
    const date = explicitDate ? explicitDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const reasonMatch = message.match(/(?:reason|because|due\s+to|for)\s*[:\-]?\s*(.+)/i);
    const reason = reasonMatch ? reasonMatch[1].trim() : "Late login correction requested via AI Copilot";

    return {
      action: "draft_request_ontime_login",
      date,
      reason,
    };
  }

  // ── 2. BREAK MANAGEMENT (LUNCH / TEA / RESUME WORK / RETURN TO WORK / ON BREAK / APPLY BREAK) ──
  const isBreakUtterance =
    (q.includes("break") && !q.includes("breakfast") && !q.includes("broken")) ||
    q.includes("return to work") ||
    q.includes("back to work") ||
    q.includes("continue work") ||
    q.includes("resume work") ||
    q.includes("resumed work") ||
    q.includes("resume working") ||
    q.includes("resumed working") ||
    q.includes("started working") ||
    q.includes("start working again") ||
    q.includes("back from break") ||
    q.includes("ended break") ||
    q.includes("break over") ||
    q.includes("break finished") ||
    q.includes("break done") ||
    q.includes("resumed") ||
    q === "resume" ||
    q === "resumed";

  if (isBreakUtterance) {
    const breakType = q.includes("tea") ? "Tea Break" : "Lunch Break";
    return {
      action: "draft_punch_break",
      breakType,
    };
  }

  // ── 3. LEAVE BALANCE LOOKUP ───────────────────────────────────────────────
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
    q.includes("leave status") ||
    (q.includes("check") && q.includes("leave") && !q.includes("apply") && !q.includes("cancel"))
  ) {
    return { action: "get_leave_balance" };
  }

  // ── 4. CANCEL LEAVE ───────────────────────────────────────────────────────
  if (
    q === "cancel leave" ||
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

  // ── 5. SYMPTOMS & HEALTH CONDITIONS (AUTO-ROUTED TO SICK LEAVE) ───────────
  const SICKNESS_PATTERNS = [
    "fever", "cold", "cough", "headache", "stomach ache", "stomach pain",
    "vomiting", "migraine", "food poisoning", "hospital", "doctor appointment",
    "dentist", "surgery", "clinic", "unwell", "sick", "ill", "not feeling well",
    "not well", "high fever", "feeling sick", "sick day"
  ];
  const hasSymptom = SICKNESS_PATTERNS.some((sym) => q.includes(sym));

  // ── 6. LEAVE APPLICATION (CASUAL / SICK / PAID) ───────────────────────────
  if (
    hasSymptom ||
    q === "leave" ||
    q === "apply leave" ||
    q === "sick leave" ||
    q === "casual leave" ||
    q === "paid leave" ||
    q.includes("need leave") ||
    q.includes("want leave") ||
    q.includes("apply leave") ||
    q.includes("taking leave") ||
    q.includes("take leave") ||
    q.includes("request leave") ||
    q.includes("day off") ||
    q.includes("days off") ||
    q.includes("half day") ||
    q.includes("taking off") ||
    q.includes("off tomorrow") ||
    q.includes("off today") ||
    q.includes("leave tomorrow") ||
    q.includes("leave today") ||
    (q.includes("leave") && !q.includes("policy") && !q.includes("rule") && !q.includes("cancel") && !q.includes("balance") && !q.includes("history"))
  ) {
    const { from, to } = extractExplicitDateRange(message, todayStr, tomorrowStr);
    
    // Explicit Leave Type Identification
    const leaveType = (hasSymptom || q.includes("sick") || q.includes("sl"))
      ? "Sick Leave"
      : (q.includes("paid") || q.includes("annual") || q.includes("earned") || q.includes("pl") || q.includes("el"))
      ? "Paid Leave"
      : "Casual Leave";
      
    const leaveDayType = (q.includes("half day") || q.includes("half-day") || q.includes("0.5") || q.includes("first half") || q.includes("second half")) ? "Half Day" : "Full Day";
    
    const extractedReason = normalizeDescription(message, "leave");
    const symptomReason = hasSymptom ? SICKNESS_PATTERNS.find((s) => q.includes(s)) : null;
    const defaultReason = symptomReason ? `Unwell due to ${symptomReason}` : (leaveType === "Sick Leave" ? "Sick leave application" : "Casual leave application");
    
    return {
      action: "draft_leave_request",
      from,
      to,
      leaveType,
      leaveDayType,
      reason: extractedReason || defaultReason,
    };
  }

  // ── 7. WORK FROM HOME (WFH / REMOTE WORK) ─────────────────────────────────
  if (
    q === "wfh" ||
    q === "work from home" ||
    q === "remote" ||
    q === "remote work" ||
    q.includes("wfh") ||
    q.includes("work from home") ||
    q.includes("remote work") ||
    q.includes("working from home") ||
    q.includes("work remotely") ||
    q.includes("remote mode")
  ) {
    if (q.includes("cancel") || q.includes("withdraw") || q.includes("delete") || q.includes("remove") || q.includes("revoke")) {
      return { action: "draft_cancel_wfh" };
    }
    if (q.includes("history") || q.includes("status") || q.includes("requests") || (q.includes("check") && !q.includes("apply") && !q.includes("tomorrow"))) {
      return { action: "get_my_wfh_requests" };
    }

    const { from, to } = extractExplicitDateRange(message, todayStr, tomorrowStr);
    const requestedMode = q.includes("office") ? "Office" : "WFH";
    const cleanWfhReason = normalizeDescription(message, "wfh");
    return {
      action: "draft_wfh_request",
      fromDate: from,
      toDate: to,
      requestedMode,
      reason: cleanWfhReason || `${requestedMode} request`,
    };
  }

  // ── 8. EXPENSE REIMBURSEMENT ──────────────────────────────────────────────
  const EXPENSE_CATEGORIES = {
    Travel: ["cab", "taxi", "uber", "ola", "flight", "plane", "train", "metro", "bus", "auto", "petrol", "diesel", "fuel", "hotel", "travel", "trip", "fare", "toll", "parking"],
    Food: ["lunch", "dinner", "breakfast", "meal", "food", "restaurant", "cafe", "coffee", "tea", "snacks", "swiggy", "zomato", "team lunch", "team dinner"],
    Internet: ["wifi", "internet", "broadband", "phone", "mobile", "recharge", "airtel", "jio", "vi", "data pack"],
    Equipment: ["mouse", "keyboard", "monitor", "screen", "headphone", "headset", "earphones", "laptop", "charger", "cable", "adapter", "hardware", "hard disk", "ssd", "ram"],
    Stationery: ["print", "photocopy", "xerox", "courier", "paper", "pen", "notebook", "stationery", "stamp"]
  };

  let matchedExpenseCategory = "General";
  for (const [catName, keywords] of Object.entries(EXPENSE_CATEGORIES)) {
    if (keywords.some((kw) => q.includes(kw))) {
      matchedExpenseCategory = catName;
      break;
    }
  }

  const amountMatch = message.match(/(?:rs\.?|inr|₹|\$)\s*(\d+(?:,\d+)*(?:\.\d+)?)/i) || 
                     message.match(/\b(\d{2,7})\s*(?:rs|inr|rupees|\$)\b/i) ||
                     (matchedExpenseCategory !== "General" ? message.match(/\b(\d{2,7})\b/) : null);

  if (
    q.includes("expense") ||
    q.includes("reimburse") ||
    q.includes("claim") ||
    q.includes("bill") ||
    q.includes("receipt") ||
    (amountMatch && matchedExpenseCategory !== "General")
  ) {
    if (q.includes("cancel") || q.includes("withdraw") || q.includes("delete") || q.includes("remove")) {
      return { action: "draft_cancel_expense" };
    }

    const isExplicitInquiry = 
      q.startsWith("check") ||
      q.startsWith("view") ||
      q.startsWith("show") ||
      q.startsWith("list") ||
      q.startsWith("get") ||
      q.includes("my expense") ||
      q.includes("my claim") ||
      q.includes("expense claims") ||
      q.includes("claims list") ||
      q.includes("history") ||
      q.includes("status") ||
      q.includes("track") ||
      q === "expenses" ||
      q === "expense claims" ||
      q === "my claims" ||
      q.includes("check claims");

    const hasExplicitApplyVerb = q.includes("apply") || q.includes("submit") || q.includes("create") || q.includes("add") || q.includes("new claim") || q.includes("claim") || q.includes("spent") || q.includes("paid");

    if (!isExplicitInquiry && (amountMatch || hasExplicitApplyVerb)) {
      const amountVal = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : "";
      const explicitDate = parseExplicitDate(message) || todayStr;
      const cleanDesc = normalizeDescription(message, "expense");
      
      return {
        action: "draft_expense_request",
        amount: amountVal,
        category: matchedExpenseCategory,
        description: cleanDesc || `${matchedExpenseCategory} expense claim`,
        date: explicitDate,
      };
    }
    return { action: "get_my_expenses" };
  }

  // ── 9. OVERTIME (OT) ──────────────────────────────────────────────────────
  if (
    q.includes("overtime") ||
    q.includes(" ot ") ||
    q.startsWith("ot ") ||
    q === "ot" ||
    q === "overtime" ||
    q.includes("extra hour") ||
    q.includes("extra time") ||
    q.includes("extra work")
  ) {
    if (q.includes("cancel") || q.includes("withdraw") || q.includes("delete") || q.includes("revoke")) {
      return { action: "draft_cancel_overtime" };
    }

    const isExplicitInquiry = 
      q.startsWith("check") ||
      q.startsWith("view") ||
      q.startsWith("show") ||
      q.startsWith("list") ||
      q.startsWith("get") ||
      q.includes("my overtime") ||
      q.includes("my ot") ||
      q.includes("overtime claims") ||
      q.includes("history") ||
      q.includes("status") ||
      q.includes("track") ||
      q === "overtime" ||
      q === "ot" ||
      q.includes("check overtime");

    const hoursMatch = message.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i) || message.match(/\b(\d+(?:\.\d+)?)\s*extra\b/i);
    const hasExplicitApplyVerb = q.includes("apply") || q.includes("submit") || q.includes("request") || q.includes("add") || q.includes("worked") || q.includes("claim");

    if (!isExplicitInquiry && (hoursMatch || hasExplicitApplyVerb)) {
      const hoursVal = hoursMatch ? parseFloat(hoursMatch[1]) : "";
      const explicitDate = parseExplicitDate(message) || (q.includes("yesterday") ? parseExplicitDate("yesterday") : todayStr);
      const timeParsed = extractExplicitTime(message);
      const fromTime = timeParsed?.fromTime || "";
      const toTime = timeParsed?.toTime || "";
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

  // ── 10. DAILY WORK TRACKER & TASK REPORT ──────────────────────────────────
  if (
    q.includes("daily work") ||
    q.includes("work update") ||
    q.includes("task update") ||
    q.includes("todays work") ||
    q.includes("work log") ||
    q.includes("work report") ||
    q.includes("log work") ||
    q.includes("tracker")
  ) {
    if (
      q.includes("update") ||
      q.includes("submit") ||
      q.includes("log") ||
      q.includes("completed") ||
      q.includes("finished") ||
      q.includes("progress") ||
      q.includes("%")
    ) {
      const pctMatch = message.match(/(\d{1,3})\s*%/);
      const pctVal = pctMatch ? parseInt(pctMatch[1], 10) : 100;
      const cleanWorkTitle = normalizeDescription(message, "work") || "Daily Work Report";
      return {
        action: "draft_work_update",
        title: cleanWorkTitle,
        description: cleanWorkTitle,
        percentage: Math.min(100, Math.max(0, pctVal)),
      };
    }
    return { action: "get_my_daily_work" };
  }

  // ── 11. PAYSLIP & SALARY ──────────────────────────────────────────────────
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
    if (q.includes("history") || q.includes("all") || q.includes("past")) {
      return { action: "get_payslip_history" };
    }
    return { action: "get_my_payslip" };
  }

  // ── 12. NOTICES, ANNOUNCEMENTS & MEETINGS ─────────────────────────────────
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
    if (q.includes("reply") || q.includes("comment") || q.includes("respond")) {
      const cleanNoticeReply = normalizeDescription(message, "general") || "Thank you for the update.";
      return { action: "draft_notice_reply", message: cleanNoticeReply };
    }
    return { action: "get_my_notices" };
  }

  // ── 13. HOLIDAYS ──────────────────────────────────────────────────────────
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

  // ── 14. SHIFTS & SCHEDULE ─────────────────────────────────────────────────
  if (
    q === "shift" ||
    q === "my shift" ||
    q === "timing" ||
    q === "work hours" ||
    q.includes("shift") ||
    q.includes("work hours") ||
    q.includes("grace period")
  ) {
    return { action: "get_my_shifts" };
  }

  // ── 15. ATTENDANCE LOG & STATS ────────────────────────────────────────────
  if (
    q === "attendance" ||
    q === "my attendance" ||
    q.includes("attendance") ||
    q.includes("hours worked") ||
    q.includes("log sheet")
  ) {
    if (q.includes("today") || q.includes("did i punch")) return { action: "get_today_attendance" };
    return { action: "get_my_attendance" };
  }

  // ── 16. PROFILE DETAILS & UPDATES ─────────────────────────────────────────
  const isProfileUpdateVerb =
    q.includes("update") ||
    q.includes("change") ||
    q.includes("set") ||
    q.includes("edit") ||
    q.includes("modify") ||
    q.includes("correct") ||
    q.includes("save") ||
    q.includes("replace");

  const hasProfileField =
    q.includes("email") ||
    q.includes("mail") ||
    q.includes("name") ||
    q.includes("gender") ||
    q.includes("phone") ||
    q.includes("mobile") ||
    q.includes("contact") ||
    q.includes("address") ||
    q.includes("aadhar") ||
    q.includes("aadhaar") ||
    q.includes("pan") ||
    q.includes("bank") ||
    q.includes("account") ||
    q.includes("ifsc") ||
    q.includes("branch") ||
    q.includes("emergency") ||
    q.includes("nationality") ||
    q.includes("bio") ||
    q.includes("about") ||
    q.includes("dob") ||
    q.includes("birth") ||
    q.includes("marital") ||
    q.includes("blood") ||
    q.includes("qualification") ||
    q.includes("education") ||
    q.includes("degree") ||
    q.includes("linkedin") ||
    q.includes("github") ||
    q.includes("instagram") ||
    q.includes("social") ||
    q.includes("website") ||
    q.includes("portfolio") ||
    q.includes("link") ||
    q.includes("profile");

  if (isProfileUpdateVerb && hasProfileField) {
    let field = "name";
    let val = "";

    // Email ID
    if (q.includes("email") || q.includes("mail")) {
      field = "email";
      const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        val = emailMatch[0].trim();
      } else {
        const afterKw = message.split(/email(?:\s+id|\s+address)?(?:\s*[:\-=]|to|is)?/i)[1];
        val = afterKw ? afterKw.trim() : normalizeDescription(message, "general");
      }
    }
    // Aadhar / Aadhaar
    else if (q.includes("aadhar") || q.includes("aadhaar")) {
      field = "aadhaarNumber";
      const aadharMatch = message.match(/(?:aadhar|aadhaar)(?:\s+number)?\s*[:\-=]*\s*([0-9\s\-]+)/i);
      if (aadharMatch) {
        val = aadharMatch[1].replace(/[\s\-]/g, "").trim();
      } else {
        val = message.replace(/[^0-9]/g, "");
      }
    }
    // PAN Card
    else if (q.includes("pan")) {
      field = "panNumber";
      const panMatch = message.match(/(?:pan)(?:\s+card|\s+number)?\s*[:\-=]*\s*([A-Za-z0-9]+)/i);
      if (panMatch) {
        val = panMatch[1].toUpperCase().trim();
      } else {
        const directPan = message.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/i);
        val = directPan ? directPan[0].toUpperCase() : normalizeDescription(message, "general");
      }
    }
    // Bank Account Number
    else if ((q.includes("account") || q.includes("bank account")) && !q.includes("bank name")) {
      field = "accountNumber";
      const accMatch = message.match(/(?:account)(?:\s+number)?\s*[:\-=]*\s*([0-9]+)/i);
      val = accMatch ? accMatch[1].trim() : message.replace(/[^0-9]/g, "");
    }
    // IFSC Code
    else if (q.includes("ifsc")) {
      field = "ifsc";
      const ifscMatch = message.match(/(?:ifsc)(?:\s+code)?\s*[:\-=]*\s*([A-Za-z0-9]+)/i);
      val = ifscMatch ? ifscMatch[1].toUpperCase().trim() : normalizeDescription(message, "general").toUpperCase();
    }
    // Bank Name
    else if (q.includes("bank name") || (q.includes("bank") && !q.includes("account"))) {
      field = "bankName";
      const bankMatch = message.match(/(?:bank(?:\s+name)?)\s*(?:is|to|:-|=|:)?\s*([a-zA-Z\s]+)/i);
      val = bankMatch ? bankMatch[1].trim() : normalizeDescription(message, "general");
    }
    // Branch
    else if (q.includes("branch")) {
      field = "branch";
      const branchMatch = message.match(/(?:branch)\s*(?:is|to|:-|=|:)?\s*([a-zA-Z0-9\s]+)/i);
      val = branchMatch ? branchMatch[1].trim() : normalizeDescription(message, "general");
    }
    // Blood Group
    else if (q.includes("blood")) {
      field = "bloodGroup";
      const bgMatch = message.match(/\b(A|B|AB|O)[+-]\b/i) || message.match(/(?:blood(?:\s+group)?)\s*(?:is|to|:-|=|:)?\s*([a-zA-Z+-]+)/i);
      val = bgMatch ? (bgMatch[1] || bgMatch[0]).toUpperCase() : "O+";
    }
    // Qualification / Education
    else if (q.includes("qualification") || q.includes("education") || q.includes("degree")) {
      field = "qualification";
      val = normalizeDescription(message, "general");
    }
    // Emergency Contact / Phone
    else if (q.includes("emergency")) {
      field = "emergency";
      const emPhoneMatch = message.match(/\b\d{10,12}\b/);
      val = emPhoneMatch ? emPhoneMatch[0] : normalizeDescription(message, "general");
    }
    // LinkedIn
    else if (q.includes("linkedin")) {
      field = "linkedin";
      const urlMatch = message.match(/\b(?:https?:\/\/|www\.)[^\s]+/i) ||
                       message.match(/(?:linkedin\.com\/[^\s]+)/i);
      if (urlMatch) {
        val = urlMatch[0];
      } else {
        const afterKw = message.split(/linkedin(?:\s+profile|\s+url|\s+link)?(?:\s*[:\-=]|to|is)?/i)[1];
        val = afterKw ? afterKw.trim() : normalizeDescription(message, "general");
      }
    }
    // GitHub
    else if (q.includes("github")) {
      field = "github";
      const urlMatch = message.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s]+/i) || message.match(/\bhttps?:\/\/[^\s]+/i);
      val = urlMatch ? urlMatch[0] : normalizeDescription(message, "general");
    }
    // Instagram
    else if (q.includes("instagram") || q.includes("insta")) {
      field = "instagram";
      const urlMatch = message.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^\s]+/i) || message.match(/\bhttps?:\/\/[^\s]+/i);
      val = urlMatch ? urlMatch[0] : normalizeDescription(message, "general");
    }
    // Website / Portfolio
    else if (q.includes("website") || q.includes("portfolio")) {
      field = "website";
      const urlMatch = message.match(/(?:https?:\/\/)?[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/i);
      val = urlMatch ? urlMatch[0] : normalizeDescription(message, "general");
    }
    // Nationality
    else if (q.includes("nationality")) {
      field = "nationality";
      const natMatch = message.match(/(?:nationality)\s*(?:is|to|:-|=|:)?\s*([a-zA-Z\s]+)/i);
      val = natMatch ? natMatch[1].trim() : "Indian";
    }
    // Bio / About Me
    else if (q.includes("bio") || q.includes("about me") || q.includes("about")) {
      field = "bio";
      const bioMatch = message.match(/(?:bio|about me|about)\s*(?:is|to|:-|=|:)?\s*(.+)/i);
      val = bioMatch ? bioMatch[1].trim() : normalizeDescription(message, "general");
    }
    // Name
    else if (q.includes("name")) {
      field = "name";
      const nameMatch = message.match(/(?:change|update|set|edit)?\s*(?:my\s+)?(?:first\s+|last\s+)?name\s+(?:is\s+|to\s+|as\s+|:-\s*|:\s*|=\s*)?([a-zA-Z\s]+?)(?:\s+in\s+profile|\s+on\s+profile|\s+please|$)/i) ||
                        message.match(/\bname\s+(?:to\s+|is\s+|:-\s*|:\s*|=\s*)?([a-zA-Z\s]+)/i);
      if (nameMatch) {
        val = nameMatch[1].trim();
        val = val.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      } else {
        val = normalizeDescription(message, "general");
      }
    }
    // Gender
    else if (q.includes("gender")) {
      field = "gender";
      if (q.includes("female") || q.includes("woman") || q.includes("girl")) val = "Female";
      else if (q.includes("male") || q.includes("man") || q.includes("boy")) val = "Male";
      else if (q.includes("prefer not to say") || q.includes("other")) val = "Prefer not to say";
      else val = "Female";
    }
    // Phone / Mobile
    else if (q.includes("phone") || q.includes("mobile") || q.includes("contact")) {
      field = "phone";
      const phoneMatch = message.match(/\b\d{10,12}\b/);
      if (phoneMatch) val = phoneMatch[0];
      else val = message.replace(/[^0-9]/g, "");
    }
    // Address
    else if (q.includes("address") || q.includes("city") || q.includes("state") || q.includes("pincode")) {
      field = "address";
      val = normalizeDescription(message, "general");
    }
    // Marital Status
    else if (q.includes("marital")) {
      field = "maritalStatus";
      val = q.includes("married") ? "Married" : "Single";
    }
    // DOB / Date of Birth
    else if (q.includes("dob") || q.includes("birth")) {
      field = "dob";
      val = parseExplicitDate(message) || todayStr;
    }

    if (val) {
      return {
        action: "draft_update_profile",
        field,
        value: val,
      };
    }
  }

  // ── 16B. VIEW PROFILE (Strict Read-Only Inquiry) ──────────────────────────
  const isStrictProfileInquiry =
    !isProfileUpdateVerb &&
    !q.includes("update") &&
    !q.includes("change") &&
    !q.includes("set") &&
    !q.includes("edit") &&
    (q === "profile" ||
      q === "my profile" ||
      q === "view profile" ||
      q === "view my profile" ||
      q === "show profile" ||
      q === "show my profile" ||
      q === "emp id" ||
      q === "employee id" ||
      q === "who am i" ||
      q === "my details" ||
      q.includes("my designation") ||
      q.includes("my department") ||
      q.includes("check my profile") ||
      (q.includes("profile") && !q.includes("http") && !q.includes(".com")));

  if (isStrictProfileInquiry) {
    return { action: "get_my_profile" };
  }

  // ── 17. SUPPORT TICKETS / ISSUES ──────────────────────────────────────────
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

  // ── 18. RESIGNATION & EXIT ────────────────────────────────────────────────
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

  // ── 19. TEAM DIRECTORY ────────────────────────────────────────────────────
  if (
    q === "team" ||
    q === "my team" ||
    q.includes("team members") ||
    q.includes("colleagues") ||
    q.includes("who is in my department") ||
    q.includes("team directory") ||
    q.includes("view my team")
  ) {
    return { action: "get_my_team" };
  }

  // ── 20. COMPANY RULES & POLICIES ──────────────────────────────────────────
  if (
    q === "rules" ||
    q === "company rules" ||
    q === "office rules" ||
    q === "code of conduct" ||
    q.includes("company rules") ||
    q.includes("office rules") ||
    q.includes("code of conduct") ||
    q.includes("company guidelines") ||
    q.includes("office policies")
  ) {
    return { action: "get_company_rules" };
  }

  // ── 21. LEAVE POLICY RULES ────────────────────────────────────────────────
  if (
    q.includes("leave policy") ||
    q.includes("leave rules") ||
    q.includes("sandwich leave") ||
    q.includes("carry forward")
  ) {
    return { action: "get_leave_policy" };
  }

  // ── 22. OFFICE TIMINGS & SETTINGS ─────────────────────────────────────────
  if (
    q.includes("office timing") ||
    q.includes("grace period") ||
    q.includes("office location") ||
    q.includes("office hours")
  ) {
    return { action: "get_office_settings" };
  }

  // ── 23. DASHBOARD SUMMARY & DAILY OVERVIEW ────────────────────────────────
  if (
    q === "dashboard" ||
    q === "my dashboard" ||
    q === "summary" ||
    q === "daily overview" ||
    q === "overview" ||
    q.includes("dashboard") ||
    q.includes("today's summary") ||
    q.includes("todays summary") ||
    q.includes("daily summary") ||
    q.includes("my status today") ||
    q.includes("what is my status") ||
    q.includes("give me summary") ||
    q.includes("day summary") ||
    q.includes("today overview")
  ) {
    return { action: "get_dashboard_summary" };
  }

  // ── 24. FIELD WORK & LOCATION TRACKING ────────────────────────────────────
  if (
    q.includes("field work") ||
    q.includes("field trip") ||
    q.includes("field visit") ||
    q.includes("client visit") ||
    q.includes("on field")
  ) {
    if (
      q.includes("start") ||
      q.includes("begin") ||
      q.includes("commence") ||
      q.includes("going on") ||
      q.includes("out for")
    ) {
      return { action: "draft_start_field_work" };
    }
    if (
      q.includes("end") ||
      q.includes("stop") ||
      q.includes("finish") ||
      q.includes("complete") ||
      q.includes("done with") ||
      q.includes("returned from")
    ) {
      return { action: "draft_end_field_work" };
    }
    return { action: "get_field_work_history" };
  }

  // ── 25. CONNECT & DIRECT MESSAGING ────────────────────────────────────────
  const isMessageVerb =
    q.startsWith("message ") ||
    q.startsWith("send message ") ||
    q.startsWith("send msg ") ||
    q.startsWith("msg ") ||
    q.startsWith("chat with ") ||
    q.includes("send a message to ") ||
    q.includes("send message to ");

  if (isMessageVerb) {
    const msgMatch =
      message.match(/(?:send\s+a?\s*message|send\s+msg|msg|chat|message)\s+(?:to\s+|with\s+)?([a-zA-Z\s]+?)(?:\s*[:\-]\s*|\s+that\s+|\s+saying\s+|\s+is\s+)(.+)/i) ||
      message.match(/(?:send\s+a?\s*message|send\s+msg|msg|chat|message)\s+(?:to\s+|with\s+)?([a-zA-Z]+)\s+(.+)/i);

    if (msgMatch) {
      const receiverName = msgMatch[1].trim();
      const messageText = msgMatch[2].trim();
      if (receiverName && messageText) {
        return {
          action: "draft_send_message",
          receiverName,
          messageText,
        };
      }
    }
  }

  return {
    action: "reply",
    replyText: "",
  };
};

/* ============================================================================
   ⚡ MAIN COPILOT CHAT CONTROLLER: TRADITIONAL + RAG FIRST PIPELINE
   Priority 1: Deterministic Traditional Engine (<10ms)
   Priority 2: Local RAG Knowledge Policy Match (<15ms)
   Priority 3: Gemini Fallback for Complex / Ambiguous Requests
   Priority 4: Contextual HR Assistant Fallback
============================================================================ */
export const handleCopilotChat = async (req, res) => {
  let actionCard = null;
  let replyText = "";
  let toolResultData = null;
  let retrievedDocs = [];

  try {
    const { message, chatHistory = [] } = req.body;
    const user = req.user;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required." });
    }

    if (!user) {
      return res.status(401).json({ error: "Unauthorized user." });
    }

    const tenantCompanyId = user.company || user.companyId || null;
    const nowObj = new Date();
    const todayStr = nowObj.toISOString().slice(0, 10);
    const tomorrowObj = new Date(nowObj);
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().slice(0, 10);

    // =========================================================================
    // ⚡ STAGE 1: TRADITIONAL DETERMINISTIC INTENT ENGINE (Fast Path ~5-15ms)
    // =========================================================================
    const deterministicIntent = classifyIntentTraditional(message, todayStr, tomorrowStr, chatHistory);

    if (deterministicIntent && deterministicIntent.action && deterministicIntent.action !== "reply") {
      const toolName = deterministicIntent.action;
      const toolArgs = { ...deterministicIntent };
      delete toolArgs.action;

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

      console.log(`🤖 Executing fast-path tool action: ${toolName}`, toolArgs);

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

        return res.json({
          reply: replyText,
          sources: [],
          actionCard,
          toolResult: toolResultData,
        });
      } catch (toolErr) {
        console.error("❌ Fast-path tool error:", toolErr);
        return res.json({
          reply: `I encountered an issue executing that action: ${toolErr.message}`,
          sources: [],
          actionCard: null,
        });
      }
    }

    // =========================================================================
    // 🧠 STAGE 2: LOCAL VECTOR EMBEDDINGS / RAG KNOWLEDGE BASE (<15ms)
    // =========================================================================
    try {
      const ragResult = await retrieveRelevantHRContext(message, tenantCompanyId, 3);
      if (ragResult?.retrievedDocs?.length > 0) {
        const topDoc = ragResult.retrievedDocs[0];
        if (topDoc.score >= 0.55) {
          retrievedDocs = ragResult.retrievedDocs;
          return res.json({
            reply: `Here is the relevant information from our HR policy:\n\n${ragResult.formattedContext}`,
            sources: retrievedDocs,
            actionCard: null,
          });
        }
      }
    } catch (ragErr) {
      console.warn("⚠️ RAG Retrieval bypass:", ragErr.message);
    }

    // =========================================================================
    // 🤖 STAGE 3: GEMINI AI FALLBACK WITH TOOL CALLING (2.5s Strict Race Timeout)
    // =========================================================================
    const apiKeys = getCopilotApiKeys();
    if (apiKeys.length > 0) {
      for (const apiKey of apiKeys) {
        for (const modelName of CANDIDATE_MODELS) {
          try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: { maxOutputTokens: 250, temperature: 0.2 },
            });

            const prompt = `You are VSync HR AI Copilot for employees.
Current user: ${user.name || "Employee"} (ID: ${user.employeeId || user._id}). Today's date is ${todayStr}.
Respond politely, concisely, and helpfully to the user's message.
User inquiry: "${message}"`;

            const aiPromise = model.generateContent(prompt);
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Gemini timeout")), 2500)
            );

            const aiResult = await Promise.race([aiPromise, timeoutPromise]);
            const responseText = aiResult?.response?.text();
            if (responseText && responseText.trim()) {
              return res.json({
                reply: responseText.trim(),
                sources: [],
                actionCard: null,
              });
            }
          } catch (aiErr) {
            // Continue trying remaining candidate models
          }
        }
      }
    }

    // =========================================================================
    // 💡 STAGE 4: CONTEXTUAL HR ASSISTANT RESPONSE
    // =========================================================================
    return res.json({
      reply: `I understand your request: "${message}". You can ask me to apply for leave, request WFH, submit expenses, claim overtime, punch in/out, log daily work, check payslips, or update your profile details!`,
      sources: [],
      actionCard: null,
    });
  } catch (error) {
    console.error("❌ Copilot Chat Controller Error:", error);
    return res.json({
      reply: "How can I assist you with your HR requests or company policies?",
      sources: [],
      actionCard: null,
    });
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
        const { latitude, longitude, lateReason } = req.body;
        const result = await servicePunchIn({
          loggedUser: user,
          date: decoded.date,
          note: decoded.note,
          latitude: latitude || decoded.latitude,
          longitude: longitude || decoded.longitude,
          lateReason: lateReason || decoded.lateReason,
          io,
        });

        const lateMsg = result.loginStatus === "LATE" ? ` (Recorded as Late: ${result.lateByMinutes}m)` : "";
        return res.json({
          success: true,
          message: `✅ Successfully punched in for today (${result.date}) at ${new Date(result.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${lateMsg}.`,
          data: result,
        });
      }

      case "confirm_punch_out": {
        const { latitude, longitude, earlyLeaveReason } = req.body;
        const result = await servicePunchOut({
          loggedUser: user,
          date: decoded.date,
          note: decoded.note,
          latitude: latitude || decoded.latitude,
          longitude: longitude || decoded.longitude,
          earlyLeaveReason: earlyLeaveReason || decoded.earlyLeaveReason,
          io,
        });

        return res.json({
          success: true,
          message: `✅ Successfully punched out for today (${result.date}) at ${new Date(result.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${result.workedHours}h worked).`,
          data: result,
        });
      }

      case "confirm_punch_break": {
        const { breakType = "Lunch Break" } = decoded;
        const result = await servicePunchBreak({
          loggedUser: user,
          breakType,
          io,
        });

        return res.json({
          success: true,
          message: `✅ ${result.message}`,
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

      case "confirm_punch_break": {
        const { breakType = "Lunch Break" } = decoded;
        const result = await servicePunchBreak({
          loggedUser: user,
          breakType,
          io,
        });

        return res.json({
          success: true,
          message: `✅ ${result.message}`,
          data: result,
        });
      }

      case "confirm_late_correction": {
        const { date, reason, requestedTime } = decoded;
        const result = await serviceSubmitLateCorrection({
          loggedUser: user,
          date,
          reason,
          requestedTime,
          io,
        });

        return res.json({
          success: true,
          message: `✅ Late arrival justification for ${date} successfully submitted for approval.`,
          data: result,
        });
      }

      case "confirm_update_wfh": {
        const { requestId, fromDate, toDate, requestedMode = "WFH", reason } = decoded;
        const result = await serviceUpdateWFH({
          loggedUser: user,
          requestId,
          fromDate,
          toDate,
          requestedMode,
          reason,
          io,
        });

        return res.json({
          success: true,
          message: `✅ Remote work (${requestedMode}) request for ${fromDate} to ${toDate} successfully updated.`,
          data: result,
        });
      }

      case "confirm_notice_reply": {
        const { noticeId, message: replyMsg } = decoded;
        const result = await serviceReplyNotice({
          loggedUser: user,
          noticeId,
          message: replyMsg,
          io,
        });

        return res.json({
          success: true,
          message: `✅ Your reply has been posted to the announcement.`,
          data: result,
        });
      }

      case "confirm_update_profile": {
        const { field, value } = decoded;
        const result = await serviceUpdateProfile({
          loggedUser: user,
          field,
          value,
          io,
        });

        return res.json({
          success: true,
          message: `✅ Your profile ${field} has been successfully updated to "${value}"!`,
          data: result,
        });
      }

      case "confirm_cancel_wfh": {
        const { requestId } = decoded;
        const result = await serviceCancelWFH({
          loggedUser: user,
          requestId,
          io,
        });

        return res.json({
          success: true,
          message: `✅ Your pending Work From Home (WFH) request has been successfully cancelled.`,
          data: result,
        });
      }

      case "confirm_cancel_expense": {
        const { expenseId } = decoded;
        const result = await serviceCancelExpense({
          loggedUser: user,
          expenseId,
          io,
        });

        return res.json({
          success: true,
          message: `✅ Your pending expense reimbursement claim has been successfully cancelled.`,
          data: result,
        });
      }

      case "confirm_cancel_overtime": {
        const { overtimeId } = decoded;
        const result = await serviceCancelOvertime({
          loggedUser: user,
          overtimeId,
          io,
        });

        return res.json({
          success: true,
          message: `✅ Your pending overtime claim for ${result.hours} hours has been successfully cancelled.`,
          data: result,
        });
      }

      case "confirm_start_field_work": {
        const result = await serviceStartFieldWork({
          loggedUser: user,
          io,
        });

        return res.json({
          success: true,
          message: result.isResumed
            ? `📍 ${result.message}`
            : `📍 Field work trip started successfully! Live location tracking is active.`,
          data: result,
        });
      }

      case "confirm_end_field_work": {
        const { tripId } = decoded;
        const result = await serviceEndFieldWork({
          loggedUser: user,
          tripId,
          io,
        });

        return res.json({
          success: true,
          message: `🏁 Field work trip ended (${result.durationMins} mins, ${(result.distanceKm || 0).toFixed(1)} km). Trip summary saved.`,
          data: result,
        });
      }

      case "confirm_send_message": {
        const { receiverId, receiverName, messageText } = decoded;
        const result = await serviceSendMessage({
          loggedUser: user,
          receiverId,
          receiverName,
          messageText,
          io,
        });

        return res.json({
          success: true,
          message: `💬 Message successfully sent to **${result.receiverName}**!`,
          data: result,
        });
      }

      case "confirm_request_ontime_login": {
        const { date, reason, requestedPunchIn } = decoded;
        const result = await serviceRequestOnTimeLogin({
          loggedUser: user,
          date,
          reason,
          requestedPunchIn,
          io,
        });

        return res.json({
          success: true,
          message: `✅ ${result.message}`,
          data: result,
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

      case "confirm_late_correction": {
        const { date, reason } = data;
        const actionToken = jwt.sign(
          {
            sub: userId.toString(),
            actionType: "confirm_late_correction",
            date: date || new Date().toISOString().slice(0, 10),
            reason: reason || "Late arrival justification",
          },
          process.env.JWT_SECRET,
          { expiresIn: "30m" }
        );

        updatedActionCard = {
          type: "confirm_late_correction",
          title: "Late Arrival Justification (Updated)",
          actionToken,
          data: {
            date: date || new Date().toISOString().slice(0, 10),
            reason: reason || "Late arrival justification",
            employeeName: user.name || "Employee",
          },
        };
        break;
      }

      case "confirm_update_wfh": {
        const { requestId, fromDate, toDate, requestedMode = "WFH", reason } = data;
        const actionToken = jwt.sign(
          {
            sub: userId.toString(),
            actionType: "confirm_update_wfh",
            requestId,
            fromDate,
            toDate: toDate || fromDate,
            requestedMode,
            reason: reason || "Updated WFH request",
          },
          process.env.JWT_SECRET,
          { expiresIn: "30m" }
        );

        updatedActionCard = {
          type: "confirm_update_wfh",
          title: "Remote Work / WFH (Updated)",
          actionToken,
          data: {
            requestId,
            fromDate,
            toDate: toDate || fromDate,
            requestedMode,
            reason: reason || "Updated WFH request",
          },
        };
        break;
      }

      case "confirm_notice_reply": {
        const { noticeId, noticeTitle, message: replyMsg } = data;
        const actionToken = jwt.sign(
          {
            sub: userId.toString(),
            actionType: "confirm_notice_reply",
            noticeId,
            message: (replyMsg || "Thank you for the update.").trim(),
          },
          process.env.JWT_SECRET,
          { expiresIn: "30m" }
        );

        updatedActionCard = {
          type: "confirm_notice_reply",
          title: "Post Reply to Notice (Updated)",
          actionToken,
          data: {
            noticeId,
            noticeTitle: noticeTitle || "Notice Announcement",
            message: (replyMsg || "Thank you for the update.").trim(),
            employeeName: user.name || "Employee",
          },
        };
        break;
      }

      case "confirm_update_profile": {
        const { field = "gender", value, oldValue } = data;
        const actionToken = jwt.sign(
          {
            sub: userId.toString(),
            actionType: "confirm_update_profile",
            field,
            value,
          },
          process.env.JWT_SECRET,
          { expiresIn: "30m" }
        );

        updatedActionCard = {
          type: "confirm_update_profile",
          title: "Update Profile Confirmation (Updated)",
          actionToken,
          data: {
            field,
            oldValue: oldValue || "Current",
            value,
            employeeName: user.name || "Employee",
          },
        };
        break;
      }

      case "confirm_request_ontime_login": {
        const { date = new Date().toISOString().slice(0, 10), reason = "Late login correction", requestedPunchIn = "09:30" } = data;
        const actionToken = jwt.sign(
          {
            sub: userId.toString(),
            employeeId: user.employeeId || userId.toString(),
            date,
            reason,
            requestedPunchIn,
            actionType: "confirm_request_ontime_login",
          },
          process.env.JWT_SECRET,
          { expiresIn: "30m" }
        );

        updatedActionCard = {
          type: "confirm_request_ontime_login",
          title: "Request On-Time Login Confirmation (Updated)",
          actionToken,
          data: {
            date,
            reason,
            requestedStatus: "ON_TIME",
            requestedTime: requestedPunchIn,
            applicantName: user.name || "Employee",
          },
        };
        break;
      }

      case "confirm_punch_break": {
        const { breakType = "Lunch Break", isOnBreak = false } = data;
        const actionToken = jwt.sign(
          {
            sub: userId.toString(),
            actionType: "confirm_punch_break",
            breakType,
            isOnBreak: Boolean(isOnBreak),
          },
          process.env.JWT_SECRET,
          { expiresIn: "30m" }
        );

        updatedActionCard = {
          type: "confirm_punch_break",
          title: isOnBreak ? "Resume Work from Break (Updated)" : "Break Time Confirmation (Updated)",
          actionToken,
          data: {
            breakType: isOnBreak ? "Resume Work" : breakType,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            employeeName: user.name || "Employee",
            isOnBreak: Boolean(isOnBreak),
          },
        };
        break;
      }

      default: {
        const actionToken = jwt.sign(
          {
            sub: userId.toString(),
            actionType,
            ...data,
          },
          process.env.JWT_SECRET,
          { expiresIn: "30m" }
        );
        updatedActionCard = {
          type: actionType,
          title: "Confirmation (Updated)",
          actionToken,
          data: { ...data },
        };
        break;
      }
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

