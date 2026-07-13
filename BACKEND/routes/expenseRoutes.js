// --- START OF FILE routes/expenseRoutes.js ---

import express from 'express';
import Expense from '../models/Expense.js';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import Notification from '../models/notificationModel.js';
import Admin from '../models/adminModel.js';
import Employee from '../models/employeeModel.js';

dotenv.config();

const router = express.Router();
router.use(protect); // Ensure auth

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'expense-receipts',
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
      resource_type: 'auto',
      public_id: `receipt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and PDF are allowed.'));
    }
  }
});

// --- POST Route: Add Expense (Scoped) ---
router.post('/add', (req, res) => {
  upload.single('receipt')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });

    try {
      const { 
        category, 
        amount, 
        date, 
        description, 
        employeeId,
        employeeCustomId, 
        employeeName 
      } = req.body;

      if (!employeeId || !employeeCustomId || !employeeName || !category || !amount || !date) {
        return res.status(400).json({ success: false, message: 'Missing fields' });
      }

      // Inject Hierarchy
      const newExpense = new Expense({
        adminId: req.user.adminId,
        companyId: req.user.company,
        employeeId,
        employeeCustomId,
        employeeName,
        category,
        amount: Number(amount),
        date,
        description: description || '',
        receiptUrl: req.file ? req.file.path : null,
        receiptPublicId: req.file ? req.file.filename : null,
        status: 'Pending'
      });

      const savedExpense = await newExpense.save();

      // Notify Admin
      const io = req.app.get("io");
      const admin = await Admin.findById(req.user.adminId);
      if (admin) {
        const notif = await Notification.create({
          adminId: admin._id,
          companyId: req.user.company,
          userId: admin._id,
          userType: "Admin",
          title: "New Expense Submitted",
          message: `${employeeName} submitted an expense of ${amount} for ${category}.`,
          type: "expense",
          isRead: false,
          date: new Date(),
        });
        if (io) io.to(`user_${admin._id}`).emit("newNotification", notif);
      }

      res.status(201).json({
        success: true,
        message: 'Expense submitted successfully.',
        data: savedExpense
      });

    } catch (error) {
      console.error('Error adding expense:', error);
      if (req.file && req.file.filename) {
        try { await cloudinary.uploader.destroy(req.file.filename); } catch (e) {}
      }
      res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
    }
  });
});

// --- GET Route: Fetch Expenses for Employee (Scoped) ---
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    const role = req.user.role;
    const isAdminOrSupport = role === 'admin' || role === 'support-admin';

    // Employees can only fetch their own expenses
    if (!isAdminOrSupport && String(req.user._id) !== employeeId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const expenses = await Expense.find({ employeeId }).sort({ date: -1 });

    res.status(200).json({ success: true, count: expenses.length, data: expenses });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- ADMIN ROUTE: Get ALL Expenses (Scoped) ---
router.get('/all', onlyAdmin, async (req, res) => {
  try {
    // Only fetch for this Admin
    const expenses = await Expense.find({ adminId: req.user._id }).sort({ status: 1, date: -1 });

    const sortedExpenses = expenses.sort((a, b) => {
      if (a.status === 'Pending' && b.status !== 'Pending') return -1;
      if (a.status !== 'Pending' && b.status === 'Pending') return 1;
      return new Date(b.date) - new Date(a.date);
    });

    res.status(200).json({ success: true, count: sortedExpenses.length, data: sortedExpenses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- ADMIN ROUTE: Update Status ---
router.put('/:id/status', onlyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updatedExpense = await Expense.findOneAndUpdate(
      { _id: id, adminId: req.user._id },
      { status: status, actionDate: new Date() },
      { new: true }
    );

    if (!updatedExpense) return res.status(404).json({ success: false, message: 'Expense not found' });

    // Notify Employee
    const io = req.app.get("io");
    const employee = await Employee.findById(updatedExpense.employeeId);
    if (employee) {
      const notif = await Notification.create({
        adminId: req.user._id,
        companyId: updatedExpense.companyId,
        userId: employee._id,
        userType: "Employee",
        title: "Expense Status Updated",
        message: `Your expense of ${updatedExpense.amount} for ${updatedExpense.category} was ${status}.`,
        type: "expense-status",
        isRead: false,
        date: new Date(),
      });
      if (io) io.to(`user_${employee._id}`).emit("newNotification", notif);
      if (io) io.to(`user_${employee._id}`).emit("expense:statusUpdate", updatedExpense);
    }

    res.status(200).json({ success: true, message: `Expense marked as ${status}`, data: updatedExpense });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- DELETE Route ---
router.delete('/:id', onlyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findOne({ _id: id, adminId: req.user._id });

    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });

    if (expense.receiptPublicId) {
      try { await cloudinary.uploader.destroy(expense.receiptPublicId); } catch (e) {}
    }

    await Expense.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: 'Expense deleted successfully' });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;