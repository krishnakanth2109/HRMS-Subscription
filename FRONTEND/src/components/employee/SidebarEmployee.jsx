import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect, useContext, useCallback, useRef } from "react";
import {
  LayoutDashboard,
  UserCheck,
  Calendar,
  Megaphone,
  Clock,
  Plane,
  Laptop,
  Receipt,
  Users,
  ClipboardList,
  Settings,
  AlertCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  User,
  IndianRupee,
  X
} from "lucide-react";

import { AuthContext } from "../../context/AuthContext";
import api from "../../api";

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
      { to: "/employee/leave-management", label: "Leave Requests", icon: Plane },
      { to: "/employee/reuestworkmode", label: "WorkMode Request", icon: Laptop },
    ]
  },
  {
    title: "Resources",
    links: [
      { to: "/employee/payslip", label: "Pay-Slip", icon: IndianRupee },
      { to: "/employee/chatting", label: "Connect", icon: Users },
      { to: "/employee/daily-work-tracker", label: "Work Tracker", icon: ClipboardList },
    ]
  },
  {
    title: "Account",
    links: [
      { to: "/employee/setup-face", label: "Settings", icon: Settings },
      { to: "/employee/issues", label: "Report Issue", icon: AlertCircle },
      { to: "/employee/resignation", label: "Resignation", icon: FileText },
    ]
  }
];

const SidebarEmployee = ({ mobileOpen, setMobileOpen }) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const sidebarRef = useRef(null);
  const { user } = useContext(AuthContext);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastCountRef = useRef(0);
  const firstLoadRef = useRef(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const resize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [setMobileOpen]);

  const playNoticeSound = useCallback(() => {
    if ('speechSynthesis' in window && user?.name) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`${user.name}, please check notices`);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, [user]);

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

      if (!firstLoadRef.current) {
        if (count > lastCountRef.current) playNoticeSound();
      } else {
        firstLoadRef.current = false;
      }
      lastCountRef.current = count;
      setUnreadCount(count);
    } catch (error) {
      console.error("Failed to fetch unread notice count", error);
    }
  }, [user, playNoticeSound]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 5000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [location.pathname, isMobile, setMobileOpen]);



  const sidebarClasses = `
    h-screen bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 ease-in-out z-50
    ${isMobile
      ? `fixed top-0 left-0 w-[300px] ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`
      : `sticky top-0 ${collapsed ? "w-[64px]" : "w-[300px]"}`}
  `;

  return (
    <>
      {isMobile && mobileOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300" onClick={() => setMobileOpen(false)} />
      )}

      <aside 
        ref={sidebarRef}
        className={sidebarClasses}
        onClick={() => {
          if (!isMobile) {
            setCollapsed(false);
            setIsPinned(true);
          }
        }}
        onMouseEnter={() => {
          if (!isMobile) {
            setCollapsed(false);
          }
        }}
        onMouseLeave={() => {
          if (!isMobile && !isPinned) {
            setCollapsed(true);
          }
        }}
      >
        <div className={`h-16 flex items-center px-4 shrink-0 ${collapsed && !isMobile ? "justify-center" : "justify-between"}`}>
          {!collapsed || isMobile ? (
             <div className="flex items-center gap-2 overflow-hidden h-[68px]">
                <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <User size={24} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white leading-tight">Employee</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Panel</span>
                </div>
             </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <User size={18} />
            </div>
          )}
          {isMobile && (
            <button onClick={() => setMobileOpen(false)} className="p-1 text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-6 no-scrollbar">
          {NAV_SECTIONS.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {(!collapsed || isMobile) && (
                <h4 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  {section.title}
                </h4>
              )}
              <div className="space-y-1">
                {section.links.map((link, lIdx) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.to;

                  return (
                    <NavLink
                      key={lIdx}
                      to={link.to}
                      className={({ isActive }) => `
                        group flex items-center gap-3 px-3 min-h-[44px] rounded-md transition-all duration-200
                        ${isActive 
                          ? "bg-blue-500/10 text-blue-400 border-l-2 border-blue-500" 
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-2 border-transparent"}
                        ${collapsed && !isMobile ? "justify-center px-0" : ""}
                      `}
                      title={collapsed && !isMobile ? link.label : ""}
                    >
                      <div className="relative">
                        <Icon size={20} className="shrink-0" />
                        {collapsed && !isMobile && link.isNotice && unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-slate-900" />
                        )}
                      </div>
                      {(!collapsed || isMobile) && (
                        <>
                          <span className="text-[14px] font-medium truncate">{link.label}</span>
                          {link.isNotice && unreadCount > 0 && (
                            <span className="ml-auto bg-red-500 text-white text-[10px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center animate-pulse">
                              {unreadCount}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800">
          {!isMobile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const nextCollapsed = !collapsed;
                setCollapsed(nextCollapsed);
                setIsPinned(!nextCollapsed);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-md transition-all mb-2"
            >
              {collapsed ? <ChevronRight size={20} /> : (
                <>
                  <ChevronLeft size={20} />
                  <span className="text-sm font-medium">Collapse</span>
                </>
              )}
            </button>
          )}
          <div className={`px-3 py-2 text-[10px] text-slate-500 font-medium ${collapsed && !isMobile ? "text-center" : ""}`}>
            &copy; {new Date().getFullYear()} HRMS
          </div>
        </div>
      </aside>
    </>
  );
};

export default SidebarEmployee;
