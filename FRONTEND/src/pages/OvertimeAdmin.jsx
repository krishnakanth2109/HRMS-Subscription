import React, { useEffect, useState, useMemo, useCallback } from "react";
import { FaFilter, FaSearch, FaCalendarAlt, FaCheckCircle, FaClock, FaHourglassHalf } from 'react-icons/fa';
// ✅ IMPORT THE CENTRALIZED API FUNCTIONS (NO CHANGE)
import { getAllOvertimeRequests, updateOvertimeStatus, getEmployees, updateEmployeeOTLimit } from "../api";
import Swal from "sweetalert2";

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

    // OT Limit State
    const [limitModalOpen, setLimitModalOpen] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [savingLimitId, setSavingLimitId] = useState(null);
    const [draftLimits, setDraftLimits] = useState({});

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
        } catch (error) {
            console.error("Error fetching overtime:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchEmployeesForLimits = async () => {
        try {
            const data = await getEmployees();
            setEmployees(data);
            const drafts = {};
            data.forEach(emp => {
                drafts[emp.employeeId] = emp.monthlyOtLimit !== null ? emp.monthlyOtLimit : "";
            });
            setDraftLimits(drafts);
        } catch (error) {
            console.error("Error fetching employees for limits:", error);
        }
    };

    const handleLimitUpdate = async (employeeId) => {
        try {
            setSavingLimitId(employeeId);
            const limit = draftLimits[employeeId];
            const val = limit === "" ? null : Number(limit);
            await updateEmployeeOTLimit(employeeId, val);
            // Update local state
            setEmployees(employees.map(e => e.employeeId === employeeId ? { ...e, monthlyOtLimit: val } : e));
            Swal.fire("Success", "Limit updated successfully!", "success");
        } catch (error) {
            console.error("Failed to update limit", error);
            Swal.fire("Error", "Failed to update limit.", "error");
        } finally {
            setSavingLimitId(null);
        }
    };

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
        setFilters(prev => ({ ...prev, [name]: value }));
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
        <div className=" min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl  mx-auto">
                <h1 className="text-4xl bg-white border border-gray-300 rounded-2xl p-4 font-bold text-indigo-800 dark:text-indigo-400  bg-clip-text mb-6">Overtime Dashboard</h1>

                {/* --- START OF NEW COUNT CONTAINERS UI --- */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <StatCard icon={<FaCheckCircle />} title="Approved Overtime" value={counts.approved} color="text-green-500" />
                    <StatCard icon={<FaHourglassHalf />} title="Pending Requests" value={counts.pending} color="text-yellow-500" />
                    <StatCard icon={<FaClock />} title="Working OT Today" value={counts.workingToday} color="text-blue-500" />
                </div>
                {/* --- END OF NEW COUNT CONTAINERS UI --- */}


                <div className="bg-white shadow-xl rounded-2xl p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800">Manage Requests</h2>
                        <button
                            onClick={() => {
                                fetchEmployeesForLimits();
                                setLimitModalOpen(true);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 mt-4 sm:mt-0 rounded-xl text-sm font-bold shadow-md transition-colors"
                        >
                            Set OT Limits
                        </button>
                    </div>

                    {/* --- START OF NEW FILTERS UI --- */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <FilterInput label="Search by Name or ID" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="e.g., John Doe or 12345">
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

                        <FilterInput label="Filter by Date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} placeholder="YYYY-MM-DD">
                            <FaCalendarAlt className="absolute top-1/2 left-3 transform -translate-y-1/2 text-gray-400" />
                        </FilterInput>
                    </div>
                    {/* --- END OF NEW FILTERS UI --- */}

                    {/* --- TABLE (with enhanced UI) --- */}
                    <div className="space-y-4">
                        {/* Desktop Table */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-indigo-50/50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-indigo-800 uppercase tracking-widest">Employee</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-indigo-800 uppercase tracking-widest">Date</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-indigo-800 uppercase tracking-widest">Requested Time</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-indigo-800 uppercase tracking-widest">Reason</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-indigo-800 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-indigo-800 uppercase tracking-widest">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {filteredOvertimeList.length > 0 ? (
                                        filteredOvertimeList.map((ot) => (
                                            <tr key={ot._id} className="hover:bg-indigo-50/30 transition-colors duration-200">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="font-black text-gray-800 text-sm">{ot.employeeName}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono font-bold tracking-widest uppercase">{ot.employeeId}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-700">
                                                    <div>{ot.date}</div>
                                                    <div className="text-[10px] text-indigo-600 font-bold uppercase">{ot.type}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-black text-gray-800">{ot.hours ? `${ot.hours} hrs` : "-"}</div>
                                                    <div className="text-[10px] text-gray-500 font-bold">{ot.fromTime && ot.toTime ? `${ot.fromTime} - ${ot.toTime}` : ""}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-gray-600 max-w-[200px] truncate" title={ot.reason || ""}>
                                                    {ot.reason || "-"}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <span className={`px-3 py-1 inline-flex text-[10px] font-black uppercase tracking-widest rounded-lg border-2 ${
                                                        ot.status === "APPROVED" ? "bg-green-50 text-green-700 border-green-100"
                                                            : ot.status === "REJECTED" ? "bg-red-50 text-red-700 border-red-100"
                                                                : "bg-yellow-50 text-yellow-700 border-yellow-100"
                                                    }`}>
                                                        {ot.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        {ot.status === 'PENDING' ? (
                                                            <>
                                                                <button
                                                                    disabled={updatingId === ot._id}
                                                                    onClick={() => updateStatus(ot._id, "APPROVED")}
                                                                    className="bg-green-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition active:scale-95 shadow-lg shadow-green-100"
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    disabled={updatingId === ot._id}
                                                                    onClick={() => updateStatus(ot._id, "REJECTED")}
                                                                    className="bg-white text-red-600 border-2 border-red-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition active:scale-95"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">Processed</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="text-center py-20 text-gray-400 font-bold uppercase tracking-widest text-xs">
                                                No Overtime Requests Found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="lg:hidden grid gap-4">
                            {filteredOvertimeList.length > 0 ? (
                                filteredOvertimeList.map((ot) => (
                                    <div key={ot._id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-black text-gray-800 text-sm">{ot.employeeName}</h4>
                                                <p className="text-[10px] text-gray-400 font-mono font-bold tracking-widest">{ot.employeeId}</p>
                                            </div>
                                            <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border ${
                                                ot.status === "APPROVED" ? "bg-green-50 text-green-700 border-green-100"
                                                    : ot.status === "REJECTED" ? "bg-red-50 text-red-700 border-red-100"
                                                        : "bg-yellow-50 text-yellow-700 border-yellow-100"
                                            }`}>
                                                {ot.status}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
                                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Date & Type</p>
                                                <p className="text-xs font-black text-gray-700">{ot.date}</p>
                                                <p className="text-[10px] font-bold text-indigo-600 mt-1">{ot.type}</p>
                                            </div>
                                            <div className="bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
                                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Requested Time</p>
                                                <p className="text-xs font-black text-gray-800">{ot.hours ? `${ot.hours} hrs` : "-"}</p>
                                                <p className="text-[10px] font-bold text-gray-500 mt-1">{ot.fromTime && ot.toTime ? `${ot.fromTime} - ${ot.toTime}` : ""}</p>
                                            </div>
                                        </div>

                                        {ot.reason && (
                                            <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Reason</p>
                                                <p className="text-xs font-bold text-gray-600 italic">"{ot.reason}"</p>
                                            </div>
                                        )}

                                        {ot.status === 'PENDING' && (
                                            <div className="flex gap-3 pt-2">
                                                <button
                                                    disabled={updatingId === ot._id}
                                                    onClick={() => updateStatus(ot._id, "REJECTED")}
                                                    className="flex-1 bg-white text-red-600 border-2 border-red-100 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition active:scale-95"
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    disabled={updatingId === ot._id}
                                                    onClick={() => updateStatus(ot._id, "APPROVED")}
                                                    className="flex-1 bg-green-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition active:scale-95 shadow-lg shadow-green-100"
                                                >
                                                    Approve
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                                    No requests found
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* OT LIMITS MODAL */}
            {limitModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-xl font-bold text-indigo-900">Overtime Request Limits</h3>
                                <p className="text-sm text-gray-500 mt-1">Set the maximum number of times an employee can request OT per month.</p>
                            </div>
                            <button onClick={() => setLimitModalOpen(false)} className="text-gray-400 hover:text-red-500 font-bold text-2xl leading-none">&times;</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50/30">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-white sticky top-0 z-10 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.05)]">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Employee</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Max Requests / Month</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-50">
                                    {employees.map((emp) => (
                                        <tr key={emp._id} className="hover:bg-indigo-50/20 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-bold text-gray-800 text-sm">{emp.name}</div>
                                                <div className="text-[10px] font-black tracking-widest text-gray-400 uppercase mt-0.5">{emp.employeeId}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="w-32 relative">
                                                    <input
                                                        type="number"
                                                        placeholder="Unlimited"
                                                        value={draftLimits[emp.employeeId] !== undefined ? draftLimits[emp.employeeId] : ""}
                                                        onChange={(e) => setDraftLimits({...draftLimits, [emp.employeeId]: e.target.value})}
                                                        className="w-full px-4 py-2 border-2 border-gray-100 rounded-xl text-sm font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 outline-none transition-colors"
                                                        min="0"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <button
                                                    onClick={() => handleLimitUpdate(emp.employeeId)}
                                                    disabled={savingLimitId === emp.employeeId}
                                                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                                        savingLimitId === emp.employeeId 
                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 hover:shadow-lg active:scale-95'
                                                    }`}
                                                >
                                                    {savingLimitId === emp.employeeId ? 'Saving...' : 'Save'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {employees.length === 0 && (
                                        <tr>
                                            <td colSpan="3" className="text-center py-16 text-gray-400 font-bold text-sm">No employees found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-white flex justify-end">
                            <button onClick={() => setLimitModalOpen(false)} className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm rounded-xl transition-colors">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OvertimeAdmin;