import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { FaHome, FaClock, FaClipboardList, FaBullhorn, FaUser, FaSignOutAlt, FaBars, FaTimes } from "react-icons/fa";

const navLinks = [
  {
    to: "/employee/dashboard",
    label: "Dashboard",
    icon: <FaHome className="mr-2" />,
  },
  {
    to: "/employee/my-attendence", // <-- FIXED path
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
  },
 
  {
    to: "/employee/empovertime",
    label: "Request Overtime",
    icon:  <FaClock className="mr-2" />,
  },
    {
    to: "/employee/leave-request",
    label: "Leave Requests",
    icon: <FaClipboardList className="mr-2" />,
  },
  //   {
  //   to: "/employee/new-attendence",
  //   label: "Attendance 2",
  //   icon:  <FaClock className="mr-2" />,
  // },


];

const SidebarEmployee = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(window.innerWidth >= 768);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setOpen(true);
      } else {
        setOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  return (
    <>
      {/* Hamburger icon for small screens */}
      {!open && (
        <button
          className="md:hidden fixed top-4 left-4 z-50 bg-blue-900 text-white p-2 rounded-lg shadow-lg focus:outline-none"
          onClick={() => setOpen(true)}
          aria-label="Open sidebar"
        >
          <FaBars className="text-2xl" />
        </button>
      )}
      {/* Sidebar */}
      <div
        className={`fixed md:static top-0 left-0 h-full ${collapsed ? 'w-20' : 'w-64'} bg-gradient-to-b from-blue-900 to-blue-700 text-white shadow-xl flex flex-col p-4 md:p-6 z-40 transition-all duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        style={{ minHeight: '100vh', transition: 'all 0.3s' }}
      >
        {/* Collapse/Expand toggle button (always visible on desktop) */}
        <button
          className="hidden md:block absolute top-4 right-4 text-white text-xl bg-blue-700 rounded-full p-2 shadow focus:outline-none hover:bg-blue-800"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <FaBars /> : <FaTimes />}
        </button>
        {/* Close icon for mobile (only when sidebar is open and not collapsed) */}
        {open && (
          <button
            className="md:hidden absolute top-4 right-4 text-white text-2xl focus:outline-none"
            onClick={() => setOpen(false)}
            aria-label="Close sidebar"
          >
            <FaTimes />
          </button>
        )}
        <div className={`mb-8 flex items-center gap-3 mt-2 ${collapsed ? 'justify-center' : ''}`}>
          <FaUser className="text-3xl" />
          {!collapsed && <span className="text-xl font-bold tracking-wide">Employee Panel</span>}
        </div>
        <ul className="space-y-2 flex-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold transition-all duration-150 focus:outline-none text-base ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'hover:bg-blue-700 hover:text-blue-400 text-gray-200'
                  } ${collapsed ? 'justify-center px-2' : ''}`}
                  title={link.label}
                >
                  <span className="text-xl">{link.icon}</span>
                  {!collapsed && <span>{link.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      
        <div className={`mt-2 text-xs text-gray-400 transition-all duration-300 ${collapsed ? 'hidden' : ''}`}>
          &copy; {new Date().getFullYear()} HRMS Employee
        </div>
      </div>
    </>
  );
};

export default SidebarEmployee;
