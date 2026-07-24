// src/pages/EmployeeNotifications.jsx
import { useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CurrentEmployeeNotificationContext } from "../EmployeeContext/CurrentEmployeeNotificationContext";
import {
  FaBell, FaCheckCircle, FaTrash,
  FaExclamationCircle, FaArrowLeft, FaClock, FaInbox, FaCheck,
  FaUserClock, FaUserMinus, FaSignOutAlt, FaStarHalfAlt, FaMapMarkerAlt
} from "react-icons/fa";  

// sessionStorage keys for employee read & hidden states
const HIDDEN_KEY = "employee_hidden_notifications";
const READ_SYSTEM_KEY = "employee_read_system_notifications";

const EmployeeNotifications = () => {
  const navigate = useNavigate();
  const {
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    clearAll: clearAllFromDB, // permanently deletes from DB
  } = useContext(CurrentEmployeeNotificationContext);

  const [localNotifications, setLocalNotifications] = useState([]);

  // --- Session-storage helpers for hidden notifications ---
  const getHiddenIds = () => {
    try {
      return JSON.parse(sessionStorage.getItem(HIDDEN_KEY)) || [];
    } catch {
      return [];
    }
  };

  const removeNotification = (_id) => {
    const hidden = getHiddenIds();
    const updated = [...hidden, String(_id)];
    sessionStorage.setItem(HIDDEN_KEY, JSON.stringify(updated));
    buildLocalList(); // Trigger re-render
  };

  // --- Session-storage helpers for local read state ---
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
      sessionStorage.setItem(READ_SYSTEM_KEY, JSON.stringify([...current, id]));
      buildLocalList();
    }
  };

  const markAllSystemAsRead = () => {
    const allIds = localNotifications.map((n) => String(n._id));
    const current = getReadSystemIds();
    sessionStorage.setItem(
      READ_SYSTEM_KEY,
      JSON.stringify([...new Set([...current, ...allIds])])
    );
    buildLocalList();
  };

  // --- Build visible list from DB notifications ---
  const buildLocalList = useCallback(() => {
    const readSystemIds = getReadSystemIds();
    const hiddenIds = getHiddenIds();

    // Filter out notice-type messages (shown in Notices page instead)
    const filtered = notifications.filter((n) => {
      const msg = n.message?.toLowerCase() || "";
      return (
        n.type !== "notice" &&
        n.category !== "notice" &&
        !msg.includes("notice")
      );
    });

    // Apply local read state for any items not tracked in DB
    const withReadState = filtered.map((n) => ({
      ...n,
      isRead: n.isRead || readSystemIds.includes(String(n._id)),
    }));

    // Filter Hidden & Sort newest first
    const final = withReadState
      .filter((n) => !hiddenIds.includes(String(n._id)))
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    setLocalNotifications(final);
  }, [notifications]);

  useEffect(() => {
    buildLocalList();
  }, [buildLocalList]);

  // --- Mark single notification as read ---
  const handleMarkAsRead = (n) => {
    markSystemAsRead(String(n._id)); // local session state
    markAsRead(n._id);              // DB update
  };

  // --- Mark all as read ---
  const handleMarkAllAsRead = () => {
    const hasUnread = localNotifications.some((n) => !n.isRead);
    if (!hasUnread) return;
    markAllSystemAsRead();
    markAllAsRead(); // DB update
  };

  // --- Clear all notifications ---
  const handleClearAll = async () => {
    setLocalNotifications([]);
    await clearAllFromDB();
    sessionStorage.removeItem(HIDDEN_KEY);
    sessionStorage.removeItem(READ_SYSTEM_KEY);
  };

  // --- Helpers ---
  const unreadCount = localNotifications.filter((n) => !n.isRead).length;

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

    const type = (n.type || "").toLowerCase();
    const category = (n.category || "").toLowerCase();

    if (type.includes("leave") || category.includes("leave")) {
      borderAccent = isUnread ? "border-l-4 border-blue-500" : "border-l-4 border-slate-200";
      iconBg = isUnread ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500";
    } else if (type.includes("overtime") || category.includes("overtime")) {
      borderAccent = isUnread ? "border-l-4 border-amber-500" : "border-l-4 border-slate-200";
      iconBg = isUnread ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500";
    } else if (type.includes("attendance") || category.includes("attendance")) {
      borderAccent = isUnread ? "border-l-4 border-purple-500" : "border-l-4 border-slate-200";
      iconBg = isUnread ? "bg-purple-50 text-purple-600" : "bg-slate-100 text-slate-500";
    }

    return { borderAccent, iconBg, cardBg };
  };

  const getIconForType = (type, category) => {
    const t = (type || "").toLowerCase();
    const c = (category || "").toLowerCase();
    if (t.includes("leave") || c.includes("leave")) {
      return <FaBell className="text-blue-500" />;
    }
    if (t.includes("overtime") || c.includes("overtime")) {
      return <FaClock className="text-orange-500" />;
    }
    if (t.includes("attendance") || c.includes("attendance")) {
      return <FaUserClock className="text-purple-500" />;
    }
    return <FaBell className="text-gray-500" />;
  };

  // --- Loading state ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center text-slate-500">
          <FaBell className="text-4xl animate-pulse mx-auto mb-2 text-indigo-500" />
          <p className="text-sm font-semibold">Loading notifications...</p>
        </div>
      </div>
    );
  }

  // --- Main UI ---
  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans antialiased text-slate-800">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ----------------- SIDE ACTION PANEL ----------------- */}
        <div className="lg:col-span-3 space-y-6 lg:sticky lg:top-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-6">
            <div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                <FaBell className="text-indigo-600 animate-pulse" size={16} /> Action Panel
              </h3>
              <p className="text-xs text-slate-500 font-medium">Manage and resolve your notification alerts</p>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3 pt-2">
              <button
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs shadow-md transition-all active:scale-98 cursor-pointer ${
                  unreadCount > 0
                    ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:shadow-lg hover:from-indigo-600 hover:to-violet-700"
                    : "bg-slate-100 text-slate-400 border border-slate-205 cursor-not-allowed shadow-none"
                }`}
                onClick={handleMarkAllAsRead}
                disabled={unreadCount === 0}
              >
                <FaCheckCircle size={14} /> Mark All Read
              </button>

              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-50 hover:bg-rose-100/70 border border-rose-200 text-rose-600 font-bold text-xs transition-all active:scale-98 cursor-pointer"
                onClick={handleClearAll}
              >
                <FaTrash size={14} /> Clear All
              </button>
            </div>
            
            {/* Stats */}
            {localNotifications.length > 0 && (
              <div className="flex flex-row lg:flex-col gap-3 lg:gap-1.5 pt-4 border-t border-slate-150 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <p>Total: <span className="font-extrabold text-slate-700">{localNotifications.length}</span></p>
                <p>Unread: <span className="font-extrabold text-indigo-600">{unreadCount}</span></p>
                <p>Read: <span className="font-extrabold text-emerald-600">{localNotifications.length - unreadCount}</span></p>
              </div>
            )}
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
                  Your Notifications
                </h2>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Review updates on leave, overtime, attendance, and general alerts
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <span className="bg-rose-500 text-white px-3 py-1 rounded-full text-xs font-black tracking-wide shadow-md shadow-rose-200 animate-pulse">
                {unreadCount} New
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
              <p className="text-xs text-slate-400 mt-1">You do not have any notifications at the moment</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {localNotifications.map((n) => {
                const styles = getNotificationStyles(n);
                const isUnread = !n.isRead;
                
                return (
                  <div
                    key={n._id}
                    onClick={() => handleMarkAsRead(n)}
                    className={`group relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 ${styles.borderAccent} ${styles.cardBg} hover:shadow-md hover:border-slate-300 cursor-pointer`}
                  >
                    {/* Glowing Left Indicator */}
                    {isUnread && (
                      <div className="absolute top-1/2 -translate-y-1/2 left-0.5 w-1.5 h-10 rounded-r-full bg-indigo-500" />
                    )}

                    {/* Circular Glowing Icon */}
                    <div className={`p-3 rounded-xl text-md shrink-0 transition-transform group-hover:scale-105 duration-200 ${styles.iconBg}`}>
                      {getIconForType(n.type, n.category)}
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 min-w-0 pr-6">
                      {n.title && (
                        <p className="text-xs font-bold text-indigo-600 mb-0.5 uppercase tracking-wide">
                          {n.title}
                        </p>
                      )}
                      <p className={`text-sm font-semibold leading-relaxed ${isUnread ? "text-slate-800" : "text-slate-600 font-medium"}`}>
                        {n.message}
                      </p>
                      
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <FaClock size={10} className="text-slate-400" /> {formatTime(n.date || n.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Action Panel Inside Card */}
                    <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {isUnread && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(n);
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

export default EmployeeNotifications;
