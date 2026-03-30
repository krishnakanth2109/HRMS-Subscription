import mongoose from "mongoose";

const offerLetterTemplateSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
  },
  name: { type: String, required: true },
  companyName: { type: String, default: "" },
  templateUrl: { type: String, required: true },
  originalFilename: { type: String, default: "" },
}, { timestamps: true });

export default mongoose.model("OfferLetterTemplate", offerLetterTemplateSchema);
