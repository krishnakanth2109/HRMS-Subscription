import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut, 
  Hexagon, 
  ChevronLeft, 
  UserCog ,
  LifeBuoy  ,
  ChevronRight ,Bug, CalendarCheck
} from "lucide-react";

const LayoutMaster = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = (e) => {
    e.preventDefault(); // Prevent default link behavior
    localStorage.removeItem("masterToken"); // Clear the specific token
    sessionStorage.clear(); // Optional: Clear session storage too
    navigate("/master", { replace: true }); // Redirect and prevent back button
  };

  const navItems = [
    { label: "Dashboard", path: "/master/dashboard", icon: <LayoutDashboard size={22} /> },
    { label: "Our Subscribers", path: "/master/admins", icon: <Users size={22} /> },
    { label: "Plan Settings", path: "/master/settings", icon: <Settings size={22} /> },

{ 
  label: "Manage Logins", 
  path: "/master/manage-logins", 
  icon: <UserCog size={22} /> 
},

{ 
  label: "Technical Issues", 
  path: "/master/manage-issues", 
  icon: <Bug size={22} />   // or <Wrench />
},
{ 
  label: "Demo Requests", 
    path: "/master/manage-demo-requests",  
  icon: <CalendarCheck size={22} /> 
}


  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${
          isExpanded ? "w-64" : "w-20"
        } bg-[#0f172a] text-white flex flex-col shadow-2xl z-20 transition-all duration-300 ease-in-out relative`}
      >
        {/* Toggle Button - Now positioned next to the Logo */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute -right-3 top-7 bg-blue-600 text-white rounded-full p-1 shadow-lg hover:bg-blue-700 transition-all z-30"
        >
          {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* Logo Section */}
        <div className="h-20 flex items-center px-6 border-b border-slate-800 overflow-hidden whitespace-nowrap">
          <Hexagon className="text-blue-500 w-8 h-8 flex-shrink-0 fill-blue-500/20" />
          {isExpanded && (
            <span className="ml-3 text-xl font-bold tracking-wide transition-opacity duration-300">
              MASTER<span className="text-blue-500">ADMIN</span>
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group whitespace-nowrap ${
                  isActive 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className={`flex-shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`}>
                  {item.icon}
                </span>
                {isExpanded && (
                  <span className="font-medium transition-opacity duration-300">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-3 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-4 w-full px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all whitespace-nowrap overflow-hidden"
          >
            <LogOut size={22} className="flex-shrink-0" />
            {isExpanded && <span className="font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
          <h1 className="text-2xl font-bold text-slate-800 capitalize truncate">
            {location.pathname.split("/").pop().replace("-", " ")}
          </h1>
          
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto bg-slate-50 p-8">
            <Outlet />
        </div>
      </main>
    </div>
  );
};

export default LayoutMaster;