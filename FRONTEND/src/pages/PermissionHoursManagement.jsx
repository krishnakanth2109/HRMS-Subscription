import React, { useContext } from 'react';
import { PermissionHoursContext } from '../context/PermissionHoursContext';

// Helper for generating year options
const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear + 1; i >= currentYear - 5; i--) {
    years.push(i);
  }
  return years;
};

const PermissionHoursManagement = () => {
  const { 
    requests, 
    approveRequest, 
    rejectRequest, 
    selectedMonth, 
    setSelectedMonth, 
    selectedYear, 
    setSelectedYear 
  } = useContext(PermissionHoursContext);

  const statusBadge = (status) => {
    const baseClasses = 'px-3 py-1 rounded-full text-xs font-semibold';
    switch (status) {
      case 'APPROVED':
        return <span className={`${baseClasses} bg-green-100 text-green-700`}>Approved</span>;
      case 'PENDING':
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-700`}>Pending</span>;
      case 'REJECTED':
        return <span className={`${baseClasses} bg-red-100 text-red-700`}>Rejected</span>;
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-700`}>{status}</span>;
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Permission Hours Management</h2>

      {/* --- Filter Controls --- */}
      <div className="mb-6 flex items-center gap-4 bg-white p-4 rounded-lg shadow">
        <div>
          <label htmlFor="month-filter" className="block text-sm font-medium text-gray-600 mb-1">Month</label>
          <select
            id="month-filter"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="year-filter" className="block text-sm font-medium text-gray-600 mb-1">Year</label>
          <select
            id="year-filter"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            {generateYearOptions().map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* --- Permission Requests Table --- */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-4 text-left text-sm font-semibold text-gray-600">Employee</th>
              <th className="p-4 text-left text-sm font-semibold text-gray-600">Date & Time</th>
              <th className="p-4 text-left text-sm font-semibold text-gray-600">Reason</th>
              <th className="p-4 text-left text-sm font-semibold text-gray-600">Requested On</th>
              <th className="p-4 text-left text-sm font-semibold text-gray-600">Status</th>
              <th className="p-4 text-left text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length > 0 ? (
              requests.map((req) => (
                <tr key={req.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="p-4 align-top">
                    <div className="font-medium text-gray-800">{req.name}</div>
                    <div className="text-xs text-gray-500">{req.employeeId}</div>
                  </td>
                  <td className="p-4 text-sm text-gray-700 align-top">
                    <div>{req.date}</div>
                    <div className="text-xs text-gray-500">{req.fromTime} - {req.toTime}</div>
                  </td>
                  <td className="p-4 text-sm text-gray-700 max-w-xs align-top">{req.reason}</td>
                  <td className="p-4 text-sm text-gray-700 align-top">{new Date(req.requestDate).toLocaleString()}</td>
                  <td className="p-4 align-top">{statusBadge(req.status)}</td>
                  <td className="p-4 align-top">
                    {req.status === 'PENDING' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => approveRequest(req.id)}
                          className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-md hover:bg-green-600 transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectRequest(req.id)}
                          className="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded-md hover:bg-red-600 transition"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                       <span className="text-xs text-gray-500">
                         Action taken on {new Date(req.actionDate).toLocaleDateString()}
                       </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="p-4 text-center text-gray-500">
                  No permission requests found for the selected period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PermissionHoursManagement;