// --- FILE: routes/mailRoutes.js ---

import express from "express";
import transporter from "../config/nodemailer.js";
import { protect } from "../controllers/authController.js"; // Assuming you want this protected

const router = express.Router();

// @desc    Send Onboarding Email (Single or Bulk)
// @route   POST /api/mail/send-onboarding
// @access  Protected
router.post("/send-onboarding", protect, async (req, res) => {
  const { 
    recipientEmail, 
    recipientList, 
    emailSubject, 
    emailMessage, 
    formLink 
  } = req.body;

  try {
    // 1. Determine Recipients
    let recipients = [];

    if (recipientEmail) {
      // Single Recipient Case
      recipients.push(recipientEmail);
    } else if (recipientList) {
      // Bulk Recipient Case (split by comma, newline, or semicolon)
      recipients = recipientList
        .split(/[\n,;]/)
        .map((email) => email.trim())
        .filter((email) => email.includes("@")); // Basic validation
    }

    if (recipients.length === 0) {
      return res.status(400).json({ message: "No valid recipients found." });
    }

    // 2. Prepare Email Content
    // Replace the placeholder with the actual link
    const finalHtmlMessage = emailMessage
      .replace(/\n/g, "<br>") // Convert newlines to HTML breaks
      .replace("[ONBOARDING_LINK]", `<a href="${formLink}" style="color: #2563eb; font-weight: bold;">Click Here to Complete Onboarding</a>`);

    const plainTextMessage = emailMessage.replace("[ONBOARDING_LINK]", formLink);

    // 3. Send Emails
    // We use Promise.all to send them in parallel, or you can loop sequentially
    const emailPromises = recipients.map((toEmail) => {
      return transporter.sendMail({
        from: `"HR Team" <${process.env.SMTP_USER}>`, // Sender address
        to: toEmail,
        subject: emailSubject || "Complete Your Onboarding",
        text: plainTextMessage, // Fallback for clients that don't render HTML
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #1e3a8a;">Welcome to the Team!</h2>
            <p>${finalHtmlMessage}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #666;">If the button above doesn't work, copy and paste this link:</p>
            <p style="font-size: 12px; color: #2563eb;">${formLink}</p>
          </div>
        `,
      });
    });

    // Wait for all emails to attempt sending
    await Promise.all(emailPromises);

    res.status(200).json({ 
      success: true, 
      message: `Successfully sent emails to ${recipients.length} recipient(s).`,
      sentTo: recipients
    });

  } catch (error) {
    console.error("Send Mail Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to send emails.", 
      error: error.message 
    });
  }
});

export default router;