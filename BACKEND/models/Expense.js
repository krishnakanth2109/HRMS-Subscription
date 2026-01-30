import mongoose from 'mongoose';

const ExpenseSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, required: true },
  employeeCustomId: { type: String, required: true },
  employeeName: { type: String, required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  description: { type: String },
  receiptUrl: { type: String }, // Cloudinary URL
  receiptPublicId: { type: String }, // Cloudinary public ID
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  actionDate: { type: Date }, // Date when approved/rejected
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Expense', ExpenseSchema);