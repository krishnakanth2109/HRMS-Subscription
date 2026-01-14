// --- START OF FILE AdminLeaveManagementPanel.jsx ---
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import api, {
  getLeaveRequests,
  getEmployees,
  approveLeaveRequestById,
  rejectLeaveRequestById,
} from "../api";
import {
  FaFilter,
  FaCalendarAlt,
  FaSearch,
  FaChevronDown,
  FaCheck,
  FaTimes,
  FaInfoCircle,
  FaUserTie
} from "react-icons/fa";
import { useLocation } from "react-router-dom";
import Swal from "sweetalert2";

// ✅ Helper to ensure URLs are always HTTPS
const getSecureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http:")) {
    return url.replace("http:", "https:");
  }
  return url;
};

// ✅ Helper to calculate number of days
const getDayCount = (from, to) => {
  if (!from || !to) return 0;
  const start = new Date(from);
  const end = new Date(to);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays || 0;
};

// ✅ Date format helper: DD/MM/YYYY
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};


const AdminLeavePanel = () => {
  const location = useLocation();

  const [leaveList, setLeaveList] = useState([]);
  const [employeesMap, setEmployeesMap] = useState(new Map());
  const [loading, setLoading] = useState(true);

  // --- UI States ---
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterDept, setFilterDept] = useState("All");
  const [filterStatus, setFilterStatus] = useState(
    location.state?.defaultStatus || "All"
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [showMoreId, setShowMoreId] = useState(null);

  // ✅ Action Dropdown State
  const [openDropdownId, setOpenDropdownId] = useState(null);

  // ✅ Image States
  const [employeeImages, setEmployeeImages] = useState({});
  const [previewImage, setPreviewImage] = useState(null);

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [leavesData, employeesData] = await Promise.all([
        getLeaveRequests(),
        getEmployees(),
      ]);

      setLeaveList(leavesData);

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

  // Fetch Images
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
          } catch (err) { }
        }
      }
      if (Object.keys(newImages).length > 0) {
        setEmployeeImages(prev => ({ ...prev, ...newImages }));
      }
    };
    fetchImages();
  }, [leaveList]);

  const enrichedLeaveList = useMemo(() => {
    return leaveList.map((leave) => {
      const emp = employeesMap.get(leave.employeeId);
      return {
        ...leave,
        employeeName: emp?.name || "Unknown",
        department: emp?.experienceDetails?.[0]?.department || "Unassigned",
      };
    });
  }, [leaveList, employeesMap]);

  const allDepartments = useMemo(() => {
    return Array.from(new Set(Array.from(employeesMap.values()).map((emp) => emp?.experienceDetails?.[0]?.department))).filter(Boolean);
  }, [employeesMap]);

  // Filter logic
  const filteredRequests = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return enrichedLeaveList.filter((req) => {
      const matchDept = filterDept === "All" || req.department === filterDept;
      const matchStatus = filterStatus === "All" || req.status === filterStatus || (filterStatus === "Today" && req.status === "Approved" && today >= req.from && today <= req.to);
      const matchSearch = req.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) || req.employeeName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchMonth = filterMonth ? req.from.startsWith(filterMonth) : true;
      return matchDept && matchStatus && matchSearch && matchMonth;
    });
  }, [enrichedLeaveList, filterDept, filterStatus, searchQuery, filterMonth]);

  const todayOnLeave = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return enrichedLeaveList.filter((req) => req.status === "Approved" && today >= req.from && today <= req.to).length;
  }, [enrichedLeaveList]);

  // ✅ ACTION HANDLER (Approve/Reject)
  const handleAction = (id, action) => {
    // 1. Close dropdown immediately
    setOpenDropdownId(null);

    const isApprove = action === 'approve';

    // 2. Open Confirmation Alert
    Swal.fire({
      title: isApprove ? 'Approve Request?' : 'Reject Request?',
      text: `Are you sure you want to ${action} this leave request?`,
      icon: isApprove ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonColor: isApprove ? '#10B981' : '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: isApprove ? 'Yes, Approve' : 'Yes, Reject'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          // 3. Show loading
          Swal.fire({
            title: 'Processing...',
            text: 'Please wait',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
          });

          // 4. Call API
          if (isApprove) {
            await approveLeaveRequestById(id);
          } else {
            await rejectLeaveRequestById(id);
          }

          await fetchAllData(); // 5. Refresh Data

          Swal.fire(
            'Success!',
            `Leave request has been ${action}d.`,
            'success'
          );
        } catch (error) {
          console.error("Action failed", error);
          Swal.fire(
            'Error!',
            'Failed to update request. Please try again.',
            'error'
          );
        }
      }
    });
  };

  // ✅ Status Badge Component
  const StatusBadge = ({ status }) => {
    const styles = {
      Pending: "bg-amber-100 text-amber-700 border-amber-200 ring-amber-500/20",
      Approved: "bg-emerald-100 text-emerald-700 border-emerald-200 ring-emerald-500/20",
      Rejected: "bg-rose-100 text-rose-700 border-rose-200 ring-rose-500/20",
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold border ring-1 ${styles[status] || "bg-gray-100"}`}>
        {status}
      </span>
    );
  };

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen font-sans relative">

      {/* ✅ INVISIBLE BACKDROP TO CLOSE DROPDOWNS */}
      {openDropdownId && (
        <div
          className="fixed inset-0 z-30 cursor-default"
          onClick={() => setOpenDropdownId(null)}
        ></div>
      )}

      {/* HEADER */}
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Leave Management</h2>
        <p className="text-slate-500 mt-2">Oversee and manage employee leave requests efficiently.</p>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { title: "On Leave Today", val: todayOnLeave, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-500" },
          { title: "Approved", val: filteredRequests.filter((r) => r.status === "Approved").length, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-500" },
          { title: "Pending", val: filteredRequests.filter((r) => r.status === "Pending").length, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-500" }
        ].map((stat, idx) => (
          <div key={idx} className={`bg-white p-6 rounded-2xl shadow-sm border-b-4 ${stat.border} flex items-center justify-between transform hover:-translate-y-1 transition-all duration-300`}>
            <div>
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">{stat.title}</div>
              <div className="text-4xl font-extrabold text-slate-800 mt-1">{stat.val}</div>
            </div>
            <div className={`p-4 rounded-full ${stat.bg} ${stat.color} text-xl shadow-inner`}>
              <FaCalendarAlt />
            </div>
          </div>
        ))}
      </div>

      {/* FILTERS & SEARCH */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6 flex flex-col lg:flex-row gap-4 items-center justify-between z-20 relative">
        <div className="flex flex-wrap gap-3 items-center w-full lg:w-auto">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:border-indigo-300 transition-colors">
            <FaFilter className="text-indigo-500" />
            <span className="font-semibold text-sm">Filters:</span>
          </div>

          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
          />

          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
          >
            <option value="All">All Departments</option>
            {allDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Today">On Leave Today</option>
          </select>
        </div>

        <div className="relative w-full lg:w-80">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search Name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
          />
        </div>
      </div>

      {/* DYNAMIC EXTENDABLE TABLE */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-[600px]">
        <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-xs sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-5 tracking-wide">Name</th>
                <th className="p-5 tracking-wide">Dept</th>
                <th className="p-5 tracking-wide">From</th>
                <th className="p-5 tracking-wide">To</th>
                <th className="p-5 tracking-wide text-center">Duration</th>
                <th className="p-5 tracking-wide">Type</th>
                <th className="p-5 tracking-wide">Reason</th>
                <th className="p-5 tracking-wide">Status</th>
                <th className="p-5 tracking-wide text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.map((lv) => {
                const profilePic = employeeImages[lv.employeeId];
                const daysCount = getDayCount(lv.from, lv.to);
                const isDropdownOpen = openDropdownId === lv._id;

                return (
                  <React.Fragment key={lv._id}>
                    <tr className="hover:bg-indigo-50/40 transition duration-150 ease-in-out group">
                      <td className="p-5">
                        <div className="flex items-center gap-4">
                          <div
                            className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px] cursor-pointer shadow-md hover:scale-105 transition-transform"
                            onClick={() => profilePic && setPreviewImage(profilePic)}
                          >
                            <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                              {profilePic ? (
                                <img src={profilePic} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-indigo-600 font-bold text-lg">{(lv.employeeName || "U").charAt(0)}</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{lv.employeeName}</div>
                            <div className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded w-fit mt-0.5">{lv.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-5">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-semibold text-xs border border-slate-200">
                          {lv.department}
                        </span>
                      </td>

                      <td className="p-5 whitespace-nowrap font-medium text-slate-600">
                        {formatDate(lv.from)}
                      </td>
                      <td className="p-5 whitespace-nowrap font-medium text-slate-600">
                        {formatDate(lv.to)}
                      </td>


                      {/* ✅ DAYS: FIXED LINE BREAK ISSUE */}
                      <td className="p-5 text-center">
                        <div className="inline-flex items-center justify-center bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg text-xs whitespace-nowrap shadow-sm border border-blue-100">
                          {daysCount} Days
                        </div>
                      </td>

                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                          <span className="font-medium text-slate-700">{lv.leaveType}</span>
                        </div>
                      </td>

                      {/* ✅ REASON: Truncate to prevent table overflow */}
                      <td className="p-5">
                        <div className="max-w-[200px] truncate text-slate-500" title={lv.reason}>
                          {lv.reason}
                        </div>
                      </td>

                      <td className="p-5"><StatusBadge status={lv.status} /></td>

                      <td className="p-5 relative text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(isDropdownOpen ? null : lv._id);
                          }}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all
                                ${isDropdownOpen ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}`}
                        >
                          Actions <FaChevronDown size={10} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* ✅ DYNAMIC DROPDOWN MENU */}
                        {isDropdownOpen && (
                          <div className="absolute right-8 top-12 w-44 bg-white rounded-xl shadow-2xl border border-slate-100 z-40 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                            <div className="p-1.5 space-y-1">
                              <button
                                onClick={() => {
                                  setOpenDropdownId(null);
                                  setShowMoreId(showMoreId === lv._id ? null : lv._id);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-lg flex items-center gap-2 transition-colors"
                              >
                                <FaInfoCircle className="text-indigo-400" /> View Details
                              </button>

                              <div className="h-px bg-slate-100 my-1"></div>

                              {/* ✅ ALWAYS SHOW BUTTONS (Status Changeable) */}
                              <button
                                onClick={() => handleAction(lv._id, "approve")}
                                className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg flex items-center gap-2 transition-colors"
                              >
                                <FaCheck /> Approve
                              </button>
                              <button
                                onClick={() => handleAction(lv._id, "reject")}
                                className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition-colors"
                              >
                                <FaTimes /> Reject
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* EXPANDABLE ROW */}
                    {showMoreId === lv._id && (
                      <tr className="bg-slate-50/50">
                        <td colSpan="9" className="p-6 border-t border-b border-indigo-100 relative">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                            <h4 className="font-bold text-sm mb-4 text-slate-800 flex items-center gap-2">
                              <FaCalendarAlt className="text-indigo-500" /> Daily Breakdown
                            </h4>
                            {lv.details?.length ? (
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {lv.details.map((d, i) => (
                                  <div key={i} className="border border-slate-200 p-3 rounded-lg text-xs bg-slate-50 hover:bg-white hover:shadow-md transition-all cursor-default">
                                    <div className="font-bold text-slate-700 mb-1">
                                      {formatDate(d.date)}
                                    </div>

                                    <div className="text-slate-500 mb-1">{d.leavecategory}</div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${d.leaveDayType === 'Full Day' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                                      {d.leaveDayType}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-slate-400 italic text-xs">No detailed breakdown provided.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}

              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan="9" className="p-12 text-center text-slate-400 flex flex-col items-center justify-center w-full">
                    <div className="bg-slate-100 p-4 rounded-full mb-3 text-slate-300">
                      <FaSearch size={32} />
                    </div>
                    <span className="font-medium">No leave requests found matching your filters.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="bg-slate-50 p-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center px-6">
          <span className="font-semibold">Total Records: {filteredRequests.length}</span>
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Approved</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Pending</span>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} alt="Profile" className="max-h-[85vh] max-w-full rounded-lg shadow-2xl" />
          <button className="absolute top-6 right-6 text-white/70 hover:text-white p-2">
            <FaTimes size={24} />
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminLeavePanel;
// --- END OF FILE AdminLeaveManagementPanel.jsx ---