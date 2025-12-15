import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }, 
  
  recipients: {
    type: mongoose.Schema.Types.Mixed,
    default: 'ALL',
  },

  readBy: [{
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    readAt: { type: Date, default: Date.now }
  }],

  replies: [{
    // When Employee sends: This is their ID
    // When Admin sends: This is the TARGET Employee's ID
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    
    message: { type: String },
    image: { type: String, default: null }, // <--- ADDED THIS FIELD
    sentBy: { type: String, enum: ['Employee', 'Admin'], default: 'Employee' },
    repliedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default mongoose.model("Notice", noticeSchema);