import mongoose from "mongoose";

const WorkImageSchema = new mongoose.Schema(
  {
    workEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DailyWorkEntry",
      required: true,
      index: true,
    },
    image_url: {
      type: String,
      required: true,
      trim: true,
    },
    image_public_id: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model("WorkImage", WorkImageSchema);
