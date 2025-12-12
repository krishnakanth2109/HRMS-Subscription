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
import { MapPinnedIcon, MapPinPlusInsideIcon } from "lucide-react";

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
    label: "Post Notices", 
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
];

// ✅ Helper function from AdminNotices.jsx to calculate unread notices
const calculateUnreadNotices = (notices, localReadMap) => {
  if (!notices || !Array.isArray(notices)) return 0;
  
  let unreadNoticeCount = 0;
  
  notices.forEach(notice => {
    if (!notice.replies || !Array.isArray(notice.replies)) return;
    
    // Group replies by employee
    const groups = notice.replies.reduce((acc, reply) => {
      const empId = reply.employeeId?._id || reply.employeeId; 
      const empName = reply.employeeId?.name || "Unknown";
      
      if (empId) {
        if (!acc[empId]) {
          acc[empId] = { name: empName, messages: [], hasUnread: false };
        }
        acc[empId].messages.push(reply);
      }
      return acc;
    }, {});
    
    // Check if any employee in this notice has unread messages
    let hasAnyUnreadInNotice = false;
    
    Object.keys(groups).forEach(empId => {
      const group = groups[empId];
      const lastEmployeeMsg = [...group.messages].reverse().find(m => m.sentBy === 'Employee');
      
      if (lastEmployeeMsg) {
        const storageKey = `${notice._id}_${empId}`;
        const storedLastId = localReadMap[storageKey];
        
        if (lastEmployeeMsg._id === storedLastId) {
          // This conversation has been read
        } else {
          // Check if the message is unread in backend
          const hasUnread = group.messages.some(m => m.sentBy === 'Employee' && !m.isRead);
          if (hasUnread) {
            hasAnyUnreadInNotice = true;
          }
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
  
  // ✅ State for unread notice count
  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0);
  // ✅ Local storage state (same as in AdminNotices.jsx)
  const [localReadMap, setLocalReadMap] = useState(() => {
    try {
      const stored = localStorage.getItem("adminReadRepliesV3");
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });

  // ✅ Track previous counts for comparison
  const prevPendingLeaves = useRef(0);
  const prevPendingOvertime = useRef(0);
  const prevUnreadNoticeCount = useRef(0);
  
  // ✅ Track if we're currently on notices page
  const isOnNoticesPage = useRef(false);
  // ✅ Track if we've already played sound for current notification
  const hasPlayedSoundForCurrentCount = useRef(0);
  // ✅ Track if we should temporarily hide badge on notices page
  const [tempHideNoticeBadge, setTempHideNoticeBadge] = useState(false);
  // ✅ Store the actual unread count separately
  const actualUnreadCount = useRef(0);

  // State for handling the hover/click dropdown
  const [activeMenu, setActiveMenu] = useState(null);

  const isPending = (status) =>
    typeof status === "string" && status.toLowerCase() === "pending";

  // -----------------------------
  // ✅ PLAY NOTIFICATION SOUND OR SPEECH
  // -----------------------------
  const playNotificationSound = useCallback((type = "generic") => {
    // Don't play sound if we're on the notices page
    if (isOnNoticesPage.current) {
      console.log("🔕 On notices page, skipping sound");
      return;
    }
    
    try {
      // Try to play a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; // Higher pitch
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // 10% volume
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      // Also try to speak notification based on type
      if ('speechSynthesis' in window) {
        let message = "New Message";
        if (type === "leave") message = "New Leave Request";
        if (type === "overtime") message = "New Overtime Request";
        
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.volume = 0.5; // 50% volume
        utterance.rate = 1.0; // Normal speed
        
        // Cancel any ongoing speech
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
      }
      
    } catch (error) {
      console.log("Audio/Speech error:", error);
    }
  }, []);

  // -----------------------------
  // ✅ FETCH AND CALCULATE UNREAD NOTICES
  // -----------------------------
  const fetchAndCalculateUnreadNotices = useCallback(async (forceUpdate = false) => {
    try {
      const notices = await getAllNoticesForAdmin();
      const count = calculateUnreadNotices(notices, localReadMap);
      
      // Store actual count
      actualUnreadCount.current = count;
      
      // Only update if not temporarily hiding badge or force update
      if (!tempHideNoticeBadge || forceUpdate) {
        setUnreadNoticeCount(count);
      }
      
      console.log("📊 Actual unread count:", count, "Display count:", unreadNoticeCount);
    } catch (error) {
      console.error("Error fetching unread notices:", error);
      setUnreadNoticeCount(0);
      actualUnreadCount.current = 0;
    }
  }, [localReadMap, tempHideNoticeBadge, unreadNoticeCount]);

  // -----------------------------
  // ✅ CHECK FOR NEW NOTIFICATIONS AND PLAY SOUND
  // -----------------------------
  useEffect(() => {
    // Check for new leaves
    if (pendingLeaves > prevPendingLeaves.current) {
      console.log("🔔 New leave request!");
      playNotificationSound("leave");
    }
    prevPendingLeaves.current = pendingLeaves;

    // Check for new overtime
    if (pendingOvertime > prevPendingOvertime.current) {
      console.log("🔔 New overtime request!");
      playNotificationSound("overtime");
    }
    prevPendingOvertime.current = pendingOvertime;

    // Check for new notices - Only play sound for NEW unread messages
    if (unreadNoticeCount > prevUnreadNoticeCount.current && 
        unreadNoticeCount > hasPlayedSoundForCurrentCount.current) {
      console.log("🔔 New notice message!");
      playNotificationSound("notice");
      // Track that we've played sound for this count
      hasPlayedSoundForCurrentCount.current = unreadNoticeCount;
    }
    // Reset the tracking when count goes down (messages read)
    else if (unreadNoticeCount < prevUnreadNoticeCount.current) {
      hasPlayedSoundForCurrentCount.current = unreadNoticeCount;
    }
    
    prevUnreadNoticeCount.current = unreadNoticeCount;
  }, [pendingLeaves, pendingOvertime, unreadNoticeCount, playNotificationSound]);

  // -----------------------------
  // ✅ UPDATE NOTICES PAGE STATUS
  // -----------------------------
  useEffect(() => {
    const wasOnNoticesPage = isOnNoticesPage.current;
    isOnNoticesPage.current = location.pathname === "/admin/notices";
    
    // When leaving notices page, restore the actual count
    if (wasOnNoticesPage && !isOnNoticesPage.current && tempHideNoticeBadge) {
      console.log("📋 Leaving notices page - restoring badge count");
      setTempHideNoticeBadge(false);
      // Restore actual count after a short delay
      setTimeout(() => {
        setUnreadNoticeCount(actualUnreadCount.current);
      }, 100);
    }
    
    // When leaving notices page, reset the sound tracking
    if (!isOnNoticesPage.current && prevUnreadNoticeCount.current > 0) {
      hasPlayedSoundForCurrentCount.current = prevUnreadNoticeCount.current;
    }
  }, [location.pathname, tempHideNoticeBadge]);

  // -----------------------------
  // INITIAL FETCH FOR COUNTS
  // -----------------------------
  useEffect(() => {
    const fetchLeaves = async () => {
      const data = await getLeaveRequests();
      setPendingLeaves(data.filter((l) => isPending(l.status)).length);
    };
    fetchLeaves();
  }, []);

  useEffect(() => {
    const fetchOT = async () => {
      const data = await getAllOvertimeRequests();
      setPendingOvertime(data.filter((o) => isPending(o.status)).length);
    };
    fetchOT();
  }, []);

  // ✅ Initial fetch for unread notices
  useEffect(() => {
    fetchAndCalculateUnreadNotices();
  }, [fetchAndCalculateUnreadNotices]);

  // -----------------------------
  // SINGLE SOCKET CONNECTION
  // -----------------------------
  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    s.on("connect", () => {
      try {
        const raw = sessionStorage.getItem("hrmsUser");
        if (raw) {
          const user = JSON.parse(raw);
          const id = user?._id || user?.id;

          if (id) {
            s.emit("register", id);
            console.log("📡 Registered admin on socket:", id);
          }
        }
      } catch (err) {
        console.error("Socket register parse fail:", err);
      }
    });

    setSocket(s);
    return () => s.disconnect();
  }, []);

  // -----------------------------
  // REAL-TIME EVENTS - LEAVES
  // -----------------------------
  useEffect(() => {
    if (!socket) return;
    
    const handleNewLeave = () => {
      setPendingLeaves((prev) => prev + 1);
    };
    
    const handleUpdatedLeave = (data) => {
      if (!isPending(data.status)) {
        setPendingLeaves((prev) => Math.max(prev - 1, 0));
      }
    };
    
    const handleCancelledLeave = () => {
      setPendingLeaves((prev) => Math.max(prev - 1, 0));
    };
    
    socket.on("leave:new", handleNewLeave);
    socket.on("leave:updated", handleUpdatedLeave);
    socket.on("leave:cancelled", handleCancelledLeave);
    
    return () => {
      socket.off("leave:new", handleNewLeave);
      socket.off("leave:updated", handleUpdatedLeave);
      socket.off("leave:cancelled", handleCancelledLeave);
    };
  }, [socket]);

  // -----------------------------
  // REAL-TIME EVENTS - OVERTIME
  // -----------------------------
  useEffect(() => {
    if (!socket) return;
    
    const handleNewOvertime = () => {
      setPendingOvertime((prev) => prev + 1);
    };
    
    const handleUpdatedOvertime = (data) => {
      if (!isPending(data.status)) {
        setPendingOvertime((prev) => Math.max(prev - 1, 0));
      }
    };
    
    const handleCancelledOvertime = () => {
      setPendingOvertime((prev) => Math.max(prev - 1, 0));
    };
    
    socket.on("overtime:new", handleNewOvertime);
    socket.on("overtime:updated", handleUpdatedOvertime);
    socket.on("overtime:cancelled", handleCancelledOvertime);
    
    return () => {
      socket.off("overtime:new", handleNewOvertime);
      socket.off("overtime:updated", handleUpdatedOvertime);
      socket.off("overtime:cancelled", handleCancelledOvertime);
    };
  }, [socket]);

  // -----------------------------
  // ✅ REAL-TIME EVENTS - NOTICES (STABLE COUNT)
  // -----------------------------
  useEffect(() => {
    if (!socket) return;
    
    // Listen for new notice replies from employees
    const handleNewReply = (data) => {
      console.log("📨 New employee reply received:", data);
      if (data.sentBy === 'Employee') {
        // Update the actual count
        actualUnreadCount.current = actualUnreadCount.current + 1;
        
        // Only update display if not on notices page
        if (!isOnNoticesPage.current && !tempHideNoticeBadge) {
          setUnreadNoticeCount(prev => prev + 1);
        }
        
        // Also fetch to ensure accuracy
        setTimeout(() => {
          fetchAndCalculateUnreadNotices(true);
        }, 500);
      }
    };
    
    // Listen for when messages are marked as read (IMMEDIATE DECREASE)
    const handleReplyRead = (data) => {
      console.log("📨 Messages marked as read:", data);
      
      // Update local read map
      if (data.noticeId && data.employeeId) {
        const storageKey = `${data.noticeId}_${data.employeeId}`;
        setLocalReadMap(prev => {
          const updated = { ...prev, [storageKey]: data.messageId };
          localStorage.setItem("adminReadRepliesV3", JSON.stringify(updated));
          return updated;
        });
        
        // Update actual count
        actualUnreadCount.current = Math.max(actualUnreadCount.current - 1, 0);
        
        // IMMEDIATE DECREASE: Reduce count by 1 immediately
        if (!tempHideNoticeBadge) {
          setUnreadNoticeCount(prev => {
            const newCount = Math.max(prev - 1, 0);
            console.log("📉 Immediate count decrease to:", newCount);
            return newCount;
          });
        }
      }
      
      // Recalculate after a short delay for accuracy
      setTimeout(() => {
        fetchAndCalculateUnreadNotices(true);
      }, 500);
    };
    
    // Listen for notice updates
    const handleNoticeUpdated = () => {
      console.log("📢 Notice updated, refreshing count");
      setTimeout(() => {
        fetchAndCalculateUnreadNotices(true);
      }, 500);
    };
    
    socket.on("notice:reply:new", handleNewReply);
    socket.on("notice:reply:read", handleReplyRead);
    socket.on("notice:updated", handleNoticeUpdated);
    
    return () => {
      socket.off("notice:reply:new", handleNewReply);
      socket.off("notice:reply:read", handleReplyRead);
      socket.off("notice:updated", handleNoticeUpdated);
    };
  }, [socket, fetchAndCalculateUnreadNotices, tempHideNoticeBadge]);

  // -----------------------------
  // ✅ LISTEN FOR CUSTOM EVENTS FROM AdminNotices.jsx (IMMEDIATE UPDATE)
  // -----------------------------
  useEffect(() => {
    const handleMessagesRead = (event) => {
      if (event.detail && event.detail.noticeId && event.detail.employeeId && event.detail.messageId) {
        console.log("📨 Custom event: Messages read for", event.detail.noticeId, event.detail.employeeId);
        
        // Update local storage
        const storageKey = `${event.detail.noticeId}_${event.detail.employeeId}`;
        setLocalReadMap(prev => {
          const updated = { ...prev, [storageKey]: event.detail.messageId };
          localStorage.setItem("adminReadRepliesV3", JSON.stringify(updated));
          return updated;
        });
        
        // Update actual count
        actualUnreadCount.current = Math.max(actualUnreadCount.current - 1, 0);
        
        // IMMEDIATE DECREASE: Reduce count by 1 immediately
        if (!tempHideNoticeBadge) {
          setUnreadNoticeCount(prev => {
            const newCount = Math.max(prev - 1, 0);
            console.log("📉 Immediate count decrease from custom event to:", newCount);
            return newCount;
          });
        }
        
        // Recalculate after a short delay for accuracy
        setTimeout(() => {
          fetchAndCalculateUnreadNotices(true);
        }, 300);
      }
    };

    window.addEventListener('notice:messages:read', handleMessagesRead);
    return () => window.removeEventListener('notice:messages:read', handleMessagesRead);
  }, [fetchAndCalculateUnreadNotices, tempHideNoticeBadge]);

  // -----------------------------
  // ✅ HANDLE VISITING NOTICES PAGE
  // -----------------------------
  useEffect(() => {
    if (location.pathname === "/admin/notices") {
      console.log("📋 Admin is on notices page");
      // Temporarily hide badge but keep actual count
      setTempHideNoticeBadge(true);
    } else if (tempHideNoticeBadge) {
      // When leaving notices page, restore badge after delay
      setTimeout(() => {
        setTempHideNoticeBadge(false);
        setUnreadNoticeCount(actualUnreadCount.current);
      }, 100);
    }
  }, [location.pathname, tempHideNoticeBadge]);

  // -----------------------------
  // ✅ POLLING FOR UPDATES (as backup)
  // -----------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAndCalculateUnreadNotices();
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, [fetchAndCalculateUnreadNotices]);

  // -----------------------------
  // ✅ Update localReadMap when it changes
  // -----------------------------
  useEffect(() => {
    fetchAndCalculateUnreadNotices();
  }, [localReadMap, fetchAndCalculateUnreadNotices]);

  // -----------------------------
  // ✅ Handle Hover/Click Logic for menus
  // -----------------------------
  const handleMenuHover = (label, isEntering) => {
    if (isEntering) {
      if (collapsed) setCollapsed(false);
      setActiveMenu(label);
    } else {
      setActiveMenu(null);
    }
  };

  // -----------------------------
  // ✅ Helper to render the badge
  // -----------------------------
  const renderBadge = (link) => {
    if (link.isLeave && pendingLeaves > 0) {
      return (
        <span className="bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ml-auto">
          {pendingLeaves}
        </span>
      );
    }
    if (link.isOvertime && pendingOvertime > 0) {
      return (
        <span className="bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ml-auto">
          {pendingOvertime}
        </span>
      );
    }
    // ✅ NOTICE BADGE: Show blinking red bubble with count
    // Only show if not temporarily hidden
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
  // RENDER SIDEBAR
  // -----------------------------
  return (
    <div
      className={`h-screen bg-slate-900 shadow-xl transition-[width] duration-300 ${
        collapsed ? "w-20" : "w-72"
      } p-4 flex flex-col overflow-y-auto overflow-x-hidden`}
    >
      {/* HEADER */}
      <div
        className={`flex items-center mb-6 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        <div
          className={`flex items-center gap-3 transition-all hover:bg-slate-800 ${
            collapsed ? "w-0 opacity-0 hidden" : "w-full opacity-100 flex"
          }`}
          onClick={() => setCollapsed((p) => !p)}
        >
          <span className="text-3xl text-indigo-400">
            <FaConnectdevelop />
          </span>
          <span className="text-xl font-bold text-slate-200">HRMS</span>
        </div>

        <button
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-800"
          onClick={() => setCollapsed((p) => !p)}
        >
          <FaBars />
        </button>
      </div>

      {/* NAV LINKS */}
      <ul className="space-y-2 flex-1">
        {navLinks.map((link, index) => {
          // CHECK IF IT IS A GROUP (Has children)
          if (link.children) {
            const isOpen = activeMenu === link.label;

            return (
              <li
                key={index}
                className="relative"
                onMouseEnter={() => handleMenuHover(link.label, true)}
                onMouseLeave={() => handleMenuHover(link.label, false)}
              >
                {/* PARENT ITEM */}
                <div
                  className={`flex items-center gap-4 px-4 py-2.5 rounded-lg text-base cursor-pointer border-l-4 border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200 ${
                    collapsed ? "justify-center px-2" : "justify-between"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xl w-5 flex justify-center">
                      {link.icon}
                    </span>
                    {!collapsed && <span>{link.label}</span>}
                  </div>
                  {!collapsed && (
                    <span className="text-xs">
                      {isOpen ? <FaAngleDown /> : <FaAngleRight />}
                    </span>
                  )}
                </div>

                {/* CHILDREN ITEMS (DROPDOWN) */}
                <ul
                  className={`bg-slate-800/50 rounded-lg overflow-hidden transition-all duration-300 ${
                    isOpen && !collapsed ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0"
                  }`}
                >
                  {link.children.map((child) => (
                    <li key={child.to}>
                      <NavLink
                        to={child.to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 pl-12 pr-4 py-2 text-sm transition-colors ${
                            isActive
                              ? "text-indigo-400 font-semibold"
                              : "text-slate-400 hover:text-slate-200"
                          }`
                        }
                      >
                        <span className="flex-1">{child.label}</span>
                        {renderBadge(child)}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>
            );
          }

          // STANDARD SINGLE LINK
          return (
            <li key={link.to}>
              <NavLink
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center gap-4 px-4 py-2.5 rounded-lg text-base border-l-4 ${
                    isActive
                      ? "bg-slate-800 text-indigo-400 border-indigo-500"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-transparent"
                  } ${collapsed ? "justify-center px-2" : ""}`
                }
              >
                <span className="text-xl w-5 flex justify-center">
                  {link.icon}
                </span>

                {!collapsed && (
                  <span className="flex items-center gap-2 relative w-full">
                    {link.label}
                    {renderBadge(link)}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>

      <div
        className={`mt-auto text-center text-xs text-slate-500 ${
          collapsed ? "opacity-0 hidden" : "opacity-100 block"
        }`}
      >
        &copy; {new Date().getFullYear()} HRMS Admin
      </div>
    </div>
  );
};

export default Sidebar;
// --- END OF FILE Sidebar.jsx ---