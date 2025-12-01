import express from "express";
import WorkModeRequest from "../models/WorkModeRequest.js";
import OfficeSettings from "../models/OfficeSettings.js";
import Employee from "../models/Employee.js";

const router = express.Router();

// 1. Submit a Request (Employee)
router.post("/request", async (req, res) => {
  try {
    const { 
      employeeId, employeeName, department, 
      requestType, fromDate, toDate, recurringDays, requestedMode, reason 
    } = req.body;

    // Validate based on type
    if (requestType === "Temporary" && (!fromDate || !toDate)) {
      return res.status(400).json({ message: "Dates required for Temporary request" });
    }
    if (requestType === "Recurring" && (!recurringDays || recurringDays.length === 0)) {
      return res.status(400).json({ message: "Days required for Recurring request" });
    }

    const newRequest = new WorkModeRequest({
      employeeId, employeeName, department,
      requestType, fromDate, toDate, recurringDays, requestedMode, reason
    });

    await newRequest.save();
    res.status(201).json({ message: "Request submitted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// 2. Get Requests for an Employee (Employee View)
router.get("/my-requests/:employeeId", async (req, res) => {
  try {
    const requests = await WorkModeRequest.find({ employeeId: req.params.employeeId }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// 3. Get All Pending Requests (Admin View)
router.get("/pending-requests", async (req, res) => {
  try {
    const requests = await WorkModeRequest.find({ status: "Pending" }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// 4. Approve or Reject Request (Admin Action)
router.put("/action", async (req, res) => {
  try {
    const { requestId, action } = req.body; // action = "Approved" or "Rejected"

    const request = await WorkModeRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (action === "Rejected") {
      request.status = "Rejected";
      await request.save();
      return res.status(200).json({ message: "Request rejected" });
    }

    if (action === "Approved") {
      // 1. Update Request Status
      request.status = "Approved";
      await request.save();

      // 2. Update Actual Office Settings
      let settings = await OfficeSettings.findOne({ type: "Global" });
      if (!settings) settings = new OfficeSettings({ type: "Global" });

      // Build the new config object based on the request
      const newConfig = {
        employeeId: request.employeeId,
        employeeName: request.employeeName,
        ruleType: request.requestType,
        updatedAt: new Date()
      };

      if (request.requestType === "Permanent") {
        newConfig.permanentMode = request.requestedMode;
      } else if (request.requestType === "Temporary") {
        newConfig.temporary = { 
          mode: request.requestedMode, 
          fromDate: request.fromDate, 
          toDate: request.toDate 
        };
      } else if (request.requestType === "Recurring") {
        newConfig.recurring = { 
          mode: request.requestedMode, 
          days: request.recurringDays 
        };
      }

      // Update or Push to OfficeSettings array
      const existingIndex = settings.employeeWorkModes.findIndex(e => e.employeeId === request.employeeId);
      if (existingIndex !== -1) {
        settings.employeeWorkModes[existingIndex] = newConfig;
      } else {
        settings.employeeWorkModes.push(newConfig);
      }

      await settings.save();
      return res.status(200).json({ message: "Request approved and settings updated" });
    }

    res.status(400).json({ message: "Invalid action" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

export default router;