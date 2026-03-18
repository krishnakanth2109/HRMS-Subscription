import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import TechnicalIssue from "../models/TechnicalIssue.js";

const router = express.Router();

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
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
      adminId: decoded.adminId,
      companyId: decoded.companyId || decoded.company,
    };

    if (!req.user._id) return res.status(401).json({ success: false, message: "Invalid token" });
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// ─── Cloudinary Config ────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "hrms/technical-issues",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 1920, height: 1080, crop: "limit", quality: "auto" }],
  },
});

const upload = multer({ storage });

router.post("/", setUser, upload.array("images", 5), async (req, res) => {
  try {
    const { subject, message, raisedByName, raisedByEmail } = req.body;
    const { _id: userId, role } = req.user;
    
    let finalAdminId = req.user.adminId;
    let finalCompanyId = req.user.companyId;
    let fallbackEmail = req.user.email;
    let fallbackName = req.user.name;

    // ─── FETCH USER DETAILS FROM DB TO ENSURE EMAIL IS CAPTURED ───
    if (role === "employee") {
      const emp = await mongoose.model("Employee").findById(userId).lean();
      if (emp) {
        finalAdminId = finalAdminId || emp.adminId || emp.creatorId;
        finalCompanyId = finalCompanyId || emp.companyId || emp.tenantId;
        fallbackEmail = fallbackEmail || emp.email;
        fallbackName = fallbackName || emp.name;
      }
    } else if (role === "admin" || role === "superadmin") {
      const adm = await mongoose.model("Admin").findById(userId).lean();
      if (adm) {
        finalAdminId = userId;
        finalCompanyId = finalCompanyId || adm.companyId || adm.company || userId;
        fallbackEmail = fallbackEmail || adm.email;
        fallbackName = fallbackName || adm.name;
      }
    }

    if (!finalAdminId || !finalCompanyId) {
      return res.status(400).json({ success: false, message: "Hierarchy IDs missing" });
    }

    const images = (req.files || []).map((f) => ({ url: f.path, publicId: f.filename }));

    const issue = await TechnicalIssue.create({
      subject: subject.trim(),
      message: message.trim(),
      images,
      raisedBy: userId,
      // Priority: 1. Request Body, 2. Database Lookup, 3. Token, 4. Empty String
      raisedByName: raisedByName || fallbackName || "User",
      raisedByEmail: raisedByEmail || fallbackEmail || "", 
      role,
      adminId: finalAdminId,
      companyId: finalCompanyId,
      status: (role === "admin" || role === "superadmin") ? "approved" : "pending",
      approvalByAdmin: (role === "admin" || role === "superadmin"),
    });

    res.status(201).json({ success: true, issue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET ALL ISSUES (SCOPED) ──────────────────────────────────────────────────
router.get("/", setUser, async (req, res) => {
  try {
    const { role, _id } = req.user;
    let filter = {};

    if (role === "employee") {
      filter = { raisedBy: _id };
    } else if (role === "admin") {
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

// ─── ADMIN APPROVE ────────────────────────────────────────────────────────────
router.patch("/:id/approve", setUser, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ success: false });

    const issue = await TechnicalIssue.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id, status: "pending" },
      { status: "approved", approvalByAdmin: true },
      { new: true }
    );

    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });
    res.json({ success: true, issue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ADMIN REJECT ─────────────────────────────────────────────────────────────
router.patch("/:id/reject", setUser, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ success: false });

    const { resolvedMessage } = req.body;
    const issue = await TechnicalIssue.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id, status: "pending" },
      { status: "rejected", resolvedMessage },
      { new: true }
    );

    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });
    res.json({ success: true, issue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SUPERADMIN RESOLVE (THIS FIXES YOUR 404) ─────────────────────────────────
router.patch("/:id/resolve", setUser, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const { resolvedMessage } = req.body;
    if (!resolvedMessage?.trim()) {
      return res.status(400).json({ success: false, message: "Resolution message is required" });
    }

    const issue = await TechnicalIssue.findOneAndUpdate(
      { _id: req.params.id, status: "approved" },
      { status: "resolved", resolvedMessage },
      { new: true }
    );

    if (!issue) return res.status(404).json({ success: false, message: "Issue not found or not in approved status" });

    res.json({ success: true, issue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE ISSUE ─────────────────────────────────────────────────────────────
router.delete("/:id", setUser, async (req, res) => {
  try {
    const issue = await TechnicalIssue.findById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: "Not found" });

    const isOwner = issue.raisedBy.toString() === req.user._id.toString();
    const isAdminOfIssue = req.user.role === "admin" && issue.adminId.toString() === req.user._id.toString();

    if (!isOwner && !isAdminOfIssue && req.user.role !== "superadmin") {
        return res.status(403).json({ success: false });
    }

    for (const img of issue.images) {
      if (img.publicId) await cloudinary.uploader.destroy(img.publicId).catch(() => {});
    }

    await issue.deleteOne();
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;