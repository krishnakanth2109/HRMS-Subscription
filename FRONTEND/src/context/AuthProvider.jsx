// --- START OF FILE AuthProvider.jsx ---

import { useState, useEffect, useCallback } from "react";
import { AuthContext } from "./AuthContext";
import { loginUser } from "../api";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = sessionStorage.getItem("hrmsUser");
    const savedToken = sessionStorage.getItem("hrms-token");

    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await loginUser(email, password);

      console.log("LOGIN RAW RESPONSE:", response.data);

      const token = response.data.token;

      // ⭐ The backend ALWAYS returns "data" 
      const userData = response.data.data;

      // 🔥 No more false error throws
      if (!token || !userData) {
        console.error("⚠ INVALID LOGIN RESPONSE STRUCTURE", response.data);
        throw new Error("Invalid login response");
      }

      // Save session data
      sessionStorage.setItem("hrms-token", token);
      sessionStorage.setItem("hrmsUser", JSON.stringify(userData));

      setUser(userData);

      // Return FULL RESPONSE so Login.jsx can redirect using role
      return response;

    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const logout = () => {
    sessionStorage.removeItem("hrmsUser");
    sessionStorage.removeItem("hrms-token");
    setUser(null);
  };

  const updateUser = useCallback((newUserData) => {
    setUser(prevUser => {
      const updatedUser = { ...prevUser, ...newUserData };
      sessionStorage.setItem("hrmsUser", JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- END OF FILE AuthProvider.jsx ---
