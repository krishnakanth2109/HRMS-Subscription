import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import http from "http";
import path from "path";
import { Server } from "socket.io";

/* ==================== ✅ ALLOWED ORIGINS ==================== */
const allowedOrigins = [
  "https://hrms-subscription-kill.onrender.com",
  "http://vwsync.com",
  "https://vwsync.com",
  "https://hrms-vaz.netlify.app",
  "http://localhost:5173", 
  "http://localhost:3000"
];

/* ==================== ROUTE IMPORTS ==================== */
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
import profilePicRoutes from "./routes/ProfilePicRoute.js";
import idleTimeRoutes from "./routes/idleTimeRoutes.js";
import shiftRoutes from "./routes/shiftRoutes.js";
import categoryAssignmentRoutes from "./routes/categoryAssignmentRoutes.js";
import adminRoutes from "./routes/locationsetting.js";
import requestWorkModeRoutes from "./routes/requestWorkModeRoutes.js";
import punchOutRoutes from "./routes/punchOutRequestRoutes.js";
import groupRoutes from "./routes/groupRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import rulesRoutes from "./routes/rules.js";
import chatRoutes from "./routes/messageRoutes.js";
import payrollRoutes from "./routes/payroll.js";
import adminAuthRoutes from "./routes/adminAuthRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import invitedEmployeeRoutes from "./routes/invitedEmployeeRoutes.js";
import mailRoutes from "./routes/mailRoutes.js";
import issueRoutes from "./routes/issueRoutes.js";
import offerLetterRoutes from "./routes/offerLetterRoutes.js";
import offerResponseRoutes from "./routes/offerResponseRoutes.js";
import inductionRoutes from "./routes/inductionRoutes.js";

import resignationRoutes from "./routes/resignationRoutes.js";



/* ==================== 🔹 STRIPE IMPORTS ==================== */
import stripeRoutes from "./routes/stripeRoutes.js";
import stripeWebhookHandler from "./controllers/stripeWebhookController.js";
import masterRoutes from "./routes/masterRoutes.js";
import demoRequestRoutes from "./routes/Demorequest.js";
import payrollcandidatesRoutes from "./routes/payrollcandidatesRoutes.js";
import documentVerificationRoutes from "./routes/documentVerificationRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import welcomeKitRoutes from "./routes/Welcomekitroutes.js";




const app = express();
const server = http.createServer(app);

// Trust proxy required for Render deployments to get correct IPs
app.set('trust proxy', 1);

/* ==================== ✅ CORS MIDDLEWARE ==================== */
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS Blocked request from: ${origin}`); 
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.options("*", cors()); 

/* ==================== 🔥 STRIPE WEBHOOK ==================== */
// MUST be before express.json()
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

/* ==================== BODY PARSERS ==================== */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* ==================== SOCKET.IO ==================== */
const userSocketMap = new Map();

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
  pingTimeout: 60000,
});

app.set("io", io);
app.set("userSocketMap", userSocketMap);

io.on("connection", (socket) => {
  socket.on("register", (userId) => {
    if (userId) userSocketMap.set(userId.toString(), socket.id);
  });
  
  socket.on("authenticate", (userId) => {
    if (!userId) return;
    socket.join(`user_${userId.toString()}`);
  });

  socket.on("disconnect", () => {
    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        userSocketMap.delete(userId);
        break;
      }
    }
  });
});

/* ==================== SECURITY HEADERS ==================== */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!req.originalUrl.includes("/proxy-doc")) {
    res.setHeader("X-Frame-Options", "DENY");
  }
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

/* ==================== 🛠️ DATABASE CONNECTION 🛠️ ==================== */
mongoose.set('strictQuery', false); // Best practice to prevent warnings

// Enhanced connection settings to prevent infinite 10000ms timeouts
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000, // Fail fast after 5 seconds if DB is unreachable (Network IP blocked)
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  })
  .then(() => console.log("✅ Database Connected Successfully"))
  .catch((err) => {
    console.error("❌ MONGODB CONNECTION FATAL ERROR ❌");
    console.error("Could not connect to Database. Did you whitelist 0.0.0.0/0 in MongoDB Atlas?");
    console.error(err.message);
  });

// Listen for disconnects so the server doesn't silently break later
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB Disconnected');
});

/* ==================== ROUTES ==================== */
app.get("/health", (req, res) => res.status(200).json({ status: "OK", dbState: mongoose.connection.readyState }));

app.use("/public", express.static(path.join(process.cwd(), "public")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/overtime", overtimeRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/attendance", EmployeeattendanceRoutes);
app.use("/api/admin/attendance", AdminAttendanceRoutes);
app.use("/api/profile", profilePicRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/idletime", idleTimeRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/category-assign", categoryAssignmentRoutes);
app.use("/api/admin", adminRoutes); 
app.use("/api/admin", adminAuthRoutes);
app.use("/api/work-mode", requestWorkModeRoutes);
app.use("/api/punchoutreq", punchOutRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/rules", rulesRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/payroll", payrollRoutes); 
app.use("/api/payroll", payrollcandidatesRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/invited-employees", invitedEmployeeRoutes);
app.use("/api/mail", mailRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/offer-letters", offerLetterRoutes);
app.use("/api/offer-letters", offerResponseRoutes);
app.use('/api/payroll', payrollcandidatesRoutes);
app.use('/api/doc-verification', documentVerificationRoutes);
app.use('/api/ai', aiRoutes);
app.use("/api/induction", inductionRoutes);


/* ==================== 🔹 STRIPE ROUTES ==================== */
app.use("/api/resignations", resignationRoutes);
app.use("/api/doc-verification", documentVerificationRoutes);
app.use("/api/welcome-kit", welcomeKitRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/master", masterRoutes);
app.use("/api/demo-request", demoRequestRoutes);

/* ==================== FRONTEND FALLBACK ==================== */
app.use(express.static(path.join(process.cwd(), "../FRONTEND/dist")));

app.get("*", (req, res, next) => {
  if (req.originalUrl.startsWith("/api")) return next();
  res.sendFile(path.join(process.cwd(), "../FRONTEND/dist/index.html"), (err) => {
    if (err) res.status(500).send("Frontend build not found.");
  });
});

/* ==================== 404 & ERROR HANDLER ==================== */
app.use("/api", (req, res) => {
  res.status(404).json({ message: `API route ${req.method} ${req.url} not found` });
});

app.use((err, req, res, next) => {
  console.error("🚨 Server Error:", err.message);
  res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
});

/* ==================== START SERVER ==================== */
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
