// --- START OF FILE AdminLeaveManagementPanel.jsx ---
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  getLeaveRequests,
  getEmployees,
  approveLeaveRequestById,
  rejectLeaveRequestById,
} from "../api";
import { FaCheck, FaTimes, FaFilter } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

const AdminLeavePanel = () => {
  const [leaveList, setLeaveList] = useState([]);
  const [employeesMap, setEmployeesMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(null);

  // --- UI States ---
  const [filterDept, setFilterDept] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMoreId, setShowMoreId] = useState(null);
  const [snackbar, setSnackbar] = useState("");

  // NEW STATES FOR POPUP
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // "Approved" or "Rejected"
  const [selectedLeaveId, setSelectedLeaveId] = useState(null);

  // --- Helper Snackbar Function ---
  const showSnackbar = (msg) => {
    setSnackbar(msg);
    setTimeout(() => setSnackbar(""), 1800);
  };

  // ✅ Fetch leaves & employees
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [leavesData, employeesData] = await Promise.all([
        getLeaveRequests(),
        getEmployees(),
      ]);

      setLeaveList(leavesData);

      const newEmployeesMap = new Map(
        employeesData.map((emp) => [emp.employeeId, emp])
      );
      setEmployeesMap(newEmployeesMap);
    } catch (err) {
      console.error("Admin Panel Data Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ✅ Enriched leave list
  const enrichedLeaveList = useMemo(() => {
    return leaveList.map((leave) => {
      const emp = employeesMap.get(leave.employeeId);
      return {
        ...leave,
        employeeName: emp?.name || "Unknown",
        department: emp?.department || "Unassigned",
      };
    });
  }, [leaveList, employeesMap]);

  // ✅ Department list
  const allDepartments = useMemo(() => {
    const depts = Array.from(
      new Set(
        Array.from(employeesMap.values()).map((emp) => emp.department)
      )
    );
    return depts.filter(Boolean);
  }, [employeesMap]);

  // ✅ Filtering
  const filteredRequests = useMemo(() => {
    return enrichedLeaveList.filter((req) => {
      const matchesDept =
        filterDept === "All" || req.department === filterDept;
      const matchesStatus =
        filterStatus === "All" || req.status === filterStatus;
      const matchesSearch =
        req.employeeId
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        req.employeeName
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      return matchesDept && matchesStatus && matchesSearch;
    });
  }, [enrichedLeaveList, filterDept, filterStatus, searchQuery]);

  // OPEN CONFIRM POPUP
  const openConfirm = (id, actionType) => {
    setSelectedLeaveId(id);
    setConfirmAction(actionType);
    setConfirmOpen(true);
  };

  // CONFIRMATION HANDLER
  const handleConfirmAction = async () => {
    const id = selectedLeaveId;
    const status = confirmAction;

    setConfirmOpen(false);
    setStatusUpdating(id);

    try {
      if (status === "Approved") {
        await approveLeaveRequestById(id);
      } else if (status === "Rejected") {
        await rejectLeaveRequestById(id);
      }

      await fetchAllData();

      showSnackbar(
        status === "Approved"
          ? "Leave approved successfully."
          : "Leave rejected successfully."
      );
    } catch (err) {
      console.error("Status Update Error:", err);
      showSnackbar("Failed to update leave status.");
    } finally {
      setStatusUpdating(null);
    }
  };

  const toggleShowMore = (id) => {
    setShowMoreId((prev) => (prev === id ? null : id));
  };

  const statusBadge = (status) => {
    let color = "bg-gray-200 text-gray-700";
    if (status === "Pending") color = "bg-yellow-100 text-yellow-700";
    if (status === "Approved") color = "bg-green-100 text-green-700";
    if (status === "Rejected") color = "bg-red-100 text-red-700";
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6 text-lg text-center font-semibold">
        Loading leave requests...
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-emerald-900">
        Leave Management (Admin Panel)
      </h2>

      {/* Filters Section */}
      <div className="mb-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 items-center flex-wrap">
          <FaFilter className="text-blue-600" />
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="border px-3 py-2 rounded bg-white shadow"
          >
            <option value="All">All Departments</option>
            {allDepartments.map((dept) => (
              <option key={dept}>{dept}</option>
            ))}
          </select>

          {["All", "Pending", "Approved", "Rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded font-semibold transition ${
                filterStatus === s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-blue-100"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="pb-2">
        <input
          type="text"
          placeholder="Search by Name or Employee ID"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border px-4 py-2 rounded w-full max-w-sm"
        />
      </div>

      {/* Summary Section */}
      <div className="mb-4 bg-gray-50 rounded-xl p-3 shadow flex gap-6 text-sm font-semibold">
        <span>Total: {filteredRequests.length}</span>
        <span>
          Approved:{" "}
          {filteredRequests.filter((r) => r.status === "Approved").length}
        </span>
        <span>
          Pending:{" "}
          {filteredRequests.filter((r) => r.status === "Pending").length}
        </span>
        <span>
          Rejected:{" "}
          {filteredRequests.filter((r) => r.status === "Rejected").length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-4">Employee ID</th>
              <th className="p-4">Name</th>
              <th className="p-4">Department</th>
              <th className="p-4">From</th>
              <th className="p-4">To</th>
              <th className="p-4">Type</th>
              <th className="p-4">Reason</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length > 0 ? (
              filteredRequests.map((lv) => (
                <React.Fragment key={lv._id}>
                  <tr className="border-t hover:bg-blue-50 transition">
                    <td className="p-4">{lv.employeeId}</td>
                    <td className="p-4">{lv.employeeName}</td>
                    <td className="p-4">{lv.department}</td>
                    <td className="p-4">{lv.from}</td>
                    <td className="p-4">{lv.to}</td>
                    <td className="p-4">{lv.leaveType}</td>
                    <td className="p-4">{lv.reason}</td>
                    <td className="p-4">{statusBadge(lv.status)}</td>

                    <td className="p-4 flex gap-2">
                      <button
                        onClick={() => toggleShowMore(lv._id)}
                        className="bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                      >
                        {showMoreId === lv._id ? "Hide" : "Details"}
                      </button>

                      {/* APPROVE BUTTON */}
                      <button
                        onClick={() => openConfirm(lv._id, "Approved")}
                        className="bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                      >
                        <FaCheck />
                      </button>

                      {/* REJECT BUTTON */}
                      <button
                        onClick={() => openConfirm(lv._id, "Rejected")}
                        className="bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                      >
                        <FaTimes />
                      </button>
                    </td>
                  </tr>

                  {showMoreId === lv._id && (
                    <tr className="bg-gray-50">
                      <td colSpan="9" className="p-4">
                        <div className="bg-white p-4 rounded shadow">
                          <h4 className="font-semibold mb-2">
                            Leave Day Details
                          </h4>
                          {lv.details?.length ? (
                            <table className="min-w-full text-left text-sm">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="px-3 py-2">Date</th>
                                  <th className="px-3 py-2">Category</th>
                                  <th className="px-3 py-2">Type</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lv.details.map((d, i) => (
                                  <tr key={i} className="border-t">
                                    <td className="px-3 py-2">{d.date}</td>
                                    <td className="px-3 py-2">
                                      {d.leavecategory}
                                    </td>
                                    <td className="px-3 py-2">
                                      {d.leaveDayType}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-gray-500">
                              No details available.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td
                  colSpan="9"
                  className="text-center p-4 text-gray-500"
                >
                  No leave requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CONFIRM POPUP */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white w-80 p-6 rounded-xl shadow-xl"
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.7 }}
            >
              <h3 className="text-xl font-bold mb-4 text-indigo-700">
                Confirm {confirmAction}
              </h3>

              <p className="text-gray-700 mb-6">
                Are you sure you want to{" "}
                <b className="text-indigo-700">{confirmAction}</b> this leave
                request?
              </p>

              <div className="flex justify-between">
                <button
                  onClick={handleConfirmAction}
                  className="bg-indigo-600 hover:bg-indigo-800 text-white px-4 py-2 rounded"
                >
                  Yes, Confirm
                </button>

                <button
                  onClick={() => setConfirmOpen(false)}
                  className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {snackbar && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded shadow-lg z-50 text-white ${
            snackbar.includes("rejected") ? "bg-red-600" : "bg-green-600"
          }`}
        >
          {snackbar}
        </div>
      )}
    </div>
  );
};

export default AdminLeavePanel;
