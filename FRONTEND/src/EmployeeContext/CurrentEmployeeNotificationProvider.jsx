// src/EmployeeContext/CurrentEmployeeNotificationProvider.jsx

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

// Load employee from SESSION STORAGE
const loadUser = () => {
  try {
    const raw = sessionStorage.getItem("hrmsUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Read notices stored in SESSION STORAGE
const READ_NOTICE_KEY = "employee_read_notices";

const CurrentEmployeeNotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [notices, setNotices] = useState([]);
  const [unreadNotices, setUnreadNotices] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loggedUser] = useState(loadUser);

  const getUserId = () => (loggedUser ? String(loggedUser._id) : null);

  // Load saved read notice IDs
  const loadReadNoticeIds = () => {
    try {
      return JSON.parse(sessionStorage.getItem(READ_NOTICE_KEY)) || [];
    } catch {
      return [];
    }
  };

  const saveReadNoticeIds = (ids) => {
    sessionStorage.setItem(READ_NOTICE_KEY, JSON.stringify(ids));
  };

  // ----- LOAD EMPLOYEE NOTIFICATIONS -----
  const loadNotifications = useCallback(async () => {
    try {
      const all = await getNotifications();

      const filtered = all.filter(
        (n) => String(n.userId) === String(getUserId())
      );

      // Sort newest → oldest
      filtered.sort(
        (a, b) =>
          new Date(b.date || b.createdAt) -
          new Date(a.date || a.createdAt)
      );

      setNotifications(filtered);
      setUnreadNotifications(filtered.filter((n) => !n.isRead).length);
    } catch (err) {
      console.error("❌ Error loading notifications:", err);
    }
  }, [loggedUser]);

  // ----- LOAD NOTICES -----
  const loadNotices = useCallback(async () => {
    try {
      const list = await getNotices();
      const readIds = loadReadNoticeIds();

      const mapped = list.map((n) => ({
        _id: n._id,
        title: n.title,
        message: n.title,
        date: n.date,
        isRead: readIds.includes(n._id),
      }));

      mapped.sort((a, b) => new Date(b.date) - new Date(a.date));

      setNotices(mapped);
      setUnreadNotices(mapped.filter((n) => !n.isRead).length);
    } catch (err) {
      console.error("❌ Error loading notices:", err);
    }
  }, []);

  // ----- MARK ALL NOTICES READ -----
  const markAllNoticesRead = () => {
    const allIds = notices.map((n) => n._id);
    saveReadNoticeIds(allIds);

    const updated = notices.map((n) => ({ ...n, isRead: true }));
    setNotices(updated);
    setUnreadNotices(0);
  };

  // ----- SOCKET DISABLED -----
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });

    console.log("📡 Socket connected (employee notifications disabled)");

    socket.off("newNotification");
    socket.off("newNotice");
    socket.off("notificationUpdated");
    socket.off("notificationsAllRead");

    return () => socket.disconnect();
  }, []);

  // ----- MARK SINGLE NOTIFICATION READ -----
  const markAsRead = async (id) => {
    try {
      await markNotificationAsRead(id);

      setNotifications((prev) => {
        const updated = prev.map((n) =>
          String(n._id) === String(id) ? { ...n, isRead: true } : n
        );

        setUnreadNotifications(updated.filter((n) => !n.isRead).length);
        return updated;
      });
    } catch (err) {
      console.error("❌ Failed to mark notification read:", err);
    }
  };

  // ----- MARK ALL NOTIFICATIONS READ -----
  const markAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotifications(0);
    } catch (err) {
      console.error("❌ Failed to mark all notifications read:", err);
    }
  };

  // ----- INITIAL LOAD -----
  useEffect(() => {
    (async () => {
      await loadNotifications();
      await loadNotices();
      setLoading(false);
    })();
  }, []);

  return (
    <CurrentEmployeeNotificationContext.Provider
      value={{
        notifications,
        unreadNotifications, // <-- NEW
        notices,
        unreadNotices,
        loading,
        markAsRead,
        markAllAsRead,
        markAllNoticesRead,
        loadNotifications,
        loadNotices,
      }}
    >
      {children}
    </CurrentEmployeeNotificationContext.Provider>
  );
};

export default CurrentEmployeeNotificationProvider;
