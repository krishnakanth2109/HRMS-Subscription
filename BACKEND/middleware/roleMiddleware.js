export const onlyAdmin = (req, res, next) => {
  try {
    // If user object not found (very rare but safe check)
    if (!req.user) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    // Access allowed for admin or support-admin
    if (req.user.role !== "admin" && req.user.role !== "support-admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admin/support-admin can perform this action.",
      });
    }

    next();

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while checking permissions.",
    });
  }
};


export const onlySupportAdmin = (req, res, next) => {
  try {
    // If user object not found (very rare but safe check)
    if (!req.user) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    // Access allowed ONLY for support-admin
    if (req.user.role !== "support-admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only support-admin can perform this action.",
      });
    }

    next();

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while checking permissions.",
    });
  }
};
