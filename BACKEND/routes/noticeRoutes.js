import express from "express";
import Notice from "../models/Notice.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();

// --- CLOUDINARY CONFIGURATION ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- MULTER CONFIGURATION (Memory Storage) ---
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ... (Keep existing GET routes and Employee Reply route as is) ...

/* ============================================================================
   💬 ADMIN → REPLY (To Specific Employee) - UPDATED FOR IMAGES
============================================================================ */
router.post("/:id/admin-reply", protect, onlyAdmin, upload.single("image"), async (req, res) => {
  try {
    const { message, targetEmployeeId } = req.body; 

    if (!targetEmployeeId) return res.status(400).json({ message: "Target employee required" });

    const notice = await Notice.findById(req.params.id);
    if (!notice) return res.status(404).json({ message: "Notice not found" });

    if (!notice.replies) notice.replies = [];

    let imageUrl = null;

    // Handle Image Upload
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
      
      const uploadResponse = await cloudinary.uploader.upload(dataURI, {
        folder: "hrms_replies",
      });
      imageUrl = uploadResponse.secure_url;
    }

    const newReply = {
      adminId: req.user._id,
      employeeId: targetEmployeeId,
      message: message || "", // Allow empty message if image exists
      image: imageUrl,       // Save URL
      sentBy: 'Admin',
      repliedAt: new Date()
    };

    notice.replies.push(newReply);
    await notice.save();

    const updated = await Notice.findById(req.params.id).populate("replies.adminId", "name");
    const addedReply = updated.replies[updated.replies.length - 1];

    res.status(201).json({ message: "Reply sent", reply: addedReply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to reply" });
  }
});

// ... (Keep the rest of the file: delete reply, create/update/delete notice) ...

/* ============================================================================
   📌 ADMIN → GET ALL NOTICES
============================================================================ */
router.get("/all", protect, onlyAdmin, async (req, res) => {
    try {
      const allNotices = await Notice.find()
        .populate("readBy.employeeId", "name employeeId") 
        .populate("replies.employeeId", "name") 
        .populate("replies.adminId", "name")
        .sort({ date: -1 });
      res.json(allNotices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notices" });
    }
  });
  
  /* ============================================================================
     👤 EMPLOYEE → GET Notices (PRIVACY FILTER ADDED)
  ============================================================================ */
  router.get("/", protect, async (req, res) => {
    try {
      const employeeId = req.user._id.toString();
      
      let notices = await Notice.find({
        $or: [
          { recipients: "ALL" },
          { recipients: { $in: [employeeId] } }
        ]
      })
      .populate("replies.employeeId", "name") 
      .populate("replies.adminId", "name")
      .sort({ date: -1 });
  
      // 🔒 PRIVACY FILTER: Only show replies belonging to this employee
      notices = notices.map(notice => {
        const noticeObj = notice.toObject();
        if (noticeObj.replies) {
          noticeObj.replies = noticeObj.replies.filter(r => 
            r.employeeId && r.employeeId._id.toString() === employeeId
          );
        }
        return noticeObj;
      });
  
      res.json(notices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notices" });
    }
  });
  
  /* ============================================================================
     ✅ MARK AS READ
  ============================================================================ */
  router.put("/:id/read", protect, async (req, res) => {
    try {
      const noticeId = req.params.id;
      const employeeId = req.user._id;
      const notice = await Notice.findById(noticeId);
      if (!notice) return res.status(404).json({ message: "Notice not found" });
  
      if (!notice.readBy) notice.readBy = [];
      const isAlreadyRead = notice.readBy.some(r => r.employeeId.toString() === employeeId.toString());
      
      if (!isAlreadyRead) {
        notice.readBy.push({ employeeId, readAt: new Date() });
        await notice.save();
      }
      res.json({ message: "Marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });
  
  /* ============================================================================
     💬 EMPLOYEE → REPLY (With Image Upload)
  ============================================================================ */
  router.post("/:id/reply", protect, upload.single("image"), async (req, res) => {
    try {
      const { message } = req.body;
      const notice = await Notice.findById(req.params.id);
      if (!notice) return res.status(404).json({ message: "Notice not found" });
  
      if (!notice.replies) notice.replies = [];
  
      let imageUrl = null;
  
      // 1. Handle Image Upload if exists
      if (req.file) {
        // Convert buffer to base64 for Cloudinary
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
        
        const uploadResponse = await cloudinary.uploader.upload(dataURI, {
          folder: "hrms_replies",
        });
        imageUrl = uploadResponse.secure_url;
      }
  
      const newReply = {
        employeeId: req.user._id,
        message: message || "", // Allow empty message if image exists
        image: imageUrl,       // Save URL
        sentBy: 'Employee',
        repliedAt: new Date()
      };
  
      notice.replies.push(newReply);
      await notice.save();
  
      const updated = await Notice.findById(req.params.id).populate("replies.employeeId", "name");
      const addedReply = updated.replies[updated.replies.length - 1];
  
      res.status(201).json({ message: "Reply sent", reply: addedReply });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to reply" });
    }
  });

  router.delete("/:id/reply/:replyId", protect, async (req, res) => {
    try {
      const { id, replyId } = req.params;
      const userId = req.user._id.toString();
      const isAdmin = req.user.role === "admin" || req.user.isAdmin === true;
  
      const notice = await Notice.findById(id);
      if (!notice) return res.status(404).json({ message: "Notice not found" });
  
      const reply = notice.replies.id(replyId);
      if (!reply) return res.status(404).json({ message: "Reply not found" });
  
      const isOwner = (reply.employeeId?.toString() === userId) || (reply.adminId?.toString() === userId);
  
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      notice.replies.pull(replyId);
      await notice.save();
      res.json({ message: "Deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete" });
    }
  });
  
  router.post("/", protect, onlyAdmin, async (req, res) => {
      try {
        const { title, description, recipients } = req.body;
        const recipientValue = recipients && recipients.length > 0 ? recipients : "ALL";
        const savedNotice = await Notice.create({ title, description, date: new Date(), createdBy: req.user._id, recipients: recipientValue });
        res.status(201).json({ message: "Posted", notice: savedNotice });
      } catch (e) { res.status(500).json({ message: "Error" }); }
  });
  router.put("/:id", protect, onlyAdmin, async (req, res) => {
      try { const updated = await Notice.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json({ message: "Updated", notice: updated }); } catch(e) { res.status(500).json({ message: "Error" }); }
  });
  router.delete("/:id", protect, onlyAdmin, async (req, res) => {
      try { await Notice.findByIdAndDelete(req.params.id); res.json({ message: "Deleted" }); } catch(e) { res.status(500).json({ message: "Error" }); }
  });
  
export default router;