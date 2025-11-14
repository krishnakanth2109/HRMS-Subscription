import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // User receiving the notification
  title: { type: String, required: true },
  message: { type: String, required: true },

  type: { 
    type: String, 
    enum: ["leave", "attendance", "general", "notice", "leave-status", "overtime"], 
    default: "general" 
  },

  isRead: { type: Boolean, default: false },
  date: { type: Date, default: Date.now }
});

export default mongoose.model("Notification", notificationSchema);
