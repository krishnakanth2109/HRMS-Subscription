// --- START OF FILE AuthProvider.jsx ---

import { useState, useEffect, useCallback } from "react";
import { AuthContext } from "./AuthContext";
import { loginUser } from "../api"; // Use the central login function from api.js

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // On app load, check sessionStorage for a saved user session
  useEffect(() => {
    const savedUser = sessionStorage.getItem("hrmsUser");
    const savedToken = sessionStorage.getItem("hrms-token");
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = async (email, password) => {
    try {
      // ONE API call now handles both admin and employee login
      const response = await loginUser(email, password);
      const { token, data: userData } = response;
      
      // Store token and user data in sessionStorage
      sessionStorage.setItem("hrms-token", token);
      sessionStorage.setItem("hrmsUser", JSON.stringify(userData));
      
      setUser(userData);
      
      // Return the role for navigation in the Login component
      return userData.role;
    } catch (error) {
      console.error("Login failed:", error);
      // Re-throw the error so it can be caught by the Login component
      throw error;
    }
  };

  const logout = () => {
    // Clear everything from sessionStorage and state
    sessionStorage.removeItem("hrmsUser");
    sessionStorage.removeItem("hrms-token");
    setUser(null);
  };

  // Function to update user data in the context after a profile edit
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