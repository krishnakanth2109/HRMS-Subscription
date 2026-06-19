import mongoose from "mongoose";

const planSettingSchema = new mongoose.Schema({
  planName: { 
    type: String, 
    unique: true, 
    required: true 
  },
  durationDays: { type: Number, default: 30 },
  price: { type: Number, default: 0 },
  billingCycle: {
    type: String,
    enum: ["monthly", "quarterly", "halfYearly", "yearly", "custom", "free"],
    default: "monthly",
  },
  maxUsers: { type: Number, default: null }, // Null means unlimited
  features: [{ type: String }],

  // ✅ NEW: Owner/Unlimited plan flags
  isUnlimited: { type: Boolean, default: false }, // true = never expires
  isOwnerPlan: { type: Boolean, default: false },  // true = protected, cannot be deleted/edited from UI

  // ✅ Visibility toggle: false = hidden from frontend/pricing pages
  isActive: { type: Boolean, default: true },
});

const PlanSetting = mongoose.model("PlanSetting", planSettingSchema);
export default PlanSetting;
