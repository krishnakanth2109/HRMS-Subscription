// --- START OF FILE src/pages/EditEmployee.jsx ---

import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { FaUser, FaEnvelope, FaBuilding, FaMoneyBill, FaCalendarAlt, FaCreditCard, FaIdBadge, FaBriefcase, FaPhone, FaMapMarkerAlt, FaFileContract } from "react-icons/fa";
import { getEmployeeById, updateEmployeeById } from "../api.js"; 

const EditEmployee = () => {
  const { id } = useParams(); 
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [formData, setFormData] = useState(null);
  const [snackbar, setSnackbar] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const emp = await getEmployeeById(id);
        const currentExp = emp.experienceDetails?.find(exp => exp.lastWorkingDate === "Present") || {};

        setEmployee(emp);
        setFormData({
          employeeId: emp.employeeId || "", 
          name: emp.name || "",
          email: emp.email || "",
          phone: emp.phone || "",
          address: emp.address || "",
          emergency: emp.emergency || "", 
          personalDetails: emp.personalDetails || {},
          bankDetails: emp.bankDetails || {},
          experienceDetails: emp.experienceDetails || [],
          // ✅ Updated: Fetch Employment Type
          currentDepartment: emp.currentDepartment || currentExp.department || "",
          currentRole: emp.currentRole || currentExp.role || "",
          currentSalary: emp.currentSalary || currentExp.salary || "",
          currentEmploymentType: currentExp.employmentType || "Full-Time", // Default if missing
          joiningDate: emp.joiningDate || currentExp.joiningDate || "",
          experienceLetterUrl: currentExp.experienceLetterUrl || ""
        });
      } catch (err) {
        console.error("Failed to fetch employee:", err);
        setError("Could not load employee data.");
      }
    };

    fetchEmployee();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("bankDetails.")) {
      const key = name.split(".")[1];
      setFormData(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, [key]: value } }));
    }
    else if (name.startsWith("personalDetails.")) {
      const key = name.split(".")[1];
      setFormData(prev => ({ ...prev, personalDetails: { ...prev.personalDetails, [key]: value } }));
    }
    else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...employee,
      ...formData,
      employeeId: formData.employeeId, 
      currentDepartment: formData.currentDepartment,
      currentRole: formData.currentRole,
      currentSalary: formData.currentSalary,
      joiningDate: formData.joiningDate,
      experienceDetails: formData.experienceDetails.map(exp => {
        if (exp.lastWorkingDate === "Present") {
          return {
            ...exp,
            department: formData.currentDepartment,
            role: formData.currentRole,
            salary: formData.currentSalary,
            joiningDate: formData.joiningDate,
            employmentType: formData.currentEmploymentType, // ✅ Save Employment Type
            experienceLetterUrl: formData.experienceLetterUrl
          };
        }
        return exp;
      })
    };

    try {
      await updateEmployeeById(id, payload);
      setSnackbar("✅ Employee updated successfully");
      setTimeout(() => navigate(-1), 1500);
    } catch (err) {
      console.error("Update failed:", err);
      setSnackbar("❌ Update failed");
    }
  };

  if (error) return <div className="p-6 text-lg text-center text-red-500 font-bold mt-10">{error}</div>;
  if (!formData) return <div className="p-6 text-lg text-center mt-10 text-gray-500">Loading Employee Data...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-4xl border border-gray-100">
        
        <div className="flex items-center justify-between mb-8 border-b pb-4">
            <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-blue-600 font-semibold transition-colors flex items-center gap-1">
               ← Back
            </button>
            <h2 className="text-3xl font-extrabold text-gray-800">Edit Employee</h2>
            <div className="w-16"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField 
                icon={<FaIdBadge className="text-blue-500"/>} 
                name="employeeId" 
                label="Employee ID" 
                value={formData.employeeId} 
                onChange={handleChange} 
                readOnly
                className="bg-gray-100 cursor-not-allowed text-gray-500 font-mono"
              />
              <InputField icon={<FaUser className="text-blue-500"/>} name="name" label="Full Name" value={formData.name} onChange={handleChange} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField icon={<FaEnvelope className="text-blue-500"/>} name="email" type="email" label="Email Address" value={formData.email} onChange={handleChange} />
              <InputField icon={<FaPhone className="text-blue-500"/>} name="phone" label="Phone Number" value={formData.phone} onChange={handleChange} />
          </div>

          <hr className="border-dashed border-gray-200" />

          <h3 className="text-lg font-bold text-gray-700 mb-2">Professional Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField icon={<FaBriefcase className="text-purple-500"/>} name="currentRole" label="Job Role" value={formData.currentRole} onChange={handleChange} placeholder="e.g. Senior Developer" />
              <InputField icon={<FaBuilding className="text-purple-500"/>} name="currentDepartment" label="Department" value={formData.currentDepartment} onChange={handleChange} placeholder="e.g. Engineering" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField icon={<FaMoneyBill className="text-green-500"/>} name="currentSalary" type="number" label="Salary" value={formData.currentSalary} onChange={handleChange} />
              
              {/* ✅ NEW: Employment Type Dropdown */}
              <div className="relative group">
                <div className="absolute left-3 top-[2.4rem] -translate-y-1/2 transition-colors group-focus-within:text-blue-600">
                    <FaFileContract className="text-green-500"/>
                </div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 ml-1">Employment Type</label>
                <select 
                  name="currentEmploymentType" 
                  value={formData.currentEmploymentType} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none transition-all shadow-sm text-gray-700 bg-white"
                >
                  <option value="Full-Time">Full-Time</option>
                  <option value="Contract">Contract</option>
                  <option value="Intern">Intern</option>
 
                </select>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <InputField icon={<FaCalendarAlt className="text-orange-500"/>} name="joiningDate" type="date" label="Joining Date" value={formData.joiningDate?.substring(0,10)} onChange={handleChange} />
          </div>

          <hr className="border-dashed border-gray-200" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField icon={<FaCreditCard className="text-gray-500"/>} name="bankDetails.accountNumber" label="Bank Account Number" value={formData.bankDetails.accountNumber || ""} onChange={handleChange} />
              <InputField icon={<FaMapMarkerAlt className="text-gray-500"/>} name="address" label="Current Address" value={formData.address} onChange={handleChange} />
          </div>
          
          <div className="mt-8">
              <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg transform hover:-translate-y-0.5">
                Save Changes
              </button>
          </div>

        </form>

        {snackbar && (
          <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full text-white shadow-2xl font-semibold flex items-center gap-2 animate-bounce ${snackbar.includes("✅") ? "bg-green-600" : "bg-red-600"}`}>
            <span>{snackbar}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const InputField = ({ icon, label, className = "bg-white", ...props }) => (
  <div className="relative group">
    <div className="absolute left-3 top-[2.4rem] -translate-y-1/2 transition-colors group-focus-within:text-blue-600">
        {icon}
    </div>
    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 ml-1">{label}</label>
    <input 
      {...props} 
      className={`w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none transition-all shadow-sm text-gray-700 ${className}`}
    />
  </div>
);

export default EditEmployee;