import mongoose from "mongoose";
import Admin from "../models/adminModel.js";
import SupportAdmin from "../models/supportAdminModel.js";
import PlanSetting from "../models/planSettingModel.js";
import Employee from "../models/employeeModel.js";
import Feature from "../models/featureModel.js";
import jwt from "jsonwebtoken";
import { getExpiredSubscriptionPayload } from "../utils/subscriptionAccess.js";

/* ==================== JWT SIGN ==================== */
const signToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

const getBillingCycleMultiplier = (billingCycle, planName) => {
  if (billingCycle === "monthly") return 1;
  if (billingCycle === "quarterly") return 3;
  if (billingCycle === "halfYearly") return 6;
  if (billingCycle === "yearly") return 12;

  const name = (planName || "").toLowerCase();
  if (name.includes("quarterly") || name.includes("quarter")) return 3;
  if (name.includes("half") || name.includes("semi")) return 6;
  if (name.includes("annual") || name.includes("yearly") || name.includes("year")) return 12;

  return 1;
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

  const expiryDate = new Date();
  if (setting && setting.durationDays) {
    expiryDate.setDate(expiryDate.getDate() + setting.durationDays);
  } else if (setting && setting.billingCycle) {
    if (setting.billingCycle === "monthly") {
      expiryDate.setMonth(expiryDate.getMonth() + 1);
    } else if (setting.billingCycle === "quarterly") {
      expiryDate.setMonth(expiryDate.getMonth() + 3);
    } else if (setting.billingCycle === "halfYearly") {
      expiryDate.setMonth(expiryDate.getMonth() + 6);
    } else if (setting.billingCycle === "yearly") {
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    } else {
      expiryDate.setDate(expiryDate.getDate() + 30);
    }
  } else {
    expiryDate.setDate(expiryDate.getDate() + 30);
  }
  return expiryDate;
};

