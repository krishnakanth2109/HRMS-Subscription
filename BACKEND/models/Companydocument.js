import mongoose from "mongoose";

const companyDocumentSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
    trim: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileType: {
    type: String, // e.g., 'pdf', 'docx', 'jpg', etc.
  },
  fileSize: {
    type: Number // in bytes
  },
  cloudinaryPublicId: {
    type: String // For deletion if needed
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  description: {
    type: String,
    trim: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

companyDocumentSchema.index({ company: 1 });

export default mongoose.model("CompanyDocument", companyDocumentSchema);