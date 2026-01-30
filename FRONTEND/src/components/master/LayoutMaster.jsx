import React from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Settings, LogOut, Hexagon } from "lucide-react";

const LayoutMaster = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("masterToken");
    navigate("/master");
  };

  const navItems = [
    { label: "Dashboard", path: "/master/dashboard", icon: <LayoutDashboard size={20} /> },
    { label: "Admin Users", path: "/master/admins", icon: <Users size={20} /> },
    { label: "Global Settings", path: "/master/settings", icon: <Settings size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-2xl z-20">
        <div className="h-20 flex items-center px-8 border-b border-slate-800">
          <Hexagon className="text-blue-500 w-8 h-8 mr-3 fill-blue-500/20" />
          <span className="text-xl font-bold tracking-wide">MASTER<span className="text-blue-500">ADMIN</span></span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                  isActive 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className={isActive ? "text-white" : "text-slate-400 group-hover:text-white"}>
                  {item.icon}
                </span>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
          <h1 className="text-2xl font-bold text-slate-800 capitalize">
            {location.pathname.split("/").pop().replace("-", " ")}
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900">Master Account</p>
              <p className="text-xs text-slate-500">Super User</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
              M
            </div>
          </div>
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