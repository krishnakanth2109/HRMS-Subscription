// --- START OF FILE models/MasterAdmin.js ---
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const masterAdminSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        lowercase: true 
    },
    password: { 
        type: String, 
        required: true, 
        select: false 
    },
    role: { 
        type: String, 
        default: "master" // Explicit role for the superuser
    }
}, { timestamps: true });

// Hash password before saving
masterAdminSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Method to check password
masterAdminSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

export default mongoose.model("MasterAdmin", masterAdminSchema);
// --- END OF FILE models/MasterAdmin.js ---