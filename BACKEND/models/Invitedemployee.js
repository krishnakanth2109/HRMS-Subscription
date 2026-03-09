import mongoose from "mongoose";

const invitedEmployeeSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: { type: String }, // Added
  role: { type: String }, // Added
  department: { type: String, enum: ['IT', 'NON-IT'] }, // Added
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['pending', 'onboarded', 'revoked'],
    default: 'pending'
  },
  employmentType: { type: String, enum: ['Full-time', 'Intern', 'Contract'] },
  salary: { type: Number },
  invitedAt: {
    type: Date,
    default: Date.now
  },
  onboardedAt: {
    type: Date
  },
  signatureUrl: { type: String }, 
  policyStatus: { 
    type: String, 
    enum: ['accepted', 'not accepted'], 
    default: 'not accepted' 
  },
  policyAcceptedAt: { type: Date },
  requiredDocuments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyDocument'
  }]
  
}, {
  timestamps: true
}

);

invitedEmployeeSchema.index({ email: 1 });
invitedEmployeeSchema.index({ company: 1, status: 1 });

export default mongoose.model("InvitedEmployee", invitedEmployeeSchema);