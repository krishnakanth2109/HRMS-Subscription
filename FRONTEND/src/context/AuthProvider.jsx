import { useState, useEffect } from "react";
import axios from "axios";
import { AuthContext } from "./AuthContext";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("hrmsUser");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const login = async (email, password) => {
    // ✅ Admin login — don't change
    if (email === "admin@hrms.com" && password === "admin123") {
      const userData = { role: "admin", email };
      localStorage.setItem("hrmsUser", JSON.stringify(userData));
      setUser(userData);
      return "admin";
    }

    // ✅ Employee login from backend list
    try {
      const res = await axios.get("http://localhost:5000/employees");
      const employees = res.data;

      // find employee by email + password
      const emp = employees.find(
        (emp) => emp.email === email && emp.password === password
      );

      if (emp) {
        const userData = { role: "employee", email: emp.email, id: emp._id , employeeId: emp.employeeId };
        localStorage.setItem("hrmsUser", JSON.stringify(userData));
        setUser(userData);
        return "employee";
      } else {
        return null; // invalid credentials
      }
    } catch (error) {
      console.error("Employee login error:", error);
      return null;
    }
  };

  const logout = () => {
    localStorage.removeItem("hrmsUser");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
