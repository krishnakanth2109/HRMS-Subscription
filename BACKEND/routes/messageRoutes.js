// routes/messageRoutes.js
import express from "express";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import Message from "../models/Message.js";
import Employee from "../models/employeeModel.js";
import { protect } from "../controllers/authController.js";

const router = express.Router();

// io lives in server.js and is shared via app.set("io", io)
// All routes access it through req.app.get("io") — no initSocket needed here
const getIO = (req) => req.app.get("io");

/* ===============================================================
   SMTP TRANSPORTER
=============================================================== */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/* ===============================================================
   UNREAD MESSAGE NOTIFICATION — 5-minute delay
   Called right after a message is saved.
   After 5 min, checks DB — if still unread, fires email to receiver.
=============================================================== */
const UNREAD_NOTIFY_DELAY_MS = 30 * 60 * 1000; // 30 minutes

const scheduleUnreadEmail = ({ messageId, senderName, receiverName, receiverEmail, messagePreview }) => {
  if (!receiverEmail) return; // no email on record — skip silently

  setTimeout(async () => {
    try {
      // Re-check: is this specific message still unread?
      const msg = await Message.findById(messageId).lean();
      if (!msg || msg.isRead || msg.isDeleted) return; // already read or deleted — skip

      await transporter.sendMail({
        from:    `"HRMS Messenger" <${process.env.SMTP_USER}>`,
        to:      receiverEmail,
        subject: `${senderName} wants to connect with you on HRMS`,
        html:    unreadMessageEmail({ senderName, receiverName, messagePreview }),
      });
      console.log(`✅ Unread message notification sent to: ${receiverEmail}`);
    } catch (err) {
      console.error("❌ Failed to send unread message notification:", err.message);
    }
  }, UNREAD_NOTIFY_DELAY_MS);
};

/* ===============================================================
   EMAIL TEMPLATE — Unread message notification to receiver
=============================================================== */
const unreadMessageEmail = ({ senderName, receiverName, messagePreview }) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#eef2f7;
             font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
         style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;
                    box-shadow:0 8px 24px rgba(0,0,0,0.09);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a8a,#3b82f6,#06b6d4);
                     padding:40px 32px;text-align:center;">
            <div style="width:60px;height:60px;background:rgba(255,255,255,0.18);
                        border-radius:50%;margin:0 auto 14px;line-height:60px;
                        font-size:28px;">
              &#128172;
            </div>
            <p style="margin:0 0 8px;font-size:12px;color:#bfdbfe;
                      letter-spacing:3px;text-transform:uppercase;font-weight:700;">
              HRMS Messenger
            </p>
            <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:800;line-height:1.3;">
              You have an unread message
            </h1>
            <p style="margin:10px 0 0;color:#bae6fd;font-size:14px;line-height:1.6;">
              <strong style="color:#ffffff;">${senderName}</strong>
              sent you a message on HRMS
            </p>
          </td>
        </tr>

        <!-- Banner -->
        <tr>
          <td style="background:#eff6ff;border-bottom:3px solid #3b82f6;
                     padding:13px 32px;text-align:center;">
            <p style="margin:0;font-size:13px;color:#1d4ed8;font-weight:600;">
              ${senderName} is been waiting for your reply — log in to reply
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 6px;font-size:16px;color:#1f2937;">
              Hi <strong>${receiverName}</strong>,
            </p>
            <p style="margin:0 0 26px;font-size:15px;color:#4b5563;line-height:1.8;">
              Your colleague <strong>${senderName}</strong> was trying to reach you
              on the HRMS internal messenger and it has been unread for a while.
              Don't leave them waiting — log in to catch up!
            </p>

            <!-- Sender + Receiver Info -->
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:18px 20px;
                          border:1px solid #e5e7eb;margin-bottom:26px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#6b7280;width:38%;">From</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#111827;">
                      ${senderName}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">To</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#111827;">
                      ${receiverName}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Platform</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#3b82f6;">
                      HRMS Internal Messenger
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Status</td>
                    <td style="padding:9px 0;text-align:right;">
                      <span style="background:#fee2e2;color:#991b1b;padding:3px 14px;
                                   border-radius:20px;font-size:13px;font-weight:700;">
                        Unread
                      </span>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:linear-gradient(135deg,#eff6ff,#dbeafe);
                          border-radius:10px;padding:22px;border:1px solid #bfdbfe;
                          margin-bottom:22px;">
              <tr><td style="text-align:center;">
                <p style="margin:0 0 6px;font-size:15px;color:#1e3a8a;font-weight:700;">
                  Ready to reply?
                </p>
                <p style="margin:0;font-size:14px;color:#3b82f6;line-height:1.6;">
                  Log in to your HRMS portal and open the Messenger
                  to continue your conversation with ${senderName}.
                </p>
              </td></tr>
            </table>

            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.7;">
              You are receiving this notification because a message sent to you
              on HRMS was unread for more than 30 minutes.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:18px 32px;text-align:center;
                     font-size:12px;color:#9ca3af;line-height:1.7;">
            &copy; ${new Date().getFullYear()} Attendance Management System &nbsp;&bull;&nbsp;
            This is an automated message notification. Please do not reply directly.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

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

    // ── Schedule unread email: fires after 5 min if receiver hasn't read yet ──
    scheduleUnreadEmail({
      messageId:      newMessage._id,
      senderName:     req.user.name || newMessage.sender?.name || "A colleague",
      receiverName:   receiver.name || "there",
      receiverEmail:  receiver.email || "",
      messagePreview: message.trim().length > 120
        ? message.trim().slice(0, 120) + "..."
        : message.trim(),
    });

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