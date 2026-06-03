// --- START OF FILE models/adminModel.js ---
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const adminSchema = new mongoose.Schema(
  {
    /* ==================== BASIC INFO ==================== */
    name: { type: String, required: [true, "Please provide a name"] },

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

    // 'admin' is the owner of Companies. 'manager' might be a sub-role under Admin.
    role: {
      type: String,
      // enum: ["admin", "manager"],
      default: "admin",
    },

    phone: { type: String, default: "" },
    department: { type: String, default: "Administration" },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },

    /* ==================== LOGIN ACCESS CONTROL ==================== */
    loginEnabled: { type: Boolean, default: true }, // Super-admin can toggle this

    /* ==================== PLAN & BILLING ==================== */
    plan: {
      type: String,
      default: "Free",
    },
    userLimit: { type: Number, default: 30 },
    isPaid: { type: Boolean, default: false },
    planActivatedAt: { type: Date, default: null },
    planExpiresAt: { type: Date, default: null },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    lastPaymentAmount: { type: Number, default: 0 },

    /* ==================== LIMIT ADD-ONS ==================== */
    // Each entry represents a separately purchased limit package with its own billing date
    limitAddons: [
      {
        addonLimit: { type: Number, required: true },       // Extra seats purchased (e.g. 10, 15)
        pricePaid: { type: Number, required: true },        // Amount paid per month for this addon
        planName: { type: String, required: true },         // Plan under which addon was purchased
        activatedAt: { type: Date, default: Date.now },    // When the addon was activated
        expiresAt: { type: Date, required: true },          // 1 month from activatedAt (separate billing date)
        razorpayOrderId: { type: String, default: null },
        razorpayPaymentId: { type: String, default: null },
        isPaid: { type: Boolean, default: false },
        mergedIntoMainPlan: { type: Boolean, default: false },
        mergedAt: { type: Date, default: null },
      }
    ],

    /* ==================== STRIPE SUBSCRIPTION ==================== */
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    subscriptionStatus: {
      type: String,
      enum: ["active", "trialing", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired"],
      default: null,
    },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    lastPaymentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/* ==================== PASSWORD HASH ==================== */
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

/* ==================== PASSWORD CHECK ==================== */
adminSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const Admin = mongoose.model("Admin", adminSchema);
export default Admin;
// --- END OF FILE models/adminModel.js ---
