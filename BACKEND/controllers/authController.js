// --- START OF FILE controllers/authController.js ---

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { promisify } from "util";
import Admin from "../models/adminModel.js";
import SupportAdmin from "../models/supportAdminModel.js";
import Employee from "../models/employeeModel.js";
import MasterAdmin from "../models/MasterAdmin.js";
import { getExpiredSubscriptionPayload, resolveRootAdmin } from "../utils/subscriptionAccess.js";
import PasswordResetOtp from "../models/PasswordResetOtp.js";
import customTransporter from "../config/nodemailer.js";

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

    // ── 1. Gather all candidate accounts for this email across collections ──────
    const candidates = [];

    const adminDoc = await Admin.findOne({ email: normalizedEmail }).select("+password");
    if (adminDoc) candidates.push({ doc: adminDoc, role: "admin" });

    const supportAdminDoc = await SupportAdmin.findOne({ email: normalizedEmail }).select("+password");
    if (supportAdminDoc) candidates.push({ doc: supportAdminDoc, role: "support-admin" });

    const employeeDoc = await Employee.findOne({ email: normalizedEmail }).select("+password");
    if (employeeDoc) candidates.push({ doc: employeeDoc, role: "employee" });

    let user = null;
    let role = null;
    let oldEmailMatch = false;
    let newEmail = null;

    if (candidates.length === 0) {
      // ── 2. Check if this is an old email ──────────────────────────────
      const oldEmployee = await Employee.findOne({ previousEmail: normalizedEmail });
      if (oldEmployee) {
        oldEmailMatch = true;
        newEmail = oldEmployee.email;
        await Employee.findByIdAndUpdate(oldEmployee._id, { $unset: { previousEmail: "" } });
      }
    } else {
      // ── 3. Find the candidate whose password matches ─────────────────
      for (const candidate of candidates) {
        if (!candidate.doc.password) continue; // Safety check: skip if account has no password
        const isMatch = await bcrypt.compare(password, candidate.doc.password);
        if (isMatch) {
          user = candidate.doc;
          role = candidate.role;
          break;
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

    // ── 4. Employee-specific access checks ───────────────────────────────
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

    // ── 4.1 Support-Admin specific checks ────────────────────────────────
    if (role === "support-admin") {
      if (user.loginEnabled === false) {
        return res.status(403).json({
          loginStopped: true,
          message: "Your login access has been disabled. Please contact admin.",
        });
      }
    }

    // ── 5. Subscription/Plan Expiry check (for all roles that link to an Admin) ─
    let rootAdmin = null;
    if (role === "admin") {
      if (user.loginEnabled === false) {
        return res.status(403).json({
          loginStopped: true,
          message: "Admin login has been disabled.",
        });
      }
      if (user.adminId) {
        rootAdmin = await Admin.findById(user.adminId);
      } else {
        rootAdmin = user;
      }
    } else if (role === "support-admin" || role === "employee") {
      if (user.adminId) {
        rootAdmin = await Admin.findById(user.adminId);
      }
    }

    if (rootAdmin) {
      const expiredPayload = await getExpiredSubscriptionPayload(rootAdmin, role);
      if (expiredPayload) {
        return res.status(expiredPayload.status).json(expiredPayload.body);
      }
    }

    // ── 6. Respond with token + user (password stripped, role attached) ───
    const token = generateToken(user._id);
    
    if (role === "admin") {
      user.lastLoginAt = new Date();
      await user.save({ validateModifiedOnly: true });
    }

    const userObj = user.toObject();
    delete userObj.password;
    userObj.role = role; // always present in the response

    // Normalize employeeId for Support Admins so employee components work properly
    if (role === "support-admin") {
      userObj.employeeId = userObj.supportAdminId || userObj._id;
    }

    if (rootAdmin) {
      userObj.plan = rootAdmin.plan;
    }

    // ── 7. Resolve companyLogo & favicon ──────────────────────────────────────────
    if (role === "admin") {
      userObj.companyLogo = user.companyLogo || null;
      userObj.favicon = user.favicon || null;
    } else if ((role === "support-admin" || role === "employee") && user.adminId) {
      // Derive from parent admin — do not leak across tenants
      const parentAdmin = await Admin.findById(user.adminId).select("companyLogo favicon");
      userObj.companyLogo = parentAdmin?.companyLogo || null;
      userObj.favicon = parentAdmin?.favicon || null;
    } else {
      userObj.companyLogo = null;
      userObj.favicon = null;
    }

    // ── 8. Resolve navTemplate ──────────────────────────────────────────
    if (role === "admin") {
      userObj.navTemplate = user.navTemplate || "sidebar";
    } else if ((role === "support-admin" || role === "employee") && user.adminId) {
      const parentAdmin = await Admin.findById(user.adminId).select("navTemplate");
      userObj.navTemplate = parentAdmin?.navTemplate || "sidebar";
    } else {
      userObj.navTemplate = "sidebar";
    }

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

    // Check Admin first, then SupportAdmin, then Employee
    let currentUser = await Admin.findById(decoded.id).select("-password").lean();
    if (currentUser) {
      currentUser.role = "admin";
      // Allow shared tenant access for created admins
      currentUser.actualId = currentUser._id;
      if (currentUser.adminId) {
        currentUser._id = currentUser.adminId;
      }
    } else {
      currentUser = await SupportAdmin.findById(decoded.id).select("-password").lean();
      if (currentUser) {
        currentUser.role = "support-admin";
        currentUser.actualId = currentUser._id;
        // Normalize employeeId for Support Admins so employee routes work properly
        currentUser.employeeId = currentUser.supportAdminId || currentUser._id;
        if (currentUser.adminId) {
          currentUser._id = currentUser.adminId;
        }
      } else {
        currentUser = await Employee.findById(decoded.id).select("-password");
        if (currentUser) {
          // preserve existing role field (e.g. "support-admin") but default to "employee"
          currentUser.role = currentUser.role || "employee";
        }
      }
    }

    if (!currentUser) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    const rootAdmin = await resolveRootAdmin(currentUser);
    const expiredPayload = await getExpiredSubscriptionPayload(rootAdmin, currentUser.role);
    if (expiredPayload) {
      return res.status(expiredPayload.status).json(expiredPayload.body);
    }

    req.user = currentUser;
    next();
  } catch (err) {
    console.error("❌ Auth middleware error:", err.message);
    return res.status(401).json({ message: "Not authorized, token invalid" });
  }
};

/* ================================================================
 * forgotPassword — POST /api/auth/forgot-password
 * ================================================================ */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if user exists
    let user = await MasterAdmin.findOne({ email: normalizedEmail });
    if (!user) user = await Admin.findOne({ email: normalizedEmail });
    if (!user) user = await SupportAdmin.findOne({ email: normalizedEmail });
    if (!user) user = await Employee.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: "User not found with this email." });
    }

    // 2. Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    // 3. Save OTP in PasswordResetOtp collection
    // Delete any existing OTPs for this email to prevent spam/confusion
    await PasswordResetOtp.deleteMany({ email: normalizedEmail });
    await PasswordResetOtp.create({
      email: normalizedEmail,
      otp: hashedOtp
    });

    // 4. Send Email
    const mailOptions = {
      from: `"HRMS Support" <${process.env.SMTP_USER}>`,
      to: normalizedEmail,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; color: #111827;">
          <div style="max-w-md; margin: 0 auto; background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); text-align: center;">
            
            <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #9333ea, #3b82f6); border-radius: 12px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>

            <h2 style="font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 16px;">Password Reset Request</h2>
            
            <p style="font-size: 16px; color: #4b5563; line-height: 1.5; margin-bottom: 32px;">
              Hello <strong>${user.name || 'User'}</strong>,<br/><br/>
              We received a request to reset the password for your account. Please use the verification code below to complete the process.
            </p>
            
            <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
              <p style="font-size: 14px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; margin-top: 0;">Verification Code</p>
              <h1 style="font-size: 42px; font-weight: 800; color: #4f46e5; letter-spacing: 8px; margin: 0;">${otp}</h1>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; line-height: 1.5; margin-bottom: 0;">
              This code is valid for <strong>10 minutes</strong>. <br/>If you did not request a password reset, you can safely ignore this email.
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
            
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">
              &copy; ${new Date().getFullYear()} HRMS System. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    await customTransporter.sendMail(mailOptions);

    return res.status(200).json({ message: "OTP sent successfully to your email." });
  } catch (err) {
    console.error("❌ Forgot Password Error:", err);
    return res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
};

