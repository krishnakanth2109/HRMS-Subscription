// routes/messageRoutes.js
import express from "express";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import Employee from "../models/employeeModel.js";
import { protect } from "../controllers/authController.js";

const router = express.Router();

// io lives in server.js and is shared via app.set("io", io)
// All routes access it through req.app.get("io") — no initSocket needed here
const getIO = (req) => req.app.get("io");

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/send — Send a new message
// ─────────────────────────────────────────────────────────────────────────────
router.post("/send", protect, async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.user._id;

    // console.log("📤 Send attempt:", {
    //   senderId:  senderId?.toString(),
    //   receiverId,
    //   role:      req.user.role,
    //   adminId:   req.user.adminId?.toString(),
    //   company:   req.user.company?.toString(),
    // });

    if (!receiverId || !message?.trim())
      return res.status(400).json({ error: "Receiver and message are required" });

    if (!mongoose.Types.ObjectId.isValid(receiverId))
      return res.status(400).json({ error: "Invalid receiverId" });

    // Look up receiver — try Employee first, then Admin as fallback
    let receiver = await Employee.findById(receiverId);
    if (!receiver) {
      try {
        const Admin = (await import("../models/adminModel.js")).default;
        receiver = await Admin.findById(receiverId);
      } catch (_) {}
    }
    if (!receiver)
      return res.status(404).json({ error: "Receiver not found" });

    // Company scope guard — only when both sides have a company set
    if (
      req.user.role === "employee" &&
      req.user.company &&
      receiver.company &&
      req.user.company.toString() !== receiver.company.toString()
    ) {
      return res.status(403).json({ error: "Cannot message outside your company" });
    }

    // Safely resolve hierarchy fields — never leave them undefined
    const resolvedAdminId =
      req.user.adminId || (req.user.role === "admin" ? req.user._id : null);
    const resolvedCompanyId = req.user.company || null;

    const newMessage = await Message.create({
      adminId:   resolvedAdminId,
      companyId: resolvedCompanyId,
      sender:    senderId,
      receiver:  receiverId,
      message:   message.trim(),
      isRead:    false,
    });

    await newMessage.populate([
      { path: "sender",   select: "name employeeId" },
      { path: "receiver", select: "name employeeId" },
    ]);

    // ── Real-time delivery via the server's shared io instance ───────────
    const io = getIO(req);
    if (io) {
      io.to(`user_${receiverId.toString()}`).emit("receive_message", newMessage);
      io.to(`user_${senderId.toString()}`).emit("message_sent", newMessage);
    } else {
      console.warn("⚠️ io not found on app — real-time delivery skipped");
    }

    return res.status(201).json(newMessage);
  } catch (err) {
    console.error("❌ Send message error:", err.message);
    console.error("   Validation errors:", err.errors);
    return res.status(500).json({ error: err.message, details: err.errors });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/history/:userId — Conversation history
// ─────────────────────────────────────────────────────────────────────────────
router.get("/history/:userId", protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const me = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ error: "Invalid userId" });

    const messages = await Message.find({
      isDeleted: false,
      $or: [
        { sender: me, receiver: userId },
        { sender: userId, receiver: me },
      ],
    })
      .populate("sender",   "name employeeId")
      .populate("receiver", "name employeeId")
      .sort({ createdAt: 1 });

    // Mark received messages as read — fire and forget
    Message.updateMany(
      { sender: userId, receiver: me, isRead: false },
      { isRead: true }
    ).catch(console.error);

    // Notify the other side their messages were read
    const io = getIO(req);
    if (io) {
      io.to(`user_${userId}`).emit("messages_read", {
        readBy:   me.toString(),
        senderId: userId,
      });
    }

    return res.json(messages);
  } catch (err) {
    console.error("Get history error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/users — Chat list with last message + unread counts
// ─────────────────────────────────────────────────────────────────────────────
router.get("/users", protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Message.aggregate([
      {
        $match: {
          isDeleted: false,
          $or: [{ sender: userId }, { receiver: userId }],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { $cond: [{ $eq: ["$sender", userId] }, "$receiver", "$sender"] },
          lastMessage:     { $first: "$message" },
          lastMessageTime: { $first: "$createdAt" },
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

    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const emp = await Employee.findById(conv._id).select("name employeeId department");
        if (!emp) return null;
        return {
          _id:             conv._id,
          name:            emp.name,
          employeeId:      emp.employeeId,
          department:      emp.department,
          lastMessage:     conv.lastMessage,
          lastMessageTime: conv.lastMessageTime,
          unreadCount:     conv.unreadCount,
        };
      })
    );

    return res.json(enriched.filter(Boolean));
  } catch (err) {
    console.error("Get users error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/chat/read/:senderId — Mark messages from sender as read
// ─────────────────────────────────────────────────────────────────────────────
router.put("/read/:senderId", protect, async (req, res) => {
  try {
    const { senderId } = req.params;
    const me = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(senderId))
      return res.status(400).json({ error: "Invalid senderId" });

    await Message.updateMany(
      { sender: senderId, receiver: me, isRead: false },
      { isRead: true }
    );

    const io = getIO(req);
    if (io) {
      io.to(`user_${senderId}`).emit("messages_read", {
        readBy:   me.toString(),
        senderId,
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Mark read error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/chat/:msgId — Edit a message
// NOTE: must stay BELOW /read/:senderId to avoid route collision
// ─────────────────────────────────────────────────────────────────────────────
router.put("/:msgId", protect, async (req, res) => {
  try {
    const { msgId } = req.params;
    const { message } = req.body;
    const me = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(msgId))
      return res.status(400).json({ error: "Invalid message id" });

    if (!message?.trim())
      return res.status(400).json({ error: "Message cannot be empty" });

    const msg = await Message.findById(msgId);
    if (!msg) return res.status(404).json({ error: "Message not found" });

    if (msg.sender.toString() !== me.toString())
      return res.status(403).json({ error: "Cannot edit someone else's message" });

    msg.message  = message.trim();
    msg.isEdited = true;
    await msg.save();

    await msg.populate([
      { path: "sender",   select: "name employeeId" },
      { path: "receiver", select: "name employeeId" },
    ]);

    const io = getIO(req);
    if (io) {
      const receiverId = msg.receiver?._id?.toString() || msg.receiver.toString();
      const payload    = { messageId: msgId, newMessage: message.trim() };
      io.to(`user_${receiverId}`).emit("message_edited", payload);
      io.to(`user_${me.toString()}`).emit("message_edited", payload);
    }

    return res.json(msg);
  } catch (err) {
    console.error("Edit message error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/chat/:msgId — Soft-delete a message
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:msgId", protect, async (req, res) => {
  try {
    const { msgId } = req.params;
    const me = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(msgId))
      return res.status(400).json({ error: "Invalid message id" });

    const msg = await Message.findById(msgId);
    if (!msg) return res.status(404).json({ error: "Message not found" });

    if (msg.sender.toString() !== me.toString())
      return res.status(403).json({ error: "Cannot delete someone else's message" });

    msg.isDeleted = true;
    msg.message   = "This message was deleted";
    await msg.save();

    const io = getIO(req);
    if (io) {
      const receiverId = msg.receiver?.toString();
      const payload    = { messageId: msgId };
      io.to(`user_${receiverId}`).emit("message_deleted", payload);
      io.to(`user_${me.toString()}`).emit("message_deleted", payload);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Delete message error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/unread/count
// ─────────────────────────────────────────────────────────────────────────────
router.get("/unread/count", protect, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiver:  req.user._id,
      isRead:    false,
      isDeleted: false,
    });
    return res.json({ count });
  } catch (err) {
    console.error("Unread count error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;