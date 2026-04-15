import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  // ✅ select: false → password is NEVER returned in regular queries.
  //    Use .select("+password") only where explicitly needed
  //    (login, change-password route).
  password: { type: String, required: true, select: false },
  role: { type: String, default: "employee" },
  phone: { type: String },
  address: { type: String },
  emergency: { type: String },
  isActive: { type: Boolean, default: true },
  status: { type: String, default: "Active" },

  /* ==================== LOGIN ACCESS CONTROL ==================== */
  loginEnabled: { type: Boolean, default: true },

  // Existing fields from your database
  bankDetails: { type: Object },
  personalDetails: { type: Object },
  experienceDetails: [{
    role: String,
    department: String,
    startDate: String,
    lastWorkingDate: String
  }],

  // Deactivation/Reactivation
  deactivationDate: { type: String },
  deactivationReason: { type: String },
  reactivationDate: { type: String },
  reactivationReason: { type: String },

  // Company Reference
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },

  // Company Info (for quick access without population)
  companyName: { type: String },
  companyPrefix: { type: String },

  isAdmin: { type: Boolean, default: false }

}, { timestamps: true });

/* ================================================================
 * 🔐 PRE-SAVE HOOK — Hash password before saving to DB
 *
 * This fires automatically whenever .save() is called on a document.
 * It only re-hashes if the password field was actually modified,
 * so updating other fields (name, phone, etc.) does NOT re-hash.
 *
 * This is what makes PATCH /:id/change-password work correctly:
 *   employee.password = newPassword;
 *   await employee.save();  ← triggers this hook → stores bcrypt hash
 * ================================================================ */
employeeSchema.pre("save", async function (next) {
  // Only hash if the password field was changed (or is new)
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

/* ================================================================
 * 🔐 INSTANCE METHOD — Compare plain text password to stored hash
 *
 * Usage in authController.js:
 *   const isMatch = await employee.comparePassword(plainTextPassword);
 * ================================================================ */
employeeSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

// Prevent OverwriteModelError
const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);
export default Employee;