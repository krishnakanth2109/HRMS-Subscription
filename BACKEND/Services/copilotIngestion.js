import crypto from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import CopilotKnowledgeChunk from "../models/CopilotKnowledgeChunk.js";

export const HR_POLICY_DOCUMENTS = [
  {
    docId: "policy_leave_comprehensive",
    title: "Comprehensive Leave Policy & Rules",
    category: "leave_policy",
    content: `
VSync HRMS Leave Policy Guidelines:
1. Types of Leaves: Employees are entitled to Casual Leave (CL - 12 days/year), Sick Leave (SL - 10 days/year), and Paid/Earned Leave (PL - 15 days/year).
2. Casual Leave (CL): Must be requested at least 24 hours in advance. Maximum 3 consecutive CLs can be taken at a time.
3. Sick Leave (SL): Can be informed on the day of absence before 10:00 AM. For sick leave exceeding 2 consecutive days, a valid medical certificate from a registered practitioner is mandatory.
4. Paid/Earned Leave (PL): Requires manager approval at least 7 days in advance. PLs accumulate and can be encashed during annual review according to company encashment rules.
5. Maternity & Paternity Leave: Female employees receive 26 weeks of paid maternity leave. Male employees receive 5 days of paid paternity leave.
6. Unapproved Absence: Taking leave without prior application or approval will result in Loss of Pay (LOP) and a warning notice.
7. Applying via Copilot / App: Employees can draft and submit leave requests directly through the HRMS Dashboard.
    `.trim(),
  },
  {
    docId: "policy_attendance_grace",
    title: "Attendance, Punch-in & Grace Period Policy",
    category: "attendance_policy",
    content: `
VSync HRMS Attendance & Work Hours Rules:
1. Standard Working Hours: Standard full-time workday is 8 hours excluding break time (typically 9:00 AM to 6:00 PM or assigned shift).
2. Grace Period: A 15-minute grace period is granted for morning punch-in (up to 9:15 AM).
3. Late Mark Rule: Punching in after the 15-minute grace period counts as a Late Mark. Every 3 Late Marks in a calendar month results in a 0.5-day salary/leave deduction.
4. Half-Day Attendance: Working less than 4 hours in a day is marked as Half-Day unless approved as official leave or WFH.
5. Punch In / Punch Out Mandatory: Employees must punch in upon starting work and punch out upon completing work. Forgotten punches can be corrected by submitting a Punch-Out Request.
6. Idle Time & Tracking: Extended system inactivity without notification is logged as Idle Time and reviewed by department managers.
    `.trim(),
  },
  {
    docId: "policy_wfh_remote",
    title: "Work From Home (WFH) & Remote Work Rules",
    category: "wfh_policy",
    content: `
VSync HRMS Work From Home (WFH) Guidelines:
1. WFH Approval: Working remotely requires prior request submission through the HRMS Work Mode Request module and manager approval.
2. Frequency: Employees are allowed up to 4 WFH days per month unless specifically hired under a full-time Remote work agreement.
3. Availability: Remote employees must remain reachable on official chat/email during standard shift hours and attend all scheduled meetings.
4. Internet & Equipment: Employees working remotely must ensure stable high-speed internet connectivity.
    `.trim(),
  },
  {
    docId: "policy_overtime_shift",
    title: "Overtime & Shift Management Policy",
    category: "overtime_policy",
    content: `
VSync HRMS Overtime (OT) and Shift Regulations:
1. Overtime Qualification: Work performed beyond assigned shift hours (minimum 1 extra hour) qualifies for Overtime credit if pre-approved by department head.
2. Overtime Rate: Approved overtime is compensated at 1.5x standard hourly rate or provided as compensatory off (Comp-Off).
3. Shift Timings: Shifts are assigned by Admin/HR. Night shifts include shift differential allowance.
4. Swapping Shifts: Shift swap requests must be submitted at least 48 hours in advance via the HRMS portal.
    `.trim(),
  },
  {
    docId: "policy_holidays_weekends",
    title: "Company Holidays & Weekend Off Policy",
    category: "general_guidelines",
    content: `
VSync HRMS Holidays & Weekly Offs:
1. Paid Holidays: The company declares 10 to 12 national and regional paid holidays per calendar year.
2. Mandatory Holidays: Republic Day, Independence Day, Gandhi Jayanti, and major regional festivals.
3. Weekend Offs: Saturdays and Sundays are official non-working days unless a special weekend shift is scheduled.
4. Holiday List View: Employees can view upcoming holidays anytime on the HRMS Dashboard.
    `.trim(),
  },
  {
    docId: "policy_payroll_salary",
    title: "Payroll, Salary Slips & Encashment Rules",
    category: "payroll_guidelines",
    content: `
VSync HRMS Payroll & Remuneration Policy:
1. Salary Credit Date: Salaries are credited on the 1st of every month for the previous month's work period.
2. Salary Slips: Digital payslips are generated automatically and accessible under the Payroll section after the 1st of the month.
3. Tax & Statutory Deductions: Deductions include PF (Provident Fund), ESI, Professional Tax, and Income Tax (TDS) based on statutory declarations.
4. Reimbursable Expenses: Official travel/food expenses must be submitted with valid GST invoices under Expense Claims within 30 days.
    `.trim(),
  },
];

const getApiKeys = () => {
  return [
    process.env.COPILOT_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY,
  ].filter((key) => !!key && typeof key === "string" && key.trim() !== "");
};

