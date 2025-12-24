// --- START OF FILE Sidebar.jsx ---

import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  FaTachometerAlt,
  FaUsers,
  FaCalendarCheck,
  FaClipboardList,
  FaChartPie,
  FaBars,
  FaCalendarAlt,
  FaFileAlt,
  FaConnectdevelop,
  FaAngleDown,
  FaAngleRight,
  FaUserClock,
  FaBell
} from "react-icons/fa";
import { io } from "socket.io-client";
import { getLeaveRequests, getAllOvertimeRequests, getAllNoticesForAdmin } from "../../api";
import { AlarmClockCheck, MapPinnedIcon, MapPinPlusInsideIcon } from "lucide-react";

// SOCKET URL
const SOCKET_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT;

// REORGANIZED NAV LINKS WITH GROUPS
const navLinks = [
  { to: "/admin/dashboard", label: "Dashboard", icon: <FaTachometerAlt /> },

  // --- GROUP: EMPLOYEES ---
  {
    label: "Employees",
    icon: <FaUsers />,
    children: [
      { to: "/employees", label: "Employee Management", icon: <FaUsers /> },
      { to: "/attendance", label: "Employees Attendance", icon: <FaUserClock /> },
    ],
  },

  // --- GROUP: LEAVES ---
  {
    label: "Leaves",
    icon: <FaCalendarCheck />,
    children: [
      { to: "/admin/leave-summary", label: "Leave Summary", icon: <FaChartPie /> },
      {
        to: "/admin/admin-Leavemanage",
        label: "Leave Approvals",
        icon: <FaClipboardList />,
        isLeave: true, // Badge Logic
      },
    ],
  },

  // --- OTHER LINKS ---
  { to: "/admin/idle-time", label: "Idle Time", icon: <FaChartPie /> },
  { to: "/admin/payroll", label: "Payroll", icon: <FaFileAlt /> },
  { 
    to: "/admin/notices", 
    label: "Announcements", 
    icon: <FaClipboardList />,
    isNotice: true, // New: For notice badge
  },
  { to: "/admin/holiday-calendar", label: "Holiday Calendar", icon: <FaCalendarAlt /> },

  // BADGE LINKS (Overtime)
  {
    to: "/admin/admin-overtime",
    label: "Overtime Approval",
    icon: <FaChartPie />,
    isOvertime: true,
  },
  { to: "/admin/shifttype", label: "Location Settings", icon:<MapPinnedIcon /> },
  { to: "/admin/late-requests", label: "Late Login Requests", icon:<AlarmClockCheck /> },
  // { to: "/admin/meeting", label: "Meeting Scheduler", icon:<MapPinPlusInsideIcon /> },
];

// ✅ HELPER: Calculate unread notices using SERVER STATE
const calculateUnreadNotices = (notices, readState) => {
  if (!notices || !Array.isArray(notices)) return 0;
  
  let unreadNoticeCount = 0;
  
  notices.forEach(notice => {
    // Skip system configuration notices
    if (notice.title && notice.title.startsWith("__SYSTEM_")) return;
    if (!notice.replies || !Array.isArray(notice.replies)) return;
    
    // Group replies by employee
    const groups = notice.replies.reduce((acc, reply) => {
      const empId = reply.employeeId?._id || reply.employeeId; 
      if (empId) {
        if (!acc[empId]) acc[empId] = [];
        acc[empId].push(reply);
      }
      return acc;
    }, {});
    
    // Check if any employee in this notice has unread messages
    let hasAnyUnreadInNotice = false;
    
    Object.keys(groups).forEach(empId => {
      const messages = groups[empId];
      const lastEmployeeMsg = [...messages].reverse().find(m => m.sentBy === 'Employee');
      
      if (lastEmployeeMsg) {
        const storageKey = `${notice._id}_${empId}`;
        // ✅ Check against SERVER STATE instead of local storage
        const storedLastId = readState[storageKey];
        
        // If the last message ID matches what's on the server, it's read. Otherwise, unread.
        if (lastEmployeeMsg._id !== storedLastId) {
           hasAnyUnreadInNotice = true;
        }
      }
    });
    
    if (hasAnyUnreadInNotice) {
      unreadNoticeCount++;
    }
  });
  
  return unreadNoticeCount;
};

const Sidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [pendingOvertime, setPendingOvertime] = useState(0);
  const [socket, setSocket] = useState(null);
  
  // ✅ State for unread notice count & Server Read State
  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0);
  const [serverReadState, setServerReadState] = useState({});

  // ✅ Track previous counts for comparison
  const prevPendingLeaves = useRef(0);
  const prevPendingOvertime = useRef(0);
  const prevUnreadNoticeCount = useRef(0);
  
  // ✅ Track if we're currently on notices page
  const isOnNoticesPage = useRef(false);
  const hasPlayedSoundForCurrentCount = useRef(0);
  const [tempHideNoticeBadge, setTempHideNoticeBadge] = useState(false);
  const actualUnreadCount = useRef(0);

  // State for handling the hover/click dropdown
  const [activeMenu, setActiveMenu] = useState(null);

  const isPending = (status) =>
    typeof status === "string" && status.toLowerCase() === "pending";

  // -----------------------------
  // ✅ PLAY NOTIFICATION SOUND
  // -----------------------------
  const playNotificationSound = useCallback((type = "generic") => {
    if (isOnNoticesPage.current) return; // Don't play if looking at notices
    
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; 
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); 
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log("Audio error:", error);
    }
  }, []);

  // -----------------------------
  // ✅ FETCH AND CALCULATE UNREAD NOTICES (Includes System State)
  // -----------------------------
  const fetchAndCalculateUnreadNotices = useCallback(async (forceUpdate = false) => {
    try {
      const data = await getAllNoticesForAdmin();
      
      // 1. Extract Read State from Hidden Notice
      const configNotice = data.find(n => n.title === "__SYSTEM_READ_STATE__");
      let currentServerState = {};
      
      if (configNotice) {
          try {
              currentServerState = JSON.parse(configNotice.description);
              setServerReadState(currentServerState);
          } catch(e) { console.error("Error parsing read state", e); }
      }

      // 2. Filter Real Notices
      const realNotices = data.filter(n => !n.title.startsWith("__SYSTEM_"));

      // 3. Calculate Count
      const count = calculateUnreadNotices(realNotices, currentServerState);
      
      actualUnreadCount.current = count;
      
      if (!tempHideNoticeBadge || forceUpdate) {
        setUnreadNoticeCount(count);
      }
      
    } catch (error) {
      console.error("Error fetching unread notices:", error);
    }
  }, [tempHideNoticeBadge]);

  // -----------------------------
  // ✅ NOTIFICATION SOUND LOGIC
  // -----------------------------
  useEffect(() => {
    if (pendingLeaves > prevPendingLeaves.current) playNotificationSound("leave");
    prevPendingLeaves.current = pendingLeaves;

    if (pendingOvertime > prevPendingOvertime.current) playNotificationSound("overtime");
    prevPendingOvertime.current = pendingOvertime;

    if (unreadNoticeCount > prevUnreadNoticeCount.current && 
        unreadNoticeCount > hasPlayedSoundForCurrentCount.current) {
      playNotificationSound("notice");
      hasPlayedSoundForCurrentCount.current = unreadNoticeCount;
    }
    else if (unreadNoticeCount < prevUnreadNoticeCount.current) {
      hasPlayedSoundForCurrentCount.current = unreadNoticeCount;
    }
    prevUnreadNoticeCount.current = unreadNoticeCount;
  }, [pendingLeaves, pendingOvertime, unreadNoticeCount, playNotificationSound]);

  // -----------------------------
  // ✅ HANDLE PAGE NAVIGATION (Hide Badge on Notices Page)
  // -----------------------------
  useEffect(() => {
    const wasOnNoticesPage = isOnNoticesPage.current;
    isOnNoticesPage.current = location.pathname === "/admin/notices";
    
    if (location.pathname === "/admin/notices") {
        setTempHideNoticeBadge(true); // Hide badge while on the page
    } else if (wasOnNoticesPage && location.pathname !== "/admin/notices") {
        setTempHideNoticeBadge(false); // Restore when leaving
        setTimeout(() => setUnreadNoticeCount(actualUnreadCount.current), 100);
    }
  }, [location.pathname]);

  // -----------------------------
  // INITIAL FETCH
  // -----------------------------
  useEffect(() => {
    const fetchLeaves = async () => {
      const data = await getLeaveRequests();
      setPendingLeaves(data.filter((l) => isPending(l.status)).length);
    };
    fetchLeaves();
    
    const fetchOT = async () => {
      const data = await getAllOvertimeRequests();
      setPendingOvertime(data.filter((o) => isPending(o.status)).length);
    };
    fetchOT();

    fetchAndCalculateUnreadNotices();
  }, [fetchAndCalculateUnreadNotices]);

  // -----------------------------
  // SOCKET CONNECTION
  // -----------------------------
  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    s.on("connect", () => {
      try {
        const raw = sessionStorage.getItem("hrmsUser");
        if (raw) {
          const user = JSON.parse(raw);
          if (user?._id || user?.id) s.emit("register", user?._id || user?.id);
        }
      } catch (err) {}
    });
    setSocket(s);
    return () => s.disconnect();
  }, []);

  // -----------------------------
  // SOCKET EVENTS
  // -----------------------------
  useEffect(() => {
    if (!socket) return;
    
    // Leaves & OT
    socket.on("leave:new", () => setPendingLeaves(p => p + 1));
    socket.on("leave:updated", (d) => !isPending(d.status) && setPendingLeaves(p => Math.max(p - 1, 0)));
    socket.on("overtime:new", () => setPendingOvertime(p => p + 1));
    socket.on("overtime:updated", (d) => !isPending(d.status) && setPendingOvertime(p => Math.max(p - 1, 0)));

    // ✅ NOTICES: Real-time Update
    const handleNewReply = (data) => {
      if (data.sentBy === 'Employee') {
        actualUnreadCount.current += 1;
        if (!isOnNoticesPage.current) setUnreadNoticeCount(p => p + 1);
        setTimeout(() => fetchAndCalculateUnreadNotices(true), 1000);
      }
    };
    
    // ✅ SYSTEM STATE UPDATED (When read on another device)
    const handleNoticeUpdate = () => {
        setTimeout(() => fetchAndCalculateUnreadNotices(true), 1000);
    };

    socket.on("notice:reply:new", handleNewReply);
    socket.on("notice:updated", handleNoticeUpdate); // Catches the __SYSTEM_READ_STATE__ update
    
    return () => {
      socket.off("leave:new"); socket.off("leave:updated");
      socket.off("overtime:new"); socket.off("overtime:updated");
      socket.off("notice:reply:new", handleNewReply);
      socket.off("notice:updated", handleNoticeUpdate);
    };
  }, [socket, fetchAndCalculateUnreadNotices]);

  // -----------------------------
  // ✅ POLLING (Backup)
  // -----------------------------
  useEffect(() => {
    const interval = setInterval(fetchAndCalculateUnreadNotices, 5000);
    return () => clearInterval(interval);
  }, [fetchAndCalculateUnreadNotices]);

  // -----------------------------
  // RENDERING HELPERS
  // -----------------------------
  const handleMenuHover = (label, isEntering) => {
    if (isEntering) {
      if (collapsed) setCollapsed(false);
      setActiveMenu(label);
    } else {
      setActiveMenu(null);
    }
  };

  const renderBadge = (link) => {
    if (link.isLeave && pendingLeaves > 0) {
      return <span className="bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ml-auto">{pendingLeaves}</span>;
    }
    if (link.isOvertime && pendingOvertime > 0) {
      return <span className="bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ml-auto">{pendingOvertime}</span>;
    }
    // ✅ NOTICE BADGE: Real-time, Synced
    if (link.isNotice && unreadNoticeCount > 0 && !tempHideNoticeBadge) {
      return (
        <span className="relative flex items-center justify-center ml-auto">
          <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex bg-red-600 text-white text-xs font-bold w-5 h-5 rounded-full items-center justify-center">
            {unreadNoticeCount > 9 ? "9+" : unreadNoticeCount}
          </span>
        </span>
      );
    }
    return null;
  };

  // -----------------------------
  // MAIN RENDER
  // -----------------------------
  return (
    <div className={`h-screen bg-slate-900 shadow-xl transition-[width] duration-300 ${collapsed ? "w-20" : "w-72"} p-4 flex flex-col overflow-y-auto overflow-x-hidden`}>
      <div className={`flex items-center mb-6 ${collapsed ? "justify-center" : "justify-between"}`}>
        <div className={`flex items-center gap-3 transition-all hover:bg-slate-800 ${collapsed ? "w-0 opacity-0 hidden" : "w-full opacity-100 flex"}`} onClick={() => setCollapsed((p) => !p)}>
          <span className="text-3xl text-indigo-400"><FaConnectdevelop /></span>
          <span className="text-xl font-bold text-slate-200">HRMS</span>
        </div>
        <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-800" onClick={() => setCollapsed((p) => !p)}><FaBars /></button>
      </div>

      <ul className="space-y-2 flex-1">
        {navLinks.map((link, index) => {
          if (link.children) {
            const isOpen = activeMenu === link.label;
            return (
              <li key={index} className="relative" onMouseEnter={() => handleMenuHover(link.label, true)} onMouseLeave={() => handleMenuHover(link.label, false)}>
                <div className={`flex items-center gap-4 px-4 py-2.5 rounded-lg text-base cursor-pointer border-l-4 border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200 ${collapsed ? "justify-center px-2" : "justify-between"}`}>
                  <div className="flex items-center gap-4"><span className="text-xl w-5 flex justify-center">{link.icon}</span>{!collapsed && <span>{link.label}</span>}</div>
                  {!collapsed && <span className="text-xs">{isOpen ? <FaAngleDown /> : <FaAngleRight />}</span>}
                </div>
                <ul className={`bg-slate-800/50 rounded-lg overflow-hidden transition-all duration-300 ${isOpen && !collapsed ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0"}`}>
                  {link.children.map((child) => (
                    <li key={child.to}>
                      <NavLink to={child.to} className={({ isActive }) => `flex items-center gap-3 pl-12 pr-4 py-2 text-sm transition-colors ${isActive ? "text-indigo-400 font-semibold" : "text-slate-400 hover:text-slate-200"}`}>
                        <span className="flex-1">{child.label}</span>{renderBadge(child)}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>
            );
          }
          return (
            <li key={link.to}>
              <NavLink to={link.to} className={({ isActive }) => `flex items-center gap-4 px-4 py-2.5 rounded-lg text-base border-l-4 ${isActive ? "bg-slate-800 text-indigo-400 border-indigo-500" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-transparent"} ${collapsed ? "justify-center px-2" : ""}`}>
                <span className="text-xl w-5 flex justify-center">{link.icon}</span>
                {!collapsed && <span className="flex items-center gap-2 relative w-full">{link.label}{renderBadge(link)}</span>}
              </NavLink>
            </li>
          );
        })}
      </ul>
      <div className={`mt-auto text-center text-xs text-slate-500 ${collapsed ? "opacity-0 hidden" : "opacity-100 block"}`}>&copy; {new Date().getFullYear()} HRMS Admin</div>
    </div>
  );
};

export default Sidebar;
// --- END OF FILE Sidebar.jsx ---