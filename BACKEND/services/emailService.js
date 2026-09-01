import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export const sendBrevoEmail = async ({ to, subject, htmlContent }) => {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;

    if (!apiKey || !senderEmail) {
      console.error("❌ Brevo API Key or Sender Email is missing in .env");
      return;
    }

    const data = {
      sender: { name: "HRMS Admin", email: senderEmail },
      to: to, // Expects array of objects: [{ name: "Admin", email: "admin@example.com" }]
      subject: subject,
      htmlContent: htmlContent,
    };

    const response = await axios.post("https://api.brevo.com/v3/smtp/email", data, {
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Email sent successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Failed to send email:", error.response?.data || error.message);
  }
};