// Deterministic 768-dimensional normalized text embedding generator fallback
export const generateDeterministicEmbedding = (text, dimensions = 768) => {
  const vector = new Array(dimensions).fill(0);
  const normalizedText = (text || "").toLowerCase().trim();
  if (!normalizedText) return vector;

  const tokens = normalizedText.split(/[\s,.;:!?()\[\]{}"'\-\/\\]+/).filter(Boolean);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    // Hash token to multiple indices with varying weights
    for (let k = 0; k < 3; k++) {
      const hash = crypto.createHash("sha256").update(`${token}_${k}`).digest();
      const index = hash.readUInt16BE(0) % dimensions;
      const sign = (hash.readUInt8(2) % 2 === 0 ? 1 : -1);
      const weight = (1.0 / Math.sqrt(i + 1)) * (1.0 / (k + 1));
      vector[index] += sign * weight;
    }
  }

  // L2 Normalize vector
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] = vector[i] / norm;
    }
  }

  return vector;
};

// Generate embedding using Gemini API models, with deterministic fallback
export const generateEmbedding = async (text) => {
  const apiKeys = getApiKeys();
  const candidateModels = ["text-embedding-004", "embedding-001"];

  if (apiKeys.length > 0) {
    for (const apiKey of apiKeys) {
      const genAI = new GoogleGenerativeAI(apiKey);

      for (const modelName of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.embedContent(text);
          if (result?.embedding?.values && result.embedding.values.length > 0) {
            return result.embedding.values;
          }
        } catch (err) {
          // Continue to next candidate/key
          continue;
        }
      }
    }
  }

  // Deterministic local embedding fallback (ensures 100% uptime without external API failures)
  return generateDeterministicEmbedding(text, 768);
};

// Automatic document chunking with overlap
export const autoChunkText = (content, maxChars = 400, overlap = 60) => {
  const cleanContent = (content || "").trim();
  if (cleanContent.length <= maxChars) {
    return [cleanContent];
  }

  const lines = cleanContent.split("\n").map((l) => l.trim()).filter(Boolean);
  const chunks = [];
  let currentChunk = "";

  for (const line of lines) {
    if ((currentChunk + "\n" + line).length <= maxChars) {
      currentChunk = currentChunk ? currentChunk + "\n" + line : line;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        // Create overlap from the tail of current chunk
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText ? overlapText + "\n" + line : line;
      } else {
        // Single line exceeds maxChars, split by sentences
        let start = 0;
        while (start < line.length) {
          const end = Math.min(start + maxChars, line.length);
          chunks.push(line.slice(start, end));
          start += (maxChars - overlap);
        }
      }
    }
  }

  if (currentChunk && !chunks.includes(currentChunk)) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [cleanContent];
};

// Calculate SHA-256 hash of content string
export const computeContentHash = (content) => {
  return crypto.createHash("sha256").update(content.trim()).digest("hex");
};

export const seedCopilotKnowledge = async (companyId = "global") => {
  try {
    // Drop obsolete unchunked unique index if it exists in MongoDB
    try {
      await CopilotKnowledgeChunk.collection.dropIndex("companyId_1_title_1");
    } catch (dropErr) {
      // Index didn't exist or already dropped
    }

    let updatedChunksCount = 0;
    let skippedChunksCount = 0;

    for (const doc of HR_POLICY_DOCUMENTS) {
      const chunks = autoChunkText(doc.content, 450, 60);
      const totalChunks = chunks.length;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const chunkText = chunks[chunkIndex];
        const chunkHash = computeContentHash(chunkText);

        const existing = await CopilotKnowledgeChunk.findOne({
          companyId,
          title: doc.title,
          chunkIndex,
        });

        // If chunk exists and content hash matches, skip re-embedding
        if (existing && existing.contentHash === chunkHash && existing.embedding?.length > 0) {
          skippedChunksCount++;
          continue;
        }

        // Generate embedding (API with automatic fallback)
        const embedding = await generateEmbedding(chunkText);
        const nextVersion = existing ? (existing.version || 1) + 1 : 1;

        await CopilotKnowledgeChunk.findOneAndUpdate(
          { companyId, title: doc.title, chunkIndex },
          {
            companyId,
            docId: doc.docId || doc.title.toLowerCase().replace(/\s+/g, "_"),
            title: doc.title,
            category: doc.category,
            content: chunkText,
            contentHash: chunkHash,
            chunkIndex,
            totalChunks,
            version: nextVersion,
            embedding,
          },
          { upsert: true, new: true }
        );

        updatedChunksCount++;
      }

      // Clean up any obsolete chunks if document was shortened
      await CopilotKnowledgeChunk.deleteMany({
        companyId,
        title: doc.title,
        chunkIndex: { $gte: totalChunks },
      });
    }

    if (updatedChunksCount > 0) {
      console.log(
        `✅ Ingested/Updated ${updatedChunksCount} chunked HR knowledge record(s) for [${companyId}]. (${skippedChunksCount} unchanged by content hash).`
      );
    } else {
      console.log(
        `🧠 Copilot HR Knowledge Base for [${companyId}] is up-to-date (${skippedChunksCount} chunks verified).`
      );
    }
  } catch (error) {
    console.error("❌ Copilot Knowledge Seeding Error:", error.message);
  }
};

