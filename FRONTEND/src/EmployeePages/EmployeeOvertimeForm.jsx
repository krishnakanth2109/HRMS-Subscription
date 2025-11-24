// --- START OF FILE EmployeeOvertimeForm.jsx ---

import React, { useState, useEffect, useCallback, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "../context/AuthContext";
import {
  getOvertimeForEmployee,
  applyForOvertime,
  cancelOvertime,
} from "../api";

const OvertimeWithModal = () => {
  const { user } = useContext(AuthContext);

  const [form, setForm] = useState({ date: "", type: "INCENTIVE_OT" });
  const [overtimeList, setOvertimeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedOT, setSelectedOT] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchOvertimeData = useCallback(async () => {
    if (!user?.employeeId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const otData = await getOvertimeForEmployee(user.employeeId);
      setOvertimeList(
        otData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      );
    } catch (err) {
      console.error("Error fetching overtime data:", err);
      setError("Could not load your overtime requests.");
    } finally {
      setLoading(false);
    }
  }, [user?.employeeId]);

  useEffect(() => {
    fetchOvertimeData();
  }, [fetchOvertimeData]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date || !form.type) {
      setError("Please fill all fields.");
      return;
    }

    try {
      await applyForOvertime({
        employeeId: user.employeeId,
        employeeName: user.name,
        date: form.date,
        type: form.type,
      });

      setSuccess("Overtime submitted successfully!");
      setForm({ date: "", type: "INCENTIVE_OT" });
      fetchOvertimeData();

      setTimeout(() => setModalOpen(false), 1500);
    } catch (err) {
      console.error("Failed to submit OT:", err);
      setError("Failed to submit OT. Please try again.");
    }
  };

  // ============================
  // CANCEL OT CONFIRM
  // ============================
  const confirmCancel = async () => {
    try {
      await cancelOvertime(selectedOT);
      setConfirmOpen(false);
      fetchOvertimeData();
    } catch (err) {
      console.error("Cancel failed:", err);
      setError("Failed to cancel overtime request.");
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!user)
    return (
      <div className="text-red-600 p-6 text-center">
        Could not find employee data. Please log in again.
      </div>
    );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-indigo-900">
          My Overtime Requests
        </h2>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-800 text-white px-6 py-2 rounded-lg shadow-lg"
        >
          Apply For Overtime
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-x-auto border">
        <table className="min-w-full text-sm">
          <thead className="bg-indigo-100 text-indigo-900">
            <tr>
              <th className="px-4 py-3 border">Date</th>
              <th className="px-4 py-3 border">Type</th>
              <th className="px-4 py-3 border">Status / Actions</th>
            </tr>
          </thead>

          <tbody>
            {overtimeList.length > 0 ? (
              overtimeList.map((ot) => (
                <tr key={ot._id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-2 border text-center">{ot.date}</td>
                  <td className="px-4 py-2 border text-center">{ot.type}</td>

                  <td className="px-4 py-2 border text-center">
                    <div className="flex justify-center items-center gap-3">
                      {/* STATUS BADGE */}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          ot.status === "APPROVED"
                            ? "bg-green-200 text-green-800"
                            : ot.status === "REJECTED"
                            ? "bg-red-200 text-red-800"
                            : ot.status === "CANCELLED"
                            ? "bg-gray-300 text-gray-700"
                            : "bg-yellow-200 text-yellow-800"
                        }`}
                      >
                        {ot.status}
                      </span>

                      {/* CANCEL ONLY FOR PENDING */}
                      {ot.status === "PENDING" && (
                        <button
                          onClick={() => {
                            setSelectedOT(ot._id);
                            setConfirmOpen(true);
                          }}
                          className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-700"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="3"
                  className="text-center p-4 text-gray-500"
                >
                  No Overtime Requests Found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ============================
          APPLY OT MODAL
      ============================ */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white w-96 p-6 rounded-xl shadow-xl"
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.7 }}
            >
              <h3 className="text-xl font-bold mb-4 text-indigo-700">
                Apply Overtime
              </h3>

              <div className="mb-4 p-3 rounded bg-indigo-50 text-sm">
                <p>
                  <b>Name:</b> {user.name}
                </p>
                <p>
                  <b>ID:</b> {user.employeeId}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block mb-1 font-medium">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-medium">Type</label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="INCENTIVE_OT">Incentive OT</option>
                    <option value="PENDING_OT">Pending OT</option>
                  </select>
                </div>

                {error && <div className="text-red-600">{error}</div>}
                {success && <div className="text-green-600">{success}</div>}

                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-800 text-white px-4 py-2 rounded shadow"
                >
                  Submit
                </button>
              </form>

              <button
                onClick={() => setModalOpen(false)}
                className="mt-4 text-sm text-gray-500 underline w-full text-center"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================
          CANCEL CONFIRM MODAL
      ============================ */}
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
              <h3 className="text-xl font-bold mb-4 text-red-600">
                Confirm Cancel
              </h3>

              <p className="text-gray-700 mb-6">
                Are you sure you want to cancel this overtime request?
              </p>

              <div className="flex justify-between">
                <button
                  onClick={confirmCancel}
                  className="bg-red-600 hover:bg-red-800 text-white px-4 py-2 rounded"
                >
                  Yes, Cancel
                </button>

                <button
                  onClick={() => setConfirmOpen(false)}
                  className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded"
                >
                  No, Keep it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OvertimeWithModal;

// --- END OF FILE EmployeeOvertimeForm.jsx ---
