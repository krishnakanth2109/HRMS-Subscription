// --- START OF FILE models/Group.js ---
import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    // HIERARCHY
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    /* ==================== BASIC INFO ==================== */
    groupCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    }, 

    groupName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    /* ==================== RELATIONSHIPS ==================== */
    // Admin who created the group
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    // Group Leader (Single employee)
    groupLeader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    // Group Members
    members: [
      {
        employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
        },
        role: {
          type: String,
          enum: ["member", "senior", "intern"],
          default: "member",
        },
        joinedAt: { type: Date, default: Date.now },
      },
    ],

    /* ==================== SETTINGS ==================== */
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    permissions: {
      canApproveLeave: { type: Boolean, default: false },
      canAssignTasks: { type: Boolean, default: false },
      canViewReports: { type: Boolean, default: false },
    },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Group", groupSchema);
// --- END OF FILE models/Group.js ---