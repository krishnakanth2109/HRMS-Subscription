import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Sub-schemas
const experienceSchema = new mongoose.Schema({
  company: String,
  role: String,
  department: String,
  years: Number,
  joiningDate: String,
  lastWorkingDate: String,
  salary: Number,
  reason: String,
  experienceLetterUrl: String,
  employmentType: String,
});

const personalSchema = new mongoose.Schema({
  dob: String,
  gender: { type: String, enum: ["Male", "Female", "Prefer not to say"] },
  maritalStatus: String,
  nationality: String,
  panNumber: String,
  aadhaarNumber: String,
  aadhaarFileUrl: String,
  panFileUrl: String,
});

const customFieldSchema = new mongoose.Schema({
  label: String,
  value: String,
});

const bankSchema = new mongoose.Schema({
  accountNumber: String,
  bankName: String,
  ifsc: String,
  branch: String,
});

// ✅ NEW: Sub-schema for uploaded company documents (filled by employee during onboarding)
const companyDocumentSchema = new mongoose.Schema({
  fileName: { type: String },
  fileUrl: { type: String },
  fileType: { type: String },
  fileSize: { type: Number },
  uploadedAt: { type: Date, default: Date.now },
});

const supportAdminSchema = new mongoose.Schema(
  {
    /* ==================== BASIC INFO ==================== */
    supportAdminId: {
      type: String,
      trim: true,
      default: "",
    },

    name: { type: String, required: [true, "Please provide a name"] },

    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      lowercase: true,
      match: [/.+\@.+\..+/, "Please fill a valid email address"],
    },

    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: 6,
      select: false,
    },

    role: {
      type: String,
      default: "support-admin",
    },

    positionName: { type: String, default: "Administration" },
    phone: { type: String, default: "" },
    department: { type: String, default: "Support Administration" },

    // Link to the parent Admin
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },

    /* ==================== LOGIN ACCESS CONTROL ==================== */
    loginEnabled: { type: Boolean, default: true },

    /* ==================== ASSIGNED FEATURES ==================== */
    assignedFeatures: { type: [String], default: undefined },

    /* ==================== PUBLIC PORTFOLIO FIELDS ==================== */
    profileImageUrl: { type: String, default: null },
    portfolioBackgroundImageUrl: { type: String, default: null },
    qrCodeUrl: { type: String, default: null },
    bio: { type: String, default: null },
    customPortfolioFields: [customFieldSchema],
    socialLinks: {
      linkedin: { type: String, default: null },
      github: { type: String, default: null },
      instagram: { type: String, default: null },
      website: { type: String, default: null },
    },
    address: { type: String, default: "" },
    emergency: { type: String, default: "" },
    emergencyPhone: { type: String, default: "" },

    bankDetails: bankSchema,
    personalDetails: personalSchema,
    experienceDetails: [experienceSchema],
  },
  { timestamps: true }
);

// Hash password before saving
supportAdminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// PASSWORD CHECK
supportAdminSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const SupportAdmin = mongoose.model("SupportAdmin", supportAdminSchema);
export default SupportAdmin;
