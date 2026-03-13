import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useContext, useCallback, useRef } from "react";
import {
  FaBullhorn,
  FaUser,
  FaBars,
  FaTimes,
  FaTachometerAlt,
  FaUserCheck,
  FaUmbrellaBeach,
  FaHourglassHalf,
  FaPlaneDeparture,
  FaLaptopHouse,
  FaMoneyCheckAlt,
  FaUserFriends,
  FaReceipt,
  FaChevronLeft,
  FaChevronRight
} from "react-icons/fa";

// Import AuthContext to get current user details
import { AuthContext } from "../../context/AuthContext";
// Import API to fetch real DB data
import api from "../../api";

const navLinks = [
  { to: "/employee/dashboard", label: "Dashboard", icon: <FaTachometerAlt /> },
  { to: "/employee/my-attendence", label: "Attendance", icon: <FaUserCheck /> },
  { to: "/employee/holiday-calendar", label: "Holiday Calendar", icon: <FaUmbrellaBeach /> },
  { to: "/employee/notices", label: "Notice Board", icon: <FaBullhorn />, isNotice: true },
  { to: "/employee/empovertime", label: "Request Overtime", icon: <FaHourglassHalf /> },
  { to: "/employee/leave-management", label: "Leave Requests", icon: <FaPlaneDeparture /> },
  { to: "/employee/reuestworkmode", label: "WorkMode Request", icon: <FaLaptopHouse /> },
  { to: "/employee/payslip", label: "Pay-Slip", icon: <FaMoneyCheckAlt /> },
  { to: "/employee/chatting", label: "Connect with Employee", icon: <FaUserFriends /> },
  { to: "/employee/expense", label: "Add Expense", icon: <FaReceipt /> }
];

const SidebarEmployee = () => {
  const location = useLocation();
  const [open, setOpen] = useState(window.innerWidth >= 768);
  const [collapsed, setCollapsed] = useState(false);

  // Get current user to check against DB records and get NAME
  const { user } = useContext(AuthContext);

  // Local state for accurate DB count
  const [unreadCount, setUnreadCount] = useState(0);

  // Refs to track previous count for Sound Logic
  const lastCountRef = useRef(0);
  const firstLoadRef = useRef(true);

  useEffect(() => {
    const resize = () => setOpen(window.innerWidth >= 768);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // SOUND FUNCTION WITH NAME
  const playNoticeSound = () => {
    if ('speechSynthesis' in window && user?.name) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`${user.name}, please check notices`);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // FETCH REAL UNREAD COUNT
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
          const recordId = typeof record.employeeId === 'object'
            ? record.employeeId._id
            : record.employeeId;
          return recordId === (user._id || user.id);
        });

        return !isRead;
      }).length;

      if (!firstLoadRef.current) {
        if (count > lastCountRef.current) {
          playNoticeSound();
        }
      } else {
        firstLoadRef.current = false;
      }

      lastCountRef.current = count;
      setUnreadCount(prev => prev !== count ? count : prev);

    } catch (error) {
      console.error("Failed to fetch unread notice count", error);
    }
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 3000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount, location.pathname]);

  return (
    <>
      <style>
        {`
          .sidebar-scroll::-webkit-scrollbar { width: 5px; }
          .sidebar-scroll::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.1); }
          .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.3); border-radius: 10px; }
          .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.5); }
        `}
      </style>

      {/* Mobile Toggle Button */}
      {!open && (
        <button
          className="md:hidden fixed top-4 left-4 z-50 bg-blue-900 text-white p-2 rounded-lg shadow-lg"
          onClick={() => setOpen(true)}
        >
          <FaBars />
        </button>
      )}

      {/* Sidebar Container */}
      <div
        className={`fixed md:sticky top-0 left-0 h-screen ${collapsed ? "w-20" : "w-64"
          } bg-gradient-to-b from-blue-900 to-blue-700 text-white shadow-xl flex flex-col z-40 transition-all duration-300 ${open ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0 border-r border-blue-800`}
      >

        {/* ✅ UPDATED: Toggle Button strictly inside the Sidebar */}
        <button
          className={`hidden md:flex absolute z-50 items-center justify-center w-8 h-8 bg-blue-600 border-2 border-white text-white rounded-full shadow-md transition-all duration-300
            ${collapsed 
              ? "top-20 left-1/2 -translate-x-1/2 scale-90"  // Collapsed: Moves below avatar, centered
              : "top-5 right-4"                              // Expanded: Top-right corner, inside padding
            }`}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <FaChevronRight size={14} /> : <FaChevronLeft size={14} />}
        </button>


        {/* Mobile Close Button */}
        {open && (
          <button
            className="md:hidden absolute top-4 right-4 text-white text-2xl"
            onClick={() => setOpen(false)}
          >
            <FaTimes />
          </button>
        )}

        {/* Header Section */}
        <div className={`flex items-center gap-3 p-4 h-16 shrink-0 transition-all duration-300 ${collapsed ? "justify-center" : "justify-start"}`}>
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 shadow-sm">
            <FaUser className="text-xl text-white" />
          </div>

          {!collapsed && (
            <div className="flex flex-col overflow-hidden whitespace-nowrap">
              <span className="text-lg font-bold tracking-wide">Employee</span>
              <span className="text-xs text-blue-200 uppercase tracking-wider">Panel</span>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="w-full h-[1px] bg-blue-500/30 mb-2"></div>

        {/* Navigation Links */}
        {/* Added 'pt-12' when collapsed to prevent overlap with the toggle button */}
        <ul className={`space-y-1 flex-1 overflow-y-auto sidebar-scroll px-3 pb-4 transition-all duration-300 ${collapsed ? "pt-12" : ""}`}>
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;

            return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={`relative flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 font-medium ${isActive
                    ? "bg-blue-600 text-white shadow-md border-l-4 border-white"
                    : "hover:bg-blue-800/50 text-gray-100 hover:text-white"
                    } ${collapsed ? "justify-center" : ""}`}
                >
                  <span className="text-xl shrink-0 drop-shadow-sm">{link.icon}</span>

                  {!collapsed && (
                    <span className="truncate flex-1">
                      {link.label}
                    </span>
                  )}

                  {/* Badge Logic */}
                  {!collapsed && link.isNotice && unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                      {unreadCount}
                    </span>
                  )}

                  {/* Small Dot for collapsed state notices */}
                  {collapsed && link.isNotice && unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border border-blue-900 rounded-full"></span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Footer Section */}
        {!collapsed && (
          <div className="p-4 text-center shrink-0 border-t border-blue-600/30 bg-blue-900/20">
            <div className="text-xs text-blue-200">
              &copy; {new Date().getFullYear()} HRMS System
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SidebarEmployee;