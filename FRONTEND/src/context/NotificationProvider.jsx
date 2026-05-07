// src/context/NotificationProvider.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { NotificationContext } from "./NotificationContext";
import {
  getNotifications,
  addNotificationRequest,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteAllNotifications, // ✅ BUG 1 FIX
} from "../api";
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT || "http://localhost:5000";

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  // ✅ FEATURE 1 — Bell panel toggle state (lifted here so Navbar can use it)
  const [bellOpen, setBellOpen] = useState(false);

  const [sound] = useState(() => new Audio("/notification.mp3"));

  // ─── Load current user from sessionStorage ─────────────────────────────────
  const getCurrentUser = () => {
    try {
      const raw = sessionStorage.getItem("hrmsUser");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  // ─── Fetch notifications from backend ──────────────────────────────────────
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

  // ─── SOCKET CONNECTION (Feature 2 — real-time) ─────────────────────────────
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("📡 Socket connected:", socket.id);
      // ✅ FEATURE 2 — Join the user's private room so only they receive targeted events
      const user = getCurrentUser();
      if (user?._id) {
        socket.emit("authenticate", user._id);
        console.log("🔐 Authenticated socket for user:", user._id);
      }
    });

    // Legacy notice handler (kept for backward compatibility)
    socket.on("newNotice", (data) => {
      const newNotification = {
        _id: `notice-${Date.now()}`,
        title: "New Notice Posted",
        message: data.title,
        type: "notice",
        isRead: false,
        date: new Date(),
      };
      setNotifications((prev) => [newNotification, ...prev]);
    });

    // ✅ FEATURE 2 — Real-time: only this user's room receives this event now
    socket.on("newNotification", (data) => {
      console.log("🔥 Real-time notification received:", data);

      // Deduplicate — skip if already in state
      setNotifications((prev) => {
        if (prev.some((n) => n._id?.toString() === data._id?.toString())) {
          return prev;
        }
        return [data, ...prev];
      });

      // Play sound
      try {
        sound.currentTime = 0;
        sound.play().catch(() => {});
      } catch {}

      // Toast popup
      const toastId = Date.now();
      setToasts((prev) => [
        { id: toastId, message: data.message, title: data.title, time: new Date() },
        ...prev,
      ]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId));
      }, 4500);
    });

    // Re-authenticate on reconnect (handles page navigation socket drops)
    socket.on("reconnect", () => {
      const user = getCurrentUser();
      if (user?._id) {
        socket.emit("authenticate", user._id);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [sound]);

  // ─── Add notification manually ─────────────────────────────────────────────
  const addNotification = async (message, type = "info", extra = {}) => {
    try {
      const saved = await addNotificationRequest({ message, type, ...extra });
      setNotifications((prev) => [saved, ...prev]);
      return saved;
    } catch (err) {
      console.error("Failed to save notification:", err.message);
    }
  };

  // ─── Mark single as read ───────────────────────────────────────────────────
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

  // ─── Mark ALL as read ─────────────────────────────────────────────────────
  // ✅ BUG 2 FIX — guard: do nothing if no unread notifications exist
  const markAllAsRead = async () => {
    const hasUnread = notifications.some((n) => !n.isRead);
    if (!hasUnread) {
      console.log("ℹ️ No unread notifications — skipping markAllAsRead");
      return; // Short-circuit: no API call, no re-render
    }
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Failed to mark all as read:", err.message);
    }
  };

  // ─── Clear All (permanently delete from DB) ───────────────────────────────
  // ✅ BUG 1 FIX — deletes from DB so notifications never reappear
  const clearAll = async () => {
    try {
      await deleteAllNotifications();
      setNotifications([]); // Clear local state immediately
    } catch (err) {
      console.error("Failed to clear notifications:", err.message);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        setNotifications,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearAll,       // ✅ BUG 1 — expose clearAll
        unreadCount,
        loading,
        bellOpen,       // ✅ FEATURE 1 — expose bell toggle state
        setBellOpen,    // ✅ FEATURE 1 — expose bell toggle setter
        fetchNotifications,
        socket: socketRef.current,
      }}
    >
      {children}

      {/* ── Toast Notifications ─────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              background: "linear-gradient(135deg, #1e3a8a, #3b82f6)",
              color: "#fff",
              padding: "12px 16px",
              borderRadius: "10px",
              boxShadow: "0px 6px 20px rgba(0,0,0,0.25)",
              minWidth: "260px",
              maxWidth: "340px",
              fontSize: "14px",
              fontWeight: "600",
              animation: "slideInRight 0.3s ease",
            }}
          >
            {toast.title && (
              <div style={{ fontSize: "12px", opacity: 0.8, marginBottom: "4px" }}>
                🔔 {toast.title}
              </div>
            )}
            <div>{toast.message}</div>
            <div style={{ fontSize: "11px", opacity: 0.7, marginTop: "4px" }}>
              {toast.time.toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
