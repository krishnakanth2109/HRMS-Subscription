import React from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Settings, User, Sliders, Shield, Activity } from "lucide-react";

const CustomizingAdmin = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const admin = location.state?.admin || {};

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate("/master/customize")}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm font-semibold"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Customize
      </button>

      {/* Hero Header */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">
            Admin Workspace
          </span>
          <h2 className="text-3xl font-extrabold text-slate-800 mt-2">
            Customizing {admin.name || "Admin"}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Configure settings, layout, and options for this administrator account.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200">
            ID: {id}
          </span>
        </div>
      </div>

      {/* Placeholder Details & customization cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Info Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <User className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-slate-800 text-lg">Account Information</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Name</span>
              <span className="font-semibold text-slate-800">{admin.name || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email</span>
              <span className="font-semibold text-slate-800">{admin.email || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Plan Tier</span>
              <span className="font-semibold text-slate-800 capitalize">{admin.plan || "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Customization Actions (Blank area for modifications) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <Sliders className="w-5 h-5 text-purple-500" />
            <h3 className="font-bold text-slate-800 text-lg">Customization Tools</h3>
          </div>
          <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
            <Settings className="w-10 h-10 text-slate-400 mb-3" />
            <p className="text-slate-600 font-medium text-sm">Custom features coming soon</p>
            <p className="text-slate-400 text-xs mt-1 max-w-xs">
              This is a blank page prepared for customizing this administrator's HRMS options.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomizingAdmin;
