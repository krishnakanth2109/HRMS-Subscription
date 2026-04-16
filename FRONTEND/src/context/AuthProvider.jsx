// --- START OF FILE AuthProvider.jsx ---

import { useState, useEffect, useCallback } from "react";
import { AuthContext } from "./AuthContext";
import { loginUser } from "../api";      // Old employee login
import api from "../api";               // Configured axios instance (for admin)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ================= RESTORE SESSION ON REFRESH ================= */
  useEffect(() => {
    const savedUser = sessionStorage.getItem("hrmsUser");
    const token =
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("hrms-token");

    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);

        if (token || parsedUser.token) {
          setUser(parsedUser);
        } else {
          console.warn("Found user data but no token. Clearing session.");
          sessionStorage.clear();
        }
      } catch (e) {
        console.error("Error parsing auth data:", e);
        sessionStorage.clear();
      }
    }

    setLoading(false);
  }, []);

  /* ==================== LOGIN (ADMIN FIRST → EMPLOYEE FALLBACK) ==================== */
  const login = async (email, password) => {
    // ✅ STEP 1: Always try admin endpoint first (has plan expiry & login access check)
    try {
      const response = await api.post("/api/admin/login", { email, password });

      console.log("LOGIN RAW RESPONSE (Admin):", response.data);

      const token = response.data.token;
      const userData = response.data.user || response.data.data;

      if (!token || !userData) {
        console.error("⚠ INVALID LOGIN RESPONSE STRUCTURE", response.data);
        throw new Error("Invalid login response structure");
      }

      // Store token & user
      sessionStorage.setItem("token", token);
      sessionStorage.setItem("hrms-token", token);
      const userWithToken = { ...userData, token };
      sessionStorage.setItem("hrmsUser", JSON.stringify(userWithToken));
      setUser(userWithToken);

      return response;

    } catch (adminError) {
      // ✅ 403 = Plan expired OR login stopped → re-throw immediately so Login.jsx handles it
      if (adminError.response?.status === 403) {
        throw adminError;
      }

      // ✅ 401 = Not an admin account → fall through to employee login below
      // But if emailChanged flag is set, re-throw immediately
      if (adminError.response?.data?.emailChanged) {
        throw adminError;
      }

      if (adminError.response?.status !== 401) {
        console.warn("Admin login unexpected error, trying employee:", adminError.response?.status);
      }
    }

    // ✅ STEP 2: Admin login failed with 401 (not an admin) → try employee endpoint
    try {
      const response = await loginUser(email, password);

      console.log("LOGIN RAW RESPONSE (Employee):", response.data);

      const token = response.data.token;
      const userData = response.data.user || response.data.data;

      if (!token || !userData) {
        console.error("⚠ INVALID LOGIN RESPONSE STRUCTURE", response.data);
        throw new Error("Invalid login response structure");
      }

      // Store token & user
      sessionStorage.setItem("token", token);
      sessionStorage.setItem("hrms-token", token);
      const userWithToken = { ...userData, token };
      sessionStorage.setItem("hrmsUser", JSON.stringify(userWithToken));
      setUser(userWithToken);

      return response;

    } catch (employeeError) {
      // ✅ 403 from employee = login stopped → re-throw so Login.jsx shows the modal
      if (employeeError.response?.status === 403) {
        throw employeeError;
      }

      // ✅ 401 with emailChanged flag → re-throw so Login.jsx shows the email changed modal
      if (employeeError.response?.data?.emailChanged) {
        throw employeeError;
      }

      console.error(
        "Login failed:",
        employeeError.response?.data?.message || employeeError.message
      );
      throw employeeError;
    }
  };

  /* ==================== LOGOUT ==================== */
  const logout = () => {
    sessionStorage.removeItem("hrmsUser");
    sessionStorage.removeItem("hrms-token");
    sessionStorage.removeItem("token");
    sessionStorage.clear();
    setUser(null);
  };

  /* ==================== UPDATE USER ==================== */
  const updateUser = useCallback((newUserData) => {
    setUser((prevUser) => {
      const updatedUser = { ...prevUser, ...newUserData };

      // Prevent losing token during update
      if (prevUser?.token && !updatedUser.token) {
        updatedUser.token = prevUser.token;
      }

      sessionStorage.setItem("hrmsUser", JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, login, logout, updateUser, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// --- END OF FILE AuthProvider.jsx ---