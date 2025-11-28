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

  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [confirmCancelModal, setConfirmCancelModal] = useState(false);
  const [selectedOT, setSelectedOT] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ============================
  // BLOCK SUNDAY VALIDATION
  // ============================
  const validateDate = (selectedDate) => {
    const d = new Date(selectedDate);
    if (d.getDay() === 0) {
      return "❌ You cannot apply overtime on Sundays.";
    }
    return null;
  };

  // Load OT Data
  const fetchOT = useCallback(async () => {
    try {
      const res = await getOvertimeForEmployee(user.employeeId);
      setOvertimeList(
        res.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user.employeeId]);

  useEffect(() => {
    fetchOT();
  }, [fetchOT]);

  // Handle Change
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  // Submit OT
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.date) {
      setError("Please select a date.");
      return;
    }

    const msg = validateDate(form.date);
    if (msg) {
      setError(msg);
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
      fetchOT();

      setTimeout(() => setApplyModalOpen(false), 1200);
    } catch (err) {
      console.error(err);
      setError("Failed to submit overtime. Try again.");
    }
  };

  // Cancel OT
  const handleCancel = async () => {
    try {
      await cancelOvertime(selectedOT);
      setConfirmCancelModal(false);
      fetchOT();
    } catch (err) {
      setError("Failed to cancel overtime.");
    }
  };

  if (loading) return <div className="p-6 text-center text-lg">Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-4xl font-extrabold text-indigo-900 tracking-wide">
          My Overtime Requests
        </h2>

        <button
          onClick={() => setApplyModalOpen(true)}
          className="bg-gradient-to-r from-indigo-600 to-indigo-800 hover:opacity-90 text-white px-6 py-2.5 rounded-lg shadow-lg transition-all font-semibold"
        >
          + Apply Overtime
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white shadow-xl rounded-xl overflow-hidden border">
        <table className="w-full text-sm">
          <thead className="bg-indigo-600 text-white">
            <tr>
              <th className="px-6 py-3 border-r">Date</th>
              <th className="px-6 py-3 border-r">Type</th>
              <th className="px-6 py-3">Status / Action</th>
            </tr>
          </thead>

          <tbody>
            {overtimeList.length > 0 ? (
              overtimeList.map((ot) => (
                <tr
                  key={ot._id}
                  className="hover:bg-indigo-50 transition border-b"
                >
                  <td className="px-6 py-3 border-r text-center">{ot.date}</td>
                  <td className="px-6 py-3 border-r text-center">
                    {ot.type.replace("_", " ")}
                  </td>

                  <td className="px-6 py-3 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        ot.status === "APPROVED"
                          ? "bg-green-100 text-green-700"
                          : ot.status === "REJECTED"
                          ? "bg-red-100 text-red-700"
                          : ot.status === "CANCELLED"
                          ? "bg-gray-200 text-gray-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {ot.status}
                    </span>

                    {ot.status === "PENDING" && (
                      <button
                        onClick={() => {
                          setSelectedOT(ot._id);
                          setConfirmCancelModal(true);
                        }}
                        className="ml-3 text-xs bg-red-500 hover:bg-red-700 text-white px-3 py-1 rounded-md shadow transition"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="p-6 text-center text-gray-600"
                  colSpan="3"
                >
                  No overtime requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ----------------------- APPLY OT MODAL ----------------------- */}
      <AnimatePresence>
        {applyModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white w-96 p-6 rounded-xl shadow-2xl"
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.7 }}
            >
              <h3 className="text-2xl font-bold mb-4 text-indigo-700">
                Apply Overtime
              </h3>

              <div className="bg-indigo-50 p-3 rounded mb-4 text-sm">
                <p><b>Name:</b> {user.name}</p>
                <p><b>ID:</b> {user.employeeId}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => {
                      const selected = e.target.value;
                      const d = new Date(selected);

                      if (d.getDay() === 0) {
                        setError("Sundays are not allowed for overtime.");
                        setForm({ ...form, date: "" });
                        return;
                      }

                      setError("");
                      handleChange(e);
                    }}
                    className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-medium">Type</label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="INCENTIVE_OT">Incentive OT</option>
                    <option value="PENDING_OT">Pending OT</option>
                  </select>
                </div>

                {error && <p className="text-red-600">{error}</p>}
                {success && <p className="text-green-600">{success}</p>}

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-800 text-white py-2 rounded-lg font-semibold shadow"
                >
                  Submit
                </button>
              </form>

              <button
                onClick={() => setApplyModalOpen(false)}
                className="mt-4 text-sm text-gray-500 underline w-full text-center"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------- CANCEL MODAL ----------------------- */}
      <AnimatePresence>
        {confirmCancelModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white w-80 p-6 rounded-xl shadow-2xl"
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.7 }}
            >
              <h3 className="text-xl font-bold mb-4 text-red-600">
                Confirm Cancel
              </h3>

              <p className="mb-6 text-gray-700">
                Are you sure you want to cancel this overtime request?
              </p>

              <div className="flex justify-between">
                <button
                  onClick={handleCancel}
                  className="bg-red-600 hover:bg-red-800 text-white px-4 py-2 rounded shadow"
                >
                  Yes, Cancel
                </button>

                <button
                  onClick={() => setConfirmCancelModal(false)}
                  className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded shadow"
                >
                  No, Keep
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
