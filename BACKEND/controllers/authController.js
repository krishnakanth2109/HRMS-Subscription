// --- START OF FILE controllers/authController.js ---

import { promisify } from "util";
import jwt from "jsonwebtoken";
import Admin from "../models/adminModel.js";
import Employee from "../models/employeeModel.js";

// Create JWT
const signToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// ----------------------------------------------
// LOGIN CONTROLLER
// ----------------------------------------------
export const login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Please provide both email and password." });

  try {
    let user = null;
    let role = null;

    // 1️⃣ CHECK ADMIN 
    user = await Admin.findOne({ email }).select("+password +role");
    if (user) {
      role = user.role; // "admin" or "manager"
    }

    // 2️⃣ IF NOT ADMIN → CHECK EMPLOYEE
    if (!user) {
      // Vital: Populate company info to return to frontend if needed
      user = await Employee.findOne({ email }).select("+password");
      if (user) role = "employee";
    }

    // 3️⃣ VERIFY PASSWORD
    if (!user || !(await user.correctPassword(password, user.password))) {
      return res.status(401).json({ message: "Incorrect email or password." });
    }

    // 4️⃣ BLOCK DEACTIVATED
    if (role === "employee" && user.isActive === false) {
      return res.status(403).json({ message: "Account deactivated. Contact HR." });
    }

    // 5️⃣ TOKEN
    const token = signToken(user._id, role);
    user.password = undefined;

    return res.status(200).json({
      status: "success",
      token,
      data: {
        ...user.toObject(),
        role: role,
        // For Employees, frontend might need these to know which context they are in
        companyId: user.company, 
        adminId: user.adminId
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// ----------------------------------------------
// PROTECT MIDDLEWARE
// ----------------------------------------------
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token)
    return res.status(401).json({ message: "Not logged in." });

  try {
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 1️⃣ Check Admin
    let currentUser = await Admin.findById(decoded.id).select("+role");

    // 2️⃣ Check Employee (If not Admin)
    if (!currentUser) {
      // CRITICAL: We need adminId and companyId for almost every controller
      currentUser = await Employee.findById(decoded.id); 
    }

    if (!currentUser) {
      return res.status(401).json({ message: "User no longer exists." });
    }

    // 3️⃣ Check Deactivation
    if (currentUser.isActive === false) {
      return res.status(401).json({ message: "User is deactivated." });
    }

    req.user = currentUser; 
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token." });
  }
};