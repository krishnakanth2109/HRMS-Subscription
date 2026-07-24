import { NavLink, useLocation, Link } from "react-router-dom";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Swal from "sweetalert2";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  UserPlus,
  MapPin,
  PieChart,
  Calendar,
  ClipboardCheck,
  Clock,
  Briefcase,
  Settings,
  Megaphone,
  ChevronDown,
  IndianRupee,
  CalendarPlus,
  Receipt,
} from "lucide-react";
import { io } from "socket.io-client";
import {
  getLeaveRequests,
  getAllOvertimeRequests,
  getAllNoticesForAdmin,
} from "../../api";
import api from "../../api";

const SOCKET_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT;

const NavbarSupportAdminNav = ({ theme, inline = false }) => {
  const location = useLocation();
  const [activeDropdown, setActiveDropdown] = useState(null);
  const dropdownRef = useRef(null);

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
        {
          to: "/admin/expense",
          route: "/admin/expense",
          label: "Expense Management",
          icon: Receipt,
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
  const countPending = (items = []) =>
    items.reduce((count, item) => count + (isPending(item?.status) ? 1 : 0), 0);

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

  const fetchAndCalculateUnreadNotices = useCallback(async () => {
    try {
      const data = await getAllNoticesForAdmin();
      const cfg = data.find((n) => n.title === "__SYSTEM_READ_STATE__");
      let state = {};
      if (cfg) { try { state = JSON.parse(cfg.description); setServerReadState(state); } catch { } }
      const real = data.filter((n) => !n.title.startsWith("__SYSTEM_"));
      const count = calculateUnreadNotices(real, state);
      setUnreadNoticeCount(count);
    } catch { }
  }, []);

  const fetchLateRequests = useCallback(async () => {
    try {
      const response = await api.get("/api/attendance/all");
      const employees = response?.data?.data || [];
      const count = employees.reduce(
        (total, employee) =>
          total +
          (employee.attendance || []).filter(
            ({ lateCorrectionRequest }) =>
              lateCorrectionRequest?.hasRequest === true &&
              lateCorrectionRequest?.status === "PENDING"
          ).length,
        0
      );
      setLateRequestsCount(count);
    } catch (error) {
      console.error("Error fetching late requests:", error);
    }
  }, []);

  const fetchStatusCorrectionRequestCount = useCallback(async () => {
    const { data } = await api.get("/api/attendance/admin/status-correction-requests");
    return countPending(data?.data);
  }, []);

  const fetchPendingCorrectionCount = useCallback(async () => {
    const { data } = await api.get("/api/attendance/admin/pending-corrections");
    return (data?.data || []).length;
  }, []);

  const fetchAttendanceRequests = useCallback(async () => {
    try {
      const [statusCorrectionCount, pendingCorrectionCount] = await Promise.all([
        fetchStatusCorrectionRequestCount(),
        fetchPendingCorrectionCount(),
      ]);
      setAttendanceRequestsCount(statusCorrectionCount + pendingCorrectionCount);
    } catch (error) {
      console.error("Error fetching attendance requests:", error);
    }
  }, [fetchStatusCorrectionRequestCount, fetchPendingCorrectionCount]);

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
      setPendingOvertime(countPending(data));
    } catch { }
  }, []);

  const fetchLeaveRequests = useCallback(async () => {
    try {
      const data = await getLeaveRequests();
      setPendingLeaves(countPending(data));
    } catch { }
  }, []);

  const fetchPunchOutRequests = useCallback(async () => {
    try {
      const { data } = await api.get("/api/punchoutreq/all");
      setPunchOutRequestsCount(countPending(data));
    } catch (error) {
      console.error("Error fetching punch out requests:", error);
    }
  }, []);

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
    const s = io(SOCKET_URL, { transports: ["polling", "websocket"] });
    s.on("connect", () => {
      try {
        const raw = sessionStorage.getItem("hrmsUser");
        if (raw) { const u = JSON.parse(raw); if (u?._id || u?.id) s.emit("register", u?._id || u?.id); }
      } catch { }
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
    socket.on("notice:reply:new", fetchAndCalculateUnreadNotices);
    socket.on("notice:updated", fetchAndCalculateUnreadNotices);

    return () => {
      socket.off("leave:new");
      socket.off("leave:updated");
      socket.off("overtime:new");
      socket.off("overtime:updated");
      socket.off("latecorrection:new");
      socket.off("latecorrection:updated");
      socket.off("attendance:correctionNew");
      socket.off("attendance:correctionUpdate");
      socket.off("fullDay:new");
      socket.off("workMode:newRequest");
      socket.off("workMode:updated");
      socket.off("punchout:new");
      socket.off("punchout:updated");
      socket.off("notice:reply:new");
      socket.off("notice:updated");
    };
  }, [socket, fetchLeaveRequests, fetchOvertimeRequests, fetchLateRequests, fetchAttendanceRequests, fetchFullDayRequests, fetchWorkModeRequests, fetchPunchOutRequests, fetchAndCalculateUnreadNotices]);

  const getBadgeCount = (link) => {
    if (link.children) {
      return link.children.reduce((total, child) => total + getBadgeCount(child), 0);
    }
    if (link.isLeave) return pendingLeaves;
    if (link.isOvertime) return pendingOvertime;
    if (link.isPunchOutRequests) return punchOutRequestsCount;
    if (link.isLateRequests) return lateRequestsCount + attendanceRequestsCount + fullDayRequestsCount;
    if (link.isWorkModeRequests) return workModeRequestsCount;
    if (link.isAttendanceRequests) return attendanceRequestsCount;
    if (link.isNotice) return unreadNoticeCount;
    return 0;
  };

  const renderBadge = (link) => {
    const count = getBadgeCount(link);
    if (!count) return null;
    return (
      <span className="flex items-center justify-center h-4 min-w-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full ml-1.5 shadow-sm">
        {count > 99 ? "99+" : count}
      </span>
    );
  };

  const isRouteVisible = (link) => {
    if (link.ownerOnly && !isOwnerPlan) return false;
    if (link.children) return link.children.some(isRouteVisible);
    return isRouteAllowed(link);
  };

  const isRouteAllowed = (link) => {
    if (!link.route) return true;
    return isOwnerPlan || link.alwaysAllowed || allowedRoutes?.includes(link.route);
  };

  const isLinkActive = (link) => {
    if (!link.to && !link.route) return false;
    const target = link.route || link.to;
    return location.pathname === link.to || location.pathname === target || location.pathname.startsWith(`${target}/`);
  };

  const isSectionActive = (section) => {
    return section.links.some(link => {
      if (link.children) {
        return link.children.some(isLinkActive);
      }
      return isLinkActive(link);
    });
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

  if (allowedRoutes === null) {
    if (inline) return null;
    return (
      <div className="h-11 bg-slate-900 border-b border-slate-800 flex items-center justify-center">
        <div className="w-1/3 h-4 bg-slate-800 rounded animate-pulse" />
      </div>
    );
  }

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
        const hasVisibleLinks = section.links.some(isRouteVisible);
        if (!hasVisibleLinks) return null;

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
                    ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400" 
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50"
              }`}
            >
              {section.title}
              <ChevronDown size={13} className={`transition-transform duration-200 ${activeDropdown === sIdx ? "rotate-180" : ""}`} />
            </button>

            {activeDropdown === sIdx && (
              <div 
                className={`absolute left-1/2 -translate-x-1/2 mt-1.5 w-64 rounded-2xl border shadow-2xl p-2 z-[99] flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-md ${
                  inline ? "top-full mt-3" : "top-full"
                } ${
                  theme === "dark" 
                    ? "bg-slate-900/95 border-slate-800 text-slate-300" 
                    : "bg-white/95 border-slate-200/80 text-slate-700"
                }`}
              >
                {section.links.filter(isRouteVisible).map((link, lIdx) => {
                  const Icon = link.icon;
                  const childLinks = link.children?.filter(isRouteVisible) || [];
                  const isAllowed = isRouteAllowed(link) && isFeatureAssignedToSupportAdmin(link);

                  if (childLinks.length > 0) {
                    return (
                      <div key={lIdx} className="space-y-1 p-1">
                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2 mb-1">
                          {link.label}
                        </div>
                        <div className="flex flex-col gap-1">
                          {childLinks.map((child, cIdx) => {
                            const ChildIcon = child.icon || Icon;
                            const isChildAllowed = isRouteAllowed(child) && isFeatureAssignedToSupportAdmin(child);
                            const childActive = isLinkActive(child);

                            return isChildAllowed ? (
                              <NavLink
                                key={cIdx}
                                to={child.to}
                                onClick={() => setActiveDropdown(null)}
                                className={({ isActive }) => `
                                  flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all border-l-2
                                  ${isActive || childActive
                                    ? "bg-indigo-500/10 text-indigo-500 border-indigo-500"
                                    : "border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"}
                                `}
                              >
                                <ChildIcon size={16} />
                                <span>{child.label}</span>
                                {renderBadge(child)}
                              </NavLink>
                            ) : (
                              <button
                                key={cIdx}
                                type="button"
                                onClick={() => {
                                  setActiveDropdown(null);
                                  handleSupportAdminRestrictedClick();
                                }}
                                className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold opacity-50 border-l-2 border-transparent text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                              >
                                <ChildIcon size={16} />
                                <span>{child.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  const active = isLinkActive(link);
                  return isAllowed ? (
                    <NavLink
                      key={lIdx}
                      to={link.to}
                      onClick={() => setActiveDropdown(null)}
                      className={({ isActive }) => `
                        flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all border-l-2
                        ${isActive || active
                          ? "bg-indigo-500/10 text-indigo-500 border-indigo-500"
                          : "border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"}
                      `}
                    >
                      <Icon size={16} />
                      <span>{link.label}</span>
                      {renderBadge(link)}
                    </NavLink>
                  ) : (
                    <button
                      key={lIdx}
                      type="button"
                      onClick={() => {
                        setActiveDropdown(null);
                        handleSupportAdminRestrictedClick();
                      }}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold opacity-50 border-l-2 border-transparent text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      <Icon size={16} />
                      <span>{link.label}</span>
                    </button>
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

export default NavbarSupportAdminNav;
