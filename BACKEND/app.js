// --- START OF FILE app.js ---

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";

// Import Routes
import employeeRoutes from "./routes/employeeRoutes.js";
import holidayRoutes from "./routes/holidayRoutes.js";
import noticeRoutes from "./routes/noticeRoutes.js";
import overtimeRoutes from "./routes/overtimeRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import EmployeeattendanceRoutes from "./routes/EmployeeattendanceRoutes.js";
import AdminAttendanceRoutes from "./routes/AdminAttendanceRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
<<<<<<< HEAD
import profilePicRoutes from "./routes/ProfilePicRoute.js"; // <--- IMPORT ADDED

const app = express();

// For Notification
=======
import profilePicRoutes from "./routes/ProfilePicRoute.js"; // ✅ ADD THIS LINE

const app = express();

// ========================================================
// 🔥 CREATE HTTP SERVER (IMPORTANT FOR SOCKET.IO)
// ========================================================
>>>>>>> d3f1a52c130b6bf0556b0370bd41ad0c7911bbd2
const server = http.createServer(app);

// ========================================================
// 🔥 SOCKET.IO SETUP
// ========================================================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  },
});

// Attach io so routes can use req.app.get("io")
app.set("io", io);

io.on("connection", (socket) => {
  console.log("🔥 User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

// ========================================================
// CORS Setup
// ========================================================
const allowedOrigins = [
<<<<<<< HEAD
  process.env.FRONTEND_URL, // Your frontend production URL from .env
  'http://localhost:5173',  // Vite default port
  'https://hrms-420.netlify.app',
  'https://hrms-ask.onrender.com',
=======
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "https://hrms-420.netlify.app",
  "https://hrms-ask.onrender.com",
  "http://localhost:5000",
>>>>>>> d3f1a52c130b6bf0556b0370bd41ad0c7911bbd2
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) callback(null, true);
    else callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Security Headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

<<<<<<< HEAD
// --- Database Connection ---
const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri)
    .then(() => {
        console.log('✅ Database Connected Successfully');
    })
    .catch((err) => {
        console.error('❌ Database connection error:', err);
        process.exit(1);
    });
=======
// ========================================================
// DATABASE
// ========================================================
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Database Connected Successfully"))
  .catch((err) => {
    console.error("❌ Database connection error:", err);
    process.exit(1);
  });
>>>>>>> d3f1a52c130b6bf0556b0370bd41ad0c7911bbd2

// Health Check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

<<<<<<< HEAD
// --- API Routes (Standardized with /api prefix) ---
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
=======
// ========================================================
// ROUTES
// ========================================================
app.use("/api/auth", authRoutes);
>>>>>>> d3f1a52c130b6bf0556b0370bd41ad0c7911bbd2
app.use("/api/employees", employeeRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/overtime", overtimeRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/attendance", EmployeeattendanceRoutes);
app.use("/api/admin/attendance", AdminAttendanceRoutes);
<<<<<<< HEAD
app.use("/api/profile", profilePicRoutes); // <--- ROUTE REGISTRATION ADDED

app.use("/api/leaves", leaveRoutes); // Corrected from '/api/leave' to match frontend api.js
app.use("/api/attendance", EmployeeattendanceRoutes); // Primary attendance route
app.use("/api/admin/attendance", AdminAttendanceRoutes); // Admin-specific attendance route
=======
>>>>>>> d3f1a52c130b6bf0556b0370bd41ad0c7911bbd2
app.use("/api/users", userRoutes);
app.use("/notifications", notificationRoutes);
app.use("/api/profile", profilePicRoutes); // ✅ ADD THIS LINE

// 404 Handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("🚨 Global Error Handler:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : err.message,
  });
});

// ========================================================
// 🔥 START SERVER WITH SOCKET.IO
// ========================================================
const PORT = process.env.PORT || 5000;
<<<<<<< HEAD
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Allowed origins: ${allowedOrigins.join(', ')}`);
});
=======
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running with Socket.io on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});

// --- END OF FILE app.js ---
>>>>>>> d3f1a52c130b6bf0556b0370bd41ad0c7911bbd2
