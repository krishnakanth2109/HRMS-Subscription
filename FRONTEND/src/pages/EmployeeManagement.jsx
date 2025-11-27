// --- START OF FILE EmployeeManagement.jsx ---

import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect, useCallback, useRef } from "react"; 
import { FaUser, FaEdit, FaTrash, FaRedo, FaDownload } from "react-icons/fa";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
// ✅ IMPORT THE CENTRALIZED API FUNCTIONS
import { getEmployees, deactivateEmployeeById, activateEmployeeById } from "../api";

// Department color mapping
const DEPARTMENT_COLORS = {
  HR: { bg: "bg-pink-100", text: "text-pink-700" },
  Engineering: { bg: "bg-blue-100", text: "text-blue-700" },
  Sales: { bg: "bg-green-100", text: "text-green-700" }, 
  Marketing: { bg: "bg-yellow-100", text: "text-yellow-700" },
  Finance: { bg: "bg-purple-100", text: "text-purple-700" },
  IT: { bg: "bg-blue-100", text: "text-blue-700" },
  Admin: { bg: "bg-gray-100", text: "text-gray-700" },
  Operations: { bg: "bg-orange-100", text: "text-orange-700" },
};

// Helper to get current department
const getCurrentDepartment = (employee) => {
  if (employee && Array.isArray(employee.experienceDetails)) {
    const currentExp = employee.experienceDetails.find(exp => exp.lastWorkingDate === "Present");
    return currentExp?.department || "";
  }
  return "";
};

// Client-side Excel download function
const downloadExcelReport = (data, filename) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, filename);
};


