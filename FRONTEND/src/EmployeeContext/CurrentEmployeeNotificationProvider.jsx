import React, { useState, useEffect, useCallback } from "react";
import { CurrentEmployeeNotificationContext } from "./CurrentEmployeeNotificationContext";
import {
  getNotifications,
  getNotices,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../api"; // Import centralized API functions
import { io } from "socket.io-client";

// Dynamically determine Socket.io URL from environment variables for consistency
const SOCKET_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT;

// Load logged-in employee from storage
const loadLoggedUser = () => {
  try {
    const raw =
      localStorage.getItem("hrmsUser") || sessionStorage.getItem("hrmsUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const CurrentEmployeeNotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sound] = useState(() => new Audio("/notification.mp3"));
  const [loggedUser] = useState(loadLoggedUser);

  // Always use MongoDB _id as unique identifier
  const getUserIdentifier = useCallback(() => {
    if (!loggedUser) return null;
    return loggedUser._id; // 🔥 ONLY MongoDB ID
  }, [loggedUser]);

  // --------------------------------------------------------
  // FETCH ALL NOTIFICATIONS (personal + notices) using api.js
  // --------------------------------------------------------
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const userId = getUserIdentifier();

      // 1️⃣ Fetch personal notifications using centralized API
      const allPersonal = await getNotifications();

      const personal = userId
        ? allPersonal.filter((n) => String(n.userId) === String(userId))
        : [];

      // 2️⃣ Fetch notices from admin using centralized API
      const noticesData = await getNotices();
      const noticeItems = noticesData.map((n) => ({
        _id: n._id, // use DB id
        userId: "ALL",
        title: "New Notice",
        message: n.title,
        type: "notice",
        isRead: false,
        date: n.date,
      }));

      // 3️⃣ Combine and sort
      const combined = [...personal, ...noticeItems];
      combined.sort(
        (a, b) =>
          new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)
      );

      setNotifications(combined);
    } catch (err) {
      console.error("❌ Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [getUserIdentifier]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // --------------------------------------------------------
  // SOCKET.IO REALTIME LISTENERS
  // --------------------------------------------------------
  useEffect(() => {
    const userId = getUserIdentifier();
    if (!userId) return;

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    console.log("📡 Employee Socket Connected:", socket.id);

    // 1️⃣ NEW PERSONAL NOTIFICATION
    socket.on("newNotification", (n) => {
      if (!n || !n.userId) return;
      if (String(n.userId) !== String(userId)) return;

      setNotifications((prev) => [n, ...prev]);
      playSound();
      showToast(n.title ? `${n.title}: ${n.message}` : n.message);
    });

    // 2️⃣ NEW ADMIN NOTICE -> ALL EMPLOYEES GET IT
    socket.on("newNotice", (notice) => {
      if (!notice) return;
      const n = {
        _id: Date.now(),
        userId: "ALL",
        title: "New Notice",
        message: notice.title,
        type: "notice",
        isRead: false,
        date: new Date(),
      };
      setNotifications((prev) => [n, ...prev]);
      playSound();
      showToast(`New Notice: ${notice.title}`);
    });

    return () => socket.disconnect();
  }, [getUserIdentifier, sound]); // Added sound to dependency array

  // --------------------------------------------------------
  // SOUND & TOAST HELPERS
  // --------------------------------------------------------
  const playSound = () => {
    try {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    } catch {}
  };

  const showToast = (message) => {
    const id = Date.now();
    setToasts((prev) => [{ id, message }, ...prev]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // --------------------------------------------------------
  // MARK AS READ using api.js
  // --------------------------------------------------------
  const markAsRead = useCallback(async (id) => {
    try {
      // Use centralized API function
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          String(n._id) === String(id) ? { ...n, isRead: true } : n
        )
      );
    } catch (err) {
      console.error("❌ Failed to mark-as-read:", err);
    }
  }, []);

  // --------------------------------------------------------
  // MARK ALL READ using api.js
  // --------------------------------------------------------
  const markAllAsRead = useCallback(async () => {
    try {
      // Use centralized API function
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("❌ Failed to mark-all:", err);
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <CurrentEmployeeNotificationContext.Provider
      value={{
        notifications,
        loading,
        markAsRead,
        markAllAsRead,
        unreadCount,
      }}
    >
      {children}

      {/* Toast UI */}
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: "#fff",
              padding: "10px 14px",
              marginBottom: 8,
              borderRadius: 8,
              boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
              minWidth: 260,
              fontWeight: 600,
            }}
          >
            <div>{t.message}</div>
          </div>
        ))}
      </div>
    </CurrentEmployeeNotificationContext.Provider>
  );
};

export default CurrentEmployeeNotificationProvider;