// --- START OF FILE LeaveRequestProvider.jsx ---

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { LeaveRequestContext } from "./LeaveRequestContext";
// ✅ IMPORT THE CENTRALIZED API FUNCTIONS
import { getLeaveRequests, approveLeaveRequestById, rejectLeaveRequestById } from "../api";

// --- Date Utilities ---
const getWeekDates = (baseDate = new Date(), weekOffset = 0) => {
    const today = new Date(baseDate);
    today.setDate(today.getDate() + weekOffset * 7);
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
        start: monday.toISOString().split('T')[0],
        end: sunday.toISOString().split('T')[0],
    };
};

const expandLeaveRange = (from, to) => {
  // ... (this helper function is correct) ...
};

export const LeaveRequestProvider = ({ children }) => {
  // Single source of truth for all leave requests, fetched from the backend
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for UI filters
  const [currentWeek, setCurrentWeek] = useState(0);
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDept, setFilterDept] = useState("All");

  // ✅ FETCH ALL LEAVE REQUESTS FROM THE BACKEND
  const fetchLeaveRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLeaveRequests();
      setLeaveRequests(data);
    } catch (err) {
      console.error("Error fetching leave requests:", err);
      setError("Failed to load leave data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaveRequests();
  }, [fetchLeaveRequests]);

  // ✅ ACTIONS THAT CALL THE API AND THEN REFETCH DATA
  const approveLeave = useCallback(async (id) => {
    try {
      await approveLeaveRequestById(id);
      fetchLeaveRequests();
    } catch (error) {
      console.error("Failed to approve leave:", error);
      alert("Failed to approve leave request.");
    }
  }, [fetchLeaveRequests]);

  const rejectLeave = useCallback(async (id) => {
    try {
      await rejectLeaveRequestById(id);
      fetchLeaveRequests();
    } catch (error) {
      console.error("Failed to reject leave:", error);
      alert("Failed to reject leave request.");
    }
  }, [fetchLeaveRequests]);

  // --- DERIVED DATA AND FILTERING FUNCTIONS (NO API CALLS HERE) ---
  const { allDepartments, allMonths } = useMemo(() => {
    const depts = [...new Set(leaveRequests.map(req => req.department).filter(Boolean))].sort();
    const months = [...new Set(leaveRequests.map(req => req.from.slice(0, 7)))].sort().reverse();
    return { allDepartments: depts, allMonths: months };
  }, [leaveRequests]);

  const getLeaveSummary = useCallback((filters) => {
    // This function now filters the already fetched data
    const { selectedMonth, departmentFilter, statusFilter } = filters;
    let requestsToFilter = selectedMonth === 'All'
      ? leaveRequests
      : leaveRequests.filter(req => req.from.startsWith(selectedMonth));

    const filteredRequests = requestsToFilter.filter(req => 
      (departmentFilter === 'All' || req.department === departmentFilter) &&
      (statusFilter === 'All' || req.status === statusFilter)
    );

    const summaryStats = filteredRequests.reduce((acc, req) => {
      acc[req.status] = (acc[req.status] || 0) + 1;
      return acc;
    }, { Total: filteredRequests.length, Approved: 0, Rejected: 0, Pending: 0 });

    return { summaryStats, filteredRequests };
  }, [leaveRequests]);
  
  const getWeeklyFilteredRequests = useCallback((employeesData) => {
    // This function also filters the already fetched data
    const weekDates = getWeekDates(new Date(), currentWeek);
    const filtered = leaveRequests.filter(req => {
        const emp = employeesData?.find(e => e.employeeId === req.employeeId);
        const dept = emp?.experienceDetails?.find(ex => ex.lastWorkingDate === 'Present')?.department;
        return (filterStatus === 'All' || req.status === filterStatus) &&
               (filterDept === 'All' || dept === filterDept) &&
               (req.name.toLowerCase().includes(searchQuery.toLowerCase()) || req.employeeId.toLowerCase().includes(searchQuery.toLowerCase())) &&
               (req.from <= weekDates.end && req.to >= weekDates.start);
    });
    return { weekDates, filteredRequests: filtered };
  }, [leaveRequests, currentWeek, filterStatus, searchQuery, filterDept]);

  // --- Other helper functions ---
  const isSandwichLeave = useCallback(() => null, []);
  const goToPreviousWeek = useCallback(() => setCurrentWeek(w => w - 1), []);
  const goToNextWeek = useCallback(() => setCurrentWeek(w => w + 1), []);
  const resetToCurrentWeek = useCallback(() => setCurrentWeek(0), []);

  const contextValue = useMemo(() => ({
    leaveRequests, loading, error, approveLeave, rejectLeave, getLeaveSummary,
    allDepartments, allMonths, getWeeklyFilteredRequests, currentWeek,
    goToPreviousWeek, goToNextWeek, resetToCurrentWeek, filterStatus,
    setFilterStatus, searchQuery, setSearchQuery, filterDept, setFilterDept,
    isSandwichLeave
  }), [
    leaveRequests, loading, error, approveLeave, rejectLeave, getLeaveSummary,
    allDepartments, allMonths, getWeeklyFilteredRequests, currentWeek, 
    filterStatus, searchQuery, filterDept, isSandwichLeave
  ]);

  return (
    <LeaveRequestContext.Provider value={contextValue}>
      {children}
    </LeaveRequestContext.Provider>
  );
};