/* ================================================================
 * verifyOtp — POST /api/auth/verify-otp
 * ================================================================ */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required." });

    const normalizedEmail = email.toLowerCase().trim();

    const otpRecord = await PasswordResetOtp.findOne({ email: normalizedEmail }).sort({ createdAt: -1 });
    if (!otpRecord) {
      return res.status(400).json({ message: "OTP expired or invalid." });
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otp);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    return res.status(200).json({ message: "OTP verified successfully." });
  } catch (err) {
    console.error("❌ Verify OTP Error:", err);
    return res.status(500).json({ message: "Server error during verification." });
  }
};

/* ================================================================
 * resetPassword — POST /api/auth/reset-password
 * ================================================================ */
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify OTP again just in case
    const otpRecord = await PasswordResetOtp.findOne({ email: normalizedEmail }).sort({ createdAt: -1 });
    if (!otpRecord) {
      return res.status(400).json({ message: "OTP expired or invalid." });
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otp);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    // Update user password
    let updated = false;

    const masterAdmin = await MasterAdmin.findOne({ email: normalizedEmail });
    if (masterAdmin) {
      masterAdmin.password = newPassword;
      await masterAdmin.save({ validateModifiedOnly: true });
      updated = true;
    }

    if (!updated) {
      const admin = await Admin.findOne({ email: normalizedEmail });
      if (admin) {
        admin.password = newPassword;
        await admin.save({ validateModifiedOnly: true });
        updated = true;
      }
    }

    if (!updated) {
      const supportAdmin = await SupportAdmin.findOne({ email: normalizedEmail });
      if (supportAdmin) {
        supportAdmin.password = newPassword;
        await supportAdmin.save({ validateModifiedOnly: true });
        updated = true;
      }
    }

    if (!updated) {
      const employee = await Employee.findOne({ email: normalizedEmail });
      if (employee) {
        employee.password = newPassword;
        await employee.save({ validateModifiedOnly: true });
        updated = true;
      }
    }

    if (!updated) {
      return res.status(404).json({ message: "User not found." });
    }

    // Delete the OTP record so it can't be reused
    await PasswordResetOtp.deleteMany({ email: normalizedEmail });

    return res.status(200).json({ message: "Password reset successfully." });
  } catch (err) {
    console.error("❌ Reset Password Error:", err);
    return res.status(500).json({ message: "Server error during password reset." });
  }
};
