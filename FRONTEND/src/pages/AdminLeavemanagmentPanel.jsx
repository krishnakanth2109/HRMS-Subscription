import React, { useEffect, useState, useCallback, useMemo } from "react";
import api, {
  getLeaveRequests,
  getEmployees,
  approveLeaveRequestById,
  rejectLeaveRequestById,
  getAttendanceByDateRange,
  getLeavePolicy,
  updateLeavePolicy,
  resetLeavePaidDays,
} from "../api";
import {
  FaFilter, FaCheck, FaTimes, FaUsers, FaClock,
  FaSearch, FaChevronDown, FaCog, FaPlus, FaTrash, FaUndo,
} from "react-icons/fa";
import { useLocation } from "react-router-dom";
import Swal from "sweetalert2";

// ─── Helpers ────────────────────────────────────────────────────────────────

const getSecureUrl = (url) => (!url ? "" : url.startsWith("http:") ? url.replace("http:", "https:") : url);
const getDayCount  = (from, to) => !from || !to ? 0 : Math.ceil(Math.abs(new Date(to) - new Date(from)) / 86400000) + 1;
const formatDateShort = (d) => !d ? "" : new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const formatDateTime  = (d) => {
  if (!d) return "-";
  const dt = new Date(d);
  const pad = (n) => String(n).padStart(2, "0");
  let h = dt.getHours(), m = pad(dt.getMinutes()), ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()} ${h}:${m} ${ap}`;
};
const getInitials = (name) => {
  if (!name) return "U";
  const p = name.split(" ");
  return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : p[0][0].toUpperCase();
};

// Deterministic color from a string — gives each leave type its own colour
const PALETTE = [
  { from: "#6366f1", to: "#818cf8", badge: "#eef2ff", text: "#4338ca" },
  { from: "#f43f5e", to: "#fb7185", badge: "#fff1f2", text: "#be123c" },
  { from: "#f59e0b", to: "#fbbf24", badge: "#fffbeb", text: "#b45309" },
  { from: "#10b981", to: "#34d399", badge: "#ecfdf5", text: "#065f46" },
  { from: "#8b5cf6", to: "#a78bfa", badge: "#f5f3ff", text: "#5b21b6" },
  { from: "#0ea5e9", to: "#38bdf8", badge: "#f0f9ff", text: "#0369a1" },
  { from: "#ec4899", to: "#f472b6", badge: "#fdf2f8", text: "#9d174d" },
];

function colorFor(leaveType) {
  if (!leaveType) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < leaveType.length; i++) hash = leaveType.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/* ============================================================================
   LEAVE POLICY MODAL
   Admin can:
   - Add new leave type rows (any name they want)
   - Set paid days limit per type
   - See how many days are already used (with a progress bar)
   - Delete a leave type row
   - Reset the used-days counter per type or for all
   - Set the annual auto-reset month
============================================================================ */
const MONTHS = [
  { v: "01", l: "January" }, { v: "02", l: "February" }, { v: "03", l: "March" },
  { v: "04", l: "April" },   { v: "05", l: "May" },      { v: "06", l: "June" },
  { v: "07", l: "July" },    { v: "08", l: "August" },   { v: "09", l: "September" },
  { v: "10", l: "October" }, { v: "11", l: "November" }, { v: "12", l: "December" },
];

const LeavePolicyModal = ({ onClose, onSaved }) => {
  // Each row: { leaveType: string, paidDaysLimit: number, usedPaidDays: number }
  const [rows, setRows]             = useState([]);
  const [resetMonth, setResetMonth] = useState("01");
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [resetting, setResetting]   = useState(null); // leaveType string | "ALL" | null
  const [error, setError]           = useState("");

  // ✅ NEW: Feature flag states
  const [sandwichLeaveEnabled,  setSandwichLeaveEnabled]  = useState(false);
  const [unplannedAbsenceToLOP, setUnplannedAbsenceToLOP] = useState(false);

  // ── Load existing policy ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await getLeavePolicy();
        if (data?.policies?.length) {
          setRows(data.policies.map((p) => ({
            leaveType:     p.leaveType,
            paidDaysLimit: p.paidDaysLimit,
            usedPaidDays:  p.usedPaidDays ?? 0,
          })));
        } else {
          // First time — start with one blank row so the admin isn't staring at empty space
          setRows([{ leaveType: "", paidDaysLimit: 0, usedPaidDays: 0 }]);
        }
        if (data?.resetMonth) setResetMonth(data.resetMonth);
        // ✅ NEW: Load feature flags
        if (typeof data?.sandwichLeaveEnabled  === "boolean") setSandwichLeaveEnabled(data.sandwichLeaveEnabled);
        if (typeof data?.unplannedAbsenceToLOP === "boolean") setUnplannedAbsenceToLOP(data.unplannedAbsenceToLOP);
      } catch {
        setRows([{ leaveType: "", paidDaysLimit: 0, usedPaidDays: 0 }]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Row mutations ─────────────────────────────────────────────────────────

  const addRow = () => setRows((prev) => [...prev, { leaveType: "", paidDaysLimit: 0, usedPaidDays: 0 }]);

  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const updateRow = (idx, field, value) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    setError("");
  };

  const changeDays = (idx, delta) => {
    setRows((prev) => prev.map((r, i) =>
      i === idx ? { ...r, paidDaysLimit: Math.max(0, (r.paidDaysLimit || 0) + delta) } : r
    ));
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    // Validate: every row needs a non-empty name
    for (const r of rows) {
      if (!r.leaveType.trim()) {
        setError("All leave type names must be filled in.");
        return;
      }
    }
    // Check for duplicate names (case-insensitive)
    const names = rows.map((r) => r.leaveType.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      setError("Duplicate leave type names are not allowed.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateLeavePolicy({
        policies:   rows.map((r) => ({ leaveType: r.leaveType.trim(), paidDaysLimit: r.paidDaysLimit })),
        resetMonth,
        sandwichLeaveEnabled,   // ✅ NEW
        unplannedAbsenceToLOP,  // ✅ NEW
      });
      onSaved?.();
      Swal.fire({ icon: "success", title: "Policy Saved!", timer: 1800, showConfirmButton: false });
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Reset counters ────────────────────────────────────────────────────────

  const handleReset = async (leaveType) => {
    const result = await Swal.fire({
      title: leaveType === "ALL" ? "Reset ALL counters?" : `Reset "${leaveType}"?`,
      text: "Used paid days will be set back to 0.",
      icon: "warning", showCancelButton: true,
      confirmButtonColor: "#EF4444", cancelButtonColor: "#6B7280",
      confirmButtonText: "Yes, Reset",
    });
    if (!result.isConfirmed) return;

    setResetting(leaveType);
    try {
      await resetLeavePaidDays(leaveType === "ALL" ? null : leaveType);
      setRows((prev) => prev.map((r) =>
        leaveType === "ALL" || r.leaveType === leaveType ? { ...r, usedPaidDays: 0 } : r
      ));
      Swal.fire({ icon: "success", title: "Reset!", timer: 1500, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: "error", title: "Reset failed." });
    } finally {
      setResetting(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">Leave Policy Settings</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Add leave types, set paid day limits. Employees choose from these types when applying.
              Days over the limit are automatically marked <strong>Unpaid</strong>.
            </p>
          </div>
          <button onClick={onClose} className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition shrink-0">
            <FaTimes size={13} />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-indigo-500" />
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-3">

            {/* Column headers */}
            {rows.length > 0 && (
              <div className="grid grid-cols-[1fr_130px_80px_32px] gap-3 px-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Leave Type Name</span>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Paid Days / Year</span>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Used</span>
                <span />
              </div>
            )}

            {/* Leave type rows */}
            {rows.map((row, idx) => {
              const c    = colorFor(row.leaveType);
              const pct  = row.paidDaysLimit > 0 ? Math.min(100, Math.round((row.usedPaidDays / row.paidDaysLimit) * 100)) : 0;
              const isExhausted = row.paidDaysLimit > 0 && row.usedPaidDays >= row.paidDaysLimit;

              return (
                <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="grid grid-cols-[1fr_130px_80px_32px] gap-3 items-center mb-2">

                    {/* Leave type name input */}
                    <input
                      type="text"
                      placeholder="e.g. Casual Leave"
                      value={row.leaveType}
                      onChange={(e) => updateRow(idx, "leaveType", e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-400 placeholder:font-normal placeholder:text-slate-300"
                    />

                    {/* Paid days stepper */}
                    <div className="flex items-center gap-1 justify-center">
                      <button
                        type="button"
                        onClick={() => changeDays(idx, -1)}
                        className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 font-bold flex items-center justify-center transition text-base"
                      >−</button>
                      <input
                        type="number"
                        min="0"
                        value={row.paidDaysLimit}
                        onChange={(e) => updateRow(idx, "paidDaysLimit", Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-14 text-center border border-slate-200 rounded-lg py-1.5 text-sm font-bold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <button
                        type="button"
                        onClick={() => changeDays(idx, 1)}
                        className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 font-bold flex items-center justify-center transition text-base"
                      >+</button>
                    </div>

                    {/* Used days + reset */}
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-sm font-bold" style={{ color: isExhausted ? "#ef4444" : "#64748b" }}>
                        {row.usedPaidDays}
                      </span>
                      {row.usedPaidDays > 0 && (
                        <button
                          type="button"
                          onClick={() => handleReset(row.leaveType)}
                          disabled={resetting === row.leaveType}
                          className="text-[9px] font-bold text-red-400 hover:text-red-600 transition flex items-center gap-0.5"
                          title="Reset used days"
                        >
                          <FaUndo size={7} /> {resetting === row.leaveType ? "…" : "reset"}
                        </button>
                      )}
                    </div>

                    {/* Delete row */}
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:bg-red-50 hover:text-red-500 border border-transparent hover:border-red-200 transition"
                      title="Remove this leave type"
                    >
                      <FaTrash size={11} />
                    </button>
                  </div>

                  {/* Progress bar — only shown when limit > 0 and type has a name */}
                  {row.paidDaysLimit > 0 && row.leaveType.trim() && (
                    <div className="mt-1">
                      <div className="w-full h-1.5 rounded-full bg-white border border-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: pct >= 100 ? "#ef4444" : pct >= 70 ? "#f59e0b" : c.from,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {row.usedPaidDays} used · {Math.max(0, row.paidDaysLimit - row.usedPaidDays)} remaining
                        {isExhausted && <span className="text-red-500 font-bold ml-1">— Unpaid kicks in</span>}
                      </p>
                    </div>
                  )}

                  {row.paidDaysLimit === 0 && row.leaveType.trim() && (
                    <p className="text-[10px] text-slate-400 italic mt-1">0 days limit — all leaves of this type will be Unpaid.</p>
                  )}
                </div>
              );
            })}

            {/* Add row button */}
            <button
              type="button"
              onClick={addRow}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm font-bold text-slate-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/30 transition"
            >
              <FaPlus size={11} /> Add Leave Type
            </button>

            {/* Annual reset month */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <label className="text-xs font-bold text-slate-600 block mb-2">
                Annual Counter Reset Month
                <span className="ml-1 font-normal text-slate-400">(usedPaidDays auto-resets every year on this month)</span>
              </label>
              <select
                value={resetMonth}
                onChange={(e) => setResetMonth(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 bg-white outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>

            {/* ✅ NEW: Advanced Feature Flags */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Advanced Settings</p>

              {/* Sandwich Leave Toggle */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">Sandwich Leave Rule</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    When <strong>ON</strong>, weekends/holidays sandwiched between two leave days are
                    automatically counted as leave days. When <strong>OFF</strong>, gap days are ignored.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSandwichLeaveEnabled((v) => !v)}
                  className={"relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none " + (sandwichLeaveEnabled ? "bg-indigo-600" : "bg-slate-300")}
                >
                  <span
                    className={"inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform " + (sandwichLeaveEnabled ? "translate-x-6" : "translate-x-1")}
                  />
                </button>
              </div>

              {/* Unplanned Absence → LOP Toggle */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">Unplanned Absence → LOP</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    When <strong>ON</strong>, days with no attendance record and no approved leave are
                    automatically treated as Loss of Pay. When <strong>OFF</strong>, unplanned absences
                    are shown informally but do not affect leave balance.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUnplannedAbsenceToLOP((v) => !v)}
                  className={"relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none " + (unplannedAbsenceToLOP ? "bg-indigo-600" : "bg-slate-300")}
                >
                  <span
                    className={"inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform " + (unplannedAbsenceToLOP ? "translate-x-6" : "translate-x-1")}
                  />
                </button>
              </div>
            </div>

            {/* Reset all */}
            {rows.some((r) => r.usedPaidDays > 0) && (
              <button
                type="button"
                onClick={() => handleReset("ALL")}
                disabled={resetting === "ALL"}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold text-red-500 border border-red-200 rounded-xl py-2.5 hover:bg-red-50 transition"
              >
                <FaUndo size={10} />
                {resetting === "ALL" ? "Resetting…" : "Reset ALL Used Days Counter"}
              </button>
            )}

            {error && <p className="text-red-500 text-xs font-semibold bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/40 shrink-0">
            <p className="text-[11px] text-slate-400">{rows.length} leave type{rows.length !== 1 ? "s" : ""} configured</p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm disabled:opacity-60">
                {saving ? "Saving…" : "Save Policy"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
   MAIN ADMIN LEAVE PANEL
============================================================================ */
const AdminLeavePanel = () => {
  const location = useLocation();

  const [leaveList, setLeaveList]         = useState([]);
  const [employeesMap, setEmployeesMap]   = useState(new Map());
  const [allEmployeesList, setAllEmployeesList] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [filterMonth, setFilterMonth]     = useState(new Date().toISOString().slice(0, 7));
  const [filterDept, setFilterDept]       = useState("All");
  const [filterStatus, setFilterStatus]   = useState(location.state?.defaultStatus || "All");
  const [searchQuery, setSearchQuery]     = useState("");
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [employeeImages, setEmployeeImages] = useState({});
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [leavesData, employeesData] = await Promise.all([
        getLeaveRequests().catch(() => []),
        getEmployees().catch(() => []),
      ]);
      setLeaveList(Array.isArray(leavesData) ? leavesData : []);
      setAllEmployeesList(Array.isArray(employeesData) ? employeesData : []);
      const map = new Map();
      employeesData.forEach((emp) => {
        if (emp.employeeId) map.set(emp.employeeId, emp);
        if (emp._id) map.set(emp._id, emp);
      });
      setEmployeesMap(map);
    } catch (err) {
      console.error("Admin Panel Data Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const activeEmployees = useMemo(() =>
    allEmployeesList.filter((e) => e.isActive !== false && (e.status || "").toLowerCase() !== "deactive"),
    [allEmployeesList]
  );

  useEffect(() => {
    const fetchImages = async () => {
      if (!leaveList.length) return;
      const ids = [...new Set(leaveList.map((l) => l.employeeId))];
      const newImages = {};
      for (const empId of ids) {
        if (empId && !employeeImages[empId]) {
          try {
            const res = await api.get(`/api/profile/${empId}`);
            if (res.data?.profilePhoto?.url) newImages[empId] = getSecureUrl(res.data.profilePhoto.url);
          } catch {}
        }
      }
      if (Object.keys(newImages).length) setEmployeeImages((prev) => ({ ...prev, ...newImages }));
    };
    fetchImages();
  }, [leaveList]);

  const enrichedLeaveList = useMemo(() => leaveList.map((leave) => {
    const emp = employeesMap.get(leave.employeeId);
    const exp = Array.isArray(emp?.experienceDetails)
      ? emp.experienceDetails.find((e) => e.lastWorkingDate === "Present") || emp.experienceDetails[0]
      : null;
    return {
      ...leave,
      employeeName: emp?.name || leave.employeeName || "Unknown",
      department:   emp?.currentDepartment || exp?.department || "Unassigned",
    };
  }), [leaveList, employeesMap]);

  const allDepartments = useMemo(() =>
    Array.from(new Set(activeEmployees.map((e) => e.currentDepartment || e.experienceDetails?.[0]?.department))).filter(Boolean),
    [activeEmployees]
  );

  const filteredRequests = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return enrichedLeaveList.filter((req) => {
      const matchDept   = filterDept === "All" || req.department === filterDept;
      const matchStatus = filterStatus === "All" || req.status === filterStatus ||
        (filterStatus === "Today" && req.status === "Approved" && today >= req.from && today <= req.to);
      const matchSearch = (req.employeeId || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.employeeName || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchMonth  = filterMonth ? req.from?.startsWith(filterMonth) : true;
      return matchDept && matchStatus && matchSearch && matchMonth;
    });
  }, [enrichedLeaveList, filterDept, filterStatus, searchQuery, filterMonth]);

  const adminPunchOut = async (employeeId, dateOfRecord) => {
    const loc = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error("Geolocation not supported")); return; }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => reject(new Error("Unable to get location")),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
    return api.post("/api/attendance/admin-punch-out", {
      employeeId, punchOutTime: new Date().toISOString(),
      latitude: loc.latitude, longitude: loc.longitude, adminId: "Admin", date: dateOfRecord,
    });
  };

  const handleAction = async (id, action) => {
    setOpenDropdownId(null);
    const isApprove = action === "approve";

    if (isApprove) {
      const leave = enrichedLeaveList.find((l) => l._id === id);
      if (leave) {
        const today = new Date().toISOString().slice(0, 10);
        if (today >= leave.from && today <= leave.to) {
          try {
            const records = await getAttendanceByDateRange(today, today).catch(() => []);
            const rec = (Array.isArray(records) ? records : []).find((r) => r.employeeId === leave.employeeId);
            if (rec?.punchIn && !rec?.punchOut) {
              const result = await Swal.fire({
                title: `⚠️ ${leave.employeeName} is Currently Working!`,
                html: `<p style="color:#475569;font-size:14px;margin-top:4px;">Employee is punched in today. What would you like to do?</p>`,
                icon: "warning", showCancelButton: true, showDenyButton: true,
                confirmButtonText: "🕐 Punch Out & Approve", denyButtonText: "✅ Approve Only",
                cancelButtonText: "❌ Cancel",
                confirmButtonColor: "#3B82F6", denyButtonColor: "#10B981", cancelButtonColor: "#6B7280",
              });
              if (result.isConfirmed) {
                Swal.fire({ title: "Processing...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                await adminPunchOut(leave.employeeId, today);
                await approveLeaveRequestById(id);
                await fetchAllData();
                Swal.fire("Done!", "Employee punched out and leave approved.", "success");
                return;
              } else if (result.isDenied) {
                Swal.fire({ title: "Processing...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                await approveLeaveRequestById(id);
                await fetchAllData();
                Swal.fire("Approved!", "Leave approved without punching out.", "success");
                return;
              }
              return;
            }
          } catch (err) { console.warn(err); }
        }
      }
    }

    Swal.fire({
      title: isApprove ? "Approve Request?" : "Reject Request?",
      text: `Are you sure you want to ${action} this leave request?`,
      icon: isApprove ? "question" : "warning",
      showCancelButton: true,
      confirmButtonColor: isApprove ? "#10B981" : "#EF4444",
      cancelButtonColor: "#6B7280",
      confirmButtonText: isApprove ? "Yes, Approve" : "Yes, Reject",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          Swal.fire({ title: "Processing...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
          isApprove ? await approveLeaveRequestById(id) : await rejectLeaveRequestById(id);
          await fetchAllData();
          Swal.fire("Success!", `Leave request has been ${action}d.`, "success");
        } catch { Swal.fire("Error!", "Failed to update request.", "error"); }
      }
    });
  };

  const LeaveTypeBadge = ({ type }) => {
    if (!type) return null;
    const c = colorFor(type);
    return (
      <span
        className="px-3 py-0.5 rounded-full text-[10px] font-bold ml-2"
        style={{ background: c.badge, color: c.text }}
      >
        {type}
      </span>
    );
  };

  const DecisionBadge = ({ status }) => {
    const isApproved = status === "Approved";
    return (
      <span className={`px-4 py-1.5 rounded-md text-xs font-bold ${isApproved ? "bg-green-100 text-green-500" : "bg-red-100 text-red-500"}`}>
        {status}
      </span>
    );
  };

  const pendingRequests     = filteredRequests.filter((l) => l.status === "Pending");
  const recentDecisions     = filteredRequests.filter((l) => l.status !== "Pending");
  const totalEmployeesCount = activeEmployees.length;
  const approvedCount       = filteredRequests.filter((l) => l.status === "Approved").length;
  const rejectedCount       = filteredRequests.filter((l) => l.status === "Rejected").length;

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600" />
    </div>
  );

  return (
    <div className="p-6 md:p-8 min-h-screen font-sans max-w-[1400px] mx-auto relative">

      {openDropdownId && (
        <div className="fixed inset-0 z-30 cursor-default" onClick={() => setOpenDropdownId(null)} />
      )}

      {showPolicyModal && (
        <LeavePolicyModal onClose={() => setShowPolicyModal(false)} onSaved={fetchAllData} />
      )}

      {/* HEADER */}
      <div className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Leave Management</h2>
          <p className="text-slate-500 mt-1 text-sm">Oversee and manage employee leave requests efficiently.</p>
        </div>
        <button
          onClick={() => setShowPolicyModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors"
        >
          <FaCog size={13} /> Leave Policy
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {[
          { icon: <FaUsers size={14} />, value: totalEmployeesCount, label: "Total Employees", color: "blue"   },
          { icon: <FaClock size={14} />, value: pendingRequests.length, label: "Pending",       color: "orange" },
          { icon: <FaCheck size={14} />, value: approvedCount,          label: "Approved",      color: "green"  },
          { icon: <FaTimes size={14} />, value: rejectedCount,          label: "Rejected",      color: "red"    },
        ].map(({ icon, value, label, color }) => (
          <div key={label} className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-b-4 border-b-${color}-500`}>
            <div className={`w-8 h-8 rounded-full bg-${color}-50 flex items-center justify-center text-${color}-500 mb-2`}>{icon}</div>
            <div className="text-3xl font-bold text-slate-800">{value}</div>
            <div className="text-sm font-semibold text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-8 flex flex-col lg:flex-row gap-4 items-center justify-between z-20 relative">
        <div className="flex flex-wrap gap-3 items-center w-full lg:w-auto">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
            <FaFilter className="text-indigo-500" />
            <span className="font-semibold text-sm">Filters:</span>
          </div>
          <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer">
            <option value="All">All Departments</option>
            {allDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer">
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Today">On Leave Today</option>
          </select>
        </div>
        <div className="relative w-full lg:w-80">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search Name or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner" />
        </div>
      </div>

      {/* PENDING REQUESTS */}
      <div className="border border-slate-200 rounded-2xl bg-white mb-10 overflow-hidden shadow-sm">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/30">
          <h3 className="text-xl font-bold text-slate-800">Pending Requests</h3>
          <span className="bg-amber-100 text-amber-700 font-bold px-3 py-1 rounded-full text-xs">{pendingRequests.length} Pending</span>
        </div>
        <div className="flex flex-col">
          {pendingRequests.length === 0 ? (
            <div className="p-10 text-center text-slate-500 font-medium">No pending leave requests found.</div>
          ) : pendingRequests.map((lv) => (
            <div key={lv._id} className="p-6 border-b border-slate-100 last:border-0 flex flex-col xl:flex-row justify-between xl:items-center gap-6 hover:bg-slate-50/80 transition duration-150">
              <div className="flex gap-4 items-start w-full">
                <div className="w-12 h-12 rounded-full shrink-0 border border-slate-200 overflow-hidden bg-white flex items-center justify-center font-bold text-slate-700">
                  {employeeImages[lv.employeeId] ? <img src={employeeImages[lv.employeeId]} alt="" className="w-full h-full object-cover" /> : getInitials(lv.employeeName)}
                </div>
                <div className="flex flex-col w-full">
                  <div className="flex flex-wrap items-center gap-1 mb-3">
                    <span className="font-bold text-slate-800 text-base">{lv.employeeName}</span>
                    <span className="text-xs text-slate-400 font-medium ml-1">{lv.department}</span>
                    <LeaveTypeBadge type={lv.leaveType} />
                    {lv.leavecategory && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ml-1 ${lv.leavecategory === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {lv.leavecategory}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-8 mb-4 max-w-sm">
                    <div><span className="text-xs text-slate-400 mb-1 block">Start Date</span><span className="text-sm font-semibold text-slate-700">{formatDateShort(lv.from)}</span></div>
                    <div><span className="text-xs text-slate-400 mb-1 block">End Date</span><span className="text-sm font-semibold text-slate-700">{formatDateShort(lv.to)}</span></div>
                    <div><span className="text-xs text-slate-400 mb-1 block">Duration</span><span className="text-sm font-semibold text-slate-700">{getDayCount(lv.from, lv.to)} Day{getDayCount(lv.from, lv.to) > 1 ? "s" : ""}</span></div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-2 w-full xl:max-w-md">
                    <span className="text-xs text-slate-400 block mb-1">Reason</span>
                    <span className="text-sm text-slate-700 font-medium">{lv.reason}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-1">
                    <FaClock size={10} /> Applied on {formatDateTime(lv.createdAt || lv.appliedDate)}
                  </span>
                </div>
              </div>
              <div className="flex gap-3 shrink-0">
                <button onClick={() => handleAction(lv._id, "approve")} className="flex items-center gap-2 px-5 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-bold text-sm shadow-sm transition-colors"><FaCheck /> Approve</button>
                <button onClick={() => handleAction(lv._id, "reject")}  className="flex items-center gap-2 px-5 py-2.5 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-lg font-bold text-sm shadow-sm transition-colors"><FaTimes /> Reject</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RECENT DECISIONS */}
      <div className="border border-slate-200 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800">Recent Decisions</h3>
          <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">{recentDecisions.length} Processed</span>
        </div>
        <div className="flex flex-col divide-y divide-slate-100 border-t border-slate-100">
          {recentDecisions.length === 0 ? (
            <div className="py-10 text-center text-slate-500 font-medium">No recent decisions found.</div>
          ) : recentDecisions.map((lv) => {
            const isOpen = openDropdownId === lv._id;
            return (
              <div key={lv._id} className="py-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4 hover:bg-slate-50/50 transition duration-150 px-2 rounded-lg -mx-2">
                <div className="flex gap-4 items-center w-full">
                  <div className="w-10 h-10 rounded-full shrink-0 border border-slate-200 overflow-hidden bg-white flex items-center justify-center font-bold text-slate-700">
                    {employeeImages[lv.employeeId] ? <img src={employeeImages[lv.employeeId]} alt="" className="w-full h-full object-cover" /> : getInitials(lv.employeeName)}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-1 mb-1">
                      <span className="font-bold text-slate-800">{lv.employeeName}</span>
                      <LeaveTypeBadge type={lv.leaveType} />
                      {lv.leavecategory && (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${lv.leavecategory === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {lv.leavecategory}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs font-medium text-slate-400">
                      <span>{formatDateShort(lv.from)} - {formatDateShort(lv.to)} ({getDayCount(lv.from, lv.to)} days)</span>
                      <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300" />
                      <span className="truncate max-w-[200px]">Reason: {lv.reason}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 relative shrink-0">
                  <DecisionBadge status={lv.status} />
                  <button onClick={(e) => { e.stopPropagation(); setOpenDropdownId(isOpen ? null : lv._id); }} className={`p-2 rounded-md border ${isOpen ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-200 text-slate-400"}`}>
                    <FaChevronDown size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="absolute right-0 top-10 w-40 bg-white rounded-xl shadow-xl border border-slate-100 z-40 overflow-hidden">
                      <div className="p-1.5 space-y-1">
                        <button onClick={() => handleAction(lv._id, "approve")} className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg flex items-center gap-2"><FaCheck size={12} /> Mark Approved</button>
                        <button onClick={() => handleAction(lv._id, "reject")}  className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600   hover:bg-rose-50   rounded-lg flex items-center gap-2"><FaTimes size={12} /> Mark Rejected</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminLeavePanel;