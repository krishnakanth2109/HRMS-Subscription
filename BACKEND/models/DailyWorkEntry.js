import mongoose from 'mongoose';

const DailyWorkSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: String, required: true },
  employeeName: { type: String, required: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  
  morning_title: { type: String },
  morning_description: { type: String },
  morning_time: { type: String }, // e.g. "09:30 AM"
  
  evening_description: { type: String },
  evening_time: { type: String }, // e.g. "06:30 PM"
  
  employee_submitted_percentage: { type: Number, default: 0 },
  daily_work_percentage: { type: Number, default: 0 }, // Admin approved percentage
  
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  
  images: [{
    image_url: { type: String },
    public_id: { type: String }
  }],
  
  percentage_mode: { type: String, default: 'none' }, // e.g. 'manual', 'auto'
  percentage_generated_at: { type: Date },
  
  createdAt: { type: Date, default: Date.now }
});

// Compound index for efficient lookup and preventing duplicates for same day
DailyWorkSchema.index({ employeeId: 1, date: 1 }, { unique: true });

export default mongoose.model('DailyWork', DailyWorkSchema);
