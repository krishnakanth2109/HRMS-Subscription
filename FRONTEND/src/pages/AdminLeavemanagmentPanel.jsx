// --- START OF FILE AdminLeaveManagementPanel.jsx ---
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import api, { // ✅ Added default api import for profile fetching
  getLeaveRequests,
  getEmployees,
  approveLeaveRequestById,
  rejectLeaveRequestById,
} from "../api";
import { FaCheck, FaTimes, FaFilter, FaCalendarAlt } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";

// ✅ Helper to ensure URLs are always HTTPS
const getSecureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http:")) {
    return url.replace("http:", "https:");
  }
  return url;
};

const AdminLeavePanel = () => {
  const location = useLocation();

  const [leaveList, setLeaveList] = useState([]);
  const [employeesMap, setEmployeesMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(null);

  // --- UI States ---
  // Defaulting to current month for the month filter
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterDept, setFilterDept] = useState("All");
  const [filterStatus, setFilterStatus] = useState(
    location.state?.defaultStatus || "All"
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [showMoreId, setShowMoreId] = useState(null);
  const [snackbar, setSnackbar] = useState("");

  // Confirm Popup
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [selectedLeaveId, setSelectedLeaveId] = useState(null);

  // ✅ NEW: Image States
  const [employeeImages, setEmployeeImages] = useState({});
  const [previewImage, setPreviewImage] = useState(null);

  const showSnackbar = (msg) => {
    setSnackbar(msg);
    setTimeout(() => setSnackbar(""), 1800);
  };

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [leavesData, employeesData] = await Promise.all([
        getLeaveRequests(),
        getEmployees(),
      ]);

      setLeaveList(leavesData);

      // FIX: Create map using BOTH employeeId & _id
      const map = new Map();
      employeesData.forEach((emp) => {
        if (emp.employeeId) map.set(emp.employeeId, emp);
        if (emp._id) map.set(emp._id, emp);
      });

      setEmployeesMap(map);
    } catch (err) {
      console.error("Admin Panel Data Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ✅ NEW: Fetch Images for employees in the leave list
  useEffect(() => {
    const fetchImages = async () => {
      if (leaveList.length === 0) return;
      
      const uniqueEmployeeIds = [...new Set(leaveList.map(l => l.employeeId))];
      const newImages = {};

      for (const empId of uniqueEmployeeIds) {
        if (empId && !employeeImages[empId]) {
            try {
               const res = await api.get(`/api/profile/${empId}`);
               if (res.data?.profilePhoto?.url) {
                   newImages[empId] = getSecureUrl(res.data.profilePhoto.url);
               }
            } catch (err) {
               // Silent fail
            }
        }
      }

      if (Object.keys(newImages).length > 0) {
        setEmployeeImages(prev => ({ ...prev, ...newImages }));
      }
    };

    fetchImages();
  }, [leaveList]);

  // FIX: Get department from experienceDetails[0].department
  const enrichedLeaveList = useMemo(() => {
    return leaveList.map((leave) => {
      const emp = employeesMap.get(leave.employeeId);

      return {
        ...leave,
        employeeName: emp?.name || "Unknown",
        department:
          emp?.experienceDetails?.[0]?.department || "Unassigned",
      };
    });
  }, [leaveList, employeesMap]);

  const allDepartments = useMemo(() => {
    return Array.from(
      new Set(
        Array.from(employeesMap.values()).map(
          (emp) => emp?.experienceDetails?.[0]?.department
        )
      )
    ).filter(Boolean);
  }, [employeesMap]);

  // Filter logic (including today and month)
  const filteredRequests = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return enrichedLeaveList.filter((req) => {
      // 1. Filter by Department
      const matchDept =
        filterDept === "All" || req.department === filterDept;

      // 2. Filter by Status
      const matchStatus =
        filterStatus === "All" ||
        req.status === filterStatus ||
        (filterStatus === "Today" &&
          req.status === "Approved" &&
          today >= req.from &&
          today <= req.to);

      // 3. Filter by Search Query
      const matchSearch =
        req.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.employeeName?.toLowerCase().includes(searchQuery.toLowerCase());

      // 4. Filter by Month (New Logic)
      // Check if the request's 'from' date starts with the selected YYYY-MM
      const matchMonth = filterMonth
        ? req.from.startsWith(filterMonth)
        : true;

      return matchDept && matchStatus && matchSearch && matchMonth;
    });
  }, [enrichedLeaveList, filterDept, filterStatus, searchQuery, filterMonth]);

  // Today on leave count
  const todayOnLeave = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return enrichedLeaveList.filter(
      (req) =>
        req.status === "Approved" &&
        today >= req.from &&
        today <= req.to
    ).length;
  }, [enrichedLeaveList]);

  // Approve / Reject
  const openConfirm = (id, actionType) => {
    setSelectedLeaveId(id);
    setConfirmAction(actionType);
    setConfirmOpen(true);
  };

  const handleConfirmAction = async () => {
    try {
      setStatusUpdating(selectedLeaveId);
      setConfirmOpen(false);

      if (confirmAction === "Approved") {
        await approveLeaveRequestById(selectedLeaveId);
      } else {
        await rejectLeaveRequestById(selectedLeaveId);
      }

      await fetchAllData();
      showSnackbar(`Leave ${confirmAction.toLowerCase()} successfully.`);
    } catch {
      showSnackbar("Failed to update leave.");
    } finally {
      setStatusUpdating(null);
    }
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

  if (loading)
    return <div className="p-6 text-center text-lg">Loading...</div>;

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6 text-emerald-900">
        Leave Management (Admin Panel)
      </h2>

      {/* STAT CARDS */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white shadow-lg rounded-xl p-6 flex items-center gap-4 border-l-8 border-red-600">
          <div className="bg-red-100 text-red-600 p-3 rounded-full text-2xl">
            <FaCalendarAlt />
          </div>
          <div>
            <h3 className="text-gray-600 font-semibold text-sm">On Leave Today</h3>
            <p className="text-3xl font-extrabold text-gray-800">
              {todayOnLeave}
            </p>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-xl p-6 flex items-center gap-4 border-l-8 border-green-600">
          <div className="bg-green-100 text-green-600 p-3 rounded-full text-2xl">
            ✔
          </div>
          <div>
            <h3 className="text-gray-600 font-semibold text-sm">Approved</h3>
            <p className="text-3xl font-extrabold text-gray-800">
              {filteredRequests.filter((r) => r.status === "Approved").length}
            </p>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-xl p-6 flex items-center gap-4 border-l-8 border-yellow-600">
          <div className="bg-yellow-100 text-yellow-600 p-3 rounded-full text-2xl">
            ⏳
          </div>
          <div>
            <h3 className="text-gray-600 font-semibold text-sm">Pending</h3>
            <p className="text-3xl font-extrabold text-gray-800">
              {filteredRequests.filter((r) => r.status === "Pending").length}
            </p>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FaFilter className="text-blue-600" />

        {/* Month Filter */}
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="border px-3 py-2 rounded shadow text-gray-700 bg-white"
        />

        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="border px-3 py-2 rounded shadow"
        >
          <option value="All">All Departments</option>
          {allDepartments.map((dept) => (
            <option key={dept}>{dept}</option>
          ))}
        </select>

        {["All", "Pending", "Approved", "Rejected", "Today"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-2 rounded font-semibold transition ${
              filterStatus === s
                ? "bg-blue-600 text-white"
                : "bg-gray-100 hover:bg-blue-100"
            }`}
          >
            {s === "Today" ? "On Leave Today" : s}
          </button>
        ))}
      </div>

      {/* SEARCH */}
      <input
        type="text"
        placeholder="Search by Name or Employee ID"
        className="border px-4 py-2 rounded mb-4 w-full max-w-sm"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* SUMMARY */}
      <div className="mb-4 bg-gray-50 p-3 rounded-xl shadow flex gap-6 text-sm font-semibold">
        <span>Total: {filteredRequests.length}</span>
        <span>Approved: {filteredRequests.filter((r) => r.status === "Approved").length}</span>
        <span>Pending: {filteredRequests.filter((r) => r.status === "Pending").length}</span>
        <span>Rejected: {filteredRequests.filter((r) => r.status === "Rejected").length}</span>
        <span>On Leave Today: {todayOnLeave}</span>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-4">ID</th>
              <th className="p-4">Name</th>
              <th className="p-4">Dept</th>
              <th className="p-4">From</th>
              <th className="p-4">To</th>
              <th className="p-4">Type</th>
              <th className="p-4">Reason</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredRequests.length ? (
              filteredRequests.map((lv) => {
                // ✅ Get profile pic
                const profilePic = employeeImages[lv.employeeId];

                return (
                <React.Fragment key={lv._id}>
                  <tr className="border-t hover:bg-blue-50 transition">
                    <td className="p-4">{lv.employeeId}</td>
                    
                    {/* ✅ UPDATED NAME CELL WITH PROFILE PIC */}
                    <td className="p-4">
                       <div className="flex items-center gap-3">
                           <div 
                              className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200 overflow-hidden cursor-pointer"
                              onClick={() => profilePic && setPreviewImage(profilePic)}
                           >
                              {profilePic ? (
                                  <img src={profilePic} alt={lv.employeeName} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                              ) : (
                                  (lv.employeeName || "U").charAt(0)
                              )}
                           </div>
                           <span className="font-medium text-gray-800">{lv.employeeName}</span>
                       </div>
                    </td>

                    <td className="p-4">{lv.department}</td>
                    <td className="p-4">{lv.from}</td>
                    <td className="p-4">{lv.to}</td>
                    <td className="p-4">{lv.leaveType}</td>
                    <td className="p-4">{lv.reason}</td>
                    <td className="p-4">{statusBadge(lv.status)}</td>

                    <td className="p-4 flex gap-2">
                      <button
                        onClick={() =>
                          setShowMoreId(showMoreId === lv._id ? null : lv._id)
                        }
                        className="bg-blue-100 text-blue-700 px-2 py-1 rounded"
                      >
                        {showMoreId === lv._id ? "Hide" : "Details"}
                      </button>

                      <button
                        onClick={() => openConfirm(lv._id, "Approved")}
                        className="bg-green-100 text-green-700 px-2 py-1 rounded"
                      >
                        <FaCheck />
                      </button>

                      <button
                        onClick={() => openConfirm(lv._id, "Rejected")}
                        className="bg-red-100 text-red-700 px-2 py-1 rounded"
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
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="px-3 py-2">Date</th>
                                  <th className="px-3 py-2">Category</th>
                                  <th className="px-3 py-2">Type</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lv.details.map((d, i) => (
                                  <tr key={i}>
                                    <td className="px-3 py-2">{d.date}</td>
                                    <td className="px-3 py-2">{d.leavecategory}</td>
                                    <td className="px-3 py-2">{d.leaveDayType}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p>No details available.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )})
            ) : (
              <tr>
                <td colSpan="9" className="text-center p-4 text-gray-500">
                  No leave requests found for this month/filter.
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
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
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
                  className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-800"
                >
                  Yes, Confirm
                </button>

                <button
                  onClick={() => setConfirmOpen(false)}
                  className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ✅ LIGHTBOX / FULL SCREEN IMAGE POPUP */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 rounded-full bg-white/10 backdrop-blur-sm">
             <FaTimes size={24} />
          </button>
          <img 
            src={previewImage} 
            alt="Full Preview" 
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}

      {snackbar && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-indigo-600 text-white rounded shadow-lg">
          {snackbar}
        </div>
      )}
    </div>
  );
};

export default AdminLeavePanel;
// --- END OF FILE AdminLeaveManagementPanel.jsx ---