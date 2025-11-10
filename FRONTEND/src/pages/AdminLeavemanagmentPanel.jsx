import React, { useEffect, useState } from "react";
import axios from "axios";

const AdminLeavePanel = () => {
  const [leaveList, setLeaveList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState("");

  /* ✅ Fetch ALL Leaves */
  const fetchAllLeaves = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/leave/admin/all");
      setLeaveList(res.data);
    } catch (err) {
      console.error("Admin Leave Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllLeaves();
  }, []);

  /* ✅ Approve / Reject Leave */
  const updateStatus = async (id, status) => {
    setStatusUpdating(id);

    try {
      await axios.put(`http://localhost:5000/api/leave/admin/update-status/${id}`, {
        status,
      });

      // ✅ Refresh list
      fetchAllLeaves();
    } catch (err) {
      console.error("Status Update Error:", err);
    } finally {
      setStatusUpdating("");
    }
  };

  if (loading)
    return <div className="p-6 text-center font-semibold">Loading leave requests...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Title */}
      <h2 className="text-3xl font-bold text-emerald-900 mb-6">
        Leave Management (Admin)
      </h2>

      {/* Table Container */}
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
            {leaveList.length > 0 ? (
              leaveList.map((lv) => (
                <tr key={lv._id} className="hover:bg-gray-50 transition">
                  <td className="border px-4 py-2 text-center">{lv.employeeId}</td>
                  <td className="border px-4 py-2">{lv.employeeName}</td>
                  <td className="border px-4 py-2 text-center">{lv.date_from}</td>
                  <td className="border px-4 py-2 text-center">{lv.date_to}</td>
                  <td className="border px-4 py-2 text-center">{lv.leaveType}</td>
                  <td className="border px-4 py-2">{lv.reason}</td>

                  {/* Status Badge */}
                  <td className="border px-4 py-2 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        lv.status === "APPROVED"
                          ? "bg-green-200 text-green-800"
                          : lv.status === "REJECTED"
                          ? "bg-red-200 text-red-800"
                          : "bg-yellow-200 text-yellow-800"
                      }`}
                    >
                      {lv.status}
                    </span>
                  </td>

                  {/* Approve / Reject Buttons */}
                  <td className="border px-4 py-2 text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        disabled={statusUpdating === lv._id}
                        onClick={() => updateStatus(lv._id, "APPROVED")}
                        className="bg-green-600 hover:bg-green-800 text-white px-3 py-1 rounded text-sm"
                      >
                        Approve
                      </button>

                      <button
                        disabled={statusUpdating === lv._id}
                        onClick={() => updateStatus(lv._id, "REJECTED")}
                        className="bg-red-600 hover:bg-red-800 text-white px-3 py-1 rounded text-sm"
                      >
                        Reject
                      </button>

                      <button
                        disabled={statusUpdating === lv._id}
                        onClick={() => updateStatus(lv._id, "PENDING")}
                        className="bg-yellow-600 hover:bg-yellow-800 text-white px-3 py-1 rounded text-sm"
                      >
                        Pending
                      </button>
                    </div>
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
