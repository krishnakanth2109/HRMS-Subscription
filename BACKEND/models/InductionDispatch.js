import mongoose from "mongoose";

const dispatchRecipientSchema = new mongoose.Schema(
  {
    employeeRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    employeeId: { type: String, default: "" },
    employeeName: { type: String, default: "" },
    email: { type: String, default: "" },
    status: {
      type: String,
      enum: ["sent", "failed"],
      required: true,
    },
    provider: { type: String, default: "" },
    providerMessageId: { type: String, default: "" },
    error: { type: String, default: "" },
  },
  { _id: false }
);

const inductionDispatchSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    adminName: { type: String, default: "" },
    designation: { type: String, default: "" },
    inductionType: { type: String, required: true },
    subject: { type: String, default: "" },
    companyName: { type: String, default: "" },
    formData: {
      date: { type: String, default: "" },
      time: { type: String, default: "" },
      venueOrPlatform: { type: String, default: "" },
      meetingLink: { type: String, default: "" },
      startDate: { type: String, default: "" },
      endDate: { type: String, default: "" },
    },
    templateSnapshot: {
      dateValue: { type: String, default: "" },
      timeValue: { type: String, default: "" },
      venueOrLink: { type: String, default: "" },
    },
    attachment: {
      fileName: { type: String, default: "" },
      mimeType: { type: String, default: "" },
      size: { type: Number, default: 0 },
    },
    recipients: [dispatchRecipientSchema],
    summary: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.model("InductionDispatch", inductionDispatchSchema);
