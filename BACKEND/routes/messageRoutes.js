import express from "express";
import Message from "../models/Message.js";
import Employee from "../models/Employee.js";
import Group from "../models/Group.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ========== SEND MESSAGE ==========
router.post("/send", protect, async (req, res) => {
  try {
    const { receiverId, message, groupId } = req.body;
    const senderId = req.user.employeeId;

    if (!receiverId || !message.trim()) {
      return res.status(400).json({ error: "Receiver and message required" });
    }

    // Verify receiver exists
    const receiver = await Employee.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: "Receiver not found" });
    }

    // If groupId provided, verify both are in the group
    if (groupId) {
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      const senderInGroup = group.members.some(m => m.employee.toString() === senderId) || group.groupLeader.toString() === senderId;
      const receiverInGroup = group.members.some(m => m.employee.toString() === receiverId) || group.groupLeader.toString() === receiverId;

      if (!senderInGroup || !receiverInGroup) {
        return res.status(403).json({ error: "Both users must be in the group" });
      }
    }

    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      message: message.trim(),
      isRead: false,
    });

    await newMessage.save();
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
    const currentUserId = req.user.employeeId;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
    })
      .populate("sender", "firstName lastName employeeId")
      .populate("receiver", "firstName lastName employeeId")
      .sort({ createdAt: 1 });

    // Mark as read
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
    const currentUserId = req.user.employeeId;

    // Verify user is in group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const isInGroup =
      group.members.some(m => m.employee.toString() === currentUserId) ||
      group.groupLeader.toString() === currentUserId;

    if (!isInGroup) {
      return res.status(403).json({ error: "Not a member of this group" });
    }

    // Get all messages between group members
    const groupMemberIds = group.members.map(m => m.employee.toString());
    groupMemberIds.push(group.groupLeader.toString());

    const messages = await Message.find({
      sender: { $in: groupMemberIds },
      receiver: { $in: groupMemberIds },
    })
      .populate("sender", "firstName lastName employeeId")
      .populate("receiver", "firstName lastName employeeId")
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
    const userId = req.user.employeeId;

    const count = await Message.countDocuments({
      receiver: userId,
      isRead: false,
    });

    res.json({ count });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== GET ALL CONVERSATIONS (INBOX) ==========
router.get("/inbox", protect, async (req, res) => {
  try {
    const userId = req.user.employeeId;

    // Get all unique users I have conversations with
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }],
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$sender", userId] },
              "$receiver",
              "$sender",
            ],
          },
          lastMessage: { $last: "$message" },
          lastMessageTime: { $last: "$createdAt" },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$receiver", userId] }, { $eq: ["$isRead", false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { lastMessageTime: -1 } },
    ]);

    // Populate user details
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const user = await Employee.findById(conv._id).select("firstName lastName employeeId");
        return {
          ...conv,
          user,
        };
      })
    );

    res.json(enriched);
  } catch (error) {
    console.error("Get inbox error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
