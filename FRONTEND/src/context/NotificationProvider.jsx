// src/context/NotificationProvider.jsx
import { useState, useEffect, useCallback } from "react";
import { NotificationContext } from "./NotificationContext";
import axios from "axios";

const API_BASE = "http://localhost:5000/notifications"; // change as per your backend

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Fetch notifications from backend (optional)
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get(API_BASE);
      setNotifications(res.data || []);
    } catch (err) {
      console.error("Failed to fetch notifications:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ✅ Add a new notification (and optionally save to backend)
  const addNotification = async (message, type = "info") => {
    const newNotification = {
      id: Date.now(),
      message,
      type, // info | success | warning | error
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    // Update UI immediately
    setNotifications((prev) => [newNotification, ...prev]);

    // Send to backend
    try {
      await axios.post(API_BASE, newNotification);
    } catch (err) {
      console.error("Failed to save notification:", err.message);
    }
  };

  // ✅ Mark single notification as read
  const markAsRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );

    try {
      await axios.patch(`${API_BASE}/${id}`, { isRead: true });
    } catch (err) {
      console.error("Failed to update notification:", err.message);
    }
  };

  // ✅ Mark all as read
  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      await axios.patch(`${API_BASE}/mark-all`);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err.message);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        markAsRead,
        markAllAsRead,
        unreadCount,
        loading,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
