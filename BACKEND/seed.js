// --- START OF FILE seed.js ---

import mongoose from "mongoose";
import dotenv from "dotenv";
import Admin from "./models/adminModel.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const seedAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Database connected for seeding.");

    // Check if the admin already exists
    const existingAdmin = await Admin.findOne({ email: "ajay.arahinfotech@gmail.com" });
    if (existingAdmin) {
      console.log("Admin user already exists. No action taken.");
      process.exit();
    }

    // Create the new admin
    await Admin.create({
      name: "Ajay Arah",
      email: "ajay.arahinfotech@gmail.com",
      password: "Arah@142", // The model will hash this automatically
      phone: "1234567890", // Add a placeholder phone
    });

    console.log("✅ Admin user created successfully!");
    process.exit();
  } catch (error) {
    console.error("❌ Error seeding admin:", error);
    process.exit(1);
  }
};

seedAdmin();