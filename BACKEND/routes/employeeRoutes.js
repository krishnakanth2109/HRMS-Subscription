// --- START OF FILE: routes/employeeRoutes.js ---

import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import PDFDocument from "pdfkit";
import axios from "axios";
import jwt from "jsonwebtoken";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const archiver = require("archiver");
import Employee from "../models/employeeModel.js";
import Company from "../models/CompanyModel.js";
import Notification from "../models/notificationModel.js";
import InvitedEmployee from "../models/Invitedemployee.js";
import { upload } from "../config/cloudinary.js";
import { generateAndUploadQRCode } from "../utils/qrCodeHelper.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import Admin from "../models/adminModel.js";
import PlanSetting from "../models/planSettingModel.js";
import SupportAdmin from "../models/supportAdminModel.js";

const router = express.Router();

const checkUserLimit = async (adminId) => {
  const admin = await Admin.findById(adminId);
  if (!admin) return { allowed: true };

  // If the admin is on the Owner plan or is unlimited, they have unlimited user limit!
  const hasUnlimitedPlan =
    admin.planDetails?.isUnlimited ||
    admin.plan?.toLowerCase() === 'owner';

  if (hasUnlimitedPlan) {
    return { allowed: true };
  }

  // Check planSetting fallback for unmigrated admins
  if (!admin.planDetails || !admin.planDetails.planName) {
    const planSetting = await PlanSetting.findOne({ planName: admin.plan });
    if (planSetting && (planSetting.isOwnerPlan || planSetting.isUnlimited)) {
      return { allowed: true };
    }
  }

  let maxUsers = 30;
  let planName = admin.plan || "Free";

  if (admin.planDetails && admin.planDetails.planName) {
    maxUsers = admin.planDetails.maxUsers;
    planName = admin.planDetails.planName;
  } else {
    // Fallback logic for unmigrated admin
    maxUsers = admin.userLimit || null;
    if (maxUsers === null) {
      const planSetting = await PlanSetting.findOne({ planName: admin.plan });

      if (planSetting && planSetting.maxUsers) {
        maxUsers = planSetting.maxUsers;
      } else if (admin.plan === 'Free' || admin.plan === 'Free Trail' || admin.plan?.toLowerCase()?.includes('free')) {
        // Fallback for free plans if no setting exists
        const freeSetting = await PlanSetting.findOne({ planName: 'Free' });
        maxUsers = freeSetting ? freeSetting.maxUsers : 30;
      } else {
        maxUsers = 30;
      }
    }
  }

  // Sum active addon limits (only those that are paid and not yet expired)
  const now = new Date();

  // Use razorpay details from planDetails if available, otherwise from top-level
  const currentRazorpayPaymentId = admin.planDetails?.razorpayPaymentId || admin.razorpayPaymentId;
  const currentRazorpayOrderId = admin.planDetails?.razorpayOrderId || admin.razorpayOrderId;

  const activeAddonTotal = (admin.limitAddons || []).reduce((sum, addon) => {
    const alreadyMainBilled =
      (addon.razorpayPaymentId && currentRazorpayPaymentId && addon.razorpayPaymentId === currentRazorpayPaymentId) ||
      (addon.razorpayOrderId && currentRazorpayOrderId && addon.razorpayOrderId === currentRazorpayOrderId);

    if (addon.isPaid && !addon.mergedIntoMainPlan && !alreadyMainBilled && addon.expiresAt && new Date(addon.expiresAt) > now) {
      return sum + (addon.addonLimit || 0);
    }
    return sum;
  }, 0);

  const effectiveLimit = (maxUsers || 0) + activeAddonTotal;

  if (effectiveLimit > 0) {
    const currentEmployeeCount = await Employee.countDocuments({ adminId });
    const currentSupportAdminCount = await SupportAdmin.countDocuments({ adminId });
    const totalCount = currentEmployeeCount + currentSupportAdminCount; // Admin is account owner and does not count toward user limit
    if (totalCount >= effectiveLimit) {
      return {
        allowed: false,
        limit: effectiveLimit,
        plan: planName
      };
    }
  }
  return { allowed: true };
}

// Multer memory storage for onboarding (direct-to-cloudinary buffer uploads)
const memoryUpload = multer({ storage: multer.memoryStorage() });

