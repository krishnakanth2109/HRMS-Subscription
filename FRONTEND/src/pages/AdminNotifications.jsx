// pages/AdminNotifications.jsx
import { useContext, useEffect, useState } from "react";
import { NotificationContext } from "../context/NotificationContext";
import { FaBell, FaCheckCircle, FaTrash, FaUndo } from "react-icons/fa";

const STORAGE_KEY = "admin_hidden_notifications";

const AdminNotifications = () => {
  const { notifications, markAsRead, markAllAsRead } =
    useContext(NotificationContext);

  const [localNotifications, setLocalNotifications] = useState([]);

  // -------------------------------
  // Local Storage Helpers
  // -------------------------------
  const getHiddenIds = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  };

  const hideNotificationLocally = (_id) => {
    const hidden = getHiddenIds();
    const updated = [...hidden, _id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const clearHiddenList = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  // -------------------------------
  // Delete Single Notification (UI only)
  // -------------------------------
  const removeNotification = (_id) => {
    hideNotificationLocally(_id);
    setLocalNotifications((prev) => prev.filter((n) => n._id !== _id));
  };

  // -------------------------------
  // Clear All Notifications (UI only)
  // -------------------------------
  const clearAllLocal = () => {
    const allIds = localNotifications.map((n) => n._id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allIds));
    setLocalNotifications([]);
  };

  // -------------------------------
  // Restore All (Undo)
  // -------------------------------
  const restoreAll = () => {
    clearHiddenList();
    setLocalNotifications(notifications);
  };

  // -------------------------------
  // On notification updates
  // -------------------------------
  useEffect(() => {
    const hidden = getHiddenIds();
    const filtered = notifications.filter((n) => !hidden.includes(n._id));
    setLocalNotifications(filtered);
  }, [notifications]);

  return (
    <div className="p-6 min-h-screen bg-gradient-to-br from-blue-100 via-white to-blue-200">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <FaBell className="text-blue-600 text-2xl" />
            <h2 className="text-2xl font-bold text-blue-700">Notifications</h2>

            {localNotifications.filter((n) => !n.isRead).length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 animate-bounce">
                {localNotifications.filter((n) => !n.isRead).length} Unread
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              className="text-sm bg-gray-300 text-gray-700 px-3 py-2 rounded-lg font-semibold shadow hover:bg-gray-400 transition flex items-center gap-1"
              onClick={restoreAll}
            >
              <FaUndo /> Restore
            </button>

            <button
              className="text-sm bg-red-500 text-white px-3 py-2 rounded-lg font-semibold shadow hover:bg-red-600 transition flex items-center gap-1"
              onClick={clearAllLocal}
            >
              <FaTrash /> Clear All
            </button>

            <button
              className="text-sm bg-blue-600 text-white px-3 py-2 rounded-lg font-semibold shadow hover:bg-blue-700 transition flex items-center gap-1"
              onClick={markAllAsRead}
            >
              <FaCheckCircle /> Mark all as read
            </button>
          </div>
        </div>

        {localNotifications.length === 0 ? (
          <div className="text-center py-12 text-gray-400 flex flex-col items-center">
            <FaBell className="text-5xl mb-4 animate-pulse" />
            <p className="text-lg">No notifications to show!</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {localNotifications.map((n) => (
              <li
                key={n._id}
                className={`flex items-center gap-3 p-4 rounded-xl shadow transition-all border-l-4 ${
                  !n.isRead
                    ? "bg-yellow-50 border-yellow-400 hover:bg-yellow-100"
                    : "bg-white border-blue-100 hover:bg-blue-50"
                }`}
              >
                <FaBell
                  className={`text-lg ${
                    !n.isRead ? "text-yellow-600" : "text-blue-400"
                  }`}
                />

                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => markAsRead(n._id)}
                >
                  <div className="font-medium text-gray-800">{n.message}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(n.date || n.timestamp).toLocaleString()}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  className="text-red-500 hover:text-red-700 p-2"
                  onClick={() => removeNotification(n._id)}
                >
                  <FaTrash />
                </button>

                {!n.isRead && (
                  <span className="ml-2 bg-yellow-400 text-white text-xs font-bold rounded-full px-2 py-0.5 shadow">
                    New
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminNotifications;
