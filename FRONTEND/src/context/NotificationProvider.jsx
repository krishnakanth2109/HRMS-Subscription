// src/context/NotificationProvider.jsx
import { useState, useEffect, useCallback } from "react";
import { NotificationContext } from "./NotificationContext";
import {
  getNotifications,
  addNotificationRequest,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../api"; // Assuming api.js is in a parent directory
import { io } from "socket.io-client";

// Dynamically set Socket.io URL from environment variables
const SOCKET_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT;

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  // 🔔 Load audio
  const [sound] = useState(() => new Audio("/notification.mp3"));

  // ======================================================
  // 🔹 Fetch existing notifications from DB using api.js
  // ======================================================
  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error("Failed to fetch notifications:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ======================================================
  // 🔥 SOCKET.IO REAL-TIME LISTENER
  // ======================================================
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("📡 Socket Connected:", socket.id);
    });

    socket.on("newNotice", (data) => {
      const newNotification = {
        _id: Date.now(), // temporary local ID
        title: "New Notice Posted",
        message: data.title,
        type: "notice",
        isRead: false,
        date: new Date(),
      };

      setNotifications((prev) => [newNotification, ...prev]);

      try {
        const audio = new Audio("/sounds/notification.mp3");
        audio.play().catch(() => {});
      } catch {}
    });

    socket.on("newNotification", (data) => {
      console.log("🔥 New Notification received:", data);

      setNotifications((prev) => {
        if (prev.some((n) => n._id === data._id)) return prev;
        return [data, ...prev];
      });

      try {
        sound.currentTime = 0;
        sound.play().catch(() => {});
      } catch (e) {}

      const toastId = Date.now();
      setToasts((prev) => [
        { id: toastId, message: data.message, time: new Date() },
        ...prev,
      ]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId));
      }, 4000);
    });

    return () => {
      socket.disconnect();
    };
  }, [sound]);

  // ======================================================
  // 🔹 Add notification manually using api.js
  // ======================================================
  const addNotification = async (message, type = "info") => {
    try {
      // Use the renamed function from api.js to avoid naming conflicts
      const saved = await addNotificationRequest({ message, type });
      setNotifications((prev) => [saved, ...prev]);
      return saved;
    } catch (err) {
      console.error("Failed to save notification:", err.message);
    }
  };

  // ======================================================
  // 🔹 Mark single as read using api.js
  // ======================================================
  const markAsRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error("Failed to update notification:", err.message);
    }
  };

  // ======================================================
  // 🔹 Mark all notifications as read using api.js
  // ======================================================
  const markAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Failed to mark all as read:", err.message);
    }
  };

  // Count unread
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

      {/* 🔥 Toast Popup UI */}
      <div
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 9999,
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              background: "#ffffff",
              padding: "12px 16px",
              marginBottom: "10px",
              borderRadius: "8px",
              boxShadow: "0px 4px 12px rgba(0,0,0,0.15)",
              minWidth: "250px",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            {toast.message}
            <div style={{ fontSize: "11px", opacity: 0.6, marginTop: "4px" }}>
              {toast.time.toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};