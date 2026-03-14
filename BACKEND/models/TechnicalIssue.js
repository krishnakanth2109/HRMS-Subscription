import mongoose from "mongoose";

const technicalIssueSchema = new mongoose.Schema(
  {
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
      enum: ["employee", "admin"], // Ensure roles are lowercase
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

technicalIssueSchema.index({ status: 1, role: 1 });
technicalIssueSchema.index({ raisedBy: 1 });

export default mongoose.model("TechnicalIssue", technicalIssueSchema);