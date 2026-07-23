import React, { useState, useEffect, useRef } from "react";
import api from "../../api";
import { FaTrash, FaEdit, FaCheck, FaChevronDown, FaChevronUp, FaLock, FaToggleOn, FaToggleOff } from "react-icons/fa";
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
  { label: "Expense Management", route: "/admin/expense", description: "Handle and review employee expense requests" },
  // ✅ Owner-exclusive features — visible in fallback but only assigned to Owner plan via seed
  { label: "Master Dashboard", route: "/master/dashboard", description: "Owner-only: Platform-wide overview & stats" },
  { label: "Admin Management", route: "/master/admins", description: "Owner-only: View & manage all registered companies" },
  { label: "Plan Management", route: "/master/plans", description: "Owner-only: Create, edit and delete subscription plans" },
  { label: "Login Access Control", route: "/master/login-access", description: "Owner-only: Enable/disable admin & employee logins" },
  { label: "System Settings", route: "/master/settings", description: "Owner-only: Global system configuration" },
  { label: "Billing Overview", route: "/master/billing", description: "Owner-only: Subscriptions & payment overview" },
  { label: "Platform Analytics", route: "/master/analytics", description: "Owner-only: Usage analytics across all tenants" },
];

const OWNER_PLAN_NAME = "owner";
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

const getBillingCycleDetails = (value) => {
  switch (value) {
    case "monthly":
      return { label: "Monthly Plan", eyebrow: "Billed monthly" };
    case "quarterly":
      return { label: "Quarterly Plan", eyebrow: "Billed every 3 months" };
    case "halfYearly":
      return { label: "Half-Yearly Plan", eyebrow: "Billed every 6 months" };
    case "yearly":
      return { label: "Annual Plan", eyebrow: "Billed annually" };
    case "free":
      return { label: "Free Plan", eyebrow: "Free / Trial" };
    default:
      return { label: "Custom Plan", eyebrow: "Billed periodically" };
  }
};

