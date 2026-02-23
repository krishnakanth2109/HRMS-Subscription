import React, { useState, useEffect, useCallback } from "react";
import api from "../../api"; // Import the configured axios instance
import {
  FaRocket, FaUsers, FaClock, FaExclamationTriangle,
  FaPlus, FaTrash, FaEdit, FaSync, FaShieldAlt,
  FaChartLine, FaCheckCircle, FaCalendarAlt
} from "react-icons/fa";

const SuperAdminDashboard = () => {
  // --- STATE ---
  const [admins, setAdmins] = useState([]);
  const [plans, setPlans] = useState([]);
  const [activeTab, setActiveTab] = useState("monitor"); // monitor | plans
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Form State for Plans
  const [planForm, setPlanForm] = useState({
    planName: "",
    price: 0,
    durationDays: 30,
    features: [""]
  });
  const [status, setStatus] = useState({ type: "", message: "" });

  // --- REAL-TIME CLOCK ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- DATA FETCHING ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [adminsRes, plansRes] = await Promise.all([
        api.get("/api/admin/all-admins"),
        api.get("/api/admin/all-plans")
      ]);
      setAdmins(adminsRes.data);
      setPlans(plansRes.data);
    } catch (err) {
      console.error("Dashboard Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- COUNTDOWN LOGIC ---
  const getTimeRemaining = (expiryDate) => {
    const total = Date.parse(expiryDate) - Date.parse(currentTime);
    if (total <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      total,
      days: Math.floor(total / (1000 * 60 * 60 * 24)),
      hours: Math.floor((total / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((total / 1000 / 60) % 60),
      seconds: Math.floor((total / 1000) % 60),
    };
  };

  // --- PLAN ACTIONS ---
  const handleFeatureChange = (index, value) => {
    const newFeatures = [...planForm.features];
    newFeatures[index] = value;
    setPlanForm({ ...planForm, features: newFeatures });
  };

  const addFeatureField = () => setPlanForm({ ...planForm, features: [...planForm.features, ""] });

  const removeFeatureField = (index) => {
    if (planForm.features.length > 1) {
      setPlanForm({ ...planForm, features: planForm.features.filter((_, i) => i !== index) });
    }
  };

  const savePlan = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanedFeatures = planForm.features.filter(f => f.trim() !== "");
      await api.patch("/api/admin/plan-settings", { ...planForm, features: cleanedFeatures });
      setStatus({ type: "success", message: "Plan Configuration Saved!" });
      setPlanForm({ planName: "", price: 0, durationDays: 30, features: [""] });
      fetchData();
      setTimeout(() => setStatus({ type: "", message: "" }), 3000);
    } catch (err) {
      setStatus({ type: "error", message: "Failed to save plan" });
    } finally {
      setLoading(false);
    }
  };

  const deletePlan = async (id) => {
    if (!window.confirm("Delete this plan?")) return;
    try {
      await api.delete(`/api/admin/delete-plan/${id}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleEditPlan = (plan) => {
    setPlanForm({
      planName: plan.planName,
      price: plan.price,
      durationDays: plan.durationDays,
      features: plan.features.length > 0 ? plan.features : [""]
    });
    setActiveTab("plans");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- STATS ---
  const stats = {
    total: admins.length,
    active: admins.filter(a => new Date(a.planExpiresAt) > currentTime).length,
    expired: admins.length - admins.filter(a => new Date(a.planExpiresAt) > currentTime).length,
    plans: plans.length
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">


      {/* STATS HEADER */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-8 grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Total Companies", val: stats.total, icon: <FaUsers />, color: "text-blue-600", bg: "bg-blue-100" },
          { label: "Active Nodes", val: stats.active, icon: <FaRocket />, color: "text-emerald-600", bg: "bg-emerald-100" },
          { label: "Expired Access", val: stats.expired, icon: <FaExclamationTriangle />, color: "text-rose-600", bg: "bg-rose-100" },
          { label: "Total Plans", val: stats.plans, icon: <FaChartLine />, color: "text-indigo-600", bg: "bg-indigo-100" },
        ].map((s, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5">
            <div className={`${s.bg} ${s.color} w-14 h-14 rounded-2xl flex items-center justify-center text-2xl`}>{s.icon}</div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
              <h3 className="text-3xl font-black text-slate-800">{s.val}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* TAB SWITCHER */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 mb-8">
        <div className="bg-slate-200/50 p-1.5 rounded-2xl w-fit flex gap-1">
          <button
            onClick={() => setActiveTab("monitor")}
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === "monitor" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Real-time Monitoring
          </button>
          <button
            onClick={() => setActiveTab("plans")}
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === "plans" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Plan Architecture
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 lg:px-8">
        {activeTab === "monitor" ? (
          /* MONITORING TABLE */
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Global Company Status</h3>
              <span className="text-[10px] bg-indigo-100 text-indigo-600 font-black px-3 py-1 rounded-full uppercase">Live Feed</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest font-black text-slate-400 border-b border-slate-100">
                    <th className="p-6">Company / Admin</th>
                    <th className="p-6">Subscription</th>
                    <th className="p-6">Expiration Date</th>
                    <th className="p-6 text-right">Time Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {admins.map((admin) => {
                    const time = getTimeRemaining(admin.planExpiresAt);
                    const expired = time.total <= 0;
                    return (
                      <tr key={admin._id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 uppercase">
                              {admin.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{admin.name}</p>
                              <p className="text-xs text-slate-400 font-medium">{admin.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${expired ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"}`}>
                            {admin.plan} • {expired ? "EXPIRED" : "ACTIVE"}
                          </span>
                        </td>
                        <td className="p-6 font-medium text-slate-600">
                          <div className="flex items-center gap-2 text-sm">
                            <FaCalendarAlt className="text-slate-300" />
                            {new Date(admin.planExpiresAt).toLocaleDateString()}
                          </div>
                          <p className="text-[10px] text-slate-400 ml-6 uppercase font-bold">at {new Date(admin.planExpiresAt).toLocaleTimeString()}</p>
                        </td>
                        <td className="p-6 text-right">
                          {expired ? (
                            <span className="text-rose-500 text-xs font-black uppercase tracking-widest border border-rose-200 px-4 py-2 rounded-xl bg-rose-50">Renewal Required</span>
                          ) : (
                            <div className="inline-flex gap-2 font-mono text-indigo-600 font-bold bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 shadow-inner">
                              <span>{time.days}d</span>
                              <span className="text-slate-300">:</span>
                              <span>{String(time.hours).padStart(2, '0')}h</span>
                              <span className="text-slate-300">:</span>
                              <span>{String(time.minutes).padStart(2, '0')}m</span>
                              <span className="text-slate-300">:</span>
                              <span className="text-indigo-400">{String(time.seconds).padStart(2, '0')}s</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {admins.length === 0 && <div className="p-20 text-center text-slate-400 italic">No companies connected to the network.</div>}
            </div>
          </div>
        ) : (
          /* PLAN ARCHITECTURE */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">


            {/* PLAN CARDS */}
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map(plan => (
                <div key={plan._id} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-md hover:shadow-xl hover:border-indigo-200 transition-all group flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h4 className="text-2xl font-black text-slate-800 capitalize tracking-tight">{plan.planName}</h4>
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">{plan.durationDays} Days Duration</span>
                      </div>
                
                    </div>

                    <div className="mb-8">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 ml-1">Price Point</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-slate-900">₹{plan.price}</span>
                        <span className="text-xs font-bold text-slate-400 uppercase">/ Full Period</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Included in Architecture:</p>
                      {plan.features.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm text-slate-600 font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <FaCheckCircle className="text-emerald-500 flex-shrink-0" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SuperAdminDashboard;