// pages/AdminNotifications.jsx
import { useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { NotificationContext } from "../context/NotificationContext";
import { 
  FaBell, FaCheckCircle, FaTrash, FaUndo, 
  FaExclamationCircle, FaClock, FaMapMarkerAlt, FaSignOutAlt, FaUserClock,
  FaArrowLeft, FaStarHalfAlt, FaUserMinus
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
          ? new Date(item.lateCorrectionRequest.requestedTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
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
    <div className="min-h-screen bg-gray-100 p-2 md:p-4">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-3 md:gap-6 h-screen overflow-hidden">
        
        {/* ----------------- SIDE PANEL ----------------- */}
        <div className="lg:w-60 w-full bg-white shadow-md rounded-xl p-5 border">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <FaBell className="text-blue-600" />
            Actions
          </h3>

          <div className="flex  lg:flex-col  gap-3">
            <button
              className="flex items-center text-sm md:text-[16px] gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white  hover:bg-blue-700 transition"
              onClick={handleMarkAllAsReadWrapper}
            >
              <FaCheckCircle /> Mark All Read
            </button>

            <button
              className="flex items-center gap-2 px-3 py-2 text-sm md:text-[16px] rounded-lg bg-red-500 text-white hover:bg-red-600 transition"
              onClick={clearAllLocal}
            >
              <FaTrash /> Clear All
            </button>

   
          </div>
        </div>

        {/* ----------------- MAIN CONTENT ----------------- */}
        <div className="flex-1 bg-white rounded-xl shadow-md md:p-6 p-3 border overflow-y-auto">
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-3">
              {/* ← Back button */}
              <button
                onClick={() => navigate(-1)}
                title="Go back"
                className="flex items-center justify-center md:w-9 md:h-9 h-6 w-7 rounded-full bg-gray-100 hover:bg-blue-100 hover:text-blue-600 text-gray-500 transition-all shadow-sm"
              >
                <FaArrowLeft className="text-sm" />
              </button>
              <div>
                <h2 className="md:text-2xl text-lg font-semibold text-gray-700">
                  Notifications
                </h2>
                <p className="text-gray-500 text-sm">
                  Manage all your system alerts here
                </p>
              </div>
            </div>

            {localNotifications.filter((n) => !n.isRead).length > 0 && (
              <span className="bg-red-500 text-white md:px-3 md:py-1 px-1  rounded-full md:text-sm text-[12px] font-semibold">
                {localNotifications.filter((n) => !n.isRead).length} New
              </span>
            )}
          </div>

          {/* ------------ NO NOTIFICATION STATE ------------ */}
          {localNotifications.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <FaBell className="text-5xl mx-auto mb-4 text-gray-300" />
              <p className="text-lg">You're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {localNotifications.map((n) => (
                <div
                  key={n._id}
                  className={`flex items-start gap-2 md:gap-4 md:p-4 p-2 rounded-xl border shadow-sm transition cursor-pointer ${
                    !n.isRead
                      ? "bg-blue-50 border-blue-300" // Highlighted Style (New)
                      : "bg-white border-gray-200 opacity-75" // Read Style
                  }`}
                  onClick={() => handleMarkAsReadWrapper(n)}
                >
                  <div
                    className={`md:p-3 p-1 rounded-full text-lg ${
                       n.type === "system" 
                       ? "bg-orange-100" 
                       : !n.isRead ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {/* Icon Logic */}
                    {n.icon ? n.icon : (n.type === "system" ? <FaExclamationCircle className="text-orange-600"/> : <FaBell />)}
                  </div>

                  <div className="flex-1">
                    <p className={`font-medium md:text-[16px] text-[14px] ${n.type === "system" ? "text-gray-800" : "text-gray-800"}`}>
                      {n.message}
                    </p>
                    <p className="text-xs mt-1 text-gray-500">
                      {new Date(n.date || n.timestamp).toLocaleString()}
                    </p>
                  </div>

                  <button
                    className="text-red-500 hover:text-red-700 p-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotification(n._id);
                    }}
                    title="Remove notification"
                  >
                    <FaTrash />
                  </button>

                  {!n.isRead && (
                    <span className="ml-1 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                      New
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminNotifications;