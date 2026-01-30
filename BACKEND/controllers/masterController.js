// --- START OF FILE controllers/masterController.js ---
import MasterAdmin from "../models/MasterAdmin.js";
import Admin from "../models/adminModel.js"; // Importing your existing Admin model
import jwt from "jsonwebtoken";

// Generate JWT Helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// @desc    Auth Master & get token
// @route   POST /api/master/login
// @access  Public
export const authMaster = async (req, res) => {
  const { email, password } = req.body;

  try {
    const master = await MasterAdmin.findOne({ email }).select("+password");

    if (master && (await master.matchPassword(password))) {
      res.json({
        _id: master._id,
        email: master.email,
        role: master.role,
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

    // Calculate basic stats for the dashboard response
    const totalAdmins = admins.length;
    const activeSubs = admins.filter(a => a.subscriptionStatus === 'active').length;
    
    // Calculate estimated revenue (Mock logic based on Plan string)
    // You can refine this if you save actual amount in DB
    const revenueMap = { 'Free': 0, 'Basic': 29, 'Premium': 99, 'Flex': 199 };
    const totalRevenue = admins.reduce((acc, curr) => acc + (revenueMap[curr.plan] || 0), 0);

    res.json({
      stats: {
        totalCompanies: totalAdmins,
        activeSubscriptions: activeSubs,
        estimatedRevenue: totalRevenue
      },
      admins: admins // This contains plan, stripeSubscriptionId, etc.
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update Global Settings (Example)
// @route   PUT /api/master/settings
export const updateMasterSettings = async (req, res) => {
    // Implement logic if you have a Settings model
    res.json({ message: "Settings updated successfully" });
};
// --- END OF FILE controllers/masterController.js ---