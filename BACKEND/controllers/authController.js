// --- START OF FILE controllers/authController.js ---

import { promisify } from "util";
import jwt from "jsonwebtoken";
import Admin from "../models/adminModel.js";
import Employee from "../models/employeeModel.js";

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

export const login = async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Please provide both email and password." });
  }

  try {
    // 1. Check Admin
    let user = await Admin.findOne({ email }).select("+password");
    let role = "admin";

    // 2. Check Employee if not Admin
    if (!user) {
      user = await Employee.findOne({ email }).select("+password");
      role = "employee";
    }

    // 3. Verify User and Password
    if (!user || !(await user.correctPassword(password, user.password))) {
      return res.status(401).json({ message: "Incorrect email or password." });
    }

    // ✅ 4. CHECK IF ACCOUNT IS DEACTIVATED
    // Logic: If user is an employee and isActive is false
    if (role === "employee" && user.isActive === false) {
      return res.status(403).json({ 
        message: "Your account is Deactivate please contact supprt team" 
      });
    }

    // 5. Generate Token
    const token = signToken(user._id);
    user.password = undefined;

    res.status(200).json({
      status: "success",
      token,
      data: { ...user.toObject(), role: role },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  }
};

// Protect Middleware
export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "You are not logged in! Please log in to get access." });
  }

  try {
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    let currentUser = await Admin.findById(decoded.id);
    if (!currentUser) {
        currentUser = await Employee.findById(decoded.id);
    }
    
    if (!currentUser) {
        return res.status(401).json({ message: "The user belonging to this token no longer exists." });
    }
    
    // Optional: Check if user was deactivated while logged in
    if (currentUser.isActive === false) {
       return res.status(401).json({ message: "User is deactivated." });
    }

    req.user = currentUser;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token. Please log in again." });
  }
};
// --- END OF FILE controllers/authController.js ---