/* ================================================================
 * 🔢 SHARED HELPER — finds the highest numeric serial in the DB
 *    for a given company prefix, then returns prefix + (max + 1).
 *
 *    Rules:
 *    - Only IDs that START WITH the exact prefix are considered.
 *    - Only the numeric part after the prefix is extracted.
 *    - Non-numeric suffixes (e.g. "A78745") are ignored.
 *    - The result is always prefix + zero-padded number (min 2 digits).
 *
 *    Examples:
 *      DB has ARAH01, ARAH05, ARAH10  → next = ARAH11
 *      DB has ARAH01, A78745          → next = ARAH02 (A78745 ignored)
 *      DB is empty                    → next = ARAH01
 * ================================================================ */
const getNextSerialId = async (companyId, prefix) => {
  const employees = await Employee.find({ company: companyId }, "employeeId");

  let maxNum = 0;
  for (const emp of employees) {
    if (emp.employeeId && emp.employeeId.startsWith(prefix)) {
      const numPart = emp.employeeId.slice(prefix.length);
      const num = parseInt(numPart, 10);
      // Only count it if the entire suffix is a pure integer (no extra chars)
      if (!isNaN(num) && String(num) === numPart.replace(/^0+/, "") || numPart === "0") {
        if (num > maxNum) maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  // Keep at least 2-digit padding (ARAH01, ARAH10, ARAH100…)
  const padded = String(nextNum).padStart(2, "0");
  return `${prefix}${padded}`;
};

/* ==============================================================
 📁 1. FILE UPLOAD ROUTE
============================================================== */
router.post("/upload-doc", protect, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    res.status(200).json({ url: req.file.path });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ==============================================================
 🔢 NEXT EMPLOYEE ID — called by AddEmployee.jsx on company select
    GET /api/employees/next-id/:companyId
============================================================== */
router.get("/next-id/:companyId", protect, onlyAdmin, async (req, res) => {
  try {
    const company = await Company.findOne({
      _id: req.params.companyId,
      adminId: req.user._id,
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found or unauthorized" });
    }

    const nextEmployeeId = await getNextSerialId(req.params.companyId, company.prefix);

    res.json({ nextEmployeeId });
  } catch (err) {
    console.error("❌ Next ID error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ==============================================================
 🚀 2. EMPLOYEE ONBOARDING (Public — no auth, invited employee self-registers)
============================================================== */

router.post(
  "/onboard",
  memoryUpload.fields([
    { name: "aadhaarCard", maxCount: 1 },
    { name: "panCard", maxCount: 1 },
    { name: "companyDocuments" },
  ]),
  async (req, res) => {
    try {
      // ── Log received files ────────────────────────────────────────
      console.log("========== ONBOARD REQUEST ==========");
      console.log("Received files:", {
        aadhaarCard: req.files?.["aadhaarCard"]
          ? req.files["aadhaarCard"].length
          : 0,
        panCard: req.files?.["panCard"] ? req.files["panCard"].length : 0,
        companyDocuments: req.files?.["companyDocuments"]
          ? req.files["companyDocuments"].length
          : 0,
      });

      // ── 1. Parse JSON payload ─────────────────────────────────────
      if (!req.body.jsonData) {
        return res.status(400).json({ error: "No form data received" });
      }

      const data = JSON.parse(req.body.jsonData);
      console.log("Company ID from payload:", data.company);
      console.log("Email from payload:", data.email);

      // ── 2. Validate company ───────────────────────────────────────
      const company = await Company.findById(data.company);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // ── 3. Derive adminId from company ──────────────────────────
      const adminId = company.adminId;
      if (!adminId) {
        return res.status(400).json({ error: "Company has no associated admin" });
      }

      // ── 3.5 Check Plan Limits ───────────────────────────────────
      const limitCheck = await checkUserLimit(adminId);
      if (!limitCheck.allowed) {
        return res.status(403).json({ error: `User limit reached for your ${limitCheck.plan} plan (Max: ${limitCheck.limit} users). Please ask your admin to upgrade the plan.` });
      }

      // ── 4. Verify the employee was actually invited ───────────────
      if (!data.email) {
        return res.status(400).json({ error: "Email is required for onboarding" });
      }

      const invite = await InvitedEmployee.findOne({
        email: data.email.toLowerCase().trim(),
        company: data.company,
      });

      if (!invite) {
        return res.status(403).json({
          error: "No active invitation found for this email in the given company",
        });
      }

      if (invite.status === "revoked") {
        return res.status(403).json({ error: "Your invitation has been revoked" });
      }

      // ── 5. Generate Employee ID using smart serial logic ──────────
      const employeeId = await getNextSerialId(data.company, company.prefix);
      console.log("Generated Employee ID:", employeeId);

      // ── 6. Build employee object ──────────────────────────────────
      const newEmployeeData = {
        ...data,
        employeeId,
        adminId,
        company: data.company,
        companyName: company.name,
        companyPrefix: company.prefix,
        role: "employee",
        isActive: true,
        status: "Active",
        personalDetails: {
          ...data.personalDetails,
          aadhaarFileUrl: null,
          panFileUrl: null,
        },
        companyDocuments: [],
      };

      // ── 7. Upload Aadhaar Card → Cloudinary ──────────────────────
      if (req.files && req.files["aadhaarCard"] && req.files["aadhaarCard"][0]) {
        const file = req.files["aadhaarCard"][0];
        console.log("Processing Aadhaar Card:", file.originalname);

        try {
          const b64 = Buffer.from(file.buffer).toString("base64");
          const dataURI = "data:" + file.mimetype + ";base64," + b64;

          const uploadResult = await cloudinary.uploader.upload(dataURI, {
            folder: "hrms_employee_documents/aadhaar",
            resource_type: "image",
            public_id: `aadhaar_${Date.now()}_${file.originalname.replace(/\.[^/.]+$/, "")}`,
            format: file.originalname.split(".").pop(),
          });

          newEmployeeData.personalDetails.aadhaarFileUrl = uploadResult.secure_url;
          console.log("✅ Aadhaar uploaded to Cloudinary:", uploadResult.secure_url);
        } catch (uploadError) {
          console.error("❌ Aadhaar upload failed:", uploadError);
          return res.status(500).json({
            error: "Failed to upload Aadhaar card",
            details: uploadError.message,
          });
        }
      } else {
        console.warn("⚠️ No Aadhaar Card file received");
        return res.status(400).json({ error: "Aadhaar card is required" });
      }

      // ── 8. Upload PAN Card → Cloudinary ──────────────────────────
      if (req.files && req.files["panCard"] && req.files["panCard"][0]) {
        const file = req.files["panCard"][0];
        console.log("Processing PAN Card:", file.originalname);

        try {
          const b64 = Buffer.from(file.buffer).toString("base64");
          const dataURI = "data:" + file.mimetype + ";base64," + b64;

          const uploadResult = await cloudinary.uploader.upload(dataURI, {
            folder: "hrms_employee_documents/pan",
            resource_type: "image",
            public_id: `pan_${Date.now()}_${file.originalname.replace(/\.[^/.]+$/, "")}`,
            format: file.originalname.split(".").pop(),
          });

          newEmployeeData.personalDetails.panFileUrl = uploadResult.secure_url;
          console.log("✅ PAN uploaded to Cloudinary:", uploadResult.secure_url);
        } catch (uploadError) {
          console.error("❌ PAN upload failed:", uploadError);
          return res.status(500).json({
            error: "Failed to upload PAN card",
            details: uploadError.message,
          });
        }
      } else {
        console.warn("⚠️ No PAN Card file received");
        return res.status(400).json({ error: "PAN card is required" });
      }

      // ── 9. Upload Company Documents (PDF/DOCX/images) → Cloudinary ──
      if (req.files && req.files["companyDocuments"] && req.files["companyDocuments"].length > 0) {
        console.log(`Processing ${req.files["companyDocuments"].length} company documents`);

        for (const file of req.files["companyDocuments"]) {
          try {
            console.log(`Uploading ${file.originalname} to Cloudinary...`);

            const b64 = Buffer.from(file.buffer).toString("base64");
            const dataURI = "data:" + file.mimetype + ";base64," + b64;

            const resourceType = file.mimetype.startsWith("image/") ? "image" : "raw";

            const uploadResult = await cloudinary.uploader.upload(dataURI, {
              folder: "hrms_employee_documents/company",
              resource_type: resourceType,
              public_id: `${Date.now()}_${file.originalname.replace(/\.[^/.]+$/, "")}`,
              format: file.originalname.split(".").pop(),
            });

            newEmployeeData.companyDocuments.push({
              fileName: file.originalname,
              fileUrl: uploadResult.secure_url,
              uploadedAt: new Date(),
              fileType: file.mimetype,
              fileSize: file.size,
            });

            console.log(`✅ Uploaded ${file.originalname}: ${uploadResult.secure_url}`);
          } catch (uploadError) {
            console.error(`❌ Error uploading ${file.originalname}:`, uploadError);
            return res.status(500).json({
              error: `Failed to upload document: ${file.originalname}`,
              details: uploadError.message,
            });
          }
        }
      }

      // ── 10. Final URL validation ─────────────────────────────────
      if (!newEmployeeData.personalDetails.aadhaarFileUrl) {
        return res.status(400).json({ error: "Aadhaar card upload failed — URL missing" });
      }
      if (!newEmployeeData.personalDetails.panFileUrl) {
        return res.status(400).json({ error: "PAN card upload failed — URL missing" });
      }

      // ── 11. Save employee to DB ───────────────────────────────────
      console.log("Saving employee to database...");
      console.log("Aadhaar URL:", newEmployeeData.personalDetails.aadhaarFileUrl);
      console.log("PAN URL:", newEmployeeData.personalDetails.panFileUrl);
      console.log("Company Documents:", newEmployeeData.companyDocuments.length);
      console.log("adminId:", adminId);
      console.log("company:", data.company);

      const employee = new Employee(newEmployeeData);
      const result = await employee.save();

      // ── Generate QR Code ──────────────────────────────────────────
      try {
        const qrUrl = await generateAndUploadQRCode(result, result.company);
        if (qrUrl) {
          result.qrCodeUrl = qrUrl;
          await result.save();
        }
      } catch (qrErr) {
        console.error("❌ QR Code generation failed during onboarding:", qrErr);
      }

      // ── 12. Sync company employee count ──────────────────────────
      company.employeeCount = await Employee.countDocuments({ company: data.company });
      await company.save();

      console.log(`✅ Employee onboarded successfully: ${result.employeeId}`);
      console.log("======================================");

      res.status(201).json({
        success: true,
        message: "Onboarding successful",
        employeeId: result.employeeId,
      });
    } catch (err) {
      console.error("❌ Onboarding error:", err);
      console.error("Error stack:", err.stack);

      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
          error: `Duplicate value for ${field}. This email may already be registered.`,
          field,
        });
      }

      res.status(500).json({
        success: false,
        error: "Internal Server Error",
        message: err.message,
      });
    }
  }
);

/* ==============================================================
 👤 3. EMPLOYEE CRUD
============================================================== */

// CREATE employee → ADMIN ONLY
router.post("/", protect, onlyAdmin, async (req, res) => {
  try {
    const limitCheck = await checkUserLimit(req.user._id);
    if (!limitCheck.allowed) {
      return res.status(403).json({ error: `User limit reached for your ${limitCheck.plan} plan (Max: ${limitCheck.limit} users). Please upgrade your plan to add more users.` });
    }

    if (req.body.company) {
      const company = await Company.findOne({
        _id: req.body.company,
        adminId: req.user._id,
      });

      if (!company) {
        return res.status(404).json({ error: "Company not found or unauthorized" });
      }

      // ✅ If admin provided a custom employeeId (editable field), use it as-is.
      // Otherwise auto-generate using the smart max-serial logic.
      if (!req.body.employeeId || !req.body.employeeId.trim()) {
        req.body.employeeId = await getNextSerialId(req.body.company, company.prefix);
      }

      // Sync company count
      const currentCount = await Employee.countDocuments({ company: req.body.company });
      company.employeeCount = currentCount + 1;
      await company.save();
    }

    // Inject Admin ID
    req.body.adminId = req.user._id;

    const employee = new Employee(req.body);
    const result = await employee.save();

    // ── Generate QR Code ──────────────────────────────────────────
    try {
      const qrUrl = await generateAndUploadQRCode(result, result.company);
      if (qrUrl) {
        result.qrCodeUrl = qrUrl;
        await result.save();
      }
    } catch (qrErr) {
      console.error("❌ QR Code generation failed during employee creation:", qrErr);
    }

    res.status(201).json(result);
  } catch (err) {
    console.error("❌ Employee creation error:", err);

    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        error: `Duplicate value entered for ${field}. Please use a different one.`,
        field: field,
      });
    }

    res.status(500).json({
      error: err.message,
      details: err.errors
        ? Object.keys(err.errors).map((key) => err.errors[key].message)
        : undefined,
    });
  }
});

// GET all employees (Scoped)
router.get("/", protect, async (req, res) => {
  try {
    const query =
      (req.user.role === "admin" || req.user.role === "support-admin")
        ? { adminId: req.user._id }
        : { company: req.user.company };

    const employees = await Employee.find(query);
    res.status(200).json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==============================================================
 🌐 PUBLIC PORTFOLIO DATA (No Auth Required)
 ============================================================== */
router.get("/portfolio/:id", async (req, res) => {
  try {
    let employee = await Employee.findOne({ employeeId: req.params.id })
      .select("employeeId name email phone phoneNumber personalDetails role currentRole experienceDetails companyName profileImageUrl portfolioBackgroundImageUrl bio customPortfolioFields socialLinks isActive status adminId department")
      .populate("adminId", "companyLogo portfolio")
      .lean();

    if (!employee) {
      const supportAdmin = await SupportAdmin.findOne({ supportAdminId: req.params.id })
        .select("supportAdminId name email phone role department profileImageUrl portfolioBackgroundImageUrl bio customPortfolioFields socialLinks isActive status adminId experienceDetails")
        .populate("adminId", "companyLogo portfolio")
        .lean();

      if (supportAdmin) {
        employee = {
          ...supportAdmin,
          employeeId: supportAdmin.supportAdminId,
          companyName: "Administration", // Default for SupportAdmin
        };
      }
    }

    if (!employee) {
      return res.status(404).json({ message: "Employee/SupportAdmin not found" });
    }

    // Since SupportAdmin schema might not have isActive / status explicitly, we should handle it
    if (employee.isActive === false || employee.status === "Inactive") {
      return res.status(404).json({ message: "Portfolio unavailable" });
    }

    // Determine the best job role to display
    let jobRole = employee.currentRole;
    if (!jobRole && employee.experienceDetails?.length > 0) {
      const currExp = employee.experienceDetails.find(e => e.lastWorkingDate === "Present" || !e.lastWorkingDate);
      jobRole = currExp?.role || employee.experienceDetails[employee.experienceDetails.length - 1].role;
    }

    employee.role = jobRole || employee.role || "Professional";
    employee.companyLogo = employee.adminId?.companyLogo || null;
    employee.portfolioTheme = employee.adminId?.portfolio || "default";

    // Clean up internal fields
    delete employee.adminId;
    delete employee.experienceDetails;
    delete employee.currentRole;

    res.status(200).json(employee);
  } catch (err) {
    console.error("❌ Fetch portfolio error:", err);
    res.status(500).json({ error: "Failed to fetch portfolio data" });
  }
});

// GET employee by ID
router.get("/:id", protect, async (req, res) => {
  try {
    const employee = await Employee.findOne({ employeeId: req.params.id });
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    if (
      req.user.role !== "admin" &&
      req.user.role !== "support-admin" &&
      req.user.employeeId !== req.params.id
    ) {
      if (req.user.company.toString() !== employee.company.toString())
        return res.status(403).json({ message: "Forbidden" });
    }

    res.status(200).json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE employee
router.put("/:id", protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin" || req.user.role === "support-admin";
    const isSelf = req.user.employeeId === req.params.id;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ message: "Not authorized to update this profile" });
    }

    const query = { employeeId: req.params.id };
    if (isAdmin) query.adminId = req.user._id;

    // Optional: detect email changes to track the previous email
    const existingEmployee = await Employee.findOne(query);
    if (!existingEmployee) return res.status(404).json({ error: "Employee not found" });

    // Strip immutable/metadata fields
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.employeeId;
    delete updateData.adminId;
    delete updateData.company;

    // Prevent accidental overwrite of generated fields from stale frontend state
    delete updateData.qrCodeUrl;

    // If email is provided and it differs from the current one, save the old email
    if (updateData.email && updateData.email.toLowerCase() !== existingEmployee.email.toLowerCase()) {
      updateData.previousEmail = existingEmployee.email;
    }

    const updated = await Employee.findOneAndUpdate(query, updateData, { new: true, runValidators: true });
    res.json(updated);
  } catch (err) {
    console.error("❌ Employee update error:", err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        error: `Duplicate value entered for ${field}. This ${field} is already in use by another employee.`,
        field: field,
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// Acknowledge and clear previous email showing after employee sees popup
router.patch("/:id/clear-old-email", protect, async (req, res) => {
  try {
    // Only the employee themself should acknowledge this
    if (req.user.employeeId !== req.params.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const updated = await Employee.findOneAndUpdate(
      { employeeId: req.params.id },
      { $set: { previousEmail: null } },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==============================================================
 🔑 CHANGE EMPLOYEE PASSWORD — ADMIN ONLY
    PATCH /api/employees/:id/change-password

    WHY a dedicated route instead of reusing PUT /:id?
    The PUT route uses findOneAndUpdate() which BYPASSES Mongoose's
    pre('save') hook — that is where bcrypt hashing happens.
    Sending a plain password through PUT would store it in plain text.
    This route fetches the document and calls .save() so the hash
    fires correctly every time.

    Security:
    - protect    → valid JWT required
    - onlyAdmin  → employees cannot call this on themselves or others
    - adminId scoping → admin can only change passwords for their own employees
============================================================== */
router.patch("/:id/change-password", protect, onlyAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;

    // ── 1. Validate input ─────────────────────────────────────────
    if (!newPassword || typeof newPassword !== "string") {
      return res.status(400).json({ message: "newPassword is required." });
    }
    if (newPassword.trim().length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long.",
      });
    }

    // ── 2. Find the employee (must belong to this admin) ──────────
    const employee = await Employee.findOne({
      employeeId: req.params.id,
      adminId: req.user._id,
    }).select("+password");

    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    // ── 3. Set new password — triggers bcrypt pre-save hook ───────
    employee.password = newPassword.trim();
    await employee.save();

    res.status(200).json({ message: "Password changed successfully." });
  } catch (err) {
    console.error("❌ Change employee password error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE employee → ADMIN ONLY
router.delete("/:id", protect, onlyAdmin, async (req, res) => {
  try {
    const employeeToDelete = await Employee.findOne({
      employeeId: req.params.id,
      adminId: req.user._id,
    });

    if (!employeeToDelete) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const companyId = employeeToDelete.company;
    const deletedId = employeeToDelete.employeeId;

    const company = await Company.findById(companyId);
    if (!company) {
      await Employee.findOneAndDelete({ employeeId: req.params.id });
      return res.status(200).json({
        message: "Employee deleted (Company not found, IDs not shifted)",
      });
    }

    const prefixLength = company.prefix.length;
    const deletedNumber = parseInt(deletedId.slice(prefixLength), 10);

    if (isNaN(deletedNumber)) {
      await Employee.findOneAndDelete({ employeeId: req.params.id });
      return res.status(200).json({
        message: "Employee deleted (ID format invalid for shifting)",
      });
    }

    await Employee.findOneAndDelete({ employeeId: req.params.id });

    const siblings = await Employee.find({ company: companyId });

    const updatePromises = siblings.map(async (emp) => {
      const currentNum = parseInt(emp.employeeId.slice(prefixLength), 10);

      if (!isNaN(currentNum) && currentNum > deletedNumber) {
        const newNum = currentNum - 1;
        const newId = `${company.prefix}${String(newNum).padStart(2, "0")}`;
        emp.employeeId = newId;
        return emp.save();
      }
    });

    await Promise.all(updatePromises);

    if (company.employeeCount > 0) {
      company.employeeCount -= 1;
      await company.save();
    }

    res.status(200).json({
      message: "Employee deleted and subsequent IDs shifted successfully",
      adjustedCount: company.employeeCount,
    });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ==============================================================
 🔐 DEACTIVATE / REACTIVATE → ADMIN ONLY
============================================================== */

router.patch("/:id/deactivate", protect, onlyAdmin, async (req, res) => {
  const { endDate, reason } = req.body;
  try {
    const emp = await Employee.findOneAndUpdate(
      { employeeId: req.params.id, adminId: req.user._id },
      {
        isActive: false,
        status: "Inactive",
        deactivationDate: endDate,
        deactivationReason: reason,
      },
      { new: true }
    );

    if (!emp) return res.status(404).json({ message: "Employee not found" });

    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/reactivate", protect, onlyAdmin, async (req, res) => {
  const { date, reason } = req.body;
  try {
    const emp = await Employee.findOneAndUpdate(
      { employeeId: req.params.id, adminId: req.user._id },
      {
        isActive: true,
        status: "Active",
        reactivationDate: date,
        reactivationReason: reason,
      },
      { new: true }
    );

    if (!emp) return res.status(404).json({ message: "Employee not found" });

    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==============================================================
 🔥 IDLE DETECTION → SYSTEM GENERATED
============================================================== */
router.post("/idle-activity", protect, async (req, res) => {
  try {
    const { employeeId, name, department, role, lastActiveAt } = req.body;

    const msg = `${name} (${employeeId}) from ${department} is idle since ${new Date(
      lastActiveAt
    ).toLocaleTimeString()}.`;

    const adminId =
      req.user.role === "admin" ? req.user._id : req.user.adminId;

    const notification = await Notification.create({
      adminId: adminId,
      companyId: req.user.company,
      userId: adminId,
      title: "Employee Idle Alert",
      message: msg,
      type: "attendance",
      isRead: false,
    });

    const io = req.app.get("io");
    // ✅ FEATURE 2 + BUG 3 FIX — emit only to this admin's private socket room
    if (io) io.to(`user_${adminId}`).emit("newNotification", notification);

    res.json({ success: true, notification });
  } catch (error) {
    console.error("❌ Idle Activity Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ==============================================================
 🔥 SHARED HELPER: FETCH QR IMAGE BUFFER
============================================================== */
const fetchQrImageBuffer = async (url) => {
  try {
    const secureUrl = url.replace("http:", "https:");
    const response = await axios.get(secureUrl, { responseType: 'arraybuffer', timeout: 8000 });
    return Buffer.from(response.data, 'binary');
  } catch (error) {
    console.error(`Failed to fetch image: ${url}`);
    return null;
  }
};

/* ==============================================================
 🔥 ADMIN BULK QR CODE ZIP DOWNLOAD
============================================================== */
router.get("/admin/qr-codes/zip", protect, onlyAdmin, async (req, res) => {
  try {
    const adminId = req.user.role === "admin" ? req.user._id : req.user.adminId;

    const employees = await Employee.find({
      adminId,
      isActive: true,
      qrCodeUrl: { $exists: true, $ne: "" }
    }).select("name employeeId qrCodeUrl").lean();

    if (!employees || employees.length === 0) {
      return res.status(404).json({ message: "No active employees with QR codes found." });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="employee-qr-codes-${new Date().toISOString().split('T')[0]}.zip"`);

    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    // Listen for all archive warnings/errors
    archive.on('warning', function (err) {
      if (err.code === 'ENOENT') {
        console.warn('Archiver warning:', err);
      } else {
        throw err;
      }
    });
    archive.on('error', function (err) {
      throw err;
    });

    // Pipe archive data to the response
    archive.pipe(res);

    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < employees.length; i += batchSize) {
      const batch = employees.slice(i, i + batchSize);

      const imageBuffers = await Promise.all(batch.map(emp => fetchQrImageBuffer(emp.qrCodeUrl)));

      for (let j = 0; j < batch.length; j++) {
        const employee = batch[j];
        const imageBuffer = imageBuffers[j];

        if (!imageBuffer) continue;

        // Sanitize filename: FullName_ID.png
        // Replace spaces with underscores, and strip invalid characters
        const safeName = (employee.name || "Employee")
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9_\-\.]/g, '');

        const filename = `${safeName}_${employee.employeeId}.png`;
        archive.append(imageBuffer, { name: filename });
      }
    }

    archive.finalize();

  } catch (err) {
    console.error("Error generating QR Codes ZIP:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate ZIP" });
    }
  }
});

/* ==============================================================
 🔥 SINGLE QR CODE DOWNLOAD
============================================================== */
router.get("/:id/qr/download", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(401).json({ message: "No token provided" });

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.employeeId !== req.params.id) {
      return res.status(403).json({ message: "Token does not match employee" });
    }

    // Find employee
    const employee = await Employee.findOne({ employeeId: req.params.id });
    if (!employee || !employee.qrCodeUrl) {
      return res.status(404).json({ message: "QR code not found" });
    }

    // Proxy/redirect to Cloudinary with forced download using fl_attachment
    const urlParts = employee.qrCodeUrl.split('/upload/');
    if (urlParts.length === 2) {
      const downloadUrl = `${urlParts[0]}/upload/fl_attachment:${employee.employeeId}-qr/${urlParts[1]}`;
      return res.redirect(downloadUrl);
    }

    // Fallback
    return res.redirect(employee.qrCodeUrl);

  } catch (err) {
    console.error("Single QR download error:", err);
    res.status(500).json({ error: "Failed to download QR code" });
  }
});

/* ==============================================================
 🔥 ADMIN BULK QR CODE PDF DOWNLOAD
============================================================== */
router.get("/admin/qr-codes/pdf", protect, onlyAdmin, async (req, res) => {
  try {
    const adminId = req.user.role === "admin" ? req.user._id : req.user.adminId;

    // Fetch all active employees for this tenant that have a qrCodeUrl
    const employees = await Employee.find({
      adminId,
      isActive: true,
      qrCodeUrl: { $exists: true, $ne: "" }
    }).select("name employeeId currentDepartment currentRole experienceDetails qrCodeUrl").lean();

    if (!employees || employees.length === 0) {
      return res.status(404).json({ message: "No active employees with QR codes found." });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=employee-qr-codes.pdf");

    // Initialize PDF document (A4 size)
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    doc.pipe(res);

    // Layout settings for 3x4 grid
    const columns = 3;
    const rows = 4;
    const cardsPerPage = columns * rows;
    const startX = 30;
    const startY = 30;
    const cardWidth = (doc.page.width - 60) / columns;
    const cardHeight = (doc.page.height - 60) / rows;
    const imgSize = 100; // Size of the QR code image

    let currentCardCount = 0;

    // Process in batches of 10 to respect Netlify's 10s timeout while avoiding memory exhaustion
    const batchSize = 10;

    for (let i = 0; i < employees.length; i += batchSize) {
      const batch = employees.slice(i, i + batchSize);

      // Fetch images for the current batch concurrently
      const imageBuffers = await Promise.all(batch.map(emp => fetchQrImageBuffer(emp.qrCodeUrl)));

      for (let j = 0; j < batch.length; j++) {
        const employee = batch[j];
        const imageBuffer = imageBuffers[j];

        if (!imageBuffer) continue; // Skip if image failed to load

        if (currentCardCount > 0 && currentCardCount % cardsPerPage === 0) {
          doc.addPage();
        }

        const colIndex = currentCardCount % columns;
        const rowIndex = Math.floor((currentCardCount % cardsPerPage) / columns);

        const x = startX + (colIndex * cardWidth);
        const y = startY + (rowIndex * cardHeight);

        // Draw card border
        doc.rect(x + 5, y + 5, cardWidth - 10, cardHeight - 10).stroke("#cccccc");

        // Calculate center for image
        const imgX = x + (cardWidth - imgSize) / 2;
        const imgY = y + 15;

        // Add QR code image
        try {
          doc.image(imageBuffer, imgX, imgY, { width: imgSize, height: imgSize });

          // Add clickable overlay
          const token = jwt.sign({ employeeId: employee.employeeId }, process.env.JWT_SECRET);
          const protocol = req.headers['x-forwarded-proto'] || req.protocol;
          const baseUrl = `${protocol}://${req.get("host")}`;
          const downloadUrl = `${baseUrl}/api/employees/${employee.employeeId}/qr/download?token=${token}`;

          doc.link(imgX, imgY, imgSize, imgSize, downloadUrl);
        } catch (e) {
          console.error("Error drawing image in PDF", e);
        }

        // Add text below image
        let textY = imgY + imgSize + 15;

        // Name
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#333333');
        doc.text(employee.name, x, textY, { width: cardWidth, align: 'center' });

        // Employee ID
        textY += 15;
        doc.font('Helvetica').fontSize(10).fillColor('#666666');
        doc.text(`ID: ${employee.employeeId}`, x, textY, { width: cardWidth, align: 'center' });

        // Department
        let dept = employee.currentDepartment;
        if (!dept && employee.experienceDetails && employee.experienceDetails.length > 0) {
          const currentExp = employee.experienceDetails.find(exp => exp.lastWorkingDate === "Present");
          dept = currentExp?.department;
        }

        textY += 12;
        doc.font('Helvetica').fontSize(10).fillColor('#666666');
        doc.text(dept || "N/A", x, textY, { width: cardWidth, align: 'center' });

        currentCardCount++;
      }
    }

    doc.end();

  } catch (err) {
    console.error("Error generating QR Codes PDF:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  }
});

export default router;
// --- END OF FILE routes/employeeRoutes.js ---
