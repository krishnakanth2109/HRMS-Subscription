// src/pages/EmployeeNotifications.jsx

import { useContext, useEffect, useState } from "react";
import { CurrentEmployeeNotificationContext } from "../EmployeeContext/CurrentEmployeeNotificationContext";
import { FaBell, FaCheckCircle, FaTrash, FaUndo } from "react-icons/fa";

const STORAGE_KEY = "employee_hidden_notifications_session";

const EmployeeNotifications = () => {
  const { notifications, loading, markAsRead, markAllAsRead } =
    useContext(CurrentEmployeeNotificationContext);

  const [localNotifications, setLocalNotifications] = useState([]);

  // -------------------- Session Storage Helpers --------------------
  const getHiddenIds = () => {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  };

  const clearHiddenList = () => {
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const clearAllLocal = () => {
    const allIds = notifications.map((n) => n._id);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(allIds));
    setLocalNotifications([]); // Hide all in UI
  };

  const restoreAll = () => {
    clearHiddenList();
    setLocalNotifications(notifications);
  };

  // -------------------- Build Local Visible List --------------------
  useEffect(() => {
    const hidden = getHiddenIds();
    const filtered = notifications.filter(
      (n) => !hidden.includes(String(n._id))
    );
    setLocalNotifications(filtered);
  }, [notifications]);

  // -------------------- Loading UI --------------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <FaBell className="text-4xl animate-pulse mx-auto mb-2" />
          Loading notifications...
        </div>
      </div>
    );
  }

  // -------------------- Main UI --------------------
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto flex gap-6 h-screen overflow-hidden">

        {/* ----------------- SIDE PANEL ----------------- */}
        <div className="w-60 bg-white shadow-md rounded-xl p-5 border">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <FaBell className="text-blue-600" />
            Actions
          </h3>

          <div className="flex flex-col gap-3">

            {/* MARK ALL READ */}
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              onClick={() => {
                markAllAsRead(); // ✔ UPDATES CONTEXT + NAVBAR
              }}
            >
              <FaCheckCircle /> Mark All Read
            </button>

            {/* HIDE ALL */}
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition"
              onClick={clearAllLocal}
            >
              <FaTrash /> Hide All
            </button>

            {/* RESTORE */}
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-300 text-gray-700 hover:bg-gray-400 transition"
              onClick={restoreAll}
            >
              <FaUndo /> Restore Hidden
            </button>

          </div>
        </div>

        {/* ----------------- MAIN CONTENT ----------------- */}
        <div className="flex-1 bg-white rounded-xl shadow-md p-6 border overflow-y-auto">

          <div className="flex justify-between items-center mb-5">
            <div>
              <h2 className="text-2xl font-semibold text-gray-700">
                Your Notifications
              </h2>
              <p className="text-gray-500 text-sm">
                All alerts for your account
              </p>
            </div>

            {localNotifications.filter((n) => !n.isRead).length > 0 && (
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                {localNotifications.filter((n) => !n.isRead).length} New
              </span>
            )}
          </div>

          {/* ------------ Empty State ------------ */}
          {localNotifications.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <FaBell className="text-5xl mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No notifications to show!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {localNotifications.map((n) => (
                <div
                  key={n._id}
                  className={`flex items-start gap-4 p-4 rounded-xl border shadow-sm transition cursor-pointer ${
                    !n.isRead
                      ? "bg-blue-50 border-blue-300"
                      : "bg-white border-gray-200"
                  }`}
                  onClick={() => {
                    markAsRead(n._id); // ✔ CONTEXT UPDATE = NAVBAR UPDATE
                  }}
                >
                  <div
                    className={`p-3 rounded-full ${
                      !n.isRead
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    <FaBell />
                  </div>

                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{n.message}</p>
                    <p className="text-xs mt-1 text-gray-500">
                      {new Date(n.date || n.createdAt).toLocaleString()}
                    </p>
                  </div>

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

export default EmployeeNotifications;
