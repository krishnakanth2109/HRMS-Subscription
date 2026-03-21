import React, { useState, useEffect, useRef } from "react";
import api from "../../api";
import { FaTrash, FaEdit, FaCheck, FaChevronDown, FaChevronUp } from "react-icons/fa";
import Swal from "sweetalert2"; // Added SweetAlert2

// ⭐ HARDCODED FALLBACK
const FALLBACK_FEATURES = [
  { label: "Dashboard",            route: "/admin/dashboard",         description: "Main dashboard overview with key metrics" },
  { label: "Employee Management",  route: "/employees",               description: "Add, edit and manage all employee records" },
  { label: "Employees Attendance", route: "/attendance",              description: "View and manage employee attendance logs" },
  { label: "Shift Management",     route: "/admin/settings",          description: "Configure and assign employee work shifts" },
  { label: "Location Settings",    route: "/admin/shifttype",         description: "Manage geo-fencing and location-based settings" },
  { label: "Leave Summary",        route: "/admin/leave-summary",     description: "Analytics and summary of all employee leaves" },
  { label: "Holiday Calendar",     route: "/admin/holiday-calendar",  description: "Manage public and company holidays" },
  { label: "Payroll",              route: "/admin/payroll",           description: "Process and manage employee payroll" },
  { label: "Announcements",        route: "/admin/notices",           description: "Post and manage company-wide announcements" },
  { label: "Leave Requests",       route: "/admin/admin-Leavemanage", description: "Review and approve/reject employee leave requests" },
  { label: "Attendance Adjustment",route: "/admin/late-requests",     description: "Handle late login and attendance correction requests" },
  { label: "Overtime Requests",    route: "/admin/admin-overtime",    description: "Review and manage employee overtime requests" },
  { label: "Live Tracking",        route: "/admin/live-tracking",     description: "Monitor employee idle time in real-time" }
];

