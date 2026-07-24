import jwt from "jsonwebtoken";
import Admin from "../models/adminModel.js";
import SupportAdmin from "../models/supportAdminModel.js";
import { getExpiredSubscriptionPayload, resolveRootAdmin } from "../utils/subscriptionAccess.js";

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let currentUser = await Admin.findById(decoded.id).select("+role").lean();
    if (currentUser) {
      currentUser.actualId = currentUser._id;
      if (currentUser.adminId) {
        currentUser._id = currentUser.adminId;
      }
    } else {
      currentUser = await SupportAdmin.findById(decoded.id).select("+role").lean();
      if (currentUser) {
        currentUser.actualId = currentUser._id;
        if (currentUser.adminId) {
          currentUser._id = currentUser.adminId;
        }
      }
    }
    req.user = currentUser;

    if (!currentUser) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    const rootAdmin = await resolveRootAdmin(currentUser);
    const expiredPayload = await getExpiredSubscriptionPayload(rootAdmin, currentUser.role);
    if (expiredPayload) {
      return res.status(expiredPayload.status).json(expiredPayload.body);
    }

    next();
  } catch (error) {
    res.status(401).json({ message: "Not authorized" });
  }
};
