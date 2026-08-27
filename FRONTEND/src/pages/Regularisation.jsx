import React, { useState, useEffect } from "react";
import { FaCalendarAlt, FaSearch, FaUser, FaClock, FaCheckCircle, FaExclamationCircle, FaArrowLeft, FaInbox } from "react-icons/fa";
import { getRegularisationRequests } from "../api";
import { Link } from "react-router-dom";

const Regularisation = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Default to current month
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getRegularisationRequests(startDate, endDate);
      setAttendanceData(data);
    } catch (error) {
      console.error("Failed to fetch attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const filteredData = attendanceData.filter(item => {
    // Only show employees that have actual regularization requests
    const hasRequest = Boolean(item.lateReason || item.earlyLeaveReason);
    if (!hasRequest) return false;

    // Apply search filter
    return (
      item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.lateReason && item.lateReason.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.earlyLeaveReason && item.earlyLeaveReason.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  return (
    <div className="p-6 md:p-10 bg-slate-50 min-h-screen font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-800 flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-2xl shadow-inner">
                <FaCheckCircle className="text-indigo-600 text-2xl" />
              </div>
              Regularisation Requests
            </h1>
            <p className="text-slate-500 font-medium text-sm md:text-base ml-2">
              Review late login and early punch-out justifications provided by your team.
            </p>
          </div>
          <Link 
            to="/attendance" 
            className="group flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200/80 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-indigo-200 transition-all duration-300 shadow-sm hover:shadow-md font-semibold text-sm"
          >
            <FaArrowLeft className="text-slate-400 group-hover:text-indigo-500 group-hover:-translate-x-1 transition-all" />
            Back to Attendance
          </Link>
        </div>

        {/* Filters Section */}
        <div className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl shadow-sm border border-white/40 ring-1 ring-slate-100 flex flex-col lg:flex-row gap-5 items-center justify-between">
          <div className="relative w-full lg:max-w-md group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
              <FaSearch size={16} />
            </div>
            <input 
              type="text" 
              placeholder="Search by name, ID, or reason..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 focus:bg-white transition-all text-sm font-medium text-slate-700 placeholder-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-slate-50/80 border border-slate-200 rounded-xl px-4 py-2.5 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-400 focus-within:bg-white transition-all w-full sm:w-auto">
              <FaCalendarAlt className="text-indigo-400/80" />
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-sm font-semibold text-slate-700 w-full sm:w-32 cursor-pointer"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <span className="text-slate-400 font-bold text-xs uppercase tracking-widest hidden sm:block">to</span>
            <div className="flex items-center gap-2 bg-slate-50/80 border border-slate-200 rounded-xl px-4 py-2.5 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-400 focus-within:bg-white transition-all w-full sm:w-auto">
              <FaCalendarAlt className="text-indigo-400/80" />
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-sm font-semibold text-slate-700 w-full sm:w-32 cursor-pointer"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Data Grid Section */}
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden relative">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-extrabold uppercase tracking-widest text-slate-400">
                  <th className="px-5 py-4 whitespace-nowrap">Date</th>
                  <th className="px-5 py-4 whitespace-nowrap">Employee Info</th>
                  <th className="px-5 py-4">Late Login Reason</th>
                  <th className="px-5 py-4">Early Leave Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50/50">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse bg-white">
                      <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-slate-100"></div>
                          <div className="space-y-2"><div className="h-3 bg-slate-100 rounded w-32"></div><div className="h-2 bg-slate-50 rounded w-20"></div></div>
                        </div>
                      </td>
                      <td className="px-5 py-4"><div className="h-16 bg-slate-50 rounded-xl w-full max-w-xs"></div></td>
                      <td className="px-5 py-4"><div className="h-16 bg-slate-50 rounded-xl w-full max-w-xs"></div></td>
                    </tr>
                  ))
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center shadow-inner">
                          <FaInbox className="text-3xl text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">No records found</h3>
                        <p className="text-sm font-medium text-slate-400 max-w-sm mx-auto">
                          There are no regularisation requests matching your current filters or date range.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-indigo-50/30 transition-all duration-300 group">
                      
                      {/* Date Column */}
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-700 font-medium border-b border-slate-100">
                        {new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>

                      {/* Employee Info Column */}
                      <td className="px-5 py-3 whitespace-nowrap border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                            {item.employeeName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-800">
                              {item.employeeName}
                            </span>
                            <span className="text-xs text-slate-500">
                              {item.employeeId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Late Login Reason Column */}
                      <td className="px-5 py-3 border-b border-slate-100">
                        {item.lateReason ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-amber-600 mb-0.5">
                              LATE IN: {item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                            </span>
                            <span className="text-sm text-slate-600">"{item.lateReason}"</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">--</span>
                        )}
                      </td>

                      {/* Early Leave Reason Column */}
                      <td className="px-5 py-3 border-b border-slate-100">
                        {item.earlyLeaveReason ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-rose-600 mb-0.5">
                              EARLY OUT: {item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                            </span>
                            <span className="text-sm text-slate-600">"{item.earlyLeaveReason}"</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">--</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Regularisation;
