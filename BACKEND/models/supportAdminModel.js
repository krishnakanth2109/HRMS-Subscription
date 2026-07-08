import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const customFieldSchema = new mongoose.Schema({
  label: String,
  value: String,
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
