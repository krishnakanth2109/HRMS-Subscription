import nodemailer from "nodemailer";
import dotenv from "dotenv";
import axios from "axios";
import Employee from "../models/employeeModel.js";
import Admin from "../models/adminModel.js";

dotenv.config();

// 1. Create the primary Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 465, // Use 587 for TLS, 465 for SSL
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER, // Your email address
    pass: process.env.SMTP_PASS, // Your App Password (not login password)
  },
});

// Verify connection configuration (optional)
transporter.verify(function (error, success) {
  if (error) {
    console.log("❌ Local Nodemailer Server Error. Mails will fall back to Brevo if configured.");
  } else {
    console.log("✅ Local Nodemailer Server is ready to take messages");
  }
});

// 2. Define the fallback mechanism
const sendMailWithBrevoFallback = async (mailOptions) => {
  try {
    // Attempt to inject Admin email dynamically for employee communications
    if (!mailOptions.replyTo && mailOptions.to && !mailOptions.skipAdminOverride) {
      try {
        let toEmail = "";
        if (typeof mailOptions.to === 'string') {
          toEmail = mailOptions.to.split(',')[0].trim();
        } else if (Array.isArray(mailOptions.to)) {
          toEmail = typeof mailOptions.to[0] === 'string' ? mailOptions.to[0].trim() : mailOptions.to[0].email || mailOptions.to[0].address;
        }

        if (toEmail) {
          const emp = await Employee.findOne({ email: toEmail }).lean();
          if (emp && emp.adminId) {
            const admin = await Admin.findById(emp.adminId).lean();
            if (admin && admin.email) {
              mailOptions.replyTo = admin.email;
              const senderName = admin.name || admin.companyName || "HR Admin";
              mailOptions.from = `"${senderName}" <${process.env.SMTP_USER}>`;
            }
          }
        }   
      } catch (err) {
        console.error("Error fetching admin email for dynamic sender:", err.message);
      }
    }

    // 💥 First Attempt: Send via Nodemailer
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.log("⚠️ Nodemailer failed:", error.message);

    // 💡 Second Attempt: Fallback to Brevo API
    if (!process.env.BREVO_API_KEY) {
      console.log("❌ Brevo API Key not provided, cannot use fallback.");
      throw error;
    }

    console.log("🔄 Nodemailer failed. Falling back to Brevo API...");

    // Parse the sender
    let senderName = "HRMS System";
    let senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || "no-reply@company.com";
    if (mailOptions.from) {
      const fromMatch = mailOptions.from.match(/"?([^"]+)"?\s*<([^>]+)>/);
      if (fromMatch) {
        senderName = fromMatch[1];
        // Only override if not strictly enforced
        if (!process.env.BREVO_SENDER_EMAIL) {
          senderEmail = fromMatch[2];
        }
      } else if (!process.env.BREVO_SENDER_EMAIL) {
        senderEmail = mailOptions.from;
      }
    }

    // Parse the receivers
    let toArr = [];
    if (typeof mailOptions.to === 'string') {
      toArr = mailOptions.to.split(',').map(email => ({ email: email.trim() }));
    } else if (Array.isArray(mailOptions.to)) {
      toArr = mailOptions.to.map(email => ({ email: typeof email === 'string' ? email.trim() : email.email || email.address }));
    }

    // Process attachments
    let mappedAttachments = [];
    if (mailOptions.attachments && mailOptions.attachments.length > 0) {
      mappedAttachments = mailOptions.attachments.map(att => {
        let base64Content = "";
        if (att.content && Buffer.isBuffer(att.content)) {
          base64Content = att.content.toString("base64");
        } else if (typeof att.content === "string") {
          base64Content = Buffer.from(att.content).toString("base64");
        }
        return {
          content: base64Content,
          name: att.filename || att.name || "attachment"
        };
      });
    }

    // Build Brevo payload
    const payload = {
      sender: { name: senderName, email: senderEmail },
      to: toArr,
      subject: mailOptions.subject || "No Subject",
      htmlContent: mailOptions.html || mailOptions.text || "<p></p>"
    };

    if (mailOptions.replyTo) {
      payload.replyTo = { email: mailOptions.replyTo };
    }

    if (mappedAttachments.length > 0) {
      payload.attachment = mappedAttachments;
    }

    try {
      const response = await axios.post("https://api.brevo.com/v3/smtp/email", payload, {
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "api-key": process.env.BREVO_API_KEY
        }
      });
      console.log("✅ Brevo API fallback successful. MessageId:", response.data?.messageId);
      return response.data;
    } catch (brevoError) {
      console.log("❌ Both Nodemailer and Brevo API failed!");
      console.log("Brevo Error:", brevoError.response?.data || brevoError.message);
      throw error; // Return original Nodemailer error to source
    }
  }
};

// 3. Export custom object matching Nodemailer signature
const customTransporter = {
  sendMail: sendMailWithBrevoFallback,
  verify: transporter.verify.bind(transporter) // Expose verify for backward compatibility
};

export default customTransporter;