import { Link, useLocation, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { 
  FaTachometerAlt, 
  FaUsers, 
  FaCalendarCheck, 
  FaClipboardList, 
  FaChartPie, 
  FaBars, 
  FaCalendarAlt,
  FaChevronDown,
  FaFileAlt,
  FaClock,
  FaBusinessTime,
  FaConnectdevelop // A sample logo icon
} from "react-icons/fa";

const navLinks = [
  {
    to: "/admin/dashboard",
    label: "Dashboard",
    icon: <FaTachometerAlt />,
  },
  {
    to: "/employees",
    label: "Employee Management",
    icon: <FaUsers />,
  },
  {
    label: "Attendance",
    icon: <FaCalendarCheck />,
    basePath: "/attendance",
    subLinks: [
      {
        to: "/attendance",
        label: "Attendance Log",
        icon: <FaFileAlt />,
      },
  
      {
        to: "/attendance/permissions",
        label: "Permission Hours",
        icon: <FaBusinessTime />,
      },
    ],
  },
  // {
  //   to: "/admin/leave-summary",
  //   label: "Leave Summary",
  //   icon: <FaChartPie />,
  // },
    {
    to: "/admin/payroll",        // <-- Added Payroll link here
    label: "Payroll",
    icon: <FaFileAlt />,
  },
  {
    to: "/admin/notices",
    label: "Admin Notices",
    icon: <FaClipboardList />,
  },
  {
    to: "/admin/holiday-calendar",
    label: "Holiday Calendar",
    icon: <FaCalendarAlt />,
  },
    {
    to: "/admin/admin-overtime",
    label: "Overtime Approval",
    icon: <FaChartPie />,
  },

      {
    to: "/admin/admin-Leavemanage",
    label: "Leave Approvals",
    icon:<FaClipboardList />,
  },


];

const Sidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [openSubMenus, setOpenSubMenus] = useState({});

  useEffect(() => {
    if (collapsed) {
      setOpenSubMenus({});
    }
  }, [collapsed]);
  
  const handleSubMenuToggle = (label) => {
    setOpenSubMenus((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  return (
    <div className={`h-screen bg-slate-900 shadow-xl transition-[width] duration-300 ease-in-out ${collapsed ? 'w-20' : 'w-72'} p-4 flex flex-col`}>
      {/* --- Header / Logo --- */}
      <div className={`flex items-center mb-6 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {/* --- FIX IS HERE: The logo container now shrinks to w-0 --- */}
        <div className={`flex items-center gap-3 transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden ${collapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}`}>
          <span className="text-3xl text-indigo-400"><FaConnectdevelop /></span>
          <span className="text-xl font-bold tracking-wide text-slate-200">HRMS</span>
        </div>
        <button
          className="p-2 rounded-lg text-slate-400 focus:outline-none hover:bg-slate-800"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label="Toggle Sidebar"
        >
          <FaBars />
        </button>
      </div>

      {/* --- Navigation Links --- */}
      <ul className="space-y-2 flex-1">
        {navLinks.map((link) => {
          // --- Render Dropdown Menu ---
          if (link.subLinks) {
            const isParentActive = location.pathname.startsWith(link.basePath);
            const isSubMenuOpen = openSubMenus[link.label] && !collapsed;

            return (
              <li key={link.label}>
                <button
                  onClick={() => handleSubMenuToggle(link.label)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg font-medium text-base transition-colors duration-150 border-l-4 ${
                    isParentActive
                      ? 'bg-slate-800 text-indigo-400 border-indigo-500'
                      : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  } ${collapsed ? 'justify-center' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xl w-5 flex justify-center">{link.icon}</span>
                    <span className={`transition-all duration-200 ease-in-out whitespace-nowrap overflow-hidden ${collapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}`}>
                      {link.label}
                    </span>
                  </div>
                  <div className={`transition-all duration-200 ease-in-out whitespace-nowrap overflow-hidden ${collapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}`}>
                    <FaChevronDown className={`transition-transform duration-200 ${isSubMenuOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                <div className={`transition-[max-height] duration-300 ease-in-out overflow-hidden ${isSubMenuOpen ? 'max-h-48' : 'max-h-0'}`}>
                  <ul className="mt-2 space-y-1 pl-12">
                    {link.subLinks.map((subLink) => (
                      <li key={subLink.to}>
                        <NavLink
                          to={subLink.to}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                              isActive
                                ? 'text-indigo-400'
                                : 'text-slate-500 hover:text-slate-300'
                            }`
                          }
                        >
                          <span className={`transition-opacity duration-200 whitespace-nowrap ${collapsed ? 'opacity-0' : 'opacity-100 delay-100'}`}>
                            {subLink.label}
                          </span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          }
          
          // --- Render Regular Link ---
          return (
            <li key={link.to}>
              <NavLink
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center gap-4 px-4 py-2.5 rounded-lg font-medium text-base transition-colors duration-150 border-l-4 ${
                    isActive
                      ? 'bg-slate-800 text-indigo-400 border-indigo-500'
                      : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  } ${collapsed ? 'justify-center px-2' : ''}`
                }
                title={link.label}
              >
                <span className="text-xl w-5 flex justify-center">{link.icon}</span>
                <span className={`transition-all duration-200 ease-in-out whitespace-nowrap overflow-hidden ${collapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}`}>
                  {link.label}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>

      {/* --- Footer --- */}
      <div className={`mt-auto text-center text-xs text-slate-500 transition-opacity duration-300 whitespace-nowrap ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
        &copy; {new Date().getFullYear()} HRMS Admin
      </div>
    </div>
  );
};

export default Sidebar;