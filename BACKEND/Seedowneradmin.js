// ============================================================
//  seedOwnerAdmin.js
//  Run once:  node seedOwnerAdmin.js
//  Purpose:   Create the master owner admin account and assign
//             the protected "Owner" plan with unlimited access.
// ============================================================

import mongoose from "mongoose";
import dotenv from "dotenv";
import Admin from "./models/adminModel.js";         // adjust path if needed
import PlanSetting from "./models/planSettingModel.js"; // adjust path if needed

dotenv.config();

const OWNER_EMAIL    = "ops@arahinfotech.net";
const OWNER_PASSWORD = "Admin@2026";
const OWNER_PLAN     = "Owner";

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    /* ── Step 1: Make sure the Owner plan exists in DB ── */
    let ownerPlan = await PlanSetting.findOne({ planName: OWNER_PLAN });

    if (!ownerPlan) {
      console.log("⚠️  Owner plan not found — creating it now...");

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

      const OWNER_EXCLUSIVE_FEATURES = [
        "/master/dashboard",
        "/master/admins",
        "/master/plans",
        "/master/login-access",
        "/master/settings",
        "/master/billing",
        "/master/analytics",
      ];

      ownerPlan = await PlanSetting.create({
        planName: OWNER_PLAN,
        durationDays: 36500,
        price: 0,
        features: [...REGULAR_FEATURES, ...OWNER_EXCLUSIVE_FEATURES],
        isUnlimited: true,
        isOwnerPlan: true,
      });

      console.log("✅ Owner plan created.");
    } else {
      console.log("✅ Owner plan already exists — skipping plan creation.");
    }

    /* ── Step 2: Check if owner admin already exists ── */
    const existing = await Admin.findOne({ email: OWNER_EMAIL });

    if (existing) {
      console.log(`⚠️  Admin with email "${OWNER_EMAIL}" already exists.`);
      console.log("   Updating plan to Owner and refreshing expiry...");

      // Push the plan far into the future (100 years)
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 100);

      existing.plan            = OWNER_PLAN;
      existing.isPaid          = false;
      existing.planActivatedAt = new Date();
      existing.planExpiresAt   = farFuture;
      existing.loginEnabled    = true;

      await existing.save();

      console.log("✅ Existing admin updated to Owner plan.");
      console.log(`   ID         : ${existing._id}`);
      console.log(`   Email      : ${existing.email}`);
      console.log(`   Plan       : ${existing.plan}`);
      console.log(`   Expires At : ${existing.planExpiresAt}`);

      await mongoose.disconnect();
      process.exit(0);
    }

    /* ── Step 3: Create the owner admin ── */
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 100);

    // Note: the pre-save hook in adminModel.js will auto-hash the password
    const ownerAdmin = await Admin.create({
      name:            "Arah Infotech Owner",
      email:           OWNER_EMAIL,
      password:        OWNER_PASSWORD,       // hashed automatically by pre-save hook
      phone:           "",
      role:            "admin",
      department:      "Administration",
      plan:            OWNER_PLAN,
      isPaid:          false,                // free for owner
      planActivatedAt: new Date(),
      planExpiresAt:   farFuture,            // 100 years from now
      loginEnabled:    true,
    });

    console.log("\n🎉 Owner admin seeded successfully!");
    console.log("─────────────────────────────────────");
    console.log(`   ID         : ${ownerAdmin._id}`);
    console.log(`   Name       : ${ownerAdmin.name}`);
    console.log(`   Email      : ${ownerAdmin.email}`);
    console.log(`   Role       : ${ownerAdmin.role}`);
    console.log(`   Plan       : ${ownerAdmin.plan}`);
    console.log(`   Expires At : ${ownerAdmin.planExpiresAt}`);
    console.log(`   Features   : ${ownerPlan.features.length} total (all features + owner-exclusive)`);
    console.log("─────────────────────────────────────\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seed();