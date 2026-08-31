// --- START OF FILE routes/requestWorkModeRoutes.js ---
import express from "express";
import WorkModeRequest from "../models/WorkModeRequest.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import { serviceApplyWFH } from "../services/hrmsActionServices.js";

const router = express.Router();
router.use(protect);

router.post("/request", async (req, res) => {
  try {
    const { fromDate, toDate, requestedMode, reason } = req.body;
    const io = req.app.get("io");

    const wfhDoc = await serviceApplyWFH({
      loggedUser: req.user,
      fromDate,
      toDate,
      requestedMode,
      reason,
      io,
    });

    res.status(201).json({ message: "Request submitted", data: wfhDoc });
  } catch (error) {
    res.status(400).json({ message: error.message || "Server Error" });
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

router.put("/request/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existingRequest = await WorkModeRequest.findById(id);

    if (!existingRequest) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (existingRequest.status !== "Pending") {
      return res.status(403).json({ message: "Cannot edit a request that is already approved or rejected" });
    }

    // Save original data on first edit
    if (!existingRequest.isEdited) {
      existingRequest.originalData = {
        requestType: existingRequest.requestType,
        fromDate: existingRequest.fromDate,
        toDate: existingRequest.toDate,
        recurringDays: existingRequest.recurringDays,
        requestedMode: existingRequest.requestedMode,
        reason: existingRequest.reason,
      };
    }

    existingRequest.requestType = updateData.requestType || existingRequest.requestType;
    existingRequest.fromDate = updateData.fromDate || existingRequest.fromDate;
    existingRequest.toDate = updateData.toDate || existingRequest.toDate;
    existingRequest.recurringDays = updateData.recurringDays || existingRequest.recurringDays;
    existingRequest.requestedMode = updateData.requestedMode || existingRequest.requestedMode;
    existingRequest.reason = updateData.reason || existingRequest.reason;

    existingRequest.isEdited = true;
    existingRequest.lastEditedAt = new Date();
    existingRequest.editCount += 1;

    await existingRequest.save();

    // Notify Admin via socket (if socket io is setup)
    const io = req.app.get("io");
    if (io) {
      io.emit("workMode:updated", { 
        message: `Employee ${existingRequest.employeeName} has updated their Work Mode Request. Please review the updated details.`
      });
    }

    res.status(200).json({ message: "Request updated successfully", data: existingRequest });
  } catch (error) {
    console.error("Error updating work mode request:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Action (Approve/Reject) and Delete routes would follow here, using scoped queries.
// Same logic as in adminRoutes.js but separated file.

export default router;