// ✅ ACTIVE EmployeeRow Component
const EmployeeRow = ({ emp, idx, navigate, onDeactivateClick }) => {
  const isEven = idx % 2 === 0;
  const currentDepartment = getCurrentDepartment(emp);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Effect to close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <tr className={`border-t transition duration-150 ${isEven ? "bg-gray-50" : "bg-white"} hover:bg-blue-50`}>
      <td className="p-4 font-mono font-semibold text-blue-700">{emp.employeeId}</td>
      <td className="p-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-blue-700 font-bold border border-gray-300">
          {emp.name?.split(" ").map((n) => n[0]).join("")}
        </div>
        <span className="font-semibold text-gray-800">{emp.name}</span>
      </td>
      <td className="p-4">
        <span className={`px-2 py-1 rounded text-xs font-bold ${DEPARTMENT_COLORS[currentDepartment]?.bg || "bg-gray-100"} ${DEPARTMENT_COLORS[currentDepartment]?.text || "text-gray-700"}`}>
          {currentDepartment || "Unknown"}
        </span>
      </td>
      <td className="p-4 text-gray-700">{emp.email}</td>
      <td className="p-4">
        <div className="relative" ref={menuRef}>
          {/* Actions button to toggle the dropdown */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200 flex items-center gap-2 font-semibold shadow"
          >
            Actions
            <svg className={`w-4 h-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          
          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border">
              <div className="py-1">
                <button
                  onClick={() => {
                    navigate(`/employee/${emp.employeeId}/profile`);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-3"
                >
                  <FaUser /> Profile
                </button>
                <button
                  onClick={() => {
                    navigate(`/employees/edit/${emp.employeeId}`);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 flex items-center gap-3"
                >
                  <FaEdit /> Edit
                </button>
                <button
                  onClick={() => {
                    onDeactivateClick(emp);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-orange-700 hover:bg-orange-50 flex items-center gap-3"
                >
                  <FaTrash /> Deactivate
                </button>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};

// ✅ INACTIVE Employee Row (Colored differently and at bottom)
const InactiveEmployeeRow = ({ emp, navigate, onReactivateClick }) => {
  const currentDepartment = getCurrentDepartment(emp);
  
  return (
    <tr className="border-t transition duration-150 bg-gray-300 opacity-75 hover:opacity-100 hover:bg-gray-400">
      <td className="p-4 font-mono font-semibold text-gray-700">{emp.employeeId}</td>
      <td className="p-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white font-bold border border-gray-600">
          {emp.name?.split(" ").map((n) => n[0]).join("")}
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-gray-800">{emp.name}</span>
          <span className="text-xs text-red-700 font-bold uppercase">Deactivated</span>
        </div>
      </td>
      <td className="p-4">
        <span className={`px-2 py-1 rounded text-xs font-bold ${DEPARTMENT_COLORS[currentDepartment]?.bg || "bg-gray-400"} ${DEPARTMENT_COLORS[currentDepartment]?.text || "text-gray-700"}`}>
          {currentDepartment || "Unknown"}
        </span>
      </td>
      <td className="p-4 text-gray-800">{emp.email}</td>
      <td className="p-4">
        <div className="flex flex-row items-center gap-2">
          <button onClick={() => navigate(`/employee/${emp.employeeId}/profile`)} className="bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 flex items-center gap-1 font-semibold shadow">
            <FaUser /> Profile
          </button>
          <button onClick={() => onReactivateClick(emp)} className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 flex items-center gap-1 font-semibold shadow">
            <FaRedo /> Reactivate
          </button>
        </div>
      </td>
    </tr>
  );
};

// Deactivate Modal
function DeactivateModal({ open, employee, onClose, onSubmit }) {
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (!open || !employee) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!endDate || !reason.trim()) {
      setError("All fields are required.");
      return;
    }
    setError("");
    onSubmit({ endDate, reason });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-2">Deactivate Employee</h3>
        <p className="mb-4 text-gray-600">You are deactivating <b>{employee.name}</b>. This will disable their login access.</p>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Deactivation Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="border border-gray-300 px-3 py-2 rounded w-full mt-1" 
              required 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Reason</label>
            <textarea 
              value={reason} 
              onChange={(e) => setReason(e.target.value)} 
              className="border border-gray-300 px-3 py-2 rounded w-full mt-1" 
              rows={3} 
              placeholder="e.g. Resigned, Terminated, Absconded" 
              required 
            />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}
          
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 font-semibold text-gray-700">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 font-semibold">Deactivate</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ✅ NEW: Reactivate Modal
function ReactivateModal({ open, employee, onClose, onSubmit }) {
  // Initialize with today's date
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().split("T")[0]);
      setReason("");
      setError("");
    }
  }, [open]);

  if (!open || !employee) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!date || !reason.trim()) {
      setError("All fields are required.");
      return;
    }
    setError("");
    onSubmit({ date, reason });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-2">Reactivate Employee</h3>
        <p className="mb-4 text-gray-600">You are reactivating <b>{employee.name}</b>. They will regain access to the system.</p>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Reactivation Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="border border-gray-300 px-3 py-2 rounded w-full mt-1" 
              required 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Reason for Reactivation</label>
            <textarea 
              value={reason} 
              onChange={(e) => setReason(e.target.value)} 
              className="border border-gray-300 px-3 py-2 rounded w-full mt-1" 
              rows={3} 
              placeholder="e.g. Rejoined, Returned from leave, Contract renewed" 
              required 
            />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}
          
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 font-semibold text-gray-700">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 font-semibold">Reactivate</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Main Page Component
const EmployeeManagement = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  
  // Modal States
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [reactivateModalOpen, setReactivateModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Fetch employees using the centralized API
  const fetchEmployees = useCallback(async () => {
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Deactivate employee submit handler
  const handleDeactivateSubmit = async ({ endDate, reason }) => {
    try {
      await deactivateEmployeeById(selectedEmployee.employeeId, { endDate, reason });
      fetchEmployees(); 
      setDeactivateModalOpen(false);
      setSelectedEmployee(null);
    } catch (e) {
      alert("❌ Error deactivating employee");
      console.error(e);
    }
  };

  // ✅ Reactivate employee submit handler
  const handleReactivateSubmit = async ({ date, reason }) => {
    try {
      // Calls API with id, date, and reason
      await activateEmployeeById(selectedEmployee.employeeId, { date, reason });
      fetchEmployees(); 
      setReactivateModalOpen(false);
      setSelectedEmployee(null);
    } catch (e) {
      alert("❌ Error reactivating employee");
      console.error(e);
    }
  };

  // Open Handlers
  const openDeactivateModal = (emp) => {
    setSelectedEmployee(emp);
    setDeactivateModalOpen(true);
  };

  const openReactivateModal = (emp) => {
    setSelectedEmployee(emp);
    setReactivateModalOpen(true);
  };

  // Filters
  const departmentSet = useMemo(() => {
    const depts = employees.map(emp => getCurrentDepartment(emp)).filter((dept, idx, arr) => dept && arr.indexOf(dept) === idx);
    return depts.sort();
  }, [employees]);

  const { activeEmployees, inactiveEmployees } = useMemo(() => {
    const filtered = employees.filter((emp) => {
      const currentDepartment = getCurrentDepartment(emp);
      const matchesSearch = [emp.employeeId, emp.name, currentDepartment, emp.email].some((field) => (field ?? "").toString().toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesDept = selectedDept === "All" || currentDepartment === selectedDept;
      return matchesSearch && matchesDept;
    });
    
    return {
      activeEmployees: filtered.filter((emp) => emp.isActive !== false),
      inactiveEmployees: filtered.filter((emp) => emp.isActive === false),
    };
  }, [employees, searchQuery, selectedDept]);

  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col items-center justify-center py-0">
      <div className="w-full max-w-7xl mx-auto py-12">
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
          <div className="flex flex-col gap-2 md:gap-4">
            <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Employee Management</h2>
            <div className="flex flex-row gap-2 mt-2">
              <button onClick={() => downloadExcelReport(activeEmployees, "Active_Employees_Report.xlsx")} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 shadow font-semibold">
                <FaDownload /> Active Employees
              </button>
              <button onClick={() => downloadExcelReport(inactiveEmployees, "Inactive_Employees_Report.xlsx")} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 shadow font-semibold">
                <FaDownload /> Inactive Employees
              </button>
            </div>
          </div>
          <button onClick={() => navigate("/employees/add")} className="bg-blue-700 text-white px-6 py-3 rounded-lg hover:bg-blue-800 flex items-center gap-2 shadow font-semibold">
            <FaUser /> Add Employee
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-10 items-center">
          <input type="text" placeholder="Search by ID, Name, Department, or Email" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full max-w-md border border-gray-300 px-4 py-2 rounded-lg shadow focus:outline-none focus:ring focus:ring-blue-200" />
          <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="border border-gray-300 px-4 py-2 rounded-lg w-full max-w-xs shadow focus:outline-none focus:ring focus:ring-blue-200 font-semibold">
            <option value="All">All Departments</option>
            {departmentSet.map((dept) => (<option key={dept} value={dept}>{dept}</option>))}
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl shadow bg-white">
          <table className="min-w-full rounded-xl">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100 text-left">
                <th className="p-4">ID</th>
                <th className="p-4">Name</th>
                <th className="p-4">Department</th>
                <th className="p-4">Email</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeEmployees.length > 0 || inactiveEmployees.length > 0 ? (
                <>
                  {/* Active Employees First */}
                  {activeEmployees.map((emp, idx) => (
                    <EmployeeRow key={`${emp.employeeId}-${emp.email}`} emp={emp} idx={idx} navigate={navigate} onDeactivateClick={openDeactivateModal} />
                  ))}
                  
                  {/* Separator if both exist */}
                  {activeEmployees.length > 0 && inactiveEmployees.length > 0 && (
                     <tr><td colSpan="5" className="bg-gray-200 p-2 text-center font-bold text-gray-600">INACTIVE EMPLOYEES</td></tr>
                  )}

                  {/* Inactive Employees at the Bottom */}
                  {inactiveEmployees.map((emp) => (
                    <InactiveEmployeeRow key={`${emp.employeeId}-${emp.email}-inactive`} emp={emp} navigate={navigate} onReactivateClick={openReactivateModal} />
                  ))}
                </>
              ) : (
                <tr><td colSpan="5" className="p-4 text-center text-gray-500">No matching employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Deactivate Modal */}
        <DeactivateModal 
          open={deactivateModalOpen} 
          employee={selectedEmployee} 
          onClose={() => setDeactivateModalOpen(false)} 
          onSubmit={handleDeactivateSubmit} 
        />

        {/* ✅ Reactivate Modal */}
        <ReactivateModal 
          open={reactivateModalOpen} 
          employee={selectedEmployee} 
          onClose={() => setReactivateModalOpen(false)} 
          onSubmit={handleReactivateSubmit} 
        />
      </div>
    </div>
  );
};

export default EmployeeManagement;
// --- END OF FILE EmployeeManagement.jsx ---