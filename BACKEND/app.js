
import dotenv from "dotenv";
dotenv.config(); // Load environment variables FIRST

import express from "express";
import cors from "cors";
import mongoose from "mongoose"; // ✅ Import mongoose
import employeeRoutes from "./routes/employeeRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import holidayRoutes from "./routes/holidayRoutes.js";
import noticeRoutes from "./routes/noticeRoutes.js";
import overtimeRoutes from "./routes/overtimeRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Database Connection ---
const mongoUri = process.env.MONGO_URI;

mongoose.connect(mongoUri)
    .then(() => {
        console.log('✅ Database Connected Successfully');
    })
    .catch((err) => {
        console.error('❌ Database connection error:', err);
        // Exit process with failure
        process.exit(1);
    });


// --- API Routes ---
app.use("/employees", employeeRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/overtime", overtimeRoutes);
app.use("/api/leave", leaveRoutes);


// --- Server Listener ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));