const PlanSettings = () => {
  const [planName, setPlanName] = useState("");
  const [price, setPrice] = useState(0);
  const [durationDays, setDurationDays] = useState(30);
  const [selectedFeatures, setSelectedFeatures] = useState([]); 

  const [loading, setLoading] = useState(false);
  const [existingPlans, setExistingPlans] = useState([]);

  // Features List State
  const [allFeatures, setAllFeatures] = useState(FALLBACK_FEATURES);
  const [featuresLoading, setFeaturesLoading] = useState(true);

  // Dynamic Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Existing Plans Expansion State
  const [expandedPlans, setExpandedPlans] = useState({});

  // Close dropdown when clicking outside
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
        setAllFeatures(res.data);
      } else {
        setAllFeatures(FALLBACK_FEATURES);
      }
    } catch {
      setAllFeatures(FALLBACK_FEATURES);
    } finally {
      setFeaturesLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await api.get("/api/admin/all-plans");
      setExistingPlans(res.data);
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

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    // ⭐ SweetAlert Validations
    if (!planName) {
      return Swal.fire({ icon: "error", title: "Oops...", text: "Plan name is required!" });
    }
    if (selectedFeatures.length === 0) {
      return Swal.fire({ icon: "error", title: "Action Required", text: "Please select at least one feature for this plan." });
    }

    setLoading(true);

    try {
      await api.patch("/api/admin/plan-settings", {
        planName,
        price: Number(price),
        durationDays: Number(durationDays),
        features: selectedFeatures,
      });

      // ⭐ SweetAlert Success
      Swal.fire({
        icon: "success",
        title: "Saved Successfully!",
        text: `Plan "${planName}" has been updated.`,
        timer: 2000,
        showConfirmButton: false
      });

      setPlanName("");
      setPrice(0);
      setDurationDays(30);
      setSelectedFeatures([]);
      setIsDropdownOpen(false);
      fetchPlans();
    } catch (error) {
      // ⭐ SweetAlert Error
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: error.response?.data?.message || "Failed to update settings",
      });
    } finally {
      setLoading(false);
    }
  };

  // --- EDIT ---
  const handleEdit = (plan) => {
    setPlanName(plan.planName);
    setPrice(plan.price);
    setDurationDays(plan.durationDays);
    setSelectedFeatures(plan.features || []);
    // Scroll up smoothly
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- DELETE ---
  const handleDelete = async (id) => {
    // ⭐ SweetAlert Confirmation
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it!"
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
      [planId]: !prev[planId]
    }));
  };

  return (
    <div className="max-w-6xl mx-auto mt-10 p-4 space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── FORM ── */}
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 h-fit">
          <h2 className="text-2xl font-black text-gray-800 uppercase mb-6">Manage Plans</h2>

          <form onSubmit={handleUpdate} className="space-y-5 relative">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Plan Name</label>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="e.g. Premium"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Price (INR)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Days</label>
                <input
                  type="number"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold"
                />
              </div>
            </div>

            {/* ⭐ DYNAMIC DROPDOWN FOR FEATURES */}
            <div className="relative" ref={dropdownRef}>
              <div className="flex justify-between items-center mb-1 ml-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Plan Features</label>
                <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                  {selectedFeatures.length} / {allFeatures.length} selected
                </span>
              </div>

              {/* Dropdown Toggle Button */}
              <div 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 cursor-pointer flex justify-between items-center transition-all hover:bg-gray-100"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span className={`font-semibold ${selectedFeatures.length === 0 ? "text-gray-400" : "text-gray-800"}`}>
                  {selectedFeatures.length === 0 ? "Select Plan Features..." : `${selectedFeatures.length} Features Included`}
                </span>
                {isDropdownOpen ? <FaChevronUp className="text-gray-500 text-sm" /> : <FaChevronDown className="text-gray-500 text-sm" />}
              </div>

              {/* Dropdown Menu Area */}
              {isDropdownOpen && (
                <div className="absolute z-20 w-full mt-2 bg-white border border-gray-100 shadow-2xl rounded-xl overflow-hidden">
                  
                  {/* Dropdown Header: Select All / Clear */}
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
                            className={`flex items-center gap-3 p-3 rounded-lg border border-transparent cursor-pointer transition-all select-none ${
                              isSelected
                                ? "bg-purple-50 border-purple-100"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            {/* Custom Checkbox inside dropdown */}
                            <div
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                isSelected
                                  ? "bg-purple-600 border-purple-600"
                                  : "border-gray-300 bg-white"
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

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 mt-4 rounded-xl text-white font-bold text-sm uppercase tracking-widest shadow-lg transition-all ${
                loading
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
            <p className="text-slate-400 text-sm mb-6 font-medium tracking-tight">Access for {durationDays} days</p>

            <div className="flex items-baseline gap-1 mb-8">
              <span className="text-5xl font-black">₹{price}</span>
              <span className="text-slate-400 text-sm font-bold uppercase">/ {durationDays} Days</span>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Included Features</p>
              {selectedFeatures.length === 0 ? (
                <p className="text-slate-500 text-sm italic">No features selected yet</p>
              ) : (
                <ul className="space-y-3 max-h-56 overflow-y-auto pr-2 custom-scrollbar-dark">
                  {selectedFeatures.map((route, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-200">
                      <div className="w-5 h-5 bg-indigo-500/20 rounded-full flex items-center justify-center shrink-0">
                        <FaCheck size={8} className="text-indigo-400" />
                      </div>
                      {getLabelForRoute(route)}
                    </li>
                  ))}
                </ul>
              )}
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
              // Determine which features to show based on expansion state
              const displayedFeatures = isExpanded ? plan.features : plan.features.slice(0, 3);
              const extraCount = plan.features.length - 3;

              return (
                <div key={plan._id} className="border border-gray-100 p-6 rounded-2xl bg-gray-50 group hover:border-purple-300 hover:shadow-lg transition-all relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-gray-900 text-xl">{plan.planName}</h4>
                      <p className="text-xs text-purple-600 font-bold uppercase tracking-wider bg-purple-100 px-2 py-1 rounded-md mt-1 inline-block">{plan.durationDays} Days</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEdit(plan)} 
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 bg-white p-2.5 rounded-xl shadow-sm border border-gray-200 transition-colors"
                        title="Edit Plan"
                      >
                        <FaEdit />
                      </button>
                      <button 
                        onClick={() => handleDelete(plan._id)} 
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 bg-white p-2.5 rounded-xl shadow-sm border border-gray-200 transition-colors"
                        title="Delete Plan"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-3xl font-black text-gray-800 mb-4">₹{plan.price}</div>
                  
                  <ul className="text-sm text-gray-600 space-y-2 mb-2 transition-all">
                    {displayedFeatures.map((route, i) => (
                      <li key={i} className="flex items-start gap-2">
                         <FaCheck className="text-purple-500 mt-1 shrink-0" size={12} />
                         <span>{getLabelForRoute(route)}</span>
                      </li>
                    ))}
                  </ul>

                  {/* ⭐ TOGGLE MORE/LESS FEATURES */}
                  {extraCount > 0 && (
                    <button 
                      type="button"
                      onClick={() => toggleExpandPlan(plan._id)}
                      className="text-purple-600 font-bold text-xs hover:underline flex items-center gap-1 mt-2 focus:outline-none"
                    >
                      {isExpanded ? (
                        <>Show less <FaChevronUp size={10}/></>
                      ) : (
                        <>+ {extraCount} more features <FaChevronDown size={10}/></>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Internal CSS for custom scrollbars */}
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