import React, { useContext, useState } from "react";
import { LeaveRequestContext } from "../context/LeaveRequestContext";
import { EmployeeContext } from "../context/EmployeeContext";
import { useLocation } from "react-router-dom";
import { FaCheck, FaTimes, FaFilter } from "react-icons/fa";

const LeaveManagement = () => {
  const {
    getWeeklyFilteredRequests,
    getDepartments,
    goToPreviousWeek,
    goToNextWeek,
    resetToCurrentWeek,
    currentWeek,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    filterDept,
    setFilterDept,
    isSandwichLeave,
    approveLeave, // <-- add
    rejectLeave,
  } = useContext(LeaveRequestContext);
  const { employees } = useContext(EmployeeContext);
  const location = useLocation();
  const initialStatus = location.state?.defaultStatus || "All";

  // Set initial status filter only once
  React.useEffect(() => {
    setFilterStatus(initialStatus);
    // eslint-disable-next-line
  }, []);

  const [snackbar, setSnackbar] = useState("");

  // Status badge color
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

  // Snackbar
  const showSnackbar = (msg) => {
    setSnackbar(msg);
    setTimeout(() => setSnackbar(""), 1800);
  };

  // Approve/Reject
  const updateStatus = (id, status) => {
    if (status === "Approved") {
      approveLeave(id);
      showSnackbar("Leave request approved successfully.");
    } else if (status === "Rejected") {
      rejectLeave(id);
      showSnackbar("Leave request rejected successfully.");
    }
  };

  // Get departments for filter dropdown
  const allDepartments = getDepartments(employees);

  // Get filtered leave requests for current week
  const { weekDates, filteredRequests } = getWeeklyFilteredRequests(employees);

  // Sandwich leave flag
  const sandwichLeaveRowId = isSandwichLeave(filteredRequests);

  // Week range formatter
  const formatWeekRange = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options = { month: "short", day: "numeric", year: "numeric" };
    if (startDate.getFullYear() === endDate.getFullYear()) {
      const startOptions = { month: "short", day: "numeric" };
      return `${startDate.toLocaleDateString(
        "en-US",
        startOptions
      )} - ${endDate.toLocaleDateString("en-US", options)}`;
    } else {
      return `${startDate.toLocaleDateString(
        "en-US",
        options
      )} - ${endDate.toLocaleDateString("en-US", options)}`;
    }
  };

  const [showMoreId, setShowMoreId] = useState(null);

  const toggleShowMore = (id) => {
    setShowMoreId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Leave Requests</h2>

      {/* Filters & Week Navigation */}
      <div className="mb-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 items-center">
          <button
            onClick={goToPreviousWeek}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            ← Previous Week
          </button>
          <span className="text-sm font-medium text-gray-600">
            {formatWeekRange(weekDates.start, weekDates.end)}
          </span>
          <button
            onClick={goToNextWeek}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Next Week →
          </button>
          {currentWeek !== 0 && (
            <button
              onClick={resetToCurrentWeek}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition"
            >
              Current Week
            </button>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <FaFilter className="text-blue-600" />
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="border px-4 py-2 rounded font-semibold bg-white shadow"
          >
            <option value="All">All Departments</option>
            {allDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          {["All", "Pending", "Approved", "Rejected"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded font-semibold transition ${
                filterStatus === status
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-blue-100"
              }`}
            >
              {status}
            </button>
          ))}
          <input
            type="text"
            placeholder="Search by Name or Employee ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border px-4 py-2 rounded w-full max-w-sm"
          />
        </div>
      </div>

      {/* Table & Summary */}
      <div className="overflow-x-auto">
        <div className="mb-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="bg-gray-50 rounded-xl p-3 shadow flex gap-8 items-center">
            <span className="font-semibold text-blue-700">Showing:</span>
            <span className="text-sm text-gray-700">
              {filteredRequests.length} requests
            </span>
            <span className="text-sm text-green-700">
              Approved:{" "}
              {filteredRequests.filter((r) => r.status === "Approved").length}
            </span>
            <span className="text-sm text-yellow-700">
              Pending:{" "}
              {filteredRequests.filter((r) => r.status === "Pending").length}
            </span>
            <span className="text-sm text-red-700">
              Rejected:{" "}
              {filteredRequests.filter((r) => r.status === "Rejected").length}
            </span>
            {filterDept !== "All" && (
              <span className="text-sm text-purple-700">
                Department: {filterDept}
              </span>
            )}
          </div>
        </div>
        <table className="min-w-full bg-white rounded-xl shadow">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-4">Employee ID</th>
              <th className="p-4">Name</th>
              <th className="p-4">From</th>
              <th className="p-4">To</th>
              <th className="p-4">Leave Days</th> {/* NEW */}
              <th className="p-4">Reason</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((req, idx) => {
              const emp = employees.find(
                (e) => e.employeeId === req.employeeId
              );
              const isInactive = emp?.isActive === false;
              const isSandwich = req.id === sandwichLeaveRowId;

              return (
                <React.Fragment key={req.id}>
                  {/* Main leave request row */}
                  <tr
                    className={`border-t transition duration-150 ${
                      isInactive
                        ? "bg-gray-300 text-gray-600 opacity-75"
                        : idx % 2 === 0
                        ? "bg-gray-50"
                        : "bg-white"
                    } hover:bg-blue-50`}
                  >
                    <td className="p-4">{req.employeeId}</td>
                    <td className="p-4">
                      {req.name}
                      {isInactive && (
                        <span className="ml-2 px-2 py-1 bg-red-200 text-red-800 text-xs rounded font-semibold">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-4">{req.from}</td>
                    <td className="p-4">{req.to}</td>
                    <td className="p-4">{req.leaveDays}</td>
                    <td className="p-4 flex items-center gap-2">
                      {req.reason}
                      {isSandwich && (
                        <span
                          className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-semibold ml-2"
                          title="Sandwich Leave"
                        >
                          Sandwich Leave
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-semibold">
                      {statusBadge(req.status)}
                    </td>
                    <td className="p-4 flex gap-2">
                      <button
                        onClick={() => toggleShowMore(req.id)}
                        className="bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex items-center gap-1"
                      >
                        {showMoreId === req.id ? "Show Less" : "Show More"}
                      </button>
                      <button
                        onClick={() => updateStatus(req.id, "Approved")}
                        disabled={req.status !== "Pending"}
                        className="bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 flex items-center gap-1 disabled:opacity-50"
                        title="Approve"
                      >
                        <FaCheck /> Approve
                      </button>

                      <button
                        onClick={() => updateStatus(req.id, "Rejected")}
                        disabled={req.status !== "Pending"}
                        className="bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 flex items-center gap-1 disabled:opacity-50"
                        title="Reject"
                      >
                        <FaTimes /> Reject
                      </button>
                    </td>
                  </tr>

                  {/* Expanded leave day details row */}
                  {showMoreId === req.id && (
                    <tr className="bg-gray-50 border-t">
                      <td colSpan="8" className="p-4">
                        <div className="bg-white p-4 rounded shadow">
                          <h4 className="font-semibold mb-2">
                            Leave Day Details:
                          </h4>
                          <table className="min-w-full text-left text-sm">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2">Category</th>
                                <th className="px-3 py-2">Sandwich</th>
                                <th className="px-3 py-2">OT Credit Used</th>
                              </tr>
                            </thead>
                            <tbody>
                              {req.leaveRequestDays?.map((day) => (
                                <tr key={day.id} className="border-t">
                                  <td className="px-3 py-2">{day.leaveDate}</td>
                                  <td className="px-3 py-2">
                                    {day.leaveCategory}
                                  </td>
                                  <td className="px-3 py-2">
                                    {day.sandwichFlag ? "Yes" : "No"}
                                  </td>
                                  <td className="px-3 py-2">
                                    {day.otCreditUsed ? "Yes" : "No"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {snackbar && (
          <div
            className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded shadow-lg z-50 animate-fadein ${
              snackbar.toLowerCase().includes("rejected")
                ? "bg-red-600"
                : "bg-green-600"
            } text-white`}
          >
            {snackbar}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveManagement;
