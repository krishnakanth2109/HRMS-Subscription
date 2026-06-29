// --- START OF FILE controllers/masterController.js ---
import MasterAdmin from "../models/MasterAdmin.js";
import Admin from "../models/adminModel.js";
import PlanSetting from "../models/planSettingModel.js";
import jwt from "jsonwebtoken";
import { cloudinary } from "../config/cloudinary.js";

const DEFAULT_LOGO = "https://image2url.com/r2/default/images/1774247571292-e7459e42-1868-4206-bd5c-bb4c59de5716.png";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

const getAdminRevenueTotal = (admin) => {
  const payments = new Map();
  let totalWithoutPaymentId = 0;

  const addPayment = (paymentId, orderId, amount) => {
    const paidAmount = Number(amount) || 0;
    if (paidAmount <= 0) return;

    const key = paymentId || orderId;
    if (!key) {
      totalWithoutPaymentId += paidAmount;
      return;
    }

    payments.set(key, Math.max(payments.get(key) || 0, paidAmount));
  };

  addPayment(admin.razorpayPaymentId, admin.razorpayOrderId, admin.lastPaymentAmount);

  (admin.limitAddons || []).forEach((addon) => {
    addPayment(addon.razorpayPaymentId, addon.razorpayOrderId, addon.pricePaid);
  });

  return [...payments.values()].reduce((sum, amount) => sum + amount, totalWithoutPaymentId);
};

