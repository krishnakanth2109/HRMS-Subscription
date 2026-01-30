// --- START OF FILE seedMaster.js ---
import mongoose from "mongoose";
import dotenv from "dotenv";
import MasterAdmin from "./models/MasterAdmin.js";

dotenv.config();

const seedMaster = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ DB Connected for Seeding");

    const email = "sanjaykumar@gmail.com";
    const password = "Master@2026";

    // Check if master already exists
    const existingMaster = await MasterAdmin.findOne({ email });
    if (existingMaster) {
      console.log("⚠️ Master Admin already exists. Deleting old one...");
      await MasterAdmin.deleteOne({ email });
    }

    // Create new master
    const newMaster = new MasterAdmin({
      email,
      password,
    });

    await newMaster.save();
    console.log("🎉 Master Admin Created Successfully!");
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);

    process.exit();
  } catch (error) {
    console.error("❌ Error seeding master:", error);
    process.exit(1);
  }
};

seedMaster();
// --- END OF FILE seedMaster.js ---