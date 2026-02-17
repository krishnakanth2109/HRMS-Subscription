import React, { useState, useEffect } from "react";
import api from "../../api"; // Import the configured axios instance
import { FaPlus, FaTrash, FaEdit } from "react-icons/fa";

const PlanSettings = () => {
  const [planName, setPlanName] = useState("");
  const [price, setPrice] = useState(0);
  const [durationDays, setDurationDays] = useState(30);
  const [features, setFeatures] = useState([""]);
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [existingPlans, setExistingPlans] = useState([]); // State for fetching plans

  const fetchPlans = async () => {
    try {
      const res = await api.get("/api/admin/all-plans");
      setExistingPlans(res.data);
    } catch (error) {
      console.log("Could not fetch plans");
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleFeatureChange = (index, value) => {
    const newFeatures = [...features];
    newFeatures[index] = value;
    setFeatures(newFeatures);
  };

  const addFeatureField = () => {
    setFeatures([...features, ""]);
  };

  const removeFeatureField = (index) => {
    if (features.length > 1) {
      const newFeatures = features.filter((_, i) => i !== index);
      setFeatures(newFeatures);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!planName) return setStatus({ type: "error", message: "Plan name is required" });

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const cleanedFeatures = features.filter((f) => f.trim() !== "");

      await api.patch("/api/admin/plan-settings", {
        planName,
        price: Number(price),
        durationDays: Number(durationDays),
        features: cleanedFeatures,
      });

      setStatus({
        type: "success",
        message: `Plan "${planName}" saved successfully!`,
      });

      // Reset form & Refresh list
      setPlanName("");
      setPrice(0);
      setDurationDays(30);
      setFeatures([""]);
      fetchPlans();
    } catch (error) {
      setStatus({
        type: "error",
        message: error.response?.data?.message || "Failed to update settings",
      });
    } finally {
      setLoading(false);
    }
  };

  // --- EDIT LOGIC ---
  const handleEdit = (plan) => {
    setPlanName(plan.planName);
    setPrice(plan.price);
    setDurationDays(plan.durationDays);
    setFeatures(plan.features.length > 0 ? plan.features : [""]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- DELETE LOGIC ---
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this plan?")) return;
    try {
      await api.delete(`/api/admin/delete-plan/${id}`);
      fetchPlans();
      setStatus({ type: "success", message: "Plan deleted successfully" });
    } catch (error) {
      setStatus({ type: "error", message: "Delete failed" });
    }
  };

  return (
    <div className="max-w-6xl mx-auto mt-10 p-4 space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* --- CREATE / UPDATE FORM --- */}
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 h-fit">
          <h2 className="text-2xl font-black text-gray-800 uppercase mb-6">Manage Plans</h2>

          <form onSubmit={handleUpdate} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Plan Name</label>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="e.g. Premium"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold"
                required
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
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Days</label>
                <input
                  type="number"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold"
                  required
                />
              </div>
            </div>

            {/* --- DYNAMIC FEATURES SECTION --- */}
            <div>
              <div className="flex justify-between items-center mb-2 ml-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Plan Features</label>
                <button
                  type="button"
                  onClick={addFeatureField}
                  className="text-purple-600 bg-purple-50 p-1.5 rounded-lg hover:bg-purple-100 transition"
                >
                  <FaPlus size={12} />
                </button>
              </div>
              <div className="space-y-3">
                {features.map((feature, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) => handleFeatureChange(index, e.target.value)}
                      placeholder={`Feature #${index + 1}`}
                      className="flex-grow p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                    />
                    {features.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFeatureField(index)}
                        className="text-red-400 p-3 hover:text-red-600 transition"
                      >
                        <FaTrash size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-xl text-white font-bold text-sm uppercase tracking-widest shadow-lg transition-all ${
                loading ? "bg-gray-400" : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:-translate-y-0.5"
              }`}
            >
              {loading ? "Saving..." : "Save Plan Configuration"}
            </button>
          </form>

          {status.message && (
            <div
              className={`mt-6 p-4 rounded-xl text-sm font-bold border ${
                status.type === "success" ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"
              }`}
            >
              {status.message}
            </div>
          )}
        </div>

        {/* --- LIVE PREVIEW --- */}
        <div className="bg-slate-900 p-8 rounded-3xl text-white flex flex-col justify-start relative overflow-hidden h-fit">
          <div className="absolute top-[-10%] right-[-10%] w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"></div>

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
              <ul className="space-y-3">
                {features
                  .filter((f) => f.trim() !== "")
                  .map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-200">
                      <div className="w-5 h-5 bg-indigo-500/20 rounded-full flex items-center justify-center">
                        <FaPlus size={8} className="text-indigo-400" />
                      </div>
                      {f}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* --- EXISTING PLANS LIST --- */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        <h3 className="text-xl font-black text-gray-800 uppercase mb-6">Existing Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {existingPlans.map((plan) => (
            <div key={plan._id} className="border border-gray-100 p-5 rounded-2xl bg-gray-50 group hover:border-purple-200 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-gray-900 text-lg">{plan.planName}</h4>
                  <p className="text-xs text-purple-600 font-bold uppercase tracking-wider">{plan.durationDays} Days</p>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(plan)} className="text-blue-500 hover:text-blue-700 bg-white p-2 rounded-lg shadow-sm border border-gray-100">
                    <FaEdit />
                  </button>
                  <button onClick={() => handleDelete(plan._id)} className="text-red-500 hover:text-red-700 bg-white p-2 rounded-lg shadow-sm border border-gray-100">
                    <FaTrash />
                  </button>
                </div>
              </div>
              <div className="text-2xl font-black text-gray-800 mb-3">₹{plan.price}</div>
              <ul className="text-xs text-gray-500 space-y-1">
                {plan.features.slice(0, 3).map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
                {plan.features.length > 3 && <li>+ {plan.features.length - 3} more</li>}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlanSettings;