import express from "express";
import axios from "axios";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import xlsx from "xlsx";
import nodemailer from "nodemailer";
import HTMLtoDOCX from "html-to-docx";
import OfferLetterEmployee from "../models/OfferLetterEmployee.js";
import GeneratedLetter from "../models/GeneratedLetter.js";
import OfferLetterTemplate from "../models/OfferLetterTemplate.js";
import Company from "../models/CompanyModel.js";
import InvitedEmployee from "../models/Invitedemployee.js";
import PayrollRule from "../models/PayrollRule.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import { upload, cloudinary } from "../config/cloudinary.js";

const router = express.Router();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_PORT == 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false }
});

// The upload middleware from Cloudinary is now used directly on the route.

// ============================================================
// 1. CREATE Candidate (Offer Letter Employee)
// ============================================================
router.post("/employees", protect, onlyAdmin, async (req, res) => {
  try {
    const adminId = req.user._id;
    const {
      name, email, designation, department,
      joiningDate, joining_date,
      employmentType, employment_type,
      location, emp_id, compensation
    } = req.body;

    const jDate = joiningDate || joining_date || null;
    const eType = employmentType || employment_type || "Full Time";

    const newCandidate = new OfferLetterEmployee({
      adminId,
      name,
      email,
      designation,
      department,
      location: location || "",
      emp_id: emp_id || "",
      joining_date: jDate,
      employment_type: eType,
      compensation: compensation || {},
      status: "Pending"
    });

    const saved = await newCandidate.save();
    res.status(201).json(saved);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Duplicate email for this candidate." });
    }
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 1.5 UPDATE Candidate
// ============================================================
router.put("/employees/:id", protect, onlyAdmin, async (req, res) => {
  try {
    const adminId = req.user._id;
    const {
      name, email, designation, department,
      joiningDate, joining_date,
      employmentType, employment_type,
      location, emp_id, compensation, status
    } = req.body;

    const jDate = joiningDate || joining_date || null;
    const eType = employmentType || employment_type || "Full Time";

    const updated = await OfferLetterEmployee.findOneAndUpdate(
      { _id: req.params.id, adminId },
      {
        $set: {
          name, email, designation, department, location, emp_id, status,
          joining_date: jDate,
          employment_type: eType,
          compensation: compensation || {}
        }
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Candidate not found" });
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 2. GET all Candidates for logged-in admin
// ============================================================
router.get("/employees", protect, onlyAdmin, async (req, res) => {
  try {
    const adminId = req.user._id;
    const candidates = await OfferLetterEmployee.find({ adminId }).sort({ createdAt: -1 });
    res.status(200).json(candidates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Bulk Excel Upload & Template Export
// ============================================================
const uploadMemory = multer({ storage: multer.memoryStorage() });

router.get("/template", protect, onlyAdmin, (req, res) => {
  try {
    const headers = [[
      "name", "email", "joining_date", "employment_type", "designation",
      "department", "ctc", "basic_salary", "pt", "pf"
    ]];

    const ws = xlsx.utils.aoa_to_sheet(headers);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Employees");
    const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=Employees_Bulk_Upload_Template.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(excelBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/upload", protect, onlyAdmin, uploadMemory.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const adminId = req.user._id;

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let importedCount = 0;
    for (const row of rows) {
      if (!row.name || !row.email) continue;

      const empData = {
        adminId,
        name: row.name,
        email: row.email,
        employment_type: row.employment_type || "Full Time",
        designation: row.designation || "-",
        department: row.department || "-",
        location: row.location || "-",
        joining_date: row.joining_date ? new Date(row.joining_date) : new Date(),
        compensation: {
          ctc: row.ctc || 0,
          basic_salary: row.basic_salary || 0,
          hra: row.hra || 0,
          conveyance: row.conveyance || 0,
          medical_allowance: row.medical_allowance || 0,
          special_allowance: row.special_allowance || 0,
          gross_salary: row.gross_salary || 0,
          pt: row.pt || 0,
          pf: row.pf || 0,
          net_salary: row.net_salary || 0
        },
        status: "Pending"
      };

      try {
        await OfferLetterEmployee.findOneAndUpdate(
          { adminId, email: row.email },
          { $set: empData },
          { upsert: true, new: true }
        );
        importedCount++;
      } catch (rowErr) {
        console.error(`Failed to import ${row.email}:`, rowErr.message);
      }
    }

    res.status(200).json({ message: `Successfully imported ${importedCount} employees from Excel` });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to process the uploaded file." });
  }
});

// ============================================================
// 3. DELETE Candidate
// ============================================================
router.delete("/employees/:id", protect, onlyAdmin, async (req, res) => {
  try {
    const adminId = req.user._id;
    const deleted = await OfferLetterEmployee.findOneAndDelete({ _id: req.params.id, adminId });
    if (!deleted) return res.status(404).json({ message: "Candidate not found" });
    res.status(200).json({ message: "Candidate deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 4. GENERATE Offer Letter Content (ported from Python AI service)
// ============================================================
function numberToIndianWords(num) {
  try { num = Math.round(parseFloat(String(num).replace(/,/g, "").replace("INR", "").trim())); } catch { return String(num); }
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function convertLessThan1000(n) {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convertLessThan1000(n % 100) : "");
  }
  let res = "";
  if (num >= 10000000) { res += convertLessThan1000(Math.floor(num / 10000000)) + " Crore "; num %= 10000000; }
  if (num >= 100000) { res += convertLessThan1000(Math.floor(num / 100000)) + " Lakh "; num %= 100000; }
  if (num >= 1000) { res += convertLessThan1000(Math.floor(num / 1000)) + " Thousand "; num %= 1000; }
  if (num > 0) res += convertLessThan1000(num);
  return res.trim();
}

function formatLakhs(ctc) {
  try {
    const num = parseFloat(String(ctc).replace(/,/g, "").replace("INR", "").trim());
    return `INR ${(num / 100000).toFixed(1)} Lakh per Annum.`;
  } catch { return `${ctc} per Annum.`; }
}

router.post("/generate", protect, onlyAdmin, async (req, res) => {
  try {
    const adminId = req.user._id;
    const { employeeId, letterType = "Offer Letter", companyName = "" } = req.body;
    if (!employeeId) return res.status(400).json({ message: "Employee ID required" });

    const emp = await OfferLetterEmployee.findOne({ _id: employeeId, adminId });
    if (!emp) return res.status(404).json({ message: "Candidate not found" });

    const comp = emp.compensation || {};
    const n = (v) => { if (v == null) return 0; try { return Math.round(parseFloat(v)); } catch { return 0; } };

    let ctc = n(comp.ctc);
    // basic_salary, pt, pf are stored as MONTHLY values from the form
    // The offer letter template expects ANNUAL values (divides by 12 for monthly column)
    let pt = n(comp.pt) * 12;
    let pf = n(comp.pf) * 12;
    let basic = n(comp.basic_salary) * 12; // monthly → annual

    // Check if this employee already has a frozen/saved breakdown
    // (saved at creation time so payroll rule changes don't affect it)
    const hasFrozenBreakdown = n(comp.hra) > 0 || n(comp.conveyance) > 0 || n(comp.gross_salary) > 0;

    let hra, conveyance, medical, special, gross, net;

    if (hasFrozenBreakdown) {
      // ── USE FROZEN VALUES (saved at creation time) ──────────────
      console.log("📋 Using FROZEN salary breakdown (saved at creation time)");
      hra = n(comp.hra) * 12;
      conveyance = n(comp.conveyance) * 12;
      medical = n(comp.medical_allowance) * 12;
      special = n(comp.special_allowance) * 12;
      gross = n(comp.gross_salary) * 12;
      net = n(comp.net_salary) * 12;
      if (net === 0 && gross > 0) net = gross - pt - pf;
    } else {
      // ── FALLBACK: Calculate from current payroll rules ──────────
      // (for old employees created before this feature)
      console.log("📋 No frozen breakdown found, calculating from current payroll rules");
      let rules = await PayrollRule.findOne({ adminId });
      if (!rules) {
        rules = {
          basicPercentage: 40, hraPercentage: 40,
          conveyance: 1600, medical: 1250,
          travellingAllowance: 800, otherAllowance: 1000,
          pfCalculationMethod: 'percentage', pfPercentage: 12,
          pfFixedAmountEmployee: 0,
          ptSlab1Limit: 15000, ptSlab2Limit: 20000,
          ptSlab1Amount: 150, ptSlab2Amount: 200
        };
      }

      if (basic === 0 && ctc > 0) {
        const basicAnnual = Math.round(ctc * (rules.basicPercentage || 40) / 100);
        basic = Math.round(basicAnnual / 12) * 12;
      }

      hra = Math.round((basic / 12) * (rules.hraPercentage || 40) / 100) * 12;
      conveyance = (rules.conveyance || 1600) * 12;
      medical = (rules.medical || 1250) * 12;

      const travelAnnual = (rules.travellingAllowance || 0) * 12;
      const otherAnnual = (rules.otherAllowance || 0) * 12;
      special = ctc - basic - hra - conveyance - medical - travelAnnual - otherAnnual;
      if (special < 0) special = 0;

      gross = basic + hra + conveyance + medical + special;
      if (gross === 0) gross = ctc;

      if (pf === 0 && basic > 0) {
        if (rules.pfCalculationMethod === 'fixed') {
          pf = (rules.pfFixedAmountEmployee || 0) * 12;
        } else {
          pf = Math.round((basic / 12) * (rules.pfPercentage || 12) / 100) * 12;
        }
      }

      if (pt === 0 && gross > 0) {
        const grossMonthly = Math.round(gross / 12);
        let ptMonthly = 0;
        if (grossMonthly > (rules.ptSlab2Limit || 20000)) {
          ptMonthly = rules.ptSlab2Amount || 200;
        } else if (grossMonthly > (rules.ptSlab1Limit || 15000)) {
          ptMonthly = rules.ptSlab1Amount || 150;
        }
        pt = ptMonthly * 12;
      }

      net = gross - pt - pf;
    }

    const joiningFormatted = emp.joining_date
      ? new Date(emp.joining_date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "";

    const currentDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    const company = companyName || "Your Company";
    const ctcLakhs = formatLakhs(ctc);
    const netWords = numberToIndianWords(net);

    // Determine strict pixel boundaries for the Canvas to prevent Annexure A overlap 
    // or accidental second blank pages. Math matches FRONTEND containerPxPerPage padding.
    const isIntern = !emp.employment_type || emp.employment_type.toLowerCase() === "internship";
    const minHeightPx = isIntern ? "745px" : "850px";

    // Build the offer letter HTML (Page 1 + Salary Annexure Page 2)
    const page1 = `
    <div style="font-family: 'Arial', sans-serif; color: #000; font-size: 14.5px; line-height: 1.6; max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; min-height: ${minHeightPx}; box-sizing: border-box; padding-top: 15px;">
        <p style="text-align: right; font-weight: bold; margin-bottom: 30px; margin-top: 10px;">
            Date : ${currentDate}
        </p>
        <p style="margin-bottom: 30px;"><strong>To,</strong></p>
        <p style="margin-bottom: 30px;">Dear <strong>${emp.name}</strong></p>
        <h3 style="text-align: center; color: #000; margin-bottom: 30px; font-size: 15px; font-weight: bold;">Subject: Offer of Employment</h3>
        <p style="margin-bottom: 20px;">We are pleased to offer you the position of <strong>${emp.designation}</strong> with <strong>${company.toUpperCase()}</strong>. We are all excited about the potential that you will bring to our organization.</p>
        ${ctc > 0 ? `<p style="margin-bottom: 20px;">Your CTC would be <strong>${ctcLakhs}</strong></p>
        <p style="margin-bottom: 20px;">The CTC would be subjected to all statutory deductions as applicable.</p>` : ""}
        <p style="margin-bottom: 20px;">You are required to join us on <strong>${joiningFormatted}</strong> beyond which this offer stands cancelled unless otherwise either party communicates the said delay beforehand.</p>
        <p style="margin-bottom: 30px;">We look forward to your arrival as an employee of our organization and are confident that you will play a key role in our company's expansion. If this employment offer is acceptable to you, please sign a copy of this letter and return it to us by <strong>${joiningFormatted}</strong>.</p>
        <div style="margin-top: 40px;">
            <p style="margin-bottom: 20px;"><strong>Yours truly,</strong></p>
            <p style="margin-bottom: 10px;"><strong>For ${company}</strong></p>
            <p style="margin: 0;">&nbsp;</p>
            <p style="margin: 0;">&nbsp;</p>
            <p style="margin: 0;"><strong>D Navya</strong></p>
            <p style="margin: 0;"><strong>Managing Director</strong></p>
        </div>
    </div>`;

    let page2 = `
    <div style="font-family: 'Arial', sans-serif; color: #000; font-size: 14px; line-height: 1.6; max-width: 800px; margin: 0 auto; padding-top: 30px;">
        <h3 style="text-align: center; margin-bottom: 30px; font-size: 14px; font-weight: bold;">Annexure "A"</h3>
        <p style="margin-bottom: 30px; font-weight: bold; line-height: 1.4;">Entitlements: All entitlements listed below are subject to Company Policies, Procedures<br>and Guidelines that may be in force or as issued/changed from time to time. The Details<br>of your remuneration are as under:</p>
        <p style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">Salary Structure</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr style="font-weight: bold;">
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: left; width: 40%;"><strong>Particulars</strong></td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; width: 30%;"><strong>Monthly (Rs.)</strong></td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; width: 30%;"><strong>Annually (Rs.)</strong></td>
            </tr>
            <tr><td style="border: 1px solid #000; padding: 4px 6px;">Basic Salary</td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">${Math.round(basic / 12)}.00</td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">${basic}.00</td></tr>
            <tr><td style="border: 1px solid #000; padding: 4px 6px;">HRA</td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">${Math.round(hra / 12)}.00</td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">${hra}.00</td></tr>
            <tr><td style="border: 1px solid #000; padding: 4px 6px;">Conveyance</td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">${Math.round(conveyance / 12)}.00</td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">${conveyance}.00</td></tr>
            <tr><td style="border: 1px solid #000; padding: 4px 6px;">Medical Allowance</td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">${Math.round(medical / 12)}.00</td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">${medical}.00</td></tr>
            <tr><td style="border: 1px solid #000; padding: 4px 6px;">Special Allowance</td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">${Math.round(special / 12)}.00</td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">${special}.00</td></tr>
            <tr><td colspan="3" style="padding: 2px; border: 1px solid #000; border-bottom: none; border-top: none;">&nbsp;</td></tr>
            <tr style="font-weight: bold;"><td style="border: 1px solid #000; padding: 4px 6px;"><strong>Gross Amount</strong></td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;"><strong>${Math.round(gross / 12)}.00</strong></td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;"><strong>${gross}.00</strong></td></tr>
            ${pt > 0 ? `<tr><td style="border: 1px solid #000; padding: 4px 6px; font-weight: bold;"><strong>PT</strong></td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">${Math.round(pt / 12)}</td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">${pt}</td></tr>` : ""}
            ${pf > 0 ? `<tr><td style="border: 1px solid #000; padding: 4px 6px; font-weight: bold;"><strong>PF</strong></td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">${Math.round(pf / 12)}.00</td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">${pf}.00</td></tr>` : ""}
            <tr style="font-weight: bold;"><td style="border: 1px solid #000; padding: 4px 6px;"><strong>Net Pay</strong></td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;"><strong>${Math.round(net / 12)}.00</strong></td><td style="border: 1px solid #000; padding: 4px 6px; text-align: right;"><strong>${net}.00</strong></td></tr>
        </table>
        <p style="font-weight: bold; margin-bottom: 15px;">Rupees: ${netWords || "Zero"} Rupees Only (Per Annum)</p>
        <p style="margin-bottom: 15px;">
            *Incentive/Referral/Bonus or any other variable amount is payable subject to the<br>
            employee's performance as per Company Policies and at the Sole discretion of the<br>
            Company's management.
            <br><br>
            *Employee has to be in active roles at the time of actual payment and not serving any<br>
            notice period in order to be eligible for the payment.
        </p>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px;">
            <div style="text-align: left;">
                <p style="margin-bottom: 10px;"><strong>For ${company}</strong></p>
                <p style="margin: 0;">&nbsp;</p>
                <p style="margin: 0;">&nbsp;</p>
                <p style="margin: 0;"><strong>D Navya</strong></p>
                <p style="margin: 0;"><strong>Managing Director</strong></p>
            </div>
            <div style="text-align: center; margin-bottom: 0;">
                <p style="margin: 0;">&nbsp;</p>
                <p style="margin: 0;">&nbsp;</p>
                <p style="margin: 0;">&nbsp;</p>
                <p style="margin-bottom: 5px;"><strong>Agreed and accepted</strong></p>
                <p style="margin: 0;"><strong>${emp.name}</strong></p>
            </div>
        </div>
    </div>`;

    let content = page1;
    // Internships do not require the Salary Annexure breakdown page
    if (!emp.employment_type || emp.employment_type.toLowerCase() !== "internship") {
      content += page2;
    }

    // Save generated letter to history
    await GeneratedLetter.create({
      adminId,
      employeeId: emp._id,
      letter_type: letterType,
      content,
      company_name: company,
    });

    res.status(200).json({ content });
  } catch (error) {
    console.error("Generate letter error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 4b. Download DOCX
// ============================================================
router.post('/download-docx', protect, onlyAdmin, async (req, res) => {
  try {
    const { htmlContent } = req.body;

    const AdmZip = (await import('adm-zip')).default;

    // ══════════════════════════════════════════════════
    // STEP 1: Split HTML into logical pages
    // ══════════════════════════════════════════════════
    let htmlPages = [];
    const annexureIdx = htmlContent.indexOf('Annexure');
    if (annexureIdx > 0) {
      const divBefore = htmlContent.lastIndexOf('<div', annexureIdx);
      if (divBefore > 0) {
        htmlPages.push(htmlContent.substring(0, divBefore));
        htmlPages.push(htmlContent.substring(divBefore));
      } else {
        htmlPages.push(htmlContent);
      }
    } else {
      htmlPages.push(htmlContent);
    }
    console.log(`📄 DOCX: Split content into ${htmlPages.length} logical page(s)`);

    // ══════════════════════════════════════════════════
    // STEP 2: Sanitize HTML for Word compatibility
    // ══════════════════════════════════════════════════
    function sanitizeHtml(html) {
      let safe = html
        .replace(/&ldquo;/g, '\u201C').replace(/&rdquo;/g, '\u201D')
        .replace(/&lsquo;/g, '\u2018').replace(/&rsquo;/g, '\u2019')
        .replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013')
        .replace(/&amp;/g, '&')
        .replace(/<ul[^>]*>/g, '').replace(/<\/ul>/g, '')
        .replace(/<li>/g, '<p style="margin-left:20px;margin-bottom:5px;">\u2022 ')
        .replace(/<\/li>/g, '</p>')
        // Insert specific Word-only vertical space before Yours truly
        .replace(/<strong>Yours truly,<\/strong>/gi, '<br><br><strong>Yours truly,</strong>')
        // Convert <h3> to <p> so Word doesn't add heading indent
        .replace(/<h3([^>]*)>/gi, '<p$1>').replace(/<\/h3>/gi, '</p>');

      // FIRST: Remove empty spacer divs (they disrupt nesting detection)
      safe = safe.replace(/<div[^>]*style="[^"]*height:\s*\d+px[^"]*"[^>]*>(\s*)<\/div>/gi, '');

      // SECOND: Replace the flex signature block with space-padded lines (no table)
      // Approach: find the flex outer div, extract left/center inner div p-tag content,
      // then zip them together with non-breaking spaces as the separator.
      const flexIdx = safe.indexOf('display: flex');
      if (flexIdx > -1) {
        const flexDivStart = safe.lastIndexOf('<div', flexIdx);
        if (flexDivStart > -1) {
          // Walk forward counting <div> depth to find the matching </div>
          let depth = 0;
          let pos = flexDivStart;
          let flexDivEnd = -1;
          while (pos < safe.length) {
            const nextOpen = safe.indexOf('<div', pos + 1);
            const nextClose = safe.indexOf('</div>', pos + 1);
            if (nextClose === -1) break;
            if (nextOpen !== -1 && nextOpen < nextClose) {
              depth++;
              pos = nextOpen;
            } else {
              if (depth === 0) {
                flexDivEnd = nextClose + '</div>'.length;
                break;
              }
              depth--;
              pos = nextClose;
            }
          }

          if (flexDivEnd > -1) {
            const flexBlock = safe.substring(flexDivStart, flexDivEnd);

            // Extract left and center/right inner div HTML
            const leftDivMatch = flexBlock.match(/<div[^>]*text-align:\s*left[^>]*>([\s\S]*?)<\/div>/i);
            const rightDivMatch = flexBlock.match(/<div[^>]*text-align:\s*center[^>]*>([\s\S]*?)<\/div>/i)
              || flexBlock.match(/<div[^>]*text-align:\s*right[^>]*>([\s\S]*?)<\/div>/i);

            if (leftDivMatch && rightDivMatch) {
              // Extract text content of each <p> tag in each column
              const extractPs = (divHtml) =>
                [...divHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => m[1].trim()).filter(Boolean);

              const leftLines = extractPs(leftDivMatch[1]);
              const rightLines = extractPs(rightDivMatch[1]);

              const maxLines = Math.max(leftLines.length, rightLines.length);

              // Replacing table with spaces for alignment as requested
              let signatureHtml = `<div style="margin-top:8px;">`;
              for (let i = 0; i < maxLines; i++) {
                const getRawStr = (htmlStr) => htmlStr ? htmlStr.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim() : '';
                const leftStr = leftLines[i] || '';
                const rightStr = rightLines[i] || '';
                
                let spacer = '';
                if (rightStr) {
                  const leftLength = getRawStr(leftStr).length;
                  const padLen = Math.max(5, 75 - leftLength); 
                  // Use non-breaking spaces for word alignment
                  spacer = '&nbsp;'.repeat(padLen);
                }
                
                signatureHtml += `<p style="margin:0;padding:0;">${leftStr}${spacer}${rightStr}</p>`;
              }
              signatureHtml += `</div>`;

              safe = safe.substring(0, flexDivStart) + signatureHtml + safe.substring(flexDivEnd);
            }
          }
        }
      }

      // THIRD: Strip unsupported CSS + compact spacing
      safe = safe
        .replace(/&nbsp;/g, '\u00A0')
        .replace(/min-height:[^;]+;?/gi, '')
        .replace(/display:\s*flex[^;]*;?/gi, '')
        .replace(/flex-direction:[^;]*;?/gi, '')
        .replace(/justify-content:[^;]*;?/gi, '')
        .replace(/align-items:[^;]*;?/gi, '')
        .replace(/box-sizing:[^;]*;?/gi, '')
        .replace(/-webkit-[^;]*;?/gi, '')
        .replace(/max-width:[^;]+;?/gi, '')
        // Strip line-height from inner elements — lets outer wrapper 1.4 apply (saves ~12% space)
        .replace(/line-height:[^;]+;?/gi, '')
        // Strip font-size from inner divs (outer wrapper sets 11pt globally)
        .replace(/font-size:\s*\d+(?:\.\d+)?px;?/gi, '')
        .replace(/width:\s*(\d+)%;/gi, (m, p) => `width:${Math.round(parseInt(p) * 6)}px;`)
        .replace(/width="(\d+)%"/gi, (m, p) => `width="${Math.round(parseInt(p) * 6)}"`);

      // Compact table cell padding: 4px → 2px to shrink each row height
      safe = safe.replace(/padding:\s*4px\s*(\d+px)/gi, 'padding:2px $1');

      // FOURTH: Compress large paragraph margins so Annexure + signature fits on one page.
      // We crush all explicit CSS margins to 2px globally because Word inherently adds its own paragraph pStyle spacing (~10pt).
      // If we don't crush them, the margins compound with Word's default spacing and cause Page 2 overflow.
      safe = safe
        .replace(/margin-bottom:\s*(\d+)px/gi, 'margin-bottom:2px')
        .replace(/margin-top:\s*(\d+)px/gi, 'margin-top:2px')
        .replace(/padding-top:\s*\d+px;?/gi, '')
        .replace(/padding-bottom:\s*\d+px;?/gi, '');

      // 10pt tightly guarantees fit on Page 2 without spilling onto Page 3. Line-height 1.2
      return `<div style="font-family:Arial,sans-serif; font-size:10pt; color:#000; line-height:1.2;">${safe}</div>`;
    }

    // ══════════════════════════════════════════════════
    // STEP 3: Convert each logical page → DOCX XML, then sub-split for overflow
    // ══════════════════════════════════════════════════
    let allSections = []; // Each entry = XML paragraphs for one Word page
    let firstTextZip = null;

    for (let pi = 0; pi < htmlPages.length; pi++) {
      const safePageHtml = sanitizeHtml(htmlPages[pi]);
      const pageDocxBuffer = await HTMLtoDOCX(safePageHtml, null, {
        margins: { top: 2400, right: 1000, bottom: 1440, left: 1000 }
      });
      const pageZip = new AdmZip(pageDocxBuffer);
      if (pi === 0) firstTextZip = pageZip;

      const pageDocXml = pageZip.readAsText('word/document.xml');
      const bodyMatch = pageDocXml.match(/<w:body>([\s\S]*)<\/w:body>/);
      if (!bodyMatch) continue;

      let paragraphs = bodyMatch[1].replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/, '').trim();

      // Check if this logical page overflows into multiple Word pages
      // Extract all top-level elements (paragraphs + tables)
      const elements = paragraphs.match(/(<w:p\b[\s\S]*?<\/w:p>|<w:tbl\b[\s\S]*?<\/w:tbl>)/g) || [];
      const pageText = paragraphs.replace(/<[^>]*>/g, '');
      const wordCount = pageText.split(/\s+/).filter(Boolean).length;
      console.log(`  Page ${pi + 1}: ${wordCount} words, ${elements.length} elements`);

      // ~500 words per Word page with our margins.
      // Salary tables inflate word count (numbers count as words) without using
      // proportional vertical space, so we use a generous threshold.
      const subPages = Math.max(1, Math.ceil(wordCount / 700));

      if (subPages <= 1) {
        allSections.push(paragraphs);
      } else {
        // Sub-split elements across multiple Word pages
        const elementsPerSubPage = Math.ceil(elements.length / subPages);
        for (let s = 0; s < subPages; s++) {
          const chunk = elements.slice(s * elementsPerSubPage, (s + 1) * elementsPerSubPage).join('\n');
          if (chunk.trim()) allSections.push(chunk);
        }
      }
    }

    console.log(`📄 DOCX: Total Word sections (with overflow): ${allSections.length}`);

    // ══════════════════════════════════════════════════
    // STEP 4: Open the template
    // ══════════════════════════════════════════════════
    const templateUrl = 'https://res.cloudinary.com/dm0qq5no9/raw/upload/v1775132006/Vagerious_new.docx';
    const response = await axios.get(templateUrl, { responseType: 'arraybuffer' });
    const templateZip = new AdmZip(Buffer.from(response.data));
    let templateDocXml = templateZip.readAsText('word/document.xml');

    // Disable Word image compression
    let settingsXml = templateZip.readAsText('word/settings.xml');
    if (settingsXml && !settingsXml.includes('doNotCompressPictures')) {
      settingsXml = settingsXml.replace(
        '</w:settings>',
        `  <w:doNotCompressPictures/>\n  <w:compat>\n    <w:doNotExpandShiftReturn/>\n  </w:compat>\n</w:settings>`
      );
      templateZip.updateFile('word/settings.xml', Buffer.from(settingsXml, 'utf8'));
    }

    // ══════════════════════════════════════════════════
    // STEP 5: Extract the logo paragraph from the template
    // ══════════════════════════════════════════════════
    const logoParaMatch =
      templateDocXml.match(/<w:p\b[^>]*>(?:(?!<w:p\b).)*?<w:drawing>[\s\S]*?<\/w:drawing>[\s\S]*?<\/w:p>/) ||
      templateDocXml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/);

    const logoPara = logoParaMatch ? logoParaMatch[0] : "";
    if (logoPara) templateDocXml = templateDocXml.replace(logoPara, '');

    // ══════════════════════════════════════════════════
    // STEP 6: Build multi-section body — logo on EVERY page
    // ══════════════════════════════════════════════════
    let multiSectionBody = '';
    const totalSections = allSections.length;
    const pgMar = `w:top="2400" w:right="1000" w:bottom="1440" w:left="1000" w:header="720" w:footer="720" w:gutter="0"`;
    const pgSz = `w:w="11900" w:h="16840" w:orient="portrait"`;

    for (let i = 0; i < totalSections; i++) {
      const isLast = i === totalSections - 1;

      if (logoPara) multiSectionBody += logoPara + '\n';
      multiSectionBody += allSections[i] + '\n';

      if (isLast) {
        multiSectionBody += `<w:sectPr>
  <w:pgSz ${pgSz}/>
  <w:pgMar ${pgMar}/>
</w:sectPr>`;
      } else {
        multiSectionBody += `<w:p>
  <w:pPr>
    <w:sectPr>
      <w:type w:val="nextPage"/>
      <w:pgSz ${pgSz}/>
      <w:pgMar ${pgMar}/>
    </w:sectPr>
  </w:pPr>
</w:p>`;
      }
    }

    // ══════════════════════════════════════════════════
    // STEP 7: Inject multi-section body into template
    // ══════════════════════════════════════════════════
    const hasSectPr = /<w:sectPr[\s\S]*?<\/w:sectPr>/.test(templateDocXml);
    if (hasSectPr) {
      templateDocXml = templateDocXml.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/, multiSectionBody);
    } else {
      templateDocXml = templateDocXml.replace('</w:body>', multiSectionBody + '</w:body>');
    }

    templateZip.updateFile('word/document.xml', Buffer.from(templateDocXml, 'utf8'));

    // ══════════════════════════════════════════════════
    // STEP 8: Copy styles from generated DOCX into template
    // ══════════════════════════════════════════════════
    const stylesToCopy = ['word/styles.xml', 'word/webSettings.xml'];
    for (const f of stylesToCopy) {
      const entry = firstTextZip.getEntry(f);
      if (entry) templateZip.updateFile(f, entry.getData());
    }

    const numEntry = firstTextZip.getEntry('word/numbering.xml');
    if (numEntry) {
      templateZip.addFile('word/numbering.xml', numEntry.getData());
      let ctXml = templateZip.readAsText('[Content_Types].xml');
      if (!ctXml.includes('numbering.xml')) {
        ctXml = ctXml.replace('</Types>', '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>');
        templateZip.updateFile('[Content_Types].xml', Buffer.from(ctXml, 'utf8'));
      }
      let dRels = templateZip.readAsText('word/_rels/document.xml.rels');
      if (!dRels.includes('numbering.xml')) {
        dRels = dRels.replace('</Relationships>', '<Relationship Id="rIdNum1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>');
        templateZip.updateFile('word/_rels/document.xml.rels', Buffer.from(dRels, 'utf8'));
      }
    }

    // ══════════════════════════════════════════════════
    // STEP 9: Send final DOCX
    // ══════════════════════════════════════════════════
    const finalBuffer = templateZip.toBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="Offer_Letter.docx"');
    res.send(finalBuffer);

  } catch (error) {
    console.error('DOCX Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 5. Send Offer Email (with optional PDF attachment)
// ============================================================
router.post("/send-email", protect, onlyAdmin, async (req, res) => {
  try {
    const adminId = req.user._id;
    const { employeeId, pdfBase64, companyName, emailBody, companyId } = req.body;

    if (!employeeId) return res.status(400).json({ message: "Employee ID is required" });

    // 1. Upload PDF to Cloudinary if provided
    let uploadedPdfUrl = "";
    if (pdfBase64) {
      try {
        const uploadResult = await cloudinary.uploader.upload(pdfBase64, {
          resource_type: "auto",
          folder: "offer_letters"
        });
        uploadedPdfUrl = uploadResult.secure_url;
        console.log("✅ PDF Uploaded to Cloudinary:", uploadedPdfUrl);
      } catch (uploadErr) {
        console.error("Cloudinary upload error:", uploadErr);
        // We continue sending even if upload fails
      }
    }

    const emp = await OfferLetterEmployee.findOne({ _id: employeeId, adminId });
    if (!emp) return res.status(404).json({ message: "Candidate not found" });

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");
    emp.offer_token = token;
    emp.expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    emp.status = "Offer Sent";
    emp.sent_at = new Date();
    if (uploadedPdfUrl) {
      emp.pdfUrl = uploadedPdfUrl;
    }

    if (companyId) {
      emp.companyId = companyId;
    } else if (companyName) {
      const dbComp = await Company.findOne({ adminId, name: companyName });
      if (dbComp) emp.companyId = dbComp._id;
    }
    await emp.save();

    const backUrl = process.env.BACKEND_URL || "http://localhost:5000";
    const respondUrl = `${backUrl}/api/offer-letters/respond?token=${token}`;
    const acceptUrl = `${respondUrl}&action=accept`;
    const rejectUrl = `${respondUrl}&action=reject`;

    const company = companyName || "Your Company";
    const customBody = emailBody || `Dear ${emp.name},\n\nWe are pleased to offer you the position at ${company}.\n\nPlease find the detailed offer letter attached.\n\nBest Regards,\nHR Team`;

    // Build premium email HTML
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 30px 40px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">${company}</h2>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Offer Letter</p>
        </div>
        <div style="padding: 40px;">
          <div style="font-size: 15px; line-height: 1.7; color: #334155;">
            ${customBody.replace(/\n/g, "<br>")}
          </div>
        </div>
        <div style="padding: 0 40px 40px; text-align: center;">
          <p style="color: #64748b; font-size: 13px; margin-bottom: 20px; font-weight: 600; text-transform: uppercase;">
            Please respond to this offer:
          </p>
          <div>
            <a href="${acceptUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; margin-right: 12px;">
              ✅ I Accept the Offer
            </a>
            <a href="${rejectUrl}" style="display: inline-block; background: #ffffff; color: #475569; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; border: 2px solid #cbd5e1;">
              Decline Offer
            </a>
          </div>
        </div>
        <div style="background: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            This is an automated email from ${company}. Please do not reply directly.
          </p>
        </div>
      </div>
    `;

    // Build mail options
    const mailOptions = {
      from: `"${company} HR" <${process.env.SMTP_USER}>`,
      to: emp.email,
      subject: `Offer Letter - ${emp.name}`,
      html: emailHtml,
    };

    // Attach PDF if provided (base64 data URI)
    if (pdfBase64) {
      const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
      mailOptions.attachments = [{
        filename: `Offer_Letter_${emp.name.replace(/\s+/g, "_")}.pdf`,
        content: Buffer.from(base64Data, "base64"),
        contentType: "application/pdf"
      }];
    }

    // Send the email in the background - DO NOT AWAIT 
    // This makes the UI respond instantly while the heavy PDF attachment uploads in its own thread
    transporter.sendMail(mailOptions).catch(err => {
      console.error("🔥 BACKGROUND OFFER MAIL ERROR:", err);
    });

    res.status(200).json({
      message: "Offer sending initiated! The candidate will receive their document shortly in the background.",
      status: "Offer Sent"
    });
  } catch (error) {
    console.error("Error initiating offer email:", error);
    res.status(500).json({ error: "Failed to initiate sending process." });
  }
});

// ============================================================
// 6. Template Management (Cloudinary Persistent Storage)
// ============================================================

// Use memory storage so we can manually upload to Cloudinary with correct resource_type.
// PDFs must be uploaded as "raw" (not "image") to be accessible via Cloudinary URLs.
const templateMemoryUpload = multer({ storage: multer.memoryStorage() });

router.post("/templates/upload", protect, onlyAdmin, templateMemoryUpload.single("file"), async (req, res) => {
  try {
    const adminId = req.user._id;
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const isPdf = req.file.originalname.toLowerCase().endsWith('.pdf');

    // Convert buffer to base64 data URI for Cloudinary upload
    const b64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    // Upload to Cloudinary with correct resource_type:
    // - PDFs need "raw" so they are served from /raw/upload/ (publicly accessible)
    // - Images (jpg/png) use "image" which is the default
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: "offer_letter_templates",
      resource_type: isPdf ? "raw" : "image",
      type: "upload",
    });

    const cloudinaryUrl = uploadResult.secure_url;
    const { name, companyName } = req.body;

    console.log("☁️  Template uploaded to Cloudinary:", cloudinaryUrl);

    const newTemplate = new OfferLetterTemplate({
      adminId,
      name: name || req.file.originalname.split(".")[0],
      companyName: companyName || "",
      templateUrl: cloudinaryUrl,
      originalFilename: req.file.originalname,
    });

    await newTemplate.save();

    res.status(200).json({
      _id: newTemplate._id,
      name: newTemplate.name,
      templateUrl: newTemplate.templateUrl,
      filename: newTemplate.originalFilename,
    });
  } catch (error) {
    console.error("🔥 FULL TEMPLATE UPLOAD ERROR:", error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

router.get("/templates", protect, onlyAdmin, async (req, res) => {
  try {
    const adminId = req.user._id;
    const templates = await OfferLetterTemplate.find({ adminId }).sort({ createdAt: -1 });
    res.status(200).json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/templates/fetch", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send("No URL provided");

    let fetchUrl = url;

    // Cloudinary files are uploaded as public (type: "upload"), 
    // so they can be fetched directly without signing.
    if (url.includes("cloudinary.com")) {
      console.log("🔗 Proxy fetching Cloudinary URL directly:", url.substring(0, 120));
    } else {
      console.log("🔗 Proxy fetching non-Cloudinary URL directly:", url.substring(0, 100));
    }

    const response = await axios.get(fetchUrl, {
      responseType: 'arraybuffer',
      headers: { 'Cache-Control': 'no-cache' },
      timeout: 30000
    });

    const buffer = Buffer.from(response.data);
    const magicHex = buffer.slice(0, 4).toString('hex');
    console.log(`📡 Backend fetched ${buffer.length} bytes. Magic: (${magicHex})`);

    const contentType = response.headers['content-type'] || (url.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(buffer);

  } catch (error) {
    console.error("🔥 Proxy Template Error:", error.response?.status || "N/A", error.message);
    if (error.response?.status === 404) {
      return res.status(404).send("Template not found at the stored URL. Please re-upload.");
    }
    res.status(error.response?.status || 500).send("Failed to proxy template: " + error.message);
  }
});

router.get("/templates/:companyName", protect, onlyAdmin, async (req, res) => {
  try {
    const adminId = req.user._id;
    const template = await OfferLetterTemplate.findOne({
      adminId,
      companyName: new RegExp(`^${req.params.companyName}$`, "i")
    });
    res.status(200).json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/templates/:id", protect, onlyAdmin, async (req, res) => {
  try {
    const adminId = req.user._id;
    const deleted = await OfferLetterTemplate.findOneAndDelete({ _id: req.params.id, adminId });
    if (!deleted) return res.status(404).json({ message: "Template not found" });

    // Also remove the file from Cloudinary to free up space
    if (deleted.templateUrl && deleted.templateUrl.includes("cloudinary.com")) {
      try {
        const uploadMatch = deleted.templateUrl.match(/\/upload\/(?:v\d+\/)?(.+)$/);
        if (uploadMatch) {
          const fullPath = uploadMatch[1];
          const lastDot = fullPath.lastIndexOf('.');
          const publicId = lastDot !== -1 ? fullPath.substring(0, lastDot) : fullPath;
          const resourceType = deleted.templateUrl.includes("/raw/upload") ? "raw"
            : deleted.templateUrl.includes("/video/upload") ? "video" : "image";
          await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
          console.log("🗑️  Cloudinary file deleted:", publicId);
        }
      } catch (cloudErr) {
        console.warn("⚠️ Could not delete from Cloudinary:", cloudErr.message);
      }
    }

    res.status(200).json({ message: "Template deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


export default router;
