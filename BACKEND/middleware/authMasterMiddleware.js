// --- START OF FILE middleware/authMasterMiddleware.js ---
import jwt from "jsonwebtoken";
import MasterAdmin from "../models/MasterAdmin.js";

export const protectMaster = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get Master User
      req.master = await MasterAdmin.findById(decoded.id).select("-password");

      if (!req.master) {
        return res.status(401).json({ message: "Not authorized as Master" });
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};
// --- END OF FILE middleware/authMasterMiddleware.js ---