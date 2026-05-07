// routes/welcomeKitRoutes.js
import express from "express";
import mongoose from "mongoose";
import WelcomeKit from "../models/WelcomeKit.js";
import Employee from "../models/Employee.js"; // adjust path as per your project
import { protect } from "../middleware/authMiddleware.js"; // adjust as per your project

const router = express.Router();

// Helper function to get admin's company ID from the employee's admin association
const getAdminCompanyId = async (adminId) => {
  try {
    // Try to find any employee that has this adminId to get the company
    // Since admins are often associated with companies through employees
    const anyEmployee = await Employee.findOne({ adminId: adminId });
    if (anyEmployee && anyEmployee.company) {
      return anyEmployee.company;
    }
    
    // Alternative: Check if the adminId itself is stored as companyId in welcome kits
    // This handles cases where adminId is used as company identifier
    return adminId;
  } catch (error) {
    console.error("Error fetching admin company:", error);
    return null;
  }
};

// ─────────────────────────────────────────────
// GET /api/welcome-kit/status/:employeeId
// Check if employee has already submitted welcome kit
// ─────────────────────────────────────────────
router.get("/status/:employeeId", protect, async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Get user's company context
    const isAdmin = req.user.role && req.user.role.toLowerCase() === "admin";
    
    let query = { employeeId };
    
    if (isAdmin) {
      // For admin, check kits where adminId matches
      query = { 
        employeeId,
        $or: [
          { adminId: req.user._id },
          { companyId: req.user._id } // Some systems use adminId as companyId
        ]
      };
    } else {
      // For employee, check their own submissions
      query = { employeeId };
    }

    const existing = await WelcomeKit.findOne(query);

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

    // Check if employee exists in database
    const employeeExists = await Employee.findById(employeeId);
    if (!employeeExists) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const isAdmin = req.user.role && req.user.role.toLowerCase() === "admin";
    
    let adminId = null;
    let companyId = null;

    if (isAdmin) {
      // For admin submit (if admin is submitting on behalf of employee)
      adminId = req.user._id;
      companyId = req.user._id; // Use admin's ID as company identifier
    } else {
      // For employee submit - use their adminId and company from employee record
      adminId = employeeExists.adminId || req.user.adminId;
      companyId = employeeExists.company || req.user.company || adminId;
    }

    // Ensure we have companyId
    if (!companyId) {
      console.error("No company ID found for user:", req.user._id);
      return res.status(400).json({ message: "Cannot determine company affiliation" });
    }

    // Prevent duplicate submission
    const existing = await WelcomeKit.findOne({ 
      employeeId,
      companyId: companyId
    });
    
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
      adminId: adminId,
      companyId: companyId,
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
    res.status(500).json({ 
      message: "Server error", 
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
});

// ─────────────────────────────────────────────
// GET /api/welcome-kit/all
// Admin: Get all submitted welcome kits (FILTERED BY COMPANY)
// ─────────────────────────────────────────────
router.get("/all", protect, async (req, res) => {
  try {
    const isAdmin = req.user.role && req.user.role.toLowerCase() === "admin";
    const userId = req.user._id;



    let query = {};

    if (isAdmin) {
      // Admin sees kits where adminId matches their ID OR companyId matches their ID
      // This handles both possible data structures
      query = {
        $or: [
          { adminId: userId },
          { companyId: userId }
        ]
      };
      console.log("Admin query (by adminId or companyId):", JSON.stringify(query, null, 2));
    } else {
      // Employee sees only their own submission
      query = { employeeId: userId };
    }

    const kits = await WelcomeKit.find(query)
      .populate("employeeId", "name employeeId department role currentRole experienceDetails email profilePic")
      .sort({ submittedAt: -1 });

    console.log(`Found ${kits.length} kits for ${isAdmin ? 'admin' : 'employee'}`);

    // If no kits found, show sample for debugging
    if (isAdmin && kits.length === 0) {
      const allKits = await WelcomeKit.find().limit(5);
      console.log("All kits in DB (sample):", allKits.map(k => ({ 
        id: k._id, 
        adminId: k.adminId?.toString(), 
        companyId: k.companyId?.toString(),
        employeeName: k.employeeName,
        adminIdType: typeof k.adminId,
        companyIdType: typeof k.companyId
      })));
    }

    return res.json({ 
      count: kits.length, 
      data: kits,
      query: query
    });
  } catch (error) {
    console.error("WelcomeKit all error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/welcome-kit/:id
// Admin: Delete a welcome kit entry (SCOPED BY COMPANY)
// ─────────────────────────────────────────────
router.delete("/:id", protect, async (req, res) => {
  try {
    const isAdmin = req.user.role && req.user.role.toLowerCase() === "admin";
    const userId = req.user._id;

    if (!isAdmin) {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    // First find the kit to check permissions
    const kit = await WelcomeKit.findById(req.params.id);
    
    if (!kit) {
      return res.status(404).json({ message: "Welcome kit not found" });
    }

    // Check if kit belongs to this admin
    const isAuthorized = kit.adminId?.toString() === userId.toString() || 
                         kit.companyId?.toString() === userId.toString();
    
    if (!isAuthorized) {
      console.log(`Unauthorized delete attempt: kit admin=${kit.adminId}, kit company=${kit.companyId}, user=${userId}`);
      return res.status(403).json({ message: "Unauthorized: Cannot delete kit from another company" });
    }

    const deleted = await WelcomeKit.findByIdAndDelete(req.params.id);
    return res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("WelcomeKit delete error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/welcome-kit/company/stats
// Admin: Get company-wise welcome kit statistics
// ─────────────────────────────────────────────
router.get("/company/stats", protect, async (req, res) => {
  try {
    const isAdmin = req.user.role && req.user.role.toLowerCase() === "admin";
    
    if (!isAdmin) {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    const userId = req.user._id;
    
    const query = {
      $or: [
        { adminId: userId },
        { companyId: userId }
      ]
    };

    const totalSubmissions = await WelcomeKit.countDocuments(query);
    const takenItems = await WelcomeKit.countDocuments({ ...query, notTakenAnything: false });
    const notTaken = await WelcomeKit.countDocuments({ ...query, notTakenAnything: true });

    // Item distribution
    const itemStats = {};
    const itemsList = ["laptop", "mouse", "keyboard", "pen", "book", "cupMug", "yearlyCalendar", "documentFolder", "keychain", "waterBottle", "other"];
    
    for (const item of itemsList) {
      itemStats[item] = await WelcomeKit.countDocuments({
        ...query,
        [`itemsReceived.${item}`]: true
      });
    }

    return res.json({
      totalSubmissions,
      takenItems,
      notTaken,
      itemDistribution: itemStats
    });
  } catch (error) {
    console.error("WelcomeKit stats error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;