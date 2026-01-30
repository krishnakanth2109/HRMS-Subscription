// --- START OF FILE routes/messageRoutes.js ---
import express from "express";
import Message from "../models/Message.js";
import Employee from "../models/employeeModel.js";
import Group from "../models/Group.js";
import { protect } from "../controllers/authController.js";

const router = express.Router();

// ========== SEND MESSAGE (Scoped) ==========
router.post("/send", protect, async (req, res) => {
  try {
    const { receiverId, message, groupId } = req.body;
    const senderId = req.user._id; 

    if (!receiverId || !message.trim()) {
      return res.status(400).json({ error: "Receiver and message required" });
    }

    const receiver = await Employee.findById(receiverId);
    if (!receiver) return res.status(404).json({ error: "Receiver not found" });

    // Verify company scope if sender is employee
    if (req.user.role === 'employee' && req.user.company.toString() !== receiver.company.toString()) {
        return res.status(403).json({ error: "Cannot message outside company" });
    }

    if (groupId) {
      const group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ error: "Group not found" });

      const senderInGroup = group.members.some(m => m.employee.toString() === senderId.toString()) || group.groupLeader.toString() === senderId.toString();
      const receiverInGroup = group.members.some(m => m.employee.toString() === receiverId.toString()) || group.groupLeader.toString() === receiverId.toString();

      if (!senderInGroup || !receiverInGroup) {
        return res.status(403).json({ error: "Both users must be in the group" });
      }
    }

    // Inject Hierarchy
    const newMessage = await Message.create({
      adminId: req.user.role === 'admin' ? req.user._id : req.user.adminId,
      companyId: req.user.role === 'admin' ? null : req.user.company,
      sender: senderId,
      receiver: receiverId,
      message: message.trim(),
      isRead: false,
    });

    await newMessage.populate(["sender", "receiver"]);
    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== GET CONVERSATION ==========
router.get("/conversation/:userId", protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
    })
      .populate("sender", "name employeeId")
      .populate("receiver", "name employeeId")
      .sort({ createdAt: 1 });

    await Message.updateMany(
      { sender: userId, receiver: currentUserId, isRead: false },
      { isRead: true }
    );

    res.json(messages);
  } catch (error) {
    console.error("Get conversation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== GET GROUP MESSAGES ==========
router.get("/group/:groupId", protect, async (req, res) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const isInGroup = group.members.some(m => m.employee.toString() === currentUserId.toString()) || group.groupLeader.toString() === currentUserId.toString();
    if (!isInGroup) return res.status(403).json({ error: "Not a member" });

    const groupMemberIds = group.members.map(m => m.employee.toString());
    groupMemberIds.push(group.groupLeader.toString());

    // Messages between any group members
    const messages = await Message.find({
      sender: { $in: groupMemberIds },
      receiver: { $in: groupMemberIds },
    })
      .populate("sender", "name employeeId")
      .populate("receiver", "name employeeId")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error("Get group messages error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== GET UNREAD MESSAGES COUNT ==========
router.get("/unread/count", protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const count = await Message.countDocuments({ receiver: userId, isRead: false });
    res.json({ count });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== GET ALL CONVERSATIONS (INBOX) ==========
router.get("/inbox", protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }],
        },
      },
      {
        $group: {
          _id: { $cond: [{ $eq: ["$sender", userId] }, "$receiver", "$sender"] },
          lastMessage: { $last: "$message" },
          lastMessageTime: { $last: "$createdAt" },
          unreadCount: {
            $sum: { $cond: [{ $and: [{ $eq: ["$receiver", userId] }, { $eq: ["$isRead", false] }] }, 1, 0] },
          },
        },
      },
      { $sort: { lastMessageTime: -1 } },
    ]);

    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const user = await Employee.findById(conv._id).select("name employeeId");
        return { ...conv, user };
      })
    );

    res.json(enriched);
  } catch (error) {
    console.error("Get inbox error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;