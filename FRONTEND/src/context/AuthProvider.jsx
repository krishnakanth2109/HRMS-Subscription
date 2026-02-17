// --- START OF FILE AuthProvider.jsx ---
import { useState, useEffect, useCallback } from "react";
import { AuthContext } from "./AuthContext";
import axios from "axios"; // Import axios directly to hit the correct endpoint

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Retrieve data from storage
    const savedUser = sessionStorage.getItem("hrmsUser");
    const token = sessionStorage.getItem("token") || sessionStorage.getItem("hrms-token");

    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        
        // 2. Validate: Must have a user object AND a token
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

  /* ==================== LOGIN (UPDATED TO HIT ADMIN ENDPOINT) ==================== */
  const login = async (email, password) => {
    try {
      // CRITICAL: We hit /api/admin/login specifically to trigger the plan expiry check logic
      const response = await axios.post("http://localhost:5000/api/admin/login", { 
        email, 
        password 
      });

      console.log("LOGIN RAW RESPONSE:", response.data);

      const token = response.data.token;
      // Note: Backend returns 'user', mapping it to 'userData' for your existing logic
      const userData = response.data.user || response.data.data;

      // Validation
      if (!token || !userData) {
        console.error("⚠ INVALID LOGIN RESPONSE STRUCTURE", response.data);
        throw new Error("Invalid login response structure");
      }

      // --- CRITICAL FIX: STORE TOKEN IN ALL EXPECTED LOCATIONS ---
      
      // 1. Standard key (used by CurrentEmployeeProfile)
      sessionStorage.setItem("token", token);
      
      // 2. Legacy key (used by api.js)
      sessionStorage.setItem("hrms-token", token);

      // 3. Inside User Object (Best practice for Profile page access)
      const userWithToken = { ...userData, token };
      sessionStorage.setItem("hrmsUser", JSON.stringify(userWithToken));

      setUser(userWithToken);

      // Return FULL RESPONSE so Login.jsx can redirect using role
      return response;

    } catch (error) {
      // If the backend returns 403 (from our loginAdmin logic), this catch block will trigger
      console.error("Login failed:", error.response?.data?.message || error.message);
      throw error; 
    }
  };

  const logout = () => {
    sessionStorage.removeItem("hrmsUser");
    sessionStorage.removeItem("hrms-token");
    sessionStorage.removeItem("token");
    sessionStorage.clear(); 
    setUser(null);
  };

  const updateUser = useCallback((newUserData) => {
    setUser(prevUser => {
      const updatedUser = { ...prevUser, ...newUserData };
      if (prevUser?.token && !updatedUser.token) {
          updatedUser.token = prevUser.token;
      }
      sessionStorage.setItem("hrmsUser", JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
// --- END OF FILE AuthProvider.jsx ---