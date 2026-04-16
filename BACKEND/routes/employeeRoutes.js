// --- START OF FILE: routes/employeeRoutes.js ---

import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import Employee from "../models/employeeModel.js";
import Company from "../models/CompanyModel.js";
import Notification from "../models/notificationModel.js";
import InvitedEmployee from "../models/Invitedemployee.js";
import { upload } from "../config/cloudinary.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();

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
      req.user.role === "admin"
        ? { adminId: req.user._id }
        : { company: req.user.company };

    const employees = await Employee.find(query);
    res.status(200).json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET employee by ID
router.get("/:id", protect, async (req, res) => {
  try {
    const employee = await Employee.findOne({ employeeId: req.params.id });
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    if (
      req.user.role !== "admin" &&
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
    const isAdmin = req.user.role === "admin";
    const isSelf = req.user.employeeId === req.params.id;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ message: "Not authorized to update this profile" });
    }

    const query = { employeeId: req.params.id };
    if (isAdmin) query.adminId = req.user._id;

    // Optional: detect email changes to track the previous email
    const existingEmployee = await Employee.findOne(query);
    if (!existingEmployee) return res.status(404).json({ error: "Employee not found" });

    // If email is provided and it differs from the current one, save the old email
    if (req.body.email && req.body.email.toLowerCase() !== existingEmployee.email.toLowerCase()) {
      req.body.previousEmail = existingEmployee.email;
    }

    const updated = await Employee.findOneAndUpdate(query, req.body, { new: true });
    res.json(updated);
  } catch (err) {
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
    if (io) io.emit("newNotification", notification);

    res.json({ success: true, notification });
  } catch (error) {
    console.error("❌ Idle Activity Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
// --- END OF FILE routes/employeeRoutes.js ---