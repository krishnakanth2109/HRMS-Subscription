import mongoose from "mongoose";

const generatedLetterSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "OfferLetterEmployee",
    required: true,
  },
  letter_type: { type: String, default: "Offer Letter" },
  content: { type: String, default: "" },
  company_name: { type: String, default: "" },
  generated_on: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model("GeneratedLetter", generatedLetterSchema);
