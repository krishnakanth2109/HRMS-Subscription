import axios from "axios";
import Employee from "../models/employeeModel.js";
import InductionDispatch from "../models/InductionDispatch.js";
import transporter from "../config/nodemailer.js";

const INDUCTION_TYPES = [
  "Classroom Lecture",
  "PowerPoint Presentation",
  "Online Module",
  "Handout Reading Material",
  "One-to-One Session",
  "Induction Program Duration",
  "Site / Client Visit",
];

const FILE_RULES = {
  "PowerPoint Presentation": {
    required: true,
    mimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
    ],
  },
  "Handout Reading Material": {
    required: true,
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const parseEmployeeIds = (employeeIds) => {
  if (Array.isArray(employeeIds)) return employeeIds;
  if (typeof employeeIds === "string") {
    try {
      const parsed = JSON.parse(employeeIds);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const validateAttachment = (inductionType, file) => {
  const rule = FILE_RULES[inductionType];

  if (!rule) return null;

  if (!file) {
    return `${inductionType} requires a file upload.`;
  }

  if (!rule.mimeTypes.includes(file.mimetype)) {
    return `Invalid file type for ${inductionType}.`;
  }

  return null;
};

const getMailValues = ({ inductionType, formData }) => {
  const venueOrLink =
    inductionType === "Online Module"
      ? formData.meetingLink?.trim()
      : formData.venueOrPlatform?.trim();

  if (inductionType === "Induction Program Duration") {
    return {
      dateValue: `${formData.startDate} to ${formData.endDate}`,
      timeValue: formData.time?.trim() || "As per induction program schedule",
      venueOrLink,
    };
  }

  return {
    dateValue: formData.date,
    timeValue: formData.time,
    venueOrLink,
  };
};

const buildTextTemplate = ({
  employeeName,
  activityType,
  dateValue,
  timeValue,
  venueOrLink,
  adminName,
  companyName,
}) => `Dear ${employeeName},

Greetings!

You are scheduled to attend the following induction activity. Please find the details below:

Activity: ${activityType}
Date: ${dateValue}
Time: ${timeValue}
Venue / Platform: ${venueOrLink}

Kindly ensure your availability at the scheduled time.

Best regards,
${adminName}
${companyName}`;

const buildHtmlTemplate = ({
  employeeName,
  activityType,
  dateValue,
  timeValue,
  venueOrLink,
  adminName,
  companyName,
}) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #0f172a;">
    <p>Dear ${escapeHtml(employeeName)},</p>
    <p>Greetings!</p>
    <p>
      You are scheduled to attend the following induction activity.
      Please find the details below:
    </p>
    <p>
      <strong>Activity:</strong> ${escapeHtml(activityType)}<br />
      <strong>Date:</strong> ${escapeHtml(dateValue)}<br />
      <strong>Time:</strong> ${escapeHtml(timeValue)}<br />
      <strong>Venue / Platform:</strong> ${escapeHtml(venueOrLink)}
    </p>
    <p>Kindly ensure your availability at the scheduled time.</p>
    <p>
      Best regards,<br />
      ${escapeHtml(adminName)}<br />
      ${escapeHtml(companyName)}
    </p>
  </div>
`;

const getAvailableMailProviders = () => {
  const providers = [];

  if (process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL) {
    providers.push("brevo");
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    providers.push("smtp");
  }

  return providers;
};

const getPreferredMailProviders = () => {
  const configured = (process.env.MAIL_PROVIDER || "smtp,brevo")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const available = getAvailableMailProviders();

  const ordered = configured.filter((provider) => available.includes(provider));
  const fallback = available.filter((provider) => !ordered.includes(provider));

  return [...ordered, ...fallback];
};

const sendBrevoEmail = async ({
  toEmail,
  toName,
  subject,
  textContent,
  htmlContent,
  attachments,
  senderName,
}) => {
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

  const messageId =
    response?.data?.messageId ||
    response?.headers?.["x-message-id"] ||
    "";

  if (!messageId) {
    throw new Error("Brevo accepted the request without returning a message ID.");
  }

  return {
    provider: "brevo",
    messageId,
    response: response.data,
  };
};

const sendSmtpEmail = async ({
  toEmail,
  toName,
  subject,
  textContent,
  htmlContent,
  attachments,
  senderName,
}) => {
  const response = await transporter.sendMail({
    from: `"${senderName}" <${process.env.SMTP_USER}>`,
    to: toName ? `"${toName}" <${toEmail}>` : toEmail,
    subject,
    text: textContent,
    html: htmlContent,
    attachments: attachments?.map((item) => ({
      filename: item.name,
      content: item.content,
      encoding: "base64",
    })),
  });

  if (!response?.messageId) {
    throw new Error("SMTP provider accepted the request without returning a message ID.");
  }

  return {
    provider: "smtp",
    messageId: response.messageId,
    response: {
      accepted: response.accepted || [],
      rejected: response.rejected || [],
      response: response.response || "",
    },
  };
};

const sendTransactionalEmail = async (mailOptions) => {
  const providers = getPreferredMailProviders();
  const errors = [];

  if (!providers.length) {
    throw new Error(
      "No email provider is configured. Please set Brevo or SMTP credentials in the server environment."
    );
  }

  for (const provider of providers) {
    try {
      if (provider === "brevo") {
        return await sendBrevoEmail(mailOptions);
      }

      if (provider === "smtp") {
        return await sendSmtpEmail(mailOptions);
      }
    } catch (error) {
      errors.push(`${provider}: ${error.response?.data?.message || error.message}`);
    }
  }

  throw new Error(errors.join(" | "));
};

export const sendInductionEmail = async (req, res) => {
  try {
    if (!getAvailableMailProviders().length) {
      return res.status(500).json({
        success: false,
        message: "Email configuration is missing on the server.",
      });
    }

    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can send induction emails.",
      });
    }

    const employeeIds = parseEmployeeIds(req.body.employeeIds);
    const inductionType = req.body.inductionType?.trim();

    if (!employeeIds.length) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one employee.",
      });
    }

    if (!INDUCTION_TYPES.includes(inductionType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid induction type selected.",
      });
    }

    if (
      inductionType === "One-to-One Session" &&
      employeeIds.length !== 1
    ) {
      return res.status(400).json({
        success: false,
        message: "One-to-One Session supports only one employee.",
      });
    }

    const formData = {
      date: req.body.date?.trim() || "",
      time: req.body.time?.trim() || "",
      venueOrPlatform: req.body.venueOrPlatform?.trim() || "",
      meetingLink: req.body.meetingLink?.trim() || "",
      startDate: req.body.startDate?.trim() || "",
      endDate: req.body.endDate?.trim() || "",
    };

    if (inductionType === "Induction Program Duration") {
      if (!formData.startDate || !formData.endDate || !formData.venueOrPlatform) {
        return res.status(400).json({
          success: false,
          message: "Start date, end date, and venue/platform are required.",
        });
      }
    } else if (inductionType === "Online Module") {
      if (!formData.date || !formData.time || !formData.meetingLink) {
        return res.status(400).json({
          success: false,
          message: "Date, time, and meeting link are required.",
        });
      }
    } else {
      if (!formData.date || !formData.time || !formData.venueOrPlatform) {
        return res.status(400).json({
          success: false,
          message: "Date, time, and venue/platform are required.",
        });
      }
    }

    const attachmentError = validateAttachment(inductionType, req.file);
    if (attachmentError) {
      return res.status(400).json({
        success: false,
        message: attachmentError,
      });
    }

    const employees = await Employee.find({
      _id: { $in: employeeIds },
      adminId: req.user._id,
      isActive: true,
    }).select("name email companyName employeeId");

    if (!employees.length) {
      return res.status(404).json({
        success: false,
        message: "No matching active employees found.",
      });
    }

    if (employees.length !== employeeIds.length) {
      return res.status(400).json({
        success: false,
        message: "Some selected employees were not found or are not active.",
      });
    }

    const attachments = req.file
      ? [
          {
            name: req.file.originalname,
            content: req.file.buffer.toString("base64"),
          },
        ]
      : undefined;

    const { dateValue, timeValue, venueOrLink } = getMailValues({
      inductionType,
      formData,
    });

    const adminName = req.user.name || "HR Team";
    const subject = `${inductionType} - Induction Schedule`;

    const mailResults = await Promise.allSettled(
      employees.map(async (employee) => {
        const companyName = employee.companyName || "HRMS";

        const templateValues = {
          employeeName: employee.name,
          activityType: inductionType,
          dateValue,
          timeValue,
          venueOrLink,
          adminName,
          companyName,
        };

        const delivery = await sendTransactionalEmail({
          toEmail: employee.email,
          toName: employee.name,
          subject,
          textContent: buildTextTemplate(templateValues),
          htmlContent: buildHtmlTemplate(templateValues),
          attachments,
          senderName: adminName,
        });

        return {
          employeeId: employee.employeeId,
          employeeName: employee.name,
          email: employee.email,
          status: "sent",
          provider: delivery.provider,
          providerMessageId: delivery.messageId,
        };
      })
    );

    const successResults = [];
    const failedResults = [];

    mailResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successResults.push(result.value);
      } else {
        const employee = employees[index];
        failedResults.push({
          employeeId: employee.employeeId,
          employeeName: employee.name,
          email: employee.email,
          status: "failed",
          provider: "",
          providerMessageId: "",
          error:
            result.reason?.response?.data?.message ||
            result.reason?.message ||
            "Failed to send email.",
        });
      }
    });

    const responseBody = {
      success: failedResults.length === 0,
      message:
        failedResults.length === 0
          ? `Induction email accepted by the mail provider for ${successResults.length} employee(s).`
          : `Induction email accepted for ${successResults.length} employee(s), ${failedResults.length} failed.`,
      summary: {
        total: employees.length,
        sent: successResults.length,
        failed: failedResults.length,
      },
      results: [...successResults, ...failedResults],
    };

    const dispatchRecord = await InductionDispatch.create({
      adminId: req.user._id,
      adminName,
      inductionType,
      subject,
      companyName: employees[0]?.companyName || "HRMS",
      formData,
      templateSnapshot: {
        dateValue,
        timeValue,
        venueOrLink,
      },
      attachment: req.file
        ? {
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
          }
        : undefined,
      recipients: employees.map((employee) => {
        const result =
          successResults.find((item) => item.email === employee.email) ||
          failedResults.find((item) => item.email === employee.email);

        return {
          employeeRef: employee._id,
          employeeId: employee.employeeId,
          employeeName: employee.name,
          email: employee.email,
          status: result?.status || "failed",
          provider: result?.provider || "",
          providerMessageId: result?.providerMessageId || "",
          error: result?.error || "",
        };
      }),
      summary: responseBody.summary,
    });

    responseBody.dispatchId = dispatchRecord._id;

    if (successResults.length === 0) {
      return res.status(500).json(responseBody);
    }

    if (failedResults.length > 0) {
      return res.status(207).json(responseBody);
    }

    return res.status(200).json(responseBody);
  } catch (error) {
    console.error("❌ Induction mail error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send induction emails.",
      error: error.message,
    });
  }
};
