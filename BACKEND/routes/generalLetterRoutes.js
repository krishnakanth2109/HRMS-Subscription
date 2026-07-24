import express from "express";
import nodemailer from "nodemailer";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import Employee from "../models/Employee.js";
import OfferLetterEmployee from "../models/OfferLetterEmployee.js";

const router = express.Router();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_PORT == 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false }
});

router.post("/send-email", protect, onlyAdmin, async (req, res) => {
  try {
    const adminId = req.user._id;
    const { employeeId, pdfBase64, companyName, emailBody, letterType } = req.body;
    const type = letterType || "Document";

    if (!employeeId) return res.status(400).json({ message: "Employee ID is required" });

    // Try finding in Employee first, then OfferLetterEmployee
    let emp = await Employee.findOne({ _id: employeeId });
    if (!emp) {
      emp = await OfferLetterEmployee.findOne({ _id: employeeId });
    }

    if (!emp) return res.status(404).json({ message: "Employee not found" });

    const company = companyName || "Your Company";
    const empName = emp.name || emp.employeeName || "Employee";
    const empEmail = emp.email || emp.employeeEmail;

    const customBody = emailBody || `Dear ${empName},\n\nWe are pleased to send you the ${type} from ${company}.\n\nPlease find the detailed document attached.\n\nBest Regards,\nHR Team`;

    // Build plain simple email HTML
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #000; line-height: 1.6;">
        ${customBody.replace(/\n/g, "<br>")}
      </div>
    `;

    // Build mail options
    const mailOptions = {
      from: `"${company} HR" <${process.env.SMTP_USER}>`,
      to: empEmail,
      subject: `${type} - ${empName}`,
      html: emailHtml,
    };

    // Attach PDF if provided
    if (pdfBase64) {
      const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
      const safeName = empName.replace(/\s+/g, "_");
      mailOptions.attachments = [{
        filename: `${type.replace(/\s+/g, "_")}_${safeName}.pdf`,
        content: base64Data,
        encoding: "base64",
        contentType: "application/pdf"
      }];
    }

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: `${type} email sent successfully with the attached PDF.`,
      status: "Sent"
    });
  } catch (error) {
    console.error("Error initiating general email:", error);
    res.status(500).json({ error: "Failed to initiate sending process." });
  }
});

export default router;
