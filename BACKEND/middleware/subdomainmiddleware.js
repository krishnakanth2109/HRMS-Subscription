// --- START OF FILE middleware/subdomainMiddleware.js ---
import Domain from "../models/domainmodel.js";

const BASE_DOMAIN = process.env.BASE_DOMAIN || "vwsync.com";

/**
 * subdomainMiddleware
 *
 * Reads the Host header, extracts the subdomain (if any), looks it up
 * in the Domain collection, and attaches company context to req.
 *
 * req.subdomain  — e.g. "zero7"
 * req.company    — domain.companyName
 * req.adminId    — domain.adminId  (ObjectId)
 * req.domainDoc  — the full Domain document
 *
 * IMPORTANT FIXES vs previous version:
 * 1. Skip DB lookup for /api/domain/* routes — those routes manage domains
 *    themselves and must never be blocked by the middleware they depend on.
 * 2. Skip DB lookup for localhost / dev environments cleanly.
 * 3. Never block requests that have no subdomain — pass through silently.
 */
export const subdomainMiddleware = async (req, res, next) => {
  try {
    const host = req.hostname || (req.headers.host || "").split(":")[0];

    // ── Extract subdomain ─────────────────────────────────────────────────
    let subdomain = null;
    if (host && host.endsWith(`.${BASE_DOMAIN}`)) {
      subdomain = host.slice(0, -(`.${BASE_DOMAIN}`.length));
    }

    // ── No subdomain (main domain or localhost) → pass through ────────────
    if (!subdomain || subdomain === "www" || subdomain === "api") {
      return next();
    }

    // ── CRITICAL: skip DB lookup for domain management API itself ─────────
    // Without this, POST /api/domain/create would try to find "zero7" in DB
    // before it even exists, causing a 404 loop.
    if (req.originalUrl.startsWith("/api/domain")) {
      return next();
    }

    // ── Attach raw subdomain string for downstream use ────────────────────
    req.subdomain = subdomain;

    // ── Look up subdomain in DB ───────────────────────────────────────────
    const domain = await Domain.findOne({ subdomain });

    if (!domain) {
      return res.status(404).json({
        message: `No company found for subdomain "${subdomain}". Please check your URL.`,
      });
    }

    if (!domain.isActive) {
      return res.status(403).json({
        message: `The portal "${subdomain}.${BASE_DOMAIN}" has been disabled. Contact support.`,
        subdomain,
      });
    }

    // ── Attach company context ────────────────────────────────────────────
    req.company   = domain.companyName;
    req.adminId   = domain.adminId;
    req.domainDoc = domain;

    next();
  } catch (error) {
    console.error("❌ SUBDOMAIN MIDDLEWARE ERROR:", error);
    return res.status(500).json({ message: "Server error resolving subdomain." });
  }
};

/**
 * requireSubdomain
 * Guard for routes that must come from a company subdomain.
 */
export const requireSubdomain = (req, res, next) => {
  if (!req.subdomain) {
    return res.status(400).json({
      message: "This route must be accessed via your company portal (e.g. https://yourcompany.vwsync.com).",
    });
  }
  next();
};

/**
 * validateUserBelongsToSubdomain
 * Run AFTER protect() — confirms the JWT user belongs to this company.
 * Admin:    req.user._id  === req.adminId
 * Employee: req.user.adminId === req.adminId
 */
export const validateUserBelongsToSubdomain = (req, res, next) => {
  if (!req.subdomain) return next(); // not a subdomain request, skip

  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated." });
  }

  const userAdminId =
    req.user.role === "admin"
      ? req.user._id.toString()
      : req.user.adminId?.toString();

  if (!userAdminId || userAdminId !== req.adminId?.toString()) {
    return res.status(403).json({
      message: "Access denied. You do not belong to this company portal.",
    });
  }

  next();
};
// --- END OF FILE middleware/subdomainMiddleware.js ---
