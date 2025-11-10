import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

const OvertimeWithModal = () => {
  const [form, setForm] = useState({ date: "", type: "INCENTIVE_OT" });
  const [employee, setEmployee] = useState(null);
  const [overtimeList, setOvertimeList] = useState([]);

  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loggedUser = JSON.parse(localStorage.getItem("hrmsUser"));
  const loggedEmail = loggedUser?.email;

  // ✅ Fetch Employee
  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await axios.get("http://localhost:5000/employees");
        const emp = res.data.find((e) => e.email === loggedEmail);
        setEmployee(emp || null);
      } catch (err) {
        console.error("Fetch Employee Error:", err);
      } finally {
        setLoading(false);
      }
    };
    if (loggedEmail) fetchEmployee();
  }, [loggedEmail]);

  // ✅ Fetch Employee OT List
  const fetchEmployeeOT = async (empId) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/overtime/${empId}`);
      setOvertimeList(res.data);
    } catch (err) {
      console.error("Fetch OT Error:", err);
    }
  };

  useEffect(() => {
    if (employee?.employeeId) fetchEmployeeOT(employee.employeeId);
  }, [employee]);

  // ✅ Form Change
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  // ✅ Submit OT
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.date || !form.type) {
      setError("Please fill all fields.");
      return;
    }

    try {
      await axios.post("http://localhost:5000/api/overtime/apply", {
        employeeId: employee.employeeId,
        employeeName: employee.name,
        date: form.date,
        type: form.type,
      });

      setSuccess("Overtime submitted successfully!");
      setForm({ date: "", type: "INCENTIVE_OT" });

      fetchEmployeeOT(employee.employeeId);
      setTimeout(() => setModalOpen(false), 1500);
    } catch (err) {
      console.error(err);
      setError("Failed to submit OT.");
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!employee) return <div className="text-red-600">Employee Not Found</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* ✅ Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-indigo-900">Overtime Requests</h2>

        <button
          onClick={() => setModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-800 text-white px-6 py-2 rounded-lg shadow-lg"
        >
          Apply Overtime
        </button>
      </div>

      {/* ✅ OT Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-x-auto border">
        <table className="min-w-full text-sm">
          <thead className="bg-indigo-100 text-indigo-900">
            <tr>
              <th className="px-4 py-3 border">Employee ID</th>
              <th className="px-4 py-3 border">Name</th>
              <th className="px-4 py-3 border">Date</th>
              <th className="px-4 py-3 border">Type</th>
              <th className="px-4 py-3 border">Status</th>
            </tr>
          </thead>

          <tbody>
            {overtimeList.length > 0 ? (
              overtimeList.map((ot) => (
                <tr key={ot._id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-2 border">{ot.employeeId}</td>
                  <td className="px-4 py-2 border">{ot.employeeName}</td>
                  <td className="px-4 py-2 border text-center">{ot.date}</td>
                  <td className="px-4 py-2 border text-center">{ot.type}</td>
                  <td className="px-4 py-2 border text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        ot.status === "APPROVED"
                          ? "bg-green-200 text-green-800"
                          : ot.status === "REJECTED"
                          ? "bg-red-200 text-red-800"
                          : "bg-yellow-200 text-yellow-800"
                      }`}
                    >
                      {ot.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center p-4 text-gray-500">
                  No Overtime Requests Found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ POPUP MODAL */}
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
              <h3 className="text-xl font-bold mb-4 text-indigo-700">Apply Overtime</h3>

              {/* Employee Info */}
              <div className="mb-4 p-3 rounded bg-indigo-50 text-sm">
                <p><b>Name:</b> {employee.name}</p>
                <p><b>ID:</b> {employee.employeeId}</p>
              </div>

              {/* Form */}
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
                    <option value="INCENTIVE_OT">INCENTIVE_OT</option>
                    <option value="PENDING_OT">PENDING_OT</option>
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

              {/* Close Button */}
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
    </div>
  );
};

export default OvertimeWithModal;
