import mongoose from "mongoose";
import dotenv from "dotenv";
import Admin from "../models/adminModel.js";
import PlanSetting from "../models/planSettingModel.js";

dotenv.config();

const migrate = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI not found in env variables.");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected successfully.");

    // Fetch all admins (lean query to retrieve fields not in new schema)
    const admins = await Admin.find({}).lean();
    console.log(`Found ${admins.length} admins to check.`);

    let migratedCount = 0;
    let skippedCount = 0;

    // Fetch all master plans first to build a mapping
    const plans = await PlanSetting.find({});
    const planMap = {};
    plans.forEach((p) => {
      planMap[p.planName] = p;
    });

    for (const admin of admins) {
      // If planDetails is already populated, we skip
      if (admin.planDetails && admin.planDetails.planName) {
        console.log(`[SKIPPED] Admin: ${admin.email} already has planDetails.`);
        skippedCount++;
        continue;
      }

      // Read legacy fields
      const legacyPlan = admin.plan || "Free";
      const legacyUserLimit = admin.userLimit !== undefined ? admin.userLimit : 30;
      const legacyIsPaid = admin.isPaid || false;
      const legacyPlanActivatedAt = admin.planActivatedAt || null;
      const legacyPlanExpiresAt = admin.planExpiresAt || null;
      const legacyRazorpayOrderId = admin.razorpayOrderId || null;
      const legacyRazorpayPaymentId = admin.razorpayPaymentId || null;
      const legacyLastPaymentAmount = admin.lastPaymentAmount || 0;

      // Resolve source master plan setting
      let sourcePlan = planMap[legacyPlan];
      if (!sourcePlan) {
        // If not found in map, attempt direct lookup
        sourcePlan = await PlanSetting.findOne({ planName: legacyPlan });
      }

      const planDetails = {
        planName: legacyPlan,
        price: sourcePlan ? sourcePlan.price : 0,
        billingCycle: sourcePlan ? sourcePlan.billingCycle : "free",
        durationDays: sourcePlan ? sourcePlan.durationDays : 30,
        maxUsers: legacyUserLimit,
        features: sourcePlan ? [...sourcePlan.features] : [],
        isUnlimited: sourcePlan ? sourcePlan.isUnlimited : (legacyPlan.toLowerCase() === "owner"),
        isPaid: legacyIsPaid,
        activatedAt: legacyPlanActivatedAt,
        expiresAt: legacyPlanExpiresAt,
        razorpayOrderId: legacyRazorpayOrderId,
        razorpayPaymentId: legacyRazorpayPaymentId,
        lastPaymentAmount: legacyLastPaymentAmount,
        lastPaymentAt: legacyIsPaid ? legacyPlanActivatedAt : null,
        sourcePlanId: sourcePlan ? sourcePlan._id : null,
      };

      console.log(`[MIGRATING] Admin: ${admin.email} on legacy plan: ${legacyPlan}`);

      // Perform atomic update and unset old legacy fields from MongoDB document
      await Admin.updateOne(
        { _id: admin._id },
        {
          $set: { planDetails },
          $unset: {
            plan: "",
            userLimit: "",
            isPaid: "",
            planActivatedAt: "",
            planExpiresAt: "",
            razorpayOrderId: "",
            razorpayPaymentId: "",
            lastPaymentAmount: "",
          },
        }
      );

      migratedCount++;
    }

    console.log("\nMigration completed successfully!");
    console.log(`Total checked: ${admins.length}`);
    console.log(`Migrated:      ${migratedCount}`);
    console.log(`Skipped:       ${skippedCount}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

migrate();
