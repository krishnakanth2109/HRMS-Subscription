// ============================================================
//  seedOwnerPlan.js
//  Run once:  node seedOwnerPlan.js
//  Purpose:   Insert the protected "Owner" plan into DB with
//             all regular features + owner-exclusive features.
// ============================================================

import mongoose from "mongoose";
import dotenv from "dotenv";
import PlanSetting from "./models/planSettingModel.js"; // adjust path if needed

dotenv.config();

// ─── All regular features (same list as FALLBACK_FEATURES in MasterSettings.jsx) ───
const REGULAR_FEATURES = [
  "/admin/dashboard",
  "/employees",
  "/attendance",
  "/admin/settings",
  "/admin/shifttype",
  "/admin/leave-summary",
  "/admin/holiday-calendar",
  "/admin/payroll",
  "/admin/notices",
  "/admin/admin-Leavemanage",
  "/admin/late-requests",
  "/admin/admin-overtime",
  "/admin/live-tracking",
];

// ─── Owner-exclusive features (not available in any paid plan) ────────────────
const OWNER_EXCLUSIVE_FEATURES = [
  "/master/dashboard",    // Master overview dashboard
  "/master/admins",       // Manage all registered admins/companies
  "/master/plans",        // Create / edit / delete plans
  "/master/login-access", // Toggle admin & employee login access
  "/master/settings",     // Global system settings
  "/master/billing",      // Billing & subscription overview
  "/master/analytics",    // Platform-wide analytics & usage stats
];

const ALL_OWNER_FEATURES = [...REGULAR_FEATURES, ...OWNER_EXCLUSIVE_FEATURES];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Upsert so running the script again is safe
    const result = await PlanSetting.findOneAndUpdate(
      { planName: "Owner" },
      {
        planName: "Owner",
        durationDays: 36500,   // 100 years — effectively unlimited
        price: 0,
        features: ALL_OWNER_FEATURES,
        isUnlimited: true,     // ✅ skip expiry check in loginAdmin
        isOwnerPlan: true,     // ✅ protect from UI edit/delete
      },
      { upsert: true, new: true }
    );

    console.log("🎉 Owner plan seeded successfully:");
    console.log(`   Plan ID   : ${result._id}`);
    console.log(`   Features  : ${result.features.length} total`);
    console.log(`   isUnlimited: ${result.isUnlimited}`);
    console.log(`   isOwnerPlan: ${result.isOwnerPlan}`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
};

seed();