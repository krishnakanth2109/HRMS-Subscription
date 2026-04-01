import mongoose from 'mongoose';

const CandidateSchema = new mongoose.Schema({
    // Section 1 — Employee Details
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    dob: { type: Date },
    address: { type: String },
    profilePic: { type: String }, // NEW: Profile picture

    // Section 2 — Job Details
    companyName: { type: String, required: true },
    department: { type: String },
    designation: { type: String },
    employmentType: { type: String, enum: ['Full Time', 'Part Time', 'Intern', 'Contract'] },
    joiningDate: { type: Date },

    // Section 3 — Salary Details (NEW)
    agreedSalary: { type: Number, default: 0 },
    pfDeduction: { type: Number, default: 0 },
    ptDeduction: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },

    // Section 4 — Bank Details
    bankName: { type: String },
    accountHolderName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
    branch: { type: String },

    // Section 5 — Compliance
    panDoc: { type: String },
    aadhaarDoc: { type: String },
    uanNumber: { type: String },
    esiNumber: { type: String }

}, { timestamps: true });

// Calculate net salary before saving
CandidateSchema.pre('save', function(next) {
    if (this.agreedSalary && (this.pfDeduction || this.ptDeduction || this.otherDeductions)) {
        const totalDeductions = (this.pfDeduction || 0) + (this.ptDeduction || 0) + (this.otherDeductions || 0);
        this.netSalary = this.agreedSalary - totalDeductions;
    } else {
        this.netSalary = this.agreedSalary || 0;
    }
    next();
});

// Calculate net salary before updating
CandidateSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    const agreedSalary = update.agreedSalary || 0;
    const pfDeduction = update.pfDeduction || 0;
    const ptDeduction = update.ptDeduction || 0;
    const otherDeductions = update.otherDeductions || 0;
    
    const totalDeductions = pfDeduction + ptDeduction + otherDeductions;
    update.netSalary = agreedSalary - totalDeductions;
    
    next();
});

export default mongoose.model('Candidate', CandidateSchema);