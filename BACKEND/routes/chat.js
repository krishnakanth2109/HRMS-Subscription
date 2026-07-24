import express from "express";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import Employee from "../models/Employee.js"; 
import { protect } from "../controllers/authController.js";

const router = express.Router();

/* ============================================================================
   📨 SEND MESSAGE (Create)
============================================================================ */
router.post("/send", protect, async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.user._id;

    if (!message || !receiverId) return res.status(400).json({ message: "Required fields missing" });

    const newMessage = await Message.create({
      sender: senderId,
      receiver: receiverId,
      message,
    });
    
    // Populate sender details for immediate frontend display
    await newMessage.populate("sender", "name");
    
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: "Error sending message", error: error.message });
  }
});

/* ============================================================================
   👥 GET CHAT USERS (Sidebar Persistence & Unread Counts)
   Finds users and attaches unread message counts.
============================================================================ */
router.get("/users", protect, async (req, res) => {
  try {
    const currentUserId = new mongoose.Types.ObjectId(req.user._id);

    // 1. Find distinct users interacted with
    const interactedUsers = await Message.aggregate([
      { 
        $match: { 
          $or: [{ sender: currentUserId }, { receiver: currentUserId }] 
        } 
      },
      {
        $project: {
          otherPartyId: {
            $cond: { if: { $eq: ["$sender", currentUserId] }, then: "$receiver", else: "$sender" }
          }
        }
      },
      {
        $group: { _id: "$otherPartyId" } 
      }
    ]);

    const userIds = interactedUsers.map(u => u._id);

    // 2. Fetch User Details
    const users = await Employee.find({ _id: { $in: userIds } }).select("name employeeId role");

    // 3. Attach Unread Count for each user
    // Count messages where sender is THE user, receiver is ME, and isRead is false
    const usersWithCounts = await Promise.all(users.map(async (user) => {
      const count = await Message.countDocuments({
        sender: user._id,
        receiver: currentUserId,
        isRead: false
      });
      return {
        ...user.toObject(),
        unreadCount: count
      };
    }));

    // Sort: Users with unread messages go to top
    usersWithCounts.sort((a, b) => b.unreadCount - a.unreadCount);

    res.json(usersWithCounts);
  } catch (error) {
    console.error("Error fetching chat users:", error);
    res.status(500).json({ message: "Error fetching chat users" });
  }
});

/* ============================================================================
   ✅ MARK MESSAGES AS READ
   Marks all messages from a specific sender to me as read
============================================================================ */
router.put("/read/:senderId", protect, async (req, res) => {
  try {
    const senderId = req.params.senderId;
    const receiverId = req.user._id;

    await Message.updateMany(
      { sender: senderId, receiver: receiverId, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking messages read:", error);
    res.status(500).json({ message: "Failed to mark as read" });
  }
});

/* ============================================================================
   📜 GET CHAT HISTORY
============================================================================ */
router.get("/history/:otherUserId", protect, async (req, res) => {
  try {
    const myId = req.user._id;
    const otherId = req.params.otherUserId;

    if (!otherId || otherId === 'undefined') return res.status(400).json({ message: "Invalid ID" });

    const messages = await Message.find({
      $or: [
        { sender: myId, receiver: otherId },
        { sender: otherId, receiver: myId },
      ],
    })
    .sort({ createdAt: 1 })
    .populate("sender", "name")
    .populate("receiver", "name");

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch history" });
  }
});

/* ============================================================================
   ✏️ EDIT MESSAGE
============================================================================ */
router.put("/:id", protect, async (req, res) => {
  try {
    const { message } = req.body;
    const msgId = req.params.id;
    const userId = req.user._id;

    const originalMsg = await Message.findById(msgId);
    
    if (!originalMsg) return res.status(404).json({ message: "Message not found" });
    
    if (originalMsg.sender.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    originalMsg.message = message;
    await originalMsg.save();

    res.json({ message: "Updated successfully", updatedMessage: originalMsg });
  } catch (error) {
    res.status(500).json({ message: "Error updating message" });
  }
});

/* ============================================================================
   🗑️ DELETE MESSAGE
============================================================================ */
router.delete("/:id", protect, async (req, res) => {
  try {
    const msgId = req.params.id;
    const userId = req.user._id;

    const originalMsg = await Message.findById(msgId);
    
    if (!originalMsg) return res.status(404).json({ message: "Message not found" });

    if (originalMsg.sender.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await Message.findByIdAndDelete(msgId);
    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting message" });
  }
});

export default router;