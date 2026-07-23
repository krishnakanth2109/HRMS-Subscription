import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import api from "../../api"; // Import the configured axios instance

const AdminMonitoring = () => {
  const location = useLocation();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (location.state && location.state.status) {
      setStatusFilter(location.state.status);
    }
  }, [location]);

  // 1. Update current time every second for the countdown
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Fetch all admins from backend using the configured api instance
  const fetchAdmins = async () => {
    try {
      // Using the imported api instance which has the correct baseURL from env
      const res = await api.get("/api/admin/all-admins");
      setAdmins(res.data);
    } catch (err) {
      console.error("Fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // 3. Helper: Calculate Time Left
  const getTimeRemaining = (expiryDate) => {
    const total = Date.parse(expiryDate) - Date.parse(currentTime);
    if (total <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };

    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));

    return { total, days, hours, minutes, seconds };
  };

  // --- STATS CALCULATION ---
  const totalCompanies = admins.length;
  const activePlans = admins.filter(a => new Date(a.planExpiresAt) > currentTime).length;
  const expiredPlans = totalCompanies - activePlans;

  // --- FILTERED ADMINS ---
  const filteredAdmins = useMemo(() => {
    return admins.filter(admin => {
      const time = getTimeRemaining(admin.planExpiresAt);
      const isExpired = time.total <= 0;

      if (statusFilter === "active" && isExpired) return false;
      if (statusFilter === "expired" && !isExpired) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = admin.name?.toLowerCase().includes(query);
        const matchesEmail = admin.email?.toLowerCase().includes(query);
        return matchesName || matchesEmail;
      }

      return true;
    });
  }, [admins, statusFilter, searchQuery, currentTime]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="mt-4 text-gray-600 font-medium">Loading Real-time Monitor...</p>
    </div>
  );

  return (
    <div className="animate-[fadeIn_0.4s_ease-out]">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Subscription <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Monitor</span>
          </h1>
          <p className="text-slate-550 text-sm mt-1">Live tracking of company subscription plan statuses and countdown expirations.</p>
        </div>
        <button 
          onClick={fetchAdmins}
          className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 hover:border-slate-300 px-5 py-2.5 rounded-xl shadow-sm hover:shadow active:scale-95 transition-all font-bold text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Sync Now
        </button>
      </div>

      {/* --- INTERACTIVE FILTER CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8"> 

        {/* Total Companies Card (Filter All) */}
        <div 
          onClick={() => setStatusFilter("all")}
          className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer select-none group relative flex items-center justify-between ${
            statusFilter === "all"
              ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20 shadow-md -translate-y-0.5"
              : "bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200/80 hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl transition-all duration-300 ${
              statusFilter === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5" 
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" 
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                Total Companies
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">{totalCompanies}</h3>
            </div>
          </div>

          {statusFilter === "all" && (
            <span className="text-[9px] font-extrabold text-blue-700 bg-blue-100/90 px-2.5 py-1 rounded-full uppercase tracking-wider border border-blue-200/60 shadow-2xs">
              Showing All
            </span>
          )}
        </div>

        {/* Active Plans Card (Filter Active) */}
        <div 
          onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
          className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer select-none group relative flex items-center justify-between ${
            statusFilter === "active"
              ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-md -translate-y-0.5"
              : "bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200/80 hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl transition-all duration-300 ${
              statusFilter === "active"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white"
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5" 
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" 
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                Active Plans
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">{activePlans}</h3>
            </div>
          </div>

          {statusFilter === "active" && (
            <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100/90 px-2.5 py-1 rounded-full uppercase tracking-wider border border-emerald-200/60 shadow-2xs">
              Active ✓
            </span>
          )}
        </div>

        {/* Expired Plans Card (Filter Expired) */}
        <div 
          onClick={() => setStatusFilter(statusFilter === "expired" ? "all" : "expired")}
          className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer select-none group relative flex items-center justify-between ${
            statusFilter === "expired"
              ? "bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 shadow-md -translate-y-0.5"
              : "bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200/80 hover:-translate-y-0.5"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl transition-all duration-300 ${
              statusFilter === "expired"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white"
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5" 
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" 
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                Expired Plans
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">{expiredPlans}</h3>
            </div>
          </div>

          {statusFilter === "expired" && (
            <span className="text-[9px] font-extrabold text-rose-700 bg-rose-100/90 px-2.5 py-1 rounded-full uppercase tracking-wider border border-rose-200/60 shadow-2xs">
              Expired ✓
            </span>
          )}
        </div>

      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        {/* Modern Tab Filters */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-inner w-full md:w-auto overflow-x-auto">
          {[
            { id: "all", label: "All Companies", count: totalCompanies },
            { id: "active", label: "Active Plans", count: activePlans },
            { id: "expired", label: "Expired", count: expiredPlans }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(statusFilter === tab.id && tab.id !== "all" ? "all" : tab.id)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/40"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                statusFilter === tab.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Results Count & Search Bar */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-xs font-semibold text-slate-400 hidden sm:inline whitespace-nowrap">
            Showing <strong className="text-slate-700">{filteredAdmins.length}</strong> of {totalCompanies}
          </span>
          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by company or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 hover:border-slate-350 transition-colors shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* --- DYNAMIC TABLE --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-5 font-bold text-slate-400 border-b border-slate-100 text-[10px] uppercase tracking-wider">Company / Admin</th>
                <th className="p-5 font-bold text-slate-400 border-b border-slate-100 text-[10px] uppercase tracking-wider text-center">Plan Type</th>
                <th className="p-5 font-bold text-slate-400 border-b border-slate-100 text-[10px] uppercase tracking-wider">Status</th>
                <th className="p-5 font-bold text-slate-400 border-b border-slate-100 text-[10px] uppercase tracking-wider">Activation Date</th>
                <th className="p-5 font-bold text-slate-400 border-b border-slate-100 text-[10px] uppercase tracking-wider">Expiry Date</th>
                <th className="p-5 font-bold text-blue-600 border-b border-slate-100 text-[10px] uppercase tracking-wider text-right">Countdown (Live)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAdmins.map((admin) => {
                const time = getTimeRemaining(admin.planExpiresAt);
                const isExpired = time.total <= 0;

                return (
                  <tr key={admin._id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold border bg-blue-50 text-blue-600 border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
                          {admin.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm leading-snug">{admin.name}</div>
                          <div className="text-xs text-slate-400 font-semibold">{admin.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                        admin.plan === 'Premium' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                        admin.plan === 'Free' ? 'bg-slate-50 text-slate-600 border-slate-200' : 
                        'bg-blue-50 text-blue-755 border-blue-100'
                      }`}>
                        {admin.plan}
                      </span>
                    </td>
                    <td className="p-5">
                      {isExpired ? (
                        <div className="inline-flex items-center gap-1.5 text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg">
                          <span className="w-1.5 h-1.5 bg-rose-600 rounded-full animate-ping"></span>
                          <span className="text-xs font-bold uppercase tracking-wider">Expired</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
                          <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></span>
                          <span className="text-xs font-bold uppercase tracking-wider">Active</span>
                        </div>
                      )}
                    </td>
                    <td className="p-5 text-xs font-semibold text-slate-700">
                      <div>{new Date(admin.planActivatedAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                        at {new Date(admin.planActivatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-5 text-xs font-semibold text-slate-700">
                      <div>{new Date(admin.planExpiresAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                        at {new Date(admin.planExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-5 text-right">
                      {isExpired ? (
                        <span className="inline-flex bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm uppercase tracking-wider">Renewal Overdue</span>
                      ) : (
                        <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl font-mono text-xs font-bold text-slate-700 shadow-inner">
                          <span className="text-blue-600">{time.days}d</span>
                          <span className="text-slate-300">:</span>
                          <span className="text-slate-705">{String(time.hours).padStart(2, '0')}h</span>
                          <span className="text-slate-300">:</span>
                          <span className="text-slate-606">{String(time.minutes).padStart(2, '0')}m</span>
                          <span className="text-slate-300">:</span>
                          <span className="text-indigo-500 animate-pulse">{String(time.seconds).padStart(2, '0')}s</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredAdmins.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <p className="text-slate-550 font-semibold tracking-tight">No companies found</p>
            <p className="text-xs text-slate-405 mt-1">Try adjusting your filters or search query to find subscriber accounts.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMonitoring;