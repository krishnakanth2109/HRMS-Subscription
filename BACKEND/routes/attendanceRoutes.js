// // --- START OF FILE routes/attendanceRoutes.js ---

// import express from "express";
// import { protect } from "../controllers/authController.js";
// import { getAttendanceByEmployee, punchIn, punchOut } from "../controllers/attendanceController.js";

// const router = express.Router();

// // ALL attendance routes are now protected.
// router.use(protect);

// router.post("/punch-in", punchIn);
// router.post("/punch-out", punchOut);

// // This route will now get the employee's own attendance automatically
// router.get("/my-attendance", getAttendanceByEmployee);

// export default router;