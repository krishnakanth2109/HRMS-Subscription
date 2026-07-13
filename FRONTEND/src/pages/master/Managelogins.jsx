import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import api from "../../api";
import Swal from "sweetalert2";
import {
  Search, Filter, Key, Trash2, Receipt, MoreVertical,
  Users, CheckCircle2, Ban, Clock, ShieldAlert, Mail, AlertTriangle, ShieldCheck
} from "lucide-react";

/* ──────────────────────────────────────────────
   TINY HELPERS
────────────────────────────────────────────── */
const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "Never logged in";


const isPlanExpired = (expiresAt) =>
  expiresAt ? new Date() > new Date(expiresAt) : false;

const getDaysAgo = (date) => {
  if (!date) return "";
  const diffTime = Math.abs(new Date() - new Date(date));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return `(${diffDays} days ago)`;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const billingCycleLabel = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  halfYearly: "Half-Yearly",
  yearly: "Annual",
};

/* ──────────────────────────────────────────────
   TOGGLE COMPONENT
────────────────────────────────────────────── */
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
        transition-all duration-300 ease-in-out focus:outline-none shadow-inner
        ${checked ? "bg-blue-600 shadow-blue-500/20" : "bg-slate-200"}
        ${disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-105"}
      `}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function Badge({ active, label, variant = "status" }) {
  const styles = variant === "danger"
    ? "bg-rose-50 text-rose-700 border border-rose-200"
    : (active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200");

  const dot = variant === "danger" ? "bg-rose-500" : (active ? "bg-emerald-500" : "bg-slate-400");

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot} ${active && variant !== "danger" ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  );
}

/* ──────────────────────────────────────────────
   MAIN PAGE
────────────────────────────────────────────── */
export default function ManageLogins() {
  const [admins, setAdmins] = useState([]);
  const [existingPlans, setExistingPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("All Plans");
  const [pendingChanges, setPendingChanges] = useState({});
  const [expandedStaff, setExpandedStaff] = useState({});
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const actionMenuRef = useRef(null);

  const toggleStaff = (adminId) => {
    setExpandedStaff(prev => ({ ...prev, [adminId]: !prev[adminId] }));
  };

  const toggleActionMenu = (adminId) => {
    setOpenActionMenu(prev => prev === adminId ? null : adminId);
  };

  // Close action menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        setOpenActionMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChangePassword = async (admin) => {
    setOpenActionMenu(null);
    const { value: newPassword, isConfirmed } = await Swal.fire({
      title: `Change Password`,
      html: `
        <p style="color:#64748b;font-size:14px;margin-bottom:16px">Set a new password for <strong>${admin.companyName}</strong></p>
        <div style="position:relative;display:flex;align-items:center;justify-content:center;margin-bottom:12px">
          <input id="swal-password" type="password" placeholder="New password (min. 6 chars)" class="swal2-input" style="width:85%;margin:0;padding-right:44px;border-radius:10px;font-size:14px" />
          <button id="eye-pw" type="button" style="position:absolute;right:10%;background:none;border:none;cursor:pointer;color:#94a3b8;padding:6px;display:flex;align-items:center;transition:color 0.2s">
            <svg id="eye-pw-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
        <div style="position:relative;display:flex;align-items:center;justify-content:center">
          <input id="swal-confirm" type="password" placeholder="Confirm new password" class="swal2-input" style="width:85%;margin:0;padding-right:44px;border-radius:10px;font-size:14px" />
          <button id="eye-cf" type="button" style="position:absolute;right:10%;background:none;border:none;cursor:pointer;color:#94a3b8;padding:6px;display:flex;align-items:center;transition:color 0.2s">
            <svg id="eye-cf-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      `,
      confirmButtonText: "Update Password",
      confirmButtonColor: "#2563eb",
      showCancelButton: true,
      focusConfirm: false,
      didOpen: () => {
        const EYE_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
        const EYE_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

        const makeToggle = (btnId, inputId) => {
          document.getElementById(btnId).addEventListener("click", () => {
            const input = document.getElementById(inputId);
            const btn = document.getElementById(btnId);
            const isHidden = input.type === "password";
            input.type = isHidden ? "text" : "password";
            btn.innerHTML = isHidden ? EYE_OFF : EYE_OPEN;
            btn.style.color = isHidden ? "#2563eb" : "#94a3b8";
          });
        };
        makeToggle("eye-pw", "swal-password");
        makeToggle("eye-cf", "swal-confirm");
      },
      preConfirm: () => {
        const pw = document.getElementById("swal-password").value;
        const cf = document.getElementById("swal-confirm").value;
        if (!pw || pw.length < 6) {
          Swal.showValidationMessage("Password must be at least 6 characters");
          return false;
        }
        if (pw !== cf) {
          Swal.showValidationMessage("Passwords do not match");
          return false;
        }
        return pw;
      }
    });

    if (!isConfirmed || !newPassword) return;

    try {
      const res = await api.patch(`/api/admin/change-password/${admin.id}`, { newPassword });
      toast(res.data.message || "Password updated successfully", "success");
    } catch (err) {
      toast(err.response?.data?.message || "Failed to update password", "error");
    }
  };

  const handleDeleteAdmin = async (admin) => {
    setOpenActionMenu(null);

    const { isConfirmed } = await Swal.fire({
      title: "Delete Admin Account?",
      html: `
        <p style="color:#ef4444;font-size:14px;font-weight:700;margin-bottom:10px">⚠️ WARNING: THIS IS PERMANENT</p>
        <p style="color:#4b5563;font-size:14px;line-height:1.5">
          Deleting the admin account for <strong>${escapeHtml(admin.companyName)}</strong> will permanently erase:
        </p>
        <ul style="text-align:left;color:#4b5563;font-size:13px;margin:12px auto;width:80%;line-height:1.6;background:#fef2f2;padding:12px;border-radius:8px;border:1px solid #fee2e2">
          <li>• The Admin credentials and profile</li>
          <li>• All ${admin.totalEmployees} employee/staff logins & profiles</li>
          <li>• All associated attendance and shift data</li>
        </ul>
        <p style="color:#64748b;font-size:13px">Type <strong>DELETE</strong> below to confirm deletion:</p>
        <input id="swal-delete-confirm" type="text" class="swal2-input" placeholder="DELETE" style="width:60%;margin-top:10px;text-align:center;font-weight:bold;border-radius:8px" />
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Permanently Delete",
      cancelButtonText: "Cancel",
      preConfirm: () => {
        const text = document.getElementById("swal-delete-confirm").value;
        if (text !== "DELETE") {
          Swal.showValidationMessage("Please type DELETE to confirm");
          return false;
        }
        return true;
      }
    });

    if (!isConfirmed) return;

    try {
      const res = await api.delete(`/api/admin/delete-admin/${admin.id}`);
      toast(res.data.message || "Admin account deleted successfully", "success");
      setAdmins(prev => prev.filter(a => a.id !== admin.id));
    } catch (err) {
      toast(err.response?.data?.message || "Failed to delete admin account", "error");
    }
  };

  const handleViewBills = (admin) => {
    setOpenActionMenu(null);

    const billRows = [
      ["Admin", admin.companyName || "N/A"],
      ["Plan", admin.plan || "N/A"],
      ["Billing Cycle", billingCycleLabel[admin.billingCycle] || "N/A"],
      ["Per Employee Price", formatCurrency(admin.planPrice)],
      ["Bill Paid", formatCurrency(admin.billPaid)],
      ["Paid On", formatDate(admin.lastPaymentAt || admin.planActivatedAt || admin.createdAt)],
      ["Plan Starts", formatDate(admin.planActivatedAt || admin.createdAt)],
      ["Plan Expires", formatDate(admin.planExpiresAt)],
      ["Payment Status", admin.isPaid ? "Paid" : "Not Paid"],
    ];

    Swal.fire({
      title: "Billing Details",
      html: `
        <div style="text-align:left;margin-top:10px">
          <p style="margin:0 0 16px;color:#64748b;font-size:14px">
            Overview for <strong style="color:#0f172a">${escapeHtml(admin.companyName || "Admin")}</strong>
          </p>
          <div style="display:grid;gap:12px">
            ${billRows.map(([label, value]) => `
              <label style="display:grid;gap:6px">
                <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#64748b">${escapeHtml(label)}</span>
                <input readonly value="${escapeHtml(value)}" style="width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;font-size:14px;font-weight:600;color:#0f172a;background:#f8fafc;outline:none" />
              </label>
            `).join("")}
          </div>
        </div>
      `,
      confirmButtonText: "Close",
      confirmButtonColor: "#2563eb",
      width: 520,
    });
  };

  /* ── SWEET ALERT HELPERS ── */
  const toast = (message, icon = "success") => {
    Swal.fire({
      toast: true,
      position: "bottom-end",
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      icon,
      title: message,
    });
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [loginRes, planRes] = await Promise.all([
        api.get("/api/admin/login-access"),
        api.get("/api/admin/all-plans").catch(() => ({ data: [] }))
      ]);
      setAdmins(loginRes.data);
      setExistingPlans(planRes.data || []);
    } catch (err) {
      toast("Failed to load data.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggleAdmin = (adminId, value) => {
    setPendingChanges((prev) => ({
      ...prev,
      [adminId]: { ...prev[adminId], loginEnabled: value }
    }));
  };

  const handleToggleEmployees = (adminId, value) => {
    setPendingChanges((prev) => ({
      ...prev,
      [adminId]: { ...prev[adminId], employeesLoginEnabled: value }
    }));
  };

  const getAdminLogin = (admin) => pendingChanges[admin.id]?.loginEnabled ?? admin.loginEnabled;

  const getEmployeeLogin = (admin, adminOn) => {
    if (!adminOn) return false;
    if (pendingChanges[admin.id]?.employeesLoginEnabled !== undefined) return pendingChanges[admin.id].employeesLoginEnabled;
    if (admin.totalEmployees === 0) return false;
    return admin.disabledEmployees < admin.totalEmployees;
  };

  const handleSave = async (adminId) => {
    const changes = pendingChanges[adminId];
    if (!changes) return;
    const admin = admins.find((a) => a.id === adminId);
    const willDisableAdmin = changes.loginEnabled === false && admin.loginEnabled !== false;

    const doSave = async () => {
      setSaving((prev) => ({ ...prev, [adminId]: true }));
      try {
        const promises = [];
        if (changes.loginEnabled !== undefined) promises.push(api.patch(`/api/admin/login-access/admin/${adminId}`, { loginEnabled: changes.loginEnabled }));
        if (changes.employeesLoginEnabled !== undefined) promises.push(api.patch(`/api/admin/login-access/employees/${adminId}`, { loginEnabled: changes.employeesLoginEnabled }));
        await Promise.all(promises);
        setAdmins((prev) => prev.map((a) => (a.id !== adminId ? a : {
          ...a,
          loginEnabled: changes.loginEnabled ?? a.loginEnabled,
          disabledEmployees: changes.employeesLoginEnabled === false ? a.totalEmployees : (changes.employeesLoginEnabled === true ? 0 : a.disabledEmployees),
        })));
        setPendingChanges((prev) => { const n = { ...prev }; delete n[adminId]; return n; });
        toast("Changes saved successfully!");
      } catch (err) {
        toast("Failed to save changes.", "error");
      } finally {
        setSaving((prev) => ({ ...prev, [adminId]: false }));
      }
    };

    if (willDisableAdmin) {
      Swal.fire({
        title: "Stop Admin Login?",
        text: `Disabling "${admin.companyName}" will also block all staff members immediately.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        confirmButtonText: "Yes, Stop Login"
      }).then((result) => { if (result.isConfirmed) doSave(); });
    } else {
      doSave();
    }
  };

  /* ── DATA COMPUTATION ── */
  const stats = useMemo(() => ({
    all: admins.length,
    active: admins.filter(a => a.loginEnabled !== false && !isPlanExpired(a.planExpiresAt)).length,
    blocked: admins.filter(a => a.loginEnabled === false).length,
    expired: admins.filter(a => isPlanExpired(a.planExpiresAt)).length,
  }), [admins]);

  const uniquePlans = useMemo(() => {
    const adminPlans = admins.map(a => a.plan).filter(Boolean);
    const apiPlans = existingPlans.map(p => p.planName).filter(Boolean);
    return ["All Plans", ...new Set([...adminPlans, ...apiPlans])];
  }, [admins, existingPlans]);

  const violations = useMemo(() => {
    return admins.filter(a => isPlanExpired(a.planExpiresAt) && a.disabledEmployees < a.totalEmployees && a.totalEmployees > 0);
  }, [admins]);

  const filtered = admins.filter((a) => {
    const matchesSearch = a.companyName?.toLowerCase().includes(search.toLowerCase()) || a.name?.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = planFilter === "All Plans" || a.plan === planFilter;
    const isExpired = isPlanExpired(a.planExpiresAt);
    let matchesStatus = true;
    if (activeFilter === "active") matchesStatus = a.loginEnabled !== false && !isExpired;
    if (activeFilter === "blocked") matchesStatus = a.loginEnabled === false;
    if (activeFilter === "expired") matchesStatus = isExpired;
    return matchesSearch && matchesPlan && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-20 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* ── HEADER ── */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            Access Management
          </h1>
          <p className="mt-2 text-sm text-slate-500 font-medium max-w-2xl">
            Control login access for administrators and their staff, monitor subscription statuses, and manage billing accounts.
          </p>
        </div>

        {/* ── COUNTS / STATS ── */}
        {!loading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { id: "all", label: "Total Accounts", value: stats.all, icon: Users, color: "blue" },
              { id: "active", label: "Active Access", value: stats.active, icon: CheckCircle2, color: "emerald" },
              { id: "blocked", label: "Blocked", value: stats.blocked, icon: Ban, color: "rose" },
              { id: "expired", label: "Expired Plan", value: stats.expired, icon: Clock, color: "amber" },
            ].map((s) => {
              const Icon = s.icon;
              const isActive = activeFilter === s.id;

              const colorMaps = {
                blue: "from-blue-600 to-indigo-700 shadow-blue-500/30",
                emerald: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
                rose: "from-rose-500 to-red-600 shadow-rose-500/30",
                amber: "from-amber-500 to-orange-500 shadow-amber-500/30",
              };

              return (
                <button
                  key={s.id}
                  onClick={() => { setActiveFilter(s.id); setSearch(""); }}
                  className={`text-left transition-all duration-300 rounded-3xl p-6 relative overflow-hidden group
                    ${isActive ? `bg-gradient-to-br ${colorMaps[s.color]} text-white shadow-xl scale-105 z-10` : "bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md"}`}
                >
                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${isActive ? "text-white/80" : "text-slate-400"}`}>
                        {s.label}
                      </p>
                      <p className={`text-4xl font-black mt-2 tracking-tight ${isActive ? "text-white" : "text-slate-800"}`}>
                        {s.value}
                      </p>
                    </div>
                    <div className={`p-3 rounded-2xl ${isActive ? "bg-white/20 text-white" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600 transition-colors"}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── SEPARATE FRAME: STAFF LOGIN VIOLATIONS ── */}
        {!loading && violations.length > 0 && (
          <div className="bg-white border border-rose-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-rose-50 to-white px-6 py-4 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
                </div>
                <h2 className="text-sm font-bold text-rose-800 uppercase tracking-widest">Identify Violations: Staff active on Expired Plans</h2>
              </div>
              <span className="bg-rose-600 text-white shadow-sm shadow-rose-200 text-xs font-black px-3 py-1 rounded-full">{violations.length} ACCOUNTS</span>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {violations.map(v => (
                <div
                  key={v.id}
                  onClick={() => { setSearch(v.email); setActiveFilter("all"); setPlanFilter("All Plans"); }}
                  className="bg-white border border-rose-200 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:shadow-md transition-all group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate group-hover:text-rose-600 transition-colors">{v.companyName}</p>
                    <p className="text-xs text-rose-500 font-semibold mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(v.planExpiresAt)} <span className="ml-1 opacity-80">{getDaysAgo(v.planExpiresAt)}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0 bg-rose-50 px-3 py-2 rounded-xl">
                    <p className="text-[9px] font-black text-rose-400">STAFF ACTIVE</p>
                    <p className="text-lg font-black text-rose-600">{v.totalEmployees - v.disabledEmployees}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SEARCH & PLAN FILTER ── */}
        <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by company or email..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 hover:bg-slate-100/50 transition-colors border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-medium text-slate-700 placeholder-slate-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-1.5 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-black text-slate-500 uppercase">Plan:</span>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="text-sm font-bold text-slate-800 outline-none bg-transparent py-2 cursor-pointer pr-2 min-w-[120px]"
            >
              {uniquePlans.map(plan => <option key={plan} value={plan}>{plan}</option>)}
            </select>
          </div>
        </div>

        {/* ── MAIN LIST AREA ── */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200/50 animate-pulse rounded-3xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-300">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <Search className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-500 font-bold text-lg">No records found</p>
            <p className="text-slate-400 text-sm mt-1 mb-4">Try adjusting your filters or search query.</p>
            <button
              onClick={() => { setSearch(""); setPlanFilter("All Plans"); setActiveFilter("all"); }}
              className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {filtered.map((admin) => {
              const adminOn = getAdminLogin(admin);
              const empOn = getEmployeeLogin(admin, adminOn);
              const expired = isPlanExpired(admin.planExpiresAt);
              const hasPending = !!pendingChanges[admin.id];

              return (
                <div
                  key={admin.id}
                  className={`bg-white rounded-3xl transition-all duration-300 relative group overflow-visible
                    ${hasPending ? "border-blue-300 shadow-lg shadow-blue-500/10 ring-2 ring-blue-50" : "border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300"}`}
                >
                  <div className="p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6">

                    {/* Left: Info */}
                    <div className="flex items-start gap-5 flex-1 min-w-0">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-xl font-black shadow-inner transition-colors duration-300
                        ${adminOn ? "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}>
                        {admin.companyName ? admin.companyName.charAt(0).toUpperCase() : admin.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-1.5">
                          <h3 className="text-lg font-bold text-slate-900 truncate tracking-tight">{admin.companyName || admin.name}</h3>
                          <Badge active={adminOn} label={adminOn ? "Active" : "Disabled"} />
                          {expired && <Badge variant="danger" label="Expired" />}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-slate-500 mb-4 truncate font-medium">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {admin.email}
                        </div>

                        <div className="flex flex-wrap gap-4 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 inline-flex items-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                            Plan: <span className="text-slate-800">{admin.plan || "N/A"}</span>
                          </span>
                          <span className="w-px h-3 bg-slate-300 mx-1"></span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            Expires: <span className={expired ? "text-rose-600 font-black" : "text-slate-800"}>{formatDate(admin.planExpiresAt)}</span>
                          </span>
                          <span className="w-px h-3 bg-slate-300 mx-1"></span>
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-emerald-400" />
                            Staff: <span className="text-slate-800">{admin.totalEmployees + (admin.supportAdminCount || 0)} {admin.plan?.toLowerCase() === 'owner' ? '/ \u221E' : (admin.userLimit ? `/ ${admin.userLimit}` : '')}</span>
                          </span>
                          <span className="w-px h-3 bg-slate-300 mx-1"></span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                            Last Login: <span className="text-slate-800">{formatDateTime(admin.lastLoginAt)}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Controls & Actions */}
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100 shrink-0">

                      <div className="flex items-center gap-3 px-4 border-r border-slate-200">
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Admin Login</span>
                        <Toggle checked={adminOn} onChange={(v) => handleToggleAdmin(admin.id, v)} disabled={saving[admin.id]} />
                      </div>

                      <div className="flex items-center gap-3 px-4 border-r border-slate-200">
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Staff Login</span>
                        <Toggle checked={empOn} onChange={(v) => handleToggleEmployees(admin.id, v)} disabled={saving[admin.id] || admin.totalEmployees === 0 || !adminOn} />
                      </div>

                      <div className="pl-2 flex items-center gap-2">
                        <button
                          onClick={() => handleSave(admin.id)}
                          disabled={!hasPending || saving[admin.id]}
                          className={`px-5 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all ${hasPending
                              ? "bg-blue-600 text-white shadow-md shadow-blue-500/30 hover:bg-blue-700 hover:-translate-y-0.5"
                              : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            }`}
                        >
                          {saving[admin.id] ? "SAVING..." : "SAVE"}
                        </button>

                        {/* Actions Menu */}
                        <div className="relative" ref={openActionMenu === admin.id ? actionMenuRef : null}>
                          <button
                            onClick={() => toggleActionMenu(admin.id)}
                            className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Actions"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {openActionMenu === admin.id && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden transform origin-top-right transition-all">
                              <button
                                onClick={() => handleChangePassword(admin)}
                                className="w-full flex items-center gap-3 px-4 py-3.5 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                              >
                                <Key className="w-4 h-4" /> Change Password
                              </button>
                              <button
                                onClick={() => handleViewBills(admin)}
                                className="w-full flex items-center gap-3 px-4 py-3.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors border-t border-slate-100"
                              >
                                <Receipt className="w-4 h-4" /> View Bills
                              </button>
                              <button
                                onClick={() => handleDeleteAdmin(admin)}
                                className="w-full flex items-center gap-3 px-4 py-3.5 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors border-t border-slate-100"
                              >
                                <Trash2 className="w-4 h-4" /> Delete Account
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Staff Directory Expansion */}
                  {expandedStaff[admin.id] && admin.staffNames && admin.staffNames.length > 0 && (
                    <div className="px-6 pb-6 pt-4 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Staff Directory</p>
                      <div className="flex flex-wrap gap-2">
                        {admin.staffNames.map((name, idx) => (
                          <span key={idx} className="bg-white border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-lg font-bold shadow-sm">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

