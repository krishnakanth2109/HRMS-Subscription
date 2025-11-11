// --- START OF FILE AddEmployee.jsx ---

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUser, FaEnvelope, FaBuilding, FaIdBadge, FaPhone, FaMapMarkerAlt,
  FaCalendarAlt, FaBriefcase, FaMoneyBill, FaBirthdayCake, FaFlag,
  FaHeartbeat, FaUniversity, FaCreditCard, FaCodeBranch
} from "react-icons/fa";
// ✅ IMPORT THE CENTRALIZED API FUNCTIONS
import { getEmployees, addEmployee } from "../api";

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

  // Fetch employees (for duplicate ID/email check) using the API service
  useEffect(() => {
    const fetchExistingEmployees = async () => {
      try {
        // ✅ USE THE IMPORTED API FUNCTION
        const data = await getEmployees();
        setEmployees(data);
      } catch (err) {
        console.error("Error fetching employees:", err);
      }
    };
    fetchExistingEmployees();
  }, []);

  // Form state
  const [formData, setFormData] = useState({
    employeeId: "", name: "", email: "", password: "", employmentType: "Full-Time",
    phone: "", address: "", joiningDate: "", emergency: "",
    bankDetails: { accountNumber: "", bankName: "", ifsc: "", branch: "" },
    personalDetails: { dob: "", gender: "Male", maritalStatus: "Single", nationality: "" },
    currentRole: "", currentDepartment: "", currentSalary: "",
  });

  const [error, setError] = useState("");

  // Handle form input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("bankDetails.")) {
      const field = name.split(".")[1];
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
    if (!formData.name.trim()) return "Full Name is required.";
    if (!formData.email.trim()) return "Email is required.";
    if (!formData.password.trim()) return "Password is required.";
    if (formData.password.length < 8) return "Password must be at least 8 characters.";
    if (!formData.currentDepartment.trim()) return "Department is required.";
    if (!formData.currentRole.trim()) return "Role is required.";
    if (!formData.joiningDate) return "Joining Date is required.";
    if (!formData.currentSalary || isNaN(formData.currentSalary)) return "Salary is required.";

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
      employeeId: formData.employeeId || `EMP${String(employees.length + 1).padStart(3, "0")}`,
      name: formData.name, email: formData.email, password: formData.password,
      phone: formData.phone, address: formData.address, emergency: formData.emergency,
      isActive: true, bankDetails: formData.bankDetails, personalDetails: formData.personalDetails,
      experienceDetails: [{
        company: "Vagarious Solutions Pvt Ltd.", role: formData.currentRole, department: formData.currentDepartment,
        years: 0, joiningDate: formData.joiningDate, lastWorkingDate: "Present",
        salary: parseFloat(formData.currentSalary) || 0, employmentType: formData.employmentType,
      }],
    };

    try {
      // ✅ USE THE IMPORTED API FUNCTION
      await addEmployee(newEmployee);
      snackbar.show("Employee added successfully!");
      navigate("/employees");
    } catch (err) {
      console.error(err);
      snackbar.show("Error adding employee. Try again!");
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border rounded-xl bg-blue-50/50 shadow-inner">
            <h3 className="md:col-span-2 text-xl font-bold text-blue-700 border-b pb-3 mb-3">Basic Information</h3>
            <InputField icon={<FaIdBadge />} name="employeeId" label="Employee ID (optional)" value={formData.employeeId} onChange={handleChange} placeholder="Enter Employee ID" />
            <InputField icon={<FaUser />} name="name" label="Full Name" value={formData.name} onChange={handleChange} placeholder="e.g., John Doe" required />
            <InputField icon={<FaIdBadge />} name="password" label="Password" type="password" value={formData.password} onChange={handleChange} placeholder="Enter password" required />
            <InputField icon={<FaEnvelope />} name="email" label="Email Address" type="email" value={formData.email} onChange={handleChange} placeholder="e.g., john@example.com" required />
            <InputField icon={<FaPhone />} name="phone" label="Phone Number" type="tel" value={formData.phone} onChange={handleChange} placeholder="e.g., 9876543210" />
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
            <InputField icon={<FaCreditCard />} name="bankDetails.accountNumber" label="Account Number" value={formData.bankDetails.accountNumber} onChange={handleChange} placeholder="e.g., 1234567890" />
            <InputField icon={<FaUniversity />} name="bankDetails.bankName" label="Bank Name" value={formData.bankDetails.bankName} onChange={handleChange} placeholder="e.g., SBI" />
            <InputField icon={<FaCodeBranch />} name="bankDetails.ifsc" label="IFSC Code" value={formData.bankDetails.ifsc} onChange={handleChange} placeholder="e.g., SBIN0001234" />
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
    </div>
  );
};

// Input Component
const InputField = ({ icon, label, ...props }) => (
  <div className="relative">
    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>
    <label className="absolute left-10 text-xs text-gray-500 font-medium top-1.5">{label}</label>
    <input {...props} className="w-full pl-10 pr-4 pt-5 pb-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-gray-50 border-gray-300" />
  </div>
);

export default AddEmployee;