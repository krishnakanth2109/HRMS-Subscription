import express from "express";
import Notice from "../models/Notice.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ============================================================================
   📌 ADMIN → GET ALL NOTICES (SCOPED)
============================================================================ */
router.get("/all", protect, onlyAdmin, async (req, res) => {
  try {
    const allNotices = await Notice.find({ adminId: req.user._id })
      .populate("createdBy", "name employeeId") 
      .populate("readBy.employeeId", "name employeeId")
      .populate("replies.employeeId", "name employeeId")
      .populate("replies.adminId", "name")
      .sort({ date: -1 });
    res.json(allNotices);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notices" });
  }
});

/* ============================================================================
   👤 EMPLOYEE → GET NOTICES (SCOPED)
   FIXED: Improved filtering for "ALL" recipients to ensure company-wide visibility
============================================================================ */
router.get("/", protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    // Identify the organization context
    const userCompany = req.user.company || req.user.companyId;
    const userAdmin = req.user.adminId;

    const query = {
        $or: [
            // Case 1: Notice is for everyone in the company/under the admin
            { 
              recipients: "ALL", 
              $or: [
                { companyId: userCompany },
                { adminId: userAdmin },
                { adminId: userId } // If the user is the admin themselves
              ]
            }, 
            // Case 2: User is specifically mentioned in recipients array
            { recipients: { $in: [userId] } },
            // Case 3: User created the notice
            { createdBy: userId } 
        ]
    };

    let notices = await Notice.find(query)
      .populate("createdBy", "name employeeId") 
      .populate("recipients", "name employeeId")
      .populate("replies.employeeId", "name employeeId")
      .populate("replies.adminId", "name")
      .sort({ date: -1 });

    // Convert to plain objects
    notices = notices.map(notice => notice.toObject());

    res.json(notices);
  } catch (error) {
    console.error("Fetch Notices Error:", error);
    res.status(500).json({ message: "Failed to fetch notices" });
  }
});

/* ============================================================================
   ✉️ CREATE NOTICE (SCOPED)
   FIXED: Ensures companyId and adminId are consistently saved
============================================================================ */
router.post("/", protect, async (req, res) => {
  try {
    const { title, description, recipients, companyId } = req.body;
    
    // If recipients is empty or explicitly "ALL", store as "ALL"
    const recipientValue = (Array.isArray(recipients) && recipients.length > 0) ? recipients : "ALL";
    
    const isAdmin = req.user.role && req.user.role.toLowerCase() === "admin";
    const creatorModel = isAdmin ? "Admin" : "Employee";

    // Determine Admin and Company IDs
    const assignedAdminId = isAdmin ? req.user._id : req.user.adminId;
    const assignedCompanyId = isAdmin 
      ? (companyId || req.user.company || req.user.companyId || req.user._id) 
      : req.user.company;

    const savedNotice = await Notice.create({
      adminId: assignedAdminId,
      companyId: assignedCompanyId,
      title,
      description,
      date: new Date(),
      createdBy: req.user._id,
      creatorModel: creatorModel,
      recipients: recipientValue
    });

    res.status(201).json({ message: "Posted", notice: savedNotice });
  } catch (e) {
    console.error("Create Notice Error:", e);
    res.status(500).json({ message: "Error creating notice", error: e.message });
  }
});

/* ============================================================================
   🛠️ UPDATE NOTICE
============================================================================ */
router.put("/:id", protect, async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) return res.status(404).json({ message: "Notice not found" });

    const userId = req.user._id;
    const isAdmin = req.user.role && req.user.role.toLowerCase() === "admin";
    const isOwner = notice.createdBy.equals(userId);

    if (isAdmin && notice.adminId && !notice.adminId.equals(userId)) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { title, description, recipients } = req.body;
    const recipientValue = (Array.isArray(recipients) && recipients.length > 0) ? recipients : "ALL";

    const updated = await Notice.findByIdAndUpdate(
      req.params.id, 
      { title, description, recipients: recipientValue }, 
      { new: true }
    );
    
    res.json({ message: "Updated", notice: updated });
  } catch (e) {
    console.error("Update Notice Error:", e);
    res.status(500).json({ message: "Error updating notice", error: e.message });
  }
});

/* ============================================================================
   🗑️ DELETE NOTICE
============================================================================ */
router.delete("/:id", protect, async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) return res.status(404).json({ message: "Notice not found" });

    const userId = req.user._id;
    const isAdmin = req.user.role && req.user.role.toLowerCase() === "admin";
    const isOwner = notice.createdBy.equals(userId);

    if (isAdmin && notice.adminId && !notice.adminId.equals(userId)) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await Notice.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (e) {
    console.error("Delete Error:", e);
    res.status(500).json({ message: "Error deleting notice" });
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
    const isAlreadyRead = notice.readBy.some(r => r.employeeId?.toString() === employeeId.toString());

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
   💬 REPLY ROUTES
============================================================================ */
router.post("/:id/reply", protect, upload.single("image"), async (req, res) => {
  try {
    const { message } = req.body;
    const notice = await Notice.findById(req.params.id);
    if (!notice) return res.status(404).json({ message: "Notice not found" });

    let imageUrl = null;
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
      const uploadResponse = await cloudinary.uploader.upload(dataURI, { folder: "hrms_replies" });
      imageUrl = uploadResponse.secure_url;
    }

    const newReply = {
      employeeId: req.user._id,
      message: message || "",
      image: imageUrl,
      sentBy: 'Employee',
      repliedAt: new Date()
    };

    notice.replies.push(newReply);
    await notice.save();

    const updated = await Notice.findById(req.params.id)
      .populate("replies.employeeId", "name employeeId");
    res.status(201).json({ message: "Reply sent", reply: updated.replies[updated.replies.length - 1] });
  } catch (error) {
    res.status(500).json({ message: "Failed to reply" });
  }
});

router.post("/:id/admin-reply", protect, onlyAdmin, upload.single("image"), async (req, res) => {
  try {
    const { message, targetEmployeeId } = req.body;
    const notice = await Notice.findOne({ _id: req.params.id, adminId: req.user._id });
    if (!notice) return res.status(404).json({ message: "Notice not found" });

    let imageUrl = null;
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
      const uploadResponse = await cloudinary.uploader.upload(dataURI, { folder: "hrms_replies" });
      imageUrl = uploadResponse.secure_url;
    }

    const newReply = {
      adminId: req.user._id,
      employeeId: targetEmployeeId,
      message: message || "",
      image: imageUrl,
      sentBy: 'Admin',
      repliedAt: new Date()
    };

    notice.replies.push(newReply);
    await notice.save();
    res.status(201).json({ message: "Reply sent" });
  } catch (error) {
    res.status(500).json({ message: "Failed to reply" });
  }
});

/* ============================================================================
   🗑️ DELETE REPLY
============================================================================ */
router.delete("/:id/reply/:replyId", protect, async (req, res) => {
  try {
    const { id, replyId } = req.params;
    const notice = await Notice.findById(id);
    if (!notice) return res.status(404).json({ message: "Notice not found" });

    const reply = notice.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    const userId = req.user._id.toString();
    const isAdmin = req.user.role && req.user.role.toLowerCase() === "admin";
    const isReplyOwner = (reply.employeeId?.toString() === userId) || (reply.adminId?.toString() === userId);

    if (isAdmin && notice.adminId && !notice.adminId.equals(userId)) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    if (!isReplyOwner && !isAdmin) return res.status(403).json({ message: "Not authorized" });

    notice.replies.pull(replyId);
    await notice.save();
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete" });
  }
});

export default router;