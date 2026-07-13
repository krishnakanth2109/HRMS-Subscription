import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import Employee from "./models/employeeModel.js";
import { recordFieldWorkLocationForEmployee } from "./controllers/fieldTrackingController.js";

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
import workRoutes from "./routes/workRoutes.js";
import webauthnRoutes from "./routes/webauthnRoutes.js";
import faceAuthRoutes from "./routes/faceAuthRoutes.js";
import generalLetterRoutes from "./routes/generalLetterRoutes.js";
import adminTaskRoutes from "./routes/adminTaskRoutes.js";
const { employeeWorkRoutes, adminWorkRoutes } = workRoutes;

/* ==================== 🔹 RAZORPAY IMPORT ==================== */
import razorpayRoutes from "./routes/razorpayRoutes.js";
import masterRoutes from "./routes/masterRoutes.js";
import demoRequestRoutes from "./routes/Demorequest.js";
import payrollcandidatesRoutes from "./routes/payrollcandidatesRoutes.js";
import documentVerificationRoutes from "./routes/documentVerificationRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import welcomeKitRoutes from "./routes/Welcomekitroutes.js";
import fieldTrackingRoutes from "./routes/fieldTrackingRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";

/* ==================== DOMAIN IMPORTS ==================== */
import { subdomainMiddleware } from "./middleware/subdomainmiddleware.js";
import domainRoutes from "./routes/Domainroutes.js";

const app = express();
const server = http.createServer(app);

app.set("trust proxy", 1);

/* ==================== ✅ FORCE WWW REDIRECT ==================== */
app.use((req, res, next) => {
  if (req.hostname === "vwsync.com") {
    return res.redirect(301, "https://www.vwsync.com" + req.originalUrl);
  }
  next();
});

/* ==================== ✅ ALLOWED ORIGINS ==================== */
const allowedOrigins = [
  "https://vwsync.com",
  "https://www.vwsync.com",
  "http://vwsync.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://hrms-vaz.netlify.app",
  "https://hrms-subscription-kill.onrender.com",
];

/* ==================== ✅ ORIGIN CHECK ==================== */
const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // allow all subdomains
  if (/^https?:\/\/([a-z0-9-]+\.)?vwsync\.com$/i.test(origin)) {
    return true;
  }

  return false;
};

/* ==================== ✅ SUBDOMAIN MIDDLEWARE ==================== */
app.use(subdomainMiddleware);

/* ==================== ✅ CORS ==================== */
const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      console.warn("❌ Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
  ],

  credentials: true,
};

app.use(cors(corsOptions));

/* ==================== ✅ IMPORTANT PREFLIGHT FIX ==================== */
app.options("*", cors(corsOptions));

/* ==================== BODY PARSERS ==================== */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* ==================== SOCKET.IO ==================== */
const userSocketMap = new Map();

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Socket CORS Error"));
      }
    },

    methods: ["GET", "POST"],
    credentials: true,
  },

  transports: ["polling", "websocket"],
  pingTimeout: 60000,
});

app.set("io", io);
app.set("userSocketMap", userSocketMap);

/* ==================== SOCKET CONNECTION ==================== */
io.on("connection", (socket) => {
  console.log("✅ Socket Connected:", socket.id);

  socket.on("register", (userId) => {
    if (userId) {
      userSocketMap.set(userId.toString(), socket.id);
    }
  });

  socket.on("authenticate", (userId) => {
    if (!userId) return;

    socket.userId = userId.toString();
    socket.join(`user_${userId.toString()}`);
  });

  socket.on("fieldTracking:postLocation", async (payload = {}, ack) => {
    try {
      if (!socket.userId) {
        if (typeof ack === "function") ack({ ok: false, message: "Not authenticated." });
        return;
      }

      const employee = await Employee.findById(socket.userId).lean();
      if (!employee) {
        if (typeof ack === "function") ack({ ok: false, message: "Employee not found." });
        return;
      }

      const result = await recordFieldWorkLocationForEmployee({
        employee,
        tripId: payload.tripId,
        body: {
          latitude: payload.point?.latitude ?? payload.latitude,
          longitude: payload.point?.longitude ?? payload.longitude,
          accuracy: payload.point?.accuracy ?? payload.accuracy,
          speed: payload.point?.speed ?? payload.speed,
          heading: payload.point?.heading ?? payload.heading,
          recordedAt: payload.point?.recordedAt ?? payload.recordedAt,
          distanceKm: payload.distanceKm,
          stoppedSeconds: payload.stoppedSeconds,
          stops: payload.stops,
          breaks: payload.breaks,
        },
        io,
      });

      if (result.error) {
        if (typeof ack === "function") {
          ack({
            ok: false,
            trackingDisabled: result.error.trackingDisabled,
            message: result.error.message,
          });
        }
        return;
      }

      if (typeof ack === "function") {
        ack({ ok: true, trip: result.trip });
      }
    } catch (error) {
      console.error("fieldTracking:postLocation socket error:", error);
      if (typeof ack === "function") {
        ack({ ok: false, message: "Failed to record location." });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket Disconnected:", socket.id);

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

/* ==================== DATABASE ==================== */
mongoose.set("strictQuery", false);

mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log("✅ MongoDB Connected");
  })
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
  });

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB Disconnected");
});

/* ==================== HEALTH ==================== */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    dbState: mongoose.connection.readyState,
  });
});

/* ==================== STATIC ==================== */
app.use("/public", express.static(path.join(process.cwd(), "public")));

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
app.use("/api/doc-verification", documentVerificationRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/induction", inductionRoutes);
app.use("/api/resignations", resignationRoutes);
app.use("/api/welcome-kit", welcomeKitRoutes);
app.use("/api/general-letters", generalLetterRoutes);
app.use("/api/field-tracking", fieldTrackingRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/work", employeeWorkRoutes);
app.use("/api/work/admin", adminWorkRoutes);
app.use("/api/admin-tasks", adminTaskRoutes);
app.use("/api/webauthn", webauthnRoutes);
app.use("/api/face-auth", faceAuthRoutes);

/* ==================== 🔹 RAZORPAY ROUTES ==================== */
app.use("/api/razorpay", razorpayRoutes);
app.use("/api/master", masterRoutes);
app.use("/api/superadmin", masterRoutes);
app.use("/api/demo-request", demoRequestRoutes);
app.use("/api/domain", domainRoutes);

/* ==================== FRONTEND ==================== */
app.use(express.static(path.join(process.cwd(), "../FRONTEND/dist")));

app.get("*", (req, res, next) => {
  if (req.originalUrl.startsWith("/api")) {
    return next();
  }

  res.sendFile(
    path.join(process.cwd(), "../FRONTEND/dist/index.html"),
    (err) => {
      if (err) {
        res.status(500).send("Frontend build not found");
      }
    }
  );
});

/* ==================== 404 ==================== */
app.use("/api", (req, res) => {
  res.status(404).json({
    message: `API route ${req.method} ${req.url} not found`,
  });
});

/* ==================== ERROR HANDLER ==================== */
app.use((err, req, res, next) => {
  console.error("🚨 Server Error:", err.message);

  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

/* ==================== START SERVER ==================== */
const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
