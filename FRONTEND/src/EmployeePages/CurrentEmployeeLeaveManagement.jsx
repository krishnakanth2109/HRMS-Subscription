// --- START OF FILE EmployeeLeavemanagement.jsx ---

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
// ✅ IMPORT THE CENTRALIZED API FUNCTIONS
import { getEmployees, getLeaveRequestsForEmployee, applyForLeave } from "../api";

const LeaveWithModal = () => {
  const [form, setForm] = useState({ date_from: "", date_to: "", leaveType: "CASUAL", reason: "" });
  const [employee, setEmployee] = useState(null);
  const [leaveList, setLeaveList] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loggedUser = JSON.parse(localStorage.getItem("hrmsUser"));
  const loggedEmail = loggedUser?.email;

  const fetchEmployeeAndLeaves = useCallback(async () => {
    if (!loggedEmail) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const allEmployees = await getEmployees();
      const emp = allEmployees.find((e) => e.email === loggedEmail);

      if (emp) {
        setEmployee(emp);
        const leaves = await getLeaveRequestsForEmployee(emp.employeeId);
        setLeaveList(leaves);
      } else {
        setError("Could not find employee profile.");
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Failed to load employee data.");
    } finally {
      setLoading(false);
    }
  }, [loggedEmail]);

  useEffect(() => {
    fetchEmployeeAndLeaves();
  }, [fetchEmployeeAndLeaves]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date_from || !form.date_to || !form.leaveType || !form.reason) {
      setError("All fields are required.");
      return;
    }
    try {
      await applyForLeave({
        employeeId: employee.employeeId,
        employeeName: employee.name,
        ...form,
      });
      setSuccess("Leave applied successfully!");
      setForm({ date_from: "", date_to: "", leaveType: "CASUAL", reason: "" });
      fetchEmployeeAndLeaves(); // Refetch data
      setTimeout(() => setModalOpen(false), 1500);
    } catch (err) {
      console.error(err);
      setError("Failed to apply leave.");
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!employee) return <div className="text-red-600 p-6 text-center">Employee Not Found. Please log in again.</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-emerald-900">My Leave Requests</h2>
        <button onClick={() => setModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-800 text-white px-6 py-2 rounded-lg shadow">
          Apply for Leave
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto border">
        <table className="min-w-full text-sm">
          <thead className="bg-emerald-100 text-emerald-900">
            <tr>
              <th className="px-3 py-2 border">From</th>
              <th className="px-3 py-2 border">To</th>
              <th className="px-3 py-2 border">Type</th>
              <th className="px-3 py-2 border">Reason</th>
              <th className="px-3 py-2 border">Status</th>
            </tr>
          </thead>
          <tbody>
            {leaveList.length > 0 ? (
              leaveList.map((lv) => (
                <tr key={lv._id} className="hover:bg-gray-50">
                  <td className="border px-3 py-2">{lv.date_from}</td>
                  <td className="border px-3 py-2">{lv.date_to}</td>
                  <td className="border px-3 py-2 text-center">{lv.leaveType}</td>
                  <td className="border px-3 py-2">{lv.reason}</td>
                  <td className="border px-3 py-2 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      lv.status === "APPROVED" ? "bg-green-200 text-green-800"
                      : lv.status === "REJECTED" ? "bg-red-200 text-red-800"
                      : "bg-yellow-200 text-yellow-800"
                    }`}>
                      {lv.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="5" className="p-4 text-center text-gray-500">No leave requests found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <motion.div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white w-96 p-6 rounded-xl shadow-xl" initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }}>
              <h3 className="text-xl font-bold mb-4 text-emerald-700">Apply for Leave</h3>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div><label className="mb-1 block font-medium">From</label><input type="date" name="date_from" value={form.date_from} onChange={handleChange} className="w-full border rounded px-3 py-2"/></div>
                <div><label className="mb-1 block font-medium">To</label><input type="date" name="date_to" value={form.date_to} onChange={handleChange} className="w-full border rounded px-3 py-2"/></div>
                <div><label className="mb-1 block font-medium">Leave Type</label><select name="leaveType" value={form.leaveType} onChange={handleChange} className="w-full border rounded px-3 py-2"><option value="CASUAL">CASUAL</option><option value="SICK">SICK</option><option value="PAID">PAID</option><option value="UNPAID">UNPAID</option><option value="HALFDAY">HALFDAY</option></select></div>
                <div><label className="mb-1 block font-medium">Reason</label><textarea name="reason" value={form.reason} onChange={handleChange} className="w-full border rounded px-3 py-2"></textarea></div>
                {error && <p className="text-red-600">{error}</p>}
                {success && <p className="text-green-600">{success}</p>}
                <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded shadow hover:bg-emerald-800">Submit Leave</button>
              </form>
              <button onClick={() => setModalOpen(false)} className="mt-4 w-full text-sm underline text-gray-500">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeaveWithModal;