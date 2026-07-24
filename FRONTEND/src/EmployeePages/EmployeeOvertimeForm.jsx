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

  if (loading) return <div className="p-10 flex justify-center text-gray-500 font-bold">Loading Overtime Data...</div>;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-gray-200 shadow-sm p-6 bg-white rounded-2xl">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-indigo-700 tracking-tight">
            Overtime Requests
          </h2>
          <p className="text-sm text-gray-500 font-medium mt-1">Manage and track your extra work hours</p>
        </div>

        <button
          onClick={() => setApplyModalOpen(true)}
          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-indigo-100 transition-all font-bold flex items-center justify-center gap-2 active:scale-95"
        >
          <span className="text-lg">+</span> Apply Overtime
        </button>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px]">
              <tr>
                <th className="px-6 py-5">Request Date</th>
                <th className="px-6 py-5">Overtime Type</th>
                <th className="px-6 py-5 text-center">Current Status</th>
                <th className="px-6 py-5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {overtimeList.length > 0 ? (
                overtimeList.map((ot) => (
                  <tr key={ot._id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-6 py-5 font-bold text-gray-800">{ot.date}</td>
                    <td className="px-6 py-5">
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter">
                        {ot.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        ot.status === "APPROVED" ? "bg-green-50 text-green-700 border-green-200" :
                        ot.status === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" :
                        ot.status === "CANCELLED" ? "bg-gray-100 text-gray-500 border-gray-200" :
                        "bg-yellow-50 text-yellow-700 border-yellow-200"
                      }`}>
                        {ot.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {ot.status === "PENDING" && (
                        <button
                          onClick={() => {
                            setSelectedOT(ot._id);
                            setConfirmCancelModal(true);
                          }}
                          className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white px-4 py-2 rounded-xl text-xs font-bold border border-red-100 transition-all active:scale-95 shadow-sm"
                        >
                          Cancel Request
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-20 text-center text-gray-400 font-black uppercase tracking-widest text-xs" colSpan="4">
                    No overtime requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden flex flex-col divide-y divide-gray-50">
          {overtimeList.length > 0 ? (
            overtimeList.map((ot) => (
              <div key={ot._id} className="p-5 flex flex-col gap-4 bg-white hover:bg-gray-50/50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Request For</span>
                    <span className="text-sm font-black text-gray-800">{ot.date}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                    ot.status === "APPROVED" ? "bg-green-50 text-green-700 border-green-200" :
                    ot.status === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" :
                    ot.status === "CANCELLED" ? "bg-gray-100 text-gray-500 border-gray-200" :
                    "bg-yellow-50 text-yellow-700 border-yellow-200"
                  }`}>
                    {ot.status}
                  </span>
                </div>

                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Type</span>
                  <span className="text-xs font-bold text-indigo-700">{ot.type.replace("_", " ")}</span>
                </div>

                {ot.status === "PENDING" && (
                  <button
                    onClick={() => {
                      setSelectedOT(ot._id);
                      setConfirmCancelModal(true);
                    }}
                    className="w-full bg-red-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-red-100 active:scale-95 transition-transform"
                  >
                    Cancel This Request
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="p-20 text-center text-gray-400 font-black uppercase tracking-widest text-xs">
              No overtime requests found
            </div>
          )}
        </div>
      </div>

      {/* ----------------------- APPLY OT MODAL ----------------------- */}
      <AnimatePresence>
        {applyModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setApplyModalOpen(false)}
            />
            <motion.div
              className="bg-white w-full max-w-md p-0 rounded-3xl shadow-2xl overflow-hidden relative z-10"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
            >
              <div className="bg-indigo-600 p-6 text-white">
                <h3 className="text-xl font-black flex items-center gap-2">
                  Apply Overtime
                </h3>
                <p className="text-indigo-100 text-xs mt-1">Submit your request for extra hours</p>
              </div>

              <div className="p-6">
                <div className="bg-gray-50 p-4 rounded-2xl mb-6 border border-gray-100 grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Employee</span>
                    <p className="text-xs font-bold text-gray-800">{user.name}</p>
                  </div>
                  <div>
                    <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Emp ID</span>
                    <p className="text-xs font-bold text-gray-800">{user.employeeId}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Overtime Date</label>
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
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Incentive Type</label>
                    <select
                      name="type"
                      value={form.type}
                      onChange={handleChange}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-sm appearance-none"
                    >
                      <option value="INCENTIVE_OT">Incentive OT</option>
                      <option value="PENDING_OT">Pending OT</option>
                    </select>
                  </div>

                  {error && <p className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold border border-red-100">{error}</p>}
                  {success && <p className="bg-green-50 text-green-600 p-3 rounded-xl text-xs font-bold border border-green-100">{success}</p>}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setApplyModalOpen(false)}
                      className="flex-1 py-4 rounded-2xl text-xs font-black uppercase text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all active:scale-95"
                    >
                      Submit Request
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------------- CANCEL MODAL ----------------------- */}
      <AnimatePresence>
        {confirmCancelModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmCancelModal(false)}
            />
            <motion.div
              className="bg-white w-full max-w-sm p-8 rounded-3xl shadow-2xl relative z-10 text-center"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 border border-red-100 shadow-inner">
                <span className="text-2xl font-black">?</span>
              </div>
              <h3 className="text-xl font-black mb-2 text-gray-800">
                Cancel Request?
              </h3>
              <p className="mb-8 text-sm text-gray-500 font-medium leading-relaxed">
                Are you sure you want to cancel this overtime request? This action cannot be undone.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleCancel}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-red-100 transition-all active:scale-95"
                >
                  Yes, Cancel Request
                </button>
                <button
                  onClick={() => setConfirmCancelModal(false)}
                  className="w-full py-4 rounded-2xl text-xs font-black uppercase text-gray-400 hover:text-gray-600 transition-colors"
                >
                  No, Keep it
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OvertimeWithModal;

// --- END OF FILE EmployeeOvertimeForm.jsx ---
