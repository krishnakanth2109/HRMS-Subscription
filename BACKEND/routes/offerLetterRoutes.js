import express from "express";
import axios from "axios";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import xlsx from "xlsx";
import nodemailer from "nodemailer";
import OfferLetterEmployee from "../models/OfferLetterEmployee.js";
import GeneratedLetter from "../models/GeneratedLetter.js";
import OfferLetterTemplate from "../models/OfferLetterTemplate.js";
import Company from "../models/CompanyModel.js";
import InvitedEmployee from "../models/Invitedemployee.js";
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

    let basic = n(comp.basic_salary);
    let hra = n(comp.hra);
    let conveyance = n(comp.conveyance);
    let medical = n(comp.medical_allowance);
    let special = n(comp.special_allowance);
    let gross = n(comp.gross_salary);
    let pt = n(comp.pt);
    let pf = n(comp.pf);
    let net = n(comp.net_salary);
    let ctc = n(comp.ctc);

    // Auto-calculate if not set
    if (basic === 0 && ctc > 0) basic = Math.round(ctc * 0.5);
    if (hra === 0 && basic > 0) hra = Math.round(basic * 0.4);
    if (conveyance === 0 && ctc > 0) conveyance = Math.min(Math.round(ctc * 0.05), 19200);
    if (medical === 0 && ctc > 0) medical = Math.round(ctc * 0.05);
    if (special === 0 && ctc > 0) special = ctc - basic - hra - conveyance - medical;
    if (special < 0) special = 0;
    if (gross === 0 && ctc > 0) gross = basic + hra + conveyance + medical + special;
    if (gross === 0) gross = ctc;
    if (net === 0 && gross > 0) net = gross - pt - pf;

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
    <div style="font-family: 'Arial', sans-serif; color: #000; font-size: 14.5px; line-height: 1.6; max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; min-height: ${minHeightPx}; box-sizing: border-box;">
        <div class="date-row" style="text-align: right; font-weight: bold; margin-bottom: 30px; margin-top: 10px;">
            <span style="display: inline-block;">Date : ${currentDate}</span>
        </div>
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
            <p style="margin-bottom: 20px;"><strong>For ${company}</strong></p>
            <div style="height: 60px; margin-bottom: 10px;"></div>
            <p style="margin: 0; font-weight: bold;">Authorized Signatory</p>
            <p style="margin: 0; font-weight: bold;">HR Department</p>
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
        <p style="margin-bottom: 15px;">*Incentive/Referral/Bonus or any other variable amount is payable subject to the<br>employee's performance as per Company Policies and at the Sole discretion of the<br>Company's management.</p>
        <p style="margin-bottom: 25px;">*Employee has to be in active roles at the time of actual payment and not serving any<br>notice period in order to be eligible for the payment.</p>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px;">
            <div style="text-align: left;">
                <p style="margin-bottom: 25px;">For ${company}</p>
                <div style="height: 60px; margin-bottom: 15px;"></div>
                <p style="margin: 0; font-weight: bold;">Authorized Signatory</p>
                <p style="margin: 0; font-weight: bold;">HR Department</p>
            </div>
            <div style="text-align: center; margin-bottom: 0;">
                <p style="font-weight: bold; margin-bottom: 50px;">Agreed and accepted</p>
                <p style="margin: 0; font-weight: bold;">${emp.name}</p>
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
// 6. Template Management (Local & DB)
// ============================================================
const localTemplateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), "public", "templates");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, Date.now() + "-" + safeName);
  }
});
const uploadLocal = multer({ storage: localTemplateStorage });

router.post("/templates/upload", protect, onlyAdmin, uploadLocal.single("file"), async (req, res) => {
  try {
    const adminId = req.user._id;
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // File uploaded locally
    // Determine the base URL statically or dynamically 
    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
    const fileUrl = `${backendUrl}/public/templates/${req.file.filename}`;
    const { name, companyName } = req.body;

    const newTemplate = new OfferLetterTemplate({
      adminId,
      name: name || req.file.originalname.split(".")[0],
      companyName: companyName || "",
      templateUrl: fileUrl,
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

router.get("/templates/fetch", protect, async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send("No URL provided");

    let fetchUrl = url;

    // For Cloudinary URLs, generate a properly signed delivery URL
    if (url.includes("cloudinary.com")) {
      try {
        // Extract public_id from Cloudinary URL using regex
        // Pattern: .../upload/v{version}/{public_id}.{ext}
        // Or:      .../upload/{public_id}.{ext}
        const uploadMatch = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
        if (uploadMatch) {
          const fullPath = uploadMatch[1];                    // e.g. "employee_docs/template.jpg"
          const lastDot = fullPath.lastIndexOf('.');
          const publicId = lastDot !== -1 ? fullPath.substring(0, lastDot) : fullPath;
          const ext = lastDot !== -1 ? fullPath.substring(lastDot + 1) : undefined;

          // Detect resource_type from URL path
          const resourceType = url.includes("/raw/upload") ? "raw"
            : url.includes("/video/upload") ? "video"
              : "image";

          // Generate signed URL — format is part of the signature, not appended after
          fetchUrl = cloudinary.url(publicId, {
            secure: true,
            sign_url: true,
            resource_type: resourceType,
            format: ext  // included in signature calculation
          });

          console.log("🔗 Proxy fetching via Signed URL:", fetchUrl.substring(0, 120) + "...");
        }
      } catch (err) {
        console.warn("⚠️ URL signing failed, using original URL:", err.message);
        fetchUrl = url;
      }
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
    res.status(200).json({ message: "Template deleted from database" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


export default router;
