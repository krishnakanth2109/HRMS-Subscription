import axios from 'axios';

export const sendBrevoEmail = async ({
  toEmail,
  toName,
  subject,
  textContent,
  htmlContent,
  attachments,
  senderName = "HRMS Admin",
}) => {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          email: process.env.BREVO_SENDER_EMAIL,
          name: senderName,
        },
        to: [{ email: toEmail, name: toName }],
        subject,
        textContent,
        htmlContent,
        attachment: attachments,
      },
      {
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Brevo Email Error:", error.response?.data || error.message);
    throw new Error("Failed to send email via Brevo");
  }
};
