// --- START OF FILE models/MasterAdmin.js ---
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const masterAdminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      default: "master", // strictly for super admin
    },
  },
  { timestamps: true }
);

// Hash password before saving
masterAdminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
masterAdminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const MasterAdmin = mongoose.model("MasterAdmin", masterAdminSchema);
export default MasterAdmin;
// --- END OF FILE models/MasterAdmin.js ---