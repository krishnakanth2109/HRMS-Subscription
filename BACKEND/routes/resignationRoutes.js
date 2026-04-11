import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Resignation from "../models/Resignation.js";
import transporter from "../config/nodemailer.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Cloudinary config (already configured globally via app.js / config/cloudinary.js)
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_4);

// Helper: upload buffer to cloudinary
const uploadToCloudinary = (buffer, filename) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { resource_type: "auto", folder: "hrms_exit_docs", public_id: `${Date.now()}_${filename}` },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    ).end(buffer);
  });

// Helper: send email
const sendMail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"HRMS System" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
  } catch (e) {
    console.error("Resignation email error:", e.message);
  }
};

// ============================================================
// EMPLOYEE: Submit Resignation
// POST /api/resignations/submit
// ============================================================
router.post("/submit", protect, async (req, res) => {
  try {
    const { employeeId, employeeName, employeeEmail, department, designation, reason, companyName } = req.body;
    const adminId = req.user.adminId || req.user._id;

    // Check duplicate
    const existing = await Resignation.findOne({
      employeeId,
      status: { $in: ["Pending", "Approved", "Exit Formalities"] }
    });
    if (existing) {
      return res.status(400).json({ message: "You already have an active resignation in progress." });
    }

    // Generate resignation letter via Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Write a professional resignation letter in HTML format (no markdown, only HTML tags like <p>, <h3>, <strong>, <br>) for:
    - Employee Name: ${employeeName}
    - Designation: ${designation}
    - Department: ${department}
    - Reason for leaving: ${reason}
    - Date: ${new Date().toLocaleDateString("en-IN")}
    Make it formal, warm, and professional. Include: date, recipient (HR Department), body expressing gratitude, reason, and signature. Use clean HTML only.`;

    let letterHtml = "";
    try {
      const result = await model.generateContent(prompt);
      letterHtml = result.response.text().replace(/```html|```/g, "").trim();
    } catch (aiErr) {
      console.error("Gemini error:", aiErr.message);
      letterHtml = `<p>Dear HR,</p><p>I, ${employeeName}, hereby submit my resignation from the position of ${designation} in the ${department} department, effective today. Reason: ${reason}</p><p>Regards,<br/><strong>${employeeName}</strong></p>`;
    }

    const resignation = await Resignation.create({
      adminId,
      employeeId,
      employeeName,
      employeeEmail,
      companyName: companyName || "Unknown",
      department,
      designation,
      reason,
      resignationLetterHtml: letterHtml,
      submittedAt: new Date(),
      status: "Pending",
    });

    res.status(201).json({ message: "Resignation submitted successfully.", resignation });
  } catch (err) {
    console.error("Submit resignation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// EMPLOYEE: Get my resignations
// GET /api/resignations/my/:employeeId
// ============================================================
router.get("/my/:employeeId", protect, async (req, res) => {
  try {
    const resignations = await Resignation.find({ employeeId: req.params.employeeId }).sort({ createdAt: -1 });
    res.status(200).json(resignations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ADMIN: Get all resignations for this admin
// GET /api/resignations/admin/all
// ============================================================
router.get("/admin/all", protect, onlyAdmin, async (req, res) => {
  try {
    const adminId = req.user._id;
    const resignations = await Resignation.find({ adminId }).sort({ createdAt: -1 });
    res.status(200).json(resignations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ADMIN: Approve or Reject Resignation
// POST /api/resignations/admin/decision/:id
// ============================================================
router.post("/admin/decision/:id", protect, onlyAdmin, async (req, res) => {
  try {
    const { action, adminRemark, noticePeriodType, noticePeriodDays } = req.body;
    const resignation = await Resignation.findById(req.params.id);
    if (!resignation) return res.status(404).json({ message: "Resignation not found" });

    if (action === "Rejected") {
      resignation.status = "Rejected";
      resignation.adminRemark = adminRemark || "";
      resignation.rejectedAt = new Date();
      await resignation.save();

      // Notify employee
      sendMail(resignation.employeeEmail, "Your Resignation Has Been Rejected",
        `<p>Dear ${resignation.employeeName},</p><p>Your resignation has been reviewed and unfortunately it has been rejected.</p><p><strong>Remark:</strong> ${adminRemark || "N/A"}</p><p>Please reach out to HR for more information.</p>`
      );

      return res.status(200).json({ message: "Resignation rejected.", resignation });
    }

    if (action === "Approved") {
      // Calculate notice period end date in IST
      const days = noticePeriodType === "Immediate" ? 0 : parseInt(noticePeriodDays) || 0;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      resignation.status = "Approved";
      resignation.adminRemark = adminRemark || "";
      resignation.noticePeriodType = noticePeriodType || "Immediate";
      resignation.noticePeriodDays = days;
      resignation.noticePeriodEndDate = endDate;
      resignation.approvedAt = new Date();

      // Generate acceptance letter via Gemini AI
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Write a professional resignation acceptance letter in HTML format (use <p>, <h3>, <strong>, <br> only, no markdown) for:
      - Employee Name: ${resignation.employeeName}
      - Designation: ${resignation.designation}
      - Department: ${resignation.department}
      - Notice Period: ${noticePeriodType === "Immediate" ? "Immediate Release" : `${days} days (ending ${endDate.toLocaleDateString("en-IN")})`}
      - Today's Date: ${new Date().toLocaleDateString("en-IN")}
      Make it formal, compassionate, and professional. Thank the employee for their service.`;

      try {
        const result = await model.generateContent(prompt);
        resignation.acceptanceLetterHtml = result.response.text().replace(/```html|```/g, "").trim();
      } catch (aiErr) {
        resignation.acceptanceLetterHtml = `<p>Dear ${resignation.employeeName},</p><p>We acknowledge and accept your resignation effective from today. Your notice period is ${days === 0 ? "immediate" : `${days} days ending on ${endDate.toLocaleDateString("en-IN")}`}.</p><p>We wish you all the best in your future endeavors.</p><p>Best Regards,<br/><strong>HR Department</strong></p>`;
      }
      resignation.acceptanceLetterSentAt = new Date();

      await resignation.save();

      // Send acceptance email to employee with letter attached inline
      sendMail(
        resignation.employeeEmail,
        "Resignation Accepted — Acceptance Letter",
        `<div style="font-family:Arial,sans-serif;max-width:700px;margin:auto;">
          <h2 style="color:#1e40af;">Resignation Acceptance — ${resignation.employeeName}</h2>
          ${resignation.acceptanceLetterHtml}
          <hr/>
          <p style="color:#64748b;font-size:12px;">This is an automated email from HRMS.</p>
        </div>`
      );

      return res.status(200).json({ message: "Resignation approved. Acceptance letter sent.", resignation });
    }

    res.status(400).json({ message: "Invalid action." });
  } catch (err) {
    console.error("Decision error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ADMIN / EMPLOYEE: Move to Exit Formalities
// POST /api/resignations/admin/exit-formalities/:id
// ============================================================
router.post("/admin/exit-formalities/:id", protect, onlyAdmin, async (req, res) => {
  try {
    const resignation = await Resignation.findById(req.params.id);
    if (!resignation) return res.status(404).json({ message: "Not found" });
    resignation.status = "Exit Formalities";
    await resignation.save();
    res.status(200).json({ message: "Moved to Exit Formalities.", resignation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ADMIN: Upload exit document (admin side)
// POST /api/resignations/admin/upload-doc/:id/:docIndex
// ============================================================
router.post("/admin/upload-doc/:id/:docIndex", protect, onlyAdmin, upload.single("file"), async (req, res) => {
  try {
    const resignation = await Resignation.findById(req.params.id);
    if (!resignation) return res.status(404).json({ message: "Not found" });
    const idx = parseInt(req.params.docIndex);
    if (!resignation.exitDocuments[idx]) return res.status(400).json({ message: "Invalid document index" });

    const url = await uploadToCloudinary(req.file.buffer, req.file.originalname);
    resignation.exitDocuments[idx].uploadedByAdmin = url;
    await resignation.save();
    res.status(200).json({ message: "Admin document uploaded.", url, resignation });
  } catch (err) {
    console.error("Admin upload doc error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// EMPLOYEE: Upload exit document (employee side)
// POST /api/resignations/employee/upload-doc/:id/:docIndex
// ============================================================
router.post("/employee/upload-doc/:id/:docIndex", protect, upload.single("file"), async (req, res) => {
  try {
    const resignation = await Resignation.findById(req.params.id);
    if (!resignation) return res.status(404).json({ message: "Not found" });
    const idx = parseInt(req.params.docIndex);
    if (!resignation.exitDocuments[idx]) return res.status(400).json({ message: "Invalid document index" });

    const url = await uploadToCloudinary(req.file.buffer, req.file.originalname);
    resignation.exitDocuments[idx].uploadedByEmployee = url;
    await resignation.save();
    res.status(200).json({ message: "Employee document uploaded.", url, resignation });
  } catch (err) {
    console.error("Employee upload doc error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ADMIN: Verify a document
// POST /api/resignations/admin/verify-doc/:id/:docIndex
// ============================================================
router.post("/admin/verify-doc/:id/:docIndex", protect, onlyAdmin, async (req, res) => {
  try {
    const resignation = await Resignation.findById(req.params.id);
    if (!resignation) return res.status(404).json({ message: "Not found" });
    const idx = parseInt(req.params.docIndex);
    if (!resignation.exitDocuments[idx]) return res.status(400).json({ message: "Invalid document index" });

    resignation.exitDocuments[idx].verifiedByAdmin = true;
    resignation.exitDocuments[idx].verifiedAt = new Date();
    await resignation.save();
    res.status(200).json({ message: "Document verified.", resignation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ADMIN / EMPLOYEE: Add a new document placeholder
// POST /api/resignations/:id/add-document
// ============================================================
router.post("/:id/add-document", protect, async (req, res) => {
  try {
    const resignation = await Resignation.findById(req.params.id);
    if (!resignation) return res.status(404).json({ message: "Not found" });
    const nextDocNum = resignation.exitDocuments.length + 1;
    resignation.exitDocuments.push({
      docName: `Document ${nextDocNum}`,
      uploadedByEmployee: "",
      uploadedByAdmin: "",
      verifiedByAdmin: false,
    });
    await resignation.save();
    res.status(200).json({ message: "Added new document placeholder.", resignation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ADMIN: Mark Resignation as Completed
// POST /api/resignations/admin/complete/:id
// ============================================================
router.post("/admin/complete/:id", protect, onlyAdmin, async (req, res) => {
  try {
    const resignation = await Resignation.findByIdAndUpdate(
      req.params.id,
      { status: "Completed" },
      { new: true }
    );
    if (!resignation) return res.status(404).json({ message: "Not found" });

    sendMail(
      resignation.employeeEmail,
      "Exit Formalities Completed — Thank You",
      `<p>Dear ${resignation.employeeName},</p><p>Your exit formalities have been successfully completed. We wish you the very best in your future endeavors. It has been our pleasure to have you as part of our team.</p><p>Warm regards,<br/><strong>HR Department</strong></p>`
    );

    res.status(200).json({ message: "Resignation marked as Completed.", resignation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SYSTEM: Check notice period countdowns (called by cron/interval)
// POST /api/resignations/system/check-countdowns
// ============================================================
router.post("/system/check-countdowns", async (req, res) => {
  try {
    const now = new Date();
    const expiredResignations = await Resignation.find({
      status: "Approved",
      noticePeriodEndDate: { $lte: now },
      countdownAlertSent: false,
    });

    for (const r of expiredResignations) {
      // Send alert email to admin (we don't have admin email in this model, but we can add)
      sendMail(
        r.employeeEmail,
        "Notice Period Has Ended — Exit Formalities Next",
        `<p>Dear ${r.employeeName},</p><p>Your notice period has officially ended. Please proceed with exit formalities. HR will contact you shortly.</p>`
      );
      r.countdownAlertSent = true;
      r.status = "Exit Formalities";
      await r.save();
    }

    res.status(200).json({ processed: expiredResignations.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
