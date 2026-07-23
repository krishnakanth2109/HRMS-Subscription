// AdminDashboard.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";

/* ──────────────────────────────────────────────
   HELPER FUNCTIONS
────────────────────────────────────────────── */
const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const isPlanExpired = (expiresAt) =>
  expiresAt ? new Date() > new Date(expiresAt) : false;

const getDaysRemaining = (expiryDate) => {
  if (!expiryDate) return 0;
  const diffTime = new Date(expiryDate) - new Date();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};



/* ──────────────────────────────────────────────
   MAIN DASHBOARD
────────────────────────────────────────────── */
const AdminDashboard = () => {
  const navigate = useNavigate();
  const revenueRef = useRef(null);
  const [admins, setAdmins] = useState([]);
  const [plans, setPlans] = useState([]);
  const [masterStats, setMasterStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [range, setRange] = useState("6M");
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Live time update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [adminsRes, plansRes, masterRes] = await Promise.all([
        api.get("/api/admin/login-access"),
        api.get("/api/admin/all-plans"),
        api.get("/api/master/admins")
      ]);
      setAdmins(adminsRes.data);
      setPlans(plansRes.data);
      setMasterStats(masterRes.data?.stats || null);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Stats Calculations
  const stats = useMemo(() => {
    const total = admins.length;
    const active = admins.filter(a => a.loginEnabled !== false && !isPlanExpired(a.planExpiresAt)).length;
    const expired = admins.filter(a => isPlanExpired(a.planExpiresAt)).length;
    const blocked = admins.filter(a => a.loginEnabled === false).length;
    const totalStaff = admins.reduce((sum, a) => sum + (a.totalEmployees || 0), 0);
    const activeStaff = admins.reduce((sum, a) => sum + (a.totalEmployees - (a.disabledEmployees || 0)), 0);
    const totalRevenue = plans.reduce((sum, plan) => sum + (plan.price || 0), 0);
    const generatedRevenue = masterStats?.totalRevenueGenerated ?? admins.reduce((sum, admin) => sum + (admin.billPaid || 0), 0);

    return { total, active, expired, blocked, totalStaff, activeStaff, totalRevenue, generatedRevenue };
  }, [admins, plans, masterStats]);

  const violations = useMemo(() => {
    return admins.filter(a =>
      isPlanExpired(a.planExpiresAt) &&
      a.disabledEmployees < a.totalEmployees &&
      a.totalEmployees > 0
    );
  }, [admins]);

  const expiringSoon = useMemo(() => {
    return admins
      .filter(a => {
        const daysLeft = getDaysRemaining(a.planExpiresAt);
        return daysLeft > 0 && daysLeft <= 7;
      })
      .sort((a, b) => getDaysRemaining(a.planExpiresAt) - getDaysRemaining(b.planExpiresAt))
      .slice(0, 5);
  }, [admins]);

  const targetYearAndMonth = useMemo(() => {
    let year = new Date().getFullYear();
    let month = new Date().getMonth();
    
    const dates = admins.map(a => a.lastPaymentAt ? new Date(a.lastPaymentAt) : null).filter(Boolean);
    if (dates.length > 0) {
      const latestDate = new Date(Math.max(...dates.map(d => d.getTime())));
      year = latestDate.getFullYear();
      month = latestDate.getMonth();
    }
    return { year, month };
  }, [admins]);

  // Monthly revenue trends logic (converting values safely to numbers)
  const monthlyRevenue = useMemo(() => {
    const months = Array(12).fill(0);
    const { year } = targetYearAndMonth;
    
    admins.forEach(admin => {
      if (admin.lastPaymentAt) {
        const d = new Date(admin.lastPaymentAt);
        if (d.getFullYear() === year) {
          const m = d.getMonth();
          const amount = Number(admin.billPaid) || 0;
          months[m] += amount;
        }
      }
    });
    return months;
  }, [admins, targetYearAndMonth]);

  // Calculate dynamic summary & growth based on range
  const summary = useMemo(() => {
    const { month } = targetYearAndMonth;
    let total = 0;
    let prevTotal = 0;

    if (range === "1M") {
      total = monthlyRevenue[month] || 0;
      prevTotal = monthlyRevenue[(month - 1 + 12) % 12] || 0;
    } else if (range === "3M") {
      for (let i = 0; i < 3; i++) {
        total += monthlyRevenue[(month - i + 12) % 12] || 0;
        prevTotal += monthlyRevenue[(month - 3 - i + 12) % 12] || 0;
      }
    } else if (range === "1Y") {
      for (let i = 0; i < 12; i++) {
        total += monthlyRevenue[i] || 0;
      }
      prevTotal = total * 0.85; // 15% growth fallback representation
    } else {
      // 6M
      for (let i = 0; i < 6; i++) {
        total += monthlyRevenue[(month - i + 12) % 12] || 0;
        prevTotal += monthlyRevenue[(month - 6 - i + 12) % 12] || 0;
      }
    }

    let growth = 0;
    if (prevTotal > 0) {
      growth = ((total - prevTotal) / prevTotal) * 100;
    } else if (total > 0) {
      growth = 100;
    }

    return {
      total,
      prevTotal,
      growth: growth.toFixed(1),
      isPositive: growth >= 0
    };
  }, [range, monthlyRevenue, targetYearAndMonth]);

  // Last N months/weeks based on range
  const chartMonths = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const { year, month } = targetYearAndMonth;
    const list = [];

    if (range === "1M") {
      const weeks = Array(4).fill(0);
      admins.forEach(admin => {
        if (admin.lastPaymentAt) {
          const d = new Date(admin.lastPaymentAt);
          if (d.getFullYear() === year && d.getMonth() === month) {
            const day = d.getDate();
            const w = Math.min(Math.floor((day - 1) / 7), 3);
            weeks[w] += Number(admin.billPaid) || 0;
          }
        }
      });
      return weeks.map((val, idx) => ({ name: `Wk ${idx + 1}`, value: val }));
    }

    const count = range === "3M" ? 3 : range === "1Y" ? 12 : 6;
    for (let i = count - 1; i >= 0; i--) {
      const idx = (month - i + 12) % 12;
      list.push({
        name: monthNames[idx],
        value: monthlyRevenue[idx] || 0
      });
    }
    return list;
  }, [range, monthlyRevenue, admins, targetYearAndMonth]);

  // Dynamic Y-axis scale and grid tick marks calculation for Bar Chart
  const { maxScale, ticks } = useMemo(() => {
    const maxVal = Math.max(...chartMonths.map(m => m.value), 0);
    if (maxVal <= 0) {
      return { maxScale: 2000, ticks: [2000, 1600, 1200, 800, 400, 0] };
    }
    let targetMax = maxVal * 1.15;
    if (targetMax <= 100) targetMax = 100;
    else if (targetMax <= 500) targetMax = 500;
    else if (targetMax <= 1000) targetMax = 1000;
    else if (targetMax <= 2000) targetMax = 2000;
    else if (targetMax <= 5000) targetMax = 5000;
    else if (targetMax <= 10000) targetMax = 10000;
    else {
      const pow = Math.pow(10, Math.floor(Math.log10(targetMax)));
      targetMax = Math.ceil(targetMax / pow) * pow;
    }
    const step = targetMax / 5;
    const ticksList = [
      targetMax,
      targetMax - step,
      targetMax - 2 * step,
      targetMax - 3 * step,
      targetMax - 4 * step,
      0
    ];
    return { maxScale: targetMax, ticks: ticksList };
  }, [chartMonths]);

  // Range description text
  const rangeText = useMemo(() => {
    switch (range) {
      case "1M":
        return "This Month";
      case "3M":
        return "Last 3 Months";
      case "1Y":
        return "Last 1 Year";
      case "6M":
      default:
        return "Last 6 Months";
    }
  }, [range]);

  const prevPeriodLabel = useMemo(() => {
    switch (range) {
      case "1M":
        return "vs Previous Month";
      case "3M":
        return "vs Previous 3 Months";
      case "1Y":
        return "vs Previous Year";
      case "6M":
      default:
        return "vs Previous 6 Months";
    }
  }, [range]);

  const avgPeriodLabel = useMemo(() => {
    return range === "1M" ? "Average Weekly Revenue" : "Average Monthly Revenue";
  }, [range]);

  // Calculate percentages for progress bars safely
  const activePct = stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(1) : "0.0";
  const expiringPct = stats.total > 0 ? ((expiringSoon.length / stats.total) * 100).toFixed(1) : "0.0";
  const expiredPct = stats.total > 0 ? ((stats.expired / stats.total) * 100).toFixed(1) : "0.0";
  const blockedPct = stats.total > 0 ? ((stats.blocked / stats.total) * 100).toFixed(1) : "0.0";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-[fadeIn_0.4s_ease-out] space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time status of platform subscribers and revenue metrics.</p>
        </div>
        <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white border border-slate-100 rounded-xl shadow-sm text-slate-600 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>
            {currentTime.toLocaleString('en-IN', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}
          </span>
        </div>
      </div>

      {/* Stats Grid - 5 Premium Tinted Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        {/* Total Companies */}
        <div 
          onClick={() => navigate("/master/admins")}
          className="bg-blue-50/40 rounded-2xl p-5 shadow-[0_2px_8px_rgba(37,99,235,0.02)] border border-blue-100 hover:shadow-md hover:border-blue-200/80 cursor-pointer hover:-translate-y-1 transition-all duration-305 group relative"
        >
          {/* ArrowUpRight icon */}
          <div className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
              </svg>
            </div>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-100/50 px-2 py-1 rounded-lg uppercase tracking-wider mr-4">Total</span>
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">{stats.total}</h3>
          <p className="text-xs font-semibold text-slate-400 mt-1.5">Registered Companies</p>
          
          <div className="mt-4 space-y-1">
            <div className="w-full bg-blue-100/80 rounded-full h-1 overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full transition-all duration-1000" style={{ width: "100%" }}></div>
            </div>
            <p className="text-[9px] font-bold text-slate-400">
              {stats.total} of {stats.total} Companies • 100%
            </p>
          </div>
        </div>

        {/* Active Plans */}
        <div 
          onClick={() => navigate("/master/admins", { state: { status: "active" } })}
          className="bg-emerald-50/40 rounded-2xl p-5 shadow-[0_2px_8px_rgba(16,185,129,0.02)] border border-emerald-100 hover:shadow-md hover:border-emerald-200/80 cursor-pointer hover:-translate-y-1 transition-all duration-305 group relative"
        >
          {/* ArrowUpRight icon */}
          <div className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/50 px-2 py-1 rounded-lg uppercase tracking-wider mr-4">Active</span>
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">{stats.active}</h3>
          <p className="text-xs font-semibold text-slate-400 mt-1.5">Active Subscribers</p>

          <div className="mt-4 space-y-1">
            <div className="w-full bg-emerald-100/80 rounded-full h-1 overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full transition-all duration-1000" style={{ width: `${activePct}%` }}></div>
            </div>
            <p className="text-[9px] font-bold text-slate-400">
              {stats.active} of {stats.total} Companies • {activePct}%
            </p>
          </div>
        </div>

        {/* Staff Summary */}
        <div 
          onClick={() => navigate("/master/admins")}
          className="bg-purple-50/40 rounded-2xl p-5 shadow-[0_2px_8px_rgba(139,92,246,0.02)] border border-purple-100 hover:shadow-md hover:border-purple-200/80 cursor-pointer hover:-translate-y-1 transition-all duration-305 group relative"
        >
          {/* ArrowUpRight icon */}
          <div className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
              </svg>
            </div>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-100/50 px-2 py-1 rounded-lg uppercase tracking-wider mr-4">{stats.activeStaff}/{stats.totalStaff}</span>
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">{stats.activeStaff}</h3>
          <p className="text-xs font-semibold text-slate-400 mt-1.5">Active Staff Members</p>
          
          <div className="mt-4 space-y-1">
            <div className="w-full bg-purple-100/80 rounded-full h-1 overflow-hidden">
              <div className="bg-purple-600 h-full rounded-full transition-all duration-1000" style={{ width: stats.totalStaff > 0 ? `${(stats.activeStaff / stats.totalStaff) * 100}%` : "0%" }}></div>
            </div>
            <p className="text-[9px] font-bold text-slate-400">
              {stats.activeStaff} of {stats.totalStaff} Members Active
            </p>
          </div>
        </div>

        {/* Revenue */}
        <div 
          onClick={() => navigate("/master/settings")}
          className="bg-amber-50/40 rounded-2xl p-5 shadow-[0_2px_8px_rgba(245,158,11,0.02)] border border-amber-100 hover:shadow-md hover:border-amber-200/80 cursor-pointer hover:-translate-y-1 transition-all duration-305 group relative"
        >
          {/* ArrowUpRight icon */}
          <div className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100/50 px-2 py-1 rounded-lg uppercase tracking-wider mr-4">Plan Value</span>
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">₹{stats.totalRevenue.toLocaleString("en-IN")}</h3>
          <p className="text-xs font-semibold text-slate-400 mt-1.5">Total Subscription Value</p>
          
          <div className="mt-4 space-y-1">
            <div className="w-full bg-amber-100/80 rounded-full h-1 overflow-hidden">
              <div className="bg-amber-600 h-full rounded-full transition-all duration-1000" style={{ width: "100%" }}></div>
            </div>
            <p className="text-[9px] font-bold text-slate-400">
              Available configurations monitored
            </p>
          </div>
        </div>

        {/* Collected (Restored to exact standard layout) */}
        <div 
          onClick={() => {
            if (revenueRef.current) {
              revenueRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="bg-emerald-50/40 rounded-2xl p-5 shadow-[0_2px_8px_rgba(16,185,129,0.02)] border border-emerald-100 hover:shadow-md hover:border-emerald-200/80 cursor-pointer hover:-translate-y-1 transition-all duration-305 group relative"
        >
          {/* ArrowUpRight icon */}
          <div className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2m4-4H9m12 0l-3-3m3 3l-3 3"></path>
              </svg>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/50 px-2 py-1 rounded-lg uppercase tracking-wider mr-4">Collected</span>
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">₹{Math.round(stats.generatedRevenue).toLocaleString("en-IN")}</h3>
          <p className="text-xs font-semibold text-slate-400 mt-1.5">Total Revenue Collected</p>
          
          <div className="mt-4 space-y-1">
            <div className="w-full bg-emerald-100/80 rounded-full h-1 overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full transition-all duration-1000" style={{ width: "100%" }}></div>
            </div>
            <p className="text-[9px] font-bold text-slate-400">
              Collected platform billing revenue
            </p>
          </div>
        </div>
      </div>

      {/* Second Row Stats - tinted soft cards with progress bars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Expired Plans */}
        <div 
          onClick={() => navigate("/master/admins", { state: { status: "expired" } })}
          className="bg-rose-50/40 rounded-2xl p-5 shadow-[0_2px_8px_rgba(244,63,94,0.02)] border border-rose-100 hover:shadow-md hover:border-rose-200/80 cursor-pointer hover:-translate-y-1 transition-all duration-305 group relative"
        >
          {/* ArrowUpRight icon */}
          <div className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <svg className="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-rose-700 uppercase tracking-wider">Expired Subscriptions</p>
              <p className="text-xl font-extrabold text-slate-900 tracking-tight mt-0.5">{stats.expired}</p>
              
              <div className="mt-3 space-y-1">
                <div className="w-full bg-rose-100 rounded-full h-1 overflow-hidden">
                  <div className="bg-rose-600 h-full rounded-full transition-all duration-1000" style={{ width: `${expiredPct}%` }}></div>
                </div>
                <p className="text-[9px] font-bold text-slate-400">
                  {stats.expired} of {stats.total} Companies • {expiredPct}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Blocked Access */}
        <div 
          onClick={() => navigate("/master/manage-logins", { state: { status: "blocked" } })}
          className="bg-slate-100/50 rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 cursor-pointer hover:-translate-y-1 transition-all duration-305 group relative"
        >
          {/* ArrowUpRight icon */}
          <div className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-200 text-slate-700 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Blocked Access</p>
              <p className="text-xl font-extrabold text-slate-900 tracking-tight mt-0.5">{stats.blocked}</p>

              <div className="mt-3 space-y-1">
                <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                  <div className="bg-slate-600 h-full rounded-full transition-all duration-1000" style={{ width: `${blockedPct}%` }}></div>
                </div>
                <p className="text-[9px] font-bold text-slate-400">
                  {stats.blocked} of {stats.total} Companies • {blockedPct}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Plans Available */}
        <div 
          onClick={() => navigate("/master/settings")}
          className="bg-indigo-50/40 rounded-2xl p-5 shadow-[0_2px_8px_rgba(99,102,241,0.02)] border border-indigo-100 hover:shadow-md hover:border-indigo-200/80 cursor-pointer hover:-translate-y-1 transition-all duration-305 group relative"
        >
          {/* ArrowUpRight icon */}
          <div className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Available Plans</p>
              <p className="text-xl font-extrabold text-slate-900 tracking-tight mt-0.5">{plans.length}</p>
              
              <div className="mt-3">
                <p className="text-[9px] font-bold text-slate-400">
                  Active plan configurations configured
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Analytics Section - Modern Enterprise Dashboard Layout */}
      <div ref={revenueRef} className="space-y-6">
        {/* Header with Title and Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">METRICS CONSOLE</span>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5 tracking-tight">Revenue Analytics</h2>
          </div>
          
          <div className="flex items-center gap-2.5">
            <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-inner">
              {["1M", "3M", "6M", "1Y"].map((period) => (
                <button
                  key={period}
                  onClick={() => setRange(period)}
                  className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    range === period 
                      ? "bg-slate-900 text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
            <div className="relative">
              <select 
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="bg-white border border-slate-200 text-xs font-bold text-slate-700 pl-3.5 pr-8 py-2 rounded-xl outline-none cursor-pointer hover:border-slate-300 transition-colors shadow-sm appearance-none"
              >
                <option value="1M">Last 1 Month (1M)</option>
                <option value="3M">Last 3 Months (3M)</option>
                <option value="6M">Last 6 Months (6M)</option>
                <option value="1Y">Last 1 Year (1Y)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout: Bar Chart (Left ~65-70%) & Doughnut Chart (Right ~30-35%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Side: Vertical Bar Chart */}
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm tracking-tight">
                Revenue Overview ({rangeText})
              </h3>
            </div>

            {/* SVG Bar Chart Area */}
            <div className="pt-2 pb-1 w-full overflow-x-auto">
              <svg className="w-full h-auto min-w-[500px]" viewBox="0 0 700 260" preserveAspectRatio="xMidYMid meet">
                {/* Grid Lines & Y-Axis Labels */}
                {ticks.map((tick, idx) => {
                  const tickY = 35 + (idx / 5) * 180; // 35px to 215px (180px height)
                  return (
                    <g key={idx}>
                      {/* Horizontal Grid Line */}
                      <line
                        x1="80"
                        y1={tickY}
                        x2="685"
                        y2={tickY}
                        stroke="#f1f5f9"
                        strokeWidth="1.5"
                      />
                      {/* Y-Axis Tick Text */}
                      <text
                        x="70"
                        y={tickY + 4}
                        textAnchor="end"
                        className="text-xs font-semibold fill-slate-400 font-sans"
                      >
                        ₹{Math.round(tick).toLocaleString("en-IN")}
                      </text>
                    </g>
                  );
                })}

                {/* Baseline X-Axis Line */}
                <line x1="80" y1="215" x2="685" y2="215" stroke="#e2e8f0" strokeWidth="1.5" />

                {/* Bars & Labels */}
                {chartMonths.map((item, idx) => {
                  const N = chartMonths.length || 1;
                  const plotWidth = 605; // 685 - 80
                  const segWidth = plotWidth / N;
                  const cx = 80 + (idx + 0.5) * segWidth;
                  const bw = Math.min(52, segWidth * 0.55);
                  const barX = cx - bw / 2;

                  const valHeight = maxScale > 0 ? (item.value / maxScale) * 180 : 0;
                  const barH = item.value > 0 ? Math.max(valHeight, 8) : 4;
                  const barY = 215 - barH;
                  const isHovered = hoveredIdx === idx;

                  // Top rounded corner radius
                  const r = Math.min(8, bw / 2, barH / 2);
                  const pathD = `
                    M ${barX} ${barY + r}
                    A ${r} ${r} 0 0 1 ${barX + r} ${barY}
                    H ${barX + bw - r}
                    A ${r} ${r} 0 0 1 ${barX + bw} ${barY + r}
                    V 215
                    H ${barX}
                    Z
                  `;

                  return (
                    <g
                      key={idx}
                      className="group cursor-pointer"
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                    >
                      {/* Bar Path */}
                      <path
                        d={pathD}
                        className={`transition-all duration-300 ${
                          isHovered 
                            ? "fill-blue-700" 
                            : item.value > 0 
                              ? "fill-blue-600" 
                              : "fill-blue-600"
                        }`}
                      />

                      {/* Value Above Bar */}
                      <text
                        x={cx}
                        y={barY - 8}
                        textAnchor="middle"
                        className={`text-xs font-extrabold transition-colors duration-200 ${
                          item.value > 0 ? "fill-blue-600" : "fill-slate-900"
                        }`}
                      >
                        ₹{Math.round(item.value).toLocaleString("en-IN")}
                      </text>

                      {/* X-Axis Month/Week Label */}
                      <text
                        x={cx}
                        y="240"
                        textAnchor="middle"
                        className="text-xs font-bold fill-slate-400 uppercase tracking-wider group-hover:fill-slate-800 transition-colors"
                      >
                        {item.name.toUpperCase()}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Right Side: Doughnut Chart */}
          <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-6">
            <h3 className="font-bold text-slate-800 text-sm tracking-tight">
              Revenue Distribution ({rangeText})
            </h3>

            {/* SVG Doughnut */}
            <div className="relative w-48 h-48 mx-auto flex items-center justify-center my-1">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                {/* Background Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  stroke="#f1f5f9"
                  strokeWidth="18"
                  fill="transparent"
                />
                {/* Primary Segment Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  stroke="#2563eb"
                  strokeWidth="18"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 58}
                  strokeDashoffset={summary.total > 0 ? 0 : 2 * Math.PI * 58}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>

              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 pointer-events-none select-none">
                <span className="text-xs font-bold text-slate-400">Total Revenue</span>
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                  ₹{Math.round(summary.total).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Legend Below Chart */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded bg-blue-600 flex-shrink-0"></span>
                  <span className="font-semibold text-slate-600">Subscription Payments</span>
                </div>
                <span className="font-bold text-slate-900">
                  ₹{Math.round(summary.total).toLocaleString("en-IN")}{" "}
                  <span className="text-slate-400 font-normal">({summary.total > 0 ? "100%" : "0%"})</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded bg-emerald-500 flex-shrink-0"></span>
                  <span className="font-semibold text-slate-600">Plan Upgrades</span>
                </div>
                <span className="font-bold text-slate-900">
                  ₹0 <span className="text-slate-400 font-normal">(0%)</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded bg-amber-500 flex-shrink-0"></span>
                  <span className="font-semibold text-slate-600">Renewals</span>
                </div>
                <span className="font-bold text-slate-900">
                  ₹0 <span className="text-slate-400 font-normal">(0%)</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded bg-purple-600 flex-shrink-0"></span>
                  <span className="font-semibold text-slate-600">Others</span>
                </div>
                <span className="font-bold text-slate-900">
                  ₹0 <span className="text-slate-400 font-normal">(0%)</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards Row Below Both Charts */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {/* Growth Rate */}
            <div className="flex flex-col items-center justify-center text-center p-4">
              <span className="text-xs font-semibold text-slate-500 mb-2.5">Growth Rate</span>
              <div className={`inline-flex items-center gap-1 text-sm font-extrabold px-3.5 py-1.5 rounded-full ${
                summary.isPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}>
                <span>{summary.isPositive ? "↑" : "↓"}</span>
                <span>{Math.abs(summary.growth)}%</span>
              </div>
              <span className="text-xs text-slate-400 font-medium mt-2.5">
                {prevPeriodLabel}
              </span>
            </div>

            {/* Previous Period Revenue */}
            <div className="flex flex-col items-center justify-center text-center p-4">
              <span className="text-xs font-semibold text-slate-500 mb-2">Previous Period Revenue</span>
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                ₹{Math.round(summary.prevTotal).toLocaleString("en-IN")}
              </span>
            </div>

            {/* Average Monthly Revenue */}
            <div className="flex flex-col items-center justify-center text-center p-4">
              <span className="text-xs font-semibold text-slate-500 mb-2">
                {avgPeriodLabel}
              </span>
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                ₹{Math.round(summary.total / (chartMonths.length || 1)).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Companies Overview */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-sm tracking-tight">Companies Overview</h2>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Top subscriber profiles and resource usage</p>
            </div>
            <span className="text-[9px] font-bold text-slate-500 bg-slate-200/60 border border-slate-300/40 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Top 5 Subscribers
            </span>
          </div>

          <div className="divide-y divide-slate-100 bg-white">
            {admins.slice(0, 5).map(admin => {
              const expired = isPlanExpired(admin.planExpiresAt);
              const daysLeft = getDaysRemaining(admin.planExpiresAt);

              return (
                <div key={admin.id} className="p-5 hover:bg-slate-50/50 transition-all duration-300 relative group">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-base shadow-sm border transition-transform duration-300 group-hover:scale-105 ${
                        expired
                          ? 'bg-rose-50 text-rose-600 border-rose-100'
                          : 'bg-blue-50 text-blue-600 border-blue-100'
                      }`}>
                        {admin.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-800 text-sm leading-snug tracking-tight">
                            {admin.name}
                          </h3>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                            expired 
                              ? 'bg-rose-50 text-rose-600 border-rose-100' 
                              : admin.loginEnabled === false 
                                ? 'bg-slate-100 text-slate-500 border-slate-200' 
                                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                            {expired ? 'Expired' : admin.loginEnabled === false ? 'Blocked' : 'Active'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">{admin.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:self-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        {admin.plan || 'No Plan'}
                      </span>
                      
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
                        expired 
                          ? 'bg-rose-50 text-rose-600 border-rose-100' 
                          : daysLeft <= 7 
                            ? 'bg-amber-50 text-amber-600 border-amber-100' 
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {expired ? 'Expired' : `${daysLeft}d left`}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Plan Activated</p>
                      <p className="font-semibold text-slate-700 text-xs mt-0.5">{formatDate(admin.planActivatedAt)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Expires On</p>
                      <p className={`font-semibold text-xs mt-0.5 ${expired ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                        {formatDate(admin.planExpiresAt)}
                      </p>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Staff Allocation</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              (admin.totalEmployees - (admin.disabledEmployees || 0)) / admin.totalEmployees > 0.9 
                                ? 'bg-rose-500' 
                                : 'bg-blue-500'
                            }`} 
                            style={{ width: `${Math.min(100, Math.round(((admin.totalEmployees - (admin.disabledEmployees || 0)) / admin.totalEmployees) * 100))}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-slate-700 text-[10px] whitespace-nowrap">
                          {admin.totalEmployees - (admin.disabledEmployees || 0)}/{admin.totalEmployees}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {admins.length > 5 && (
              <Link to="/master/admins" className="block border-t border-slate-100">
                <div className="px-6 py-4.5 text-center text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50/20 cursor-pointer transition-colors duration-250 uppercase tracking-wider">
                  View all {admins.length} subscriber companies →
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Right Sidebar containing widgets */}
        <div className="space-y-6">
          
          {/* Violations Alert Widget */}
          {violations.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-rose-200/80 overflow-hidden relative">
              <div className="px-6 py-4.5 bg-rose-50/40 border-b border-rose-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                  <h3 className="font-bold text-rose-900 text-sm tracking-tight">Violations Detected</h3>
                </div>
                <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-rose-200">
                  {violations.length} Alert{violations.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="divide-y divide-rose-50 bg-rose-50/10">
                {violations.slice(0, 3).map(v => (
                  <div key={v.id} className="p-5 hover:bg-rose-50/20 transition-all duration-200">
                    <p className="text-xs font-bold text-slate-800 leading-snug">{v.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded">
                        Limit Exceeded
                      </span>
                      <p className="text-[10px] text-slate-500 font-semibold">
                        {v.totalEmployees - v.disabledEmployees} staff active / Plan Expired
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expiring Soon Card Widget */}
          <div className="bg-white rounded-3xl shadow-sm border border-amber-200/80 overflow-hidden">
            <div className="px-6 py-4.5 bg-amber-50/40 border-b border-amber-100">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div className="flex-1">
                  <h3 className="font-bold text-amber-900 text-sm tracking-tight">Expiring Soon</h3>
                  
                  {/* Thin animated progress bar */}
                  <div className="mt-2.5 space-y-1">
                    <div className="w-full bg-amber-100 rounded-full h-1 overflow-hidden">
                      <div className="bg-amber-600 h-full rounded-full transition-all duration-1000" style={{ width: `${expiringPct}%` }}></div>
                    </div>
                    <p className="text-[9px] font-bold text-amber-700">
                      {expiringSoon.length} of {stats.total} Companies • {expiringPct}% expiring
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="divide-y divide-amber-50 bg-amber-50/5">
              {expiringSoon.length > 0 ? expiringSoon.map(admin => {
                const daysLeft = getDaysRemaining(admin.planExpiresAt);
                return (
                  <div key={admin.id} className="p-4 flex justify-between items-center hover:bg-amber-50/20 transition-all duration-200">
                    <div>
                      <p className="text-xs font-bold text-slate-800 leading-snug">{admin.name}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5 uppercase">{admin.plan}</p>
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg">
                      {daysLeft} days left
                    </span>
                  </div>
                )
              }) : (
                <div className="px-6 py-6 text-xs font-bold text-slate-400 text-center">
                  No subscriptions expiring soon
                </div>
              )}
            </div>
          </div>

          {/* Pricing Plans Summary Widget */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-4.5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Available Plans</h3>
              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/40">
                {plans.length} Configured
              </span>
            </div>
            
            <div className="divide-y divide-slate-100 bg-white">
              {plans.slice(0, 4).map(plan => (
                <div key={plan._id} className="p-4.5 flex justify-between items-center hover:bg-slate-50/40 transition-all duration-250 group">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-800 leading-none group-hover:text-blue-600 transition-colors">
                        {plan.planName}
                      </p>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-100 rounded">
                        {plan.durationDays}d
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">Unlimited resource provisioning</p>
                  </div>
                  <span className="text-sm font-extrabold text-slate-900 font-mono">
                    ₹{plan.price.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Footer Stats */}
      <div className="mt-8 pt-6 border-t border-slate-200/80">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <p className="text-lg font-extrabold text-slate-800 tracking-tight">{plans.length}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Plans</p>
          </div>
          <div className="space-y-1 border-l border-slate-100">
            <p className="text-lg font-extrabold text-slate-800 tracking-tight">{stats.totalStaff}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Staff</p>
          </div>
          <div className="space-y-1 border-l border-slate-100">
            <p className="text-lg font-extrabold text-slate-800 tracking-tight">{admins.filter(a => a.totalEmployees > 0).length}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Companies with Staff</p>
          </div>
          <div className="space-y-1 border-l border-slate-100">
            <p className="text-lg font-extrabold text-blue-600 tracking-tight">{Math.round((stats.active / stats.total) * 100) || 0}%</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Plan Active Rate</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
