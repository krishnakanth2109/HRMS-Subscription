// --- START OF FILE controllers/authController.js ---
import Employee from "../models/employeeModel.js";
import Admin from "../models/adminModel.js";
import jwt from "jsonwebtoken";

const signToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

/* ==================== PROTECT MIDDLEWARE ==================== */
export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized. No token provided." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try Admin first
    const admin = await Admin.findById(decoded.id);
    if (admin) {
      req.user = admin;
      req.user.role = admin.role; // 'admin' or 'manager'
      return next();
    }

    // Then try Employee
    const employee = await Employee.findById(decoded.id);
    if (employee) {
      req.user = employee;
      req.user.role = employee.role; // 'employee' or 'manager'
      return next();
    }

    return res.status(401).json({ message: "User no longer exists." });

  } catch (error) {
    console.error("❌ PROTECT MIDDLEWARE ERROR:", error);
    return res.status(401).json({ message: "Not authorized. Token invalid or expired." });
  }
};

/* ==================== EMPLOYEE LOGIN WITH LOGIN ACCESS CHECK ==================== */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const employee = await Employee.findOne({ email }).select("+password");

    if (!employee) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordCorrect = await employee.correctPassword(password, employee.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    /* === EMPLOYEE LOGIN ACCESS BLOCKER === */
    if (employee.loginEnabled === false) {
      return res.status(403).json({
        message: "Your account login is stopped from admin. Please contact support team.",
        loginStopped: true,
      });
    }

    /* === CHECK PARENT ADMIN LOGIN ACCESS === */
    if (employee.adminId) {
      const parentAdmin = await Admin.findById(employee.adminId).select("loginEnabled name");
      if (parentAdmin && parentAdmin.loginEnabled === false) {
        return res.status(403).json({
          message: "Your account login is stopped from admin. Please contact support team.",
          loginStopped: true,
        });
      }
    }

    /* === INACTIVE EMPLOYEE CHECK === */
    if (!employee.isActive || employee.status === "Inactive") {
      return res.status(403).json({ message: "Your account is inactive. Please contact your admin." });
    }

    const token = signToken(employee._id, employee.role);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        employeeId: employee.employeeId,
        companyName: employee.companyName,
        companyPrefix: employee.companyPrefix,
        company: employee.company,
        adminId: employee.adminId,
      },
    });
  } catch (error) {
    console.error("❌ EMPLOYEE LOGIN ERROR:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
// --- END OF FILE controllers/authController.js ---