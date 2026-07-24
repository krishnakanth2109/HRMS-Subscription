// --- START OF FILE PermissionHoursProvider.jsx ---

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PermissionHoursContext } from './PermissionHoursContext';
import { getPermissionRequests, approvePermissionRequestById, rejectPermissionRequestById } from '../api';

export const PermissionHoursProvider = ({ children }) => {
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPermissionRequests();
      setPermissionRequests(data);
    } catch (error) {
      console.error("❌ Permission fetch failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filteredRequests = useMemo(() => {
    return permissionRequests.filter(req => {
      const reqDate = new Date(req.date);
      return reqDate.getMonth() + 1 === selectedMonth && reqDate.getFullYear() === selectedYear;
    });
  }, [permissionRequests, selectedMonth, selectedYear]);

  const approveRequest = useCallback(async (id) => {
    try {
      await approvePermissionRequestById(id);
      fetchRequests(); // Refetch to update UI
    } catch (error) {
      console.error("Failed to approve permission request:", error);
    }
  }, [fetchRequests]);

  const rejectRequest = useCallback(async (id) => {
    try {
      await rejectPermissionRequestById(id);
      fetchRequests(); // Refetch to update UI
    } catch (error) {
      console.error("Failed to reject permission request:", error);
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
    <PermissionHoursContext.Provider value={contextValue}>
      {children}
    </PermissionHoursContext.Provider>
  );
};