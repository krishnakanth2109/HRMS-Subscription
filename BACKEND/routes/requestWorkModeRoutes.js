// --- START OF FILE routes/requestWorkModeRoutes.js ---
import express from "express";
import WorkModeRequest from "../models/WorkModeRequest.js";
import OfficeSettings from "../models/OfficeSettings.js";
import Admin from "../models/adminModel.js";
import Notification from "../models/notificationModel.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import { sendBrevoEmail } from "../Services/emailService.js";

const router = express.Router();
router.use(protect);

router.post("/request", async (req, res) => {
  try {
    const { requestType, fromDate, toDate, recurringDays, requestedMode, reason } = req.body;

    await WorkModeRequest.create({
      adminId: req.user.adminId, // Hierarchy
      companyId: req.user.company, // Hierarchy
      employeeId: req.user.employeeId,
      employeeName: req.user.name,
      department: req.user.department,
      requestType, fromDate, toDate, recurringDays, requestedMode, reason
    });

    // Notify Admin (omitted details for brevity, see previous similar files)
    res.status(201).json({ message: "Request submitted" });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

router.get("/pending-requests", onlyAdmin, async (req, res) => {
  try {
    const requests = await WorkModeRequest.find({ adminId: req.user._id, status: "Pending" });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

// Action (Approve/Reject) and Delete routes would follow here, using scoped queries.
// Same logic as in adminRoutes.js but separated file.

export default router;