import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:5000/leaves";
const REASON_LIMIT = 50;

// ✅ Convert "2025-11" → "November 2025"
const formatMonth = (monthStr) => {
  const [year, month] = monthStr.split("-");
  return `${new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  })} ${year}`;
};

// ✅ Sound
const playRequestSound = () => {
  try {
    const audio = new Audio("/sounds/request-button.mp3");
    audio.play().catch(() => {});
  } catch {}
};

// ✅ Last 12 months dropdown
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

const CurrentEmployeeLeaveManagement = () => {
  // ✅ logged employee
  const loggedUser = JSON.parse(localStorage.getItem("hrmsUser"));
  const employeeId = loggedUser?.employeeId; // ✅ dynamic

  // Filters
  const monthOptions = useMemo(() => monthOptionsForPast(12), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]);
  const statusOptions = ["All", "Pending", "Approved", "Rejected", "Cancelled"];
  const [selectedStatus, setSelectedStatus] = useState("All");

  // Table
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form
  const [form, setForm] = useState({
    from: "",
    to: "",
    reason: "",
    halfDaySession: "",
    leaveType: "",
  });

  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Details
  const [expandedId, setExpandedId] = useState(null);
  const [detailsMap, setDetailsMap] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});
  const [detailsError, setDetailsError] = useState({});

  // ✅ FETCH LEAVES (only current employee)
  useEffect(() => {
    if (!employeeId) return;

    const fetchList = async () => {
      setLoading(true);
      setError("");

      try {
        const url = new URL(API_BASE);
        url.searchParams.set("employeeId", employeeId);
        url.searchParams.set("month", selectedMonth);
        url.searchParams.set("status", selectedStatus);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Failed");

        const data = await res.json();

        setRequests(
          (data || []).map((d) => ({
            id: d._id,
            from: d.from,
            to: d.to,
            reason: d.reason,
            halfDaySession: d.halfDaySession || "",
            leaveType: d.leaveType,
            actionDate: d.actionDate || "-",
            requestDate: d.requestDate || "",
            status: d.status || "Pending",
            approvedBy: d.approvedBy || "-",
          }))
        );
      } catch (err) {
        console.error(err);
        setError("Failed to load leaves.");
      } finally {
        setLoading(false);
      }
    };

    fetchList();
  }, [employeeId, selectedMonth, selectedStatus]);

  // ✅ Input change handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "reason" ? value.slice(0, REASON_LIMIT) : value,
    }));
    setError("");
    setSuccess("");
  };

  // ✅ Submit Leave
  const handleSubmit = async (e) => {
    e.preventDefault();
    const { from, to, reason, halfDaySession, leaveType } = form;

    if (!from || !to || !reason || !leaveType) {
      setError("All fields are required.");
      return;
    }

    try {
      const payload = {
        employeeId,
        from,
        to,
        reason,
        leaveType,
        leaveDayType: from === to && halfDaySession ? "Half Day" : "Full Day",
        halfDaySession: from === to ? halfDaySession || "" : "",
      };

      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Submit failed");

      // Success UI
      playRequestSound();
      setSuccess("Leave request submitted successfully!");
      setForm({
        from: "",
        to: "",
        reason: "",
        halfDaySession: "",
        leaveType: "",
      });
      setShowForm(false);

      // Refresh table
      const url = new URL(API_BASE);
      url.searchParams.set("employeeId", employeeId);
      url.searchParams.set("month", selectedMonth);
      url.searchParams.set("status", selectedStatus);

      const listRes = await fetch(url);
      const list = await listRes.json();

      setRequests(
        (list || []).map((d) => ({
          id: d._id,
          from: d.from,
          to: d.to,
          reason: d.reason,
          halfDaySession: d.halfDaySession,
          leaveType: d.leaveType,
          actionDate: d.actionDate,
          requestDate: d.requestDate,
          status: d.status,
          approvedBy: d.approvedBy,
        }))
      );
    } catch (err) {
      console.error(err);
      setError("Failed to submit leave request.");
    }
  };

  // ✅ Show/hide details
  const toggleDetails = async (leaveId) => {
    if (expandedId === leaveId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(leaveId);

    if (detailsMap[leaveId]) return; // already loaded

    try {
      setLoadingDetails((prev) => ({ ...prev, [leaveId]: true }));

      const res = await fetch(`${API_BASE}/${leaveId}/details`);
      const details = await res.json();

      setDetailsMap((prev) => ({ ...prev, [leaveId]: details }));
    } catch {
      setDetailsError((prev) => ({ ...prev, [leaveId]: "Failed to load details" }));
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [leaveId]: false }));
    }
  };

  // ✅ UI
  return (
    <>
      {/* Heading */}
      <div className="flex items-center mb-[25px]">
        <h2 className="text-3xl font-bold text-blue-800 flex-1">
          Leave Request
        </h2>

        <button
          className={`ml-4 bg-blue-700 hover:bg-blue-900 text-white font-semibold px-6 py-2 rounded-lg shadow transition ${
            showForm ? "bg-blue-900" : ""
          }`}
          onClick={() => {
            if (!showForm) {
              setForm({
                from: "",
                to: "",
                reason: "",
                halfDaySession: "",
                leaveType: "",
              });
              setError("");
              setSuccess("");
            }
            setShowForm((v) => !v);
          }}
        >
          {showForm ? "Cancel" : "Leave Request"}
        </button>
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
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {formatMonth(month)}
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
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 bg-white rounded-lg shadow-md p-6 border max-w-xl"
        >
          {/* FROM / TO */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-blue-800 mb-1">From Date</label>
              <input
                type="date"
                name="from"
                value={form.from}
                onChange={handleChange}
                className="border rounded px-3 py-2 w-full"
              />
            </div>

            <div className="flex-1">
              <label className="block text-blue-800 mb-1">To Date</label>
              <input
                type="date"
                name="to"
                value={form.to}
                onChange={handleChange}
                className="border rounded px-3 py-2 w-full"
              />
            </div>

            {form.from &&
              form.to &&
              form.from === form.to && (
                <div className="flex-1">
                  <label className="block text-blue-800 mb-1">Half Day</label>
                  <select
                    name="halfDaySession"
                    value={form.halfDaySession}
                    onChange={handleChange}
                    className="border rounded px-3 py-2 w-full"
                  >
                    <option value="">-- Select --</option>
                    <option value="Morning Half">Morning</option>
                    <option value="Afternoon Half">Afternoon</option>
                  </select>
                </div>
              )}
          </div>

          {/* Reason */}
          <div>
            <label className="block mb-1 text-blue-800">Reason</label>
            <input
              type="text"
              name="reason"
              value={form.reason}
              onChange={handleChange}
              maxLength={50}
              className="border rounded px-3 py-2 w-full"
              placeholder="Enter reason"
            />
          </div>

          {/* Leave Type */}
          <div>
            <label className="block mb-1 text-blue-800">Leave Type</label>
            <select
              name="leaveType"
              value={form.leaveType}
              onChange={handleChange}
              className="border rounded px-3 py-2 w-full"
            >
              <option value="">-- Select --</option>
              <option value="CASUAL">Casual Leave</option>
              <option value="SICK">Sick Leave</option>
              <option value="EMERGENCY">Emergency Leave</option>
            </select>
          </div>

          {/* Error / Success */}
          {error && <p className="text-red-600">{error}</p>}
          {success && <p className="text-green-600">{success}</p>}

          {/* Buttons */}
          <div className="flex gap-4 mt-3">
            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-2 rounded"
            >
              Submit
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-gray-500 text-white px-6 py-2 rounded"
            >
              Cancel
            </button>
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
                <td colSpan={10} className="text-center py-4 text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : requests.length > 0 ? (
              requests.map((req) => (
                <React.Fragment key={req.id}>
                  <tr className="hover:bg-blue-50">
                    <td className="px-4 py-2">{req.from}</td>
                    <td className="px-4 py-2">{req.to}</td>
                    <td className="px-4 py-2">{req.reason}</td>
                    <td className="px-4 py-2">{req.halfDaySession || "-"}</td>
                    <td className="px-4 py-2">{req.leaveType}</td>
                    <td className="px-4 py-2">{req.actionDate}</td>
                    <td className="px-4 py-2">{req.requestDate}</td>

                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          req.status === "Pending"
                            ? "bg-yellow-200 text-yellow-700"
                            : req.status === "Approved"
                            ? "bg-green-200 text-green-700"
                            : req.status === "Rejected"
                            ? "bg-red-200 text-red-700"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>

                    <td className="px-4 py-2">{req.approvedBy}</td>

                    <td className="px-4 py-2">
                      <button
                        onClick={() => toggleDetails(req.id)}
                        className="px-3 py-1 text-sm border rounded"
                      >
                        {expandedId === req.id ? "Hide" : "Show"}
                      </button>
                    </td>
                  </tr>

                  {expandedId === req.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={10} className="px-6 py-4">
                        {loadingDetails[req.id] ? (
                          <div>Loading details...</div>
                        ) : detailsMap[req.id]?.length > 0 ? (
                          detailsMap[req.id].map((d, i) => (
                            <div key={i} className="flex gap-4 py-1">
                              <span className="w-32">{d.date}</span>
                              <span
                                className={`px-3 py-1 text-xs rounded-full ${
                                  d.leavecategory === "Paid"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {d.leavecategory}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div>No details found.</div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="py-4 text-center text-gray-500">
                  No leave requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sandwich */}
      <div className="bg-white p-6 border rounded shadow mt-10">
        <h2 className="text-2xl font-bold text-purple-800 mb-3">
          Sandwich Leaves
        </h2>

        <p className="text-gray-600">No sandwich leaves this month.</p>
      </div>
    </>
  );
};

export default CurrentEmployeeLeaveManagement;
