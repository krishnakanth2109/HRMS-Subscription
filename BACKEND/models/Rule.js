// --- START OF FILE models/Rule.js ---
import mongoose from 'mongoose';

const ruleSchema = new mongoose.Schema({
  // HIERARCHY LINKS
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

  title: {
    type: String,
    required: true,
    trim: true
  },
  description: { type: String, required: true },
  category: { type: String, default: "General" },
  
  images: [
    {
      url: { type: String, required: true },
      publicId: { type: String, required: true } 
    }
  ],

  // Legacy fields
  fileUrl: { type: String, default: "" }, 
  fileType: { type: String, default: "" }
}, { timestamps: true });

export default mongoose.model('Rule', ruleSchema);