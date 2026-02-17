// --- START OF FILE Navbar.jsx ---

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
} from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";
import { io } from "socket.io-client";

// ⭐ Connect Socket
const socket = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:5000", {
  transports: ["websocket"],
});

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [showMenu, setShowMenu] = useState(false);
  const [showThemeColors, setShowThemeColors] = useState(false);

  const menuRef = useRef(null);

  const { unreadCount, setUnreadCount, addNotification } =
    useContext(NotificationContext);

  const { themeColor, setThemeColor } = useTheme();

  const [idlePopup, setIdlePopup] = useState(null);

  // 🧹 Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
        setShowThemeColors(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // ================================
  // 🔥 SOCKET.IO LISTENERS
  // ================================
  useEffect(() => {
    if (!user) return;

    socket.on("connect", () => {
      console.log("🟢 Socket connected:", socket.id);
      socket.emit("register", "admin");
    });

    socket.on("admin-notification", (data) => {
      console.log("🔥 Notification:", data);

      if (data.title === "Employee Idle Alert") {
        setIdlePopup(data);
        setTimeout(() => setIdlePopup(null), 6000);
      }

      addNotification(data);
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      socket.off("connect");
      socket.off("admin-notification");
    };
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <>
      {/* ⭐ IDLE POPUP */}
      {idlePopup && (
        <div className="fixed top-20 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg w-80 animate-slide-in">
          <strong className="font-bold flex items-center gap-2">
            <FaBell className="text-red-600" />
            {idlePopup.title}
          </strong>
          <p className="text-sm mt-1">{idlePopup.message}</p>

          <button
            onClick={() => navigate("/admin/notifications")}
            className="mt-3 text-blue-600 text-sm font-semibold underline"
          >
            View Notification →
          </button>
        </div>
      )}

      {/* NAVBAR */}
      <nav
        className="h-16 flex items-center justify-between px-6 shadow-lg relative"
        style={{ backgroundColor: themeColor }}
      >
        <h1 className="text-2xl font-bold text-white tracking-wide drop-shadow">
          {/* Add App Name here if needed */}
        </h1>

        <div className="flex items-center gap-6">
          {/* 🔔 Notification Icon */}
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

          {/* USER DROPDOWN */}
          <div
            ref={menuRef}
            className="relative flex items-center gap-3 cursor-pointer select-none"
            onClick={() => setShowMenu((prev) => !prev)}
          >
            <FaUserCircle className="text-3xl text-white shadow" />

            {/* 👇 UPDATED SECTION: Display Name and Plan */}
            <div className="hidden md:flex flex-col items-start leading-tight">
              <span className="text-white font-semibold">
                {user?.name || "Admin"}
              </span>
              <span className="text-xs text-yellow-200 font-medium uppercase tracking-wide">
                {user?.planType || user?.plan || "Free Plan"}
              </span>
            </div>
            {/* 👆 END UPDATED SECTION */}

            <FaChevronDown
              className={`text-white transition-transform duration-200 ${showMenu ? "rotate-180" : ""
                }`}
            />

            {showMenu && (
              <div
                className="absolute top-12 right-0 bg-white border rounded-lg shadow-lg w-56 z-50 text-base animate-fade-in"
                onClick={(e) => e.stopPropagation()} // 🔥 prevents reopen
              >
                <div
                  onClick={() => {
                    navigate("/admin/profile");
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer transition"
                >
                  <FaUser className="text-blue-600" /> View Profile
                </div>

                <div
                  onClick={() => {
                    navigate("/admin/change-password");
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer transition"
                >
                  <FaKey className="text-blue-600" /> Change Password
                </div>

                <div
                  onClick={() => {
                    navigate("/admin/rules");
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer transition border-t"
                >
                  <FaCog className="text-blue-600" /> Company Rules & Regulations
                </div>

                {/* LOGOUT */}
                <div
                  onClick={() => {
                    handleLogout();
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-blue-50 cursor-pointer transition border-t"
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

export default Navbar;