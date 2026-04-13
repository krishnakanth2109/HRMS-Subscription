// --- START OF FILE EmployeeLeavemanagement.jsx ---

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api, { applyForLeave, getLeaveBalance } from "../api";

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatDate = (d) => !d ? "" :
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const getDayCount = (from, to) =>
  !from || !to ? 0 : Math.ceil(Math.abs(new Date(to) - new Date(from)) / 86400000) + 1;

const STATUS_STYLE = {
  Approved:  { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  Rejected:  { bg: "bg-red-50",     text: "text-red-600",     dot: "bg-red-500"     },
  Pending:   { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400"   },
  Cancelled: { bg: "bg-slate-100",  text: "text-slate-500",   dot: "bg-slate-400"   },
};

// Deterministic color palette — same logic as admin panel so colours match
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

// ─── Leave Balance Cards ─────────────────────────────────────────────────────

const LeaveBalanceCards = ({ balance }) => {
  if (!balance || balance.length === 0) return (
    <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-sm text-slate-400">
      No leave policy configured by your admin yet.
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      {balance.map((b) => {
        const c    = colorFor(b.leaveType);
        const pct  = b.paidDaysLimit > 0 ? Math.min(100, Math.round((b.usedPaidDays / b.paidDaysLimit) * 100)) : 0;
        const isExhausted = b.paidDaysLimit > 0 && b.remainingPaidDays === 0;

        return (
          <div key={b.leaveType} className="rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-white">
            <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${c.from}, ${c.to})` }} />
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold text-slate-500 tracking-widest uppercase">{b.leaveType}</span>
                {b.paidDaysLimit === 0 ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">All Unpaid</span>
                ) : isExhausted ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-500">Exhausted</span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">{b.remainingPaidDays} left</span>
                )}
              </div>
              <div className="flex items-end gap-1 mb-3">
                <span className="text-3xl font-black" style={{ color: b.remainingPaidDays > 0 ? c.from : "#94a3b8" }}>
                  {b.paidDaysLimit > 0 ? b.remainingPaidDays : "—"}
                </span>
                {b.paidDaysLimit > 0 && (
                  <span className="text-xs text-slate-400 font-semibold pb-1">/ {b.paidDaysLimit} paid days</span>
                )}
              </div>
              {b.paidDaysLimit > 0 && (
                <>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mb-1">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: pct >= 100 ? "#ef4444" : pct >= 70 ? "#f59e0b" : c.from }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">{b.usedPaidDays} used · {b.remainingPaidDays} remaining</p>
                </>
              )}
              {b.paidDaysLimit === 0 && (
                <p className="text-[11px] text-slate-400 italic">No paid limit set by admin.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const LeaveWithModal = () => {
  const [form, setForm] = useState({
    from: "", to: "", leaveType: "", leaveDayType: "Full Day", halfDaySession: "", reason: "",
  });

  const [leaveList, setLeaveList]   = useState([]);
  const [balance, setBalance]       = useState([]);   // ← comes from admin's policy
  const [modalOpen, setModalOpen]   = useState(false);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");

  // ── Fetch my leave list ───────────────────────────────────────────────────
  const fetchMyLeaves = useCallback(async () => {
    try {
      const res = await api.get("/api/leaves/my-leaves");
      setLeaveList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch my leaves:", err);
    }
  }, []);

  // ── Fetch admin's leave policy balance (also gives us the leave type list) ─
  const fetchBalance = useCallback(async () => {
    try {
      const data = await getLeaveBalance();
      const list = Array.isArray(data) ? data : [];
      setBalance(list);
      // Pre-select the first available leave type in the form
      if (list.length > 0) {
        setForm((prev) => ({ ...prev, leaveType: prev.leaveType || list[0].leaveType }));
      }
    } catch (err) {
      console.error("Failed to fetch leave balance:", err);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchMyLeaves(), fetchBalance()]);
      setLoading(false);
    })();
  }, [fetchMyLeaves, fetchBalance]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.from || !form.to || !form.leaveType || !form.leaveDayType || !form.reason.trim()) {
      setError("All fields are required.");
      return;
    }
    if (new Date(form.to) < new Date(form.from)) {
      setError("End date cannot be before start date.");
      return;
    }
    if (form.leaveDayType === "Half Day" && !form.halfDaySession) {
      setError("Please select a session (Morning or Afternoon) for half day.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await applyForLeave({
        from:           form.from,
        to:             form.to,
        leaveType:      form.leaveType,
        leaveDayType:   form.leaveDayType,
        halfDaySession: form.halfDaySession || "",
        reason:         form.reason,
      });
      setSuccess("Leave applied successfully!");
      setForm((prev) => ({ from: "", to: "", leaveType: balance[0]?.leaveType || "", leaveDayType: "Full Day", halfDaySession: "", reason: "" }));
      await Promise.all([fetchMyLeaves(), fetchBalance()]);
      setTimeout(() => { setModalOpen(false); setSuccess(""); }, 1600);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to apply leave.");
    } finally {
      setSubmitting(false);
    }
  };

  // Preview of remaining days for the currently selected leave type
  const selectedBalance = balance.find((b) => b.leaveType === form.leaveType);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-emerald-500" />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">My Leave Requests</h2>
          <p className="text-slate-500 text-sm mt-0.5">View your leave history and paid leave balance.</p>
        </div>
        <button
          onClick={() => { setModalOpen(true); setError(""); setSuccess(""); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm text-sm transition-colors"
        >
          + Apply for Leave
        </button>
      </div>

      {/* Balance Cards — dynamic from admin policy */}
      <LeaveBalanceCards balance={balance} />

      {/* Leave History Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-slate-700">Leave History</h3>
          <span className="text-xs font-semibold text-slate-400 bg-white border border-slate-200 px-3 py-1 rounded-full">{leaveList.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">From</th>
                <th className="px-4 py-3 text-left">To</th>
                <th className="px-4 py-3 text-left">Days</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leaveList.length > 0 ? leaveList.map((lv) => {
                const s = STATUS_STYLE[lv.status] || STATUS_STYLE.Pending;
                const c = colorFor(lv.leaveType);
                return (
                  <tr key={lv._id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 font-semibold text-slate-700">{formatDate(lv.from)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{formatDate(lv.to)}</td>
                    <td className="px-4 py-3 text-slate-500">{getDayCount(lv.from, lv.to)}d</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                        style={{ background: c.badge, color: c.text }}>
                        {lv.leaveType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lv.leavecategory ? (
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${lv.leavecategory === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {lv.leavecategory}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate" title={lv.reason}>{lv.reason}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${s.bg} ${s.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {lv.status}
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="7" className="py-12 text-center text-slate-400 font-medium">No leave requests found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Apply Leave Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
          >
            <motion.div
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              {/* Modal header */}
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Apply for Leave</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Paid/Unpaid is auto-assigned based on your balance.</p>
                </div>
                <button onClick={() => setModalOpen(false)} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition font-bold text-lg">×</button>
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">

                {/* Date row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">From</label>
                    <input type="date" name="from" value={form.from} onChange={handleChange}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-slate-50" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">To</label>
                    <input type="date" name="to" value={form.to} onChange={handleChange}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-slate-50" />
                  </div>
                </div>

                {/* ✅ Leave Type — dynamic from admin's policy, NOT hardcoded */}
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">Leave Type</label>
                  {balance.length === 0 ? (
                    <div className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm bg-amber-50 text-amber-700 font-semibold">
                      No leave types configured by admin yet.
                    </div>
                  ) : (
                    <select
                      name="leaveType"
                      value={form.leaveType}
                      onChange={handleChange}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-slate-50 font-semibold"
                    >
                      {balance.map((b) => (
                        <option key={b.leaveType} value={b.leaveType}>
                          {b.leaveType}{b.paidDaysLimit > 0 ? ` (${b.remainingPaidDays} paid left)` : " (Unpaid)"}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Inline balance hint for selected type */}
                  {selectedBalance && selectedBalance.paidDaysLimit > 0 && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.round((selectedBalance.usedPaidDays / selectedBalance.paidDaysLimit) * 100))}%`,
                            background: selectedBalance.remainingPaidDays === 0 ? "#ef4444" : colorFor(selectedBalance.leaveType).from,
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                        {selectedBalance.remainingPaidDays === 0
                          ? "Budget exhausted — will be Unpaid"
                          : `${selectedBalance.remainingPaidDays} / ${selectedBalance.paidDaysLimit} paid days left`}
                      </span>
                    </div>
                  )}
                  {selectedBalance && selectedBalance.paidDaysLimit === 0 && (
                    <p className="text-[11px] text-slate-400 mt-1 italic">This leave type has no paid limit — will be marked Unpaid.</p>
                  )}
                </div>

                {/* Day Type */}
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">Day Type</label>
                  <div className="flex gap-2">
                    {["Full Day", "Half Day"].map((opt) => (
                      <button
                        type="button" key={opt}
                        onClick={() => setForm((p) => ({ ...p, leaveDayType: opt, halfDaySession: "" }))}
                        className={`flex-1 py-2 rounded-xl border text-sm font-bold transition
                          ${form.leaveDayType === opt
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-emerald-300"}`}
                      >{opt}</button>
                    ))}
                  </div>
                </div>

                {/* Half day session */}
                {form.leaveDayType === "Half Day" && (
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">Session</label>
                    <select name="halfDaySession" value={form.halfDaySession} onChange={handleChange}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-slate-50">
                      <option value="">Select Session</option>
                      <option value="Morning">Morning</option>
                      <option value="Afternoon">Afternoon</option>
                    </select>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">
                    Reason <span className="text-slate-400 font-normal">(max 50 chars)</span>
                  </label>
                  <textarea
                    name="reason" value={form.reason} onChange={handleChange}
                    maxLength={50} rows={2} placeholder="Brief reason for leave..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-slate-50 resize-none"
                  />
                  <p className="text-[11px] text-slate-400 text-right mt-0.5">{form.reason.length}/50</p>
                </div>

                {error   && <p className="text-red-500 text-xs font-semibold bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                {success && <p className="text-emerald-600 text-xs font-semibold bg-emerald-50 px-3 py-2 rounded-lg">{success}</p>}

                <button
                  type="submit" disabled={submitting || balance.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-sm transition-colors disabled:opacity-60 text-sm"
                >
                  {submitting ? "Submitting…" : "Submit Leave Request"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeaveWithModal;
// --- END OF FILE EmployeeLeavemanagement.jsx ---