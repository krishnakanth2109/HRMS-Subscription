// --- START OF FILE controllers/companyController.js ---

import Company from "../models/CompanyModel.js";
import Employee from "../models/employeeModel.js";

// ✅ GET ALL COMPANIES (SCOPED TO LOGGED IN ADMIN)
export const getAllCompanies = async (req, res) => {
  try {
    // SECURITY: Only return companies owned by this Admin
    const companies = await Company.find({ 
        adminId: req.user._id,
        isActive: true 
    }).select("_id name prefix employeeCount");
    
    res.status(200).json({
      success: true,
      data: companies,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GET COMPANY BY ID (SCOPED)
export const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    // SECURITY: Ensure Admin owns this company
    const company = await Company.findOne({ _id: id, adminId: req.user._id });

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    res.status(200).json({ success: true, data: company });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ CREATE NEW COMPANY
export const createCompany = async (req, res) => {
  try {
    const { name, prefix, description, email, phone, address, city, state, zipCode, country, registrationNumber, website } = req.body;

    if (!name || !prefix) {
      return res.status(400).json({ success: false, message: "Name/Prefix required" });
    }

    // Check uniqueness (Global or Per Admin? Usually Per Admin, but Prefix should ideally be unique globally for ID generation)
    const existingCompany = await Company.findOne({
      $or: [{ name: name.trim() }, { prefix: prefix.toUpperCase().trim() }],
    });

    if (existingCompany) {
      return res.status(400).json({ success: false, message: "Company Name or Prefix already taken." });
    }

    const newCompany = new Company({
      adminId: req.user._id, // LINK TO ADMIN
      name: name.trim(),
      prefix: prefix.toUpperCase().trim(),
      description,
      email,
      phone,
      address,
      city,
      state,
      zipCode,
      country,
      registrationNumber,
      website,
      employeeCount: 0,
    });

    await newCompany.save();

    res.status(201).json({
      success: true,
      message: "Company created successfully",
      data: newCompany,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ UPDATE COMPANY
export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Security check logic omitted for brevity, but ideally verify name/prefix uniqueness if changed
    
    // Ensure Admin owns it
    const company = await Company.findOneAndUpdate(
        { _id: id, adminId: req.user._id }, 
        updates, 
        { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    res.status(200).json({ success: true, message: "Updated", data: company });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ DELETE COMPANY
export const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Company.findOneAndDelete({ _id: id, adminId: req.user._id });

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GENERATE NEXT ID
export const generateEmployeeId = async (req, res) => {
    // Logic remains mostly same, just ensure we query company safely
    try {
        const { companyId } = req.body;
        // Verify ownership
        const company = await Company.findOne({ _id: companyId, adminId: req.user._id });
        if(!company) return res.status(404).json({ message: "Company not found" });

        const count = await Employee.countDocuments({ company: companyId });
        company.employeeCount = count + 1;
        await company.save();

        const employeeId = `${company.prefix}${String(count + 1).padStart(2, "0")}`;
        res.status(200).json({ success: true, employeeId });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
};

export const getNextEmployeeId = async (req, res) => {
    try {
        const { companyId } = req.params;
        const company = await Company.findOne({ _id: companyId, adminId: req.user._id });
        if(!company) return res.status(404).json({ message: "Company not found" });

        const count = await Employee.countDocuments({ company: companyId });
        const nextEmployeeId = `${company.prefix}${String(count + 1).padStart(2, "0")}`;
        res.status(200).json({ success: true, nextEmployeeId });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
};