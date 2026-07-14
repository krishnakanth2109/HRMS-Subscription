import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { 
  Search, 
  Filter, 
  Calendar, 
  Mail, 
  Clock, 
  Activity, 
  Sparkles, 
  ShieldAlert, 
  User, 
  ArrowRight,
  Database,
  RefreshCw,
  Crown,
  Users
} from "lucide-react";

const Customize = () => {
  const navigate = useNavigate();
  const [admins, setAdmins] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for the live countdown
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch all admins and plans
  const fetchData = async () => {
    try {
      setLoading(true);
      const [adminsRes, plansRes] = await Promise.all([
        api.get("/api/admin/all-admins"),
        api.get("/api/admin/all-plans").catch(() => ({ data: [] }))
      ]);
      setAdmins(adminsRes.data);
      setPlans(plansRes.data || []);
      setError(null);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to fetch dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper: Get Time Remaining
  const getTimeRemaining = (expiryDate) => {
    if (!expiryDate) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
    const total = Date.parse(expiryDate) - Date.parse(currentTime);
    if (total <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };

    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));

    return { total, days, hours, minutes, seconds };
  };

  // Filtered admins
  const filteredAdmins = admins.filter((admin) => {
    const matchesSearch = 
      admin.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      admin.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      admin.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const isExpired = admin.planExpiresAt ? new Date(admin.planExpiresAt) <= currentTime : true;
    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "active" && !isExpired) ||
      (statusFilter === "expired" && isExpired);

    const matchesPlan = 
      planFilter === "all" || 
      admin.plan?.toLowerCase() === planFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesPlan;
  });

  // Calculate statistics
  const totalSubscribers = admins.length;
  const activeSubs = admins.filter((a) => a.planExpiresAt && new Date(a.planExpiresAt) > currentTime).length;
  const premiumSubs = admins.filter((a) => a.plan?.toLowerCase() === "premium").length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-slate-600 font-semibold">Loading Subscribers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Subscribers */}
        <div className="bg-gradient-to-tr from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-xl border border-slate-700 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
          <div className="absolute right-4 top-4 bg-white/10 p-3 rounded-xl backdrop-blur-md">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
          <p className="text-slate-400 text-sm font-semibold tracking-wider uppercase">Total Enrolled</p>
          <h3 className="text-4xl font-extrabold mt-3 tracking-tight">{totalSubscribers}</h3>
          <p className="text-xs text-slate-400 mt-2">Active & registered admins</p>
        </div>

        {/* Active Subscriptions */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
          <div className="absolute right-4 top-4 bg-emerald-50 p-3 rounded-xl">
            <Activity className="w-6 h-6 text-emerald-600 animate-pulse" />
          </div>
          <p className="text-slate-500 text-sm font-semibold tracking-wider uppercase">Active Subscriptions</p>
          <h3 className="text-4xl font-extrabold text-slate-800 mt-3 tracking-tight">{activeSubs}</h3>
          <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping"></span>
            Currently live and operational
          </p>
        </div>

        {/* Premium Plan Subscribers */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
          <div className="absolute right-4 top-4 bg-amber-50 p-3 rounded-xl">
            <Crown className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-slate-500 text-sm font-semibold tracking-wider uppercase">Premium Subscribers</p>
          <h3 className="text-4xl font-extrabold text-slate-800 mt-3 tracking-tight">{premiumSubs}</h3>
          <p className="text-xs text-amber-600 font-medium mt-2">Elite tier subscription accounts</p>
        </div>
      </div>

      {/* Filter and Search Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </span>
          <input
            type="text"
            placeholder="Search by company name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {/* Plan Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl w-full md:w-auto">
            <Crown className="w-4 h-4 text-slate-500" />
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer w-full md:w-auto"
            >
              <option value="all">All Plans</option>
              {plans.map((plan) => (
                <option key={plan._id || plan.id || plan.planName} value={plan.planName.toLowerCase()}>
                  {plan.planName}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer w-full md:w-auto"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Plans</option>
              <option value="expired">Expired Plans</option>
            </select>
          </div>

          {/* Sync Button */}
          <button
            onClick={fetchData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all w-full md:w-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-semibold flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-500 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAdmins.map((admin) => {
          const time = getTimeRemaining(admin.planExpiresAt);
          const isExpired = admin.planExpiresAt ? new Date(admin.planExpiresAt) <= currentTime : true;

          // Card color schemes based on plan
          const isPremium = admin.plan?.toLowerCase() === "premium";
          const isOwner = admin.plan?.toLowerCase() === "owner";

          let borderStyle = "border-slate-200 hover:border-slate-300";
          let badgeStyle = "bg-slate-100 text-slate-700";
          let headerBg = "bg-slate-50";

          if (isPremium) {
            borderStyle = "border-amber-200 hover:border-amber-300 bg-amber-50/10";
            badgeStyle = "bg-amber-100 text-amber-700 font-extrabold border border-amber-200";
            headerBg = "bg-amber-50/20";
          } else if (isOwner) {
            borderStyle = "border-purple-200 hover:border-purple-300 bg-purple-50/10";
            badgeStyle = "bg-purple-100 text-purple-700 font-extrabold border border-purple-200";
            headerBg = "bg-purple-50/20";
          }

          return (
            <div
              key={admin._id || admin.id}
              onClick={() => navigate(`/master/customizing-admin/${admin._id || admin.id}`, { state: { admin } })}
              className={`bg-white rounded-2xl border ${borderStyle} shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 flex flex-col justify-between overflow-hidden group`}
            >
              {/* Card Header */}
              <div className={`p-6 border-b border-slate-100 ${headerBg} transition-colors duration-300`}>
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-inner ${
                      isPremium ? "bg-amber-100 text-amber-800" : isOwner ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                    }`}>
                      {admin.companyName ? admin.companyName.charAt(0).toUpperCase() : admin.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors text-base truncate max-w-[150px]">
                        {admin.companyName || admin.name}
                      </h4>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-1 ${badgeStyle}`}>
                        {admin.plan} Plan
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isExpired ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-full border border-rose-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                        Expired
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Active
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 space-y-4 flex-1">
                {/* Email */}
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Mail className="w-4.5 h-4.5 text-slate-400" />
                  <span className="text-sm font-medium truncate" title={admin.email}>
                    {admin.email}
                  </span>
                </div>

                {/* User Limit Info */}
                <div className="flex items-center gap-2.5 text-slate-600">
                  <User className="w-4.5 h-4.5 text-slate-400" />
                  <span className="text-sm font-medium">
                    Seat Capacity: <strong className="text-slate-800">
                      {admin.plan?.toLowerCase().includes("owner") ? "Unlimited" : `${admin.userLimit || "30"} users`}
                    </strong>
                  </span>
                </div>

                {/* Dates */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Activated
                    </span>
                    <span className="font-semibold text-slate-600">
                      {admin.planActivatedAt ? new Date(admin.planActivatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Expiration
                    </span>
                    <span className="font-semibold text-slate-600">
                      {admin.planExpiresAt ? new Date(admin.planExpiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer - Countdown (if active) */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Time Left:</span>
                {isExpired ? (
                  <span className="text-xs font-bold text-rose-600 uppercase">Renewal Required</span>
                ) : (
                  <div className="flex items-center gap-1 font-mono text-xs font-bold">
                    <span className="text-slate-800 bg-slate-200/60 px-1.5 py-0.5 rounded">{time.days}d</span>
                    <span className="text-slate-400">:</span>
                    <span className="text-slate-800 bg-slate-200/60 px-1.5 py-0.5 rounded">{String(time.hours).padStart(2, "0")}h</span>
                    <span className="text-slate-400">:</span>
                    <span className="text-slate-800 bg-slate-200/60 px-1.5 py-0.5 rounded">{String(time.minutes).padStart(2, "0")}m</span>
                    <span className="text-slate-400">:</span>
                    <span className="text-slate-800 bg-slate-200/60 px-1.5 py-0.5 rounded animate-pulse">{String(time.seconds).padStart(2, "0")}s</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredAdmins.length === 0 && (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200 text-center">
          <Database className="w-12 h-12 text-slate-300 mb-3" />
          <h4 className="text-lg font-bold text-slate-700">No Subscriber Records Found</h4>
          <p className="text-slate-400 max-w-sm mt-1 text-sm">
            Try adjusting your search query, selecting different plan filters, or syncing the database again.
          </p>
        </div>
      )}
    </div>
  );
};

export default Customize;
