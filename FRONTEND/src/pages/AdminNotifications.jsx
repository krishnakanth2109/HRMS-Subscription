// pages/AdminNotifications.jsx
import { useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { NotificationContext } from "../context/NotificationContext";
import {
  FaBell, FaCheckCircle, FaTrash, FaUndo,
  FaExclamationCircle, FaClock, FaMapMarkerAlt, FaSignOutAlt, FaUserClock,
  FaArrowLeft, FaStarHalfAlt, FaUserMinus, FaInbox, FaCheck, FaFilter
} from "react-icons/fa";
import api, { getAllOvertimeRequests } from "../api";

// Keys for Session Storage
const HIDDEN_KEY = "admin_hidden_notifications";
const READ_SYSTEM_KEY = "admin_read_system_notifications";

const AdminNotifications = () => {
  const navigate = useNavigate();
  const {
    notifications,
    markAsRead,
    markAllAsRead: markContextAllRead,
    clearAll: clearAllFromDB, // ✅ BUG 1 FIX — delete from DB
    socket,
  } = useContext(NotificationContext);

  const [localNotifications, setLocalNotifications] = useState([]);

  // Specific States for API Data
  const [overtimeData, setOvertimeData] = useState([]);
  const [punchOutData, setPunchOutData] = useState([]);
  const [lateLoginData, setLateLoginData] = useState([]);
  const [workModeData, setWorkModeData] = useState([]);
  const [fullDayData, setFullDayData] = useState([]);
  const [resignationData, setResignationData] = useState([]);

  const formatTime = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "N/A";
    }
  };

  const getNotificationStyles = (n) => {
    const isUnread = !n.isRead;
    let borderAccent = isUnread ? "border-l-4 border-indigo-500" : "border-l-4 border-slate-200";
    let iconBg = isUnread ? "bg-indigo-50 text-indigo-600 shadow-sm" : "bg-slate-100 text-slate-500";
    let cardBg = isUnread ? "bg-indigo-50/10" : "bg-white opacity-85";

    if (n.type === "system") {
      if (n._id.includes("sys-ot-")) {
        borderAccent = isUnread ? "border-l-4 border-amber-500" : "border-l-4 border-slate-200";
        iconBg = isUnread ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500";
      } else if (n._id.includes("sys-po-")) {
        borderAccent = isUnread ? "border-l-4 border-rose-500" : "border-l-4 border-slate-200";
        iconBg = isUnread ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500";
      } else if (n._id.includes("sys-late-")) {
        borderAccent = isUnread ? "border-l-4 border-purple-500" : "border-l-4 border-slate-200";
        iconBg = isUnread ? "bg-purple-50 text-purple-600" : "bg-slate-100 text-slate-500";
      } else if (n._id.includes("sys-wm-")) {
        borderAccent = isUnread ? "border-l-4 border-blue-500" : "border-l-4 border-slate-200";
        iconBg = isUnread ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500";
      } else if (n._id.includes("sys-fd-")) {
        borderAccent = isUnread ? "border-l-4 border-teal-500" : "border-l-4 border-slate-200";
        iconBg = isUnread ? "bg-teal-50 text-teal-600" : "bg-slate-100 text-slate-500";
      } else if (n._id.includes("sys-res-")) {
        borderAccent = isUnread ? "border-l-4 border-red-600" : "border-l-4 border-slate-200";
        iconBg = isUnread ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500";
      }
    }

    return { borderAccent, iconBg, cardBg };
  };



  // --- HELPERS FOR SYSTEM READ STATUS ---
  const getReadSystemIds = () => {
    try {
      return JSON.parse(sessionStorage.getItem(READ_SYSTEM_KEY)) || [];
    } catch {
      return [];
    }
  };

  const markSystemAsRead = (id) => {
    const current = getReadSystemIds();
    if (!current.includes(id)) {
      const updated = [...current, id];
      sessionStorage.setItem(READ_SYSTEM_KEY, JSON.stringify(updated));
      // Trigger UI update immediately
      updateLocalNotifications();
    }
  };

  const markAllSystemAsRead = () => {
    const allSystemIds = localNotifications
      .filter(n => n.type === 'system')
      .map(n => n._id);

    const current = getReadSystemIds();
    // Merge new IDs with existing ones, removing duplicates
    const updated = [...new Set([...current, ...allSystemIds])];
    sessionStorage.setItem(READ_SYSTEM_KEY, JSON.stringify(updated));
    updateLocalNotifications();
  };

  const handleMarkAsReadWrapper = (n) => {
    if (n.type === 'system') {
      markSystemAsRead(n._id);
    } else {
      markAsRead(n._id); // Call Context function for DB notifications
    }
  };

  const handleNotificationClick = (n) => {
    handleMarkAsReadWrapper(n);
    if (n.type === "system") {
      if (n._id.includes("sys-ot-")) navigate("/admin/admin-overtime");
      else if (n._id.includes("sys-po-")) navigate("/attendance");
      else if (n._id.includes("sys-late-")) navigate("/admin/late-requests");
      else if (n._id.includes("sys-wm-")) navigate("/attendance");
      else if (n._id.includes("sys-fd-")) navigate("/admin/admin-Leavemanage");
      else if (n._id.includes("sys-res-")) navigate("/admin/resignation");
    } else if (n.type === "leave") {
      navigate("/admin/admin-Leavemanage");
    } else if (n.type === "correction") {
      navigate("/admin/late-requests");
    }
    else if (n.redirectUrl) {
      navigate(n.redirectUrl);
    }
  };

  // ✅ BUG 2 FIX — guard: only run if there are unread notifications
  const handleMarkAllAsReadWrapper = () => {
    const hasUnread = localNotifications.some((n) => !n.isRead);
    if (!hasUnread) return; // Nothing to do
    markAllSystemAsRead(); // Mark local system alerts
    markContextAllRead();  // Mark database notifications (already guarded in context)
  };

  // --- FETCHING LOGIC ---

  const fetchOvertimeRequests = useCallback(async () => {
    try {
      const data = await getAllOvertimeRequests();
      const reqs = Array.isArray(data) ? data : (data.data || []);
      setOvertimeData(reqs.filter((o) => typeof o.status === "string" && o.status.toUpperCase() === "PENDING"));
    } catch (err) {
      console.error("Error fetching overtime:", err);
    }
  }, []);

  const fetchPunchOutRequests = useCallback(async () => {
    try {
      const response = await api.get('/api/punchoutreq/all');
      const reqs = Array.isArray(response.data) ? response.data : [];
      setPunchOutData(reqs.filter(r => r.status === 'Pending'));
    } catch (error) {
      console.error("Error fetching punch out requests:", error);
    }
  }, []);

  const fetchLateRequests = useCallback(async () => {
    try {
      // NOTE: fetching '/all' is heavy. If backend supports filtering, use that instead.
      const { data } = await api.get("/api/attendance/all");
      const allRecords = data.data || [];
      const pending = [];

      // Optimized Loop
      for (const empRecord of allRecords) {
        if (empRecord.attendance && Array.isArray(empRecord.attendance)) {
          for (const dayLog of empRecord.attendance) {
            if (dayLog.lateCorrectionRequest?.hasRequest && dayLog.lateCorrectionRequest?.status === "PENDING") {
              pending.push({
                ...dayLog,
                empName: empRecord.employeeName || empRecord.name || "Employee",
                reqId: dayLog._id || `late-${Math.random()}`
              });
            }
          }
        }
      }
      setLateLoginData(pending);
    } catch (err) {
      console.error("Error fetching late requests:", err);
    }
  }, []);

  const fetchWorkModeRequests = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/requests");
      const reqs = Array.isArray(data) ? data : [];
      setWorkModeData(reqs.filter(r => r.status === 'Pending'));
    } catch (err) {
      console.error("Error fetching work mode requests:", err);
    }
  }, []);

  const fetchFullDayRequests = useCallback(async () => {
    try {
      const { data } = await api.get("/api/attendance/admin/full-day-requests");
      setFullDayData(data.data || []);
    } catch (err) {
      console.error("Error fetching full day requests:", err);
    }
  }, []);

  const fetchResignationRequests = useCallback(async () => {
    try {
      const { data } = await api.get("/api/resignations/admin/all");
      setResignationData((data || []).filter(r => r.status === "Pending"));
    } catch (err) {
      console.error("Error fetching resignation requests:", err);
    }
  }, []);

  // Initial Data Load
  useEffect(() => {
    fetchOvertimeRequests();
    fetchPunchOutRequests();
    fetchLateRequests();
    fetchWorkModeRequests();
    fetchFullDayRequests();
    fetchResignationRequests();

    // Poll every 60 seconds (increased from 30s to reduce load for Late Requests)
    const interval = setInterval(() => {
      fetchOvertimeRequests();
      fetchPunchOutRequests();
      fetchLateRequests();
      fetchWorkModeRequests();
      fetchFullDayRequests();
      fetchResignationRequests();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchOvertimeRequests, fetchPunchOutRequests, fetchLateRequests, fetchWorkModeRequests, fetchFullDayRequests, fetchResignationRequests]);

  // ✅ Real-time refresh
  useEffect(() => {
    if (socket) {
      socket.on("fullDay:new", () => {
        console.log("⚡ New Full Day Request received via Socket. Refreshing list...");
        fetchFullDayRequests();
      });

      socket.on("resignation:new", () => {
        console.log("⚡ New Resignation Request received via Socket. Refreshing list...");
        fetchResignationRequests();
      });

      socket.on("workMode:updated", () => {
        console.log("⚡ Work Mode Request updated via Socket. Refreshing list...");
        fetchWorkModeRequests();
      });

      socket.on("resignation:new", () => {
        console.log("⚡ New Resignation received via Socket. Refreshing list...");
        fetchResignationRequests();
      });

      return () => {
        socket.off("fullDay:new");
        socket.off("workMode:updated");
        socket.off("resignation:new");
      };
    }
  }, [socket, fetchFullDayRequests, fetchWorkModeRequests, fetchResignationRequests]);


  // --- HIDDEN NOTIFICATIONS HELPERS ---
  const getHiddenIds = () => {
    try { return JSON.parse(sessionStorage.getItem(HIDDEN_KEY)) || []; } catch { return []; }
  };

  const removeNotification = (_id) => {
    const hidden = getHiddenIds();
    const updated = [...hidden, _id];
    sessionStorage.setItem(HIDDEN_KEY, JSON.stringify(updated));
    updateLocalNotifications(); // Trigger re-render
  };

  // ✅ BUG 1 FIX — Permanently deletes DB notifications + clears local system alerts
  const clearAllLocal = async () => {
    // 1. Clear local system-generated notifications from UI
    setLocalNotifications([]);
    // 2. Delete DB-backed notifications permanently (they will never reappear)
    await clearAllFromDB();
    // 3. Clean up sessionStorage state too
    sessionStorage.removeItem(HIDDEN_KEY);
    sessionStorage.removeItem(READ_SYSTEM_KEY);
  };

  const restoreAll = () => {
    sessionStorage.removeItem(HIDDEN_KEY);
    updateLocalNotifications();
  };


  // --- MERGE & GENERATE NOTIFICATIONS ---
  const updateLocalNotifications = useCallback(() => {
    const hiddenIds = getHiddenIds();
    const readSystemIds = getReadSystemIds();

    const systemNotifs = [];

    // 1. Process Overtime
    overtimeData.forEach(item => {
      const id = `sys-ot-${item._id}`;
      systemNotifs.push({
        _id: id,
        message: `⏳ Overtime Request: ${item.employeeName || item.employeeId} requested  on ${item.date || "N/A"}`,
        date: item.date || item.createdAt || new Date().toISOString(),
        isRead: readSystemIds.includes(id), // Check session storage
        type: "system",
        icon: <FaClock className="text-orange-500" />
      });
    });

    // 2. Process Punch Out
    punchOutData.forEach(item => {
      const id = `sys-po-${item._id}`;
      systemNotifs.push({
        _id: id,
        message: `🔔 Punch Out Request: ${item.employeeName || "Employee"} - Reason: "${item.reason || "N/A"}"`,
        date: item.createdAt || new Date().toISOString(),
        isRead: readSystemIds.includes(id),
        type: "system",
        icon: <FaSignOutAlt className="text-red-500" />
      });
    });

    // 3. Process Late Login
    lateLoginData.forEach(item => {
      const id = `sys-late-${item.reqId}`;
      const dateStr = item.date ? new Date(item.date).toLocaleDateString() : "Unknown Date";
      const reqTime = item.lateCorrectionRequest?.requestedTime
        ? new Date(item.lateCorrectionRequest.requestedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : "N/A";

      systemNotifs.push({
        _id: id,
        message: `⏰ Late Login Request: ${item.empName} for ${dateStr} (Req: ${reqTime})`,
        date: item.date || new Date().toISOString(),
        isRead: readSystemIds.includes(id),
        type: "system",
        icon: <FaUserClock className="text-purple-500" />
      });
    });

    // 4. Process Work Mode
    workModeData.forEach(item => {
      const id = `sys-wm-${item._id}${item.isEdited ? `-edit-${item.editCount}` : ''}`;
      systemNotifs.push({
        _id: id,
        message: `📍 Work Mode Request: ${item.employeeName} requested ${item.requestedMode === 'WFH' ? 'Work From Home' : 'Work From Office'} ${item.isEdited ? '⚠️ (Edited)' : ''}`,
        date: item.isEdited ? item.lastEditedAt : (item.createdAt || new Date().toISOString()),
        isRead: readSystemIds.includes(id),
        type: "system",
        icon: <FaMapMarkerAlt className="text-blue-500" />
      });
    });

    // 5. Process Full Day Requests
    fullDayData.forEach(item => {
      const id = `sys-fd-${item.employeeId}-${item.date}`;
      const dateStr = item.date ? new Date(item.date).toLocaleDateString() : "Unknown Date";
      systemNotifs.push({
        _id: id,
        message: `📋 Full Day Request: ${item.employeeName || "Employee"} requested Half Day → Full Day for ${dateStr}`,
        date: item.requestedAt || new Date().toISOString(),
        isRead: readSystemIds.includes(id),
        type: "system",
        icon: <FaStarHalfAlt className="text-teal-500" />
      });
    });

    // 6. Process Resignations
    resignationData.forEach(item => {
      const id = `sys-res-${item._id}`;
      systemNotifs.push({
        _id: id,
        message: `⚠️ Resignation Submitted: ${item.employeeName} (${item.employeeId}) has submitted a resignation letter.`,
        date: item.submittedAt || new Date().toISOString(),
        isRead: readSystemIds.includes(id),
        type: "system",
        icon: <FaUserMinus className="text-red-600" />
      });
    });

    // Combine System + Context Notifications
    const combined = [...systemNotifs, ...notifications];

    // Filter Hidden & Sort
    const final = combined
      .filter((n) => !hiddenIds.includes(n._id))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    setLocalNotifications(final);

  }, [notifications, overtimeData, punchOutData, lateLoginData, workModeData, fullDayData, resignationData]);

  // Update logic whenever data dependencies change
  useEffect(() => {
    updateLocalNotifications();
  }, [updateLocalNotifications]);


  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans antialiased text-slate-800">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ----------------- SIDE ACTION & FILTER PANEL ----------------- */}
        <div className="lg:col-span-3 space-y-6 lg:sticky lg:top-8">

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-6">
            <div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                <FaBell className="text-indigo-600 animate-pulse" size={16} /> Action Panel
              </h3>
              <p className="text-xs text-slate-500 font-medium">Manage and resolve your administration alerts</p>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3 pt-2">
              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold text-xs shadow-md hover:shadow-lg hover:from-indigo-600 hover:to-violet-700 transition-all active:scale-98 cursor-pointer"
                onClick={handleMarkAllAsReadWrapper}
              >
                <FaCheckCircle size={14} /> Mark All Read
              </button>

              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-50 hover:bg-rose-100/70 border border-rose-200 text-rose-600 font-bold text-xs transition-all active:scale-98 cursor-pointer"
                onClick={clearAllLocal}
              >
                <FaTrash size={14} /> Clear All
              </button>
            </div>
          </div>
        </div>

        {/* ----------------- MAIN NOTIFICATIONS PANEL ----------------- */}
        <div className="lg:col-span-9 bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 space-y-6">

          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div className="flex items-center gap-4">
              {/* ← Back button */}
              <button
                onClick={() => navigate(-1)}
                title="Go back"
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 transition-all border border-slate-200/50 cursor-pointer"
              >
                <FaArrowLeft size={14} />
              </button>
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                  System Notifications
                </h2>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Review shift changes, leave applications, work modes, and resignations
                </p>
              </div>
            </div>

            {localNotifications.filter((n) => !n.isRead).length > 0 && (
              <span className="bg-rose-500 text-white px-3 py-1 rounded-full text-xs font-black tracking-wide shadow-md shadow-rose-200 animate-pulse">
                {localNotifications.filter((n) => !n.isRead).length} Unread
              </span>
            )}
          </div>

          {/* ------------ NO NOTIFICATION STATE ------------ */}
          {localNotifications.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <FaInbox className="text-2xl text-slate-350" />
              </div>
              <p className="text-sm font-bold text-slate-500">Inbox Completely Clean</p>
              <p className="text-xs text-slate-400 mt-1">You do not have any alerts matching this filter</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {localNotifications.map((n) => {
                const styles = getNotificationStyles(n);
                const isUnread = !n.isRead;

                return (
                  <div
                    key={n._id}
                    onClick={() => handleNotificationClick(n)}
                    className={`group relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 ${styles.borderAccent} ${styles.cardBg} hover:shadow-md hover:border-slate-300 cursor-pointer`}
                  >
                    {/* Glowing Left Indicator */}
                    {isUnread && (
                      <div className="absolute top-1/2 -translate-y-1/2 left-0.5 w-1.5 h-10 rounded-r-full bg-indigo-500" />
                    )}

                    {/* Circular Glowing Icon */}
                    <div className={`p-3 rounded-xl text-md shrink-0 transition-transform group-hover:scale-105 duration-200 ${styles.iconBg}`}>
                      {n.icon ? n.icon : (n.type === "system" ? <FaExclamationCircle /> : <FaBell />)}
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 min-w-0 pr-6">
                      <p className={`text-sm font-semibold leading-relaxed ${isUnread ? "text-slate-800" : "text-slate-600 font-medium"}`}>
                        {n.message}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <FaClock size={10} className="text-slate-400" /> {formatTime(n.date || n.timestamp)}
                        </span>

                        {/* {n.type === 'system' ? (
                          <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
                            System Action Required
                          </span>
                        ) : (
                          <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
                            Database Msg
                          </span>
                        )} */}
                      </div>
                    </div>

                    {/* Action Panel Inside Card */}
                    <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {isUnread && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsReadWrapper(n);
                          }}
                          className="p-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 border border-slate-150 hover:border-emerald-200 rounded-lg transition-all"
                          title="Mark as Read"
                        >
                          <FaCheck size={12} />
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(n._id);
                        }}
                        className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-150 hover:border-rose-200 rounded-lg transition-all"
                        title="Delete Alert"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminNotifications;