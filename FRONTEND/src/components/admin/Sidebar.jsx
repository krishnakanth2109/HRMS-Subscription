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
  FaLayerGroup,
  FaMapMarkerAlt,
  FaTimes
} from "react-icons/fa";
import { io } from "socket.io-client";
import { 
  getLeaveRequests, 
  getAllOvertimeRequests, 
  getAllNoticesForAdmin
} from "../../api";
import { AlarmClockCheck } from "lucide-react";
import api from "../../api";

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
      { to: "/admin/groups", label: "Group Management", icon: <FaLayerGroup /> },
      { 
        to: "/attendance", 
        label: "Employees Attendance", 
        icon: <FaUserClock />,
        isPunchOutRequests: true // ✅ For punch out requests count
      },
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
  { to: "/admin/payroll", label: "Payroll", icon: <FaFileAlt /> },

  { 
    to: "/admin/notices", 
    label: "Announcements", 
    icon: <FaClipboardList />,
    isNotice: true, // For notice badge
  },
  { to: "/admin/holiday-calendar", label: "Holiday Calendar", icon: <FaCalendarAlt /> },

  // BADGE LINKS
  {
    to: "/admin/admin-overtime",
    label: "Overtime Approval",
    icon: <FaChartPie />,
    isOvertime: true,
  },
  { 
    to: "/admin/shifttype", 
    label: "Location Settings", 
    icon: <FaMapMarkerAlt />,
    isWorkModeRequests: true // ✅ For work mode requests count
  },

    { 
    to: "/admin/settings", 
    label: "Shift Management", 
    icon:  <FaChartPie />,
  
  },

  { 
    to: "/admin/late-requests", 
    label: "Late Login Requests", 
    icon: <AlarmClockCheck />,
    isLateRequests: true // ✅ For late login requests count
  },
  { to: "/admin/expense", label: "Expense Management", icon: <FaClipboardList /> },
];

