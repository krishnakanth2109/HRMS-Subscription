import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";

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
import chatRoutes from "./routes/messageRoutes.js"; // ✅ updated import path
import payrollRoutes from "./routes/payroll.js";
import adminAuthRoutes from "./routes/adminAuthRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import invitedEmployeeRoutes from "./routes/invitedEmployeeRoutes.js";
import mailRoutes from "./routes/mailRoutes.js";
import issueRoutes from "./routes/issueRoutes.js";

/* ==================== 🔹 STRIPE IMPORTS ==================== */
import stripeRoutes from "./routes/stripeRoutes.js";
import stripeWebhookHandler from "./controllers/stripeWebhookController.js";
import masterRoutes from "./routes/masterRoutes.js";

const app = express();
const server = http.createServer(app);

/* ==================== CORS CONFIG ==================== */
const allowedOrigins = [
  "https://hrms-420.netlify.app",
  "http://localhost:5173",
  "https://hrms-ask.onrender.com",
  "https://hrms-ask-1.onrender.com",
  "http://localhost:5000",
  "https://hrms-vaz.netlify.app/",
  "https://hrms-subscription.onrender.com",
  "https://hanshithacreations.com",
  "https://vwsync.com/",
];

/* ==================== SOCKET.IO ==================== */
const userSocketMap = new Map();

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  },
});

app.set("io", io);
app.set("userSocketMap", userSocketMap);

io.on("connection", (socket) => {
  console.log("🔥 Socket connected:", socket.id);

  // ── Existing registration (keep for other features) ──────────────────────
  socket.on("register", (userId) => {
    if (userId) {
      userSocketMap.set(userId.toString(), socket.id);
      console.log(`📋 Registered: ${userId}`);
    }
  });

  // ── ✅ NEW: Chat room join — frontend emits 'authenticate' after connect ──
  // This joins the socket into a private room named user_<id> so that
  // io.to(`user_${receiverId}`) in messageRoutes can deliver messages instantly
  socket.on("authenticate", (userId) => {
    if (!userId) return;
    const id = userId.toString();
    socket.join(`user_${id}`);
    socket.data.userId = id;
    socket.emit("authenticated", { userId: id });
    console.log(`✅ Chat authenticated, joined room: user_${id}`);
  });

  // ── ✅ NEW: Typing indicators ────────────────────────────────────────────
  socket.on("typing_start", ({ receiverId, senderId, senderName }) => {
    if (receiverId && senderId) {
      io.to(`user_${receiverId}`).emit("user_typing", {
        userId:   senderId,
        userName: senderName,
      });
    }
  });

  socket.on("typing_stop", ({ receiverId, senderId }) => {
    if (receiverId && senderId) {
      io.to(`user_${receiverId}`).emit("user_stopped_typing", {
        userId: senderId,
      });
    }
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    // Clean up userSocketMap (existing logic)
    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        userSocketMap.delete(userId);
        break;
      }
    }
    console.log(`❌ Socket disconnected: ${socket.data.userId || socket.id}`);
  });
});

/* =====================================================
   🔥 STRIPE WEBHOOK (MUST BE FIRST, RAW BODY)
===================================================== */
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

/* ==================== BODY PARSERS ==================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ==================== CORS ==================== */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors());

/* ==================== SECURITY HEADERS ==================== */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

/* ==================== DATABASE ==================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Database Connected"))
  .catch((err) => {
    console.error("❌ DB error:", err);
    process.exit(1);
  });

/* ==================== HEALTH ==================== */
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

/* ==================== ROUTES ==================== */
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
app.use("/api/work-mode", requestWorkModeRoutes);
app.use("/api/punchoutreq", punchOutRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/rules", rulesRoutes);
app.use("/api/chat", chatRoutes);   // ✅ messageRoutes.js
app.use("/api/payroll", payrollRoutes);
app.use("/api/admin", adminAuthRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/invited-employees", invitedEmployeeRoutes);
app.use("/api/mail", mailRoutes);
app.use("/api/issues", issueRoutes);

/* ==================== 🔹 STRIPE ROUTES ==================== */
app.use("/api/stripe", stripeRoutes);
app.use("/api/master", masterRoutes);

/* ==================== 404 ==================== */
app.use("*", (req, res) => {
  res.status(404).json({ message: "API route not found" });
});

/* ==================== ERROR HANDLER ==================== */
app.use((err, req, res, next) => {
  console.error("🚨 Error:", err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Unexpected error",
  });
});

/* ==================== START SERVER ==================== */
const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});