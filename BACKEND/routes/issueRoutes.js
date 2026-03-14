import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import jwt from "jsonwebtoken";
import mongoose from "mongoose"; // Added mongoose import
import TechnicalIssue from "../models/TechnicalIssue.js";

const router = express.Router();

const setUser = (req, res, next) => {
  try {
    let token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "No token provided" });

    token = token.replace(/(^"|"$)/g, "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userRole = (decoded.role || decoded.type || "superadmin").toLowerCase();
    const userId = decoded.id || decoded._id || decoded.userId || decoded.employeeId || decoded.adminId || decoded.masterId;

    req.user = {
      _id: userId,
      role: userRole,
      name: decoded.name || "",
      email: decoded.email || "",
      // Attempt to get hierarchy from token
      adminId: decoded.adminId,
      companyId: decoded.companyId || decoded.company,
    };

    if (!req.user._id) return res.status(401).json({ success: false, message: "Invalid token" });
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// ... Multer/Cloudinary config remains the same ...
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "hrms/technical-issues",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 1920, height: 1080, crop: "limit", quality: "auto" }],
  },
});
const upload = multer({ storage });

// ─── POST ISSUE ───────────────────────────────────────────────────────────────
router.post("/", setUser, upload.array("images", 5), async (req, res) => {
  try {
    const { subject, message, raisedByName, raisedByEmail } = req.body;
    const { _id: userId, role } = req.user;
    
    // 1. Initial attempt from token
    let finalAdminId = req.user.adminId;
    let finalCompanyId = req.user.companyId || req.user.company;

    if (!["employee", "admin"].includes(role)) {
      return res.status(403).json({ success: false, message: "SuperAdmin cannot raise issues" });
    }

    // 2. STRENGTHENED LOOKUP LOGIC
    if (role === "employee") {
      const employeeDoc = await mongoose.model("Employee").findById(userId).lean();
      
      if (!employeeDoc) {
        return res.status(404).json({ success: false, message: "Employee record not found" });
      }

      finalAdminId = finalAdminId || employeeDoc.adminId || employeeDoc.creatorId || employeeDoc.admin;
      finalCompanyId = finalCompanyId || employeeDoc.companyId || employeeDoc.company || employeeDoc.tenantId;

    } else if (role === "admin") {
      // For Admins, they are the root of the hierarchy
      finalAdminId = userId; 
      
      // Try to find a company link in the Admin document
      const adminDoc = await mongoose.model("Admin").findById(userId).lean();
      
      // FIX: If adminDoc exists, check for company fields. 
      // FALLBACK: If no company link found, the Admin's own ID is the Company Identity.
      finalCompanyId = finalCompanyId || (adminDoc ? (adminDoc.companyId || adminDoc.company) : null) || userId;
    }

    // 3. FINAL VALIDATION (Crucial for DB constraints)
    if (!finalAdminId || !finalCompanyId) {
      console.error("DEBUG HIERARCHY FAILURE:", {
        role,
        userId,
        resolved_admin: finalAdminId,
        resolved_company: finalCompanyId
      });
      return res.status(400).json({ 
        success: false, 
        message: "Missing Company/Admin Link. Your profile is not fully configured." 
      });
    }

    const images = (req.files || []).map((f) => ({
      url: f.path,
      publicId: f.filename,
    }));

    // 4. SAVE TO DB
    const issue = await TechnicalIssue.create({
      subject:       subject.trim(),
      message:       message.trim(),
      images,
      raisedBy:      userId,
      raisedByName:  raisedByName || req.user.name || "Admin User",
      raisedByEmail: raisedByEmail || req.user.email || "No Email",
      role,
      adminId:       finalAdminId,
      companyId:     finalCompanyId,
      status:        role === "admin" ? "approved" : "pending", 
      approvalByAdmin: role === "admin",
    });

    res.status(201).json({ success: true, issue });
  } catch (err) {
    console.error("POST Issue Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET ALL ISSUES (Scoping for Admin) ───────────────────────────────────
router.get("/", setUser, async (req, res) => {
  try {
    const { role, _id } = req.user;
    let filter = {};

    if (role === "employee") {
      filter = { raisedBy: _id }; 
    } else if (role === "admin") {
      // Admin sees issues they raised AND issues raised by their employees
      filter = { adminId: _id }; 
    } else if (role === "superadmin") {
      filter = {
        $or: [
          { role: "admin" },
          { role: "employee", status: { $in: ["approved", "resolved", "rejected"] } },
        ],
      };
    }

    const issues = await TechnicalIssue.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, issues });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET route filtered by Admin ID
router.get("/", setUser, async (req, res) => {
    try {
      const { role, _id } = req.user;
      let filter = {};
  
      if (role === "employee") {
        filter = { raisedBy: _id };
      } else if (role === "admin") {
        // Only fetch issues belonging to this Admin's company/ID
        filter = { adminId: _id, role: "employee" }; 
      } else if (role === "superadmin") {
        filter = {
          $or: [
            { role: "admin" },
            { role: "employee", status: { $in: ["approved", "resolved", "rejected"] } },
          ],
        };
      }
  
      const issues = await TechnicalIssue.find(filter).sort({ createdAt: -1 });
      res.json({ success: true, issues });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
});

// ... Keep other routes (patch, delete, etc.) but add adminId check to filters ...
router.patch("/:id/approve", setUser, async (req, res) => {
    try {
      if (req.user.role !== "admin") return res.status(403).json({ success: false });
      const issue = await TechnicalIssue.findOneAndUpdate(
        { _id: req.params.id, adminId: req.user._id, status: "pending" }, // Scoped to admin
        { status: "approved", approvalByAdmin: true },
        { new: true }
      );
      if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });
      res.json({ success: true, issue });
    } catch (err) { res.status(500).json({ success: false }); }
});

export default router;