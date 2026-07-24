import { useState, useContext, useEffect } from "react";
import { EmployeeContext } from "../context/EmployeeContext";
import { useNavigate, useParams } from "react-router-dom";
import { FaUser, FaBuilding, FaCalendarAlt, FaBriefcase, FaArrowLeft, FaMoneyBillWave } from "react-icons/fa";

const ReactivateEmployee = () => {
  const { id } = useParams();
  const { employees, editEmployee } = useContext(EmployeeContext);
  const navigate = useNavigate();
  const [snackbar, setSnackbar] = useState("");
  const [formData, setFormData] = useState({
    department: "",
    role: "",
    salary: "",
    joiningDate: "",
    employmentType: ""
  });
  const [employee, setEmployee] = useState(null);

  useEffect(() => {
    const emp = employees.find(e => e.employeeId === id);
    if (emp) {
      setEmployee(emp);
      // Find last experience (most recent)
      const lastExp = Array.isArray(emp.experienceDetails) && emp.experienceDetails.length > 0
        ? emp.experienceDetails[emp.experienceDetails.length - 1]
        : {};
      setFormData({
        department: lastExp.department || "",
        role: lastExp.role || "",
        salary: lastExp.salary ? lastExp.salary.toString() : "",
        joiningDate: "",
        employmentType: ""
      });
    }
  }, [id, employees]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validate = () => {
    if (!formData.department.trim()) return "Department is required.";
    if (!formData.role.trim()) return "Role is required.";
    if (!formData.salary.trim() || isNaN(formData.salary)) return "Valid salary is required.";
    if (!formData.joiningDate) return "Joining Date is required.";
    if (!formData.employmentType) return "Employment Type is required.";
    return "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setSnackbar(err);
      setTimeout(() => setSnackbar("") , 2500);
      return;
    }
    // Close out previous employment
    const today = new Date().toISOString().split('T')[0];
    let updatedExpDetails = Array.isArray(employee.experienceDetails)
      ? employee.experienceDetails.map((exp, idx, arr) => {
          // Only update the last experience (most recent)
          if (idx === arr.length - 1 && exp.lastWorkingDate === "Present") {
            return { ...exp, lastWorkingDate: today };
          }
          return exp;
        })
      : [];
    // Add new experience object for reactivation
    const newExp = {
      company: "Vagarious Solutions Pvt. Ltd.",
      department: formData.department,
      role: formData.role,
      joiningDate: formData.joiningDate,
      lastWorkingDate: "Present", // Ensure this is always 'Present'
      salary: parseFloat(formData.salary) || 0,
      years: 0,
      employmentType: formData.employmentType
    };
    const updatedEmployee = {
      ...employee,
      isActive: true,
      experienceDetails: [...updatedExpDetails, newExp]
    };
    editEmployee(id, updatedEmployee);
    setSnackbar("Employee reactivated successfully.");
    setTimeout(() => {
      navigate("/employees");
    }, 1800);
  };

  if (!employee) {
    return (
      <div className="p-6 flex flex-col items-center justify-center">
        <p className="text-red-600 font-semibold">Employee not found.</p>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Go Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100">
      <div className="bg-white px-8 py-8 rounded-xl shadow-2xl w-full max-w-xl border border-gray-100 flex flex-col justify-center">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-blue-800 flex items-center gap-2">
            <FaBriefcase /> Reactivate Employee
          </h2>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 border border-gray-300 shadow-sm flex items-center gap-1"
          >
            <FaArrowLeft /> Back
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <FaUser className="absolute left-3 top-4 text-gray-400" />
              <input
                type="text"
                value={employee.employeeId}
                disabled
                className="w-full pl-10 pr-4 pt-5 pb-2 border border-gray-200 rounded-md bg-gray-100 text-gray-600 text-sm"
                placeholder="Employee ID"
              />
            </div>
            <div className="relative">
              <FaUser className="absolute left-3 top-4 text-gray-400" />
              <input
                type="text"
                value={employee.name}
                disabled
                className="w-full pl-10 pr-4 pt-5 pb-2 border border-gray-200 rounded-md bg-gray-100 text-gray-600 text-sm"
                placeholder="Full Name"
              />
            </div>
            <div className="relative">
              <FaBuilding className="absolute left-3 top-4 text-gray-400" />
              <input
                type="text"
                name="department"
                placeholder="Department *"
                value={formData.department}
                onChange={handleChange}
                className="w-full pl-10 pr-4 pt-5 pb-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-400 outline-none bg-gray-50 text-sm"
                required
              />
            </div>
            <div className="relative">
              <FaBriefcase className="absolute left-3 top-4 text-gray-400" />
              <input
                type="text"
                name="role"
                placeholder="Role *"
                value={formData.role}
                onChange={handleChange}
                className="w-full pl-10 pr-4 pt-5 pb-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-400 outline-none bg-gray-50 text-sm"
                required
              />
            </div>
            <div className="relative">
              <FaMoneyBillWave className="absolute left-3 top-4 text-gray-400" />
              <input
                type="number"
                name="salary"
                placeholder="Salary *"
                value={formData.salary}
                onChange={handleChange}
                className="w-full pl-10 pr-4 pt-5 pb-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-green-400 outline-none bg-gray-50 text-sm"
                required
                min="0"
              />
            </div>
            <div className="relative">
              <FaCalendarAlt className="absolute left-3 top-4 text-gray-400" />
              <input
                type="date"
                name="joiningDate"
                placeholder="Joining Date *"
                value={formData.joiningDate}
                onChange={handleChange}
                className="w-full pl-10 pr-4 pt-5 pb-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-400 outline-none bg-gray-50 text-sm"
                required
              />
            </div>
            <div className="relative">
              <FaBriefcase className="absolute left-3 top-4 text-gray-400" />
              <label htmlFor="employmentType" className="absolute left-10 text-xs text-gray-500 font-medium top-1.5">
                Employment Type <span className="text-red-600 ml-1 font-bold" title="Required">*</span>
              </label>
              <select
                id="employmentType"
                name="employmentType"
                value={formData.employmentType}
                onChange={handleChange}
                className="w-full pl-10 pr-4 pt-5 pb-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-400 outline-none bg-gray-50 text-sm"
                required
              >
                <option value="">Select Employment Type</option>
                <option value="Full-Time">Full-Time</option>
                <option value="Part-Time">Part-Time</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800 transition duration-200 shadow text-base"
            >
              Reactivate Employee
            </button>
          </div>
        </form>
        {snackbar && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded shadow-lg z-50 animate-fadein">
            {snackbar}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReactivateEmployee;