import React, { useState, useEffect, useRef } from "react";
import api from "../../api";
import { FaTrash, FaEdit, FaCheck, FaChevronDown, FaChevronUp, FaLock } from "react-icons/fa";
import Swal from "sweetalert2";

// ⭐ HARDCODED FALLBACK — includes owner-exclusive routes at the bottom
const FALLBACK_FEATURES = [
  { label: "Dashboard", route: "/admin/dashboard", description: "Main dashboard overview with key metrics" },
  { label: "Employee Management", route: "/employees", description: "Add, edit and manage all employee records" },
  { label: "Employees Attendance", route: "/attendance", description: "View and manage employee attendance logs" },
  { label: "Shift Management", route: "/admin/settings", description: "Configure and assign employee work shifts" },
  { label: "Location Settings", route: "/admin/shifttype", description: "Manage geo-fencing and location-based settings" },
  { label: "Leave Summary", route: "/admin/leave-summary", description: "Analytics and summary of all employee leaves" },
  { label: "Holiday Calendar", route: "/admin/holiday-calendar", description: "Manage public and company holidays" },
  { label: "Payroll", route: "/admin/payroll", description: "Process and manage employee payroll" },
  { label: "Announcements", route: "/admin/notices", description: "Post and manage company-wide announcements" },
  { label: "Leave Requests", route: "/admin/admin-Leavemanage", description: "Review and approve/reject employee leave requests" },
  { label: "Attendance Adjustment", route: "/admin/late-requests", description: "Handle late login and attendance correction requests" },
  { label: "Overtime Requests", route: "/admin/admin-overtime", description: "Review and manage employee overtime requests" },
  { label: "Live Tracking", route: "/admin/live-tracking", description: "Monitor employee idle time in real-time" },



  // ✅ Owner-exclusive features — visible in fallback but only assigned to Owner plan via seed
  { label: "Master Dashboard", route: "/master/dashboard", description: "Owner-only: Platform-wide overview & stats" },
  { label: "Admin Management", route: "/master/admins", description: "Owner-only: View & manage all registered companies" },
  { label: "Plan Management", route: "/master/plans", description: "Owner-only: Create, edit and delete subscription plans" },
  { label: "Login Access Control", route: "/master/login-access", description: "Owner-only: Enable/disable admin & employee logins" },
  { label: "System Settings", route: "/master/settings", description: "Owner-only: Global system configuration" },
  { label: "Billing Overview", route: "/master/billing", description: "Owner-only: Subscriptions & payment overview" },
  { label: "Platform Analytics", route: "/master/analytics", description: "Owner-only: Usage analytics across all tenants" },
];

const DEFAULT_DURATION_DAYS = 30;
const OWNER_PLAN_NAME = "owner";
const DEFAULT_PER_PERSON_PRICE = 49;
const BILLING_CYCLES = [
  { value: "monthly", label: "Monthly Plan", eyebrow: "Billed monthly", durationDays: 30 },
  { value: "quarterly", label: "Quarterly Plan", eyebrow: "Billed every 3 months", durationDays: 90 },
  { value: "halfYearly", label: "Half-Yearly Plan", eyebrow: "Billed every 6 months", durationDays: 180 },
  { value: "yearly", label: "Annual Plan", eyebrow: "Billed annually", durationDays: 365 },
];
const OWNER_FEATURE_ROUTES = new Set([
  "/master/dashboard",
  "/master/admins",
  "/master/plans",
  "/master/login-access",
  "/master/settings",
  "/master/billing",
  "/master/analytics",
]);
const EXCLUDED_FEATURE_ROUTES = new Set(["/admin/users-limit", ...OWNER_FEATURE_ROUTES]);

const getAdminFeatures = (features) =>
  features.filter((feature) => !EXCLUDED_FEATURE_ROUTES.has(feature.route));

const isOwnerPlan = (plan) =>
  plan?.isOwnerPlan || plan?.planName?.trim().toLowerCase() === OWNER_PLAN_NAME;

const getBillingCycle = (plan = {}) =>
  BILLING_CYCLES.find((cycle) => cycle.value === plan.billingCycle) ||
  BILLING_CYCLES.find((cycle) => cycle.durationDays === Number(plan.durationDays)) ||
  BILLING_CYCLES[0];