// ✅ HELPER: Calculate unread notices using SERVER STATE
const calculateUnreadNotices = (notices, readState) => {
  if (!notices || !Array.isArray(notices)) return 0;

  let unreadNoticeCount = 0;

  notices.forEach(notice => {
    if (notice.title && notice.title.startsWith("__SYSTEM_")) return;
    if (!notice.replies || !Array.isArray(notice.replies)) return;

    const groups = notice.replies.reduce((acc, reply) => {
      const empId = reply.employeeId?._id || reply.employeeId;
      if (empId) {
        if (!acc[empId]) acc[empId] = [];
        acc[empId].push(reply);
      }
      return acc;
    }, {});

    let hasAnyUnreadInNotice = false;

    Object.keys(groups).forEach(empId => {
      const messages = groups[empId];
      const lastEmployeeMsg = [...messages].reverse().find(m => m.sentBy === 'Employee');

      if (lastEmployeeMsg) {
        const storageKey = `${notice._id}_${empId}`;
        const storedLastId = readState[storageKey];

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
  const [mobileOpen, setMobileOpen] = useState(false); // ✅ New state for Mobile Toggle
  
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [pendingOvertime, setPendingOvertime] = useState(0);
  
  // ✅ New counts from different modules
  const [punchOutRequestsCount, setPunchOutRequestsCount] = useState(0);
  const [lateRequestsCount, setLateRequestsCount] = useState(0);
  const [workModeRequestsCount, setWorkModeRequestsCount] = useState(0);
  
  const [socket, setSocket] = useState(null);
  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0);
  const [serverReadState, setServerReadState] = useState({});

  // ✅ Track previous counts for sound notifications
  const prevPendingLeaves = useRef(0);
  const prevPendingOvertime = useRef(0);
  const prevPunchOutRequests = useRef(0);
  const prevLateRequests = useRef(0);
  const prevWorkModeRequests = useRef(0);
  const prevUnreadNoticeCount = useRef(0);

  const isOnNoticesPage = useRef(false);
  const hasPlayedSoundForCurrentCount = useRef(0);
  const [tempHideNoticeBadge, setTempHideNoticeBadge] = useState(false);
  const actualUnreadCount = useRef(0);
  const [activeMenu, setActiveMenu] = useState(null);

  const isPending = (status) =>
    typeof status === "string" && status.toLowerCase() === "pending";

  // -----------------------------
  // ✅ CHECK MOBILE SCREEN
  // -----------------------------
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setMobileOpen(false); // Reset mobile state on desktop
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // -----------------------------
  // ✅ CLOSE SIDEBAR ON ROUTE CHANGE (MOBILE)
  // -----------------------------
  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [location.pathname, isMobile]);

  // -----------------------------
  // ✅ PLAY NOTIFICATION SOUND
  // -----------------------------
  const playNotificationSound = useCallback((type = "generic") => {
    if (isOnNoticesPage.current) return;

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
  // ✅ FETCH AND CALCULATE UNREAD NOTICES
  // -----------------------------
  const fetchAndCalculateUnreadNotices = useCallback(async (forceUpdate = false) => {
    try {
      const data = await getAllNoticesForAdmin();

      const configNotice = data.find(n => n.title === "__SYSTEM_READ_STATE__");
      let currentServerState = {};

      if (configNotice) {
        try {
          currentServerState = JSON.parse(configNotice.description);
          setServerReadState(currentServerState);
        } catch (e) { console.error("Error parsing read state", e); }
      }

      const realNotices = data.filter(n => !n.title.startsWith("__SYSTEM_"));
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
  // ✅ FETCH PUNCH OUT REQUESTS
  // -----------------------------
  const fetchPunchOutRequests = useCallback(async () => {
    try {
      const response = await api.get('/api/punchoutreq/all');
      const pendingCount = response.data.filter(r => r.status === 'Pending').length;
      setPunchOutRequestsCount(pendingCount);
    } catch (error) {
      console.error("Error fetching punch out requests:", error);
    }
  }, []);

  // -----------------------------
  // ✅ FETCH LATE LOGIN REQUESTS
  // -----------------------------
  const fetchLateRequests = useCallback(async () => {
    try {
      const { data } = await api.get("/api/attendance/all");
      const allRecords = data.data || [];
      let pendingCount = 0;

      allRecords.forEach((empRecord) => {
        if (empRecord.attendance && Array.isArray(empRecord.attendance)) {
          empRecord.attendance.forEach((dayLog) => {
            if (
              dayLog.lateCorrectionRequest?.hasRequest && 
              dayLog.lateCorrectionRequest?.status === "PENDING"
            ) {
              pendingCount++;
            }
          });
        }
      });

      setLateRequestsCount(pendingCount);
    } catch (err) {
      console.error("Error fetching late requests:", err);
    }
  }, []);

  // -----------------------------
  // ✅ FETCH WORK MODE REQUESTS
  // -----------------------------
  const fetchWorkModeRequests = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/requests");
      const pendingCount = data.filter(r => r.status === 'Pending').length;
      setWorkModeRequestsCount(pendingCount);
    } catch (err) { 
      console.error("Error fetching work mode requests:", err); 
    }
  }, []);

  // -----------------------------
  // ✅ FETCH OVERTIME REQUESTS
  // -----------------------------
  const fetchOvertimeRequests = useCallback(async () => {
    try {
      const data = await getAllOvertimeRequests();
      const pendingCount = data.filter((o) => isPending(o.status)).length;
      setPendingOvertime(pendingCount);
    } catch (err) {
      console.error("Error fetching overtime:", err);
    }
  }, []);

  // -----------------------------
  // ✅ FETCH LEAVE REQUESTS
  // -----------------------------
  const fetchLeaveRequests = useCallback(async () => {
    try {
      const data = await getLeaveRequests();
      const pendingCount = data.filter((l) => isPending(l.status)).length;
      setPendingLeaves(pendingCount);
    } catch (error) {
      console.error("Error fetching leaves:", error);
    }
  }, []);

  // -----------------------------
  // ✅ NOTIFICATION SOUND LOGIC
  // -----------------------------
  useEffect(() => {
    if (pendingLeaves > prevPendingLeaves.current) playNotificationSound("leave");
    prevPendingLeaves.current = pendingLeaves;

    if (pendingOvertime > prevPendingOvertime.current) playNotificationSound("overtime");
    prevPendingOvertime.current = pendingOvertime;

    if (punchOutRequestsCount > prevPunchOutRequests.current) playNotificationSound("generic");
    prevPunchOutRequests.current = punchOutRequestsCount;

    if (lateRequestsCount > prevLateRequests.current) playNotificationSound("generic");
    prevLateRequests.current = lateRequestsCount;

    if (workModeRequestsCount > prevWorkModeRequests.current) playNotificationSound("generic");
    prevWorkModeRequests.current = workModeRequestsCount;

    if (unreadNoticeCount > prevUnreadNoticeCount.current &&
      unreadNoticeCount > hasPlayedSoundForCurrentCount.current) {
      playNotificationSound("notice");
      hasPlayedSoundForCurrentCount.current = unreadNoticeCount;
    }
    else if (unreadNoticeCount < prevUnreadNoticeCount.current) {
      hasPlayedSoundForCurrentCount.current = unreadNoticeCount;
    }
    prevUnreadNoticeCount.current = unreadNoticeCount;
  }, [
    pendingLeaves, 
    pendingOvertime, 
    punchOutRequestsCount, 
    lateRequestsCount, 
    workModeRequestsCount, 
    unreadNoticeCount, 
    playNotificationSound
  ]);

  // -----------------------------
  // ✅ PAGE NAVIGATION TRACKER
  // -----------------------------
  useEffect(() => {
    const wasOnNoticesPage = isOnNoticesPage.current;
    isOnNoticesPage.current = location.pathname === "/admin/notices";

    if (location.pathname === "/admin/notices") {
      setTempHideNoticeBadge(true);
    } else if (wasOnNoticesPage && location.pathname !== "/admin/notices") {
      setTempHideNoticeBadge(false);
      setTimeout(() => setUnreadNoticeCount(actualUnreadCount.current), 100);
    }
  }, [location.pathname]);

  // -----------------------------
  // INITIAL FETCH ALL COUNTS
  // -----------------------------
  useEffect(() => {
    const fetchAllCounts = async () => {
      await fetchLeaveRequests();
      await fetchOvertimeRequests();
      await fetchPunchOutRequests();
      await fetchLateRequests();
      await fetchWorkModeRequests();
      await fetchAndCalculateUnreadNotices();
    };
    
    fetchAllCounts();
    const interval = setInterval(fetchAllCounts, 30000); 
    return () => clearInterval(interval);
  }, [
    fetchLeaveRequests,
    fetchOvertimeRequests,
    fetchPunchOutRequests,
    fetchLateRequests,
    fetchWorkModeRequests,
    fetchAndCalculateUnreadNotices
  ]);

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
      } catch (err) { }
    });
    setSocket(s);
    return () => s.disconnect();
  }, []);

  // -----------------------------
  // SOCKET EVENTS
  // -----------------------------
  useEffect(() => {
    if (!socket) return;
    
    socket.on("leave:new", fetchLeaveRequests);
    socket.on("leave:updated", fetchLeaveRequests);
    socket.on("overtime:new", fetchOvertimeRequests);
    socket.on("overtime:updated", fetchOvertimeRequests);
    socket.on("punchoutreq:new", fetchPunchOutRequests);
    socket.on("punchoutreq:updated", fetchPunchOutRequests);
    socket.on("latecorrection:new", fetchLateRequests);
    socket.on("latecorrection:updated", fetchLateRequests);
    socket.on("workmoderequest:new", fetchWorkModeRequests);
    socket.on("workmoderequest:updated", fetchWorkModeRequests);

    const handleNewReply = (data) => {
      if (data.sentBy === 'Employee') {
        actualUnreadCount.current += 1;
        if (!isOnNoticesPage.current) setUnreadNoticeCount(p => p + 1);
        setTimeout(() => fetchAndCalculateUnreadNotices(true), 1000);
      }
    };
    const handleNoticeUpdate = () => {
      setTimeout(() => fetchAndCalculateUnreadNotices(true), 1000);
    };

    socket.on("notice:reply:new", handleNewReply);
    socket.on("notice:updated", handleNoticeUpdate);

    return () => {
      socket.off("leave:new", fetchLeaveRequests); 
      socket.off("leave:updated", fetchLeaveRequests);
      socket.off("overtime:new", fetchOvertimeRequests); 
      socket.off("overtime:updated", fetchOvertimeRequests);
      socket.off("punchoutreq:new", fetchPunchOutRequests); 
      socket.off("punchoutreq:updated", fetchPunchOutRequests);
      socket.off("latecorrection:new", fetchLateRequests); 
      socket.off("latecorrection:updated", fetchLateRequests);
      socket.off("workmoderequest:new", fetchWorkModeRequests); 
      socket.off("workmoderequest:updated", fetchWorkModeRequests);
      socket.off("notice:reply:new", handleNewReply);
      socket.off("notice:updated", handleNoticeUpdate);
    };
  }, [
    socket, 
    fetchLeaveRequests, 
    fetchOvertimeRequests, 
    fetchPunchOutRequests, 
    fetchLateRequests, 
    fetchWorkModeRequests, 
    fetchAndCalculateUnreadNotices
  ]);

  // -----------------------------
  // RENDERING HELPERS
  // -----------------------------
  
  // ✅ UPDATED: ACCORDION LOGIC
  // If clicking same: Toggle. If clicking different: Open new, close old.
  const handleSubMenuClick = (label) => {
    if (collapsed && !isMobile) {
      setCollapsed(false);
      setActiveMenu(label);
    } else {
      setActiveMenu(prev => prev === label ? null : label);
    }
  };

  const renderBadge = (link) => {
    let count = 0;
    if (link.isLeave) count = pendingLeaves;
    else if (link.isOvertime) count = pendingOvertime;
    else if (link.isPunchOutRequests) count = punchOutRequestsCount;
    else if (link.isLateRequests) count = lateRequestsCount;
    else if (link.isWorkModeRequests) count = workModeRequestsCount;
    else if (link.isNotice && !tempHideNoticeBadge) count = unreadNoticeCount;

    if (count > 0) {
      return (
        <span className="relative flex items-center justify-center ml-auto">
          <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex bg-red-600 text-white text-xs font-bold w-5 h-5 rounded-full items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        </span>
      );
    }
    return null;
  };

  // -----------------------------
  // CALCULATE SIDEBAR CLASSES
  // -----------------------------
  const sidebarClasses = `
    h-screen bg-slate-900 shadow-xl flex flex-col transition-all duration-300 z-50 overflow-hidden
    ${isMobile 
      ? `fixed top-0 left-0 ${mobileOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full"}` 
      : `relative ${collapsed ? "w-20" : "w-72"}`
    }
  `;

  return (
    <>
      {/* ✅ HIDE SCROLLBAR STYLE */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* ✅ MOBILE TOGGLE BUTTON (Visible only on mobile when sidebar is closed) */}
      {isMobile && !mobileOpen && (
        <button 
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-40 p-3 bg-slate-900 text-indigo-400 rounded-lg shadow-lg hover:bg-slate-800 transition-colors"
        >
          <FaBars size={20} />
        </button>
      )}

      {/* ✅ BACKGROUND OVERLAY (Mobile only) */}
      {isMobile && mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ✅ SIDEBAR CONTAINER */}
      <div className={sidebarClasses}>
        
        {/* HEADER */}
        <div className={`flex items-center mb-6 p-4 shrink-0 ${collapsed && !isMobile ? "justify-center" : "justify-between"}`}>
          <div className={`flex items-center gap-3 transition-all ${collapsed && !isMobile ? "w-0 opacity-0 hidden" : "w-full opacity-100 flex"}`}>
            <span className="text-3xl text-indigo-400"><FaConnectdevelop /></span>
            <span className="text-xl font-bold text-slate-200 truncate">HRMS</span>
          </div>
          
          {/* Toggle Button: Shows Close icon on mobile, Bars on desktop */}
          <button 
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-800" 
            onClick={() => isMobile ? setMobileOpen(false) : setCollapsed((p) => !p)}
          >
            {isMobile ? <FaTimes size={20} /> : <FaBars />}
          </button>
        </div>

        {/* NAVIGATION LINKS */}
        <ul className="space-y-2 flex-1 overflow-y-auto overflow-x-hidden p-4 pt-0 no-scrollbar">
          {navLinks.map((link, index) => {
            // Case 1: HAS CHILDREN (e.g. Employees, Leaves)
            if (link.children) {
              const isOpen = activeMenu === link.label;
              return (
                <li key={index} className="relative">
                  
                  {/* Parent Item */}
                  <div 
                    className={`flex items-center gap-4 px-4 py-2.5 rounded-lg text-base cursor-pointer border-l-4 border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200 ${collapsed && !isMobile ? "justify-center px-2" : "justify-between"}`}
                    onClick={() => handleSubMenuClick(link.label)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-xl w-5 flex justify-center shrink-0">{link.icon}</span>
                      {(!collapsed || isMobile) && <span className="truncate">{link.label}</span>}
                    </div>
                    {(!collapsed || isMobile) && <span className="text-xs shrink-0">{isOpen ? <FaAngleDown /> : <FaAngleRight />}</span>}
                  </div>

                  {/* Submenu with Smooth Transition */}
                  <ul className={`bg-slate-800/50 rounded-lg overflow-hidden transition-[max-height,opacity,margin] duration-500 ease-in-out ${(isOpen && (!collapsed || isMobile)) ? "max-h-[1000px] opacity-100 mt-1" : "max-h-0 opacity-0 mt-0"}`}>
                    {link.children.map((child) => (
                      <li key={child.to}>
                        {/* Note: Clicking a child inside keeps the menu open (Standard router behavior, doesn't reset state) */}
                        <NavLink to={child.to} className={({ isActive }) => `flex items-center gap-3 pl-12 pr-4 py-2 text-sm transition-colors ${isActive ? "text-indigo-400 font-semibold" : "text-slate-400 hover:text-slate-200"}`}>
                          <span className="flex-1 truncate" title={child.label}>{child.label}</span>{renderBadge(child)}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            }
            // Case 2: SINGLE LINK (e.g. Dashboard, Payroll)
            return (
              <li key={link.to}>
                <NavLink 
                  to={link.to} 
                  // ✅ FIXED: CLICKING SINGLE LINK CLOSES ANY OPEN NESTED MENUS
                  onClick={() => setActiveMenu(null)}
                  className={({ isActive }) => `flex items-center gap-4 px-4 py-2.5 rounded-lg text-base border-l-4 ${isActive ? "bg-slate-800 text-indigo-400 border-indigo-500" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-transparent"} ${collapsed && !isMobile ? "justify-center px-2" : ""}`}
                >
                  <span className="text-xl w-5 flex justify-center shrink-0">{link.icon}</span>
                  {(!collapsed || isMobile) && <span className="flex items-center gap-2 relative w-full min-w-0"><span className="truncate">{link.label}</span>{renderBadge(link)}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>

        {/* FOOTER */}
        <div className={`mt-auto p-4 text-center text-xs text-slate-300 shrink-0 ${collapsed && !isMobile ? "opacity-0 hidden" : "opacity-100 block"}`}>
          &copy; {new Date().getFullYear()} HRMS Admin
        </div>
      </div>
    </>
  );
};

export default Sidebar;
// --- END OF FILE Sidebar.jsx ---