const PlanSettings = () => {
  const [planName, setPlanName] = useState("");
  const [price, setPrice] = useState("");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [durationDays, setDurationDays] = useState("");
  const [maxUsers, setMaxUsers] = useState(30);
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [allAdmins, setAllAdmins] = useState([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState(["none"]);

  const [loading, setLoading] = useState(false);
  const [existingPlans, setExistingPlans] = useState([]);

  const [allFeatures, setAllFeatures] = useState(getAdminFeatures(FALLBACK_FEATURES));
  const [featuresLoading, setFeaturesLoading] = useState(true);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [expandedPlans, setExpandedPlans] = useState({});
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const companyDropdownRef = useRef(null);

  const formRef = useRef(null);
  const [highlightEditForm, setHighlightEditForm] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(event.target)) {
        setIsCompanyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchAllFeatures = async () => {
    setFeaturesLoading(true);
    setAllFeatures(getAdminFeatures(FALLBACK_FEATURES));
    setFeaturesLoading(false);
  };

  const fetchPlans = async () => {
    try {
      const res = await api.get("/api/admin/all-plans");
      setExistingPlans((res.data || []).filter((plan) => !isOwnerPlan(plan)));
    } catch {
      console.log("Could not fetch plans");
    }
  };

  const fetchAllAdmins = async () => {
    try {
      const res = await api.get("/api/admin/all-admins");
      setAllAdmins(res.data || []);
    } catch (err) {
      console.log("Could not fetch admins", err);
    }
  };

  useEffect(() => {
    fetchAllFeatures();
    fetchPlans();
    fetchAllAdmins();
  }, []);

  const toggleFeature = (route) => {
    setSelectedFeatures((prev) =>
      prev.includes(route) ? prev.filter((r) => r !== route) : [...prev, route]
    );
  };

  const handleBillingCycleChange = (value) => {
    setBillingCycle(value);
    if (value === "monthly") {
      setDurationDays(30);
    } else if (value === "quarterly") {
      setDurationDays(90);
    } else if (value === "halfYearly") {
      setDurationDays(180);
    } else if (value === "yearly") {
      setDurationDays(365);
    } else if (value === "custom") {
      setDurationDays("");
    }
  };

  const toggleCompanySelection = (adminId) => {
    if (adminId === "all") {
      setSelectedCompanyIds(["all"]);
      const matchedPlan = existingPlans.find((p) => p._id === editingPlanId);
      setPrice(matchedPlan ? (matchedPlan.price ?? "") : "");
    } else if (adminId === "none") {
      setSelectedCompanyIds(["none"]);
      const matchedPlan = existingPlans.find((p) => p._id === editingPlanId);
      setPrice(matchedPlan ? (matchedPlan.price ?? "") : "");
    } else {
      setSelectedCompanyIds((prev) => {
        const filtered = prev.filter((id) => id !== "all" && id !== "none");
        const next = filtered.includes(adminId)
          ? filtered.filter((id) => id !== adminId)
          : [...filtered, adminId];

        if (next.length === 0) {
          const matchedPlan = existingPlans.find((p) => p._id === editingPlanId);
          setPrice(matchedPlan ? (matchedPlan.price ?? "") : "");
          return ["none"];
        }

        if (next.length === 1) {
          const selectedAdmin = allAdmins.find((a) => a._id === next[0]);
          if (selectedAdmin) {
            const matchedPlan = existingPlans.find((p) => p._id === editingPlanId);
            const planPrice = matchedPlan ? matchedPlan.price : "";
            setPrice(selectedAdmin.planDetails?.price !== undefined ? selectedAdmin.planDetails.price : planPrice);
          }
        }
        return next;
      });
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    if (!planName) {
      return Swal.fire({ icon: "error", title: "Oops...", text: "Plan name is required!" });
    }

    if (!durationDays) {
      return Swal.fire({ icon: "error", title: "Oops...", text: "Duration in days is required!" });
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
      const includedFeatures = selectedFeatures;

      await api.patch("/api/admin/plan-settings", {
        planId: editingPlanId,
        planName,
        price: Number(price),
        billingCycle,
        durationDays,
        maxUsers: null,
        features: includedFeatures,
        targetAdminIds: selectedCompanyIds,
      });

      Swal.fire({
        icon: "success",
        title: "Saved Successfully!",
        text: `Plan "${planName}" has been updated.`,
        timer: 2000,
        showConfirmButton: false,
      });

      setPlanName("");
      setPrice("");
      setBillingCycle("monthly");
      setDurationDays("");
      setMaxUsers(30);
      setSelectedFeatures([]);
      setIsDropdownOpen(false);
      setEditingPlanId(null);
      setSelectedCompanyIds(["none"]);
      fetchPlans();
      fetchAllAdmins();
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
    setEditingPlanId(plan._id);
    setPlanName(plan.planName);
    setPrice(plan.price ?? "");
    setBillingCycle(plan.billingCycle || "monthly");
    setDurationDays(plan.durationDays || "");
    setMaxUsers(plan.maxUsers === null ? "" : plan.maxUsers);
    setSelectedFeatures(plan.features || []);
    setSelectedCompanyIds(["none"]);
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setHighlightEditForm(true);
    setTimeout(() => {
      setHighlightEditForm(false);
    }, 2000);
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

  // --- TOGGLE VISIBILITY ---
  const handleToggleVisibility = async (plan) => {
    try {
      const res = await api.patch(`/api/admin/toggle-plan/${plan._id}`);
      // Optimistically update local state
      setExistingPlans((prev) =>
        prev.map((p) =>
          p._id === plan._id ? { ...p, isActive: res.data.isActive } : p
        )
      );
      Swal.fire({
        icon: "success",
        title: res.data.isActive ? "Plan Activated" : "Plan Hidden",
        text: res.data.message,
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Toggle Failed",
        text: error.response?.data?.message || "Failed to toggle plan visibility",
      });
    }
  };

  const toggleExpandPlan = (planId) => {
    setExpandedPlans((prev) => ({
      ...prev,
      [planId]: !prev[planId],
    }));
  };

  const handleCreateNewPlan = () => {
    setPlanName("");
    setPrice("");
    setBillingCycle("custom");
    setDurationDays("");
    setMaxUsers(30);
    setSelectedFeatures([]);
    setIsDropdownOpen(false);
    setEditingPlanId(null);
    setSelectedCompanyIds(["none"]);
  };

  return (
    <div className="space-y-10 animate-[fadeIn_0.4s_ease-out]">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── FORM ── */}
        <div 
          ref={formRef} 
          className={`p-6.5 rounded-2xl shadow-sm border h-fit hover:shadow-md transition-all duration-300 ${
            highlightEditForm 
              ? "border-blue-500 ring-4 ring-blue-500/20 shadow-blue-100 bg-white" 
              : "border-slate-100 hover:border-slate-200/80 bg-white"
          }`}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              {editingPlanId ? `Editing: ${planName}` : "Manage Plans"}
            </h2>
            <button
              type="button"
              onClick={handleCreateNewPlan}
              className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-600 font-bold px-3 py-1.5 rounded-lg border border-purple-100/50 hover:shadow-sm transition-all"
            >
              + Add New Custom Plan
            </button>
          </div>

          <form onSubmit={handleUpdate} className="space-y-5 relative">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Plan Name</label>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="e.g. Premium"
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-semibold text-slate-800 text-sm transition-all placeholder-slate-400"
              />
              {editingPlanId && (
              <div className="relative mt-4" ref={companyDropdownRef}>
                <div className="flex justify-between items-center mb-1.5 ml-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Company</label>
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-100/50 px-2.5 py-1 rounded-lg">
                    {selectedCompanyIds.includes("all") ? "All" : selectedCompanyIds.length} Selected
                  </span>
                </div>

                <div
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer flex justify-between items-center transition-all hover:bg-slate-100 text-sm"
                  onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                >
                  <span className="font-semibold text-slate-750">
                    {selectedCompanyIds.includes("none")
                      ? "None"
                      : selectedCompanyIds.includes("all")
                      ? "All Companies"
                      : `${selectedCompanyIds.length} Companies Selected`}
                  </span>
                  {isCompanyDropdownOpen ? <FaChevronUp className="text-slate-400 text-xs" /> : <FaChevronDown className="text-slate-400 text-xs" />}
                </div>

                {isCompanyDropdownOpen && (
                  <div className="absolute z-20 w-full mt-2 bg-white border border-slate-100 shadow-xl rounded-xl overflow-hidden animate-[fadeIn_0.15s_ease-out]">
                    <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar text-sm">
                      {/* Option for None */}
                      <div
                        onClick={() => toggleCompanySelection("none")}
                        className={`flex items-center gap-3 p-3 rounded-lg border border-transparent cursor-pointer transition-all select-none ${
                          selectedCompanyIds.includes("none") ? "bg-purple-50/50 border-purple-100/30" : "hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`w-4.5 h-4.5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                            selectedCompanyIds.includes("none") ? "bg-purple-600 border-purple-600 text-white" : "border-slate-200 bg-white"
                          }`}
                        >
                          {selectedCompanyIds.includes("none") && <FaCheck size={8} />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={`text-xs font-semibold truncate ${selectedCompanyIds.includes("none") ? "text-purple-800" : "text-slate-700"}`}>
                            None 
                          </span>
                        </div>
                      </div>

                      {/* Option for All Companies */}
                      <div
                        onClick={() => toggleCompanySelection("all")}
                        className={`flex items-center gap-3 p-3 rounded-lg border border-transparent cursor-pointer transition-all select-none ${
                          selectedCompanyIds.includes("all") ? "bg-purple-50/50 border-purple-100/30" : "hover:bg-slate-55"
                        }`}
                      >
                        <div
                          className={`w-4.5 h-4.5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                            selectedCompanyIds.includes("all") ? "bg-purple-600 border-purple-600 text-white" : "border-slate-200 bg-white"
                          }`}
                        >
                          {selectedCompanyIds.includes("all") && <FaCheck size={8} />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={`text-xs font-semibold truncate ${selectedCompanyIds.includes("all") ? "text-purple-800" : "text-slate-700"}`}>
                            All Companies
                          </span>
                        </div>
                      </div>

                      {/* Options for Enrolled Companies */}
                      {allAdmins
                        .filter((admin) => {
                          if (!editingPlanId) return true; // Show all companies when creating a new plan
                          const adminPlan = admin.planDetails?.planName || admin.plan || "";
                          return adminPlan.toLowerCase() === planName.toLowerCase();
                        })
                        .map((admin) => {
                          const isSelected = selectedCompanyIds.includes(admin._id);
                          const matchedPlan = existingPlans.find((p) => p._id === editingPlanId);
                          const planPrice = matchedPlan ? matchedPlan.price : 0;
                          const currentPrice = admin.planDetails?.price !== undefined ? admin.planDetails.price : planPrice;

                          return (
                            <div
                              key={admin._id}
                              onClick={() => toggleCompanySelection(admin._id)}
                              className={`flex items-center gap-3 p-3 rounded-lg border border-transparent cursor-pointer transition-all select-none ${
                                isSelected ? "bg-purple-55/50 border-purple-100/30" : "hover:bg-slate-50"
                              }`}
                            >
                              <div
                                className={`w-4.5 h-4.5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                                  isSelected ? "bg-purple-600 border-purple-600 text-white" : "border-slate-200 bg-white"
                                }`}>
                                {isSelected && <FaCheck size={8} />}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className={`text-xs font-semibold truncate ${isSelected ? "text-purple-800" : "text-slate-700"}`}>
                                  {admin.name}
                                </span>
                                <span className="text-[10px] text-slate-400 truncate">
                                  {admin.email} — Price: ₹{currentPrice}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Billing Cycle</label>
                <select
                  value={billingCycle}
                  onChange={(e) => handleBillingCycleChange(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-semibold text-slate-800 text-sm transition-all"
                >
                  <option value="monthly">Monthly Plan</option>
                  <option value="quarterly">Quarterly Plan</option>
                  <option value="halfYearly">Half-Yearly Plan</option>
                  <option value="yearly">Annual Plan</option>
                  <option value="custom">Custom Plan</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Duration (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  placeholder="e.g. 30"
                  disabled={billingCycle !== "custom"}
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-semibold text-slate-850 text-sm transition-all placeholder-slate-400 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Per Employee Price (INR)</label>
                <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500 transition-all">
                  <span className="text-lg font-extrabold text-slate-800">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent py-3 font-semibold text-sm outline-none text-slate-850"
                  />
                </div>
              </div>
            </div>

            {/* Plan features dropdown */}
            <div className="relative" ref={dropdownRef}>
              <div className="flex justify-between items-center mb-1.5 ml-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Plan Features</label>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-100/50 px-2.5 py-1 rounded-lg">
                  {selectedFeatures.length} / {allFeatures.length} selected
                </span>
              </div>

              <div
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer flex justify-between items-center transition-all hover:bg-slate-100 text-sm"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span className={`font-semibold ${selectedFeatures.length === 0 ? "text-slate-400" : "text-slate-700"}`}>
                  {selectedFeatures.length === 0 ? "Select Plan Features..." : `${selectedFeatures.length} Features Included`}
                </span>
                {isDropdownOpen ? <FaChevronUp className="text-slate-400 text-xs" /> : <FaChevronDown className="text-slate-400 text-xs" />}
              </div>

              {isDropdownOpen && (
                <div className="absolute z-20 w-full mt-2 bg-white border border-slate-100 shadow-xl rounded-xl overflow-hidden animate-[fadeIn_0.15s_ease-out]">
                  <div className="flex justify-between items-center p-3 bg-slate-50/50 border-b border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Options</span>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedFeatures(allFeatures.map((f) => f.route))}
                        className="text-xs font-bold text-purple-600 hover:text-purple-755 transition-colors"
                      >
                        Select All
                      </button>
                      <span className="text-slate-200">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedFeatures([])}
                        className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {featuresLoading ? (
                    <div className="p-4 space-y-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-10 bg-slate-55 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar text-sm">
                      {allFeatures.map((feature) => {
                        const isSelected = selectedFeatures.includes(feature.route);
                        return (
                          <div
                            key={feature.route}
                            onClick={() => toggleFeature(feature.route)}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border border-transparent cursor-pointer transition-all select-none ${
                              isSelected ? "bg-purple-50/50 border-purple-100/30" : "hover:bg-slate-50"
                            }`}
                          >
                            <div
                              className={`w-4.5 h-4.5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                                isSelected ? "bg-purple-600 border-purple-600 text-white" : "border-slate-200 bg-white"
                              }`}
                            >
                              {isSelected && <FaCheck size={8} />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className={`text-xs font-semibold truncate ${isSelected ? "text-purple-800" : "text-slate-700"}`}>
                                {feature.label}
                              </span>
                              {feature.description && (
                                <span className="text-[10px] text-slate-400 truncate mt-0.5">{feature.description}</span>
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

            <div className="flex gap-4 mt-4">
              {editingPlanId && (
                <button
                  type="button"
                  onClick={handleCreateNewPlan}
                  className="flex-1 py-3.5 border border-slate-200 hover:bg-slate-50 text-slate-650 font-bold text-sm uppercase tracking-widest rounded-xl transition-all shadow-sm active:scale-95"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 py-3.5 rounded-xl text-white font-bold text-sm uppercase tracking-widest shadow-md transition-all ${
                  loading
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-500/20 active:scale-95"
                }`}
              >
                {loading ? "Saving..." : editingPlanId ? "Save Changes" : "Create New Plan"}
              </button>
            </div>
          </form>
        </div>

        {/* ── LIVE PREVIEW ── */}
        <div className="bg-[#0f172a] p-8 rounded-2xl text-white flex flex-col justify-start relative overflow-hidden h-fit shadow-lg border border-slate-800/40">
          <div className="absolute top-[-10%] right-[-10%] w-40 h-40 bg-purple-550/10 rounded-full blur-3xl" />
          <h3 className="text-purple-400 font-bold uppercase tracking-[0.2em] text-[10px] mb-6 text-center">Live Preview</h3>

          <div className="border border-slate-800/50 bg-slate-950/40 p-6.5 rounded-2xl backdrop-blur-md">
            <h4 className="text-2xl font-extrabold mb-1 tracking-tight text-slate-100">{planName || "New Plan"}</h4>
            <p className="text-slate-500 text-xs mb-6 font-semibold tracking-wide">All admin features included</p>

            <div className="mb-8 rounded-xl border border-slate-800/40 bg-slate-900/50 p-4.5 shadow-inner">
              <p className="text-xs font-bold text-slate-200">
                {getBillingCycleDetails(billingCycle).label}
              </p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-purple-400">
                {getBillingCycleDetails(billingCycle).eyebrow} ({durationDays || 0} Days)
              </p>
              <div className="mt-4 flex flex-col gap-1">
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-extrabold text-slate-100">₹{price || 0}</span>
                  <span className="pb-1 text-[10px] font-semibold text-slate-550">/employee/month</span>
                </div>
                {Number(price) > 0 && (
                  <span className="text-[10px] font-semibold text-slate-500 block mt-1">+ 18% GST (Total: ₹{((price || 0) * 1.18).toFixed(2)})</span>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Included Features</p>
              <ul className="space-y-3 max-h-56 overflow-y-auto pr-2 custom-scrollbar-dark text-xs font-medium">
                {allFeatures.filter(feat => selectedFeatures.includes(feat.route)).map((feature, i) => (
                  <li key={`${feature.route}-${i}`} className="flex items-center gap-3 text-slate-200">
                    <div className="w-4.5 h-4.5 bg-purple-500/10 text-purple-400 rounded-full flex items-center justify-center shrink-0">
                      <FaCheck size={8} />
                    </div>
                    <span className="text-slate-200">{feature.label}</span>
                  </li>
                ))}
                {selectedFeatures.length === 0 && (
                  <li className="text-xs text-slate-500 italic font-medium">No features selected yet</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── EXISTING PLANS ── */}
      <div className="bg-white p-6.5 rounded-2xl shadow-sm border border-slate-100 mt-10">
        <h3 className="text-lg font-extrabold text-slate-900 tracking-tight mb-6">Existing Plans</h3>
        {existingPlans.length === 0 ? (
          <p className="text-slate-400 text-center py-10 font-medium text-sm">No plans created yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {existingPlans.map((plan) => {
              const isExpanded = expandedPlans[plan._id];
              const featureRoutes = plan.features || [];
              const displayedFeatures = isExpanded ? featureRoutes : featureRoutes.slice(0, 3);
              const extraCount = featureRoutes.length - 3;
              const isOwner = isOwnerPlan(plan);
              const planBillingCycle = getBillingCycleDetails(plan.billingCycle);

              return (
                <div
                  key={plan._id}
                  className={`border p-6 rounded-2xl group transition-all relative overflow-hidden ${
                    isOwner
                      ? "border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/10 shadow-sm border-2"
                      : plan.isActive === false
                      ? "border-slate-150 bg-slate-50/40 opacity-60 hover:opacity-85 hover:border-slate-200"
                      : "border-slate-100 bg-white hover:border-purple-350 hover:shadow-lg hover:-translate-y-0.5 duration-300"
                  }`}
                >
                  {/* Owner crown badge */}
                  {isOwner && (
                    <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 bg-amber-100 border border-amber-200 text-amber-800 text-[9px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-sm">
                      <FaLock size={8} /> Protected
                    </div>
                  )}

                  {/* Hidden badge for inactive plans */}
                  {!isOwner && plan.isActive === false && (
                    <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-500 text-[9px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider">
                      Hidden
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-lg leading-snug">{plan.planName}</h4>
                      <div className="flex gap-2 mt-1.5">
                        <p className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md inline-block bg-purple-50 text-purple-600 border border-purple-100/50">
                          Per Person Billing
                        </p>
                      </div>
                    </div>

                    {/* Edit / Toggle / Delete — only for non-owner plans */}
                    {!isOwner && (
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={() => handleEdit(plan)}
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 bg-white p-2 rounded-xl shadow-sm border border-slate-150 transition-colors"
                          title="Edit Plan"
                        >
                          <FaEdit size={13} />
                        </button>
                        {/* ON / OFF toggle */}
                        <button
                          onClick={() => handleToggleVisibility(plan)}
                          className={`p-2 rounded-xl shadow-sm border transition-colors bg-white ${
                            plan.isActive !== false
                              ? "text-green-500 hover:text-green-700 hover:bg-green-55 border-slate-150"
                              : "text-slate-400 hover:text-slate-650 hover:bg-slate-100 border-slate-150"
                          }`}
                          title={plan.isActive !== false ? "Visible — click to hide" : "Hidden — click to show"}
                        >
                          {plan.isActive !== false ? <FaToggleOn size={16} /> : <FaToggleOff size={16} />}
                        </button>
                        <button
                          onClick={() => handleDelete(plan._id, plan)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-55 bg-white p-2 rounded-xl shadow-sm border border-slate-150 transition-colors"
                          title="Delete Plan"
                        >
                          <FaTrash size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="text-2xl font-extrabold text-slate-900 mb-4 tracking-tight">
                    ₹{plan.price}<span className="text-[10px] font-bold text-slate-400 uppercase"> / Person</span>
                    {plan.price > 0 && (
                      <span className="text-[10px] font-medium text-slate-550 block mt-0.5">+ 18% GST (Total: ₹{(plan.price * 1.18).toFixed(2)})</span>
                    )}
                  </div>

                  <div className="mb-4 rounded-xl border border-slate-100 bg-slate-55/50 p-3 shadow-inner">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-purple-650">
                      {planBillingCycle.eyebrow} ({plan.durationDays || 0} Days)
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-slate-800">{planBillingCycle.label}</p>
                  </div>

                  <ul className="text-xs text-slate-650 space-y-2 mb-2 transition-all font-medium">
                    {displayedFeatures.map((route, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <FaCheck className={`mt-0.5 shrink-0 ${isOwner ? "text-amber-500" : "text-purple-550"}`} size={12} />
                        <span className="text-slate-650">{getLabelForRoute(route)}</span>
                      </li>
                    ))}
                  </ul>

                  {extraCount > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleExpandPlan(plan._id)}
                      className="text-purple-600 hover:text-purple-755 font-bold text-xs hover:underline flex items-center gap-1 mt-2 focus:outline-none"
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #cbd5e1; }
        
        .custom-scrollbar-dark::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar-dark::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-dark::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.15); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default PlanSettings;
