import express from 'express';
import Expense from '../models/Expense.js';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage for Multer with optimized settings
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'expense-receipts',
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
      resource_type: 'auto',
      // Remove transformation for faster upload - do it client-side or async
      public_id: `receipt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }
});

// Configure multer with size limit and file filter
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and PDF are allowed.'));
    }
  }
});

// --- POST Route: Add Expense ---
router.post('/add', (req, res) => {
  upload.single('receipt')(req, res, async (err) => {
    // Handle multer errors
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          success: false, 
          message: 'File too large. Maximum size is 5MB.' 
        });
      }
      return res.status(400).json({ 
        success: false, 
        message: `Upload error: ${err.message}` 
      });
    } else if (err) {
      return res.status(400).json({ 
        success: false, 
        message: err.message 
      });
    }

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

      // Validate required fields
      if (!employeeId || !employeeCustomId || !employeeName) {
        return res.status(400).json({
          success: false,
          message: 'Employee information is required'
        });
      }

      if (!category || !amount || !date) {
        return res.status(400).json({
          success: false,
          message: 'Category, amount, and date are required'
        });
      }

      const newExpense = new Expense({
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
        // actionDate will be set when approved/rejected
      });

      const savedExpense = await newExpense.save();

      res.status(201).json({
        success: true,
        message: 'Expense submitted successfully.',
        data: savedExpense
      });

    } catch (error) {
      console.error('Error adding expense:', error);
      
      // If we uploaded a file but DB save failed, delete it from Cloudinary
      if (req.file && req.file.filename) {
        try {
          await cloudinary.uploader.destroy(req.file.filename);
        } catch (deleteError) {
          console.error('Error deleting orphaned file:', deleteError);
        }
      }
      
      res.status(500).json({ 
        success: false, 
        message: 'Server Error: ' + error.message 
      });
    }
  });
});

// --- GET Route: Fetch Expenses for a Specific Employee ---
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Employee ID is required' 
      });
    }

    // Find expenses matching the ID, sort by newest date first
    const expenses = await Expense.find({ employeeId })
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: expenses.length,
      data: expenses
    });

  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server Error: ' + error.message 
    });
  }
});

// --- ADMIN ROUTE: Get ALL Expenses (sorted by Pending first, then Date) ---
router.get('/all', async (req, res) => {
  try {
    // Fetch all expenses
    const expenses = await Expense.find().sort({ 
      status: 1,
      date: -1 
    });

    // Custom sort to force 'Pending' to the top
    const sortedExpenses = expenses.sort((a, b) => {
      if (a.status === 'Pending' && b.status !== 'Pending') return -1;
      if (a.status !== 'Pending' && b.status === 'Pending') return 1;
      return new Date(b.date) - new Date(a.date);
    });

    res.status(200).json({ 
      success: true, 
      count: sortedExpenses.length,
      data: sortedExpenses 
    });
  } catch (error) {
    console.error('Error fetching all expenses:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server Error: ' + error.message 
    });
  }
});

// --- ADMIN ROUTE: Update Expense Status (Approve/Reject) ---
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status. Must be "Approved" or "Rejected"' 
      });
    }

    const updateData = { 
      status: status,
      actionDate: new Date() // Set action date when status changes
    };

    const updatedExpense = await Expense.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!updatedExpense) {
      return res.status(404).json({ 
        success: false, 
        message: 'Expense not found' 
      });
    }

    res.status(200).json({ 
      success: true, 
      message: `Expense marked as ${status}`, 
      data: updatedExpense 
    });

  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server Error: ' + error.message 
    });
  }
});

// --- DELETE Route: Delete an Expense (Optional - Admin only) ---
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findById(id);

    if (!expense) {
      return res.status(404).json({ 
        success: false, 
        message: 'Expense not found' 
      });
    }

    // Delete receipt from Cloudinary if it exists
    if (expense.receiptPublicId) {
      try {
        await cloudinary.uploader.destroy(expense.receiptPublicId);
      } catch (cloudinaryError) {
        console.error('Error deleting file from Cloudinary:', cloudinaryError);
        // Continue with expense deletion even if Cloudinary deletion fails
      }
    }

    await Expense.findByIdAndDelete(id);

    res.status(200).json({ 
      success: true, 
      message: 'Expense deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server Error: ' + error.message 
    });
  }
});

export default router;