/* ==================== REGISTER ADMIN ==================== */
export const registerAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, role, department, plan, adminId, userLimit } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin with this email already exists" });
    }

    const planInfo = await PlanSetting.findOne({ planName: plan || "Free" });

    if (!planInfo && plan && plan !== "Free") {
      return res.status(400).json({ message: "The selected plan is invalid or no longer exists." });
    }

    const isPaid = planInfo ? planInfo.price > 0 : false;
    const planExpiresAt = await getExpiryDate(plan || "Free");

    const planDetails = {
      planName: planInfo ? planInfo.planName : (plan || "Free"),
      price: planInfo ? planInfo.price : 0,
      billingCycle: planInfo ? planInfo.billingCycle : "free",
      durationDays: planInfo ? planInfo.durationDays : 30,
      maxUsers: planInfo ? (planInfo.maxUsers ?? 30) : 30,
      features: planInfo ? [...planInfo.features] : [],
      isUnlimited: planInfo ? planInfo.isUnlimited : false,
      isPaid: isPaid,
      activatedAt: new Date(),
      expiresAt: planExpiresAt,
      sourcePlanId: planInfo ? planInfo._id : null,
    };

    const admin = await Admin.create({
      name,
      email,
      password,
      phone: phone || "",
      role: role || "admin",
      department: department || "Administration",
      planDetails,
      loginEnabled: true,
      adminId: adminId || null,
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

    /* === ✅ RESOLVE EFFECTIVE ROOT ADMIN FOR PLAN CHECK === */
    let rootAdmin = admin;
    if (admin.adminId) {
      const resolved = await Admin.findById(admin.adminId);
      if (resolved) rootAdmin = resolved;
    }

    /* === ✅ SKIP EXPIRY CHECK FOR OWNER / UNLIMITED PLAN === */
    const planInfo = await PlanSetting.findOne({ planName: rootAdmin.plan });
    const isUnlimitedPlan = planInfo && (planInfo.isUnlimited || planInfo.isOwnerPlan);

    if (!isUnlimitedPlan) {
      const expiredPayload = await getExpiredSubscriptionPayload(rootAdmin, "admin");
      if (expiredPayload) {
        return res.status(expiredPayload.status).json(expiredPayload.body);
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
        companyLogo: admin.companyLogo || null,
        navTemplate: admin.navTemplate || "sidebar",
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
    const { planId, planName, durationDays, price, billingCycle = "monthly", maxUsers, features, targetAdminIds } = req.body;

    // 1️⃣ Customize specifically for selected admins only
    if (targetAdminIds && targetAdminIds.length > 0 && !targetAdminIds.includes("all")) {
      const updatedAdmins = [];
      for (const adminId of targetAdminIds) {
        const admin = await Admin.findById(adminId);
        if (admin) {
          if (!admin.planDetails) {
            admin.planDetails = {};
          }

          admin.planDetails.price = Number(price);
          if (features) {
            admin.planDetails.features = features;
          }
          admin.markModified("planDetails");
          await admin.save();
          updatedAdmins.push(admin.name || admin.email);
        }
      }

      return res.status(200).json({
        message: `Plan settings customized specifically for: ${updatedAdmins.join(", ")}`,
        setting: null,
      });
    }

    // 2️⃣ Update Master Plan and propagate to all enrolled admins
    // ✅ Protect owner plan from being modified via API
    let existing;
    if (planId) {
      existing = await PlanSetting.findById(planId);
    } else {
      existing = await PlanSetting.findOne({ planName });
    }

    if (existing && existing.isOwnerPlan) {
      return res.status(403).json({ message: "The Owner plan is protected and cannot be modified." });
    }

    let setting;
    if (existing) {
      existing.planName = planName;
      existing.durationDays = Number(durationDays);
      existing.price = Number(price);
      existing.billingCycle = billingCycle;
      existing.maxUsers = maxUsers !== undefined ? Number(maxUsers) : null;
      existing.features = features;
      setting = await existing.save();

      // ✅ Update features and price of all current admins enrolled in this plan
      await Admin.updateMany(
        { "planDetails.planName": planName },
        { 
          $set: { 
            "planDetails.features": features,
            "planDetails.price": Number(price)
          } 
        }
      );
    } else {
      setting = await PlanSetting.create({
        planName,
        durationDays: Number(durationDays),
        price: Number(price),
        billingCycle,
        maxUsers: maxUsers !== undefined ? Number(maxUsers) : null,
        features: features,
      });
    }

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
    
    // Map nested planDetails to top-level properties for frontend compatibility
    const mappedAdmins = admins.map((admin) => {
      const adminObj = admin.toObject();
      if (adminObj.planDetails) {
        adminObj.plan = adminObj.planDetails.planName || adminObj.plan;
        adminObj.isPaid = adminObj.planDetails.isPaid !== undefined ? adminObj.planDetails.isPaid : adminObj.isPaid;
        adminObj.planActivatedAt = adminObj.planDetails.activatedAt || adminObj.planActivatedAt;
        adminObj.planExpiresAt = adminObj.planDetails.expiresAt || adminObj.planExpiresAt;
        adminObj.userLimit = adminObj.planDetails.maxUsers !== undefined ? adminObj.planDetails.maxUsers : adminObj.userLimit;
      }
      return adminObj;
    });

    res.status(200).json(mappedAdmins);
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

/* ==================== TOGGLE PLAN VISIBILITY ==================== */
export const togglePlanVisibility = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await PlanSetting.findById(id);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    if (plan.isOwnerPlan) {
      return res.status(403).json({ message: "The Owner plan is protected and cannot be toggled." });
    }

    plan.isActive = !plan.isActive;
    await plan.save();

    res.status(200).json({
      message: `Plan "${plan.planName}" is now ${plan.isActive ? "visible" : "hidden"} on the frontend.`,
      isActive: plan.isActive,
    });
  } catch (error) {
    console.error("❌ TOGGLE PLAN VISIBILITY ERROR:", error);
    res.status(500).json({ message: "Failed to toggle plan visibility" });
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
    const plans = await PlanSetting.find({});
    const planMap = {};
    plans.forEach(p => planMap[p.planName] = p);

    const admins = await Admin.find({})
      .select("name email plan userLimit loginEnabled isPaid planActivatedAt planExpiresAt lastPaymentAt lastPaymentAmount planDetails createdAt")
      .sort({ createdAt: -1 });

    const adminData = await Promise.all(
      admins.map(async (admin) => {
        const employees = await Employee.find({ adminId: admin._id }).select("name loginEnabled");
        const totalEmployees = employees.length;
        const disabledEmployees = employees.filter(e => e.loginEnabled === false).length;
        const staffNames = employees.map(e => e.name);

        const supportAdminCount = await SupportAdmin.countDocuments({ adminId: admin._id });

        let details = admin.planDetails || {};
        let planName = details.planName || admin.plan || "Free";
        let isPaid = details.planName ? details.isPaid : admin.isPaid;
        let planActivatedAt = details.planName ? details.activatedAt : admin.planActivatedAt;
        let planExpiresAt = details.planName ? details.expiresAt : admin.planExpiresAt;
        let lastPaymentAmount = details.planName ? details.lastPaymentAmount : admin.lastPaymentAmount;
        let lastPaymentAt = details.planName ? details.lastPaymentAt : admin.lastPaymentAt;

        const planInfo = planMap[planName];
        const isOwner = details.planName
          ? details.isUnlimited
          : (planInfo && (planInfo.isOwnerPlan || planInfo.isUnlimited)) || (planName?.toLowerCase() === 'owner');

        let userLimit = isOwner ? null : (details.planName ? details.maxUsers : (admin.userLimit || null));
        if (userLimit === null && !isOwner) {
          if (planInfo && planInfo.maxUsers) {
            userLimit = planInfo.maxUsers;
          } else if (planName === 'Free' || planName === 'Free Trail' || planName?.toLowerCase()?.includes('free')) {
            userLimit = planMap['Free']?.maxUsers || 30;
          }
        }

        return {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          plan: planName,
          userLimit,
          isPaid: isPaid,
          billPaid: lastPaymentAmount || (planInfo?.price ? planInfo.price * Math.max(totalEmployees, 1) * getBillingCycleMultiplier(planInfo.billingCycle, planInfo.planName) : 0),
          planPrice: details.planName ? details.price : (planInfo?.price || 0),
          billingCycle: details.planName ? details.billingCycle : (planInfo?.billingCycle || null),
          billingDurationDays: details.planName ? details.durationDays : (planInfo?.durationDays || null),
          planActivatedAt: planActivatedAt,
          lastPaymentAt: lastPaymentAt,
          loginEnabled: admin.loginEnabled !== false,
          planExpiresAt: planExpiresAt,
          createdAt: admin.createdAt,
          totalEmployees,
          disabledEmployees,
          staffNames,
          supportAdminCount,
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

    let admin;
    if (req.user.role === "support-admin") {
      admin = await SupportAdmin.findById(req.user.actualId || req.user._id);
    } else {
      admin = await Admin.findById(req.user.actualId || req.user._id);
    }

    if (!admin) {
      return res.status(404).json({ message: "Admin/SupportAdmin not found" });
    }

    const adminObj = admin.toObject();
    const rootAdminId = req.user.role === "support-admin" ? admin.adminId : admin._id;
    const supportAdminCount = await SupportAdmin.countDocuments({ adminId: rootAdminId });
    adminObj.supportAdminCount = supportAdminCount;

    // Calculate active addon sum (addons that are paid and not expired)
    const now = new Date();
    const currentRazorpayPaymentId = adminObj.planDetails?.razorpayPaymentId || adminObj.razorpayPaymentId;
    const currentRazorpayOrderId = adminObj.planDetails?.razorpayOrderId || adminObj.razorpayOrderId;

    const activeAddonTotal = (adminObj.limitAddons || []).reduce((sum, addon) => {
      const alreadyMainBilled =
        (addon.razorpayPaymentId && currentRazorpayPaymentId && addon.razorpayPaymentId === currentRazorpayPaymentId) ||
        (addon.razorpayOrderId && currentRazorpayOrderId && addon.razorpayOrderId === currentRazorpayOrderId);

      if (addon.isPaid && !addon.mergedIntoMainPlan && !alreadyMainBilled && addon.expiresAt && new Date(addon.expiresAt) > now) {
        return sum + (addon.addonLimit || 0);
      }
      return sum;
    }, 0);

    let isOwner = false;
    let baseLimit = 30;

    if (adminObj.planDetails && adminObj.planDetails.planName) {
      isOwner = adminObj.planDetails.isUnlimited;
      baseLimit = adminObj.planDetails.maxUsers;
      // Populate legacy flat properties to preserve compatibility with frontend/sidebar routing
      adminObj.plan = adminObj.planDetails.planName;
      adminObj.isPaid = adminObj.planDetails.isPaid;
      adminObj.planActivatedAt = adminObj.planDetails.activatedAt;
      adminObj.planExpiresAt = adminObj.planDetails.expiresAt;
      adminObj.userLimit = adminObj.planDetails.maxUsers;
    } else {
      const planInfo = await PlanSetting.findOne({ planName: admin.plan });
      isOwner = (planInfo && (planInfo.isOwnerPlan || planInfo.isUnlimited)) || (admin.plan && admin.plan.toLowerCase() === 'owner');
      baseLimit = adminObj.userLimit || 30;
    }

    adminObj.activeAddonTotal = activeAddonTotal;
    adminObj.effectiveUserLimit = isOwner ? null : (baseLimit + activeAddonTotal);

    if (req.user.role === "support-admin") {
      const parentAdmin = await Admin.findById(rootAdminId).select("companyLogo navTemplate");
      adminObj.companyLogo = parentAdmin?.companyLogo || null;
      adminObj.navTemplate = parentAdmin?.navTemplate || "sidebar";
    } else {
      const fullAdmin = await Admin.findById(rootAdminId).select("companyLogo navTemplate");
      adminObj.companyLogo = fullAdmin?.companyLogo || null;
      adminObj.navTemplate = fullAdmin?.navTemplate || "sidebar";
    }

    res.status(200).json(adminObj);
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

    let updatedAdmin;
    if (req.user.role === "support-admin") {
      updatedAdmin = await SupportAdmin.findByIdAndUpdate(
        req.user.actualId || req.user._id,
        { name, phone, department },
        { new: true, runValidators: true }
      );
    } else {
      updatedAdmin = await Admin.findByIdAndUpdate(
        req.user.actualId || req.user._id,
        { name, phone, department },
        { new: true, runValidators: true }
      );
    }

    if (!updatedAdmin) {
      return res.status(404).json({ message: "Admin/SupportAdmin not found" });
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

/* ==================== MOBILE ATTENDANCE ACCESS ==================== */
export const getMobileAccess = async (req, res) => {
  try {
    const rootAdminId = req.user?.role === "employee" ? req.user.adminId : req.user?._id;

    if (!rootAdminId) {
      return res.status(400).json({ message: "Admin account not found for this user" });
    }

    const admin = await Admin.findById(rootAdminId).select("mobileAccessEnabled").lean();

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json({
      mobileAccessEnabled: admin.mobileAccessEnabled !== false,
    });
  } catch (error) {
    console.error("Mobile access fetch error:", error);
    res.status(500).json({ message: "Failed to fetch mobile access setting" });
  }
};

export const updateMobileAccess = async (req, res) => {
  try {
    const { mobileAccessEnabled } = req.body;

    if (typeof mobileAccessEnabled !== "boolean") {
      return res.status(400).json({ message: "mobileAccessEnabled must be a boolean" });
    }

    const admin = await Admin.findByIdAndUpdate(
      req.user._id,
      { mobileAccessEnabled },
      { new: true, runValidators: true }
    ).select("mobileAccessEnabled");

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json({
      message: `Mobile attendance access ${mobileAccessEnabled ? "enabled" : "disabled"} successfully`,
      mobileAccessEnabled: admin.mobileAccessEnabled !== false,
    });
  } catch (error) {
    console.error("Mobile access update error:", error);
    res.status(500).json({ message: "Failed to update mobile access setting" });
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

    const admin = await Admin.findById(req.user._id).select("planDetails plan");
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    let planName = "Free";
    let isOwner = false;
    let allowedRoutes = [];

    if (admin.planDetails && admin.planDetails.planName) {
      planName = admin.planDetails.planName;
      isOwner = admin.planDetails.isUnlimited;
      allowedRoutes = admin.planDetails.features || [];
    } else {
      // Fallback for pre-migration documents
      const planInfo = await PlanSetting.findOne({ planName: admin.plan || "Free" });
      planName = admin.plan || "Free";
      isOwner = (planInfo && (planInfo.isOwnerPlan || planInfo.isUnlimited)) || (planName?.toLowerCase() === 'owner');
      allowedRoutes = planInfo ? planInfo.features : [];
    }

    // ✅ Owner / unlimited plan → return ALL features from all plans (no restriction)
    if (isOwner) {
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
        planName,
        isOwnerPlan: true,
        allowedRoutes: Array.from(allRoutes),
      });
    }

    res.status(200).json({
      planName,
      allowedRoutes,
    });
  } catch (error) {
    console.error("❌ GET MY PLAN FEATURES ERROR:", error);
    res.status(500).json({ message: "Failed to fetch plan features" });
  }
};

/* ==================== CHANGE ADMIN PASSWORD (Master Only) ==================== */
export const changeAdminPassword = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    admin.password = newPassword;
    await admin.save(); // pre-save hook will hash it

    res.status(200).json({ message: `Password for ${admin.name} updated successfully` });
  } catch (error) {
    console.error("❌ CHANGE ADMIN PASSWORD ERROR:", error);
    res.status(500).json({ message: "Failed to change password" });
  }
};

/* ==================== DELETE ADMIN (Master Only) ==================== */
export const deleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // 1. Fetch related IDs to perform dynamic cascade delete
    const companyDocs = await mongoose.model("Company").find({ adminId });
    const companyIds = companyDocs.map((c) => c._id);

    const employeeDocs = await mongoose.model("Employee").find({ adminId });
    const employeeIds = employeeDocs.map((emp) => emp.employeeId);
    const employeeObjectIds = employeeDocs.map((emp) => emp._id);

    const supportAdminDocs = await mongoose.model("SupportAdmin").find({ adminId });
    const supportAdminObjectIds = supportAdminDocs.map((sa) => sa._id);

    const allUserObjectIds = [admin._id, ...employeeObjectIds, ...supportAdminObjectIds];

    // 2. Cascade delete on all registered models dynamically
    const modelNames = mongoose.modelNames();
    for (const modelName of modelNames) {
      // Skip the Admin model itself during dynamic loop to delete it specifically last
      if (modelName === "Admin") continue;

      const Model = mongoose.model(modelName);
      
      // A. If the schema has an adminId path
      if (Model.schema.paths.adminId) {
        await Model.deleteMany({ adminId });
      }
      
      // B. If the schema has an employeeId path
      if (Model.schema.paths.employeeId) {
        await Model.deleteMany({
          employeeId: { $in: [...employeeIds, ...employeeObjectIds] }
        });
      }

      // C. If the schema has a userId path
      if (Model.schema.paths.userId) {
        await Model.deleteMany({
          userId: { $in: allUserObjectIds }
        });
      }

      // D. If the schema has a companyId path
      if (Model.schema.paths.companyId) {
        await Model.deleteMany({
          companyId: { $in: companyIds }
        });
      }

      // E. If the schema has a company path
      if (Model.schema.paths.company) {
        await Model.deleteMany({
          company: { $in: companyIds }
        });
      }
    }

    // 3. Delete the admin itself
    await Admin.findByIdAndDelete(adminId);

    res.status(200).json({ message: `Admin account for ${admin.name} and all associated logins and data have been permanently deleted` });
  } catch (error) {
    console.error("❌ DELETE ADMIN ERROR:", error);
    res.status(500).json({ message: "Failed to delete admin account" });
  }
};

/* ==================== REGISTER SUPPORT ADMIN ==================== */
export const registerSupportAdmin = async (req, res) => {
  try {
    const { supportAdminId, name, email, password, positionName, phone, department, adminId, assignedFeatures } = req.body;

    if (!supportAdminId || !name || !email || !password || !adminId) {
      return res.status(400).json({ message: "Support Admin ID, name, email, password, and adminId are required" });
    }

    const existingSupportAdmin = await SupportAdmin.findOne({ email });
    const existingAdmin = await Admin.findOne({ email });
    if (existingSupportAdmin || existingAdmin) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // ✅ User Limit Check for Support Admins
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Root Admin not found" });
    }

    const planSetting = await PlanSetting.findOne({ planName: admin.plan });
    const isOwnerPlan = planSetting && (planSetting.isOwnerPlan || planSetting.isUnlimited) || (admin.plan && admin.plan.toLowerCase() === 'owner');

    let maxUsers = admin.userLimit || null;
    if (isOwnerPlan) {
      maxUsers = null;
    } else if (maxUsers === null) {
      if (planSetting && planSetting.maxUsers) {
        maxUsers = planSetting.maxUsers;
      } else if (admin.plan === 'Free' || admin.plan === 'Free Trail' || admin.plan?.toLowerCase()?.includes('free')) {
        const freeSetting = await PlanSetting.findOne({ planName: 'Free' });
        maxUsers = freeSetting ? freeSetting.maxUsers : 30;
      }
    }

    if (maxUsers !== null) {
      const currentEmployeeCount = await Employee.countDocuments({ adminId });
      const currentSupportAdminCount = await SupportAdmin.countDocuments({ adminId });
      const totalCount = currentEmployeeCount + currentSupportAdminCount; // Admin is account owner and does not count toward user limit
      if (totalCount >= maxUsers) {
        return res.status(400).json({
          message: `User limit reached (${maxUsers} users). You cannot add more administration users. Please upgrade your plan or increase your user limit.`
        });
      }
    }

    const existingSupportAdminId = await SupportAdmin.findOne({ supportAdminId, adminId });
    if (existingSupportAdminId) {
      return res.status(400).json({ message: "Support Admin ID already exists" });
    }

    const supportAdmin = await SupportAdmin.create({
      supportAdminId,
      name,
      email,
      password,
      positionName: positionName || "Administration",
      phone: phone || "",
      department: department || "Support Administration",
      adminId: adminId,
      loginEnabled: true,
      role: "support-admin",
      assignedFeatures: assignedFeatures
    });

    res.status(201).json({ message: "Support Admin registered successfully", manager: supportAdmin });
  } catch (error) {
    console.error("❌ REGISTER SUPPORT ADMIN ERROR:", error);
    res.status(500).json({ message: 'Failed to register support admin' });
  }
};

/* ==================== UPDATE SUPPORT ADMIN ==================== */
export const updateSupportAdmin = async (req, res) => {
  try {
    const parentAdminId = req.user.role === "support-admin" ? req.user._id : (req.user.actualId || req.user._id);
    const { id } = req.params;
    const { supportAdminId, name, email, positionName, phone, department, loginEnabled, password, assignedFeatures } = req.body;

    if (!supportAdminId || !name || !email) {
      return res.status(400).json({ message: "Support Admin ID, name, and email are required" });
    }

    const supportAdmin = await SupportAdmin.findOne({ _id: id, adminId: parentAdminId }).select("+password");
    if (!supportAdmin) {
      return res.status(404).json({ message: "Support Admin not found or unauthorized" });
    }

    const emailOwner = await SupportAdmin.findOne({ email: email.toLowerCase(), _id: { $ne: id } });
    const adminEmailOwner = await Admin.findOne({ email: email.toLowerCase() });
    if (emailOwner || adminEmailOwner) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    const idOwner = await SupportAdmin.findOne({
      supportAdminId,
      adminId: parentAdminId,
      _id: { $ne: id },
    });
    if (idOwner) {
      return res.status(400).json({ message: "Support Admin ID already exists" });
    }

    supportAdmin.supportAdminId = supportAdminId;
    supportAdmin.name = name;
    supportAdmin.email = email;
    supportAdmin.positionName = positionName || "Administration";
    supportAdmin.phone = phone || "";
    supportAdmin.department = department || "Support Administration";
    supportAdmin.loginEnabled = loginEnabled !== false;

    if (assignedFeatures) {
      supportAdmin.assignedFeatures = assignedFeatures;
    }

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      supportAdmin.password = password;
    }

    await supportAdmin.save();
    const updatedSupportAdmin = supportAdmin.toObject();
    delete updatedSupportAdmin.password;

    res.status(200).json({ message: "Support Admin updated successfully", supportAdmin: updatedSupportAdmin });
  } catch (error) {
    console.error("âŒ UPDATE SUPPORT ADMIN ERROR:", error);
    res.status(500).json({ message: "Failed to update support admin" });
  }
};

/* ==================== GET SUPPORT ADMINS ==================== */
export const getSupportAdmins = async (req, res) => {
  try {
    const parentAdminId = req.user.role === "support-admin" ? req.user._id : (req.user.actualId || req.user._id);
    const supportAdmins = await SupportAdmin.find({ adminId: parentAdminId }).select('-password');
    res.status(200).json(supportAdmins);
  } catch (error) {
    console.error("❌ GET SUPPORT ADMINS ERROR:", error);
    res.status(500).json({ message: 'Failed to fetch support admins' });
  }
};

/* ==================== DELETE SUPPORT ADMIN ==================== */
export const deleteSupportAdmin = async (req, res) => {
  try {
    const parentAdminId = req.user.role === "support-admin" ? req.user._id : (req.user.actualId || req.user._id);
    const supportAdminId = req.params.id;
    const supportAdmin = await SupportAdmin.findOneAndDelete({ _id: supportAdminId, adminId: parentAdminId });
    if (!supportAdmin) {
      return res.status(404).json({ message: 'Support Admin not found or unauthorized' });
    }
    res.status(200).json({ message: 'Support Admin deleted successfully' });
  } catch (error) {
    console.error("❌ DELETE SUPPORT ADMIN ERROR:", error);
    res.status(500).json({ message: 'Failed to delete support admin' });
  }
};

/* ==================== FREE UPGRADE TO OWNER PLAN ==================== */
export const freeUpgradeToOwner = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (req.user.role === "support-admin") {
      return res.status(403).json({ message: "Support admins cannot upgrade plans" });
    }

    const admin = await Admin.findById(req.user._id || req.user.actualId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Check if the current plan is Free
    const currentPlanLower = (admin.planDetails?.planName || admin.plan || "").toLowerCase();
    if (!currentPlanLower.includes("free")) {
      return res.status(400).json({ message: "Only users on the Free plan can upgrade to Owner for free." });
    }

    const ownerPlan = await PlanSetting.findOne({ planName: "Owner" });
    if (!ownerPlan) {
      return res.status(404).json({ message: "Owner plan not found in settings. Please contact support." });
    }

    const planExpiresAt = await getExpiryDate("Owner");

    admin.planDetails = {
      planName: "Owner",
      price: ownerPlan.price,
      billingCycle: ownerPlan.billingCycle,
      durationDays: ownerPlan.durationDays,
      maxUsers: ownerPlan.maxUsers ?? null,
      features: [...ownerPlan.features],
      isUnlimited: ownerPlan.isUnlimited,
      isPaid: true,
      activatedAt: new Date(),
      expiresAt: planExpiresAt,
      sourcePlanId: ownerPlan._id,
    };

    await admin.save();

    res.status(200).json({
      message: "Upgraded to Owner plan successfully!",
      admin: {
        plan: admin.planDetails.planName,
        isPaid: admin.planDetails.isPaid,
        planActivatedAt: admin.planDetails.activatedAt,
        planExpiresAt: admin.planDetails.expiresAt,
      }
    });
  } catch (error) {
    console.error("❌ FREE UPGRADE TO OWNER ERROR:", error);
    res.status(500).json({ message: "Failed to upgrade plan. Server error." });
  }
};
