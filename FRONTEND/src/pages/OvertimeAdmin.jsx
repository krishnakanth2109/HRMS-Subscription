import React, { useEffect, useState, useMemo, useCallback } from "react";
import { FaFilter, FaSearch, FaCalendarAlt, FaCheckCircle, FaClock, FaHourglassHalf } from 'react-icons/fa';
// ✅ IMPORT THE CENTRALIZED API FUNCTIONS (NO CHANGE)
import { getAllOvertimeRequests, updateOvertimeStatus } from "../api";

// --- START OF NEW UI COMPONENTS ---

// A reusable card for displaying key metrics
const StatCard = ({ icon, title, value, color }) => (
  <div className="bg-white p-5 shadow-lg rounded-xl flex items-center space-x-4">
    <div className={`text-4xl ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-gray-500 text-sm font-medium">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

// A reusable filter input component
const FilterInput = ({ label, value, onChange, placeholder, children }) => (
    <div className="w-full">
        <label className="text-sm font-semibold text-gray-600 mb-1 block">{label}</label>
        <div className="relative">
            {children}
            <input 
                type="text"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
        </div>
    </div>
);

// --- END OF NEW UI COMPONENTS ---


const OvertimeAdmin = () => {
  const [overtimeList, setOvertimeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  
  // --- START OF NEW STATE FOR FILTERS ---
  const [filters, setFilters] = useState({
    status: 'ALL', // ALL, PENDING, APPROVED, REJECTED
    search: '',
    date: ''
  });
  // --- END OF NEW STATE FOR FILTERS ---


  // ✅ Fetch all Overtime Requests (NO CHANGE)
  const fetchOvertimes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllOvertimeRequests();
      setOvertimeList(data);
    } catch (err) {
      console.error("Error fetching overtime:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOvertimes();
  }, [fetchOvertimes]);

  // ✅ Update OT Status (NO CHANGE)
  const updateStatus = async (id, newStatus) => {
    try {
      setUpdatingId(id);
      await updateOvertimeStatus(id, { status: newStatus });
      setOvertimeList((prev) =>
        prev.map((ot) => (ot._id === id ? { ...ot, status: newStatus } : ot))
      );
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };


  // --- START OF NEW DYNAMIC FILTERING LOGIC ---
  const filteredOvertimeList = useMemo(() => {
    return overtimeList.filter(ot => {
        const matchesStatus = filters.status === 'ALL' || ot.status === filters.status;
        const matchesSearch = filters.search.toLowerCase() === '' || 
                              ot.employeeName.toLowerCase().includes(filters.search.toLowerCase()) ||
                              ot.employeeId.toLowerCase().includes(filters.search.toLowerCase());
        const matchesDate = filters.date === '' || ot.date === filters.date;
        
        return matchesStatus && matchesSearch && matchesDate;
    });
  }, [overtimeList, filters]);
  
  const handleFilterChange = (e) => {
      const { name, value } = e.target;
      setFilters(prev => ({...prev, [name]: value}));
  }
  // --- END OF NEW DYNAMIC FILTERING LOGIC ---


  // --- START OF NEW COUNT CONTAINERS LOGIC ---
  const counts = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      return {
          approved: overtimeList.filter(ot => ot.status === 'APPROVED').length,
          pending: overtimeList.filter(ot => ot.status === 'PENDING').length,
          workingToday: overtimeList.filter(ot => ot.status === 'APPROVED' && ot.date === today).length
      }
  }, [overtimeList]);
  // --- END OF NEW COUNT CONTAINERS LOGIC ---


  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="p-5 text-center text-xl font-semibold text-indigo-800">
            Loading Overtime Requests...
        </div>
    </div>
  );

  return (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-indigo-900 mb-6">Overtime Dashboard</h1>

        {/* --- START OF NEW COUNT CONTAINERS UI --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <StatCard icon={<FaCheckCircle />} title="Approved Overtime" value={counts.approved} color="text-green-500" />
            <StatCard icon={<FaHourglassHalf />} title="Pending Requests" value={counts.pending} color="text-yellow-500" />
            <StatCard icon={<FaClock />} title="Working OT Today" value={counts.workingToday} color="text-blue-500" />
        </div>
        {/* --- END OF NEW COUNT CONTAINERS UI --- */}


        <div className="bg-white shadow-xl rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Manage Requests</h2>

            {/* --- START OF NEW FILTERS UI --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <FilterInput label="Search by Name or ID" value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})} placeholder="e.g., John Doe or 12345">
                    <FaSearch className="absolute top-1/2 left-3 transform -translate-y-1/2 text-gray-400" />
                </FilterInput>

                <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1 block">Filter by Status</label>
                    <div className="relative">
                        <FaFilter className="absolute top-1/2 left-3 transform -translate-y-1/2 text-gray-400" />
                        <select name="status" value={filters.status} onChange={handleFilterChange} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="ALL">All Statuses</option>
                            <option value="PENDING">Pending</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>
                </div>
                
                <FilterInput label="Filter by Date" value={filters.date} onChange={(e) => setFilters({...filters, date: e.target.value})} placeholder="YYYY-MM-DD">
                     <FaCalendarAlt className="absolute top-1/2 left-3 transform -translate-y-1/2 text-gray-400" />
                </FilterInput>
            </div>
            {/* --- END OF NEW FILTERS UI --- */}

            {/* --- TABLE (with enhanced UI) --- */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-indigo-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-indigo-800 uppercase tracking-wider">Employee ID</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-indigo-800 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-indigo-800 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-indigo-800 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-indigo-800 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-indigo-800 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredOvertimeList.length > 0 ? (
                            filteredOvertimeList.map((ot) => (
                                <tr key={ot._id} className="hover:bg-gray-50 transition-colors duration-200">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ot.employeeId}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{ot.employeeName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{ot.date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{ot.type}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${
                                            ot.status === "APPROVED" ? "bg-green-100 text-green-800"
                                            : ot.status === "REJECTED" ? "bg-red-100 text-red-800"
                                            : "bg-yellow-100 text-yellow-800"
                                        }`}>
                                            {ot.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                        <div className="flex gap-2 justify-center">
                                        {ot.status === 'PENDING' ? (
                                            <>
                                                <button
                                                    disabled={updatingId === ot._id}
                                                    onClick={() => updateStatus(ot._id, "APPROVED")}
                                                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    disabled={updatingId === ot._id}
                                                    onClick={() => updateStatus(ot._id, "REJECTED")}
                                                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-gray-400 italic">No actions available</span>
                                        )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="text-center py-10 text-gray-500">
                                    <p className="font-semibold text-lg">No Overtime Requests Found</p>
                                    <p className="text-sm">Try adjusting your filters or check back later.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};

export default OvertimeAdmin;