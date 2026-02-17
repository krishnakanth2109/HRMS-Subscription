import React, { useState, useEffect } from "react";
import axios from "axios";
import api from "../../api"; // Import the configured axios instance

const AdminMonitoring = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

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

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="mt-4 text-gray-600 font-medium">Loading Real-time Monitor...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-8 bg-[#f8fafc] min-h-screen font-sans">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            Subscription <span className="text-blue-600">Monitor</span>
          </h1>
          <p className="text-slate-500 mt-1">Live tracking of company plan statuses and expirations.</p>
        </div>
        <button 
          onClick={fetchAdmins}
          className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Sync Now
        </button>
      </div>

      {/* --- QUICK STATS CONTAINERS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"> 

        {/* Total Companies */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">
              Total Companies
            </p>
            <div className="flex items-center gap-2 mt-2">
              <svg xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6 text-slate-600" 
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
              <h3 className="text-3xl font-bold text-slate-800">{totalCompanies}</h3>
            </div>
          </div>
        </div>

        {/* Active Plans */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">
              Active Plans
            </p>
            <div className="flex items-center gap-2 mt-2">
              <svg xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6 text-slate-600" 
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-3xl font-bold text-slate-800">{activePlans}</h3>
            </div>
          </div>
        </div>

        {/* Expired Plans */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">
              Expired Plans
            </p>
            <div className="flex items-center gap-2 mt-2">
              <svg xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6 text-slate-600" 
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-3xl font-bold text-slate-800">{expiredPlans}</h3>
            </div>
          </div>
        </div>

      </div>

      {/* --- DYNAMIC TABLE --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-5 font-bold text-slate-600 border-b border-slate-100 text-sm uppercase tracking-wider">Company / Admin</th>
                <th className="p-5 font-bold text-slate-600 border-b border-slate-100 text-sm uppercase tracking-wider text-center">Plan Type</th>
                <th className="p-5 font-bold text-slate-600 border-b border-slate-100 text-sm uppercase tracking-wider">Status</th>
                <th className="p-5 font-bold text-slate-600 border-b border-slate-100 text-sm uppercase tracking-wider">Activation Date</th>
                <th className="p-5 font-bold text-slate-600 border-b border-slate-100 text-sm uppercase tracking-wider">Expiry Date</th>
                <th className="p-5 font-bold text-blue-600 border-b border-slate-100 text-sm uppercase tracking-wider text-right">Countdown (Live)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {admins.map((admin) => {
                const time = getTimeRemaining(admin.planExpiresAt);
                const isExpired = time.total <= 0;

                return (
                  <tr key={admin._id} className="group hover:bg-blue-50/30 transition-colors">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                          {admin.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{admin.name}</div>
                          <div className="text-xs text-slate-400 font-medium">{admin.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase ${
                        admin.plan === 'Premium' ? 'bg-amber-100 text-amber-700' : 
                        admin.plan === 'Free' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {admin.plan}
                      </span>
                    </td>
                    <td className="p-5">
                      {isExpired ? (
                        <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-3 py-1 rounded-lg w-fit">
                          <span className="w-2 h-2 bg-rose-600 rounded-full animate-ping"></span>
                          <span className="text-sm font-bold">Expired</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg w-fit">
                          <span className="w-2 h-2 bg-emerald-600 rounded-full"></span>
                          <span className="text-sm font-bold uppercase tracking-tight">Active</span>
                        </div>
                      )}
                    </td>
                    <td className="p-5 text-sm font-medium text-slate-500 italic">
                      {new Date(admin.planActivatedAt).toLocaleDateString()} <br/>
                      <span className="text-[10px] uppercase text-slate-400 tracking-tighter">
                        at {new Date(admin.planActivatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="p-5 text-sm font-medium text-slate-500 italic">
                      {new Date(admin.planExpiresAt).toLocaleDateString()} <br/>
                      <span className="text-[10px] uppercase text-slate-400 tracking-tighter font-bold">
                        at {new Date(admin.planExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="p-5 text-right">
                      {isExpired ? (
                        <span className="inline-block bg-rose-600 text-white text-[10px] font-black px-3 py-1 rounded-md shadow-sm uppercase">Renewal Overdue</span>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 font-mono font-bold">
                           <div className="flex flex-col items-center">
                              <span className="text-blue-700 text-lg">{time.days}d</span>
                           </div>
                           <span className="text-slate-300">:</span>
                           <div className="flex flex-col items-center">
                              <span className="text-blue-600 text-lg">{String(time.hours).padStart(2, '0')}h</span>
                           </div>
                           <span className="text-slate-300">:</span>
                           <div className="flex flex-col items-center">
                              <span className="text-blue-500 text-lg">{String(time.minutes).padStart(2, '0')}m</span>
                           </div>
                           <span className="text-slate-300">:</span>
                           <div className="flex flex-col items-center">
                              <span className="text-indigo-500 text-lg animate-pulse">{String(time.seconds).padStart(2, '0')}s</span>
                           </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {admins.length === 0 && (
          <div className="p-20 text-center">
            <p className="text-slate-400 font-medium italic">No company records found in the system.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMonitoring;