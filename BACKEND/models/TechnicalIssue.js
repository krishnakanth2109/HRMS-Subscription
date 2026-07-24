import mongoose from "mongoose";

const technicalIssueSchema = new mongoose.Schema(
  {
    adminId: { 
      type: mongoose.Schema.Types.ObjectId, 
      required: [true, "Admin ID is required"], 
      ref: "Admin" 
    },
    companyId: { 
      type: mongoose.Schema.Types.ObjectId, 
      required: [true, "Company ID is required"], 
      ref: "Company" 
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      maxlength: [150, "Subject cannot exceed 150 characters"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
    },
    images: [
      {
        url: String,
        publicId: String,
      },
    ],
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    raisedByName: { type: String, default: "" },
    raisedByEmail: { type: String, default: "" },
    role: {
      type: String,
      enum: ["employee", "admin"], 
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "resolved", "rejected"],
      default: "pending",
    },
    approvalByAdmin: {
      type: Boolean,
      default: false,
    },
    resolvedMessage: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

technicalIssueSchema.index({ adminId: 1, status: 1 });
technicalIssueSchema.index({ companyId: 1 });

export default mongoose.model("TechnicalIssue", technicalIssueSchema);