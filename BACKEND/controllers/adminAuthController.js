import Admin from "../models/adminModel.js";
import PlanSetting from "../models/planSettingModel.js";
import Employee from "../models/employeeModel.js";
import Feature from "../models/featureModel.js";
import jwt from "jsonwebtoken";

/* ==================== JWT SIGN ==================== */
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

  // ✅ Owner / unlimited plan — set expiry far in the future (100 years)
  if (setting && setting.isUnlimited) {
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 100);
    return farFuture;
  }

  const days = setting ? setting.durationDays : 30;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  return expiryDate;
};

/* ==================== REGISTER ADMIN ==================== */
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

    const planInfo = await PlanSetting.findOne({ planName: plan });

    if (!planInfo && plan !== "Free") {
       return res.status(400).json({ message: "The selected plan is invalid or no longer exists." });
    }

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
      loginEnabled: true,
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

/* ==================== LOGIN ADMIN WITH EXPIRY & LOGIN ACCESS CHECK ==================== */
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email }).select("+password");

    if (!admin || !(await admin.correctPassword(password, admin.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    /* === LOGIN ACCESS BLOCKER === */
    if (admin.loginEnabled === false) {
      return res.status(403).json({
        message: "Your account login is stopped from admin. Please contact support team.",
        loginStopped: true,
        adminDetails: {
          name: admin.name,
          email: admin.email,
        },
      });
    }

    /* === ✅ SKIP EXPIRY CHECK FOR OWNER / UNLIMITED PLAN === */
    const planInfo = await PlanSetting.findOne({ planName: admin.plan });
    const isUnlimitedPlan = planInfo && (planInfo.isUnlimited || planInfo.isOwnerPlan);

    if (!isUnlimitedPlan) {
      /* === PLAN EXPIRY BLOCKER (only for non-owner plans) === */
      const now = new Date();
      const expiryDate = new Date(admin.planExpiresAt);

      if (admin.planExpiresAt && now > expiryDate) {
        const expiredDaysAgo = Math.floor((now - expiryDate) / (1000 * 60 * 60 * 24));

        return res.status(403).json({
          message: "Your plan is expired. Please contact support team",
          expired: true,
          adminDetails: {
            name: admin.name,
            email: admin.email,
            plan: admin.plan,
            planActivatedAt: admin.planActivatedAt,
            planExpiresAt: admin.planExpiresAt,
            expiredDaysAgo: expiredDaysAgo,
          },
        });
      }
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
        isOwner: isUnlimitedPlan || false, // ✅ frontend can use this flag
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
    const { planName, durationDays, price, features } = req.body;

    // ✅ Protect owner plan from being modified via API
    const existing = await PlanSetting.findOne({ planName });
    if (existing && existing.isOwnerPlan) {
      return res.status(403).json({ message: "The Owner plan is protected and cannot be modified." });
    }

    const setting = await PlanSetting.findOneAndUpdate(
      { planName },
      {
        durationDays: Number(durationDays),
        price: Number(price),
        features: features,
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      message: `Plan ${planName} updated successfully`,
      setting,
    });
  } catch (error) {
    console.error("❌ UPDATE SETTINGS ERROR:", error);
    res.status(500).json({ message: "Update failed" });
  }
};

/* ==================== GET ALL PLANS ==================== */
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

    // ✅ Protect owner plan from deletion
    const plan = await PlanSetting.findById(id);
    if (plan && plan.isOwnerPlan) {
      return res.status(403).json({ message: "The Owner plan is protected and cannot be deleted." });
    }

    await PlanSetting.findByIdAndDelete(id);
    res.status(200).json({ message: "Plan deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete plan" });
  }
};

/* ==================== TOGGLE ADMIN LOGIN ACCESS ==================== */
export const toggleAdminLogin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { loginEnabled } = req.body;

    if (typeof loginEnabled !== "boolean") {
      return res.status(400).json({ message: "loginEnabled must be a boolean" });
    }

    const admin = await Admin.findByIdAndUpdate(
      adminId,
      { loginEnabled },
      { new: true }
    );

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json({
      message: `Admin login ${loginEnabled ? "enabled" : "disabled"} successfully`,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        loginEnabled: admin.loginEnabled,
      },
    });
  } catch (error) {
    console.error("❌ TOGGLE ADMIN LOGIN ERROR:", error);
    res.status(500).json({ message: "Failed to update admin login access" });
  }
};

