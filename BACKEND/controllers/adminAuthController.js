import Admin from "../models/adminModel.js";
import PlanSetting from "../models/planSettingModel.js";
import jwt from "jsonwebtoken";

/* ==================== JWT SIGN (FIXED) ==================== */
const signToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

/* ==================== HELPER: CALCULATE EXPIRY ==================== */
const getExpiryDate = async (planName) => {
  const setting = await PlanSetting.findOne({ planName });
  const days = setting ? setting.durationDays : 30; 
  
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  return expiryDate;
};

/* ==================== REGISTER ADMIN (RE-UPDATED) ==================== */
export const registerAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, role, department, plan } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin with this email already exists" });
    }

    // 1. Look up the plan in our dynamic PlanSetting collection
    const planInfo = await PlanSetting.findOne({ planName: plan });
    
    // 2. If the plan doesn't exist in DB, and it's not the default "Free", throw error
    if (!planInfo && plan !== "Free") {
       return res.status(400).json({ message: "The selected plan is invalid or no longer exists." });
    }

    // 3. Determine if paid and get expiry
    const isPaid = planInfo ? planInfo.price > 0 : false;
    const planExpiresAt = await getExpiryDate(plan || "Free");

    const admin = await Admin.create({
      name,
      email,
      password, 
      phone: phone || "",
      role: role || "admin",
      department: department || "Administration",
      plan: plan || "Free",
      isPaid: isPaid, 
      planActivatedAt: new Date(),
      planExpiresAt: planExpiresAt, 
    });

    const token = signToken(admin._id, admin.role);

    res.status(201).json({
      message: "Admin registered successfully",
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        plan: admin.plan,
        expiresAt: admin.planExpiresAt,
      },
    });
  } catch (error) {
    console.error("❌ REGISTER ADMIN ERROR:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* ==================== LOGIN ADMIN WITH EXPIRY CHECK ==================== */
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email }).select("+password");
    
    if (!admin || !(await admin.correctPassword(password, admin.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    /* === PLAN EXPIRY BLOCKER === */
    const now = new Date();
    const expiryDate = new Date(admin.planExpiresAt);

    if (admin.planExpiresAt && now > expiryDate) {
      return res.status(403).json({ 
        message: "Your plan is expired. Please contact support team" 
      });
    }

    const token = signToken(admin._id, admin.role);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: admin._id,
        name: admin.name,
        role: admin.role,
        plan: admin.plan,
      },
    });
  } catch (error) {
    console.error("❌ LOGIN ERROR:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* ==================== UPDATE DYNAMIC PLAN DAYS & PRICE ==================== */
export const updatePlanSettings = async (req, res) => {
  try {
    // 👈 Added features to the destructuring
    const { planName, durationDays, price, features } = req.body; 

    const setting = await PlanSetting.findOneAndUpdate(
      { planName },
      { 
        durationDays: Number(durationDays),
        price: Number(price),
        features: features 
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ 
      message: `Plan ${planName} updated successfully`, 
      setting 
    });
  } catch (error) {
    console.error("❌ UPDATE SETTINGS ERROR:", error);
    res.status(500).json({ message: "Update failed" });
  }
};

/* ==================== GET ALL PLANS (NEW - REQUIRED FOR LANDING PAGE) ==================== */
export const getAllPlanSettings = async (req, res) => {
  try {
    const plans = await PlanSetting.find({});
    res.status(200).json(plans);
  } catch (error) {
    console.error("❌ FETCH PLANS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch plans" });
  }
};

/* ==================== GET ALL ADMINS ==================== */
export const getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find({}).sort({ createdAt: -1 });
    res.status(200).json(admins);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch admins" });
  }
};

/* ==================== DELETE PLAN ==================== */
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    await PlanSetting.findByIdAndDelete(id);
    res.status(200).json({ message: "Plan deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete plan" });
  }
};