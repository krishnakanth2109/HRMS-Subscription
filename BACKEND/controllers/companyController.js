// --- START OF FILE controllers/companyController.js ---

import Company from "../models/CompanyModel.js";
import Employee from "../models/employeeModel.js";

// ✅ GET ALL COMPANIES
export const getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ isActive: true }).select("_id name prefix employeeCount");
    res.status(200).json({
      success: true,
      data: companies,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching companies",
      error: error.message,
    });
  }
};

// ✅ GET COMPANY BY ID
export const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Company.findById(id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    res.status(200).json({
      success: true,
      data: company,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching company",
      error: error.message,
    });
  }
};

// ✅ CREATE NEW COMPANY
export const createCompany = async (req, res) => {
  try {
    console.log("📝 Received company creation request:", req.body);
    const { name, prefix, description, email, phone, address, city, state, zipCode, country, registrationNumber, website } = req.body;

    // Validation
    if (!name || !prefix) {
      console.log("❌ Validation failed: Missing name or prefix");
      return res.status(400).json({
        success: false,
        message: "Company name and prefix are required",
      });
    }

    // Check if company already exists
    const existingCompany = await Company.findOne({
      $or: [{ name: name.trim() }, { prefix: prefix.toUpperCase().trim() }],
    });

    if (existingCompany) {
      console.log("❌ Company already exists");
      return res.status(400).json({
        success: false,
        message: "Company with this name or prefix already exists",
      });
    }

    const newCompany = new Company({
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
    console.log("✅ Company created successfully:", newCompany._id);

    res.status(201).json({
      success: true,
      message: "Company created successfully",
      data: newCompany,
    });
  } catch (error) {
    console.error("❌ Error creating company:", error);
    res.status(500).json({
      success: false,
      message: "Error creating company",
      error: error.message,
    });
  }
};

// ✅ UPDATE COMPANY
export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating prefix if it would create duplicates
    if (updates.prefix) {
      const existing = await Company.findOne({
        prefix: updates.prefix.toUpperCase().trim(),
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Prefix already exists for another company",
        });
      }
      updates.prefix = updates.prefix.toUpperCase().trim();
    }

    if (updates.name) {
      const existing = await Company.findOne({
        name: updates.name.trim(),
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Company name already exists",
        });
      }
      updates.name = updates.name.trim();
    }

    const company = await Company.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Company updated successfully",
      data: company,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating company",
      error: error.message,
    });
  }
};

// ✅ DELETE COMPANY (Permanent Delete)
export const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    // Hard delete from database
    const company = await Company.findByIdAndDelete(id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Company deleted permanently",
      data: company,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting company",
      error: error.message,
    });
  }
};

// ✅ GENERATE NEXT EMPLOYEE ID FOR A COMPANY
export const generateEmployeeId = async (req, res) => {
  try {
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // ✅ COUNT ACTUAL EMPLOYEES IN DB
    const count = await Employee.countDocuments({ company: companyId });

    // Update company count to match DB for consistency (optional but good for sync)
    company.employeeCount = count + 1;
    await company.save();

    // Generate ID: PREFIX + (Count + 1) padded to 2 digits
    const employeeId = `${company.prefix}${String(count + 1).padStart(2, "0")}`;

    res.status(200).json({
      success: true,
      employeeId,
      company: {
        id: company._id,
        name: company.name,
        prefix: company.prefix,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error generating employee ID",
      error: error.message,
    });
  }
};

// ✅ GET NEXT EMPLOYEE ID FOR A COMPANY (WITHOUT INCREMENTING)
export const getNextEmployeeId = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // ✅ COUNT ACTUAL EMPLOYEES IN DB
    // This ensures we always get the correct next ID even if DB was manually changed
    const count = await Employee.countDocuments({ company: companyId });

    // Generate ID: PREFIX + (Count + 1) padded to 2 digits
    const nextEmployeeId = `${company.prefix}${String(count + 1).padStart(2, "0")}`;

    res.status(200).json({
      success: true,
      nextEmployeeId,
      currentCount: count // Debug info
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error getting next employee ID",
      error: error.message,
    });
  }
};

// --- END OF FILE controllers/companyController.js ---
