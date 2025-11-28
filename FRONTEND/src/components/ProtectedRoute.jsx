// --- UPDATED ProtectedRoute.jsx ---

import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const ProtectedRoute = ({ children, allow = [] }) => {
  const { user } = useContext(AuthContext);

  // Not logged in → go to login
  if (!user) return <Navigate to="/" replace />;

  // If allowed roles provided, check them
  if (allow.length > 0 && !allow.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
