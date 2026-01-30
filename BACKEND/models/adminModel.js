// --- START OF FILE models/adminModel.js ---

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const adminSchema = new mongoose.Schema(
  {
    /* ==================== BASIC INFO ==================== */

    name: {
      type: String,
      required: [true, "Please provide a name"],
    },

    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      lowercase: true,
      match: [/.+\@.+\..+/, "Please fill a valid email address"],
    },

    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: 6,
      select: false,
    },

    role: {
      type: String,
      enum: ["admin", "manager"],
      default: "admin",
    },

    phone: {
      type: String,
      default: "",
    },

    department: {
      type: String,
      default: "Administration",
    },

    /* ==================== PLAN & BILLING ==================== */

    plan: {
      type: String,
      enum: ["Free", "Basic", "Premium", "Flex"],
      default: "Free",
    },

    isPaid: {
      type: Boolean,
      default: false,
    },

    planActivatedAt: {
      type: Date,
      default: null,
    },

    planExpiresAt: {
      type: Date,
      default: null,
    },

    /* ==================== STRIPE SUBSCRIPTION ==================== */

    stripeCustomerId: {
      type: String,
      default: null,
    },

    stripeSubscriptionId: {
      type: String,
      default: null,
    },

    subscriptionStatus: {
      type: String,
      enum: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "unpaid",
        "incomplete",
        "incomplete_expired",
      ],
      default: null,
    },

    currentPeriodStart: {
      type: Date,
      default: null,
    },

    currentPeriodEnd: {
      type: Date,
      default: null,
    },

    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },

    lastPaymentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt & updatedAt
  }
);

/* ==================== PASSWORD HASH ==================== */
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

/* ==================== PASSWORD CHECK ==================== */
adminSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;

// --- END OF FILE models/adminModel.js ---