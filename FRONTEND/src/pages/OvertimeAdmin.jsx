// --- START OF FILE OvertimeAdmin.jsx ---

import React, { useEffect, useState, useCallback } from "react";
// ✅ IMPORT THE CENTRALIZED API FUNCTIONS
import { getAllOvertimeRequests, updateOvertimeStatus } from "../api";

const OvertimeAdmin = () => {
  const [overtimeList, setOvertimeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  // ✅ Fetch all Overtime Requests using the API service
  const fetchOvertimes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllOvertimeRequests();
      setOvertimeList(data);
    } catch (err) {
      console.error("Error fetching overtime:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOvertimes();
  }, [fetchOvertimes]);

  // ✅ Update OT Status using the API service
  const updateStatus = async (id, newStatus) => {
    try {
      setUpdatingId(id);
      await updateOvertimeStatus(id, { status: newStatus });
      
      // Update UI instantly for better UX, the source of truth will be updated on next fetch
      setOvertimeList((prev) =>
        prev.map((ot) => (ot._id === id ? { ...ot, status: newStatus } : ot))
      );
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <div className="p-5 text-center">Loading Overtime Requests...</div>;

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold text-indigo-900 mb-6">Overtime Approval Panel</h2>

      <div className="overflow-x-auto bg-white shadow rounded-lg p-4">
        <table className="min-w-full border text-sm">
          <thead className="bg-indigo-100">
            <tr>
              <th className="px-3 py-2 border">Employee ID</th>
              <th className="px-3 py-2 border">Name</th>
              <th className="px-3 py-2 border">Date</th>
              <th className="px-3 py-2 border">Type</th>
              <th className="px-3 py-2 border">Status</th>
              <th className="px-3 py-2 border text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {overtimeList.length > 0 ? (
              overtimeList.map((ot) => (
                <tr key={ot._id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border text-center">{ot.employeeId}</td>
                  <td className="px-3 py-2 border">{ot.employeeName}</td>
                  <td className="px-3 py-2 border text-center">{ot.date}</td>
                  <td className="px-3 py-2 border text-center">{ot.type}</td>
                  <td className="px-3 py-2 border text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        ot.status === "APPROVED" ? "bg-green-200 text-green-700"
                        : ot.status === "REJECTED" ? "bg-red-200 text-red-700"
                        : "bg-yellow-200 text-yellow-700"
                      }`}
                    >
                      {ot.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 border text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        disabled={updatingId === ot._id || ot.status !== 'PENDING'}
                        onClick={() => updateStatus(ot._id, "APPROVED")}
                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Approve
                      </button>
                      <button
                        disabled={updatingId === ot._id || ot.status !== 'PENDING'}
                        onClick={() => updateStatus(ot._id, "REJECTED")}
                        className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center p-4 text-gray-500">
                  No overtime requests found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OvertimeAdmin;