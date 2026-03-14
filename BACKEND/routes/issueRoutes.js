import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import jwt from "jsonwebtoken";
import TechnicalIssue from "../models/TechnicalIssue.js";

const router = express.Router();

// ─── ROBUST AUTH MIDDLEWARE ───────────────────────────────────────────────────

const setUser = (req, res, next) => {
  try {
    let token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "No token provided" });

    // Clean any accidental quotes
    token = token.replace(/(^"|"$)/g, "");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✨ FIX: If the Master token payload is missing 'role', we assume it's the SuperAdmin
    const userRole = (decoded.role || decoded.type || "superadmin").toLowerCase();

    // Look for IDs across all possible auth payload structures
    const userId = decoded.id || decoded._id || decoded.userId || decoded.employeeId || decoded.adminId || decoded.masterId;

    req.user = {
      _id: userId,
      role: userRole,
      name: decoded.name || "",
      email: decoded.email || "",
    };

    if (!req.user._id)
      return res.status(401).json({ success: false, message: "Invalid token payload (missing ID)" });

    next();
  } catch (err) {
    console.error("Issue Route Auth Error:", err.message);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

// ─── Cloudinary config ────────────────────────────────────────────────────────
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

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
});

// ─── POST ISSUE ───────────────────────────────────────────────────────────────
router.post("/", setUser, upload.array("images", 5), async (req, res) => {
  try {
    // 1. Get data from the request body (the FormData you sent from frontend)
    const { subject, message, raisedByName: bodyName, raisedByEmail: bodyEmail } = req.body;
    let { _id: raisedBy, role, name: tokenName, email: tokenEmail } = req.user;

    if (!["employee", "admin"].includes(role))
      return res.status(403).json({ success: false, message: "SuperAdmin cannot raise issues" });

    if (!subject?.trim() || !message?.trim())
      return res.status(400).json({ success: false, message: "Subject and message are required" });

    // 2. HIERARCHY OF TRUTH: 
    // First use Frontend Body -> Then Token -> Finally Database Fallback
    let finalName = bodyName || tokenName;
    let finalEmail = bodyEmail || tokenEmail;

    // 3. DATABASE FALLBACK (If name/email is still empty)
    if (!finalName || !finalEmail) {
      try {
        const modelName = role === "admin" ? "Admin" : "Employee"; 
        const userDoc = await mongoose.model(modelName).findById(raisedBy).select("name email");
        if (userDoc) {
          finalName = finalName || userDoc.name;
          finalEmail = finalEmail || userDoc.email;
        }
      } catch (dbErr) {
        console.error("DB Lookup failed:", dbErr.message);
      }
    }

    const images = (req.files || []).map((f) => ({
      url: f.path,
      publicId: f.filename,
    }));

    const isAdmin = role === "admin";

    // 4. SAVE TO DB
    const issue = await TechnicalIssue.create({
      subject:       subject.trim(),
      message:       message.trim(),
      images,
      raisedBy,
      raisedByName:  finalName || "Unknown User", // Ensure it's not empty
      raisedByEmail: finalEmail || "No Email",
      role,
      status:        isAdmin ? "approved" : "pending", 
      approvalByAdmin: isAdmin,
    });

    res.status(201).json({ success: true, issue });
  } catch (err) {
    console.error("POST Issue Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});
// ─── GET ALL ISSUES (ROLE-BASED VISIBILITY) ───────────────────────────────────
router.get("/", setUser, async (req, res) => {
  try {
    const { role, _id } = req.user;
    let filter = {};

    if (role === "employee") {
      filter = { raisedBy: _id }; // Employee sees only their own issues
    } else if (role === "admin") {
      filter = { role: "employee" }; // Admin sees all employee issues
    } else if (role === "superadmin") {
      // Superadmin sees issues raised directly by Admin, OR forwarded/actioned Employee issues
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

// ─── GET SINGLE ISSUE ─────────────────────────────────────────────────────────
router.get("/:id", setUser, async (req, res) => {
  try {
    const issue = await TechnicalIssue.findById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });
    res.json({ success: true, issue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ADMIN APPROVE (FORWARD TO SUPERADMIN) ────────────────────────────────────
router.patch("/:id/approve", setUser, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Only Admin can approve issues" });

    const issue = await TechnicalIssue.findOneAndUpdate(
      { _id: req.params.id, role: "employee", status: "pending" },
      { status: "approved", approvalByAdmin: true },
      { new: true }
    );

    if (!issue) return res.status(404).json({ success: false, message: "Issue not found or already actioned" });

    res.json({ success: true, issue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ADMIN REJECT ─────────────────────────────────────────────────────────────
router.patch("/:id/reject", setUser, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Only Admin can reject issues" });

    const { resolvedMessage } = req.body;
    if (!resolvedMessage?.trim()) return res.status(400).json({ success: false, message: "Rejection reason is required" });

    const issue = await TechnicalIssue.findOneAndUpdate(
      { _id: req.params.id, role: "employee", status: "pending" },
      { status: "rejected", resolvedMessage },
      { new: true }
    );

    if (!issue) return res.status(404).json({ success: false, message: "Issue not found or already actioned" });

    res.json({ success: true, issue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SUPERADMIN RESOLVE ───────────────────────────────────────────────────────
router.patch("/:id/resolve", setUser, async (req, res) => {
  try {
    if (req.user.role !== "superadmin")
      return res.status(403).json({ success: false, message: "Only SuperAdmin can resolve issues" });

    const { resolvedMessage } = req.body;
    if (!resolvedMessage?.trim()) return res.status(400).json({ success: false, message: "Resolution message is required" });

    const issue = await TechnicalIssue.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ["approved", "pending"] } },
      { status: "resolved", resolvedMessage },
      { new: true }
    );

    if (!issue) return res.status(404).json({ success: false, message: "Issue not found or already resolved" });

    res.json({ success: true, issue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE ISSUE ─────────────────────────────────────────────────────────────
router.delete("/:id", setUser, async (req, res) => {
  try {
    const issue = await TechnicalIssue.findById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });

    const isOwner = issue.raisedBy.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "superadmin")
      return res.status(403).json({ success: false, message: "Not authorized to delete this issue" });

    for (const img of issue.images) {
      if (img.publicId) await cloudinary.uploader.destroy(img.publicId).catch(() => {});
    }

    await issue.deleteOne();
    res.json({ success: true, message: "Issue deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;