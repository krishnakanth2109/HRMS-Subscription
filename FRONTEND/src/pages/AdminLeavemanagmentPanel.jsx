// --- START OF FILE AdminLeavemanagmentPanel.jsx ---

import React, { useEffect, useState, useCallback, useMemo } from "react";
// ✅ Step 1: Import all necessary API functions
import { getLeaveRequests, getEmployees, approveLeaveRequestById, rejectLeaveRequestById } from "../api";

const AdminLeavePanel = () => {
  const [leaveList, setLeaveList] = useState([]);
  const [employeesMap, setEmployeesMap] = useState(new Map()); // To store employee names by ID
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(null);

  // ✅ Step 2: Fetch ALL data (leaves and employees) when the component mounts
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      // Use Promise.all to fetch both datasets in parallel for better performance
      const [leavesData, employeesData] = await Promise.all([
        getLeaveRequests(),
        getEmployees()
      ]);

      setLeaveList(leavesData);

      // Create a Map for quick and easy lookup of employee names by their ID
      const newEmployeesMap = new Map(
        employeesData.map(emp => [emp.employeeId, emp.name])
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

  // ✅ Step 3: "Enrich" the leave list with employee names using useMemo for efficiency
  const enrichedLeaveList = useMemo(() => {
    return leaveList.map(leave => ({
      ...leave,
      // Look up the name from the map; provide a fallback if not found
      employeeName: employeesMap.get(leave.employeeId) || 'Unknown Employee'
    }));
  }, [leaveList, employeesMap]);


  // ✅ Step 4: Approve / Reject Leave (this logic remains the same, but now refetches all data)
  const updateStatus = async (id, status) => {
    if (!window.confirm(`Are you sure you want to ${status.toLowerCase()} this request?`)) {
      return;
    }
    
    setStatusUpdating(id);
    try {
      if (status === "APPROVED") {
        await approveLeaveRequestById(id);
      } else if (status === "REJECTED") {
        await rejectLeaveRequestById(id);
      }
      
      // After updating, refetch all data to ensure consistency
      await fetchAllData();
    } catch (err) {
      console.error("Status Update Error:", err);
      alert("Failed to update leave status.");
    } finally {
      setStatusUpdating(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-center font-semibold">Loading leave requests...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-emerald-900 mb-6">
        Leave Management (Admin Panel)
      </h2>

      <div className="bg-white rounded-xl shadow overflow-x-auto border">
        <table className="min-w-full text-sm">
          <thead className="bg-emerald-100 text-emerald-900">
            <tr>
              <th className="px-4 py-3 border">Employee ID</th>
              <th className="px-4 py-3 border">Name</th>
              <th className="px-4 py-3 border">From</th>
              <th className="px-4 py-3 border">To</th>
              <th className="px-4 py-3 border">Type</th>
              <th className="px-4 py-3 border">Reason</th>
              <th className="px-4 py-3 border">Status</th>
              <th className="px-4 py-3 border text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {enrichedLeaveList.length > 0 ? (
              // ✅ Step 5: Render the new 'enrichedLeaveList'
              enrichedLeaveList.map((lv) => (
                <tr key={lv._id} className="hover:bg-gray-50 transition">
                  <td className="border px-4 py-2 text-center">{lv.employeeId}</td>
                  {/* This will now display the correct name */}
                  <td className="border px-4 py-2">{lv.employeeName}</td>
                  <td className="border px-4 py-2 text-center">{lv.from}</td>
                  <td className="border px-4 py-2 text-center">{lv.to}</td>
                  <td className="border px-4 py-2 text-center">{lv.leaveType}</td>
                  <td className="border px-4 py-2">{lv.reason}</td>
                  <td className="border px-4 py-2 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        lv.status === "Approved" ? "bg-green-200 text-green-800"
                        : lv.status === "Rejected" ? "bg-red-200 text-red-800"
                        : "bg-yellow-200 text-yellow-800"
                      }`}
                    >
                      {lv.status}
                    </span>
                  </td>
                  <td className="border px-4 py-2 text-center">
                    {lv.status === "Pending" ? (
                      <div className="flex gap-2 justify-center">
                        <button
                          disabled={statusUpdating === lv._id}
                          onClick={() => updateStatus(lv._id, "APPROVED")}
                          className="bg-green-600 hover:bg-green-800 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                        >
                          {statusUpdating === lv._id ? "..." : "Approve"}
                        </button>
                        <button
                          disabled={statusUpdating === lv._id}
                          onClick={() => updateStatus(lv._id, "REJECTED")}
                          className="bg-red-600 hover:bg-red-800 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                        >
                          {statusUpdating === lv._id ? "..." : "Reject"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center p-4 text-gray-500">
                  No leave requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminLeavePanel;