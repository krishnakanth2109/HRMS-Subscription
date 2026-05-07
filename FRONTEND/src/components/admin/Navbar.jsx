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
  FaPalette,
  FaCheck,
  FaMoon,
  FaTimes,
  FaCheckCircle,
  FaTrash,
} from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";
import { io } from "socket.io-client";

// ⭐ One shared socket instance for the Navbar (idle alert listener)
const socket = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:5000", {
  transports: ["websocket"],
});

const Navbar = ({ currentTheme, onThemeChange }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [showMenu, setShowMenu] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);

  const menuRef = useRef(null);
  const themeRef = useRef(null);
  const bellRef = useRef(null);

  const {
    unreadCount,
    notifications,
    markAsRead,
    markAllAsRead,
    clearAll,
    bellOpen,       // ✅ FEATURE 1 — controlled by context
    setBellOpen,    // ✅ FEATURE 1 — toggle from context
  } = useContext(NotificationContext);

  const { themeColor } = useTheme();
  const [idlePopup, setIdlePopup] = useState(null);

  // ─── Close dropdowns on outside click ────────────────────────────────────
  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
      if (themeRef.current && !themeRef.current.contains(e.target)) {
        setShowThemeDropdown(false);
      }
      // ✅ FEATURE 1 — close bell panel when clicking outside
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [setBellOpen]);

  // ─── SOCKET.IO LISTENERS (Navbar handles idle-alert popup only) ──────────
  useEffect(() => {
    if (!user) return;

    socket.on("connect", () => {
      console.log("🟢 Navbar socket connected:", socket.id);
      // ✅ FEATURE 2 — Authenticate into user's private room
      socket.emit("authenticate", user._id);
      socket.emit("register", "admin"); // legacy support
    });

    socket.on("admin-notification", (data) => {
      if (data.title === "Employee Idle Alert") {
        setIdlePopup(data);
        setTimeout(() => setIdlePopup(null), 6000);
      }
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

  // Recent 6 notifications for the dropdown panel
  const recentNotifications = notifications.slice(0, 6);

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
            onClick={() => { navigate("/admin/notifications"); setBellOpen(false); }}
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
          {/* App name if needed */}
        </h1>

        <div className="flex items-center gap-6">

          {/* 🔥 THEME SELECTION DROPDOWN */}
          <div className="relative" ref={themeRef}>
            <div
              className="cursor-pointer group p-1"
              onClick={() => setShowThemeDropdown(!showThemeDropdown)}
            >
              <FaPalette className="text-xl text-white group-hover:text-yellow-300 transition" />
            </div>

            {showThemeDropdown && (
              <div className="absolute top-10 right-0 bg-white border rounded-lg shadow-xl w-48 z-30 animate-fade-in py-2">
                <div className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b mb-1">
                  Background
                </div>
                {[
                  { id: 'bubbles', label: 'Bubbles Theme' },
                  { id: 'image', label: 'Green Theme' },
                  { id: 'white', label: 'Light Mode' },
                  { id: 'dark', label: 'Dark Mode' }
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

          {/* 🔔 BELL ICON — ✅ FEATURE 1: Toggle panel open/close */}
          <div className="relative" ref={bellRef}>
            <div
              className="relative cursor-pointer group"
              onClick={() => setBellOpen((prev) => !prev)}
              title={bellOpen ? "Close notifications" : "Open notifications"}
            >
              <FaBell className="text-2xl text-white group-hover:text-yellow-300 transition" />

              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-bounce shadow-lg">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>

            {/* ✅ FEATURE 1 + FEATURE 2 — Inline notification panel */}
            {bellOpen && (
              <div className="absolute top-10 lg:right-0 -right-20 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                {/* Panel Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-600 to-blue-700">
                  <span className="text-white font-semibold text-sm flex items-center gap-2">
                    <FaBell /> Notifications
                    {unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => setBellOpen(false)}
                    className="text-white opacity-70 hover:opacity-100 transition"
                  >
                    <FaTimes />
                  </button>
                </div>

                {/* Notification list */}
                <div className="max-h-72 overflow-y-auto">
                  {recentNotifications.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      <FaBell className="text-3xl mx-auto mb-2 text-gray-200" />
                      You're all caught up!
                    </div>
                  ) : (
                    recentNotifications.map((n) => (
                      <div
                        key={n._id}
                        onClick={() => markAsRead(n._id)}
                        className={`px-4 py-3 border-b cursor-pointer hover:bg-gray-50 transition flex items-start gap-3 ${
                          !n.isRead ? "bg-blue-50" : ""
                        }`}
                      >
                        <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.isRead ? "bg-blue-500" : "bg-gray-300"}`} />
                        <div className="flex-1 min-w-0">
                          {n.title && (
                            <p className="text-xs font-semibold text-blue-600 truncate">{n.title}</p>
                          )}
                          <p className="text-xs text-gray-700 leading-snug">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(n.date || n.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Panel Footer actions */}
                <div className="flex items-center justify-between px-4 py-2 border-t bg-gray-50 text-xs">
                  <button
                    onClick={() => { markAllAsRead(); }}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium transition disabled:opacity-40"
                    disabled={unreadCount === 0}
                  >
                    <FaCheckCircle /> Mark all read
                  </button>
                  <button
                    onClick={() => { clearAll(); }}
                    className="flex items-center gap-1 text-red-500 hover:text-red-700 font-medium transition"
                  >
                    <FaTrash /> Clear all
                  </button>
                  <button
                    onClick={() => { navigate("/admin/notifications"); setBellOpen(false); }}
                    className="text-gray-500 hover:text-gray-700 font-medium transition"
                  >
                    View all →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* USER DROPDOWN */}
          <div
            ref={menuRef}
            className="relative flex items-center gap-3 cursor-pointer select-none"
            onClick={() => setShowMenu((prev) => !prev)}
          >
            <FaUserCircle className="text-3xl text-white shadow" />

            <div className="hidden md:flex flex-col items-start leading-tight">
              <span className="text-white font-semibold">
                {user?.name || "Admin"}
              </span>
              <span className="text-xs text-yellow-200 font-medium uppercase tracking-wide">
                {user?.planType || user?.plan || "Free Plan"}
              </span>
            </div>

            <FaChevronDown
              className={`text-white transition-transform duration-200 ${showMenu ? "rotate-180" : ""}`}
            />

            {showMenu && (
              <div
                className="absolute top-12 right-0 bg-white border rounded-lg shadow-lg w-56 z-50 text-base animate-fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  onClick={() => { navigate("/admin/profile"); setShowMenu(false); }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer transition"
                >
                  <FaUser className="text-blue-600" /> View Profile
                </div>

                <div
                  onClick={() => { navigate("/admin/change-password"); setShowMenu(false); }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer transition"
                >
                  <FaKey className="text-blue-600" /> Change Password
                </div>

                <div
                  onClick={() => { navigate("/admin/rules"); setShowMenu(false); }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer transition border-t"
                >
                  <FaCog className="text-blue-600" /> Company Rules & Regulations
                </div>

                <div
                  onClick={() => { navigate("/admin/issues"); setShowMenu(false); }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer transition border-t"
                >
                  <FaCog className="text-blue-600" /> Technical Issues
                </div>

                {/* LOGOUT */}
                <div
                  onClick={() => { handleLogout(); setShowMenu(false); }}
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