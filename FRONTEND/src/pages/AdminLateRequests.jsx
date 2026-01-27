import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../api"; 
import Swal from "sweetalert2";
import { 
  FaCheck, 
  FaTimes, 
  FaUserClock, 
  FaCalendarDay, 
  FaSearch
} from "react-icons/fa";

const AdminLateRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");

  // ✅ OPTIMIZED: Fetch Requests with faster processing loop
  const fetchRequests = useCallback(async () => {
    // Only set loading true if it's the initial fetch or a manual refresh
    // We don't want to flash the spinner too much if just re-syncing
    if(requests.length === 0) setLoading(true);
    
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
      if (err.code !== "ERR_CANCELED") {
         // Silent fail or toast could be better, but keeping simple for now
         // Swal.fire("Error", "Failed to load requests.", "error");
      }
    } finally {
      setLoading(false);
    }
  }, []); // removed 'requests.length' from dependency to prevent loop

  // Initial Load
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // ✅ OPTIMIZED: Memoize filtering
  const filteredRequests = useMemo(() => {
    if (!filterText) return requests;
    const lowerFilter = filterText.toLowerCase();
    return requests.filter(r => 
      r.employeeName.toLowerCase().includes(lowerFilter) ||
      r.employeeId.includes(lowerFilter)
    );
  }, [requests, filterText]);

  // ✅ UPDATED: Handle Approve / Reject with Loading & Optimistic Update
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
      if (text === undefined) return; // Cancelled
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

    // 2. SHOW LOADING (The req you asked for)
    Swal.fire({
        title: isApprove ? 'Approving...' : 'Rejecting...',
        html: 'Please wait while we update the attendance records.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
      // 3. Call API
      await api.post("/api/attendance/approve-correction", {
        employeeId: reqItem.employeeId,
        date: reqItem.date,
        status: action,
        adminComment: adminComment
      });

      // 4. OPTIMISTIC UPDATE (Fix for "Showing again as pending")
      // Remove it from the list locally immediately so user sees instant result
      setRequests(prevRequests => prevRequests.filter(r => 
          !(r.employeeId === reqItem.employeeId && r.date === reqItem.date)
      ));

      // 5. SHOW SUCCESS CONFIRMATION
      Swal.fire(
        isApprove ? "Approved!" : "Rejected",
        isApprove 
          ? "Attendance record has been updated successfully." 
          : "Request has been rejected.",
        "success"
      );
      
      // 6. Background Sync (Optional, keeps data consistent)
      fetchRequests(); 

    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      Swal.fire("Error", errMsg, "error");
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
               <FaUserClock className="text-orange-600" /> Late Login Requests
            </h2>
            <p className="text-sm text-gray-500 mt-1">
               Employees requesting correction for "Late" login status.
            </p>
        </div>
        <button 
            onClick={() => { setLoading(true); fetchRequests(); }} 
            className="text-sm bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 transition shadow-sm font-medium"
        >
            Refresh List
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative max-w-md">
        <FaSearch className="absolute left-3 top-3 text-gray-400" />
        <input 
            type="text" 
            placeholder="Search by Employee Name or ID..." 
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-200 outline-none transition shadow-sm bg-white"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
        />
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex flex-col justify-center items-center h-64 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-orange-600"></div>
          <p className="mt-4 text-gray-500 font-medium">Fetching requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaCheck className="text-green-500 text-2xl" />
            </div>
            <h3 className="text-lg font-bold text-gray-700">All caught up!</h3>
            <p className="text-gray-400 mt-1">No pending late correction requests found.</p>
        </div>
      ) : (
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
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                     <FaCalendarDay />
                     {new Date(req.date).toLocaleDateString("en-GB")}
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
                                ? new Date(req.currentPunchIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
                                : "--:--"
                            }
                        </p>
                    </div>
                    <div className="text-orange-300 text-xl font-light">➜</div>
                    <div className="text-center">
                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-wider">Change To</p>
                        <p className="text-green-600 font-mono font-bold text-xl bg-green-50 px-2 rounded">
                            {new Date(req.requestedTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
    </div>
  );
};

export default AdminLateRequests;