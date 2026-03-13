import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../api";
import Swal from "sweetalert2";
import {
  FaCheck,
  FaTimes,
  FaUserClock,
  FaCalendarDay,
  FaSearch,
  FaUsers,
  FaEdit,
  FaExclamationTriangle,
  FaCog
} from "react-icons/fa";

const AdminLateRequests = () => {
  // --- STATE FROM CODE 1 ---
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");

  // --- NEW STATE FOR LIMITS (FROM CODE 2) ---
  const [requestType, setRequestType] = useState("PENDING");
  const [employeeLimits, setEmployeeLimits] = useState([]);
  const [loadingLimits, setLoadingLimits] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showBulkLimitModal, setShowBulkLimitModal] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [limitSettings, setLimitSettings] = useState({
    employeeId: '',
    employeeName: '',
    currentLimit: 5,
    currentUsed: 0,
    newLimit: 5
  });
  const [bulkLimitValue, setBulkLimitValue] = useState(5);

  // ✅ OPTIMIZED: Fetch Requests (Code 1)
  const fetchRequests = useCallback(async () => {
    if (requests.length === 0) setLoading(true);

    try {
      const { data } = await api.get("/api/attendance/all", {
        params: { status: 'PENDING', type: 'LATE_CORRECTION' }
      });

      const allRecords = data.data || [];
      const pendingRequests = [];

      // High-Performance Loop
      for (const empRecord of allRecords) {
        if (!empRecord.attendance || !Array.isArray(empRecord.attendance)) continue;

        for (const dayLog of empRecord.attendance) {
          if (
            dayLog.lateCorrectionRequest?.hasRequest &&
            dayLog.lateCorrectionRequest?.status === "PENDING"
          ) {
            pendingRequests.push({
              employeeId: empRecord.employeeId,
              employeeName: empRecord.employeeName,
              date: dayLog.date,
              currentPunchIn: dayLog.punchIn,
              requestedTime: dayLog.lateCorrectionRequest.requestedTime,
              reason: dayLog.lateCorrectionRequest.reason,
            });
          }
        }
      }

      // Sort by date (Newest First)
      pendingRequests.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRequests(pendingRequests);
    } catch (err) {
      console.error("Error fetching requests:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ NEW: Fetch Employee Limits (From Code 2)
  const fetchEmployeeLimits = async (showLoader = true) => {
    if (showLoader) setLoadingLimits(true);
    try {
      // Fetch all attendance records first
      const { data } = await api.get("/api/attendance/all");
      const allRecords = data.data || [];
      const limitData = [];
      const batchSize = 5;
      
      // Process in batches for better performance
      for (let i = 0; i < allRecords.length; i += batchSize) {
        const batch = allRecords.slice(i, i + batchSize);
        const batchPromises = batch.map(async (empRecord) => {
          if (!empRecord.employeeId) return null;
          
          try {
            // Use cached data if available
            const existingLimit = employeeLimits.find(emp => emp.employeeId === empRecord.employeeId);
            if (existingLimit && !showLoader) {
              return existingLimit;
            }

            const limitResponse = await api.get(`/api/attendance/request-limit/${empRecord.employeeId}`);
            const currentMonth = new Date().toISOString().slice(0, 7);
            const monthData = limitResponse.data.monthlyRequestLimits?.[currentMonth] || { limit: 5, used: 0 };
            
            return {
              employeeId: empRecord.employeeId,
              employeeName: empRecord.employeeName,
              currentLimit: monthData.limit,
              currentUsed: monthData.used,
              remaining: monthData.limit - monthData.used
            };
          } catch (err) {
            console.error(`Error fetching limit for ${empRecord.employeeId}:`, err);
            return {
              employeeId: empRecord.employeeId,
              employeeName: empRecord.employeeName,
              currentLimit: 5,
              currentUsed: 0,
              remaining: 5
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        limitData.push(...batchResults.filter(Boolean));
      }

      setEmployeeLimits(limitData);
    } catch (err) {
      console.error("Error fetching employee limits:", err);
      if (showLoader) {
        Swal.fire("Error", "Failed to load employee limits.", "error");
      }
    } finally {
      if (showLoader) setLoadingLimits(false);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // ✅ OPTIMIZED: Memoize filtering for requests (Code 1)
  const filteredRequests = useMemo(() => {
    if (!filterText) return requests;
    const lowerFilter = filterText.toLowerCase();
    return requests.filter(r =>
      r.employeeName.toLowerCase().includes(lowerFilter) ||
      r.employeeId.includes(lowerFilter)
    );
  }, [requests, filterText]);

  // ✅ NEW: Memoize filtering for limits (From Code 2)
  const filteredEmployeeLimits = useMemo(() => {
    if (!filterText) return employeeLimits;
    const lowerFilter = filterText.toLowerCase();
    return employeeLimits.filter(emp => 
      emp.employeeName.toLowerCase().includes(lowerFilter) ||
      emp.employeeId.includes(lowerFilter)
    );
  }, [employeeLimits, filterText]);

  // ✅ NEW: Selection Handlers for Bulk Update (From Code 2)
  const handleSelectEmployee = (employeeId) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedEmployees([]);
    } else {
      const allIds = filteredEmployeeLimits.map(emp => emp.employeeId);
      setSelectedEmployees(allIds);
    }
    setSelectAll(!selectAll);
  };

  // ✅ NEW: Open Limit Setting Modal (From Code 2)
  const openLimitModal = async (req) => {
    const employeeLimit = employeeLimits.find(emp => emp.employeeId === req.employeeId);
    
    if (employeeLimit) {
      setLimitSettings({
        employeeId: req.employeeId,
        employeeName: req.employeeName,
        currentLimit: employeeLimit.currentLimit,
        currentUsed: employeeLimit.currentUsed,
        newLimit: employeeLimit.currentLimit
      });
      setShowLimitModal(true);
    } else {
      try {
        const { data } = await api.get(`/api/attendance/request-limit/${req.employeeId}`);
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthData = data.monthlyRequestLimits?.[currentMonth] || { limit: 5, used: 0 };
        
        setLimitSettings({
          employeeId: req.employeeId,
          employeeName: req.employeeName,
          currentLimit: monthData.limit,
          currentUsed: monthData.used,
          newLimit: monthData.limit
        });
        setShowLimitModal(true);
      } catch (err) {
        Swal.fire("Error", "Failed to fetch limit data", "error");
      }
    }
  };

  // ✅ NEW: Update Individual Request Limit (From Code 2)
  const updateRequestLimit = async () => {
    if (limitSettings.newLimit < limitSettings.currentUsed) {
      Swal.fire(
        "Invalid Limit",
        `New limit (${limitSettings.newLimit}) cannot be less than already used requests (${limitSettings.currentUsed})`,
        "warning"
      );
      return;
    }

    Swal.fire({
      title: 'Updating Limit...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      await api.post("/api/attendance/set-request-limit", {
        employeeId: limitSettings.employeeId,
        limit: limitSettings.newLimit
      });

      Swal.fire("Success!", `Request limit updated to ${limitSettings.newLimit} for ${limitSettings.employeeName}`, "success");
      setShowLimitModal(false);
      
      setEmployeeLimits(prev => 
        prev.map(emp => 
          emp.employeeId === limitSettings.employeeId
            ? { ...emp, currentLimit: limitSettings.newLimit, remaining: limitSettings.newLimit - emp.currentUsed }
            : emp
        )
      );
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      Swal.fire("Error", errMsg, "error");
    }
  };

  // ✅ NEW: Bulk Update Request Limits (From Code 2)
  const bulkUpdateRequestLimits = async () => {
    if (selectedEmployees.length === 0) {
      Swal.fire("No Selection", "Please select at least one employee", "warning");
      return;
    }
    if (bulkLimitValue < 0 || bulkLimitValue > 100) {
      Swal.fire("Invalid Value", "Limit must be between 0 and 100", "warning");
      return;
    }

    Swal.fire({
      title: 'Updating Limits...',
      html: `Setting limit to ${bulkLimitValue} for ${selectedEmployees.length} employee(s)`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const results = [];
      const errors = [];
      
      for (const employeeId of selectedEmployees) {
        try {
          const employee = employeeLimits.find(emp => emp.employeeId === employeeId);
          if (!employee) continue;
          
          if (bulkLimitValue < employee.currentUsed) {
            errors.push({
              employeeId,
              employeeName: employee.employeeName,
              error: `Cannot set limit (${bulkLimitValue}) below already used requests (${employee.currentUsed})`
            });
            continue;
          }
          
          await api.post("/api/attendance/set-request-limit", {
            employeeId,
            limit: bulkLimitValue
          });
          
          results.push({ employeeId, employeeName: employee.employeeName, success: true });
        } catch (err) {
          const employee = employeeLimits.find(emp => emp.employeeId === employeeId);
          errors.push({
            employeeId,
            employeeName: employee?.employeeName || employeeId,
            error: err.response?.data?.message || err.message
          });
        }
      }

      if (errors.length > 0) {
        let errorMessage = `Failed to update ${errors.length} of ${selectedEmployees.length} employees:\n\n`;
        errors.slice(0, 5).forEach((err, index) => {
          errorMessage += `${index + 1}. ${err.employeeName} (${err.employeeId}): ${err.error}\n`;
        });
        if (errors.length > 5) errorMessage += `\n... and ${errors.length - 5} more`;
        
        Swal.fire({
          icon: 'warning',
          title: 'Partial Success',
          html: `<div style="text-align: left;">
                  <p><strong>Updated:</strong> ${results.length} employee(s)</p>
                  <p><strong>Failed:</strong> ${errors.length} employee(s)</p>
                  <div style="max-height: 200px; overflow-y: auto; margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                    <pre style="font-size: 11px; white-space: pre-wrap;">${errorMessage}</pre>
                  </div>
                </div>`,
          confirmButtonText: 'OK'
        });
      } else {
        Swal.fire("Success!", `Updated limits to ${bulkLimitValue} for ${selectedEmployees.length} employee(s)`, "success");
      }
      
      setShowBulkLimitModal(false);
      setSelectedEmployees([]);
      setSelectAll(false);
      fetchEmployeeLimits(false);
      
    } catch (err) {
      Swal.fire("Error", "Failed to update limits. Please check individually.", "error");
    }
  };

  // ✅ UPDATED: Handle Approve / Reject (Code 1 - With Limits Cache Update from Code 2)
  const handleAction = async (reqItem, action) => {
    const isApprove = action === "APPROVED";
    let adminComment = "";

    // 1. Gather Input / Confirmation
    if (!isApprove) {
      const { value: text } = await Swal.fire({
        input: "textarea",
        inputLabel: "Rejection Reason",
        inputPlaceholder: "Type your reason here...",
        inputAttributes: { "aria-label": "Type your reason here" },
        showCancelButton: true,
        confirmButtonText: "Reject Request",
        confirmButtonColor: "#d33",
        showLoaderOnConfirm: true,
      });
      if (text === undefined) return; 
      if (!text) {
        Swal.fire("Required", "Please provide a reason for rejection", "warning");
        return;
      }
      adminComment = text;
    } else {
      const confirm = await Swal.fire({
        title: "Approve Time Change?",
        html: `This will update <b>${reqItem.employeeName}'s</b> First Punch In time to <br/>
                   <b style="color:green; font-size:1.1em">${new Date(reqItem.requestedTime).toLocaleTimeString()}</b>.`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#10b981",
        confirmButtonText: "Yes, Update Punch In"
      });
      if (!confirm.isConfirmed) return;
    }

    Swal.fire({
      title: isApprove ? 'Approving...' : 'Rejecting...',
      html: 'Please wait while we update the attendance records.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      await api.post("/api/attendance/approve-correction", {
        employeeId: reqItem.employeeId,
        date: reqItem.date,
        status: action,
        adminComment: adminComment
      });

      // Optimistic list update
      setRequests(prevRequests => prevRequests.filter(r =>
        !(r.employeeId === reqItem.employeeId && r.date === reqItem.date)
      ));

      // ✅ Update employee limits cache if rejected (restores their limit count)
      if (action === "REJECTED") {
        setEmployeeLimits(prev => 
          prev.map(emp => 
            emp.employeeId === reqItem.employeeId && emp.currentUsed > 0
              ? { ...emp, currentUsed: emp.currentUsed - 1, remaining: emp.remaining + 1 }
              : emp
          )
        );
      }

      Swal.fire(
        isApprove ? "Approved!" : "Rejected",
        isApprove
          ? "Attendance record has been updated successfully."
          : "Request has been rejected.",
        "success"
      );

      fetchRequests(); // Sync

    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      Swal.fire("Error", errMsg, "error");
    }
  };

  return (
    <div className="p-6 min-h-screen font-sans">
      <div className="flex flex-col border-gray-300 p-4 rounded-2xl bg-white md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FaUserClock className="text-orange-600" /> Late Login Requests
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Employees requesting correction for "Late" login status.
          </p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => { setRequestType("PENDING"); fetchRequests(); }} 
            className={`text-sm px-4 py-2 rounded-lg transition shadow-sm font-medium ${
              requestType === "PENDING" 
                ? "bg-orange-600 text-white" 
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            Pending Approvals
          </button>
          <button 
            onClick={() => { setRequestType("LIMITS"); fetchEmployeeLimits(); }} 
            className={`text-sm px-4 py-2 rounded-lg transition shadow-sm font-medium flex items-center gap-2 ${
              requestType === "LIMITS" 
                ? "bg-purple-600 text-white" 
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            <FaUsers /> Manage Limits
          </button>
          
          {requestType === "PENDING" && (
            <button
              onClick={() => { setLoading(true); fetchRequests(); }}
              className="text-sm bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 transition shadow-sm font-medium"
            >
              Refresh List
            </button>
          )}
        </div>
        {/* <button 
            onClick={() => { setLoading(true); fetchRequests(); }} 
            className="text-sm  px-4 py-2 rounded-lg bg-gray-200 border-gray-500 hover:bg-gray-600 transition shadow-sm font-medium"
        >
            Refresh List
        </button> */}
      </div>

      {/* Search Bar + Bulk Actions */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 max-w-2xl">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Employee Name or ID..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-200 outline-none transition shadow-sm bg-white"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
        
        {requestType === "LIMITS" && (
          <button
            onClick={() => setShowBulkLimitModal(true)}
            disabled={selectedEmployees.length === 0}
            className={`px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-sm transition ${
              selectedEmployees.length > 0 
                ? "bg-purple-600 text-white hover:bg-purple-700" 
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            <FaCog /> Bulk Edit ({selectedEmployees.length})
          </button>
        )}
      </div>

      {/* Content Area */}
      {requestType === "LIMITS" ? (
        /* --- NEW: LIMITS VIEW --- */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 text-lg">
              Monthly Request Limits
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({filteredEmployeeLimits.length} employees)
              </span>
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
              />
              <span className="text-sm text-gray-600 cursor-pointer" onClick={handleSelectAll}>Select All</span>
            </div>
          </div>
          
          {loadingLimits ? (
            <div className="p-8 text-center flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-purple-600"></div>
              <p className="mt-3 text-gray-500 font-medium">Loading employee limits...</p>
            </div>
          ) : filteredEmployeeLimits.length === 0 ? (
            <div className="p-8 text-center text-gray-500 font-medium">
              No employee limits found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="p-4 text-left font-medium text-gray-500 uppercase tracking-wider w-12"></th>
                    <th className="p-4 text-left font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="p-4 text-left font-medium text-gray-500 uppercase tracking-wider">Current Limit</th>
                    <th className="p-4 text-left font-medium text-gray-500 uppercase tracking-wider">Used</th>
                    <th className="p-4 text-left font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                    <th className="p-4 text-left font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                    <th className="p-4 text-right font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEmployeeLimits.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(emp.employeeId)}
                          onChange={() => handleSelectEmployee(emp.employeeId)}
                          className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-bold text-gray-900">{emp.employeeName}</p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{emp.employeeId}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded">{emp.currentLimit}</span>
                      </td>
                      <td className="p-4">
                        <span className={`font-bold ${emp.currentUsed > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                          {emp.currentUsed}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`font-bold ${emp.remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {emp.remaining}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="w-32">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${emp.currentUsed / emp.currentLimit > 0.8 ? 'bg-red-500' : emp.currentUsed / emp.currentLimit > 0.5 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min((emp.currentUsed / emp.currentLimit) * 100, 100)}%` }}
                            ></div>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1.5 font-medium">
                            {Math.round((emp.currentUsed / emp.currentLimit) * 100)}% used
                          </p>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openLimitModal(emp)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white text-purple-700 hover:bg-purple-50 rounded-lg border border-purple-200 transition font-bold"
                        >
                          <FaEdit /> Edit Limit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : loading ? (
        /* --- ORIGINAL: LOADING VIEW --- */
        <div className="flex flex-col justify-center items-center h-64 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-orange-600"></div>
          <p className="mt-4 text-gray-500 font-medium">Fetching requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        /* --- ORIGINAL: EMPTY VIEW --- */
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaCheck className="text-green-500 text-2xl" />
          </div>
          <h3 className="text-lg font-bold text-gray-700">All caught up!</h3>
          <p className="text-gray-400 mt-1">No pending late correction requests found.</p>
        </div>
      ) : (
        /* --- ORIGINAL: GRID VIEW --- */
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredRequests.map((req, idx) => (
            <div key={`${req.employeeId}-${req.date}`} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-200 flex flex-col group">

              {/* Card Header */}
              <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg group-hover:text-orange-600 transition-colors">{req.employeeName}</h3>
                  <span className="text-[11px] font-bold text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                    {req.employeeId}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                    <FaCalendarDay />
                    {new Date(req.date).toLocaleDateString("en-GB")}
                  </div>
                  {/* Quick Limit Edit Button Included inside Card */}
                  <button
                    onClick={() => openLimitModal(req)}
                    className="flex items-center gap-1 text-[10px] text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded border border-purple-200 transition font-bold"
                    title="Edit Monthly Limit"
                  >
                    <FaEdit /> Limit
                  </button>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 space-y-4">

                {/* Time Comparison Block */}
                <div className="flex items-center justify-between bg-orange-50/50 p-3 rounded-xl border border-orange-100">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-wider">Was</p>
                    <p className="text-red-500 font-mono font-bold text-lg line-through decoration-2 opacity-70">
                      {req.currentPunchIn
                        ? new Date(req.currentPunchIn).toLocaleTimeString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          hour: "2-digit",
                          minute: "2-digit"
                        })
                        : "--:--"
                      }
                    </p>
                  </div>
                  <div className="text-orange-300 text-xl font-light">➜</div>

                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-wider">Change To</p>
                    <p className="text-green-600 font-mono font-bold text-xl bg-green-50 px-2 rounded">
                      {new Date(req.requestedTime).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true, 
                        timeZone: "Asia/Kolkata"
                      })}
                    </p>
                  </div>
                </div>

                {/* Reason Block */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Reason provided</p>
                  <p className="text-sm text-gray-700 italic leading-relaxed">
                    "{req.reason}"
                  </p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-3 bg-gray-50/50 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => handleAction(req, "REJECTED")}
                  className="flex-1 flex items-center justify-center gap-2 bg-white text-red-600 border border-red-200 hover:bg-red-50 py-2.5 rounded-lg font-bold transition text-xs shadow-sm"
                >
                  <FaTimes /> Reject
                </button>
                <button
                  onClick={() => handleAction(req, "APPROVED")}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700 py-2.5 rounded-lg font-bold transition text-xs shadow-md shadow-green-200"
                >
                  <FaCheck /> Approve
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* --- NEW: Individual Limit Modal --- */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FaEdit className="text-purple-600" />
                Edit Request Limit
              </h3>
              <button 
                onClick={() => setShowLimitModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-1">Employee</p>
              <p className="font-bold text-gray-800">{limitSettings.employeeName}</p>
              <p className="text-xs text-gray-500 font-mono">{limitSettings.employeeId}</p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <FaExclamationTriangle className="text-purple-600" />
                <p className="text-sm font-bold text-purple-900">Current Month Status</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-purple-600 mb-1 font-medium">Current Limit</p>
                  <p className="text-2xl font-bold text-purple-900">{limitSettings.currentLimit}</p>
                </div>
                <div>
                  <p className="text-xs text-purple-600 mb-1 font-medium">Requests Used</p>
                  <p className="text-2xl font-bold text-purple-900">{limitSettings.currentUsed}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="w-full bg-purple-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((limitSettings.currentUsed / limitSettings.currentLimit) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-purple-700 mt-2 text-center font-medium">
                  {limitSettings.currentLimit - limitSettings.currentUsed} requests remaining
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Set New Monthly Limit
              </label>
              <input
                type="number"
                min={limitSettings.currentUsed}
                max="100"
                value={limitSettings.newLimit}
                onChange={(e) => setLimitSettings({...limitSettings, newLimit: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none text-lg font-bold text-center transition"
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Minimum: {limitSettings.currentUsed} (already used this month)
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLimitModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={updateRequestLimit}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-bold transition shadow-lg shadow-purple-200"
              >
                Update Limit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- NEW: Bulk Limit Modal --- */}
      {showBulkLimitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FaUsers className="text-purple-600" />
                Bulk Update Limits
              </h3>
              <button 
                onClick={() => setShowBulkLimitModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3">
                Updating limits for <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{selectedEmployees.length}</span> selected employee(s).
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm font-bold text-yellow-800 mb-1 flex items-center gap-1">
                  <FaExclamationTriangle /> Important
                </p>
                <p className="text-xs text-yellow-700 leading-relaxed">
                  This sets the identical limit for all selections. It will fail for any employee whose currently used requests exceed the new limit you type below.
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                New Monthly Limit (For All Selected)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={bulkLimitValue}
                onChange={(e) => setBulkLimitValue(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none text-lg font-bold text-center transition"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkLimitModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={bulkUpdateRequestLimits}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-bold transition shadow-lg shadow-purple-200"
              >
                Update All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLateRequests;