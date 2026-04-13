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
  FaPalette,
  FaCheck,
  FaMoon,
} from "react-icons/fa";
import { CurrentEmployeeNotificationContext } from "../../EmployeeContext/CurrentEmployeeNotificationContext";
import WelcomeKitPopup from "./WelcomeKitPopup"; // ✅ Import the popup
import api from "../../api"; // ✅ Import api for status check


const NavbarEmployee = ({ currentTheme, onThemeChange }) => {
  const { logout } = useContext(AuthContext);
  const { unreadNotifications } = useContext(CurrentEmployeeNotificationContext);

  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [employeeName, setEmployeeName] = useState("Employee");

  // ✅ Welcome Kit state
  const [showWelcomeKit, setShowWelcomeKit] = useState(false);
  const [employeeData, setEmployeeData] = useState(null);

  const menuRef = useRef(null);
  const themeRef = useRef(null);

  // Load employee name from session + check welcome kit status
  useEffect(() => {
    const savedUser = sessionStorage.getItem("hrmsUser");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setEmployeeName(user.name || "Employee");

      // ✅ Use the MongoDB _id (stored as `id` or `_id`) for status check
      const employeeMongoId = user._id || user.id;

      if (employeeMongoId) {
        checkWelcomeKitStatus(employeeMongoId, user);
      }
    }
  }, []);

  // ✅ Check if the employee has already submitted the welcome kit
  const checkWelcomeKitStatus = async (employeeMongoId, user) => {
    try {
      const res = await api.get(`/api/welcome-kit/status/${employeeMongoId}`);
      // If not submitted yet → show popup
      if (res.data && res.data.submitted === false) {
        setEmployeeData(user);     // pass full user object to popup
        setShowWelcomeKit(true);
      }
    } catch (err) {
      // Silently fail — don't block the UI if the check fails
      console.error("Welcome kit status check failed:", err);
    }
  };

  const user = {
    name: employeeName,
    role: "Employee",
    avatar: null,
  };

  // Close menus from outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
      if (themeRef.current && !themeRef.current.contains(e.target)) {
        setShowThemeDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {/* ✅ Render WelcomeKitPopup when triggered */}
      {showWelcomeKit && employeeData && (
        <WelcomeKitPopup
          employee={employeeData}
          onClose={() => setShowWelcomeKit(false)}
          onSubmitSuccess={() => setShowWelcomeKit(false)}
        />
      )}

      {/* Navbar — no changes to existing structure/logic below */}
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

          {/* 🔥 THEME SELECTION OPTION */}
          <div className="relative" ref={themeRef}>
            <div
              className="cursor-pointer group p-1"
              onClick={() => setShowThemeDropdown(!showThemeDropdown)}
            >
              <FaPalette className="text-xl text-white group-hover:text-yellow-300 transition" />
            </div>

            {showThemeDropdown && (
              <div className="absolute top-10 right-0 bg-white border rounded-lg shadow-xl w-48 z-[100] animate-fade-in py-2">
                <div className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b mb-1">
                  Select Theme
                </div>
                {[
                  { id: "bubbles", label: "Bubbles Theme" },
                  { id: "image", label: "Green Theme" },
                  { id: "white", label: "Light Mode" },
                  { id: "dark", label: "Dark Mode" },
                ].map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      onThemeChange(t.id);
                      setShowThemeDropdown(false);
                    }}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 cursor-pointer transition text-sm text-gray-700 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      {t.id === "dark" && <FaMoon className="text-gray-400 text-xs" />}
                      {t.label}
                    </div>
                    {currentTheme === t.id && <FaCheck className="text-blue-500 text-xs" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notification Bell */}
          <div
            className="relative cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              navigate("/employee/notifications");
            }}
          >
            <FaBell className="text-2xl text-white group-hover:text-yellow-300 transition" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold shadow-md">
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
            <FaUserCircle className="text-3xl text-white shadow rounded-full" />
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
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-gray-700 cursor-pointer transition-all"
                >
                  <FaUser className="text-blue-600" /> My Profile
                </div>

                <div
                  onClick={() => {
                    navigate("/employee/change-password");
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-gray-700 cursor-pointer transition-all"
                >
                  <FaKey className="text-blue-600" /> Change Password
                </div>

                <div
                  onClick={() => {
                    navigate("/employee/rules");
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-gray-700 cursor-pointer transition-all border-t border-gray-100"
                >
                  <FaCog className="text-blue-600" /> Company Policies
                </div>

                <div
                  onClick={() => {
                    logout();
                    navigate("/");
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 cursor-pointer transition-all border-t border-gray-100"
                >
                  <FaSignOutAlt /> Logout
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default NavbarEmployee;