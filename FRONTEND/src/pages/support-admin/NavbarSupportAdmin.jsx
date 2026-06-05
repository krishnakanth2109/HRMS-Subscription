import { useContext, useState, useRef, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { NotificationContext } from "../../context/NotificationContext";
import { useTheme } from "../../context/ThemeContext";
import { io } from "socket.io-client";
import {
  Bell,
  ChevronDown,
  LogOut,
  User,
  Palette,
  Check,
  Moon,
  X,
  CheckCircle,
  Trash2,
  Menu
} from "lucide-react";

const socket = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:5000", {
  transports: ["polling", "websocket"],
});

const NavbarSupportAdmin = ({ currentTheme, onThemeChange, setMobileOpen }) => {
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
    bellOpen,
    setBellOpen,
  } = useContext(NotificationContext);

  const { themeColor } = useTheme();
  const [idlePopup, setIdlePopup] = useState(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
      if (themeRef.current && !themeRef.current.contains(e.target)) setShowThemeDropdown(false);
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [setBellOpen]);

  useEffect(() => {
    if (!user) return;
    socket.on("connect", () => {
      socket.emit("authenticate", user._id);
      socket.emit("register", "admin");
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

  const recentNotifications = notifications.slice(0, 6);

  return (
    <>
      {idlePopup && (
        <div className="fixed top-20 right-4 z-[100] bg-white border-l-4 border-red-500 p-4 rounded-r-lg shadow-2xl w-80 animate-slide-in">
          <div className="flex items-start gap-3">
            <div className="bg-red-100 p-2 rounded-full">
              <Bell size={18} className="text-red-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-slate-900">{idlePopup.title}</h4>
              <p className="text-xs text-slate-500 mt-1">{idlePopup.message}</p>
            </div>
            <button onClick={() => setIdlePopup(null)} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <nav 
        className="h-[60px] flex items-center justify-between px-4 shadow-md transition-all relative z-10"
        style={{ backgroundColor: themeColor }}
      >
        <div className="flex items-center gap-4">
          <button 
            className="md:hidden p-2 text-white hover:bg-white/10 rounded-md transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {/* THEME SELECTOR */}
          <div className="relative" ref={themeRef}>
            <button
              onClick={() => setShowThemeDropdown(!showThemeDropdown)}
              className="p-2 text-white hover:bg-white/10 rounded-full transition-all"
            >
              <Palette size={20} />
            </button>
            {showThemeDropdown && (
              <div className="absolute top-12 right-0 bg-white border border-slate-200 rounded-lg shadow-xl w-48 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b mb-1">Theme</div>
                {[
                  { id: 'bubbles', label: 'Bubbles' },
                  { id: 'image', label: 'Green' },
                  { id: 'white', label: 'Light' },
                  { id: 'dark', label: 'Dark' }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { onThemeChange(t.id); setShowThemeDropdown(false); }}
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 text-sm text-slate-700 font-medium transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {t.id === "dark" && <Moon size={14} className="text-slate-400" />}
                      {t.label}
                    </div>
                    {currentTheme === t.id && <Check size={14} className="text-indigo-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* NOTIFICATION BELL */}
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setBellOpen(!bellOpen)}
              className="p-2 text-white hover:bg-white/10 rounded-full transition-all relative"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute top-12 right-0 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <span className="text-slate-900 font-bold text-sm flex items-center gap-2">
                    Notifications
                    {unreadCount > 0 && <span className="bg-indigo-100 text-indigo-600 text-[10px] px-2 py-0.5 rounded-full">{unreadCount} new</span>}
                  </span>
                  <button onClick={() => setBellOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {recentNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                      <Bell size={32} className="opacity-20 mb-2" />
                      <p className="text-xs">No new notifications</p>
                    </div>
                  ) : (
                    recentNotifications.map((n) => (
                      <div
                        key={n._id}
                        onClick={() => { markAsRead(n._id); setBellOpen(false); }}
                        className={`px-4 py-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors flex gap-3 ${!n.isRead ? "bg-indigo-50/30" : ""}`}
                      >
                        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${!n.isRead ? "bg-indigo-500" : "bg-slate-200"}`} />
                        <div className="flex-1 min-w-0">
                          {n.title && <p className="text-xs font-bold text-slate-900 truncate">{n.title}</p>}
                          <p className="text-xs text-slate-600 leading-snug line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{new Date(n.date || n.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] font-medium">
                  <button onClick={markAllAsRead} disabled={unreadCount === 0} className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50 flex items-center gap-1">
                    <CheckCircle size={12} /> Mark read
                  </button>
                  <button onClick={clearAll} className="text-red-500 hover:text-red-700 flex items-center gap-1">
                    <Trash2 size={12} /> Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="w-[1px] h-6 bg-white/20 mx-1 hidden md:block" />

          {/* USER MENU */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 p-1 hover:bg-white/10 rounded-lg transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-white text-indigo-600 flex items-center justify-center font-bold text-xs shadow-sm">
                {user?.name?.charAt(0).toUpperCase() || "S"}
              </div>
              <div className="hidden md:flex flex-col items-start leading-tight">
                <span className="text-xs font-bold text-white">{user?.name || "Support Admin"}</span>
                <span className="text-[10px] text-white/70 font-bold uppercase">Support Admin</span>
              </div>
              <ChevronDown size={14} className={`text-white transition-transform ${showMenu ? "rotate-180" : ""}`} />
            </button>
            {showMenu && (
              <div className="absolute top-12 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl w-56 z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 border-b border-slate-50 bg-slate-50/50 md:hidden">
                  <p className="text-xs font-bold text-slate-900">{user?.name}</p>
                  <p className="text-[10px] text-indigo-500 font-bold">Support Admin</p>
                </div>
                <button
                  onClick={() => {
                    navigate("/support-admin/profile");
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <User size={16} className="text-slate-400" /> View Profile
                </button>
                <div className="h-[1px] bg-slate-100 my-1" />
                <button 
                  onClick={handleLogout} 
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default NavbarSupportAdmin;
