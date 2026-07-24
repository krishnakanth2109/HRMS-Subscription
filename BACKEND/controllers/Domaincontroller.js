// --- START OF FILE controllers/domainController.js ---
// import Domain from "../models/domainModel.js";
import Admin from "../models/adminModel.js";

/* ==================== VALIDATION HELPER ==================== */
const isValidSubdomain = (value) => {
  // lowercase, alphanumeric + hyphens, no leading/trailing hyphens, 1–63 chars
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
};

/* ==================== CREATE SUBDOMAIN ==================== */
// POST /api/domain/create
// Protected — admin only
export const createDomain = async (req, res) => {
  try {
    const { subdomain } = req.body;

    if (!subdomain) {
      return res.status(400).json({ message: "Subdomain is required." });
    }

    const normalised = subdomain.toLowerCase().trim();

    /* --- Validate format --- */
    if (!isValidSubdomain(normalised)) {
      return res.status(400).json({
        message:
          "Invalid subdomain. Use only lowercase letters, numbers, and hyphens. It cannot start or end with a hyphen.",
      });
    }

    /* --- Check for spaces (extra safety) --- */
    if (/\s/.test(normalised)) {
      return res.status(400).json({ message: "Subdomain must not contain spaces." });
    }

    /* --- Reserved keywords --- */
    const reserved = ["www", "api", "mail", "ftp", "admin", "app", "dashboard", "static", "cdn"];
    if (reserved.includes(normalised)) {
      return res.status(400).json({ message: `"${normalised}" is a reserved subdomain and cannot be used.` });
    }

    /* --- One domain per admin --- */
    const existingAdminDomain = await Domain.findOne({ adminId: req.user._id });
    if (existingAdminDomain) {
      return res.status(409).json({
        message: "You already have a subdomain. Please update or delete the existing one.",
        existing: existingAdminDomain.subdomain,
      });
    }

    /* --- Global uniqueness check --- */
    const taken = await Domain.findOne({ subdomain: normalised });
    if (taken) {
      return res.status(409).json({ message: `Subdomain "${normalised}" is already taken.` });
    }

    /* --- Fetch companyName from Admin model --- */
    const admin = await Admin.findById(req.user._id).select("name");
    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    const domain = await Domain.create({
      companyName: admin.name,
      subdomain: normalised,
      adminId: req.user._id,
      isActive: true,
    });

    return res.status(201).json({
      message: "Subdomain created successfully.",
      domain: {
        id: domain._id,
        companyName: domain.companyName,
        subdomain: domain.subdomain,
        fullUrl: `https://${domain.subdomain}.vwsync.com`,
        isActive: domain.isActive,
        createdAt: domain.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ CREATE DOMAIN ERROR:", error);
    // Handle Mongoose duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({ message: "Subdomain is already taken." });
    }
    return res.status(500).json({ message: "Failed to create subdomain." });
  }
};

/* ==================== GET MY DOMAIN ==================== */
// GET /api/domain/my-domain
// Protected — logged-in admin
export const getMyDomain = async (req, res) => {
  try {
    const domain = await Domain.findOne({ adminId: req.user._id });

    if (!domain) {
      return res.status(404).json({ message: "No subdomain found for your account." });
    }

    return res.status(200).json({
      id: domain._id,
      companyName: domain.companyName,
      subdomain: domain.subdomain,
      fullUrl: `https://${domain.subdomain}.vwsync.com`,
      isActive: domain.isActive,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    });
  } catch (error) {
    console.error("❌ GET MY DOMAIN ERROR:", error);
    return res.status(500).json({ message: "Failed to fetch domain." });
  }
};

/* ==================== UPDATE SUBDOMAIN ==================== */
// PUT /api/domain/update
// Protected — logged-in admin
export const updateDomain = async (req, res) => {
  try {
    const { subdomain } = req.body;

    if (!subdomain) {
      return res.status(400).json({ message: "New subdomain is required." });
    }

    const normalised = subdomain.toLowerCase().trim();

    if (!isValidSubdomain(normalised)) {
      return res.status(400).json({
        message:
          "Invalid subdomain. Use only lowercase letters, numbers, and hyphens. It cannot start or end with a hyphen.",
      });
    }

    /* --- Reserved check --- */
    const reserved = ["www", "api", "mail", "ftp", "admin", "app", "dashboard", "static", "cdn"];
    if (reserved.includes(normalised)) {
      return res.status(400).json({ message: `"${normalised}" is a reserved subdomain.` });
    }

    /* --- Find admin's domain --- */
    const existing = await Domain.findOne({ adminId: req.user._id });
    if (!existing) {
      return res.status(404).json({ message: "No domain found to update. Please create one first." });
    }

    /* --- Skip uniqueness check if same value --- */
    if (existing.subdomain !== normalised) {
      const taken = await Domain.findOne({ subdomain: normalised });
      if (taken) {
        return res.status(409).json({ message: `Subdomain "${normalised}" is already taken.` });
      }
    }

    existing.subdomain = normalised;
    await existing.save();

    return res.status(200).json({
      message: "Subdomain updated successfully.",
      domain: {
        id: existing._id,
        companyName: existing.companyName,
        subdomain: existing.subdomain,
        fullUrl: `https://${existing.subdomain}.vwsync.com`,
        isActive: existing.isActive,
        updatedAt: existing.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ UPDATE DOMAIN ERROR:", error);
    if (error.code === 11000) {
      return res.status(409).json({ message: "Subdomain is already taken." });
    }
    return res.status(500).json({ message: "Failed to update subdomain." });
  }
};

/* ==================== SOFT DELETE / DISABLE DOMAIN ==================== */
// DELETE /api/domain/disable
// Protected — logged-in admin (soft delete via isActive = false)
export const disableDomain = async (req, res) => {
  try {
    const domain = await Domain.findOne({ adminId: req.user._id });

    if (!domain) {
      return res.status(404).json({ message: "No domain found for your account." });
    }

    if (!domain.isActive) {
      return res.status(400).json({ message: "Domain is already inactive." });
    }

    domain.isActive = false;
    await domain.save();

    return res.status(200).json({
      message: "Domain has been disabled (soft deleted). Access via this subdomain is now blocked.",
      subdomain: domain.subdomain,
    });
  } catch (error) {
    console.error("❌ DISABLE DOMAIN ERROR:", error);
    return res.status(500).json({ message: "Failed to disable domain." });
  }
};

/* ==================== RE-ENABLE DOMAIN ==================== */
// PATCH /api/domain/enable
// Protected — logged-in admin
export const enableDomain = async (req, res) => {
  try {
    const domain = await Domain.findOne({ adminId: req.user._id });

    if (!domain) {
      return res.status(404).json({ message: "No domain found for your account." });
    }

    if (domain.isActive) {
      return res.status(400).json({ message: "Domain is already active." });
    }

    domain.isActive = true;
    await domain.save();

    return res.status(200).json({
      message: "Domain re-enabled successfully.",
      domain: {
        id: domain._id,
        subdomain: domain.subdomain,
        fullUrl: `https://${domain.subdomain}.vwsync.com`,
        isActive: domain.isActive,
      },
    });
  } catch (error) {
    console.error("❌ ENABLE DOMAIN ERROR:", error);
    return res.status(500).json({ message: "Failed to enable domain." });
  }
};

/* ==================== CHECK SUBDOMAIN AVAILABILITY (public) ==================== */
// GET /api/domain/check/:subdomain
// Public — no auth needed (for real-time availability check in UI)
export const checkSubdomainAvailability = async (req, res) => {
  try {
    const { subdomain } = req.params;
    const normalised = subdomain.toLowerCase().trim();

    if (!isValidSubdomain(normalised)) {
      return res.status(200).json({ available: false, reason: "Invalid format." });
    }

    const reserved = ["www", "api", "mail", "ftp", "admin", "app", "dashboard", "static", "cdn"];
    if (reserved.includes(normalised)) {
      return res.status(200).json({ available: false, reason: "Reserved subdomain." });
    }

    const taken = await Domain.findOne({ subdomain: normalised });
    return res.status(200).json({ available: !taken });
  } catch (error) {
    console.error("❌ CHECK AVAILABILITY ERROR:", error);
    return res.status(500).json({ message: "Failed to check availability." });
  }
};
// --- END OF FILE controllers/domainController.js ---