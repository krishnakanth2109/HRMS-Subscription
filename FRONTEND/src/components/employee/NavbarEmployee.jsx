import { useContext, useState, useRef, useEffect, useMemo } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Bell,
  UserCircle,
  ChevronDown,
  LogOut,
  User,
  Key,
  ShieldCheck,
  Palette,
  Check,
  Moon,
  Menu,
  ChevronRight,
  X
} from "lucide-react";
import { CurrentEmployeeNotificationContext } from "../../EmployeeContext/CurrentEmployeeNotificationContext";
import WelcomeKitPopup from "./WelcomeKitPopup";
import api from "../../api";

const NavbarEmployee = ({ currentTheme, onThemeChange, setMobileOpen }) => {
  const { logout } = useContext(AuthContext);
  const { unreadNotifications } = useContext(CurrentEmployeeNotificationContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [showMenu, setShowMenu] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [employeeName, setEmployeeName] = useState("Employee");
  const [showWelcomeKit, setShowWelcomeKit] = useState(false);
  const [employeeData, setEmployeeData] = useState(null);

  const menuRef = useRef(null);
  const themeRef = useRef(null);

  const breadcrumbs = useMemo(() => {
    const pathnames = location.pathname.split("/").filter((x) => x);
    return pathnames.map((value, index) => {
      const last = index === pathnames.length - 1;
      const to = `/${pathnames.slice(0, index + 1).join("/")}`;
      const label = value.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
      return { label, to, last };
    });
  }, [location.pathname]);

  useEffect(() => {
    const savedUser = sessionStorage.getItem("hrmsUser");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setEmployeeName(user.name || "Employee");
      const employeeMongoId = user._id || user.id;
      if (employeeMongoId) checkWelcomeKitStatus(employeeMongoId, user);
    }
  }, []);

  const checkWelcomeKitStatus = async (employeeMongoId, user) => {
    try {
      const res = await api.get(`/api/welcome-kit/status/${employeeMongoId}`);
      if (res.data && res.data.submitted === false) {
        setEmployeeData(user);
        setShowWelcomeKit(true);
      }
    } catch (err) {
      console.error("Welcome kit status check failed:", err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
      if (themeRef.current && !themeRef.current.contains(e.target)) setShowThemeDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {showWelcomeKit && employeeData && (
        <WelcomeKitPopup
          employee={employeeData}
          onClose={() => setShowWelcomeKit(false)}
          onSubmitSuccess={() => setShowWelcomeKit(false)}
        />
      )}

      <nav className="h-[60px] flex items-center justify-between px-4 shadow-md bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 transition-all relative z-10">
        
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <button 
            className="md:hidden p-2 text-white hover:bg-white/10 rounded-md transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>

          <div className="hidden sm:flex items-center gap-2 text-sm text-white/80">
            <Link to="/employee/dashboard" className="hover:text-white transition-colors font-medium">Home</Link>
            {breadcrumbs.length > 0 && <ChevronRight size={14} className="text-white/40" />}
            {breadcrumbs.map((crumb, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {crumb.last ? (
                  <span className="text-white font-bold">{crumb.label}</span>
                ) : (
                  <>
                    <Link to={crumb.to} className="hover:text-white transition-colors">{crumb.label}</Link>
                    <ChevronRight size={14} className="text-white/40" />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 md:gap-4">
          
          {/* Theme Toggle */}
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
                    {currentTheme === t.id && <Check size={14} className="text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <button
            onClick={() => navigate("/employee/notifications")}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-all relative"
          >
            <Bell size={20} />
            {unreadNotifications > 0 && (
              <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {unreadNotifications > 99 ? "99+" : unreadNotifications}
              </span>
            )}
          </button>

          <div className="w-[1px] h-6 bg-white/20 mx-1 hidden md:block" />

          {/* User Profile */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 p-1 hover:bg-white/10 rounded-lg transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-white text-blue-600 flex items-center justify-center font-bold text-xs shadow-sm">
                {employeeName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:flex flex-col items-start leading-tight">
                <span className="text-xs font-bold text-white">{employeeName}</span>
                <span className="text-[10px] text-white/70 font-bold uppercase">Employee</span>
              </div>
              <ChevronDown size={14} className={`text-white transition-transform ${showMenu ? "rotate-180" : ""}`} />
            </button>

            {showMenu && (
              <div className="absolute top-12 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl w-48 z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 border-b border-slate-50 bg-slate-50/50 md:hidden">
                  <p className="text-xs font-bold text-slate-900">{employeeName}</p>
                </div>
                
                <button onClick={() => { navigate("/employee/profile"); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  <User size={16} className="text-slate-400" /> My Profile
                </button>
                <button onClick={() => { navigate("/employee/change-password"); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  <Key size={16} className="text-slate-400" /> Change Password
                </button>
                
                <div className="h-[1px] bg-slate-100 my-1" />
                
                <button onClick={() => { navigate("/employee/rules"); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  <ShieldCheck size={16} className="text-slate-400" /> Policies
                </button>
                
                <div className="h-[1px] bg-slate-100 my-1" />
                
                <button onClick={() => { logout(); navigate("/"); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
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

export default NavbarEmployee;