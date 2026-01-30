// --- START OF FILE models/notificationModel.js ---
import mongoose from "mongoose";

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    // HIERARCHY LINKS
    adminId: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },

    // 🔥 User receiving this notification
    userId: {
      type: Schema.Types.ObjectId,
      refPath: "userType",
      required: false,      
    },

    // 🔥 Required for refPath to work properly
    userType: {
      type: String,
      enum: ["Employee", "Admin"],
      required: false,
    },

    // 🔥 Broadcast notifications
    role: {
      type: String,
      enum: ["admin", "employee", "all"],
      default: null,
    },

    title: { type: String, default: "" },
    message: { type: String, required: true },

    type: {
      type: String,
      enum: [
        "leave",
        "attendance",
        "general",
        "notice",
        "leave-status",
        "overtime",
        "overtime-status",
        "system",
      ],
      default: "general",
    },

    isRead: { type: Boolean, default: false },

    date: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;