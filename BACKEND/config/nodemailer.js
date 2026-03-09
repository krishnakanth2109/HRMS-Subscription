// --- FILE: config/nodemailer.js ---

import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 465, // Use 587 for TLS, 465 for SSL
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER, // Your email address
    pass: process.env.SMTP_PASS, // Your App Password (not login password)
  },
});

// Verify connection configuration
transporter.verify(function (error, success) {
  if (error) {
    console.log("❌ Email Server Error:", error);
  } else {
    console.log("✅ Email Server is ready to take messages");
  }
});

export default transporter;