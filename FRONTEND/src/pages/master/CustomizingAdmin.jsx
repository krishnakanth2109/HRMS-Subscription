import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Settings, Sliders, CheckSquare, Square, Save, Loader2, Upload, ImageIcon, Trash2 } from "lucide-react";
import api from "../../api";
import Swal from "sweetalert2";

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
  { label: "Live Tracking", route: "/admin/field-tracking", description: "Monitor employee field location in real-time" },
  { label: "Idle Tracking", route: "/admin/live-tracking", description: "Track and analyze employee idle and active periods" },
  { label: "Expense Management", route: "/admin/expense", description: "Handle and review employee expense requests" }
];

const CustomizingAdmin = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [legacyPlan, setLegacyPlan] = useState("");

  // Branding
  const [companyLogo, setCompanyLogo] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoRemoving, setLogoRemoving] = useState(false);
  const logoInputRef = useRef(null);

  // Favicon Branding
  const [companyFavicon, setCompanyFavicon] = useState("");
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [faviconRemoving, setFaviconRemoving] = useState(false);
  const faviconInputRef = useRef(null);

  // Plan Settings states
  const [price, setPrice] = useState(0);
  const [maxUsers, setMaxUsers] = useState(30);
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [navTemplate, setNavTemplate] = useState("sidebar");

  // Fetch current plan details
  const fetchPlanDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/master/customize-plan/${id}`);
      const { adminName, email, planDetails, companyLogo: logo, favicon: fav, navTemplate: dbNavTemplate } = res.data;

      setAdminName(adminName || "Admin");
      setAdminEmail(email || "");
      setLegacyPlan(planDetails.planName || "Free");
      setCompanyLogo(logo || "");
      setCompanyFavicon(fav || "");
      setNavTemplate(dbNavTemplate || "sidebar");

      setPrice(planDetails.price ?? 0);
      setMaxUsers(planDetails.maxUsers ?? 30);
      setBillingCycle(planDetails.billingCycle ?? "monthly");
      setSelectedFeatures(planDetails.features || []);
    } catch (err) {
      console.error("Fetch plan details error:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.response?.data?.message || "Failed to load admin plan details.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanDetails();
  }, [id]);

  // Handle Feature Checkbox Change
  const handleFeatureToggle = (route) => {
    if (selectedFeatures.includes(route)) {
      setSelectedFeatures(selectedFeatures.filter(f => f !== route));
    } else {
      setSelectedFeatures([...selectedFeatures, route]);
    }
  };

  // Select/Clear All features
  const handleSelectAll = () => {
    setSelectedFeatures(FALLBACK_FEATURES.map(f => f.route));
  };

  const handleClearAll = () => {
    setSelectedFeatures([]);
  };

  // Upload company logo
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("logo", file);
    try {
      setLogoUploading(true);
      const res = await api.patch(`/api/master/admins/${id}/upload-logo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCompanyLogo(res.data.companyLogo);
      Swal.fire({ icon: "success", title: "Logo Updated", text: "Company logo has been changed.", timer: 2000, showConfirmButton: false });
    } catch (err) {
      console.error("Logo upload error:", err);
      Swal.fire({ icon: "error", title: "Upload Failed", text: err.response?.data?.message || "Could not upload logo." });
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  // Remove company logo (reset to default)
  const handleLogoRemove = async () => {
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Remove Logo?",
      text: "This will reset the logo back to the default image.",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, remove it",
    });
    if (!confirm.isConfirmed) return;
    try {
      setLogoRemoving(true);
      const res = await api.delete(`/api/master/admins/${id}/logo`);
      setCompanyLogo(res.data.companyLogo);
      Swal.fire({ icon: "success", title: "Logo Removed", text: "Reverted to default logo.", timer: 2000, showConfirmButton: false });
    } catch (err) {
      console.error("Logo remove error:", err);
      Swal.fire({ icon: "error", title: "Failed", text: err.response?.data?.message || "Could not remove logo." });
    } finally {
      setLogoRemoving(false);
    }
  };

  // Upload company favicon
  const handleFaviconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("favicon", file);
    try {
      setFaviconUploading(true);
      const res = await api.patch(`/api/master/admins/${id}/upload-favicon`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCompanyFavicon(res.data.favicon);
      Swal.fire({ icon: "success", title: "Favicon Updated", text: "Company favicon has been changed.", timer: 2000, showConfirmButton: false });
    } catch (err) {
      console.error("Favicon upload error:", err);
      Swal.fire({ icon: "error", title: "Upload Failed", text: err.response?.data?.message || "Could not upload favicon." });
    } finally {
      setFaviconUploading(false);
      if (faviconInputRef.current) faviconInputRef.current.value = "";
    }
  };

  // Remove company favicon
  const handleFaviconRemove = async () => {
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Remove Favicon?",
      text: "This will reset the favicon to the default.",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, remove it",
    });
    if (!confirm.isConfirmed) return;
    try {
      setFaviconRemoving(true);
      const res = await api.delete(`/api/master/admins/${id}/favicon`);
      setCompanyFavicon(res.data.favicon);
      Swal.fire({ icon: "success", title: "Favicon Removed", text: "Reverted to default favicon.", timer: 2000, showConfirmButton: false });
    } catch (err) {
      console.error("Favicon remove error:", err);
      Swal.fire({ icon: "error", title: "Failed", text: err.response?.data?.message || "Could not remove favicon." });
    } finally {
      setFaviconRemoving(false);
    }
  };

  // Submit Plan Updates
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.patch(`/api/master/customize-plan/${id}`, {
        price: Number(price),
        maxUsers: Number(maxUsers),
        billingCycle,
        features: selectedFeatures,
        navTemplate
      });

      Swal.fire({
        icon: "success",
        title: "Plan Customized",
        text: "Custom plan settings saved successfully for this admin account.",
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      console.error("Customize plan save error:", err);
      Swal.fire({
        icon: "error",
        title: "Failed to Save",
        text: err.response?.data?.message || "Could not update custom plan settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="mt-4 text-slate-600 font-semibold animate-pulse">Loading custom plan details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Back Button */}
      <button
        onClick={() => navigate("/master/customize")}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm font-semibold cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Customize
      </button>

      {/* Hero Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-xl shadow-md">
            {adminName?.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">
              {legacyPlan} Account
            </span>
            <h2 className="text-2xl font-extrabold text-slate-800 mt-2">
              {adminName}
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">{adminEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-slate-500 text-xs font-semibold">
          <Sliders className="w-4 h-4 text-slate-400" />
          Plan Customization Mode
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns - Plan Settings */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <Settings className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-slate-800 text-lg">General Settings</h3>
            </div>

            {/* Price Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                Plan Price (₹)
              </label>
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              />
            </div>

            {/* Seat Capacity Limit */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Seat Capacity (maxUsers)
              </label>
              <input
                type="number"
                min="1"
                value={maxUsers}
                onChange={(e) => setMaxUsers(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              />
            </div>

            {/* Billing Cycle */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Billing Cycle
              </label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm cursor-pointer"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="halfYearly">Half-Yearly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
                <option value="free">Free</option>
              </select>
            </div>

            {/* Navigation Layout Toggle */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Navigation Layout Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNavTemplate("sidebar")}
                  className={`py-2 px-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer ${navTemplate === "sidebar"
                      ? "border-blue-600 bg-blue-50/50 text-blue-600 shadow-sm"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                >
                  <div className="w-8 h-6 border border-current rounded flex overflow-hidden opacity-80">
                    <div className="w-2.5 bg-current border-r border-current"></div>
                    <div className="flex-1 bg-transparent"></div>
                  </div>
                  Sidebar Menu
                </button>
                <button
                  type="button"
                  onClick={() => setNavTemplate("navbar")}
                  className={`py-2 px-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer ${navTemplate === "navbar"
                      ? "border-blue-600 bg-blue-50/50 text-blue-600 shadow-sm"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                >
                  <div className="w-8 h-6 border border-current rounded flex flex-col overflow-hidden opacity-80">
                    <div className="h-2 bg-current border-b border-current"></div>
                    <div className="flex-1 bg-transparent"></div>
                  </div>
                  Navbar Menu
                </button>
              </div>
            </div>
          </div>

          {/* Company Branding */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <ImageIcon className="w-5 h-5 text-purple-500" />
              <h3 className="font-bold text-slate-800 text-lg">Company Logo</h3>
            </div>
            {/* Logo Preview */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50">
                {companyLogo ? (
                  <img src={companyLogo} alt="Company Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <ImageIcon className="w-10 h-10 text-slate-300" />
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={logoUploading || logoRemoving}
                  onClick={() => logoInputRef.current?.click()}
                  className="flex items-center gap-2 text-xs font-bold text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-4 py-2 rounded-xl border border-purple-200 transition-all cursor-pointer disabled:opacity-50"
                >
                  {logoUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {logoUploading ? "Uploading..." : "Change Logo"}
                </button>
                {companyLogo && companyLogo !== "https://image2url.com/r2/default/images/1774247571292-e7459e42-1868-4206-bd5c-bb4c59de5716.png" && (
                  <button
                    type="button"
                    disabled={logoUploading || logoRemoving}
                    onClick={handleLogoRemove}
                    className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl border border-red-200 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {logoRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {logoRemoving ? "Removing..." : "Remove Logo"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Company Favicon */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <ImageIcon className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-slate-800 text-lg">Company Favicon</h3>
            </div>
            {/* Favicon Preview */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50">
                {companyFavicon ? (
                  <img
                    src={companyFavicon.includes("res.cloudinary.com") ? companyFavicon.replace("/upload/", "/upload/e_trim/") : companyFavicon}
                    alt="Company Favicon"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <img src="/favicon.png" alt="Default Favicon" className="w-full h-full object-contain p-1" />
                )}
              </div>
              <input
                ref={faviconInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/x-icon"
                className="hidden"
                onChange={handleFaviconUpload}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={faviconUploading || faviconRemoving}
                  onClick={() => faviconInputRef.current?.click()}
                  className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl border border-indigo-200 transition-all cursor-pointer disabled:opacity-50"
                >
                  {faviconUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {faviconUploading ? "Uploading..." : "Change Favicon"}
                </button>
                {companyFavicon && (
                  <button
                    type="button"
                    disabled={faviconUploading || faviconRemoving}
                    onClick={handleFaviconRemove}
                    className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl border border-red-200 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {faviconRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {faviconRemoving ? "Removing..." : "Remove Favicon"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Trigger Card */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3.5 rounded-2xl font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save Custom Settings
          </button>
        </div>

        {/* Right Columns - Feature Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <Sliders className="w-5 h-5 text-purple-500" />
                <h3 className="font-bold text-slate-800 text-lg">Custom Features Assignment</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-all cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs font-bold text-slate-600 hover:text-slate-800 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Features Checklist List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
              {FALLBACK_FEATURES.map((feat) => {
                const isSelected = selectedFeatures.includes(feat.route);
                return (
                  <div
                    key={feat.route}
                    onClick={() => handleFeatureToggle(feat.route)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex gap-3 items-start select-none ${isSelected
                        ? "border-blue-200 bg-blue-50/20 hover:border-blue-300"
                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/40"
                      }`}
                  >
                    <div className="mt-0.5 text-blue-600">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 fill-blue-600/10" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        {feat.label}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {feat.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CustomizingAdmin;
