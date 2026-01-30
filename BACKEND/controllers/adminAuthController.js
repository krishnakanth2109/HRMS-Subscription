import Admin from "../models/adminModel.js";
import jwt from "jsonwebtoken";

/* ==================== JWT SIGN ==================== */
const signToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

/* ==================== REGISTER FREE ADMIN ==================== */
export const registerAdmin = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      role,
      department,
      plan,
    } = req.body;

    /* ==================== VALIDATION ==================== */
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required",
      });
    }

    // 🚫 Block paid plans (Stripe only)
    if (plan && plan !== "Free") {
      return res.status(403).json({
        message: "Paid plans must be purchased via Stripe",
      });
    }

    /* ==================== CHECK EXISTING ==================== */
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        message: "Admin with this email already exists",
      });
    }

    /* ==================== CREATE FREE ADMIN ==================== */
    const admin = await Admin.create({
      name,
      email,
      password, // hashed by schema pre-save
      phone: phone || "",
      role: role || "admin",
      department: department || "Administration",

      // 🔹 Free plan defaults
      plan: "Free",
      isPaid: false,
      planActivatedAt: new Date(),

      // 🔹 Stripe fields remain NULL
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      lastPaymentAt: null,
    });

    /* ==================== JWT ==================== */
    const token = signToken(admin._id, admin.role);

    /* ==================== RESPONSE ==================== */
    res.status(201).json({
      message: "Free admin registered successfully",
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        plan: admin.plan,
        isPaid: admin.isPaid,
      },
    });
  } catch (error) {
    console.error("❌ REGISTER ADMIN ERROR:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};