// src/pages/EmployeeNotifications.jsx
import { useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CurrentEmployeeNotificationContext } from "../EmployeeContext/CurrentEmployeeNotificationContext";
import {
  FaBell, FaCheckCircle, FaTrash,
  FaExclamationCircle, FaArrowLeft, FaEnvelope, FaEnvelopeOpen,
} from "react-icons/fa";

// sessionStorage key for system-level read state (notice-type items)
const READ_SYSTEM_KEY = "employee_read_system_notifications";

const EmployeeNotifications = () => {
  const navigate = useNavigate();
  const {
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    clearAll: clearAllFromDB, // ✅ BUG 1 — permanently deletes from DB
  } = useContext(CurrentEmployeeNotificationContext);

  const [localNotifications, setLocalNotifications] = useState([]);

  // ─── Session-storage helpers for local read state ─────────────────────────
  const getReadSystemIds = () => {
    try { return JSON.parse(sessionStorage.getItem(READ_SYSTEM_KEY)) || []; }
    catch { return []; }
  };

  const markSystemAsRead = (id) => {
    const current = getReadSystemIds();
    if (!current.includes(id)) {
      sessionStorage.setItem(READ_SYSTEM_KEY, JSON.stringify([...current, id]));
      buildLocalList();
    }
  };

  const markAllSystemAsRead = () => {
    const allIds = localNotifications.map((n) => n._id);
    const current = getReadSystemIds();
    sessionStorage.setItem(
      READ_SYSTEM_KEY,
      JSON.stringify([...new Set([...current, ...allIds])])
    );
    buildLocalList();
  };

  // ─── Build visible list from DB notifications ─────────────────────────────
  const buildLocalList = useCallback(() => {
    const readSystemIds = getReadSystemIds();

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

    // Sort newest first
    withReadState.sort(
      (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)
    );

    setLocalNotifications(withReadState);
  }, [notifications]);

  useEffect(() => {
    buildLocalList();
  }, [buildLocalList]);

  // ─── Mark single notification as read ────────────────────────────────────
  const handleMarkAsRead = (n) => {
    markSystemAsRead(String(n._id)); // local session state
    markAsRead(n._id);              // DB update
  };

  // ─── Mark all as read ─────────────────────────────────────────────────────
  // ✅ BUG 2 FIX — guard check
  const handleMarkAllAsRead = () => {
    const hasUnread = localNotifications.some((n) => !n.isRead);
    if (!hasUnread) return;
    markAllSystemAsRead();
    markAllAsRead(); // DB update (already guarded in provider)
  };

  // ─── Clear all from DB ────────────────────────────────────────────────────
  // ✅ BUG 1 FIX — permanently removes from DB
  const handleClearAll = async () => {
    setLocalNotifications([]);
    await clearAllFromDB();
    sessionStorage.removeItem(READ_SYSTEM_KEY);
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const unreadCount = localNotifications.filter((n) => !n.isRead).length;

  const getIconForType = (type) => {
    switch (type) {
      case "leave":
      case "leave-status":  return <FaBell className="text-blue-500" />;
      case "overtime":
      case "overtime-status": return <FaBell className="text-orange-500" />;
      case "attendance":    return <FaBell className="text-purple-500" />;
      default:              return <FaBell className="text-gray-500" />;
    }
  };

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <FaBell className="text-4xl animate-pulse mx-auto mb-2 text-blue-400" />
          <p className="text-sm">Loading notifications...</p>
        </div>
      </div>
    );
  }

  // ─── Main UI ──────────────────────────────────────────────────────────────
  return (
   
       <div className="min-h-screen bg-gray-100 p-2 md:p-4">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-3 md:gap-6 h-screen overflow-hidden">

        {/* ──────────── SIDE PANEL ──────────── */}
        <div className="lg:w-60 w-full bg-white shadow-md rounded-xl p-5 border flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-gray-700 mb-1 flex items-center gap-2">
            <FaBell className="text-blue-600" />
            Actions
          </h3>

         <div className="flex flex-row lg:flex-col gap-3">
           {/* Mark All Read */}
          <button
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-medium transition ${
              unreadCount > 0
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-blue-300 cursor-not-allowed opacity-60"
            }`}
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            title={unreadCount === 0 ? "No unread notifications" : "Mark all as read"}
          >
            <FaCheckCircle /> Mark All Read
            {unreadCount > 0 && (
              <span className="ml-auto bg-white text-blue-600 text-xs px-1.5 py-0.5 rounded-full font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Clear All */}
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 text-sm font-medium transition"
            onClick={handleClearAll}
          >
            <FaTrash /> Clear All
          </button>
         </div>

          {/* Stats */}
          {localNotifications.length > 0 && (
            <div className=" flex flex-row lg:flex-col gap-3 lg:gap-1 mt-auto pt-4 border-t text-xs text-gray-400 space-y-1">
              <p>Total: <span className="font-semibold text-gray-600">{localNotifications.length}</span></p>
              <p>Unread: <span className="font-semibold text-blue-600">{unreadCount}</span></p>
              <p>Read: <span className="font-semibold text-green-600">{localNotifications.length - unreadCount}</span></p>
            </div>
          )}
        </div>

        {/* ──────────── MAIN CONTENT ──────────── */}
        <div className="flex-1 bg-white rounded-xl shadow-md lg:p-6 md:p-4 p-2 border overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-3">
              {/* ← Back button */}
              <button
                onClick={() => navigate(-1)}
                title="Go back"
                className="flex items-center justify-center md:w-9 md:h-9 h-7 w-7 rounded-full bg-gray-100 hover:bg-blue-100 hover:text-blue-600 text-gray-500 transition-all shadow-sm"
              >
                <FaArrowLeft className="text-sm" />
              </button>
              <div>
                <h2 className="md:text-2xl text-lg font-semibold text-gray-700">
                  Your Notifications
                </h2>
                <p className="text-gray-500 text-sm">
                  All alerts for your account
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                {unreadCount} New
              </span>
            )}
          </div>

          {/* Empty State */}
          {localNotifications.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <FaBell className="text-6xl mx-auto mb-4 text-gray-200" />
              <p className="text-lg font-medium">You're all caught up!</p>
              <p className="text-sm mt-1">No notifications at the moment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {localNotifications.map((n) => (
                <div
                  key={n._id}
                  className={`flex items-start md:gap-4 gap-3 lg:p-4 p-2 rounded-xl border shadow-sm transition cursor-pointer group ${
                    !n.isRead
                      ? "bg-blue-50 border-blue-200 hover:bg-blue-100"
                      : "bg-white border-gray-200 opacity-80 hover:opacity-100 hover:bg-gray-50"
                  }`}
                  onClick={() => handleMarkAsRead(n)}
                >
                  {/* Icon */}
                  <div
                    className={`p-3 rounded-full text-lg flex-shrink-0 ${
                      !n.isRead
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {getIconForType(n.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {n.title && (
                      <p className="text-xs font-semibold text-blue-600 mb-0.5 uppercase tracking-wide">
                        {n.title}
                      </p>
                    )}
                    <p className={`md:text-sm text-[13px] font-medium ${!n.isRead ? "text-gray-800" : "text-gray-600"}`}>
                      {n.message}
                    </p>
                    <p className="text-xs mt-1 text-gray-400">
                      {new Date(n.date || n.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {/* Unread badge */}
                  {!n.isRead ? (
                    <span className="flex-shrink-0 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full self-start mt-1">
                      New
                    </span>
                  ) : (
                    <FaEnvelopeOpen className="flex-shrink-0 text-gray-300 text-lg self-start mt-1" />
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

export default EmployeeNotifications;
