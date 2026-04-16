// --- START OF FILE controllers/authController.js ---

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { promisify } from "util";
import Admin from "../models/adminModel.js";
import Employee from "../models/employeeModel.js";

/* ================================================================
 * generateToken
 * ================================================================ */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

/* ================================================================
 * login — POST /api/auth/login
 *
 * ROOT CAUSE FIX:
 * The old version only searched the Employee model. Admins live in a
 * separate Admin model. So when an Admin logged in, they got a JWT
 * containing their Admin _id — but every subsequent protect() call
 * did Employee.findById(adminId), found nothing, and returned 401.
 *
 * Fix: try Admin model first, then Employee model.
 * ================================================================ */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── 1. Try Admin first ────────────────────────────────────────────────
    let user = null;
    let role = null;
    let oldEmailMatch = false;
    let newEmail = null;

    const admin = await Admin.findOne({ email: normalizedEmail }).select("+password");
    if (admin) {
      user = admin;
      role = "admin";
    } else {
      // ── 2. Fall back to Employee ────────────────────────────────────────
      const employee = await Employee.findOne({ email: normalizedEmail }).select("+password");
      if (employee) {
        user = employee;
        role = "employee";
      } else {
        // ── 2.1 Check if this is an old email ──────────────────────────────
        const oldEmployee = await Employee.findOne({ previousEmail: normalizedEmail });
        if (oldEmployee) {
          oldEmailMatch = true;
          newEmail = oldEmployee.email;
          // ✅ Clear previousEmail immediately so the popup only shows ONCE.
          // Next login attempt with this old email will get "Invalid email or password".
          await Employee.findByIdAndUpdate(oldEmployee._id, { $unset: { previousEmail: "" } });
        }
      }
    }

    if (oldEmailMatch) {
      return res.status(401).json({ 
        emailChanged: true, 
        newEmail: newEmail,
        message: `Your login mail is changed. This is your new mail: ${newEmail}` 
      });
    }

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // ── 3. Employee-specific access checks ───────────────────────────────
    if (role === "employee") {
      if (user.loginEnabled === false) {
        return res.status(403).json({
          loginStopped: true,
          message: "Your login access has been disabled. Please contact admin.",
        });
      }
      if (!user.isActive || user.status === "Inactive") {
        return res.status(403).json({
          message: "Your account has been deactivated. Please contact admin.",
        });
      }
    }

    // ── 4. Admin-specific checks (loginEnabled + plan expiry) ─────────────
    if (role === "admin") {
      if (user.loginEnabled === false) {
        return res.status(403).json({
          loginStopped: true,
          message: "Admin login has been disabled.",
        });
      }
      if (user.planExpiresAt && new Date(user.planExpiresAt) < new Date()) {
        const expiredDaysAgo = Math.floor(
          (new Date() - new Date(user.planExpiresAt)) / (1000 * 60 * 60 * 24)
        );
        return res.status(403).json({
          expired: true,
          adminDetails: {
            name: user.name,
            email: user.email,
            plan: user.plan,
            planActivatedAt: user.planActivatedAt,
            planExpiresAt: user.planExpiresAt,
            expiredDaysAgo,
          },
        });
      }
    }

    // ── 5. Compare password ───────────────────────────────────────────────
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // ── 6. Respond with token + user (password stripped, role attached) ───
    const token = generateToken(user._id);
    const userObj = user.toObject();
    delete userObj.password;
    userObj.role = role; // always present in the response

    return res.status(200).json({
      message: "Login successful",
      token,
      user: userObj,
    });

  } catch (err) {
    console.error("❌ Login error:", err);
    return res.status(500).json({ message: "Server error during login." });
  }
};

/* ================================================================
 * protect — JWT middleware (used by employeeRoutes, userRoutes, etc.)
 *
 * ROOT CAUSE FIX:
 * The old version only did Employee.findById(decoded.id). When an
 * Admin's token was passed, that lookup returned null → 401.
 *
 * Fix: Check Admin first, then Employee — identical to the working
 * authMiddleware.js so both protect implementations behave the same.
 * ================================================================ */
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }

  try {
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // Check Admin first, then Employee
    let currentUser = await Admin.findById(decoded.id).select("-password");
    if (currentUser) {
      currentUser.role = "admin";
    } else {
      currentUser = await Employee.findById(decoded.id).select("-password");
      if (currentUser) {
        // preserve existing role field (e.g. "manager") but default to "employee"
        currentUser.role = currentUser.role || "employee";
      }
    }

    if (!currentUser) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    req.user = currentUser;
    next();
  } catch (err) {
    console.error("❌ Auth middleware error:", err.message);
    return res.status(401).json({ message: "Not authorized, token invalid" });
  }
};