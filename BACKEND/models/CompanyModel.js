// --- START OF FILE models/CompanyModel.js ---
import mongoose from "mongoose";

const CompanySchema = new mongoose.Schema({
    // HIERARCHY: Company belongs to an Admin
    adminId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Admin", 
        required: true 
    }, 

    name: { 
        type: String, 
        required: true, 
        trim: true 
    },
    
    // Prefix used for Employee IDs (e.g., "TCS" -> TCS-001)
    prefix: { 
        type: String, 
        required: true, 
        uppercase: true,
        trim: true,
        minlength: 2,
        maxlength: 5
    }, 
    
    employeeCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    
    // Settings specific to this company
    officeLocation: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        address: { type: String, default: "" },
        allowedRadius: { type: Number, default: 200 } // Geofencing radius in meters
    },

    description: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    website: { type: String, default: "" },

}, { timestamps: true });

// Ensure a prefix is unique within the scope of one Admin (or globally, depending on preference)
// Here, we enforce uniqueness globally to avoid confusion in the system
CompanySchema.index({ prefix: 1 }, { unique: true });

export default mongoose.model("Company", CompanySchema);
// --- END OF FILE models/CompanyModel.js ---