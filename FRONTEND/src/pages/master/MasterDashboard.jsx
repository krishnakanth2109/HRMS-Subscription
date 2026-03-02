// AdminDashboard.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  const [admins, setAdmins] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live time update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [adminsRes, plansRes] = await Promise.all([
        api.get("/api/admin/login-access"),
        api.get("/api/admin/all-plans")
      ]);
      setAdmins(adminsRes.data);
      setPlans(plansRes.data);
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
    
    return { total, active, expired, blocked, totalStaff, activeStaff, totalRevenue };
  }, [admins, plans]);

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
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-gray-800"> Dashboard Overview</h1>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleString('en-IN', { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Companies */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Total</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-800">{stats.total}</h3>
          <p className="text-sm text-gray-500 mt-1">Companies Registered</p>
        </div>

        {/* Active Plans */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">{stats.active} Active</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-800">{stats.active}</h3>
          <p className="text-sm text-gray-500 mt-1">Companies with Active Plans</p>
        </div>

        {/* Staff Summary */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
              </svg>
            </div>
            <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full">{stats.activeStaff}/{stats.totalStaff}</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-800">{stats.activeStaff}</h3>
          <p className="text-sm text-gray-500 mt-1">Active Staff Members</p>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Total</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-800">₹{stats.totalRevenue.toLocaleString()}</h3>
          <p className="text-sm text-gray-500 mt-1">Total Plan Value</p>
        </div>
      </div>

      {/* Second Row Stats */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Expired Plans */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-lg">
              <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Expired Plans</p>
              <p className="text-xl font-bold text-gray-800">{stats.expired}</p>
            </div>
          </div>
        </div>

        {/* Blocked Access */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path>
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Blocked Access</p>
              <p className="text-xl font-bold text-gray-800">{stats.blocked}</p>
            </div>
          </div>
        </div>

        {/* Plans Available */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Available Plans</p>
              <p className="text-xl font-bold text-gray-800">{plans.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Companies List */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-700">Companies Overview</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {admins.slice(0, 5).map(admin => {
              const expired = isPlanExpired(admin.planExpiresAt);
              const daysLeft = getDaysRemaining(admin.planExpiresAt);
              
              return (
                <div key={admin.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                        expired ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {admin.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-800">{admin.name}</h3>
                        <p className="text-xs text-gray-500">{admin.email}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      expired ? 'bg-rose-50 text-rose-600' : 
                      admin.loginEnabled === false ? 'bg-gray-100 text-gray-600' : 
                      'bg-emerald-50 text-emerald-600'
                    }`}>
                      {expired ? 'Expired' : admin.loginEnabled === false ? 'Blocked' : 'Active'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3 text-xs">
                    <div>
                      <p className="text-gray-400">Plan</p>
                      <p className="font-medium text-gray-700">{admin.plan || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Expires</p>
                      <p className={`font-medium ${expired ? 'text-rose-600' : 'text-gray-700'}`}>
                        {formatDate(admin.planExpiresAt)}
                        {!expired && daysLeft <= 7 && ` (${daysLeft}d left)`}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Staff</p>
                      <p className="font-medium text-gray-700">{admin.totalEmployees - (admin.disabledEmployees || 0)}/{admin.totalEmployees}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {admins.length > 5 && (
              <div className="px-6 py-3 text-center text-sm text-blue-600 hover:bg-blue-50 cursor-pointer">
                View all {admins.length} companies →
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Violations Alert */}
          {violations.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-rose-100 overflow-hidden">
              <div className="px-6 py-4 bg-rose-50 border-b border-rose-100">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                  <h3 className="font-semibold text-rose-700">Violations Detected</h3>
                  <span className="ml-auto bg-rose-200 text-rose-800 text-xs px-2 py-1 rounded-full">
                    {violations.length}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-rose-50">
                {violations.slice(0, 3).map(v => (
                  <div key={v.id} className="px-6 py-3">
                    <p className="text-sm font-medium text-gray-800">{v.name}</p>
                    <p className="text-xs text-rose-600 mt-1">
                      {v.totalEmployees - v.disabledEmployees} staff active on expired plan
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expiring Soon */}
          <div className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden">
            <div className="px-6 py-4 bg-amber-50 border-b border-amber-100">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h3 className="font-semibold text-amber-700">Expiring Soon</h3>
              </div>
            </div>
            <div className="divide-y divide-amber-50">
              {expiringSoon.length > 0 ? expiringSoon.map(admin => {
                const daysLeft = getDaysRemaining(admin.planExpiresAt);
                return (
                  <div key={admin.id} className="px-6 py-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{admin.name}</p>
                      <p className="text-xs text-gray-500">{admin.plan}</p>
                    </div>
                    <span className="text-sm font-bold text-amber-600">{daysLeft} days</span>
                  </div>
                );
              }) : (
                <div className="px-6 py-4 text-sm text-gray-500 text-center">
                  No plans expiring soon
                </div>
              )}
            </div>
          </div>

          {/* Plans Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
              <h3 className="font-semibold text-gray-700">Available Plans</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {plans.slice(0, 4).map(plan => (
                <div key={plan._id} className="px-6 py-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{plan.planName}</p>
                    <p className="text-xs text-gray-500">{plan.durationDays} days</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900">₹{plan.price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm text-gray-500">
          <div>
            <p className="font-medium text-gray-800">{plans.length}</p>
            <p>Total Plans</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">{stats.totalStaff}</p>
            <p>Total Staff</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">{admins.filter(a => a.totalEmployees > 0).length}</p>
            <p>Companies with Staff</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">{Math.round((stats.active / stats.total) * 100) || 0}%</p>
            <p>Active Rate</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;