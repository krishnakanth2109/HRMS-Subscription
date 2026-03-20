// models/Message.js
import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    // ✅ FIX: adminId and companyId are both optional — employees may not
    //         have adminId populated on req.user, crashing every Message.create()
    adminId:   { type: mongoose.Schema.Types.ObjectId, ref: "Admin",   default: null },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    isRead:    { type: Boolean, default: false },
    isEdited:  { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MessageSchema.index({ sender: 1, receiver: 1, createdAt: 1 });
MessageSchema.index({ receiver: 1, isRead: 1 });

export default mongoose.model("Message", MessageSchema);