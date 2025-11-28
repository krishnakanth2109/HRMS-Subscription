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
    return res.status(400).json({
      message: "Please provide both email and password.",
    });

  try {
    let user = null;
    let role = null;

    // 1️⃣ CHECK ADMIN (includes manager)
    user = await Admin.findOne({ email }).select("+password +role");
    if (user) {
      role = user.role; // "admin" or "manager"
    }

    // 2️⃣ IF NOT ADMIN → CHECK EMPLOYEE
    if (!user) {
      user = await Employee.findOne({ email }).select("+password");
      if (user) role = "employee";
    }

    // 3️⃣ USER NOT FOUND OR PASSWORD WRONG
    if (!user || !(await user.correctPassword(password, user.password))) {
      return res
        .status(401)
        .json({ message: "Incorrect email or password." });
    }

    // 4️⃣ BLOCK DEACTIVATED EMPLOYEES
    if (role === "employee" && user.isActive === false) {
      return res.status(403).json({
        message: "Your account is deactivated. Please contact support team.",
      });
    }

    // 5️⃣ CREATE TOKEN WITH ROLE
    const token = signToken(user._id, role);
    user.password = undefined;

    return res.status(200).json({
      status: "success",
      token,
      data: {
        ...user.toObject(),
        role: role, // Include user role in response
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res
      .status(500)
      .json({ message: "An internal server error occurred." });
  }
};

// ----------------------------------------------
// PROTECT MIDDLEWARE
// ----------------------------------------------
export const protect = async (req, res, next) => {
  let token;

  // 1️⃣ Extract token
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token)
    return res.status(401).json({
      message: "You are not logged in! Please log in to get access.",
    });

  try {
    // 2️⃣ Verify token
    const decoded = await promisify(jwt.verify)(
      token,
      process.env.JWT_SECRET
    );

    // decoded contains: { id, role, iat, exp }

    // 3️⃣ Check in Admin collection
    let currentUser = await Admin.findById(decoded.id).select("+role");

    // 4️⃣ If not admin → check employee
    if (!currentUser) {
      currentUser = await Employee.findById(decoded.id);
    }

    if (!currentUser) {
      return res.status(401).json({
        message:
          "The user belonging to this token no longer exists.",
      });
    }

    // 5️⃣ Block deactivated employees
    if (currentUser.isActive === false) {
      return res.status(401).json({ message: "User is deactivated." });
    }

    // 6️⃣ Attach user to request
    req.user = currentUser; // includes role for admin/manager

    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Invalid token. Please log in again." });
  }
};

// --- END OF FILE controllers/authController.js ---
