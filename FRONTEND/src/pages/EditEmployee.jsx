// --- START OF FILE EditEmployee.jsx ---

import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { FaUser, FaEnvelope, FaBuilding, FaMoneyBill, FaCalendarAlt, FaCreditCard } from "react-icons/fa";
// Import the centralized API functions
import { getEmployeeById, updateEmployeeById } from "../api.js"; 

const EditEmployee = () => {
  const { id } = useParams(); // _id from URL
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [formData, setFormData] = useState(null);
  const [snackbar, setSnackbar] = useState("");
  const [error, setError] = useState("");

  // ✅ Fetch employee from backend using the centralized API
  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const emp = await getEmployeeById(id);
        
        // get current experience
        const currentExp = emp.experienceDetails?.find(exp => exp.lastWorkingDate === "Present") || {};

        setEmployee(emp);
        setFormData({
          name: emp.name,
          email: emp.email,
          phone: emp.phone,
          address: emp.address,
          emergency: emp.emergency,
          personalDetails: emp.personalDetails || {},
          bankDetails: emp.bankDetails || {},
          experienceDetails: emp.experienceDetails || [],
          currentDepartment: emp.currentDepartment || currentExp.department || "",
          currentRole: emp.currentRole || currentExp.role || "",
          currentSalary: emp.currentSalary || currentExp.salary || "",
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

  if (error) return <div className="p-6 text-lg text-center text-red-500">{error}</div>;
  if (!formData) return <div className="p-6 text-lg text-center">Loading Employee...</div>;

  // ✅ Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;

    // nested structures
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

  // ✅ Submit updated data to backend using the centralized API
  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...employee,
      ...formData,
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

  return (
    <div className="p-6 min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl">
        <button onClick={() => navigate(-1)} className="mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors">
          ← Back
        </button>
        <h2 className="text-2xl font-bold text-center mb-6">Edit Employee</h2>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          <InputField icon={<FaUser />} name="name" label="Full Name" value={formData.name} onChange={handleChange} />
          <InputField icon={<FaEnvelope />} name="email" label="Email" value={formData.email} onChange={handleChange} />

          <InputField icon={<FaBuilding />} name="currentDepartment" label="Department" value={formData.currentDepartment} onChange={handleChange} />
          <InputField icon={<FaUser />} name="currentRole" label="Role" value={formData.currentRole} onChange={handleChange} />
          <InputField icon={<FaMoneyBill />} name="currentSalary" label="Salary" value={formData.currentSalary} onChange={handleChange} />
          <InputField icon={<FaCalendarAlt />} name="joiningDate" type="date" label="Joining Date" value={formData.joiningDate?.substring(0,10)} onChange={handleChange} />

          <InputField icon={<FaCreditCard />} name="bankDetails.accountNumber" label="Account Number" value={formData.bankDetails.accountNumber || ""} onChange={handleChange} />
          
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg w-full font-bold hover:bg-green-700 transition-colors">
            Save Changes
          </button>
        </form>

        {snackbar && (
          <div className={`mt-4 text-white px-4 py-2 rounded text-center ${snackbar.includes("✅") ? "bg-green-500" : "bg-red-500"}`}>
            {snackbar}
          </div>
        )}
      </div>
    </div>
  );
};

// Reusable input component
const InputField = ({ icon, label, ...props }) => (
  <div className="relative mb-3">
    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>
    <label className="absolute -top-2 left-8 bg-white px-1 text-xs text-gray-500">{label}</label>
    <input 
      {...props} 
      className="w-full border rounded-md pl-10 pr-4 py-2 bg-gray-50 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
    />
  </div>
);

export default EditEmployee;