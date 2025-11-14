// src/context/NotificationProvider.jsx
import { useState, useEffect, useCallback } from "react";
import { NotificationContext } from "./NotificationContext";
import axios from "axios";
import { io } from "socket.io-client";

const API_BASE = "http://localhost:5000/notifications";
const SOCKET_URL = "http://localhost:5000"; // your backend with socket.io

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  // 🔔 Load audio
  const [sound] = useState(() => new Audio("/notification.mp3"));

  // ======================================================
  // 🔹 Fetch existing notifications from DB
  // ======================================================
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get(API_BASE);
      setNotifications(res.data);
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

      // Sound
      try {
        const audio = new Audio("/sounds/notification.mp3");
        audio.play().catch(() => { });
      } catch { }

      // Optional: toast popup
    });



    socket.on("connect", () => {
      console.log("📡 Socket Connected:", socket.id);
    });

    // 🔥 When newNotification event arrives from backend
    socket.on("newNotification", (data) => {
      console.log("🔥 New Notification received:", data);

      // Avoid adding duplicate notification
      setNotifications((prev) => {
        if (prev.some((n) => n._id === data._id)) return prev;
        return [data, ...prev];
      });

      // Play sound
      try {
        sound.currentTime = 0;
        sound.play().catch(() => { });
      } catch (e) { }

      // Show toast popup
      const toastId = Date.now();
      setToasts((prev) => [
        { id: toastId, message: data.message, time: new Date() },
        ...prev,
      ]);

      // Auto remove toast after 4 sec
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId));
      }, 4000);
    });

    return () => {
      socket.disconnect();
    };
  }, [sound]);

  // ======================================================
  // 🔹 Add notification manually
  // ======================================================
  const addNotification = async (message, type = "info") => {
    try {
      const res = await axios.post(API_BASE, { message, type });
      const saved = res.data;

      setNotifications((prev) => [saved, ...prev]);
      return saved;
    } catch (err) {
      console.error("Failed to save notification:", err.message);
    }
  };

  // ======================================================
  // 🔹 Mark single as read
  // ======================================================
  const markAsRead = async (id) => {
    try {
      await axios.patch(`${API_BASE}/${id}`, { isRead: true });

      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error("Failed to update notification:", err.message);
    }
  };

  // ======================================================
  // 🔹 Mark all notifications as read
  // ======================================================
  const markAllAsRead = async () => {
    try {
      await axios.patch(`${API_BASE}/mark-all`);

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
