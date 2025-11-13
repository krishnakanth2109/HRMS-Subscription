import { useContext, useState, useRef, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { NotificationContext } from "../../context/NotificationContext";
import {
  FaBell,
  FaUserCircle,
  FaChevronDown,
  FaSignOutAlt,
  FaUser,
  FaKey,
  FaCog,
  FaPaintBrush,
} from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";

const Navbar = () => {
  // ✅ Step 1: Get the 'user' object from the AuthContext
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showThemeColors, setShowThemeColors] = useState(false);
  const menuRef = useRef(null);
  const { unreadCount } = useContext(NotificationContext);
  const { themeColor, setThemeColor } = useTheme();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
        setShowThemeColors(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const colors = ["#3B82F6", "#FACC15", "#34D399", "#F472B6"]; // Blue, Yellow, Green, Pink

  return (
    <nav
      className="h-16 flex items-center justify-between px-6 shadow-lg relative"
      style={{ backgroundColor: themeColor }}
    >
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-white tracking-wide drop-shadow">
          HRMS Admin
        </h1>
      </div>

      <div className="flex items-center gap-6">
        {/* Notifications */}
        <div
          className="relative cursor-pointer group"
          onClick={() => navigate("/admin/notifications")}
        >
          <FaBell className="text-2xl text-white group-hover:text-yellow-300 transition" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-bounce shadow-lg">
              {unreadCount}
            </span>
          )}
        </div>

        {/* User Menu */}
        <div
          ref={menuRef}
          className="relative flex items-center gap-2 cursor-pointer select-none"
        >
          <FaUserCircle className="text-3xl text-white shadow" />
          {/* ✅ Step 2: Display the dynamic user name with a fallback */}
          <span className="text-white font-semibold hidden md:inline">
            {user?.name || 'Admin'}
          </span>
          <FaChevronDown
            className={`text-white ml-1 transition-transform duration-200 ${
              showMenu ? "rotate-180" : ""
            }`}
            onClick={() => setShowMenu((prev) => !prev)}
          />

          {showMenu && (
            <div className="absolute top-12 right-0 bg-white border rounded-lg shadow-lg w-56 z-50 text-base animate-fade-in">
              <div
                onClick={() => {
                  navigate("/admin/profile");
                  setShowMenu(false);
                }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-gray-700 cursor-pointer transition-all"
              >
                <FaUser className="text-blue-600" /> View Profile
              </div>
              <div
                onClick={() => {
                  navigate("/admin/change-password");
                  setShowMenu(false);
                }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-gray-700 cursor-pointer transition-all"
              >
                <FaKey className="text-blue-600" /> Change Password
              </div>
              <div
                onClick={() => {
                  navigate("/admin/settings");
                  setShowMenu(false);
                }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-gray-700 cursor-pointer transition-all border-t"
              >
                <FaCog className="text-blue-600" /> Application Settings
              </div>

              {/* Theme Change Dropdown Inside */}
              <div className="border-t">
                <div
                  onClick={() => setShowThemeColors((prev) => !prev)}
                  className="flex items-center justify-between px-4 py-3 hover:bg-blue-50 text-gray-700 cursor-pointer transition-all"
                >
                  <span className="flex items-center gap-3">
                    <FaPaintBrush className="text-blue-600" /> Theme Change
                  </span>
                  <FaChevronDown
                    className={`ml-1 text-gray-600 transition-transform duration-200 ${
                      showThemeColors ? "rotate-180" : ""
                    }`}
                  />
                </div>

                {/* Theme Colors */}
                {showThemeColors && (
                  <div className="px-4 py-3">
                    <div className="grid grid-cols-4 gap-3">
                      {colors.map((color) => (
                        <button
                          key={color}
                          className="w-8 h-8 rounded-full border shadow hover:scale-110 transition"
                          style={{ backgroundColor: color }}
                          onClick={() => setThemeColor(color)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-blue-50 cursor-pointer transition-all border-t"
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

export default Navbar;