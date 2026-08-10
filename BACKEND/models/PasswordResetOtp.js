import mongoose from "mongoose";

const passwordResetOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      index: true,
    },
    otp: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600, // 600 seconds = 10 minutes
    },
  },
  { timestamps: true }
);

const PasswordResetOtp = mongoose.model("PasswordResetOtp", passwordResetOtpSchema);

export default PasswordResetOtp;
