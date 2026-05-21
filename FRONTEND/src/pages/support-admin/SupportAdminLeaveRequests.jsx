import React, { useState, useEffect, useCallback } from "react";
import Swal from "sweetalert2";
import api, { applyForLeave, getLeaveBalance } from "../../api";

const formatDate = (d) =>
  !d ? "" : new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const getDayCount = (from, to) =>
  !from || !to ? 0 : Math.ceil(Math.abs(new Date(to) - new Date(from)) / 86400000) + 1;

const STATUS_STYLE = {
  Approved: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  Rejected: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500" },
  Pending: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  Cancelled: { bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400" },
};

const LeaveBalanceCards = ({ balance }) => {
  if (!balance || balance.length === 0) {
    return (
      <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-sm text-slate-400">
        No leave policy configured by your admin yet. You can still submit leave requests (category may be unpaid).
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      {balance.map((b) => (
        <div key={b.leaveType} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">{b.leaveType}</p>
          <p className="mt-2 text-2xl font-black text-indigo-700">{b.remainingPaidDays ?? "—"}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-1">paid days remaining (cycle)</p>
        </div>
      ))}
    </div>
  );
};

const SupportAdminLeaveRequests = () => {
  const [form, setForm] = useState({
    from: "",
    to: "",
    leaveType: "",
    leaveDayType: "Full Day",
    halfDaySession: "",
    reason: "",
  });
  const [leaveList, setLeaveList] = useState([]);
  const [balance, setBalance] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchMyLeaves = useCallback(async () => {
    try {
      const res = await api.get("/api/leaves/my-leaves");
      setLeaveList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch my leaves:", err);
    }
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const data = await getLeaveBalance();
      const list = Array.isArray(data?.balance) ? data.balance : Array.isArray(data) ? data : [];
      setBalance(list);
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
      setError("Please select Morning or Afternoon for half day.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await applyForLeave({
        from: form.from,
        to: form.to,
        leaveType: form.leaveType,
        leaveDayType: form.leaveDayType,
        halfDaySession: form.halfDaySession || "",
        reason: form.reason,
      });
      setSuccess("Leave request submitted. Your admin will review it.");
      setForm((prev) => ({
        from: "",
        to: "",
        leaveType: balance[0]?.leaveType || "",
        leaveDayType: "Full Day",
        halfDaySession: "",
        reason: "",
      }));
      await Promise.all([fetchMyLeaves(), fetchBalance()]);
      setTimeout(() => {
        setModalOpen(false);
        setSuccess("");
      }, 1800);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to submit leave request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (leaveId) => {
    const r = await Swal.fire({
      title: "Cancel this request?",
      text: "Only pending requests can be removed.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, cancel",
      confirmButtonColor: "#dc2626",
    });
    if (!r.isConfirmed) return;
    try {
      await api.delete(`/api/leaves/cancel/${leaveId}`);
      Swal.fire({ icon: "success", title: "Cancelled", timer: 1400, showConfirmButton: false });
      await fetchMyLeaves();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Could not cancel",
        text: err?.response?.data?.message || "Try again later.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">My leave requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            Apply for leave here. Only your <strong>main admin</strong> can approve or reject support admin leave.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await fetchBalance();
            setError("");
            setSuccess("");
            setModalOpen(true);
          }}
          className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700"
        >
          + Apply for leave
        </button>
      </div>

      <LeaveBalanceCards balance={balance} />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
          <h2 className="font-bold text-slate-800">History</h2>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
            {leaveList.length} records
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          {leaveList.length === 0 ? (
            <div className="p-10 text-center text-slate-400">No leave requests yet.</div>
          ) : (
            leaveList.map((lv) => {
              const s = STATUS_STYLE[lv.status] || STATUS_STYLE.Pending;
              return (
                <div key={lv._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-800">
                      {formatDate(lv.from)} → {formatDate(lv.to)}{" "}
                      <span className="text-slate-400 font-medium">({getDayCount(lv.from, lv.to)}d)</span>
                    </p>
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold">{lv.leaveType}</span> · {lv.leaveDayType}
                      {lv.leavecategory ? ` · ${lv.leavecategory}` : ""}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500" title={lv.reason}>
                      {lv.reason}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${s.bg} ${s.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {lv.status}
                    </span>
                    {lv.status === "Pending" && (
                      <button
                        type="button"
                        onClick={() => handleCancel(lv._id)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !submitting && setModalOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-900">Apply for leave</h3>
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-slate-500">From</label>
                  <input type="date" name="from" value={form.from} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">To</label>
                  <input type="date" name="to" value={form.to} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" required />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">Leave type</label>
                {balance.length > 0 ? (
                  <select name="leaveType" value={form.leaveType} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" required>
                    <option value="">Select type</option>
                    {balance.map((b) => (
                      <option key={b.leaveType} value={b.leaveType}>
                        {b.leaveType}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name="leaveType"
                    value={form.leaveType}
                    onChange={handleChange}
                    placeholder="e.g. Casual Leave"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    required
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">Day type</label>
                <select name="leaveDayType" value={form.leaveDayType} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <option value="Full Day">Full day</option>
                  <option value="Half Day">Half day</option>
                </select>
              </div>
              {form.leaveDayType === "Half Day" && (
                <div>
                  <label className="text-xs font-bold text-slate-500">Session</label>
                  <select name="halfDaySession" value={form.halfDaySession} onChange={handleChange} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" required>
                    <option value="">Select</option>
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-500">Reason</label>
                <textarea name="reason" value={form.reason} onChange={handleChange} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" maxLength={500} required />
              </div>
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              {success && <p className="text-sm font-semibold text-emerald-600">{success}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" disabled={submitting} onClick={() => setModalOpen(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600">
                  Close
                </button>
                <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportAdminLeaveRequests;
