import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useContext } from "react";
import {
  FaHome,
  FaClock,
  FaClipboardList,
  FaBullhorn,
  FaUser,
  FaBars,
  FaTimes,
} from "react-icons/fa";

import { CurrentEmployeeNotificationContext } from "../../EmployeeContext/CurrentEmployeeNotificationContext";

const navLinks = [
  {
    to: "/employee/dashboard",
    label: "Dashboard",
    icon: <FaHome className="mr-2" />,
  },
  {
    to: "/employee/my-attendence",
    label: "Attendance",
    icon: <FaClock className="mr-2" />,
  },
  {
    to: "/employee/holiday-calendar",
    label: "Holiday Calendar",
    icon: <FaClipboardList className="mr-2" />,
  },
  {
    to: "/employee/notices",
    label: "Notice Board",
    icon: <FaBullhorn className="mr-2" />,
    isNotice: true,
  },
  {
    to: "/employee/empovertime",
    label: "Request Overtime",
    icon: <FaClock className="mr-2" />,
  },
  {
    to: "/employee/leave-request",
    label: "Leave Requests",
    icon: <FaClipboardList className="mr-2" />,
  },
];

const SidebarEmployee = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(window.innerWidth >= 768);
  const [collapsed, setCollapsed] = useState(false);

  // Notifications context (employee)
  const { notifications, loadNotifications } = useContext(
    CurrentEmployeeNotificationContext
  );

  // Unread notices count (only userId === "ALL")
  const unreadNotices = notifications.filter(
    (n) => n.userId === "ALL" && !n.isRead
  ).length;

  // Resize listener (open/close on mobile)
  useEffect(() => {
    const handleResize = () => {
      setOpen(window.innerWidth >= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Clear unread notices when clicking Notice Board
  const handleNoticeClick = async () => {
    try {
      await fetch(
        `${import.meta.env.VITE_API_URL}/notifications/mark-all`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );

      // Refresh notifications list
      loadNotifications();
    } catch (err) {
      console.error("Error clearing unread notices:", err);
    }
  };

  return (
    <>
      {/* Mobile hamburger */}
      {!open && (
        <button
          className="md:hidden fixed top-4 left-4 z-50 bg-blue-900 text-white p-2 rounded-lg shadow-lg focus:outline-none"
          onClick={() => setOpen(true)}
        >
          <FaBars className="text-2xl" />
        </button>
      )}

      {/* Sidebar container */}
      <div
        className={`fixed md:static top-0 left-0 h-full ${
          collapsed ? "w-20" : "w-64"
        } bg-gradient-to-b from-blue-900 to-blue-700 text-white shadow-xl flex flex-col p-4 md:p-6 z-40 transition-all duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        {/* Collapse toggle */}
        <button
          className="hidden md:block absolute top-4 right-6 text-white text-xl bg-blue-700 rounded-full p-2 shadow hover:bg-blue-800"
          onClick={() => setCollapsed((v) => !v)}
        >
          <FaBars />
        </button>

        {/* Mobile close */}
        {open && (
          <button
            className="md:hidden absolute top-4 right-4 text-white text-2xl"
            onClick={() => setOpen(false)}
          >
            <FaTimes />
          </button>
        )}

        {/* Header */}
        <div
          className={`mb-8 flex items-center gap-1 mt-2 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {!collapsed && <FaUser className="text-3xl " />}
          {!collapsed && (
            <span className="text-lg font-bold tracking-wide">
              Employee Panel
            </span>
          )}
        </div>

        {/* Navigation links */}
        <ul className="space-y-2 flex-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;

            return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold transition-all duration-150 text-base ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg"
                      : "hover:bg-blue-700 hover:text-blue-300 text-gray-200"
                  } ${collapsed ? "justify-center px-2" : ""}`}
                  onClick={() => {
                    if (link.isNotice) handleNoticeClick();
                  }}
                >
                  <span className="text-xl">{link.icon}</span>

                  {!collapsed && (
                    <span className="flex items-center gap-2 relative">
                      {link.label}

                      {/* 🔴 Number Badge for unread notices */}
                      {link.isNotice && unreadNotices > 0 && (
                        <span className="absolute -right-5 top-0 bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                          {unreadNotices}
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {!collapsed && (
          <div className="mt-2 text-xs text-gray-300">
            &copy; {new Date().getFullYear()} HRMS Employee
          </div>
        )}
      </div>
    </>
  );
};

export default SidebarEmployee;
