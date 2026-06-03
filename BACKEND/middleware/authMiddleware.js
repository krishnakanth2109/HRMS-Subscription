// middleware/authMiddleware.js
import { promisify } from "util";
import jwt from "jsonwebtoken";
import Admin from "../models/adminModel.js";
import SupportAdmin from "../models/supportAdminModel.js";
import Employee from "../models/employeeModel.js";
import { getExpiredSubscriptionPayload, resolveRootAdmin } from "../utils/subscriptionAccess.js";

/*
  PROTECT MIDDLEWARE
  - validates JWT
  - loads Admin OR Employee into req.user
  - attaches user.role = "admin" or "employee"
*/
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res
      .status(401)
      .json({ message: "Not authorized, no token provided" });
  }

  try {
    const decoded = await promisify(jwt.verify)(
      token,
      process.env.JWT_SECRET
    );

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
        if (currentUser.adminId) {
          currentUser._id = currentUser.adminId;
        }
      } else {
        currentUser = await Employee.findById(decoded.id).select("-password");
        if (currentUser) {
          currentUser.role = "employee";
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
  } catch (error) {
    console.error("Token verification error:", error.message);
    return res.status(401).json({ message: "Not authorized, token invalid" });
  }
};

/*
  Optional: Restrict route to roles:
  router.get('/admin-only', protect, restrictTo('admin'), controller)
*/
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "You do not have permission for this action" });
    }
    next();
  };
};
