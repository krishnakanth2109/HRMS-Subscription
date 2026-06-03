import { NavLink, useLocation, Link } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import Swal from "sweetalert2";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  UserPlus,
  MapPin,
  PieChart,
  Calendar,
  Megaphone,
  ClipboardCheck,
  Clock,
  Briefcase,
  Settings,
  ShieldCheck,
  ReceiptText,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Lock,
  Menu,
  X,
  IndianRupee,
  CalendarPlus,
} from "lucide-react";

import { io } from "socket.io-client";
import {
  getLeaveRequests,
  getAllOvertimeRequests,
  getAllNoticesForAdmin,
} from "../../api";
import api from "../../api";

// SOCKET URL
const SOCKET_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT;

const SidebarSupportAdmin = ({ mobileOpen, setMobileOpen }) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const sidebarRef = useRef(null);

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("hrmsUser");
      if (raw) {
        setCurrentUser(JSON.parse(raw));
      }
    } catch (error) {
      console.error("Error retrieving user from session storage:", error);
    }
  }, []);

  const MANDATORY_ROUTES = [
    "/support-admin/dashboard",
    "/admin/dashboard",
    "/support-admin/my-attendance",
    "/admin/holiday-calendar",
    "/support-admin/leave-requests",
    "/admin/notices",
    "/admin/setup-face"
  ];

  const isFeatureAssignedToSupportAdmin = (link) => {
    if (!currentUser || currentUser.role !== "support-admin") return true;

    if (
      MANDATORY_ROUTES.includes(link.to) ||
      MANDATORY_ROUTES.includes(link.route)
    ) {
      return true;
    }

    if (currentUser.assignedFeatures === undefined || currentUser.assignedFeatures === null) {
      return true;
    }

    const assigned = Array.isArray(currentUser.assignedFeatures) ? currentUser.assignedFeatures : [];
    return assigned.includes(link.to) || assigned.includes(link.route);
  };

  const handleSupportAdminRestrictedClick = () => {
    Swal.fire({
      icon: "warning",
      title: "please contact admin for access",
      confirmButtonColor: "#4f46e5",
    });
  };

  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [pendingOvertime, setPendingOvertime] = useState(0);
  const [punchOutRequestsCount, setPunchOutRequestsCount] = useState(0);
  const [lateRequestsCount, setLateRequestsCount] = useState(0);
  const [workModeRequestsCount, setWorkModeRequestsCount] = useState(0);
  const [attendanceRequestsCount, setAttendanceRequestsCount] = useState(0);
  const [fullDayRequestsCount, setFullDayRequestsCount] = useState(0);

  const [allowedRoutes, setAllowedRoutes] = useState(null);
  const [isOwnerPlan, setIsOwnerPlan] = useState(false);

  const [socket, setSocket] = useState(null);
  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0);
  const [serverReadState, setServerReadState] = useState({});

  const prevPendingLeaves = useRef(0);
  const prevPendingOvertime = useRef(0);
  const prevPunchOutRequests = useRef(0);
  const prevLateRequests = useRef(0);
  const prevWorkModeRequests = useRef(0);
  const prevAttendanceRequestsCount = useRef(0);
  const prevFullDayRequestsCount = useRef(0);
  const prevUnreadNoticeCount = useRef(0);
  const isOnNoticesPage = useRef(false);
  const hasPlayedSoundForCurrentCount = useRef(0);
  const actualUnreadCount = useRef(0);

  const [tempHideNoticeBadge, setTempHideNoticeBadge] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // ⭐ NAV SECTIONS
  const NAV_SECTIONS = [
    {
      title: "Main",
      links: [
        {
          to: "/support-admin/dashboard",
          route: "/admin/dashboard",
          label: "Dashboard",
          icon: LayoutDashboard,
        },
        {
          to: "/support-admin/my-attendance",
          route: "/support-admin/my-attendance",
          label: "Attendance",
          icon: Clock,
          alwaysAllowed: true,
        },
        {
          to: "/employees",
          route: "/employees",
          label: "Employee Management",
          icon: Users,
          isPunchOutRequests: true,
        },
        {
          to: "/attendance",
          route: "/attendance",
          label: "Employees Attendance",
          icon: UserCheck,
        },
      ],
    },
    {
      title: "Management",
      links: [
        {
          to: "/admin/settings",
          route: "/admin/settings",
          label: "Shift Management",
          icon: UserPlus,
        },
        {
          to: "/admin/shifttype",
          route: "/admin/shifttype",
          label: "Location Settings",
          icon: MapPin,
          isWorkModeRequests: true,
        },
        {
          to: "/admin/leave-summary",
          route: "/admin/leave-summary",
          label: "Leave Summary",
          icon: PieChart,
        },
        {
          to: "/admin/holiday-calendar",
          route: "/admin/holiday-calendar",
          label: "Holiday Calendar",
          icon: Calendar,
        },
        {
          to: "/admin/payroll",
          route: "/admin/payroll",
          label: "Payroll",
          icon: IndianRupee,
        },
      ],
    },
    {
      title: "Requests",
      links: [
        {
          to: "/support-admin/leave-requests",
          route: "/support-admin/leave-requests",
          label: "My Leave Requests",
          icon: CalendarPlus,
          alwaysAllowed: true,
        },
        {
          to: "/admin/admin-Leavemanage",
          route: "/admin/admin-Leavemanage",
          label: "Leave Management",
          icon: ClipboardCheck,
          isLeave: true,
        },
        {
          to: "/admin/late-requests",
          route: "/admin/late-requests",
          label: "Attendance Requests",
          icon: Clock,
          isLateRequests: true,
        },
        {
          to: "/admin/admin-overtime",
          route: "/admin/admin-overtime",
          label: "Overtime Requests",
          icon: Briefcase,
          isOvertime: true,
        },
      ],
    },
    {
      title: "System",
      links: [
        {
          to: "/admin/notices",
          route: "/admin/notices",
          label: "Announcements",
          icon: Megaphone,
          isNotice: true,
        },
        {
          to: "/admin/live-tracking",
          route: "/admin/live-tracking",
          label: "Idle Tracking",
          icon: MapPin,
          isLiveTracking: true,
        },
        {
          to: "/admin/setup-face",
          route: "/admin/setup-face",
          label: "Settings",
          icon: Settings,
          alwaysAllowed: true,
        },
        // {
        //   to: "/admin/payrollcandidates",
        //   route: "/admin/payrollcandidates",
        //   label: "Payroll Candidates",
        //   icon: ReceiptText,
        //   isPayrollCandidates: true,
        //   ownerOnly: true,
        // },
      ],
    },
  ];

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

  const isPending = (s) => typeof s === "string" && s.toLowerCase() === "pending";

  const handleDisabledClick = (featureLabel) => {
    Swal.fire({
      title: `${featureLabel} Feature Restricted`,
      text: `The ${featureLabel} feature is not allocated to your current plan. Please contact support if you need access.`,
      icon: 'info',
      confirmButtonText: 'OK',
      confirmButtonColor: '#6366f1',
    });
  };

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [location.pathname, isMobile, setMobileOpen]);



  useEffect(() => {
    const fetchPlanFeatures = async () => {
      try {
        const res = await api.get("/api/admin/my-plan-features");
        const routes = res.data?.allowedRoutes || [];
        const ownerFlag = res.data?.isOwnerPlan || false;
        setIsOwnerPlan(ownerFlag);
        setAllowedRoutes(ownerFlag ? [] : routes);
      } catch (err) {
        console.error("Could not fetch plan features:", err);
        setAllowedRoutes([]);
      }
    };
    fetchPlanFeatures();
  }, []);

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
    } catch (error) {
      console.error("Error playing notification sound:", error);
    }
  }, []);

  const fetchAndCalculateUnreadNotices = useCallback(async (forceUpdate = false) => {
    try {
      const data = await getAllNoticesForAdmin();
      const cfg = data.find((n) => n.title === "__SYSTEM_READ_STATE__");
      let state = {};
      if (cfg) {
        try {
          state = JSON.parse(cfg.description);
          setServerReadState(state);
        } catch (error) {
          console.error("Error parsing notice read state:", error);
        }
      }
      const real = data.filter((n) => !n.title.startsWith("__SYSTEM_"));
      const count = calculateUnreadNotices(real, state);
      actualUnreadCount.current = count;
      if (!tempHideNoticeBadge || forceUpdate) setUnreadNoticeCount(count);
    } catch (error) {
      console.error("Error fetching notices:", error);
    }
  }, [tempHideNoticeBadge]);

  const fetchLateRequests = useCallback(async () => {
    try {
      const response = await api.get("/api/attendance/all");
      const employees = response?.data?.data || [];
      let count = 0;
      for (let i = 0; i < employees.length; i++) {
        const emp = employees[i];
        const attendance = emp.attendance || [];
        for (let j = 0; j < attendance.length; j++) {
          const day = attendance[j];
          if (day.lateCorrectionRequest && day.lateCorrectionRequest.hasRequest === true && day.lateCorrectionRequest.status === "PENDING") {
            count++;
          }
        }
      }
      setLateRequestsCount(count);
    } catch (error) {
      console.error("Error fetching late requests:", error);
    }
  }, []);

  const fetchAttendanceRequests = useCallback(async () => {
    try {
      const { data } = await api.get("/api/attendance/admin/status-correction-requests");
      const count1 = (data?.data || []).filter((r) => isPending(r.status)).length;
      const res2 = await api.get("/api/attendance/admin/pending-corrections");
      const count2 = (res2?.data?.data || []).length;
      setAttendanceRequestsCount(count1 + count2);
    } catch (error) {
      console.error("Error fetching attendance requests:", error);
    }
  }, []);

  const fetchFullDayRequests = useCallback(async () => {
    try {
      const { data } = await api.get("/api/attendance/admin/full-day-requests");
      setFullDayRequestsCount((data?.data || []).length);
    } catch (error) {
      console.error("Error fetching full day requests:", error);
    }
  }, []);

  const fetchWorkModeRequests = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/requests");
      const pendingCount = (data || []).filter(r => r.status === "Pending").length;
      setWorkModeRequestsCount(pendingCount);
    } catch (error) {
      console.error("Error fetching work mode requests:", error);
    }
  }, []);

  const fetchOvertimeRequests = useCallback(async () => {
    try {
      const data = await getAllOvertimeRequests();
      setPendingOvertime(data.filter((o) => isPending(o.status)).length);
    } catch (error) {
      console.error("Error fetching overtime requests:", error);
    }
  }, []);

  const fetchLeaveRequests = useCallback(async () => {
    try {
      const data = await getLeaveRequests();
      setPendingLeaves(data.filter((l) => isPending(l.status)).length);
    } catch (error) {
      console.error("Error fetching leave requests:", error);
    }
  }, []);

  const fetchPunchOutRequests = useCallback(async () => {
    try {
      const { data } = await api.get("/api/punchoutreq/all");
      const pendingCount = (data || []).filter(r => r.status === "Pending").length;
      setPunchOutRequestsCount(pendingCount);
    } catch (error) {
      console.error("Error fetching punch out requests:", error);
    }
  }, []);

  useEffect(() => {
    if (pendingLeaves > prevPendingLeaves.current) playNotificationSound("leave");
    prevPendingLeaves.current = pendingLeaves;
    if (pendingOvertime > prevPendingOvertime.current) playNotificationSound("overtime");
    prevPendingOvertime.current = pendingOvertime;
    if (punchOutRequestsCount > prevPunchOutRequests.current) {
      playNotificationSound("generic");
    }
    prevPunchOutRequests.current = punchOutRequestsCount;
    if (lateRequestsCount > prevLateRequests.current) playNotificationSound("generic");
    prevLateRequests.current = lateRequestsCount;
    if (workModeRequestsCount > prevWorkModeRequests.current) playNotificationSound("generic");
    prevWorkModeRequests.current = workModeRequestsCount;
    if (attendanceRequestsCount > prevAttendanceRequestsCount.current) playNotificationSound("generic");
    prevAttendanceRequestsCount.current = attendanceRequestsCount;
    if (fullDayRequestsCount > prevFullDayRequestsCount.current) playNotificationSound("generic");
    prevFullDayRequestsCount.current = fullDayRequestsCount;

    if (unreadNoticeCount > prevUnreadNoticeCount.current && unreadNoticeCount > hasPlayedSoundForCurrentCount.current) {
      playNotificationSound("notice");
      hasPlayedSoundForCurrentCount.current = unreadNoticeCount;
    } else if (unreadNoticeCount < prevUnreadNoticeCount.current) {
      hasPlayedSoundForCurrentCount.current = unreadNoticeCount;
    }
    prevUnreadNoticeCount.current = unreadNoticeCount;
  }, [pendingLeaves, pendingOvertime, punchOutRequestsCount, lateRequestsCount, workModeRequestsCount, attendanceRequestsCount, unreadNoticeCount, playNotificationSound, fullDayRequestsCount]);

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

  useEffect(() => {
    const fetchAll = async () => {
      await fetchLeaveRequests();
      await fetchOvertimeRequests();
      await fetchLateRequests();
      await fetchAttendanceRequests();
      await fetchFullDayRequests();
      await fetchWorkModeRequests();
      await fetchPunchOutRequests();
      await fetchAndCalculateUnreadNotices();
    };
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchLeaveRequests, fetchOvertimeRequests, fetchLateRequests, fetchAttendanceRequests, fetchFullDayRequests, fetchAndCalculateUnreadNotices, fetchWorkModeRequests]);

  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    s.on("connect", () => {
      try {
        const raw = sessionStorage.getItem("hrmsUser");
        if (raw) {
          const u = JSON.parse(raw);
          if (u?._id || u?.id) s.emit("register", u?._id || u?.id);
        }
      } catch (error) {
        console.error("Error retrieving user from session storage:", error);
      }
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
    socket.on("attendance:correctionNew", fetchAttendanceRequests);
    socket.on("attendance:correctionUpdate", fetchAttendanceRequests);
    socket.on("fullDay:new", fetchFullDayRequests);
    socket.on("workMode:newRequest", fetchWorkModeRequests);
    socket.on("workMode:updated", fetchWorkModeRequests);
    socket.on("punchout:new", fetchPunchOutRequests);
    socket.on("punchout:updated", fetchPunchOutRequests);

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
      socket.off("attendance:correctionNew", fetchAttendanceRequests);
      socket.off("attendance:correctionUpdate", fetchAttendanceRequests);
      socket.off("fullDay:new", fetchFullDayRequests);
      socket.off("workMode:newRequest", fetchWorkModeRequests);
      socket.off("workMode:updated", fetchWorkModeRequests);
      socket.off("punchout:new", fetchPunchOutRequests);
      socket.off("punchout:updated", fetchPunchOutRequests);
      socket.off("notice:reply:new", handleNewReply);
      socket.off("notice:updated", handleNoticeUpdate);
    };
  }, [socket, fetchLeaveRequests, fetchOvertimeRequests, fetchLateRequests, fetchAttendanceRequests, fetchAndCalculateUnreadNotices, fetchFullDayRequests, fetchWorkModeRequests]);

  const getBadgeCount = (link) => {
    if (link.isLeave) return pendingLeaves;
    if (link.isOvertime) return pendingOvertime;
    if (link.isPunchOutRequests) return punchOutRequestsCount;
    if (link.isLateRequests) return lateRequestsCount + attendanceRequestsCount + fullDayRequestsCount;
    if (link.isWorkModeRequests) return workModeRequestsCount;
    if (link.isAttendanceRequests) return attendanceRequestsCount;
    if (link.isNotice && !tempHideNoticeBadge) return unreadNoticeCount;
    return 0;
  };

  const renderBadge = (link) => {
    const count = getBadgeCount(link);
    if (!count) return null;
    return (
      <span className="flex items-center justify-center ml-auto h-5 min-w-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
        {count > 99 ? "99+" : count}
      </span>
    );
  };

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
        <div className={`h-16 flex items-center px-4 shrink-0 ${collapsed && !isMobile ? "flex-col justify-center gap-1 py-2" : "justify-between"}`}>
          {!collapsed || isMobile ? (
            <>
              <div className="flex items-center gap-3 overflow-hidden">
                <img
                  src="https://image2url.com/r2/default/images/1774247571292-e7459e42-1868-4206-bd5c-bb4c59de5716.png"
                  alt="Logo"
                  className="h-[68px] w-auto object-contain"
                />
              </div>
              {!isMobile && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsed(true);
                    setIsPinned(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-md transition-all shrink-0"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft size={18} />
                </button>
              )}
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                V
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsed(false);
                  setIsPinned(true);
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-md transition-all shrink-0"
                title="Expand Sidebar"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
          {isMobile && (
            <button onClick={() => setMobileOpen(false)} className="p-1 text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-6 no-scrollbar">
          {allowedRoutes === null ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 bg-slate-800/50 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            NAV_SECTIONS.map((section, sIdx) => {
              const visibleLinks = section.links.filter(link => {
                if (link.ownerOnly && !isOwnerPlan) return false;
                return true;
              });

              if (visibleLinks.length === 0) return null;

              return (
                <div key={sIdx} className="space-y-1">
                  {(!collapsed || isMobile) && (
                    <h4 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      {section.title}
                    </h4>
                  )}
                  <div className="space-y-1">
                    {visibleLinks.map((link, lIdx) => {
                      const isAllowed = isOwnerPlan || link.alwaysAllowed || allowedRoutes.includes(link.route);
                      const Icon = link.icon;

                      return (
                        <div key={lIdx}>
                          {isAllowed ? (
                            isFeatureAssignedToSupportAdmin(link) ? (
                              <NavLink
                                to={link.to}
                                className={({ isActive }) => `
                                  group flex items-center gap-3 px-3 min-h-[44px] rounded-md transition-all duration-200
                                  ${isActive 
                                    ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500" 
                                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-2 border-transparent"}
                                  ${collapsed && !isMobile ? "justify-center px-0" : ""}
                                `}
                                title={collapsed && !isMobile ? link.label : ""}
                              >
                                <Icon size={20} className="shrink-0" />
                                {(!collapsed || isMobile) && (
                                  <>
                                    <span className="text-[14px] font-medium truncate">{link.label}</span>
                                    {renderBadge(link)}
                                  </>
                                )}
                              </NavLink>
                            ) : (
                              <div
                                onClick={handleSupportAdminRestrictedClick}
                                className={`
                                  flex items-center gap-3 px-3 min-h-[44px] rounded-md text-slate-600 cursor-pointer hover:bg-slate-800/30 transition-all
                                  ${collapsed && !isMobile ? "justify-center px-0" : ""}
                                `}
                                title={collapsed && !isMobile ? link.label : ""}
                              >
                                <Icon size={20} className="shrink-0 opacity-50" />
                                {(!collapsed || isMobile) && (
                                  <>
                                    <span className="text-[14px] font-medium truncate">{link.label}</span>
                                    <Lock size={12} className="ml-auto opacity-50 text-red-500" />
                                  </>
                                )}
                              </div>
                            )
                          ) : (
                            <div
                              onClick={() => handleDisabledClick(link.label)}
                              className={`
                                flex items-center gap-3 px-3 min-h-[44px] rounded-md text-slate-600 cursor-pointer hover:bg-slate-800/30 transition-all
                                ${collapsed && !isMobile ? "justify-center px-0" : ""}
                              `}
                            >
                              <Icon size={20} className="shrink-0 opacity-50" />
                              {(!collapsed || isMobile) && (
                                  <>
                                    <span className="text-[14px] font-medium truncate">{link.label}</span>
                                    <Lock size={12} className="ml-auto opacity-50" />
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })
          )}
        </nav>

        {/* Footer / Version */}
        <div className="p-3 border-t border-slate-800">
          <Link
            to="/support-admin/whats-new"
            className={`flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800/30 transition-all cursor-pointer ${collapsed && !isMobile ? "justify-center" : ""}`}
          >
             {(!collapsed || isMobile) ? (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-slate-300 truncate">Support Admin Panel</span>
                  <span className="text-[10px] text-indigo-400 hover:underline">v5.2.0</span>
                </div>
             ) : (
               <span className="text-[10px] text-indigo-400 font-bold hover:underline">V5</span>
             )}
          </Link>
        </div>
      </aside>
    </>
  );
};

export default SidebarSupportAdmin;
