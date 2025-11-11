// --- START OF FILE OvertimeProvider.jsx ---

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { OvertimeContext } from './OvertimeContext';
import { getOvertimeRequests, approveOvertimeRequestById, rejectOvertimeRequestById } from '../api';

export const OvertimeProvider = ({ children }) => {
  const [overtimeRequests, setOvertimeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getOvertimeRequests();
      setOvertimeRequests(data);
    } catch (error) {
      console.error("❌ Overtime fetch failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filteredRequests = useMemo(() => {
    return overtimeRequests.filter(req => {
      const reqDate = new Date(req.date);
      return reqDate.getMonth() + 1 === selectedMonth && reqDate.getFullYear() === selectedYear;
    });
  }, [overtimeRequests, selectedMonth, selectedYear]);

  const approveRequest = useCallback(async (id) => {
    try {
      await approveOvertimeRequestById(id);
      fetchRequests(); // Refetch data to update the UI
    } catch (error) {
      console.error("Failed to approve overtime request:", error);
    }
  }, [fetchRequests]);

  const rejectRequest = useCallback(async (id) => {
    try {
      await rejectOvertimeRequestById(id);
      fetchRequests(); // Refetch data to update the UI
    } catch (error) {
      console.error("Failed to reject overtime request:", error);
    }
  }, [fetchRequests]);

  const contextValue = useMemo(() => ({
    requests: filteredRequests,
    loading,
    approveRequest,
    rejectRequest,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
  }), [filteredRequests, loading, approveRequest, rejectRequest, selectedMonth, selectedYear]);

  return (
    <OvertimeContext.Provider value={contextValue}>
      {children}
    </OvertimeContext.Provider>
  );
};