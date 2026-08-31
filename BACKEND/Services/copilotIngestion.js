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
7. Applying via Copilot / App: Employees can draft, review, and confirm leave requests directly through the HRMS Copilot or Leave Management page.
    `.trim(),
  },
  {
    docId: "policy_sandwich_carryforward",
    title: "Sandwich Leave & Carry Forward Rules",
    category: "leave_policy",
    content: `
VSync HRMS Sandwich Leave and Carry-Forward Rules:
1. Sandwich Leave: When sandwich leave calculation is enabled by the organization, leaves taken immediately before and after a weekend or public holiday will count the weekend/holiday gap as leave days.
2. Carry Forward: Unused paid leave balances up to 10 days may be carried forward into the next annual cycle if carry-forward is active in the company leave policy.
3. Half-Day Leaves: Available for morning session (First Half: 9:00 AM - 1:30 PM) or afternoon session (Second Half: 1:30 PM - 6:00 PM).
4. Cancellation: Pending and future approved leaves can be cancelled through the portal or Copilot before the leave start date.
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
4. Break Tracking: Employees can log lunch breaks and short tea breaks using the Punch Break feature on the Dashboard.
5. Missing Punch Corrections: If an employee forgets to punch out, they can submit a Missing Punch-Out Request with date, time, and reason for admin approval.
6. Late Arrival Justification: Arriving late due to emergency or official duty can be justified via the Late Correction form.
    `.trim(),
  },
  {
    docId: "policy_wfh_remote",
    title: "Work From Home (WFH) & Remote Work Rules",
    category: "wfh_policy",
    content: `
VSync HRMS Work From Home (WFH) Guidelines:
1. WFH Approval: Working remotely requires prior request submission through the HRMS Work Mode Request module or Copilot and manager approval.
2. Frequency: Employees are allowed up to 4 WFH days per month unless specifically hired under a full-time Remote work agreement.
3. Availability: Remote employees must remain reachable on official chat/email during standard shift hours and attend all scheduled meetings.
4. Internet & Equipment: Employees working remotely must ensure stable high-speed internet connectivity.
5. Mode Updates: Existing pending WFH requests can be modified or updated with revised dates and reasons before admin approval.
    `.trim(),
  },
  {
    docId: "policy_expense_reimbursement",
    title: "Expense Claims & Reimbursement Policy",
    category: "expense_policy",
    content: `
VSync HRMS Expense Claims & Reimbursement Guidelines:
1. Eligible Categories: Travel (cabs, flights, trains, fuel), Food & Client Meals, Internet/Mobile Recharge, Equipment & Hardware, and Stationery.
2. Submission Window: Expense claims must be submitted within 30 days of expense date with supporting bills or receipts.
3. Approval Process: Claims are reviewed by the finance/admin department. Approved claims are credited with the monthly payroll.
4. Limits: Meals up to ₹500/day during official travel; daily client travel as per company rate card.
    `.trim(),
  },
  {
    docId: "policy_overtime_shift",
    title: "Overtime & Shift Management Policy",
    category: "overtime_policy",
    content: `
VSync HRMS Overtime (OT) and Shift Regulations:
1. Overtime Qualification: Work performed beyond assigned shift hours (minimum 1 extra hour) qualifies for Overtime credit if pre-approved by department head.
2. Overtime Rate: Approved overtime is compensated at 1.5x standard hourly rate or provided as compensatory off (Comp-Off) or incentive OT.
3. Shift Timings: Shifts are assigned by Admin/HR. Night shifts include shift differential allowance.
4. Shift Swaps: Shift swap requests must be submitted at least 48 hours in advance via the HRMS portal.
    `.trim(),
  },
  {
    docId: "policy_daily_work_tracker",
    title: "Daily Work Tracking & Performance System",
    category: "work_policy",
    content: `
VSync HRMS Daily Work Tracking Guidelines:
1. Morning Work Plan: Employees submit their morning task title and plan upon starting work.
2. Evening Work Summary: Employees submit their evening summary of completed tasks and self-assessed completion percentage (0-100%).
3. Performance Metrics: Daily submissions contribute directly to monthly performance scores and work completion metrics.
4. Copilot Integration: Work can be submitted by typing "Update my work for today" in the Copilot.
    `.trim(),
  },
  {
    docId: "policy_payroll_salary",
    title: "Payroll, Salary Slips & Encashment Rules",
    category: "payroll_guidelines",
    content: `
VSync HRMS Payroll & Remuneration Policy:
1. Salary Credit Date: Salaries are credited on the 1st of every month for the previous month's work period.
2. Salary Slips: Digital payslips are generated automatically and accessible under the Payroll / Payslip section after the 1st of the month.
3. Tax & Statutory Deductions: Deductions include PF (Provident Fund), ESI, Professional Tax, and Income Tax (TDS) based on statutory declarations.
4. Download: Employees can view breakdown (Basic, HRA, Special Allowances, Net Salary) and download historical salary slips.
    `.trim(),
  },
  {
    docId: "policy_code_of_conduct",
    title: "Company Rules, Code of Conduct & Workplace Ethics",
    category: "rules_guidelines",
    content: `
VSync HRMS Workplace Rules & Code of Conduct:
1. Professional Conduct: Mutual respect, anti-harassment (POSH compliance), integrity, and non-discrimination are mandatory.
2. Data Confidentiality: Company source code, employee information, and client data must remain strictly confidential.
3. Dress Code: Smart casual from Monday to Thursday; casual on Fridays.
4. Device & Asset Security: Company laptops and systems must have screen lock enabled when unattended.
5. Grievance Redressal: Technical or workplace issues can be submitted via the Support / Issue Ticket system.
    `.trim(),
  },
  {
    docId: "policy_resignation_exit",
    title: "Resignation Procedure & Exit Formalities",
    category: "resignation_policy",
    content: `
VSync HRMS Resignation & Exit Guidelines:
1. Submission: Formal resignation is submitted via the Employee Resignation page or Copilot with stated reasons.
2. Notice Period: Standard notice period is 30 days (or 60/90 days as per appointment letter).
3. Exit Formalities: Return company assets, ID cards, and Welcome Kit items; complete knowledge transfer; obtain department clearances.
4. Full & Final (F&F) Settlement: Processed within 30 to 45 days following the last working day.
    `.trim(),
  },
  {
    docId: "portal_feature_guidance",
    title: "Employee Portal Features & Navigation Guide",
    category: "portal_guidance",
    content: `
VSync HRMS Employee Portal Feature Navigation Guide:
1. Dashboard: Overview of today's attendance, punch in/out, break toggle, leaves balance, shift timings, and announcements.
2. Leave Management: Apply leaves, check balances, view applied leaves history, and cancel pending requests.
3. Daily Attendance: Monthly log calendar, punch in/out times, working hours, and missing punch-out correction requests.
4. Work Mode: Request Work From Home (WFH) or Work From Office (WFO), edit requests, and check approval status.
5. Expense Claims: Submit reimbursement bills for travel, food, internet, hardware; track approvals.
6. Overtime (OT): Submit overtime hours worked with task description.
7. Work Tracker: Log morning plans and evening task completion summaries.
8. Payslips: View and download monthly payslips with earnings and deduction breakdown.
9. Company Notices: View corporate announcements and post replies.
10. Holiday Calendar: View upcoming company holidays.
11. Rules & Policies: Access company rules, code of conduct, and guidelines.
12. Team Directory: Connect with colleagues, view department team members and contact emails.
13. Resignation: Submit resignation and track exit clearances.
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