// @desc    Auth Master & get token
// @route   POST /api/master/login
// @access  Public
export const authMaster = async (req, res) => {
  const { email, password } = req.body;

  try {
    const master = await MasterAdmin.findOne({ email }).select("+password");

    if (master && (await master.correctPassword(password, master.password))) {
      res.json({
        _id: master._id,
        email: master.email,
        role: "master",
        token: generateToken(master._id),
      });
    } else {
      res.status(401).json({ message: "Invalid Master Credentials" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get All Admins (Companies) with Subscription Details
// @route   GET /api/master/admins
// @access  Private (Master Only)
export const getAllAdmins = async (req, res) => {
  try {
    // Fetch all admins, sort by newest
    const admins = await Admin.find({}).sort({ createdAt: -1 }).select("-password");

    // Map nested planDetails to top-level properties for frontend compatibility
    const mappedAdmins = admins.map((admin) => {
      const adminObj = admin.toObject();
      if (adminObj.planDetails) {
        adminObj.plan = adminObj.planDetails.planName || adminObj.plan;
        adminObj.isPaid = adminObj.planDetails.isPaid !== undefined ? adminObj.planDetails.isPaid : adminObj.isPaid;
        adminObj.planActivatedAt = adminObj.planDetails.activatedAt || adminObj.planActivatedAt;
        adminObj.planExpiresAt = adminObj.planDetails.expiresAt || adminObj.planExpiresAt;
        adminObj.userLimit = adminObj.planDetails.maxUsers !== undefined ? adminObj.planDetails.maxUsers : adminObj.userLimit;

        // Compute active subscriptionStatus dynamically
        const isActive = adminObj.planDetails.expiresAt && new Date(adminObj.planDetails.expiresAt) > new Date();
        adminObj.subscriptionStatus = isActive ? 'active' : 'inactive';
      }
      return adminObj;
    });

    // Calculate basic stats
    const totalAdmins = mappedAdmins.length;
    const activeSubs = mappedAdmins.filter(a => a.subscriptionStatus === 'active').length;

    const totalRevenueGenerated = mappedAdmins.reduce((acc, curr) => acc + getAdminRevenueTotal(curr), 0);

    res.json({
      stats: {
        totalCompanies: totalAdmins,
        activeSubscriptions: activeSubs,
        totalRevenueGenerated,
      },
      admins: mappedAdmins
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update Global Settings (Stub)
// @route   PUT /api/master/settings
// @access  Private (Master Only)
export const updateMasterSettings = async (req, res) => {
  try {
    // Implement logic if you have a Settings model. 
    // For now, return a success message to satisfy the route.
    // Example: const settings = await MasterSettings.findOneAndUpdate({}, req.body, { upsert: true, new: true });

    console.log("Master Settings Update Requested:", req.body);

    res.json({ message: "Global settings updated successfully (Stub)" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign a master plan snapshot to an admin
// @route   POST /api/master/assign-plan
// @access  Private (Master Only)
export const assignPlan = async (req, res) => {
  try {
    const { adminId, planName } = req.body;
    if (!adminId || !planName) {
      return res.status(400).json({ message: "Admin ID and Plan Name are required." });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    // 1. Fetch the master plan
    const masterPlan = await PlanSetting.findOne({ planName: planName });
    if (!masterPlan) {
      return res.status(404).json({ message: `Master plan '${planName}' not found.` });
    }

    // 2. Snapshot into admin's planDetails
    admin.planDetails = {
      planName: masterPlan.planName,
      price: masterPlan.price,
      billingCycle: masterPlan.billingCycle,
      durationDays: masterPlan.durationDays,
      maxUsers: masterPlan.maxUsers ?? 30,
      features: [...masterPlan.features],
      isUnlimited: masterPlan.isUnlimited,
      isPaid: masterPlan.price > 0,
      activatedAt: new Date(),
      expiresAt: masterPlan.isUnlimited
        ? null
        : new Date(Date.now() + masterPlan.durationDays * 86400000),
      sourcePlanId: masterPlan._id,
    };

    await admin.save();
    res.status(200).json({ message: "Plan assigned successfully", planDetails: admin.planDetails });
  } catch (error) {
    console.error("❌ ASSIGN PLAN ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get admin plan snapshot details
// @route   GET /api/master/customize-plan/:adminId
// @access  Private (Master Only)
export const getAdminPlanDetails = async (req, res) => {
  try {
    const { adminId } = req.params;
    const admin = await Admin.findById(adminId).select("name email plan planDetails userLimit isPaid planActivatedAt planExpiresAt companyLogo favicon navTemplate");
    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    // Return planDetails, fallback to old fields if not migrated
    const details = admin.planDetails && admin.planDetails.planName ? admin.planDetails : {
      planName: admin.plan || "Free",
      price: 0,
      billingCycle: "free",
      durationDays: 30,
      maxUsers: admin.userLimit || 30,
      features: [],
      isUnlimited: admin.plan?.toLowerCase() === "owner",
      isPaid: admin.isPaid || false,
      activatedAt: admin.planActivatedAt,
      expiresAt: admin.planExpiresAt,
    };

    res.status(200).json({
      adminName: admin.name,
      email: admin.email,
      companyLogo: admin.companyLogo || null,
      favicon: admin.favicon || null,
      navTemplate: admin.navTemplate || "sidebar",
      planDetails: details,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Customize plan snapshot details for an admin
// @route   PATCH /api/master/customize-plan/:adminId
// @access  Private (Master Only)
export const customizePlan = async (req, res) => {
  try {
    const { adminId } = req.params;
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    const { price, features, maxUsers, billingCycle, navTemplate } = req.body;

    if (!admin.planDetails || !admin.planDetails.planName) {
      // If the admin doesn't have planDetails yet, initialize it
      admin.planDetails = {
        planName: admin.plan || "Free",
        price: 0,
        billingCycle: "free",
        durationDays: 30,
        maxUsers: admin.userLimit || 30,
        features: [],
        isUnlimited: admin.plan?.toLowerCase() === "owner",
        isPaid: admin.isPaid || false,
        activatedAt: admin.planActivatedAt || new Date(),
        expiresAt: admin.planExpiresAt || new Date(Date.now() + 30 * 86400000),
      };
    }

    admin.planDetails.price = price ?? admin.planDetails.price;
    admin.planDetails.features = features ?? admin.planDetails.features;
    admin.planDetails.maxUsers = maxUsers ?? admin.planDetails.maxUsers;
    admin.planDetails.billingCycle = billingCycle ?? admin.planDetails.billingCycle;

    if (navTemplate) {
      admin.navTemplate = navTemplate;
    }

    admin.markModified("planDetails");

    await admin.save();
    res.status(200).json({ message: "Plan customized successfully", planDetails: admin.planDetails, navTemplate: admin.navTemplate });
  } catch (error) {
    console.error("❌ CUSTOMIZE PLAN ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
// @desc    Upload / replace company logo for a specific admin
// @route   PATCH /api/superadmin/admins/:adminId/upload-logo
// @access  Private (Master Only)
export const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const { adminId } = req.params;
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    // Delete the old logo from Cloudinary if it is not the default
    if (admin.companyLogo && admin.companyLogo !== DEFAULT_LOGO) {
      try {
        // Extract public_id: everything after the last domain segment, without extension
        // e.g. https://res.cloudinary.com/dzouczyha/image/upload/v123/company_logos/abc.jpg
        // → public_id = "company_logos/abc"
        const parts = admin.companyLogo.split("/");
        const fileWithExt = parts[parts.length - 1];
        const folder = parts[parts.length - 2];
        const publicId = `${folder}/${fileWithExt.split(".")[0]}`;
        await cloudinary.uploader.destroy(publicId);
      } catch (deleteErr) {
        console.warn("⚠️ Could not delete old logo from Cloudinary:", deleteErr.message);
      }
    }

    // req.file.path is the secure Cloudinary URL from multer-storage-cloudinary
    admin.companyLogo = req.file.path;
    await admin.save();

    res.status(200).json({ success: true, companyLogo: admin.companyLogo });
  } catch (error) {
    console.error("❌ UPLOAD LOGO ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
// @desc    Remove company logo and reset to default for a specific admin
// @route   DELETE /api/master/admins/:adminId/logo
// @access  Private (Master Only)
export const removeLogo = async (req, res) => {
  try {
    const { adminId } = req.params;
    const admin = await Admin.findById(adminId);
    if (!admin) return res.status(404).json({ message: "Admin not found." });

    // Delete from Cloudinary if it is a custom (non-default) logo
    if (admin.companyLogo && admin.companyLogo !== DEFAULT_LOGO) {
      try {
        const parts = admin.companyLogo.split("/");
        const fileWithExt = parts[parts.length - 1];
        const folder = parts[parts.length - 2];
        const publicId = `${folder}/${fileWithExt.split(".")[0]}`;
        await cloudinary.uploader.destroy(publicId);
      } catch (deleteErr) {
        console.warn("⚠️ Could not delete logo from Cloudinary:", deleteErr.message);
      }
    }

    admin.companyLogo = DEFAULT_LOGO;
    await admin.save();

    res.status(200).json({ success: true, companyLogo: admin.companyLogo });
  } catch (error) {
    console.error("❌ REMOVE LOGO ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload / replace favicon for a specific admin
// @route   PATCH /api/master/admins/:adminId/upload-favicon
// @access  Private (Master Only)
export const uploadFavicon = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const { adminId } = req.params;
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    // Delete the old favicon from Cloudinary if it exists
    if (admin.favicon) {
      try {
        const parts = admin.favicon.split("/");
        const fileWithExt = parts[parts.length - 1];
        const folder = parts[parts.length - 2];
        const publicId = `${folder}/${fileWithExt.split(".")[0]}`;
        await cloudinary.uploader.destroy(publicId);
      } catch (deleteErr) {
        console.warn("⚠️ Could not delete old favicon from Cloudinary:", deleteErr.message);
      }
    }

    admin.favicon = req.file.path;
    await admin.save();

    res.status(200).json({ success: true, favicon: admin.favicon });
  } catch (error) {
    console.error("❌ UPLOAD FAVICON ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove favicon for a specific admin
// @route   DELETE /api/master/admins/:adminId/favicon
// @access  Private (Master Only)
export const removeFavicon = async (req, res) => {
  try {
    const { adminId } = req.params;
    const admin = await Admin.findById(adminId);
    if (!admin) return res.status(404).json({ message: "Admin not found." });

    // Delete from Cloudinary if it is a custom favicon
    if (admin.favicon) {
      try {
        const parts = admin.favicon.split("/");
        const fileWithExt = parts[parts.length - 1];
        const folder = parts[parts.length - 2];
        const publicId = `${folder}/${fileWithExt.split(".")[0]}`;
        await cloudinary.uploader.destroy(publicId);
      } catch (deleteErr) {
        console.warn("⚠️ Could not delete favicon from Cloudinary:", deleteErr.message);
      }
    }

    admin.favicon = "";
    await admin.save();

    res.status(200).json({ success: true, favicon: admin.favicon });
  } catch (error) {
    console.error("❌ REMOVE FAVICON ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// --- END OF FILE controllers/masterController.js ---
