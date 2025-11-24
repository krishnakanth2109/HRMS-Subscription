import React, { useState, useEffect, useCallback } from "react";
import { CurrentEmployeeNotificationContext } from "./CurrentEmployeeNotificationContext";
import {
  getNotifications,
  getNotices,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../api";
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT;

// Load logged-in employee
const loadUser = () => {
  try {
    const raw =
      localStorage.getItem("hrmsUser") || sessionStorage.getItem("hrmsUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const NOTICE_READ_KEY = "employee_read_notices";

const CurrentEmployeeNotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0); // 🔥 FIX 1 — NEW STATE
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sound] = useState(() => new Audio("/notification.mp3"));
  const [loggedUser] = useState(loadUser);

  // Read notices from local storage
  const getReadNotices = () => {
    try {
      return JSON.parse(localStorage.getItem(NOTICE_READ_KEY)) || [];
    } catch {
      return [];
    }
  };

  const markNoticeAsReadLocally = (id) => {
    const list = getReadNotices();
    if (!list.includes(id)) {
      const updated = [...list, id];
      localStorage.setItem(NOTICE_READ_KEY, JSON.stringify(updated));
    }
  };

  const markAllNoticesAsReadLocally = () => {
    const allNoticeIds = notifications
      .filter((n) => n.userId === "ALL")
      .map((n) => n._id);

    localStorage.setItem(NOTICE_READ_KEY, JSON.stringify(allNoticeIds));
  };

  const getUserId = () => (loggedUser ? String(loggedUser._id) : null);

  /*
  ==================================================================
    FETCH ALL NOTIFICATIONS
  ==================================================================
  */
  const fetchNotifications = useCallback(async () => {
    setLoading(true);

    try {
      const userId = getUserId();
      const readNotices = getReadNotices();

      const dbNotifications = await getNotifications();
      const personal = dbNotifications.filter(
        (n) => String(n.userId) === userId
      );

      const notices = await getNotices();
      const noticeItems = notices.map((n) => ({
        _id: n._id,
        userId: "ALL",
        title: "New Notice",
        message: n.title,
        type: "notice",
        isRead: readNotices.includes(n._id),
        date: n.date,
      }));

      const combined = [...personal, ...noticeItems];

      combined.sort(
        (a, b) =>
          new Date(b.date || b.createdAt) -
          new Date(a.date || a.createdAt)
      );

      setNotifications(combined);
    } catch (err) {
      console.error("❌ Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  /*
  ==================================================================
    SOCKETS
  ==================================================================
  */
  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;

    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });

    socket.on("newNotification", (n) => {
      if (String(n.userId) !== userId) return;
      setNotifications((prev) => [n, ...prev]);
      playSound();
      showToast(n.message);
    });

    socket.on("newNotice", (notice) => {
      const newNotice = {
        _id: Date.now(),
        userId: "ALL",
        title: "New Notice",
        message: notice.title,
        type: "notice",
        isRead: false,
        date: new Date(),
      };

      setNotifications((prev) => [newNotice, ...prev]);
      playSound();
      showToast(`Notice: ${notice.title}`);
    });

    return () => socket.disconnect();
  }, []);

  /*
  ==================================================================
    UNREAD COUNT AUTO-UPDATE  🔥 FIX 2
  ==================================================================
  */
  useEffect(() => {
    setUnreadCount(notifications.filter((n) => !n.isRead).length);
  }, [notifications]);

  /*
  ==================================================================
    SOUND + TOAST
  ==================================================================
  */
  const playSound = () => {
    try {
      sound.currentTime = 0;
      sound.play();
    } catch {}
  };

  const showToast = (message) => {
    const id = Date.now();
    setToasts((prev) => [{ id, message }, ...prev]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  /*
  ==================================================================
    MARK SINGLE READ
  ==================================================================
  */
  const markAsRead = async (id) => {
    try {
      const target = notifications.find((n) => String(n._id) === String(id));

      if (target.userId === "ALL") {
        markNoticeAsReadLocally(id);
      } else {
        await markNotificationAsRead(id);
      }

      setNotifications((prev) =>
        prev.map((n) =>
          String(n._id) === String(id) ? { ...n, isRead: true } : n
        )
      );
    } catch (err) {
      console.error("❌ Failed to mark as read:", err);
    }
  };

  /*
  ==================================================================
    MARK ALL READ  🔥 FIX 3
  ==================================================================
  */
  const markAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      markAllNoticesAsReadLocally();

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );

      setUnreadCount(0); // IMPORTANT

    } catch (err) {
      console.error("❌ Failed to mark all as read:", err);
    }
  };

  return (
    <CurrentEmployeeNotificationContext.Provider
      value={{
        notifications,
        loading,
        markAsRead,
        markAllAsRead,
        unreadCount, // 🔥 FIX 4
      }}
    >
      {children}

      {/* Toasts */}
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: "#fff",
              padding: "12px 16px",
              marginBottom: 10,
              borderRadius: 10,
              boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
              fontWeight: 600,
              minWidth: "260px",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </CurrentEmployeeNotificationContext.Provider>
  );
};

export default CurrentEmployeeNotificationProvider;
