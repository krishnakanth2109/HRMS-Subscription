// --- START OF FILE LeaveWithModal.jsx ---
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getLeaveRequestsForEmployee,
  applyForLeave,
  cancelLeaveRequestById,
} from "../api";


const REASON_LIMIT = 50;

// Convert "2025-11" → "November 2025"
const formatMonth = (monthStr) => {
  if (!monthStr) return "";
  const [year, month] = monthStr.split("-");
  return `${new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  })} ${year}`;
};

const playRequestSound = () => {
  try {
    const audio = new Audio("/sounds/request-button.mp3");
    audio.play().catch(() => {});
  } catch {}
};

const monthOptionsForPast = (n = 12) => {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    out.push(`${y}-${m}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
};

const LeaveWithModal = () => {
  // logged user from sessionStorage
  const [user, setUser] = useState(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("hrmsUser") || localStorage.getItem("hrmsUser");
    if (saved) setUser(JSON.parse(saved));
  }, []);

  // filters
  const monthOptions = useMemo(() => monthOptionsForPast(12), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]);
  const statusOptions = ["All", "Pending", "Approved", "Rejected", "Cancelled"];
  const [selectedStatus, setSelectedStatus] = useState("All");

  // table & details
  const [leaveList, setLeaveList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailsMap, setDetailsMap] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});
  const [detailsError, setDetailsError] = useState({});

  // form / modal
  const [form, setForm] = useState({
    from: "",
    to: "",
    reason: "",
    halfDaySession: "",
    leaveType: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // expanded row
  const [expandedId, setExpandedId] = useState(null);

  // Fetch leaves (tries centralized API first, fallback to fetch with query params)
  const fetchLeaves = useCallback(async () => {
    if (!user?.employeeId) {
      setLeaveList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Try centralized API (some projects extend it to accept filters)
      if (typeof getLeaveRequestsForEmployee === "function") {
        try {
          // attempt with filters if supported
          const maybeResult = await getLeaveRequestsForEmployee(user.employeeId, {
            month: selectedMonth,
            status: selectedStatus === "All" ? undefined : selectedStatus,
          });
          if (Array.isArray(maybeResult)) {
            setLeaveList(maybeResult);
            return;
          }
          // else fall through to fetch
        } catch (err) {
          // continue to fallback fetch
          // console.warn("centralized API failed, falling back to fetch", err);
        }
      }

      // Fallback to fetch /leaves?employeeId=...&month=...&status=...
      const url = new URL(API_BASE, window.location.origin);
      url.searchParams.set("employeeId", user.employeeId);
      if (selectedMonth) url.searchParams.set("month", selectedMonth);
      if (selectedStatus && selectedStatus !== "All") url.searchParams.set("status", selectedStatus);

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error("Failed to fetch leave list");
      }
      const data = await res.json();
      // Normalize to expected shape (best-effort)
      const normalized = (data || []).map((d) => ({
        _id: d._id || d.id,
        from: d.from,
        to: d.to,
        reason: d.reason,
        halfDaySession: d.halfDaySession || d.halfDay || "",
        leaveType: d.leaveType || d.type || "",
        actionDate: d.actionDate || d.action_date || "-",
        requestDate: d.requestDate || d.request_date || d.createdAt || "-",
        approvedBy: d.approvedBy || d.approved_by || "-",
        status: d.status || "Pending",
      }));
      setLeaveList(normalized);
    } catch (err) {
      console.error(err);
      setError("Failed to load leaves.");
      setLeaveList([]);
    } finally {
      setLoading(false);
    }
  }, [user?.employeeId, selectedMonth, selectedStatus]);

  useEffect(() => {
    if (user) fetchLeaves();
  }, [user, fetchLeaves]);

  // handle input changes (for both modal form and inline form)
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "reason" ? value.slice(0, REASON_LIMIT) : value,
    }));
    setSubmitError("");
    setSubmitSuccess("");
  };

  // Submit leave (uses centralized API if available, else POST /leaves)
  const handleSubmit = async (e) => {
    e.preventDefault();
    const { from, to, reason, halfDaySession, leaveType } = form;
    if (!from || !to || !reason || !leaveType) {
      setSubmitError("All fields are required.");
      return;
    }
    setSubmitError("");
    try {
      const payload = {
        employeeId: user.employeeId,
        employeeName: user.name,
        from,
        to,
        reason,
        leaveType,
        leaveDayType: from === to && halfDaySession ? "Half Day" : "Full Day",
        halfDaySession: from === to ? halfDaySession || "" : "",
      };

      // Try centralized applyForLeave
      let applied = false;
      if (typeof applyForLeave === "function") {
        try {
          await applyForLeave(payload);
          applied = true;
        } catch (err) {
          // fallback to fetch
          // console.warn("applyForLeave failed, fallback to fetch POST", err);
        }
      }

      if (!applied) {
        const res = await fetch(API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || "Submit failed");
        }
      }

      playRequestSound();
      setSubmitSuccess("Leave request submitted successfully!");
      setForm({
        from: "",
        to: "",
        reason: "",
        halfDaySession: "",
        leaveType: "",
      });
      setShowForm(false);
      setModalOpen(false);
      await fetchLeaves();
    } catch (err) {
      console.error("submit error", err);
      setSubmitError(err?.message || "Failed to submit leave request.");
    }
  };

  // Cancel leave (tries centralized cancel, else DELETE /leaves/:id or POST /leaves/:id/cancel)
  const handleCancelLeave = async (leaveId) => {
    if (!window.confirm("Are you sure you want to cancel this leave request?")) return;
    try {
      let canceled = false;
      if (typeof cancelLeaveRequestById === "function") {
        try {
          await cancelLeaveRequestById(leaveId);
          canceled = true;
        } catch (err) {
          // fallback
        }
      }
      if (!canceled) {
        // try DELETE
        let res = await fetch(`${API_BASE}/${leaveId}`, { method: "DELETE" });
        if (!res.ok) {
          // try cancel sub-endpoint
          res = await fetch(`${API_BASE}/${leaveId}/cancel`, { method: "POST" });
          if (!res.ok) throw new Error("Cancel failed");
        }
      }
      await fetchLeaves();
    } catch (err) {
      console.error("cancel error", err);
      alert("Failed to cancel the leave request.");
    }
  };

  // Toggle details: tries GET /leaves/:id/details; if not available, show "not available"
  const toggleDetails = async (leaveId) => {
    if (expandedId === leaveId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(leaveId);

    if (detailsMap[leaveId]) return;

    setLoadingDetails((prev) => ({ ...prev, [leaveId]: true }));
    setDetailsError((prev) => ({ ...prev, [leaveId]: "" }));
    try {
      const res = await fetch(`${API_BASE}/${leaveId}/details`);
      if (!res.ok) {
        throw new Error("Details endpoint not available");
      }
      const d = await res.json();
      setDetailsMap((prev) => ({ ...prev, [leaveId]: Array.isArray(d) ? d : [] }));
    } catch (err) {
      console.warn("details fetch failed", err);
      setDetailsError((prev) => ({ ...prev, [leaveId]: "Details not available." }));
      setDetailsMap((prev) => ({ ...prev, [leaveId]: [] }));
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [leaveId]: false }));
    }
  };

  // small helpers for UI rendering
  const renderStatusBadge = (status) => {
    const s = status || "Pending";
    const base = "px-2 py-1 text-xs rounded ";
    if (s === "Pending") return <span className={`${base} bg-yellow-200 text-yellow-700`}>{s}</span>;
    if (s === "Approved") return <span className={`${base} bg-green-200 text-green-700`}>{s}</span>;
    if (s === "Rejected") return <span className={`${base} bg-red-200 text-red-700`}>{s}</span>;
    return <span className={`${base} bg-gray-200 text-gray-700`}>{s}</span>;
  };

  // Render
  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!user) return <div className="text-red-600 p-6 text-center">Employee data not found. Please log in again.</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Heading & primary button */}
      <div className="flex items-center mb-[25px]">
        <h2 className="text-3xl font-bold text-blue-800 flex-1">Leave Request</h2>

        <button
          className={`ml-4 bg-blue-700 hover:bg-blue-900 text-white font-semibold px-6 py-2 rounded-lg shadow transition ${showForm ? "bg-blue-900" : ""}`}
          onClick={() => {
            if (!showForm) {
              setForm({ from: "", to: "", reason: "", halfDaySession: "", leaveType: "" });
              setSubmitError("");
              setSubmitSuccess("");
            }
            setShowForm((v) => !v);
          }}
        >
          {showForm ? "Cancel" : "Leave Request"}
        </button>

        {/* <button
          onClick={() => setModalOpen(true)}
          className="ml-4 bg-emerald-600 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg shadow"
        >
          Quick Apply
        </button> */}
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="mr-2 font-medium text-blue-800">Month:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-blue-300 rounded px-3 py-2 bg-white"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mr-2 font-medium text-blue-800">Status:</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border border-blue-300 rounded px-3 py-2 bg-white"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm text-gray-600">
          <span>Employee:</span>
          <strong>{user.name || user.employeeId}</strong>
        </div>
      </div>

      {/* Inline Form (showForm) */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 bg-white rounded-lg shadow-md p-6 border max-w-xl">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-blue-800 mb-1">From Date</label>
              <input type="date" name="from" value={form.from} onChange={handleChange} className="border rounded px-3 py-2 w-full" />
            </div>

            <div className="flex-1">
              <label className="block text-blue-800 mb-1">To Date</label>
              <input type="date" name="to" value={form.to} onChange={handleChange} className="border rounded px-3 py-2 w-full" />
            </div>

            {form.from && form.to && form.from === form.to && (
              <div className="flex-1">
                <label className="block text-blue-800 mb-1">Half Day</label>
                <select name="halfDaySession" value={form.halfDaySession} onChange={handleChange} className="border rounded px-3 py-2 w-full">
                  <option value="">-- Select --</option>
                  <option value="Morning Half">Morning</option>
                  <option value="Afternoon Half">Afternoon</option>
                </select>
              </div>
            )}
          </div>

          <div className="mt-4">
            <label className="block mb-1 text-blue-800">Reason</label>
            <input
              type="text"
              name="reason"
              value={form.reason}
              onChange={handleChange}
              maxLength={REASON_LIMIT}
              className="border rounded px-3 py-2 w-full"
              placeholder="Enter reason"
            />
            <div className="text-xs text-gray-400 mt-1">{form.reason.length}/{REASON_LIMIT}</div>
          </div>

          <div className="mt-4">
            <label className="block mb-1 text-blue-800">Leave Type</label>
            <select name="leaveType" value={form.leaveType} onChange={handleChange} className="border rounded px-3 py-2 w-full">
              <option value="">-- Select --</option>
              <option value="CASUAL">Casual Leave</option>
              <option value="SICK">Sick Leave</option>
              <option value="EMERGENCY">Emergency Leave</option>
              <option value="PAID">Paid Leave</option>
            </select>
          </div>

          {submitError && <p className="text-red-600 mt-2">{submitError}</p>}
          {submitSuccess && <p className="text-green-600 mt-2">{submitSuccess}</p>}

          <div className="flex gap-4 mt-4">
            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded">Submit</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-500 text-white px-6 py-2 rounded">Cancel</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="overflow-x-auto mb-10">
        <table className="min-w-full bg-white rounded shadow">
          <thead className="bg-blue-100">
            <tr>
              <th className="px-4 py-2">From</th>
              <th className="px-4 py-2">To</th>
              <th className="px-4 py-2">Reason</th>
              <th className="px-4 py-2">HalfDay</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Action Date</th>
              <th className="px-4 py-2">Applied</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Approved By</th>
              <th className="px-4 py-2">Details</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="text-center py-4 text-gray-500">Loading...</td>
              </tr>
            ) : leaveList.length > 0 ? (
              leaveList.map((lv) => (
                <React.Fragment key={lv._id}>
                  <tr className="hover:bg-blue-50">
                    <td className="px-4 py-2">{lv.from || "-"}</td>
                    <td className="px-4 py-2">{lv.to || "-"}</td>
                    <td className="px-4 py-2">{lv.reason || "-"}</td>
                    <td className="px-4 py-2">{lv.halfDaySession || "-"}</td>
                    <td className="px-4 py-2">{lv.leaveType || "-"}</td>
                    <td className="px-4 py-2">{lv.actionDate || "-"}</td>
                    <td className="px-4 py-2">{lv.requestDate || "-"}</td>
                    <td className="px-4 py-2">{renderStatusBadge(lv.status)}</td>
                    <td className="px-4 py-2">{lv.approvedBy || "-"}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleDetails(lv._id)} className="px-3 py-1 text-sm border rounded">
                          {expandedId === lv._id ? "Hide" : "Show"}
                        </button>
                        {lv.status === "Pending" && (
                          <button onClick={() => handleCancelLeave(lv._id)} className="px-3 py-1 text-sm bg-red-500 text-white rounded">
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {expandedId === lv._id && (
                    <tr className="bg-gray-50">
                      <td colSpan={10} className="px-6 py-4">
                        {loadingDetails[lv._id] ? (
                          <div>Loading details...</div>
                        ) : detailsError[lv._id] ? (
                          <div className="text-sm text-gray-500">{detailsError[lv._id]}</div>
                        ) : detailsMap[lv._id] && detailsMap[lv._id].length > 0 ? (
                          detailsMap[lv._id].map((d, i) => (
                            <div key={i} className="flex gap-4 py-1">
                              <span className="w-32">{d.date || "-"}</span>
                              <span className={`px-3 py-1 text-xs rounded-full ${d.leavecategory === "Paid" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                {d.leavecategory || "-"}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500">No details found for this request.</div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="py-4 text-center text-gray-500">No leave requests found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sandwich block */}
      <div className="bg-white p-6 border rounded shadow mt-10">
        <h2 className="text-2xl font-bold text-purple-800 mb-3">Sandwich Leaves</h2>
        <p className="text-gray-600">No sandwich leaves this month.</p>
      </div>

      {/* Modal quick-apply (same form but compact) */}
      {/* <AnimatePresence>
        {modalOpen && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white w-96 p-6 rounded-xl shadow-xl" initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }}>
              <h3 className="text-xl font-bold mb-4 text-emerald-700">Quick Apply Leave</h3>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block font-medium">From</label>
                  <input type="date" name="from" value={form.from} onChange={handleChange} className="w-full border rounded px-3 py-2" />
                </div>

                <div>
                  <label className="mb-1 block font-medium">To</label>
                  <input type="date" name="to" value={form.to} onChange={handleChange} className="w-full border rounded px-3 py-2" />
                </div>

                {form.from && form.to && form.from === form.to && (
                  <div>
                    <label className="mb-1 block font-medium">Half Day</label>
                    <select name="halfDaySession" value={form.halfDaySession} onChange={handleChange} className="w-full border rounded px-3 py-2">
                      <option value="">-- Select --</option>
                      <option value="Morning Half">Morning</option>
                      <option value="Afternoon Half">Afternoon</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1 block font-medium">Leave Type</label>
                  <select name="leaveType" value={form.leaveType} onChange={handleChange} className="w-full border rounded px-3 py-2">
                    <option value="">-- Select --</option>
                    <option value="CASUAL">Casual Leave</option>
                    <option value="SICK">Sick Leave</option>
                    <option value="EMERGENCY">Emergency Leave</option>
                    <option value="PAID">Paid Leave</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-medium">Reason</label>
                  <textarea name="reason" value={form.reason} onChange={handleChange} className="w-full border rounded px-3 py-2" maxLength={REASON_LIMIT}></textarea>
                  <div className="text-xs text-gray-400">{form.reason.length}/{REASON_LIMIT}</div>
                </div>

                {submitError && <p className="text-red-600">{submitError}</p>}
                {submitSuccess && <p className="text-green-600">{submitSuccess}</p>}

                <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded shadow hover:bg-emerald-800">Submit Leave</button>
              </form>
              <button onClick={() => setModalOpen(false)} className="mt-4 w-full text-sm underline text-gray-500">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence> */}
    </div>
  );
};

export default LeaveWithModal;
// --- END OF FILE LeaveWithModal.jsx ---
