import dotenv from "dotenv";
dotenv.config(); // Load environment variables FIRST

import express from "express";
import cors from "cors";
import mongoose from "mongoose"; // ✅ Import mongoose
import employeeRoutes from "./routes/employeeRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import holidayRoutes from "./routes/holidayRoutes.js";
import noticeRoutes from "./routes/noticeRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
// Make sure you have an authRoutes file for this import



const app = express();

// --- CORS Configuration ---
const allowedOrigins = [
  process.env.FRONTEND_URL, // Your frontend production URL
  'http://localhost:5173',  // Vite default port
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'https://hrms-420.netlify.app',
  'https://hrms-ask.onrender.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies if needed
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// --- Middleware ---
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Add body size limit
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Security Headers Middleware ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// --- Database Connection with Production Options ---
const mongoUri = process.env.MONGO_URI;

const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5s
  socketTimeoutMS: 45000, // Close sockets after 45s
};

mongoose.connect(mongoUri, mongooseOptions)
    .then(() => {
        console.log('✅ Database Connected Successfully');
    })
    .catch((err) => {
        console.error('❌ Database connection error:', err);
        // Exit process with failure
        process.exit(1);
    });

// --- Health Check Route ---
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// --- API Routes (CORRECTED FOR CONSISTENCY) ---
 // Added for login functionality
app.use("/api/employees", employeeRoutes); // ✅ FIXED
app.use("/api/attendance", attendanceRoutes); // ✅ FIXED
app.use("/api/holidays", holidayRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/leaves", leaveRoutes); // Added for leave management

// --- 404 Handler ---
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  console.error('🚨 Error:', err.stack);
  
  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS policy: Origin not allowed'
    });
  }
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate field value entered'
    });
  }
  
  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message
  });
});

// --- Server Listener ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Allowed origins: ${allowedOrigins.join(', ')}`);
});