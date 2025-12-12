import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useContext, useCallback, useRef } from "react";
import {
  FaHome,
  FaClock,
  FaClipboardList,
  FaBullhorn,
  FaUser,
  FaBars,
  FaTimes,
} from "react-icons/fa";

// Import AuthContext to get current user details
import { AuthContext } from "../../context/AuthContext";
// Import API to fetch real DB data
import api from "../../api"; 

const navLinks = [
  { to: "/employee/dashboard", label: "Dashboard", icon: <FaHome /> },
  { to: "/employee/my-attendence", label: "Attendance", icon: <FaClock /> },
  { to: "/employee/holiday-calendar", label: "Holiday Calendar", icon: <FaClipboardList /> },
  { to: "/employee/notices", label: "Notice Board", icon: <FaBullhorn />,   isNotice: true },
  { to: "/employee/empovertime", label: "Request Overtime", icon: <FaClock /> },
  { to: "/employee/leave-management", label: "Leave Requests", icon: <FaClipboardList /> },
  { to: "/employee/reuestworkmode", label: "Request WorkMode", icon: <FaClock /> },
];

const SidebarEmployee = () => {
  const location = useLocation();
  const [open, setOpen] = useState(window.innerWidth >= 768);
  const [collapsed, setCollapsed] = useState(false);

  // Get current user to check against DB records and get NAME
  const { user } = useContext(AuthContext);
  
  // Local state for accurate DB count
  const [unreadCount, setUnreadCount] = useState(0);

  // ✅ Refs to track previous count for Sound Logic (Prevents re-renders)
  const lastCountRef = useRef(0);
  const firstLoadRef = useRef(true);

  useEffect(() => {
    const resize = () => setOpen(window.innerWidth >= 768);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ✅ SOUND FUNCTION WITH NAME
  const playNoticeSound = () => {
    if ('speechSynthesis' in window && user?.name) {
      window.speechSynthesis.cancel(); // Stop any current speech
      // Speak Name + Message
      const utterance = new SpeechSynthesisUtterance(`${user.name}, please check notices`);
      utterance.rate = 1.0; // Normal speed
      window.speechSynthesis.speak(utterance);
    }
  };

  // ✅ FETCH REAL UNREAD COUNT (Wrapped in useCallback)
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get("/api/notices");
      
      const count = data.filter(notice => {
        // Check if current user ID is present inside the readBy array
        const isRead = notice.readBy && notice.readBy.some(record => {
          const recordId = typeof record.employeeId === 'object' 
            ? record.employeeId._id 
            : record.employeeId;
          return recordId === (user._id || user.id);
        });

        // Return true if NOT read (to count it)
        return !isRead;
      }).length;

      // ✅ SOUND LOGIC: Check if count increased
      if (!firstLoadRef.current) {
         if (count > lastCountRef.current) {
            playNoticeSound();
         }
      } else {
         firstLoadRef.current = false; // Mark initial load complete
      }

      // Update Ref
      lastCountRef.current = count;

      // Only update state if count is different to prevent blinking/re-renders
      setUnreadCount(prev => prev !== count ? count : prev);
      
    } catch (error) {
      console.error("Failed to fetch unread notice count", error);
    }
  }, [user]); // user dependency ensures we have the name available

  // ✅ POLLING EFFECT: Updates every 3 seconds & on Route Change
  useEffect(() => {
    // 1. Fetch immediately on mount or route change
    fetchUnreadCount();

    // 2. Poll every 3 seconds to catch incoming notices without refresh
    const interval = setInterval(fetchUnreadCount, 3000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [fetchUnreadCount, location.pathname]); 

  return (
    <>
      {!open && (
        <button
          className="md:hidden fixed top-4 left-4 z-50 bg-blue-900 text-white p-2 rounded-lg shadow-lg"
          onClick={() => setOpen(true)}
        >
          <FaBars />
        </button>
      )}

      <div
        className={`fixed md:static top-0 left-0 h-full ${
          collapsed ? "w-20" : "w-64"
        } bg-gradient-to-b from-blue-900 to-blue-700 text-white shadow-xl flex flex-col p-4 md:p-6 z-40 transition-all ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <button
          className="hidden md:block absolute top-4 right-6 text-white text-xl bg-blue-700 rounded-full p-2"
          onClick={() => setCollapsed((v) => !v)}
        >
          <FaBars />
        </button>

        {open && (
          <button
            className="md:hidden absolute top-4 right-4 text-white text-2xl"
            onClick={() => setOpen(false)}
          >
            <FaTimes />
          </button>
        )}

        <div
          className={`mb-8 flex items-center gap-1 mt-2 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {!collapsed && <FaUser className="text-3xl" />}
          {!collapsed && (
            <span className="text-lg font-bold">Employee Panel</span>
          )}
        </div>

        <ul className="space-y-2 flex-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;

            return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-semibold ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "hover:bg-blue-700 text-gray-200"
                  } ${collapsed ? "justify-center px-2" : ""}`}
                >
                  <span className="text-xl">{link.icon}</span>

                  {!collapsed && (
                    <span className="relative">
                      {link.label}

                      {/* ✅ Updated Badge Logic with Polling & Sound */}
                      {link.isNotice && unreadCount > 0 && (
                        <span className="absolute -right-5 top-0 bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full animate-pulse">
                          {unreadCount}
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {!collapsed && (
          <div className="mt-2 text-xs text-gray-300">
            &copy; {new Date().getFullYear()} HRMS Employee
          </div>
        )}
      </div>
    </>
  );
};

export default SidebarEmployee;