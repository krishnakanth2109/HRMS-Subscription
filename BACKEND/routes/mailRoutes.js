// --- FILE: routes/mailRoutes.js ---

import express from "express";
import multer from "multer";
import transporter from "../config/nodemailer.js";
import { protect } from "../controllers/authController.js"; // Assuming you want this protected
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import { sendInductionEmail } from "../controllers/mailController.js";

const router = express.Router();
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

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

router.post(
  "/send-induction-email",
  protect,
  onlyAdmin,
  memoryUpload.single("attachment"),
  sendInductionEmail
);

// @desc    Send Birthday Wishes Email
// @route   POST /api/mail/send-birthday-wishes
// @access  Protected
router.post("/send-birthday-wishes", protect, onlyAdmin, async (req, res) => {
  const { employeeEmail, employeeName } = req.body;

  if (!employeeEmail) {
    return res.status(400).json({ message: "Employee email is required." });
  }

  try {
    await transporter.sendMail({
      from: `"HR Team" <${process.env.SMTP_USER}>`,
      to: employeeEmail,
      subject: "🎉 Happy Birthday from the Team! 🎂",
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin: 0; padding: 0; background-color: #f4f7f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f7f6; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
                  <!-- Header Gradient -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%); padding: 60px 20px; text-align: center;">
                      <div style="font-size: 48px; margin-bottom: 10px;">✨</div>
                      <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">Happy Birthday!</h1>
                    </td>
                  </tr>
                  <!-- Body Content -->
                  <tr>
                    <td style="padding: 50px 40px; text-align: center;">
                      <h2 style="color: #1f2937; margin-top: 0; font-size: 24px; font-weight: 700;">Dear ${employeeName || "Team Member"},</h2>
                      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                        Wishing you a fantastic birthday and a wonderful year ahead! We are so glad to have you on the team. May your day be filled with joy, laughter, and lots of cake! 🎂
                      </p>
                      <div style="margin: 40px 0;">
                        <span style="font-size: 40px; margin: 0 10px;">🎈</span>
                        <span style="font-size: 40px; margin: 0 10px;">🥳</span>
                        <span style="font-size: 40px; margin: 0 10px;">🎉</span>
                      </div>
                      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0;">
                        Enjoy your special day to the fullest!
                      </p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="color: #9ca3af; font-size: 14px; margin: 0; font-weight: 500;">Warm regards,</p>
                      <p style="color: #6b7280; font-size: 14px; margin: 5px 0 0 0; font-weight: 600;">The HR Team</p>
                    </td>
                  </tr>
                </table>
                <p style="color: #9ca3af; font-size: 12px; margin-top: 20px; text-align: center;">
                  © ${new Date().getFullYear()} Our Team. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    res.status(200).json({ success: true, message: "Birthday wishes sent successfully." });
  } catch (error) {
    console.error("Birthday Mail Error:", error);
    res.status(500).json({ success: false, message: "Failed to send birthday wishes.", error: error.message });
  }
});

export default router;
