// --- START OF FILE EmployeeProvider.jsx ---

import { useState, useEffect, useCallback, useContext } from "react";
import { EmployeeContext } from "./EmployeeContext";
import { AuthContext } from "../context/AuthContext";   // ⭐ Added
import {
  getEmployees,
  addEmployee as addEmployeeAPI,
  updateEmployeeById,
  deactivateEmployeeById,
  activateEmployeeById,
} from "../api";

export const EmployeeProvider = ({ children }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { user } = useContext(AuthContext);      // ⭐ User available after login
  const token = sessionStorage.getItem("hrms-token"); // ⭐ Read token

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);

      const data = await getEmployees();   // This will now include token
      setEmployees(data);

    } catch (err) {
      console.error("Error fetching employees:", err);
      setError("Failed to fetch employee data");
    } finally {
      setLoading(false);
    }
  }, []);

  // ⭐ FIX — Only fetch when token + user are loaded
  useEffect(() => {
    if (!token || !user) return;
    fetchEmployees();
  }, [token, user, fetchEmployees]);

  const addEmployee = async (employee) => {
    try {
      const newEmployee = await addEmployeeAPI(employee);
      setEmployees((prev) => [...prev, newEmployee]);
    } catch (err) {
      console.error("Error adding employee:", err);
      alert("Failed to add employee.");
    }
  };

  const editEmployee = async (employeeId, updatedData) => {
    try {
      const updatedEmployee = await updateEmployeeById(employeeId, updatedData);
      setEmployees((prev) =>
        prev.map((emp) => (emp.employeeId === employeeId ? updatedEmployee : emp))
      );
    } catch (err) {
      console.error("Error updating employee:", err);
    }
  };

  const deactivateEmployment = async (employeeId, endDate, reason) => {
    try {
      const deactivatedEmployee = await deactivateEmployeeById(employeeId, {
        endDate,
        reason,
      });
      setEmployees((prev) =>
        prev.map((emp) => (emp.employeeId === employeeId ? deactivatedEmployee : emp))
      );
    } catch (err) {
      console.error("Error deactivating employee:", err);
    }
  };

  const activateEmployee = async (employeeId) => {
    try {
      const activatedEmployee = await activateEmployeeById(employeeId);
      setEmployees((prev) =>
        prev.map((emp) => (emp.employeeId === employeeId ? activatedEmployee : emp))
      );
    } catch (err) {
      console.error("Error activating employee:", err);
    }
  };

  const getEmployeeById = (employeeId) =>
    employees.find((emp) => emp.employeeId === employeeId);

  const contextValue = {
    employees,
    loading,
    error,
    addEmployee,
    editEmployee,
    deactivateEmployment,
    activateEmployee,
    getEmployeeById,
  };

  if (loading) return <p>Loading application data...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <EmployeeContext.Provider value={contextValue}>
      {children}
    </EmployeeContext.Provider>
  );
};

// --- END OF FILE EmployeeProvider.jsx ---
