import React, { useState, useEffect } from "react";
import { FaCalendarAlt, FaSearch, FaUser, FaClock, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
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

  const filteredData = attendanceData.filter(item => 
    item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.lateReason && item.lateReason.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.earlyLeaveReason && item.earlyLeaveReason.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FaCheckCircle className="text-indigo-600" />
              Regularisation Requests
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Review late login and early punch-out reasons provided by employees.
            </p>
          </div>
          <Link to="/attendance" className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm">
            Back to Attendance
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search employee, ID, or reason..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
              <FaCalendarAlt className="text-slate-400" />
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-sm text-slate-700 w-32"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <span className="text-slate-400 text-sm">to</span>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
              <FaCalendarAlt className="text-slate-400" />
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-sm text-slate-700 w-32"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold tracking-wider">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Late Login Reason</th>
                  <th className="px-6 py-4">Early Leave Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-400 font-medium">
                      Loading data...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-400 font-medium">
                      No regularisation records found for this period.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-slate-700">{new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            {item.employeeName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800">{item.employeeName}</div>
                            <div className="text-xs font-mono text-slate-500">{item.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {item.lateReason ? (
                          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg inline-flex flex-col gap-1 w-full max-w-xs">
                            <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-amber-600">
                              <FaClock size={10} /> Late In
                            </div>
                            <span className="italic">"{item.lateReason}"</span>
                            <span className="text-xs text-amber-500/70 mt-1 font-mono">In: {item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-sm">--</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {item.earlyLeaveReason ? (
                          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg inline-flex flex-col gap-1 w-full max-w-xs">
                            <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-rose-600">
                              <FaExclamationCircle size={10} /> Early Out
                            </div>
                            <span className="italic">"{item.earlyLeaveReason}"</span>
                            <span className="text-xs text-rose-500/70 mt-1 font-mono">Out: {item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-sm">--</span>
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
