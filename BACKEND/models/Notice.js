// --- START OF FILE models/Notice.js ---
import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema({
  // HIERARCHY LINKS
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, default: Date.now },
  
  // Dynamic reference to support both Admin and Employee creators
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    refPath: 'creatorModel' 
  },
  creatorModel: {
    type: String,
    required: true,
    enum: ['Admin', 'Employee']
  },
  
  recipients: {
    type: mongoose.Schema.Types.Mixed,
    default: 'ALL', // Implies "All in this companyId"
  },

  readBy: [{
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    readAt: { type: Date, default: Date.now }
  }],

  replies: [{
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    message: { type: String },
    image: { type: String, default: null }, 
    sentBy: { type: String, enum: ['Employee', 'Admin'], default: 'Employee' },
    repliedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default mongoose.model("Notice", noticeSchema);