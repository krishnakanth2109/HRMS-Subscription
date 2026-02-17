// --- START OF FILE AddEmployee.jsx ---

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUser, FaEnvelope, FaBuilding, FaIdBadge, FaPhone, FaMapMarkerAlt,
  FaCalendarAlt, FaBriefcase, FaMoneyBill, FaBirthdayCake, FaFlag,
  FaHeartbeat, FaUniversity, FaCreditCard, FaCodeBranch,
  FaEye, FaEyeSlash, FaPlus, FaTimes, FaTrash, FaEdit // ✅ Added FaEdit
} from "react-icons/fa";
// ✅ IMPORT THE CENTRALIZED API FUNCTIONS
import { 
  getEmployees, 
  addEmployee, 
  getAllCompanies, 
  createCompany, 
  updateCompany, // ✅ Added updateCompany
  getNextEmployeeId, 
  deleteCompany 
} from "../api";

// Snackbar hook
const useSnackbar = (timeout = 2500) => {
  const [message, setMessage] = useState("");
  const show = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), timeout);
  };
  return { message, show };
};

const AddEmployee = () => {
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);

  // Company Modal State (Add)
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [newCompanyData, setNewCompanyData] = useState({
    name: "",
    prefix: "",
    description: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  });
  const [addingCompany, setAddingCompany] = useState(false);

  // ✅ NEW: Company Modal State (Edit)
  const [showEditCompanyModal, setShowEditCompanyModal] = useState(false);
  const [editCompanyData, setEditCompanyData] = useState({
    _id: "",
    name: "",
    prefix: "",
    description: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  });
  const [updatingCompany, setUpdatingCompany] = useState(false);

  // State for Password Visibility
  const [showPassword, setShowPassword] = useState(false);

  // State for Custom Dropdown Visibility
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);

  // Fetch companies and employees
  useEffect(() => {
    fetchCompaniesAndEmployees();
  }, []);

  const fetchCompaniesAndEmployees = async () => {
    try {
      const [companiesData, employeesData] = await Promise.all([
        getAllCompanies(),
        getEmployees(),
      ]);
      setCompanies(companiesData.data || companiesData || []);
      setEmployees(employeesData || []);
    } catch (err) {
      console.error("Error fetching data:", err);
      snackbar.show("Error loading companies and employees");
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    company: "", // Company selection
    companyName: "",
    companyPrefix: "",
    employeeId: "", name: "", email: "", password: "", employmentType: "Full-Time",
    phone: "", address: "", joiningDate: "", emergency: "",
    bankDetails: { accountNumber: "", bankName: "", ifsc: "", branch: "" },
    personalDetails: { dob: "", gender: "Male", maritalStatus: "Single", nationality: "" },
    currentRole: "", currentDepartment: "", currentSalary: "",
  });

  const [error, setError] = useState("");
  // State for field-specific errors
  const [fieldErrors, setFieldErrors] = useState({});

  // Handle Company Selection and Auto-Generate Employee ID
  const handleCompanyChange = async (companyId) => {
    const selectedCompany = companies.find(c => c._id === companyId);
    if (selectedCompany) {
      try {
        // REFRESH employees list to get latest data
        const latestEmployees = await getEmployees();
        setEmployees(latestEmployees || []);
        
        // USE BACKEND API to get the next employee ID
        const idResponse = await getNextEmployeeId(companyId);
        
        let nextId = idResponse?.nextEmployeeId || idResponse?.employeeId || idResponse?.data?.nextEmployeeId;

        if (!nextId) {
          throw new Error(`Invalid response from server: ${JSON.stringify(idResponse)}`);
        }

        setFormData(prev => ({
          ...prev,
          company: companyId,
          companyName: selectedCompany.name,
          companyPrefix: selectedCompany.prefix,
          employeeId: nextId,
        }));
        snackbar.show(`Generated ID: ${nextId}`);
      } catch (err) {
        console.error("Error generating employee ID:", err);
        snackbar.show("Error generating employee ID");
      }
    }
  };

  // Handle Add Company
  const handleAddCompany = async (e) => {
    e.preventDefault();

    if (!newCompanyData.name.trim() || !newCompanyData.prefix.trim()) {
      snackbar.show("Company name and prefix are required");
      return;
    }

    setAddingCompany(true);
    try {
      const response = await createCompany(newCompanyData);
      snackbar.show("Company added successfully!");

      // Add to companies list
      setCompanies([...companies, response.data]);

      // Auto-select the new company
      handleCompanyChange(response.data._id);

      // Reset form and close modal
      setNewCompanyData({
        name: "",
        prefix: "",
        description: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
      });
      setShowAddCompanyModal(false);
    } catch (err) {
      console.error("Error adding company:", err);
      snackbar.show(err.response?.data?.message || "Error adding company");
    } finally {
      setAddingCompany(false);
    }
  };

  // ✅ NEW: Handle Edit Click (Opens Modal with Data)
  const handleEditClick = (e, company) => {
    e.stopPropagation(); // Prevent dropdown selection
    setEditCompanyData({
      _id: company._id,
      name: company.name,
      prefix: company.prefix,
      description: company.description || "",
      email: company.email || "",
      phone: company.phone || "",
      address: company.officeLocation?.address || "", // Assuming structure matches backend
      city: company.city || "", // Add if specific field exists
      state: company.state || "",
      zipCode: company.zipCode || "",
      country: company.country || ""
    });
    setShowEditCompanyModal(true);
  };

  // ✅ NEW: Handle Update Company
  const handleUpdateCompany = async (e) => {
    e.preventDefault();

    if (!editCompanyData.name.trim() || !editCompanyData.prefix.trim()) {
      snackbar.show("Company name and prefix are required");
      return;
    }

    setUpdatingCompany(true);
    try {
      const response = await updateCompany(editCompanyData._id, editCompanyData);
      snackbar.show("Company updated successfully!");

      // Update local state
      const updatedList = companies.map(c => 
        c._id === editCompanyData._id ? response.data : c
      );
      setCompanies(updatedList);

      // If the edited company was currently selected in the form, update form display
      if (formData.company === editCompanyData._id) {
        setFormData(prev => ({
          ...prev,
          companyName: response.data.name,
          companyPrefix: response.data.prefix
        }));
      }

      setShowEditCompanyModal(false);
    } catch (err) {
      console.error("Error updating company:", err);
      snackbar.show(err.response?.data?.message || "Error updating company");
    } finally {
      setUpdatingCompany(false);
    }
  };

  // Handle Delete Company
  const handleDeleteCompany = async (e, companyId, companyName) => {
    e.stopPropagation(); // Prevent closing dropdown
    if (window.confirm(`Permanently delete "${companyName}" from the database? This cannot be undone.`)) {
      try {
        await deleteCompany(companyId);
        snackbar.show(`Company "${companyName}" deleted successfully`);

        // Remove from local state
        setCompanies(prev => prev.filter(c => c._id !== companyId));

        // If the deleted company was selected, clear selection
        if (formData.company === companyId) {
          setFormData(prev => ({
            ...prev,
            company: "",
            companyName: "",
            companyPrefix: "",
            employeeId: ""
          }));
        }
        snackbar.show("Company removed from list.");
      } catch (err) {
        console.error("Error removing company:", err);
      }
    }
  };

  // Handle form input change
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Clear field-specific error when user types
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: "" }));
    }

    if (name === "name") {
      if (!/^[a-zA-Z\s]*$/.test(value)) return;
    }

    if (name === "phone") {
      if (!/^\d*$/.test(value)) return; 
      if (value.length > 10) return;   
    }

    if (name === "password") {
      if (value.length > 12) return;
    }

    if (name.startsWith("bankDetails.")) {
      const field = name.split(".")[1];
      if (field === "accountNumber" && !/^\d*$/.test(value)) return;
      if (field === "branch" && !/^[a-zA-Z\s]*$/.test(value)) return;
      if (field === "ifsc" && value.length > 11) return;

      setFormData((prev) => ({
        ...prev,
        bankDetails: { ...prev.bankDetails, [field]: value },
      }));
    } else if (name.startsWith("personalDetails.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        personalDetails: { ...prev.personalDetails, [field]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Validation
  const validate = () => {
    if (!formData.company) return "Company is required.";
    if (!formData.name.trim()) return "Full Name is required.";
    if (!formData.email.trim()) return "Email is required.";
    if (!formData.password.trim()) return "Password is required.";
    if (formData.password.length < 8) return "Password must be at least 8 characters.";
    if (formData.phone && formData.phone.length !== 10) return "Phone number must be exactly 10 digits.";
    if (!formData.currentDepartment.trim()) return "Department is required.";
    if (!formData.currentRole.trim()) return "Role is required.";
    if (!formData.joiningDate) return "Joining Date is required.";
    if (!formData.currentSalary || isNaN(formData.currentSalary)) return "Salary is required.";
    if (formData.address && formData.address.length < 10) return "Address must be at least 10 characters long.";

    if (formData.bankDetails.accountNumber) {
      if (!/^\d+$/.test(formData.bankDetails.accountNumber)) return "Bank Account Number must contain only digits.";
      if (formData.bankDetails.accountNumber.length < 9 || formData.bankDetails.accountNumber.length > 18) return "Bank Account Number should be between 9 and 18 digits.";
    }

    if (formData.bankDetails.ifsc && formData.bankDetails.ifsc.length !== 11) return "IFSC Code must be exactly 11 characters.";

    if (formData.employeeId.trim()) {
      const exists = employees.some(emp => emp.employeeId === formData.employeeId.trim());
      if (exists) return "Employee ID already exists.";
    }
    return "";
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      setTimeout(() => setError(""), 2500);
      return;
    }

    const newEmployee = {
      company: formData.company,
      companyName: formData.companyName,
      companyPrefix: formData.companyPrefix,
      employeeId: formData.employeeId,
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phone: formData.phone,
      address: formData.address,
      emergency: formData.emergency,
      isActive: true,
      bankDetails: formData.bankDetails,
      personalDetails: formData.personalDetails,
      experienceDetails: [{
        company: formData.companyName,
        role: formData.currentRole,
        department: formData.currentDepartment,
        years: 0,
        joiningDate: formData.joiningDate,
        lastWorkingDate: "Present",
        salary: parseFloat(formData.currentSalary) || 0,
        employmentType: formData.employmentType,
      }],
    };

    try {
      await addEmployee(newEmployee);
      const updatedEmployees = await getEmployees();
      setEmployees(updatedEmployees || []);
      snackbar.show("Employee added successfully!");
      navigate("/employees");
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 400 && err.response.data.field) {
        setFieldErrors({ [err.response.data.field]: err.response.data.error });
        snackbar.show(err.response.data.error);
      } else {
        snackbar.show(err.response?.data?.message || err.response?.data?.error || "Error adding employee. Try again!");
      }
    }
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-4xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 px-4 py-2 rounded-full bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition shadow flex items-center gap-2"
        >
          &#8592; Back to Employees
        </button>

        <h2 className="text-3xl font-bold text-blue-800 mb-8 text-center tracking-wide">
          Add New Employee
        </h2>

        {error && (
          <div className="mb-6 text-center text-red-600 font-semibold bg-red-100 rounded-lg py-3 px-4 shadow">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* COMPANY SELECTION SECTION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border rounded-xl bg-yellow-50/50 shadow-inner">
            <h3 className="md:col-span-2 text-xl font-bold text-yellow-700 border-b pb-3 mb-3">Company Information</h3>

            <div className="relative">
              <FaBuilding className="absolute left-3 top-4 text-gray-400" />
              <label className="absolute left-10 text-xs text-gray-500 font-medium top-1.5">Select Company *</label>
              {/* CUSTOM DROPDOWN REPLACEMENT */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                  className="w-full pl-10 pr-10 pt-5 pb-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-gray-50 text-left h-[50px] relative overflow-hidden"
                >
                  <span className={`block truncate ${!formData.company ? "text-gray-500" : "text-gray-700"}`}>
                    {formData.company
                      ? (() => {
                        const c = companies.find(c => c._id === formData.company);
                        return c ? `${c.name} (${c.prefix})` : "Select a Company";
                      })()
                      : "-- Select a Company --"
                    }
                  </span>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </button>

                {isCompanyDropdownOpen && (
                  <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto mt-1">
                    {companies.length > 0 ? (
                      companies.map((company) => (
                        <div
                          key={company._id}
                          className="flex items-center justify-between px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors group"
                          onClick={() => {
                            handleCompanyChange(company._id);
                            setIsCompanyDropdownOpen(false);
                          }}
                        >
                          <span className="text-gray-700 font-medium">
                            {company.name} <span className="text-gray-400 text-sm">({company.prefix})</span>
                          </span>
                          
                          <div className="flex gap-2">
                             {/* ✅ NEW: Edit Button */}
                             <button
                              type="button"
                              onClick={(e) => handleEditClick(e, company)}
                              className="text-blue-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition"
                              title="Edit Company"
                            >
                              <FaEdit />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteCompany(e, company._id, company.name)}
                              className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
                              title="Delete Company"
                            >
                              <FaTimes />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-gray-500 text-center">No companies found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddCompanyModal(true)}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-green-700 transition shadow"
              >
                <FaPlus /> Add Company
              </button>
            </div>

            {formData.company && (
              <>
                <div className="relative">
                  <FaIdBadge className="absolute left-3 top-4 text-gray-400" />
                  <label className="absolute left-10 text-xs text-gray-500 font-medium top-1.5">Generated Employee ID</label>
                  <input
                    type="text"
                    value={formData.employeeId}
                    readOnly
                    className="w-full pl-10 pr-4 pt-5 pb-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 font-semibold"
                  />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border rounded-xl bg-blue-50/50 shadow-inner">
            <h3 className="md:col-span-2 text-xl font-bold text-blue-700 border-b pb-3 mb-3">Personal Information</h3>
            <InputField icon={<FaUser />} name="name" label="Full Name" value={formData.name} onChange={handleChange} placeholder="e.g., John Doe" required />
            <InputField
              icon={<FaIdBadge />} name="password" label="Password" type={showPassword ? "text" : "password"}
              value={formData.password} onChange={handleChange} placeholder="Enter password" required maxLength={12}
              endIcon={showPassword ? <FaEyeSlash /> : <FaEye />} onEndIconClick={() => setShowPassword(!showPassword)}
            />
            <InputField icon={<FaEnvelope />} name="email" label="Email Address" type="email" value={formData.email} onChange={handleChange} placeholder="e.g., john@example.com" error={fieldErrors.email} required />
            <InputField icon={<FaPhone />} name="phone" label="Phone Number" type="tel" value={formData.phone} onChange={handleChange} placeholder="e.g., 9876543210" maxLength={10} error={fieldErrors.phone} />
            <InputField icon={<FaMapMarkerAlt />} name="address" label="Address" value={formData.address} onChange={handleChange} placeholder="e.g., Hyderabad" />
            <InputField icon={<FaHeartbeat />} name="emergency" label="Emergency Contact" value={formData.emergency} onChange={handleChange} placeholder="e.g., Jane Doe - 9999999999" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border rounded-xl bg-green-50/50 shadow-inner">
            <h3 className="md:col-span-2 text-xl font-bold text-green-700 border-b pb-3 mb-3">Job Details</h3>
            <InputField icon={<FaBuilding />} name="currentDepartment" label="Department" value={formData.currentDepartment} onChange={handleChange} placeholder="e.g., Marketing" required />
            <div className="relative">
              <FaBriefcase className="absolute left-3 top-4 text-gray-400" />
              <label className="absolute left-10 text-xs text-gray-500 font-medium top-1.5">Employment Type</label>
              <select name="employmentType" value={formData.employmentType} onChange={handleChange} className="w-full pl-10 pr-4 pt-5 pb-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-gray-50">
                <option value="Full-Time">Full-time</option>
                <option value="Part-Time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Intern">Intern</option>
              </select>
            </div>
            <InputField icon={<FaBriefcase />} name="currentRole" label="Job Role" value={formData.currentRole} onChange={handleChange} placeholder="e.g., Manager" required />
            <InputField icon={<FaMoneyBill />} name="currentSalary" label="Current Salary (INR)" type="number" value={formData.currentSalary} onChange={handleChange} placeholder="e.g., 85000" required />
            <InputField icon={<FaCalendarAlt />} name="joiningDate" label="Joining Date" type="date" value={formData.joiningDate} onChange={handleChange} required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border rounded-xl bg-purple-50/50 shadow-inner">
            <h3 className="md:col-span-2 text-xl font-bold text-purple-700 border-b pb-3 mb-3">Personal & Bank Details</h3>
            <InputField icon={<FaBirthdayCake />} name="personalDetails.dob" label="Date of Birth" type="date" value={formData.personalDetails.dob} onChange={handleChange} />
            <InputField icon={<FaFlag />} name="personalDetails.nationality" label="Nationality" value={formData.personalDetails.nationality} onChange={handleChange} placeholder="e.g., Indian" />
            <InputField icon={<FaCreditCard />} name="bankDetails.accountNumber" label="Account Number" value={formData.bankDetails.accountNumber} onChange={handleChange} placeholder="e.g., 1234567890" maxLength={18} />
            <InputField icon={<FaUniversity />} name="bankDetails.bankName" label="Bank Name" value={formData.bankDetails.bankName} onChange={handleChange} placeholder="e.g., SBI" />
            <InputField icon={<FaCodeBranch />} name="bankDetails.ifsc" label="IFSC Code" value={formData.bankDetails.ifsc} onChange={handleChange} placeholder="e.g., SBIN0001234" maxLength={11} />
            <InputField icon={<FaMapMarkerAlt />} name="bankDetails.branch" label="Branch" value={formData.bankDetails.branch} onChange={handleChange} placeholder="e.g., Hyderabad Main" />
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 shadow-lg text-lg">
            Add Employee
          </button>
        </form>
      </div>

      {snackbar.message && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fadein">
          {snackbar.message}
        </div>
      )}

      {/* ADD COMPANY MODAL */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-blue-800">Add New Company</h3>
              <button
                type="button"
                onClick={() => setShowAddCompanyModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleAddCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={newCompanyData.name}
                  onChange={(e) => setNewCompanyData({ ...newCompanyData, name: e.target.value })}
                  placeholder="e.g., ARAH Infotech"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Employee ID Prefix (3-4 chars) *</label>
                <input
                  type="text"
                  value={newCompanyData.prefix}
                  onChange={(e) => setNewCompanyData({ ...newCompanyData, prefix: e.target.value.toUpperCase() })}
                  placeholder="e.g., ARA"
                  maxLength={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  value={newCompanyData.description}
                  onChange={(e) => setNewCompanyData({ ...newCompanyData, description: e.target.value })}
                  placeholder="Optional: Brief description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  rows="2"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newCompanyData.email}
                  onChange={(e) => setNewCompanyData({ ...newCompanyData, email: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newCompanyData.phone}
                  onChange={(e) => setNewCompanyData({ ...newCompanyData, phone: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={newCompanyData.address}
                  onChange={(e) => setNewCompanyData({ ...newCompanyData, address: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={newCompanyData.city}
                    onChange={(e) => setNewCompanyData({ ...newCompanyData, city: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={newCompanyData.state}
                    onChange={(e) => setNewCompanyData({ ...newCompanyData, state: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Zip Code</label>
                  <input
                    type="text"
                    value={newCompanyData.zipCode}
                    onChange={(e) => setNewCompanyData({ ...newCompanyData, zipCode: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={newCompanyData.country}
                    onChange={(e) => setNewCompanyData({ ...newCompanyData, country: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddCompanyModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingCompany}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {addingCompany ? "Adding..." : "Add Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ NEW: EDIT COMPANY MODAL */}
      {showEditCompanyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-blue-800">Edit Company</h3>
              <button
                type="button"
                onClick={() => setShowEditCompanyModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleUpdateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={editCompanyData.name}
                  onChange={(e) => setEditCompanyData({ ...editCompanyData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Employee ID Prefix (3-4 chars) *</label>
                <input
                  type="text"
                  value={editCompanyData.prefix}
                  onChange={(e) => setEditCompanyData({ ...editCompanyData, prefix: e.target.value.toUpperCase() })}
                  maxLength={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  value={editCompanyData.description}
                  onChange={(e) => setEditCompanyData({ ...editCompanyData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  rows="2"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editCompanyData.email}
                  onChange={(e) => setEditCompanyData({ ...editCompanyData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editCompanyData.phone}
                  onChange={(e) => setEditCompanyData({ ...editCompanyData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={editCompanyData.address}
                  onChange={(e) => setEditCompanyData({ ...editCompanyData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={editCompanyData.city}
                    onChange={(e) => setEditCompanyData({ ...editCompanyData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={editCompanyData.state}
                    onChange={(e) => setEditCompanyData({ ...editCompanyData, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Zip Code</label>
                  <input
                    type="text"
                    value={editCompanyData.zipCode}
                    onChange={(e) => setEditCompanyData({ ...editCompanyData, zipCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={editCompanyData.country}
                    onChange={(e) => setEditCompanyData({ ...editCompanyData, country: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditCompanyModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingCompany}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {updatingCompany ? "Updating..." : "Update Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Input Component with optional End Icon and Error styling support
const InputField = ({ icon, label, endIcon, onEndIconClick, error, ...props }) => (
  <div className="relative">
    <div className={`absolute left-3 top-1/2 -translate-y-1/2 ${error ? "text-red-500" : "text-gray-400"}`}>{icon}</div>
    <label className={`absolute left-10 text-xs font-medium top-1.5 ${error ? "text-red-600" : "text-gray-500"}`}>{label}</label>
    <input
      {...props}
      className={`w-full pl-10 pt-5 pb-2 border rounded-lg outline-none bg-gray-50 transition-colors
        ${error
          ? "border-red-500 focus:ring-2 focus:ring-red-400 text-red-900 placeholder-red-300"
          : "border-gray-300 focus:ring-2 focus:ring-blue-400 text-gray-700"
        } 
        ${endIcon ? 'pr-10' : 'pr-4'}`}
    />
    {endIcon && (
      <div
        className={`absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer hover:text-gray-600 ${error ? "text-red-400" : "text-gray-400"}`}
        onClick={onEndIconClick}
      >
        {endIcon}
      </div>
    )}
    {error && <p className="text-xs text-red-600 mt-1 pl-1 font-medium">{error}</p>}
  </div>
);

export default AddEmployee;