import mongoose from "mongoose";

const fieldTrackingSettingSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      unique: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "updatedByModel",
      default: null,
    },
    updatedByModel: {
      type: String,
      enum: ["Admin", "SupportAdmin"],
      default: "Admin",
    },
  },
  { timestamps: true },
);

export default mongoose.model("FieldTrackingSetting", fieldTrackingSettingSchema);
