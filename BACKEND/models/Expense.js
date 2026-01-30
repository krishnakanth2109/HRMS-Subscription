// --- START OF FILE models/Expense.js ---
import mongoose from 'mongoose';

const ExpenseSchema = new mongoose.Schema({
  // HIERARCHY
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

  // Employee Link
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  employeeCustomId: { type: String, required: true }, // e.g. TCS-001
  employeeName: { type: String, required: true },
  
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  description: { type: String },
  
  receiptUrl: { type: String }, 
  receiptPublicId: { type: String }, 
  
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  actionDate: { type: Date }, 
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Expense', ExpenseSchema);
// --- END OF FILE models/Expense.js ---