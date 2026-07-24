import { NavLink, useLocation, Link } from "react-router-dom";
import { useState, useEffect, useContext, useCallback, useRef } from "react";
import {
  LayoutDashboard,
  UserCheck,
  Calendar,
  Megaphone,
  Clock,
  CalendarClock,
  Laptop,
  Receipt,
  IndianRupee,
  Users,
  MapPinned,
  ClipboardList,
  Settings,
  AlertCircle,
  FileText,
  ChevronDown,
} from "lucide-react";
import { AuthContext } from "../../context/AuthContext";
import api from "../../api";

const NavbarEmployeeNav = ({ theme, inline = false }) => {
  const location = useLocation();
  const [activeDropdown, setActiveDropdown] = useState(null);
  const dropdownRef = useRef(null);
  const { user } = useContext(AuthContext);
  const [unreadCount, setUnreadCount] = useState(0);

  const NAV_SECTIONS = [
    {
      title: "General",
      links: [
        { to: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/employee/my-attendence", label: "Attendance", icon: UserCheck },
        { to: "/employee/holiday-calendar", label: "Holiday Calendar", icon: Calendar },
        { to: "/employee/notices", label: "Notice Board", icon: Megaphone, isNotice: true },
      ]
    },
    {
      title: "Requests",
      links: [
        { to: "/employee/empovertime", label: "Request Overtime", icon: Clock },
        { to: "/employee/leave-management", label: "Leave Requests", icon: CalendarClock },
        { to: "/employee/reuestworkmode", label: "WorkMode Request", icon: Laptop },
        { to: "/employee/expenses", label: "My Expenses", icon: Receipt },
      ]
    },
    {
      title: "Resources",
      links: [
        { to: "/employee/payslip", label: "Pay-Slip", icon: IndianRupee },
        { to: "/employee/chatting", label: "Connect", icon: Users },
        { to: "/employee/field-work", label: "Field Work", icon: MapPinned },
        { to: "/employee/daily-work-tracker", label: "Work Tracker", icon: ClipboardList },
      ]
    },
    {
      title: "Settings",
      links: [
        { to: "/employee/setup-face", label: "Settings", icon: Settings },
        { to: "/employee/issues", label: "Report Issue", icon: AlertCircle },
        { to: "/employee/resignation", label: "Resignation", icon: FileText },
      ]
    }
  ];

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get("/api/notices");
      const count = data.filter(notice => {
        if (!notice?.title) return false;
        if (typeof notice.title === 'string' && notice.title.startsWith("__SYSTEM_")) return false;
        if (Array.isArray(notice.recipients) && notice.recipients.length > 0) {
          const currentId = (user?._id || user?.id);
          if (!notice.recipients.includes(currentId)) return false;
        }
        const isRead = Array.isArray(notice.readBy) && notice.readBy.some(record => {
          const recordId = typeof record.employeeId === 'object' ? record.employeeId._id : record.employeeId;
          return recordId === (user._id || user.id);
        });
        return !isRead;
      }).length;

      setUnreadCount(count);
    } catch (error) {
      console.error("Failed to fetch unread notice count", error);
    }
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const renderBadge = (link) => {
    if (link.isNotice && unreadCount > 0) {
      return (
        <span className="flex items-center justify-center h-4 min-w-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full ml-1.5 shadow-sm">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      );
    }
    return null;
  };

  const isLinkActive = (link) => {
    return location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
  };

  const isSectionActive = (section) => {
    return section.links.some(isLinkActive);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div 
      ref={dropdownRef}
      className={
        inline
          ? "flex items-center justify-center gap-2 select-none"
          : `hidden md:flex h-14 w-full border-b px-6 items-center justify-center gap-4 text-sm z-30 transition-all select-none shadow-sm backdrop-blur-md ${
              theme === "dark" 
                ? "bg-slate-950/80 border-slate-800/60 text-slate-300" 
                : "bg-white/80 border-slate-200/60 text-slate-600"
            }`
      }
    >
      {NAV_SECTIONS.map((section, sIdx) => {
        const isActive = isSectionActive(section);

        return (
          <div key={sIdx} className="relative py-1 flex items-center">
            <button
              onClick={() => setActiveDropdown(activeDropdown === sIdx ? null : sIdx)}
              className={`h-9 px-4 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-all duration-200 cursor-pointer text-xs uppercase tracking-wider outline-none ${
                inline
                  ? isActive
                    ? "bg-white/20 text-white shadow-sm"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                  : isActive 
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400" 
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50"
              }`}
            >
              {section.title}
              <ChevronDown size={13} className={`transition-transform duration-200 ${activeDropdown === sIdx ? "rotate-180" : ""}`} />
            </button>

            {activeDropdown === sIdx && (
              <div 
                className={`absolute left-1/2 -translate-x-1/2 mt-1.5 w-60 rounded-2xl border shadow-2xl p-2 z-[99] flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-md ${
                  inline ? "top-full mt-3" : "top-full"
                } ${
                  theme === "dark" 
                    ? "bg-slate-900/95 border-slate-800 text-slate-300" 
                    : "bg-white/95 border-slate-200/80 text-slate-700"
                }`}
              >
                {section.links.map((link, lIdx) => {
                  const Icon = link.icon;
                  const active = isLinkActive(link);

                  return (
                    <NavLink
                      key={lIdx}
                      to={link.to}
                      onClick={() => setActiveDropdown(null)}
                      className={({ isActive }) => `
                        flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all border-l-2
                        ${isActive || active
                          ? "bg-blue-500/10 text-blue-500 border-blue-500"
                          : "border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"}
                      `}
                    >
                      <Icon size={16} />
                      <span>{link.label}</span>
                      {renderBadge(link)}
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default NavbarEmployeeNav;
