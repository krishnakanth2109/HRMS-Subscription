import { useState } from "react";
import { AdminContext } from "./AdminContext";

const AdminProvider = ({ children }) => {
  const [admin, setAdmin] = useState({
    id: "admin001",
    name: "Admin User",
    email: "admin@hrms.com",
    role: "HR Manager",
    phone: "9999999999",
    department: "Administration",
  });

  const updateAdmin = (updatedData) => {
    setAdmin((prev) => ({ ...prev, ...updatedData }));
  };

  return (
    <AdminContext.Provider value={{ admin, updateAdmin }}>
      {children}
    </AdminContext.Provider>
  );
};

export default AdminProvider;