/* ==================== TOGGLE ALL EMPLOYEES LOGIN UNDER AN ADMIN ==================== */
export const toggleEmployeeLoginByAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { loginEnabled } = req.body;

    if (typeof loginEnabled !== "boolean") {
      return res.status(400).json({ message: "loginEnabled must be a boolean" });
    }

    const result = await Employee.updateMany(
      { adminId },
      { loginEnabled }
    );

    res.status(200).json({
      message: `All employees login ${loginEnabled ? "enabled" : "disabled"} successfully`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("❌ TOGGLE EMPLOYEE LOGIN ERROR:", error);
    res.status(500).json({ message: "Failed to update employees login access" });
  }
};

/* ==================== GET LOGIN ACCESS STATUS FOR ALL ADMINS ==================== */
export const getLoginAccessStatus = async (req, res) => {
  try {
    const admins = await Admin.find({})
      .select("name email plan loginEnabled planExpiresAt createdAt")
      .sort({ createdAt: -1 });

    const adminData = await Promise.all(
      admins.map(async (admin) => {
        const totalEmployees = await Employee.countDocuments({ adminId: admin._id });
        const disabledEmployees = await Employee.countDocuments({
          adminId: admin._id,
          loginEnabled: false,
        });

        return {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          plan: admin.plan,
          loginEnabled: admin.loginEnabled !== false,
          planExpiresAt: admin.planExpiresAt,
          createdAt: admin.createdAt,
          totalEmployees,
          disabledEmployees,
        };
      })
    );

    res.status(200).json(adminData);
  } catch (error) {
    console.error("❌ GET LOGIN STATUS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch login access status" });
  }
};

/* ==================== GET ADMIN PROFILE ==================== */
export const getAdminProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const admin = await Admin.findById(req.user._id);

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json(admin);
  } catch (error) {
    console.error("Profile Fetch Error:", error);
    res.status(500).json({ message: "Server error fetching profile" });
  }
};

/* ==================== UPDATE ADMIN PROFILE ==================== */
export const updateAdminProfile = async (req, res) => {
  try {
    const { name, phone, department } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: "Name and Phone are required" });
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(
      req.user._id,
      { name, phone, department },
      { new: true, runValidators: true }
    );

    if (!updatedAdmin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      admin: updatedAdmin,
    });
  } catch (error) {
    console.error("❌ UPDATE PROFILE ERROR:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
};

/* ==================== GET ALL AVAILABLE FEATURES (for MasterSettings) ==================== */
export const getAllFeatures = async (req, res) => {
  try {
    const features = await Feature.find({}).sort({ label: 1 });
    res.status(200).json(features);
  } catch (error) {
    console.error("❌ FETCH FEATURES ERROR:", error);
    res.status(500).json({ message: "Failed to fetch features" });
  }
};

/* ==================== GET CURRENT ADMIN'S PLAN FEATURES (for Sidebar) ==================== */
export const getMyPlanFeatures = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const admin = await Admin.findById(req.user._id).select("plan");
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const plan = await PlanSetting.findOne({ planName: admin.plan });

    // ✅ Owner / unlimited plan → return ALL features from all plans (no restriction)
    if (plan && (plan.isOwnerPlan || plan.isUnlimited)) {
      // Gather every unique route from all plans + owner-exclusive routes
      const allPlans = await PlanSetting.find({});
      const allRoutes = new Set();
      allPlans.forEach((p) => p.features.forEach((route) => allRoutes.add(route)));

      // Also include owner-exclusive routes that may not be in any regular plan
      const ownerExclusiveRoutes = [
        "/master/dashboard",
        "/master/admins",
        "/master/plans",
        "/master/login-access",
        "/master/settings",
        "/master/billing",
        "/master/analytics",
      ];
      ownerExclusiveRoutes.forEach((r) => allRoutes.add(r));

      return res.status(200).json({
        planName: admin.plan,
        isOwnerPlan: true,
        allowedRoutes: Array.from(allRoutes),
      });
    }

    if (!plan || !plan.features || plan.features.length === 0) {
      return res.status(200).json({ planName: admin.plan, allowedRoutes: [] });
    }

    res.status(200).json({
      planName: plan.planName,
      allowedRoutes: plan.features,
    });
  } catch (error) {
    console.error("❌ GET MY PLAN FEATURES ERROR:", error);
    res.status(500).json({ message: "Failed to fetch plan features" });
  }
};