const PlanSettings = () => {
  const [planName, setPlanName] = useState(BILLING_CYCLES[0].label);
  const [price, setPrice] = useState(DEFAULT_PER_PERSON_PRICE);
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [durationDays, setDurationDays] = useState(DEFAULT_DURATION_DAYS);
  const [maxUsers, setMaxUsers] = useState(30);
  const [selectedFeatures, setSelectedFeatures] = useState([]);

  const [loading, setLoading] = useState(false);
  const [existingPlans, setExistingPlans] = useState([]);

  const [allFeatures, setAllFeatures] = useState(getAdminFeatures(FALLBACK_FEATURES));
  const [featuresLoading, setFeaturesLoading] = useState(true);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [expandedPlans, setExpandedPlans] = useState({});

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchAllFeatures = async () => {
    try {
      setFeaturesLoading(true);
      const res = await api.get("/api/admin/all-features");
      if (res.data && res.data.length > 0) {
        const filtered = getAdminFeatures(res.data);
        setAllFeatures(filtered);
      } else {
        setAllFeatures(getAdminFeatures(FALLBACK_FEATURES));
      }
    } catch {
      setAllFeatures(getAdminFeatures(FALLBACK_FEATURES));
    } finally {
      setFeaturesLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await api.get("/api/admin/all-plans");
      setExistingPlans((res.data || []).filter((plan) => !isOwnerPlan(plan)));
    } catch {
      console.log("Could not fetch plans");
    }
  };

  useEffect(() => {
    fetchAllFeatures();
    fetchPlans();
  }, []);

  const toggleFeature = (route) => {
    setSelectedFeatures((prev) =>
      prev.includes(route) ? prev.filter((r) => r !== route) : [...prev, route]
    );
  };

  const handleBillingCycleChange = (value) => {
    const cycle = BILLING_CYCLES.find((item) => item.value === value) || BILLING_CYCLES[0];
    setBillingCycle(cycle.value);
    setDurationDays(cycle.durationDays);
    setPlanName(cycle.label);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    if (!planName) {
      return Swal.fire({ icon: "error", title: "Oops...", text: "Plan name is required!" });
    }

    // ✅ Prevent editing the protected Owner plan via the form
    if (planName.trim().toLowerCase() === OWNER_PLAN_NAME) {
      return Swal.fire({
        icon: "warning",
        title: "Protected Plan",
        text: "The Owner plan is protected and cannot be modified from the UI.",
      });
    }

    setLoading(true);

    try {
      const includedFeatures = allFeatures.map((feature) => feature.route);

      await api.patch("/api/admin/plan-settings", {
        planName,
        price: Number(price),
        billingCycle,
        durationDays,
        maxUsers: null,
        features: includedFeatures,
      });

      Swal.fire({
        icon: "success",
        title: "Saved Successfully!",
        text: `Plan "${planName}" has been updated.`,
        timer: 2000,
        showConfirmButton: false,
      });

      setPlanName(BILLING_CYCLES[0].label);
      setPrice(DEFAULT_PER_PERSON_PRICE);
      setBillingCycle("monthly");
      setDurationDays(DEFAULT_DURATION_DAYS);
      setMaxUsers(30);
      setSelectedFeatures([]);
      setIsDropdownOpen(false);
      fetchPlans();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: error.response?.data?.message || "Failed to update settings",
      });
    } finally {
      setLoading(false);
    }
  };

  // --- EDIT (blocked for Owner plan) ---
  const handleEdit = (plan) => {
    if (isOwnerPlan(plan)) {
      return Swal.fire({
        icon: "info",
        title: "Protected Plan",
        text: "The Owner plan is protected and cannot be edited.",
      });
    }
    setPlanName(plan.planName);
    const cycle = getBillingCycle(plan);
    setPrice(plan.price ?? DEFAULT_PER_PERSON_PRICE);
    setBillingCycle(cycle.value);
    setDurationDays(plan.durationDays || cycle.durationDays);
    setMaxUsers(plan.maxUsers === null ? "" : plan.maxUsers);
    setSelectedFeatures([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- DELETE (blocked for Owner plan) ---
  const handleDelete = async (id, plan) => {
    if (isOwnerPlan(plan)) {
      return Swal.fire({
        icon: "info",
        title: "Protected Plan",
        text: "The Owner plan is protected and cannot be deleted.",
      });
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete(`/api/admin/delete-plan/${id}`);
      fetchPlans();
      Swal.fire("Deleted!", "The plan has been deleted.", "success");
    } catch {
      Swal.fire("Error!", "Failed to delete the plan.", "error");
    }
  };

  const getLabelForRoute = (route) => {
    const f = allFeatures.find((feat) => feat.route === route);
    return f ? f.label : route;
  };

  const toggleExpandPlan = (planId) => {
    setExpandedPlans((prev) => ({
      ...prev,
      [planId]: !prev[planId],
    }));
  };

  return (
    <div className="max-w-6xl mx-auto mt-10 p-4 space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── FORM ── */}
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 h-fit">
          <h2 className="text-2xl font-black text-gray-800 uppercase mb-6">Manage Plans</h2>

          <form onSubmit={handleUpdate} className="space-y-5 relative">
            {/* <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Plan Name</label>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="e.g. Premium"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold"
              />
            </div> */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Billing Cycle</label>
                <select
                  value={billingCycle}
                  onChange={(e) => handleBillingCycleChange(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold"
                >
                  {BILLING_CYCLES.map((cycle) => (
                    <option key={cycle.value} value={cycle.value}>
                      {cycle.label} - {cycle.eyebrow}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Per Employee Price (INR)</label>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 focus-within:ring-2 focus-within:ring-purple-500">
                  <span className="text-xl font-black text-slate-800">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent py-3 font-semibold outline-none"
                  />
                </div>
              </div>
            </div>




            {/* Plan features dropdown is commented out because every admin feature is included automatically. */}
            {false && (
            <div className="relative" ref={dropdownRef}>
              <div className="flex justify-between items-center mb-1 ml-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Plan Features</label>
                <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                  {selectedFeatures.length} / {allFeatures.length} selected
                </span>
              </div>

              <div
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 cursor-pointer flex justify-between items-center transition-all hover:bg-gray-100"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span className={`font-semibold ${selectedFeatures.length === 0 ? "text-gray-400" : "text-gray-800"}`}>
                  {selectedFeatures.length === 0 ? "Select Plan Features..." : `${selectedFeatures.length} Features Included`}
                </span>
                {isDropdownOpen ? <FaChevronUp className="text-gray-500 text-sm" /> : <FaChevronDown className="text-gray-500 text-sm" />}
              </div>

              {isDropdownOpen && (
                <div className="absolute z-20 w-full mt-2 bg-white border border-gray-100 shadow-2xl rounded-xl overflow-hidden">
                  <div className="flex justify-between items-center p-3 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-500 uppercase">Select Options</span>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedFeatures(allFeatures.map((f) => f.route))}
                        className="text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors"
                      >
                        Select All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedFeatures([])}
                        className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {featuresLoading ? (
                    <div className="p-4 space-y-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                      {allFeatures.map((feature) => {
                        const isSelected = selectedFeatures.includes(feature.route);
                        return (
                          <div
                            key={feature.route}
                            onClick={() => toggleFeature(feature.route)}
                            className={`flex items-center gap-3 p-3 rounded-lg border border-transparent cursor-pointer transition-all select-none ${isSelected ? "bg-purple-50 border-purple-100" : "hover:bg-gray-50"
                              }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? "bg-purple-600 border-purple-600" : "border-gray-300 bg-white"
                                }`}
                            >
                              {isSelected && <FaCheck size={10} className="text-white" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className={`text-sm font-semibold truncate ${isSelected ? "text-purple-800" : "text-gray-700"}`}>
                                {feature.label}
                              </span>
                              {feature.description && (
                                <span className="text-[11px] text-gray-400 truncate">{feature.description}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 mt-4 rounded-xl text-white font-bold text-sm uppercase tracking-widest shadow-lg transition-all ${loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-500/30"
                }`}
            >
              {loading ? "Saving..." : "Save Plan Configuration"}
            </button>
          </form>
        </div>

        {/* ── LIVE PREVIEW ── */}
        <div className="bg-slate-900 p-8 rounded-3xl text-white flex flex-col justify-start relative overflow-hidden h-fit shadow-2xl">
          <div className="absolute top-[-10%] right-[-10%] w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
          <h3 className="text-indigo-400 font-black uppercase tracking-[0.2em] text-xs mb-6 text-center">Live Preview</h3>

          <div className="border border-white/10 bg-white/5 p-8 rounded-2xl backdrop-blur-md">
            <h4 className="text-3xl font-bold mb-1">{planName || "New Plan"}</h4>
            <p className="text-slate-400 text-sm mb-6 font-medium tracking-tight">All admin features included</p>

            <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-black text-white">
                {BILLING_CYCLES.find((cycle) => cycle.value === billingCycle)?.label || "Monthly Plan"}
              </p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-blue-300">
                {BILLING_CYCLES.find((cycle) => cycle.value === billingCycle)?.eyebrow || "Billed monthly"}
              </p>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-5xl font-black">₹{price || 0}</span>
                <span className="pb-2 text-xs font-bold text-slate-400">/employee/month</span>
              </div>
            </div>




            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Included Features</p>
              <ul className="space-y-3 max-h-56 overflow-y-auto pr-2 custom-scrollbar-dark">
                {allFeatures.map((feature, i) => (
                  <li key={`${feature.route}-${i}`} className="flex items-center gap-3 text-sm text-slate-200">
                    <div className="w-5 h-5 bg-indigo-500/20 rounded-full flex items-center justify-center shrink-0">
                      <FaCheck size={8} className="text-indigo-400" />
                    </div>
                    {feature.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── EXISTING PLANS ── */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 mt-10">
        <h3 className="text-xl font-black text-gray-800 uppercase mb-6">Existing Plans</h3>
        {existingPlans.length === 0 ? (
          <p className="text-gray-400 text-center py-10 font-medium">No plans created yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {existingPlans.map((plan) => {
              const isExpanded = expandedPlans[plan._id];
              const featureRoutes = allFeatures.map((feature) => feature.route);
              const displayedFeatures = isExpanded ? featureRoutes : featureRoutes.slice(0, 3);
              const extraCount = featureRoutes.length - 3;
              const isOwner = isOwnerPlan(plan);
              const planBillingCycle = getBillingCycle(plan);

              return (
                <div
                  key={plan._id}
                  className={`border p-6 rounded-2xl group transition-all relative overflow-hidden ${isOwner
                      ? "border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 shadow-md"
                      : "border-gray-100 bg-gray-50 hover:border-purple-300 hover:shadow-lg"
                    }`}
                >
                  {/* ✅ Owner crown badge */}
                  {isOwner && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider">
                      <FaLock size={8} /> Protected
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-gray-900 text-xl">{plan.planName}</h4>
                      <div className="flex gap-2 mt-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md inline-block bg-purple-100 text-purple-600">
                          Per Person Billing
                        </p>
                      </div>
                    </div>

                    {/* Edit/Delete only for non-owner plans */}
                    {!isOwner && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(plan)}
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 bg-white p-2.5 rounded-xl shadow-sm border border-gray-200 transition-colors"
                          title="Edit Plan"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(plan._id, plan)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 bg-white p-2.5 rounded-xl shadow-sm border border-gray-200 transition-colors"
                          title="Delete Plan"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="text-3xl font-black text-gray-800 mb-4">
                    ₹{plan.price}<span className="text-sm font-bold text-gray-400 uppercase"> / Person</span>
                  </div>

                  <div className="mb-4 rounded-xl border border-white bg-white/70 p-3 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">{planBillingCycle.eyebrow}</p>
                    <p className="mt-1 text-sm font-black text-slate-900">{planBillingCycle.label}</p>
                  </div>

                  <ul className="text-sm text-gray-600 space-y-2 mb-2 transition-all">
                    {displayedFeatures.map((route, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <FaCheck className={`mt-1 shrink-0 ${isOwner ? "text-yellow-500" : "text-purple-500"}`} size={12} />
                        <span>{getLabelForRoute(route)}</span>
                      </li>
                    ))}
                  </ul>

                  {extraCount > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleExpandPlan(plan._id)}
                      className="text-purple-600 font-bold text-xs hover:underline flex items-center gap-1 mt-2 focus:outline-none"
                    >
                      {isExpanded ? (
                        <>Show less <FaChevronUp size={10} /></>
                      ) : (
                        <>+ {extraCount} more features <FaChevronDown size={10} /></>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e5e7eb; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #d1d5db; }
        
        .custom-scrollbar-dark::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar-dark::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-dark::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default PlanSettings;
