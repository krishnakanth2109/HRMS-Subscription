// --- START OF FILE EmployeeProvider.jsx ---

import { useState, useEffect, useCallback, useContext } from "react";
import { EmployeeContext } from "./EmployeeContext";
import { AuthContext } from "../context/AuthContext";
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

  const { user } = useContext(AuthContext);
  const token = sessionStorage.getItem("hrms-token");

  // ⭐ Fetch Function
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      const data = await getEmployees();
      setEmployees(data);
    } catch (err) {
      console.error("Error fetching employees:", err);
      setError("Failed to fetch employee data");
    } finally {
      setLoading(false);
    }
  }, []);

  // ⭐ Initial Effect
  useEffect(() => {
    if (!token || !user) return;
    fetchEmployees();
  }, [token, user, fetchEmployees]);

  // --- CRUD Operations ---
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
    fetchEmployees, // Exposed so UI can retry if needed
  };

  // ---------------------------------------------
  // ⭐ 1. DYNAMIC LOADING UI
  // ---------------------------------------------
  if (loading) {
    return (
      <div style={styles.container}>
        <style>{animations}</style>
        <div style={styles.spinner}></div>
        <h3 style={styles.loadingText}>Loading Application Data...</h3>
        <p style={styles.subText}>Please wait while we connect to the server</p>
      </div>
    );
  }

  // ---------------------------------------------
  // ⭐ 2. "TIRED WIRES & FIRE" ERROR UI
  // ---------------------------------------------
  if (error) {
    return (
      <div style={styles.container}>
        <style>{animations}</style>
        
        {/* Visual: Broken Wire with Fire */}
        <div style={styles.illustrationBox}>
          <svg width="200" height="120" viewBox="0 0 200 120">
            {/* Left Wire (Drooping) */}
            <path 
              d="M 0 60 Q 50 60 80 90" 
              stroke="#555" 
              strokeWidth="8" 
              fill="none" 
              strokeLinecap="round"
            />
            {/* Right Wire (Drooping) */}
            <path 
              d="M 200 60 Q 150 60 120 90" 
              stroke="#555" 
              strokeWidth="8" 
              fill="none" 
              strokeLinecap="round"
            />
            
            {/* Sparks (Animated Circles) */}
            <circle cx="80" cy="90" r="3" fill="orange">
              <animate attributeName="opacity" values="1;0" dur="0.5s" repeatCount="indefinite" />
              <animate attributeName="cy" values="90;110" dur="0.5s" repeatCount="indefinite" />
              <animate attributeName="cx" values="80;70" dur="0.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="120" cy="90" r="2" fill="yellow">
              <animate attributeName="opacity" values="1;0" dur="0.3s" repeatCount="indefinite" />
              <animate attributeName="cy" values="90;70" dur="0.3s" repeatCount="indefinite" />
              <animate attributeName="cx" values="120;130" dur="0.3s" repeatCount="indefinite" />
            </circle>
          </svg>

          {/* CSS Fire Effect */}
          <div style={styles.fireWrapper}>
            <div style={styles.fireMain}></div>
            <div style={{...styles.fireMain, ...styles.fireLeft}}></div>
            <div style={{...styles.fireMain, ...styles.fireRight}}></div>
          </div>
        </div>

        <h2 style={styles.errorTitle}>Something Went Wrong!</h2>
        <p style={styles.errorText}>
           We failed to fetch the employee data.
        </p>

        {/* Retry Button */}
        <button 
          onClick={fetchEmployees}
          style={styles.retryButton}
          onMouseOver={(e) => e.target.style.transform = "scale(1.05)"}
          onMouseOut={(e) => e.target.style.transform = "scale(1)"}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <EmployeeContext.Provider value={contextValue}>
      {children}
    </EmployeeContext.Provider>
  );
};

// --- CSS IN JS STYLES ---

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    width: "100%",
    backgroundColor: "#f9fafb",
    position: "fixed",
    top: 0,
    left: 0,
    zIndex: 9999,
    fontFamily: "'Segoe UI', Roboto, sans-serif",
  },
  // --- Loading Styles ---
  spinner: {
    width: "50px",
    height: "50px",
    border: "4px solid #e5e7eb",
    borderTop: "4px solid #3b82f6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: "20px",
  },
  loadingText: {
    color: "#374151",
    fontSize: "1.25rem",
    fontWeight: "600",
    marginBottom: "0.5rem",
    animation: "pulse 2s infinite",
  },
  subText: {
    color: "#6b7280",
    fontSize: "0.9rem",
  },
  // --- Error Styles ---
  illustrationBox: {
    position: "relative",
    width: "200px",
    height: "120px",
    marginBottom: "20px",
  },
  fireWrapper: {
    position: "absolute",
    left: "50%",
    top: "70%",
    transform: "translateX(-50%) translateY(-20px)",
    width: "20px",
    height: "20px",
  },
  fireMain: {
    position: "absolute",
    bottom: 0,
    left: "50%",
    width: "20px",
    height: "20px",
    backgroundColor: "#ef4444",
    borderRadius: "50% 0 50% 50%",
    transform: "rotate(-45deg)",
    animation: "flicker 0.1s infinite alternate",
    boxShadow: "0 0 10px #f59e0b, 0 0 20px #ef4444",
  },
  fireLeft: {
    width: "12px",
    height: "12px",
    left: "-5px",
    backgroundColor: "#f59e0b",
    animation: "flicker 0.15s infinite alternate-reverse",
  },
  fireRight: {
    width: "12px",
    height: "12px",
    left: "10px",
    backgroundColor: "#fcd34d",
    animation: "flicker 0.2s infinite alternate",
  },
  errorTitle: {
    color: "#1f2937",
    fontSize: "1.5rem",
    fontWeight: "bold",
    marginTop: "10px",
  },
  errorText: {
    color: "#6b7280",
    maxWidth: "300px",
    textAlign: "center",
    marginBottom: "20px",
    lineHeight: "1.5",
  },
  retryButton: {
    padding: "10px 24px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "1rem",
    cursor: "pointer",
    transition: "transform 0.2s ease",
    fontWeight: "500",
    boxShadow: "0 4px 6px -1px rgba(239, 68, 68, 0.4)",
  },
};

// --- KEYFRAME ANIMATIONS ---
const animations = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  @keyframes flicker {
    0% { transform: rotate(-45deg) scale(1); opacity: 1; }
    100% { transform: rotate(-44deg) scale(1.1); opacity: 0.9; }
  }
`;

// --- END OF FILE EmployeeProvider.jsx ---