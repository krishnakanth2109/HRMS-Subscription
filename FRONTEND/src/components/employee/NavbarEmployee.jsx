import { useContext, useState, useRef, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { FaBell, FaUserCircle, FaChevronDown, FaSignOutAlt, FaUser, FaKey, FaCog } from "react-icons/fa";
import { CurrentEmployeeNotificationContext } from "../../EmployeeContext/CurrentEmployeeNotificationContext";

const NavbarEmployee = () => {
  const { logout } = useContext(AuthContext);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useContext(CurrentEmployeeNotificationContext);

  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [employeeName, setEmployeeName] = useState("Employee"); // Local state for the name
  const menuRef = useRef(null);
  const notifRef = useRef(null);

  // Get user from sessionStorage
  useEffect(() => {
    const savedUser = sessionStorage.getItem("hrmsUser");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setEmployeeName(user.name || "Employee");
    }
  }, []);

  // User info using local state
  const user = {
    name: employeeName,
    role: "Employee",
    avatar: null,
  };

  // Close dropdowns if clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="h-16 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 flex items-center justify-between px-6 shadow-lg relative z-10">
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => navigate("/employee/dashboard")}
      >
        <img src="/src/assets/logo.png" alt="HRMS Logo" className="h-8 w-8 rounded-full" />
        <h1 className="text-2xl font-bold text-white tracking-wide drop-shadow">HRMS</h1>
      </div>
      <div className="flex items-center gap-6">
        {/* Notifications */}
        <div className="relative cursor-pointer group" ref={notifRef}>
          <FaBell
            className="text-2xl text-white group-hover:text-yellow-300 transition"
            onClick={() => setShowNotifications((prev) => !prev)}
          />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">
              {unreadCount}
            </span>
          )}
          {/* Notification Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-white border rounded-lg shadow-lg z-50 animate-fade-in">
              <div className="flex items-center justify-between px-4 py-2 border-b">
                <span className="font-semibold text-gray-700">Notifications</span>
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => markAllAsRead()}
                >
                  Mark all as read
                </button>
              </div>
              <ul className="max-h-64 overflow-y-auto">
                {notifications.length === 0 && (
                  <li className="px-4 py-4 text-gray-500 text-center">No notifications</li>
                )}
                {notifications.map((notif) => (
                  <li
                    key={notif.id}
                    className={`px-4 py-3 border-b last:border-b-0 flex items-start gap-2 ${
                      !notif.read ? "bg-blue-50" : ""
                    }`}
                  >
                    <span className="mt-1">
                      <FaBell className={`text-lg ${notif.read ? "text-gray-400" : "text-yellow-500"}`} />
                    </span>
                    <div className="flex-1">
                      <div className="text-gray-800">{notif.text}</div>
                      <div className="text-xs text-gray-400">{notif.date}</div>
                    </div>
                    {!notif.read && (
                      <button
                        className="ml-2 text-xs text-blue-600 hover:underline"
                        onClick={() => markAsRead(notif.id)}
                      >
                        Mark as read
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {/* Profile section with toggle dropdown */}
        <div
          ref={menuRef}
          className="relative flex items-center gap-2 cursor-pointer select-none"
          onClick={() => setShowMenu((prev) => !prev)}
        >
          <FaUserCircle className="text-3xl text-white shadow" />
          <span className="text-white font-semibold hidden md:inline">{user.name}</span>
          <FaChevronDown className={`text-white ml-1 transition-transform duration-200 ${showMenu ? 'rotate-180' : ''}`} />
          {/* Dropdown menu */}
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