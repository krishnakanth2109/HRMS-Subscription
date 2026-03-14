// --- START OF FILE Sidebar.jsx ---
import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  FaTachometerAlt,
  FaUserTie,
  FaUserClock,
  FaChartLine,
  FaCheckDouble,
  FaMoneyBillWave,
  FaBullhorn,
  FaCalendarAlt,
  FaBusinessTime,
  FaMapMarkedAlt,
  FaUserPlus,
  FaBars,
  FaTimes,
  FaAngleDown,
  FaConnectdevelop,
  FaAngleRight,
  FaSignOutAlt,
  FaUserCheck,
  FaLock,
  FaReceipt,
} from "react-icons/fa";

import { io } from "socket.io-client";
import {
  getLeaveRequests,
  getAllOvertimeRequests,
  getAllNoticesForAdmin,
  // getAllStatusCorrectionRequests
} from "../../api";
import api from "../../api";

// SOCKET URL
const SOCKET_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT;

// ⭐ ALL POSSIBLE NAV LINKS
// Each entry has a `route` key that MUST match the route string stored in the plan's features array in DB.
const ALL_NAV_LINKS = [
  { to: "/admin/dashboard",         route: "/admin/dashboard",         label: "Dashboard",             icon: <FaTachometerAlt /> },
  { to: "/employees",               route: "/employees",               label: "Employee Management",   icon: <FaUserTie /> },
  { to: "/attendance",              route: "/attendance",              label: "Employees Attendance",  icon: <FaUserClock /> },
  { to: "/admin/settings",          route: "/admin/settings",          label: "Shift Management",      icon: <FaUserPlus /> },
  { to: "/admin/shifttype",         route: "/admin/shifttype",         label: "Location Settings",     icon: <FaMapMarkedAlt /> },
  { to: "/admin/leave-summary",     route: "/admin/leave-summary",     label: "Leave Summary",         icon: <FaChartLine /> },
  { to: "/admin/holiday-calendar",  route: "/admin/holiday-calendar",  label: "Holiday Calendar",      icon: <FaCalendarAlt /> },
  { to: "/admin/payroll",           route: "/admin/payroll",           label: "Payroll",               icon: <FaMoneyBillWave /> },
  { to: "/admin/notices",           route: "/admin/notices",           label: "Announcements",         icon: <FaBullhorn />,      isNotice: true },
  { to: "/admin/admin-Leavemanage", route: "/admin/admin-Leavemanage", label: "Leave Requests",        icon: <FaCheckDouble />,   isLeave: true },
  { to: "/admin/late-requests",     route: "/admin/late-requests",     label: "Attendance Adjustment", icon: <FaUserCheck />,     isLateRequests: true },
  { to: "/admin/admin-overtime",    route: "/admin/admin-overtime",    label: "Overtime Requests",     icon: <FaBusinessTime />,  isOvertime: true },
  { to: "/admin/issues",   route: "/admin/issues",   label: "Technical Issues",    icon: <FaReceipt />,  isIssues: true },
];

// ✅ HELPER: Calculate unread notices
const calculateUnreadNotices = (notices, readState) => {
  if (!notices || !Array.isArray(notices)) return 0;
  let count = 0;
  notices.forEach((notice) => {
    if (notice.title?.startsWith("__SYSTEM_")) return;
    if (!notice.replies || !Array.isArray(notice.replies)) return;
    const groups = notice.replies.reduce((acc, reply) => {
      const empId = reply.employeeId?._id || reply.employeeId;
      if (empId) { if (!acc[empId]) acc[empId] = []; acc[empId].push(reply); }
      return acc;
    }, {});
    let hasUnread = false;
    Object.keys(groups).forEach((empId) => {
      const lastEmpMsg = [...groups[empId]].reverse().find((m) => m.sentBy === "Employee");
      if (lastEmpMsg && lastEmpMsg._id !== readState[`${notice._id}_${empId}`]) hasUnread = true;
    });
    if (hasUnread) count++;
  });
  return count;
};

const Sidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [pendingLeaves, setPendingLeaves]             = useState(0);
  const [pendingOvertime, setPendingOvertime]         = useState(0);
  const [punchOutRequestsCount, setPunchOutRequestsCount] = useState(0);
  const [lateRequestsCount, setLateRequestsCount]     = useState(0);
  const [workModeRequestsCount, setWorkModeRequestsCount] = useState(0);
  const [attendanceRequestsCount, setAttendanceRequestsCount] = useState(0);

  // ⭐ null = loading | string[] = loaded routes | "error" = failed
  const [allowedRoutes, setAllowedRoutes] = useState(null);

  const [socket, setSocket]                 = useState(null);
  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0);
  const [serverReadState, setServerReadState]     = useState({});

  const prevPendingLeaves           = useRef(0);
  const prevPendingOvertime         = useRef(0);
  const prevPunchOutRequests        = useRef(0);
  const prevLateRequests            = useRef(0);
  const prevWorkModeRequests        = useRef(0);
  const prevAttendanceRequestsCount = useRef(0);
  const prevUnreadNoticeCount       = useRef(0);
  const isOnNoticesPage             = useRef(false);
  const hasPlayedSoundForCurrentCount = useRef(0);
  const actualUnreadCount           = useRef(0);

  const [tempHideNoticeBadge, setTempHideNoticeBadge] = useState(false);
  const [activeMenu, setActiveMenu]                   = useState(null);
  const [isMobile, setIsMobile]                       = useState(window.innerWidth < 768);

  const isPending = (s) => typeof s === "string" && s.toLowerCase() === "pending";

  // ─── RESPONSIVE ───────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => { if (isMobile) setMobileOpen(false); }, [location.pathname, isMobile]);

  // ─── ⭐ FETCH PLAN FEATURES ─────────────────────────────────────
  // Strictly uses API response — does NOT fall back to showing all routes.
  useEffect(() => {
    const fetchPlanFeatures = async () => {
      try {
        const res = await api.get("/api/admin/my-plan-features");
        const routes = res.data?.allowedRoutes || [];
        setAllowedRoutes(routes);
      } catch (err) {
        console.error("Could not fetch plan features:", err);
        // ⭐ On error set empty — sidebar will show "unable to load" message.
        // Do NOT fall back to all routes — that defeats the purpose of plan-based access.
        setAllowedRoutes([]);
      }
    };
    fetchPlanFeatures();
  }, []);

  // ⭐ Filter navLinks strictly to only the routes allowed by this admin's plan
  const visibleNavLinks = allowedRoutes === null
    ? []  // Still loading — show nothing (skeleton shown separately)
    : ALL_NAV_LINKS.filter((link) => allowedRoutes.includes(link.route));

  // ─── AUDIO ────────────────────────────────────────────────────
  const playNotificationSound = useCallback((type = "generic") => {
    if (isOnNoticesPage.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 800; osc.type = "sine";
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }, []);

  // ─── FETCH UNREAD NOTICES ─────────────────────────────────────
  const fetchAndCalculateUnreadNotices = useCallback(async (forceUpdate = false) => {
    try {
      const data = await getAllNoticesForAdmin();
      const cfg = data.find((n) => n.title === "__SYSTEM_READ_STATE__");
      let state = {};
      if (cfg) { try { state = JSON.parse(cfg.description); setServerReadState(state); } catch {} }
      const real = data.filter((n) => !n.title.startsWith("__SYSTEM_"));
      const count = calculateUnreadNotices(real, state);
      actualUnreadCount.current = count;
      if (!tempHideNoticeBadge || forceUpdate) setUnreadNoticeCount(count);
    } catch {}
  }, [tempHideNoticeBadge]);

  // ─── FETCH COUNTS ────────────────────────────────────────────
  const fetchLateRequests = useCallback(async () => {
    try {
      const { data } = await api.get("/api/attendance/all");
      let n = 0;
      (data.data || []).forEach((emp) =>
        (emp.attendance || []).forEach((day) => {
          if (day.lateCorrectionRequest?.hasRequest && day.lateCorrectionRequest?.status === "PENDING") n++;
        })
      );
      setLateRequestsCount(n);
    } catch {}
  }, []);

  const fetchAttendanceRequests = useCallback(async () => {
    try {
      const data = await getAllStatusCorrectionRequests();
      setAttendanceRequestsCount((data.data || []).length);
    } catch {}
  }, []);

  const fetchOvertimeRequests = useCallback(async () => {
    try {
      const data = await getAllOvertimeRequests();
      setPendingOvertime(data.filter((o) => isPending(o.status)).length);
    } catch {}
  }, []);

  const fetchLeaveRequests = useCallback(async () => {
    try {
      const data = await getLeaveRequests();
      setPendingLeaves(data.filter((l) => isPending(l.status)).length);
    } catch {}
  }, []);

  // ─── NOTIFICATION SOUNDS ─────────────────────────────────────
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
    if (attendanceRequestsCount > prevAttendanceRequestsCount.current) playNotificationSound("generic");
    prevAttendanceRequestsCount.current = attendanceRequestsCount;
    if (unreadNoticeCount > prevUnreadNoticeCount.current && unreadNoticeCount > hasPlayedSoundForCurrentCount.current) {
      playNotificationSound("notice");
      hasPlayedSoundForCurrentCount.current = unreadNoticeCount;
    } else if (unreadNoticeCount < prevUnreadNoticeCount.current) {
      hasPlayedSoundForCurrentCount.current = unreadNoticeCount;
    }
    prevUnreadNoticeCount.current = unreadNoticeCount;
  }, [pendingLeaves, pendingOvertime, punchOutRequestsCount, lateRequestsCount, workModeRequestsCount, attendanceRequestsCount, unreadNoticeCount, playNotificationSound]);

  // ─── PAGE TRACKER ────────────────────────────────────────────
  useEffect(() => {
    const was = isOnNoticesPage.current;
    isOnNoticesPage.current = location.pathname === "/admin/notices";
    if (location.pathname === "/admin/notices") {
      setTempHideNoticeBadge(true);
    } else if (was) {
      setTempHideNoticeBadge(false);
      setTimeout(() => setUnreadNoticeCount(actualUnreadCount.current), 100);
    }
  }, [location.pathname]);

  // ─── INITIAL FETCH ────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      await fetchLeaveRequests();
      await fetchOvertimeRequests();
      await fetchLateRequests();
      await fetchAttendanceRequests();
      await fetchAndCalculateUnreadNotices();
    };
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchLeaveRequests, fetchOvertimeRequests, fetchLateRequests, fetchAttendanceRequests, fetchAndCalculateUnreadNotices]);

  // ─── SOCKET ───────────────────────────────────────────────────
  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    s.on("connect", () => {
      try {
        const raw = sessionStorage.getItem("hrmsUser");
        if (raw) { const u = JSON.parse(raw); if (u?._id || u?.id) s.emit("register", u?._id || u?.id); }
      } catch {}
    });
    setSocket(s);
    return () => s.disconnect();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("leave:new", fetchLeaveRequests);
    socket.on("leave:updated", fetchLeaveRequests);
    socket.on("overtime:new", fetchOvertimeRequests);
    socket.on("overtime:updated", fetchOvertimeRequests);
    socket.on("latecorrection:new", fetchLateRequests);
    socket.on("latecorrection:updated", fetchLateRequests);
    socket.on("attendancecorrection:new", fetchAttendanceRequests);
    socket.on("attendancecorrection:updated", fetchAttendanceRequests);
    const handleNewReply = (data) => {
      if (data.sentBy === "Employee") {
        actualUnreadCount.current += 1;
        if (!isOnNoticesPage.current) setUnreadNoticeCount((p) => p + 1);
        setTimeout(() => fetchAndCalculateUnreadNotices(true), 1000);
      }
    };
    const handleNoticeUpdate = () => setTimeout(() => fetchAndCalculateUnreadNotices(true), 1000);
    socket.on("notice:reply:new", handleNewReply);
    socket.on("notice:updated", handleNoticeUpdate);
    return () => {
      socket.off("leave:new", fetchLeaveRequests);
      socket.off("leave:updated", fetchLeaveRequests);
      socket.off("overtime:new", fetchOvertimeRequests);
      socket.off("overtime:updated", fetchOvertimeRequests);
      socket.off("latecorrection:new", fetchLateRequests);
      socket.off("latecorrection:updated", fetchLateRequests);
      socket.off("attendancecorrection:new", fetchAttendanceRequests);
      socket.off("attendancecorrection:updated", fetchAttendanceRequests);
      socket.off("notice:reply:new", handleNewReply);
      socket.off("notice:updated", handleNoticeUpdate);
    };
  }, [socket, fetchLeaveRequests, fetchOvertimeRequests, fetchLateRequests, fetchAttendanceRequests, fetchAndCalculateUnreadNotices]);

  // ─── BADGE HELPERS ────────────────────────────────────────────
  const handleSubMenuClick = (label) => {
    if (collapsed && !isMobile) { setCollapsed(false); setActiveMenu(label); }
    else setActiveMenu((prev) => (prev === label ? null : label));
  };

  const getBadgeCount = (link) => {
    if (link.isLeave) return pendingLeaves;
    if (link.isOvertime) return pendingOvertime;
    if (link.isPunchOutRequests) return punchOutRequestsCount;
    if (link.isLateRequests) return lateRequestsCount + attendanceRequestsCount;
    if (link.isWorkModeRequests) return workModeRequestsCount;
    if (link.isAttendanceRequests) return attendanceRequestsCount;
    if (link.isNotice && !tempHideNoticeBadge) return unreadNoticeCount;
    return 0;
  };

  const renderBadge = (link) => {
    const count = link.children
      ? link.children.reduce((sum, c) => sum + getBadgeCount(c), 0)
      : getBadgeCount(link);
    if (!count) return null;
    return (
      <span className="relative flex items-center justify-center ml-auto">
        <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex bg-red-600 text-white text-xs font-bold w-5 h-5 rounded-full items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      </span>
    );
  };

  // ─── SIDEBAR CLASSES ─────────────────────────────────────────
  const sidebarClasses = `
    h-screen bg-slate-900 shadow-xl flex flex-col transition-all duration-300 z-50 overflow-hidden
    ${isMobile
      ? `fixed top-0 left-0 ${mobileOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full"}`
      : `relative ${collapsed ? "w-20" : "w-72"}`}
  `;

  return (
    <>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Mobile toggle */}
      {isMobile && !mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-40 p-3 bg-slate-900 text-indigo-400 rounded-lg shadow-lg hover:bg-slate-800 transition-colors"
        >
          <FaBars size={20} />
        </button>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
      )}

      <div className={sidebarClasses}>
        {/* HEADER */}
        <div className={`flex items-center mb-6 p-4 shrink-0 ${collapsed && !isMobile ? "justify-center" : "justify-between"}`}>
          <div className={`flex items-center gap-3 transition-all ${collapsed && !isMobile ? "w-0 opacity-0 hidden" : "w-full opacity-100 flex"}`}>
            <span className="text-3xl text-indigo-400"><FaConnectdevelop /></span>
            <span className="text-xl font-bold text-slate-200 truncate">HRMS</span>
          </div>
          <button
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-800"
            onClick={() => isMobile ? setMobileOpen(false) : setCollapsed((p) => !p)}
          >
            {isMobile ? <FaTimes size={20} /> : <FaBars />}
          </button>
        </div>

        {/* NAV LINKS */}
        <ul className="space-y-2 flex-1 overflow-y-auto overflow-x-hidden p-4 pt-0 no-scrollbar">

          {/* ⭐ LOADING SKELETON */}
          {allowedRoutes === null && (
            <div className="space-y-2 px-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {/* ⭐ NO FEATURES CONFIGURED — show locked state */}
          {allowedRoutes !== null && visibleNavLinks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-2">
              <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
                <FaLock className="text-slate-500 text-xl" />
              </div>
              {(!collapsed || isMobile) && (
                <>
                  <p className="text-slate-400 text-xs font-semibold">No features available</p>
                  <p className="text-slate-600 text-xs">Contact your administrator to enable access.</p>
                </>
              )}
            </div>
          )}

          {/* ⭐ VISIBLE LINKS — strictly filtered by plan */}
          {visibleNavLinks.map((link, index) => {
            if (link.children) {
              const visibleChildren = link.children.filter((c) => allowedRoutes.includes(c.route));
              if (!visibleChildren.length) return null;
              const isOpen = activeMenu === link.label;
              return (
                <li key={index} className="relative">
                  <div
                    onClick={() => handleSubMenuClick(link.label)}
                    className={`flex items-center gap-4 px-4 py-2.5 rounded-lg text-base cursor-pointer
                      ${activeMenu === link.label ? "bg-slate-800 text-indigo-400" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}
                      ${collapsed && !isMobile ? "justify-center px-2" : ""}`}
                  >
                    <span className="text-xl w-5 flex justify-center shrink-0">{link.icon}</span>
                    {(!collapsed || isMobile) && (
                      <>
                        <span className="truncate flex-1">{link.label}</span>
                        {renderBadge(link)}
                        <span className="ml-2">{isOpen ? <FaAngleDown /> : <FaAngleRight />}</span>
                      </>
                    )}
                  </div>
                  <ul className={`bg-slate-800/50 rounded-lg overflow-hidden transition-[max-height,opacity,margin] duration-500 ease-in-out ${isOpen && (!collapsed || isMobile) ? "max-h-[1000px] opacity-100 mt-1" : "max-h-0 opacity-0 mt-0"}`}>
                    {visibleChildren.map((child) => (
                      <li key={child.to}>
                        <NavLink
                          to={child.to}
                          className={({ isActive }) =>
                            `flex items-center gap-3 pl-12 pr-4 py-2 text-sm transition-colors ${isActive ? "text-indigo-400 font-semibold" : "text-slate-400 hover:text-slate-200"}`
                          }
                        >
                          <span className="text-base w-4 flex justify-center shrink-0">{child.icon}</span>
                          <span className="flex-1 truncate">{child.label}</span>
                          {renderBadge(child)}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            }

            return (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  onClick={() => setActiveMenu(null)}
                  className={({ isActive }) =>
                    `flex items-center gap-4 px-4 py-2.5 rounded-lg text-base border-l-4 
                    ${isActive ? "bg-slate-800 text-indigo-400 border-indigo-500" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-transparent"}
                    ${collapsed && !isMobile ? "justify-center px-2" : ""}`
                  }
                >
                  <span className="text-xl w-5 flex justify-center shrink-0">{link.icon}</span>
                  {(!collapsed || isMobile) && (
                    <span className="flex items-center gap-2 relative w-full min-w-0">
                      <span className="truncate">{link.label}</span>
                      {renderBadge(link)}
                    </span>
                  )}
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