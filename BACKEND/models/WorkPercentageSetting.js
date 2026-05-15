import mongoose from "mongoose";

const WorkPercentageSettingSchema = new mongoose.Schema(
  {
    auto_generate_percentage: {
      type: Boolean,
      default: true,
    },
    default_daily_target_percentage: {
      type: Number,
      default: 70,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

export default mongoose.model(
  "WorkPercentageSetting",
  WorkPercentageSettingSchema
);
