// featureSeed.js
// Run with: node featureSeed.js
// This seeds all available sidebar navigation features into the DB.
// Each feature has a label (display name), route (path used in navLinks),
// iconKey (for reference), and description.

import mongoose from "mongoose";
import dotenv from "dotenv";
import Feature from "./models/featureModel.js";

dotenv.config();

const ALL_FEATURES = [
  {
    label: "Dashboard",
    route: "/admin/dashboard",
    iconKey: "FaTachometerAlt",
    description: "Main dashboard overview with key metrics",
  },
  {
    label: "Employee Management",
    route: "/employees",
    iconKey: "FaUserTie",
    description: "Add, edit and manage all employee records",
  },
  {
    label: "Employees Attendance",
    route: "/attendance",
    iconKey: "FaUserClock",
    description: "View and manage employee attendance logs",
  },
  {
    label: "Shift Management",
    route: "/admin/settings",
    iconKey: "FaUserPlus",
    description: "Configure and assign employee work shifts",
  },
  {
    label: "Location Settings",
    route: "/admin/shifttype",
    iconKey: "FaMapMarkedAlt",
    description: "Manage geo-fencing and location-based settings",
  },
  {
    label: "Leave Summary",
    route: "/admin/leave-summary",
    iconKey: "FaChartLine",
    description: "Analytics and summary of all employee leaves",
  },
  {
    label: "Holiday Calendar",
    route: "/admin/holiday-calendar",
    iconKey: "FaCalendarAlt",
    description: "Manage public and company holidays",
  },
  {
    label: "Payroll",
    route: "/admin/payroll",
    iconKey: "FaMoneyBillWave",
    description: "Process and manage employee payroll",
  },
  {
    label: "Announcements",
    route: "/admin/notices",
    iconKey: "FaBullhorn",
    description: "Post and manage company-wide announcements",
  },
  {
    label: "Leave Requests",
    route: "/admin/admin-Leavemanage",
    iconKey: "FaCheckDouble",
    description: "Review and approve/reject employee leave requests",
  },
  {
    label: "Attendance Adjustment",
    route: "/admin/late-requests",
    iconKey: "FaUserCheck",
    description: "Handle late login and attendance correction requests",
  },
  {
    label: "Overtime Requests",
    route: "/admin/admin-overtime",
    iconKey: "FaBusinessTime",
    description: "Review and manage employee overtime requests",
  },
  {
    label: "Idle Tracking",
    route: "/admin/live-tracking",
    iconKey: "FaMapMarkerAlt",
    description: "Monitor employee idle time in real-time",
  }
];

const seedFeatures = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing features and re-seed
    await Feature.deleteMany({});
    console.log("🗑️  Cleared existing features");

    await Feature.insertMany(ALL_FEATURES);
    console.log(`✅ Successfully seeded ${ALL_FEATURES.length} features:`);
    ALL_FEATURES.forEach((f) => console.log(`   → [${f.route}] ${f.label}`));

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error);
    process.exit(1);
  }
};

seedFeatures();