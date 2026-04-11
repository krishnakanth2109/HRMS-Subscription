// routes/welcomeKitRoutes.js
import express from "express";
import WelcomeKit from "../models/WelcomeKit.js";
import Employee from "../models/Employee.js"; // adjust path as per your project
import { protect } from "../middleware/authMiddleware.js"; // adjust as per your project

const router = express.Router();

// ─────────────────────────────────────────────
// GET /api/welcome-kit/status/:employeeId
// Check if employee has already submitted welcome kit
// ─────────────────────────────────────────────
router.get("/status/:employeeId", protect, async (req, res) => {
  try {
    const { employeeId } = req.params;

    const existing = await WelcomeKit.findOne({ employeeId });

    if (existing) {
      return res.json({
        submitted: true,
        data: existing,
      });
    }

    return res.json({ submitted: false });
  } catch (error) {
    console.error("WelcomeKit status error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/welcome-kit/submit
// Submit welcome kit for an employee
// ─────────────────────────────────────────────
// routes/Welcomekitroutes.js - Update the submit route
router.post("/submit", protect, async (req, res) => {
  try {
    const {
      employeeId,
      employeeCode,
      employeeName,
      department,
      role,
      email,
      itemsReceived,
      notTakenAnything,
    } = req.body;

    // More detailed validation
    if (!employeeId) {
      return res.status(400).json({ message: "employeeId is required" });
    }
    
    if (!employeeName) {
      return res.status(400).json({ message: "employeeName is required" });
    }

    // Check if employee exists in database (optional but recommended)
    const employeeExists = await Employee.findById(employeeId);
    if (!employeeExists) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Prevent duplicate submission
    const existing = await WelcomeKit.findOne({ employeeId });
    if (existing) {
      return res.status(400).json({
        message: "Welcome kit already submitted for this employee",
        data: existing,
      });
    }

    // Ensure itemsReceived has all required fields
    const defaultItemsReceived = {
      laptop: false,
      mouse: false,
      keyboard: false,
      pen: false,
      book: false,
      cupMug: false,
      yearlyCalendar: false,
      documentFolder: false,
      keychain: false,
      waterBottle: false,
      other: false,
      otherDescription: "",
    };

    const mergedItemsReceived = {
      ...defaultItemsReceived,
      ...itemsReceived,
    };

    const kit = new WelcomeKit({
      employeeId,
      employeeCode: employeeCode || employeeExists.employeeId || "",
      employeeName: employeeName || employeeExists.name || "",
      department: department || employeeExists.department || employeeExists.experienceDetails?.[employeeExists.experienceDetails?.length - 1]?.department || "",
      role: role || employeeExists.experienceDetails?.[employeeExists.experienceDetails?.length - 1]?.role || employeeExists.currentRole || employeeExists.role || "",
      email: email || employeeExists.email || "",
      itemsReceived: mergedItemsReceived,
      notTakenAnything: notTakenAnything || false,
    });

    await kit.save();

    return res
      .status(201)
      .json({ message: "Welcome kit submitted successfully", data: kit });
  } catch (error) {
    console.error("WelcomeKit submit error:", error);
    // Send back detailed error for debugging
    res.status(500).json({ 
      message: "Server error", 
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
});

// ─────────────────────────────────────────────
// GET /api/welcome-kit/all
// Admin: Get all submitted welcome kits with employee details
// ─────────────────────────────────────────────
router.get("/all", protect, async (req, res) => {
  try {
    const kits = await WelcomeKit.find()
      .populate(
        "employeeId",
        "name employeeId department role currentRole experienceDetails email profilePic"
      )
      .sort({ submittedAt: -1 });

    return res.json({ count: kits.length, data: kits });
  } catch (error) {
    console.error("WelcomeKit all error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/welcome-kit/:id
// Admin: Delete a welcome kit entry (optional)
// ─────────────────────────────────────────────
router.delete("/:id", protect, async (req, res) => {
  try {
    const deleted = await WelcomeKit.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Welcome kit not found" });
    }
    return res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("WelcomeKit delete error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;