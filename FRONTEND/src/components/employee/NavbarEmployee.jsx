import { useContext, useState, useRef, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  FaBell,
  FaUserCircle,
  FaChevronDown,
  FaSignOutAlt,
  FaUser,
  FaKey,
  FaCog,
} from "react-icons/fa";
import { CurrentEmployeeNotificationContext } from "../../EmployeeContext/CurrentEmployeeNotificationContext";

const NavbarEmployee = () => {
  const { logout } = useContext(AuthContext);

  // FIX: Use unreadNotifications from context
  const { unreadNotifications } = useContext(CurrentEmployeeNotificationContext);

  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [employeeName, setEmployeeName] = useState("Employee");
  const menuRef = useRef(null);

  // Load employee name
  useEffect(() => {
    const savedUser = sessionStorage.getItem("hrmsUser");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setEmployeeName(user.name || "Employee");
    }
  }, []);

  const user = {
    name: employeeName,
    role: "Employee",
    avatar: null,
  };

  // Close ONLY the profile menu from outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="h-16 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 flex items-center justify-between px-6 shadow-lg relative z-10">

      {/* Logo */}
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => navigate("/employee/dashboard")}
      >
        <h1 className="ps-5 text-2xl font-bold text-white tracking-wide drop-shadow">
          HRMS
        </h1>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-6">

        {/* Notification Bell */}
        <div className="relative cursor-pointer group">
          <FaBell
            className="text-2xl text-white group-hover:text-yellow-300 transition"
            onClick={(e) => {
              e.stopPropagation();
              navigate("/employee/notifications");
            }}
          />

          {/* FIXED BADGE */}
          {unreadNotifications > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">
              {unreadNotifications}
            </span>
          )}
        </div>

        {/* Profile Dropdown */}
        <div
          ref={menuRef}
          className="relative flex items-center gap-2 cursor-pointer select-none"
          onClick={() => setShowMenu((prev) => !prev)}
        >
          <FaUserCircle className="text-3xl text-white shadow" />
          <span className="text-white font-semibold hidden md:inline">
            {user.name}
          </span>
          <FaChevronDown
            className={`text-white ml-1 transition-transform duration-200 ${
              showMenu ? "rotate-180" : ""
            }`}
          />

          {showMenu && (
            <div className="absolute top-12 right-0 bg-white border rounded-lg shadow-lg w-44 z-50 text-base animate-fade-in">

              <div
                onClick={() => {
                  navigate("/employee/profile");
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-4 py-3 hover:bg-blue-50 text-gray-700 cursor-pointer transition-all"
              >
                <FaUser className="text-blue-600" /> My Profile
              </div>

              <div
                onClick={() => {
                  navigate("/employee/change-password");
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-4 py-3 hover:bg-blue-50 text-gray-700 cursor-pointer transition-all"
              >
                <FaKey className="text-blue-600" /> Change Password
              </div>

              <div
                onClick={() => {
                  navigate("/employee/settings");
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-4 py-3 hover:bg-blue-50 text-gray-700 cursor-pointer transition-all"
              >
                <FaCog className="text-blue-600" /> Settings
              </div>

              <div
                onClick={() => {
                  logout();
                  navigate("/");
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-blue-50 cursor-pointer transition-all"
              >
                <FaSignOutAlt /> Logout
              </div>

            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavbarEmployee;
