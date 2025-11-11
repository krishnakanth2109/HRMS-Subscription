// --- START OF FILE LeaveRequestProvider.jsx ---

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { LeaveRequestContext } from "./LeaveRequestContext";
import { getLeaveRequests, approveLeaveRequestById, rejectLeaveRequestById } from "../api";

// --- Date Utilities ---
const getWeekDates = (baseDate = new Date(), weekOffset = 0) => {
  const today = new Date(baseDate);
  today.setDate(today.getDate() + weekOffset * 7);
  const currentDay = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - currentDay + (currentDay === 0 ? -6 : 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
};

export const LeaveRequestProvider = ({ children }) => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentWeek, setCurrentWeek] = useState(0);
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDept, setFilterDept] = useState("All");

  // Fetch all leave requests from the backend
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

  // --- Actions that call the API and then refetch data ---
  const approveLeave = useCallback(async (id) => {
    try {
      await approveLeaveRequestById(id);
      fetchLeaveRequests();
    } catch (error) {
      console.error("Failed to approve leave:", error);
    }
  }, [fetchLeaveRequests]);

  const rejectLeave = useCallback(async (id) => {
    try {
      await rejectLeaveRequestById(id);
      fetchLeaveRequests();
    } catch (error) {
      console.error("Failed to reject leave:", error);
    }
  }, [fetchLeaveRequests]);
  
  // --- Memoized functions for filtering and summarizing the single source of truth ---
  const { allDepartments, allMonths } = useMemo(() => {
    const depts = [...new Set(leaveRequests.map(req => req.department))].sort();
    const months = [...new Set(leaveRequests.map(req => req.from.slice(0, 7)))].sort().reverse();
    return { allDepartments: depts, allMonths: months };
  }, [leaveRequests]);

  const getLeaveSummary = useCallback((filters) => {
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


  // Other helper functions
  const isSandwichLeave = useCallback(() => null, []);
  const goToPreviousWeek = useCallback(() => setCurrentWeek(w => w - 1), []);
  const goToNextWeek = useCallback(() => setCurrentWeek(w => w + 1), []);
  const resetToCurrentWeek = useCallback(() => setCurrentWeek(0), []);

  const contextValue = useMemo(() => ({
    leaveRequests,
    loading,
    error,
    approveLeave,
    rejectLeave,
    getLeaveSummary,
    allDepartments,
    allMonths,
    getWeeklyFilteredRequests,
    currentWeek,
    goToPreviousWeek,
    goToNextWeek,
    resetToCurrentWeek,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    filterDept,
    setFilterDept,
    isSandwichLeave,
  }), [
    leaveRequests, loading, error, approveLeave, rejectLeave, getLeaveSummary, allDepartments, allMonths,
    getWeeklyFilteredRequests, currentWeek, goToPreviousWeek, goToNextWeek, resetToCurrentWeek,
    filterStatus, searchQuery, filterDept, isSandwichLeave
  ]);

  return (
    <LeaveRequestContext.Provider value={contextValue}>
      {children}
    </LeaveRequestContext.Provider>
  );
};