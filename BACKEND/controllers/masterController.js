// --- START OF FILE controllers/masterController.js ---
import MasterAdmin from "../models/MasterAdmin.js";
import Admin from "../models/adminModel.js"; 
import jwt from "jsonwebtoken";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
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

    // Calculate basic stats
    const totalAdmins = admins.length;
    const activeSubs = admins.filter(a => a.subscriptionStatus === 'active').length;
    
    // Calculate estimated revenue (Mock logic based on Plan string)
    const revenueMap = { 'Free': 0, 'Basic': 29, 'Premium': 99, 'Flex': 199 };
    const totalRevenue = admins.reduce((acc, curr) => acc + (revenueMap[curr.plan] || 0), 0);

    res.json({
      stats: {
        totalCompanies: totalAdmins,
        activeSubscriptions: activeSubs,
        estimatedRevenue: totalRevenue
      },
      admins: admins 
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
// --- END OF FILE controllers/masterController.js ---