import React, { useState, useMemo, useCallback } from 'react';
import { OvertimeContext } from './OvertimeContext';
// Removed unused imports for 'useContext' and 'EmployeeContext'

// --- Mock JSON Data based on your 'overtime' table schema ---
// In a real app, this would come from an API call.
const mockOvertimeRequests = [
  {
    id: 1,
    employeeId: "EMP101",
    name: "John Doe",
    date: "2025-09-15",
    type: "INCENTIVE_OT",
    status: "PENDING",
    requestDate: "2025-09-16T10:00:00Z",
    actionDate: null,
  },
  {
    id: 2,
    employeeId: "EMP102",
    name: "Alice Johnson",
    date: "2025-09-18",
    type: "LEAVE_ADJUSTMENT",
    status: "APPROVED",
    requestDate: "2025-09-18T11:30:00Z",
    actionDate: "2025-09-19T09:00:00Z",
  },
  {
    id: 3,
    employeeId: "EMP104",
    name: "Priya Sharma",
    date: "2025-09-20",
    type: "INCENTIVE_OT",
    status: "REJECTED",
    requestDate: "2025-09-20T14:00:00Z",
    actionDate: "2025-09-21T10:00:00Z",
  },
  {
    id: 4,
    employeeId: "EMP103",
    name: "Michael Smith",
    date: "2025-08-25",
    type: "PENDING_OT",
    status: "PENDING",
    requestDate: "2025-08-26T09:00:00Z",
    actionDate: null,
  },
  {
    id: 5,
    employeeId: "EMP101",
    name: "John Doe",
    date: "2025-08-30",
    type: "LEAVE_ADJUSTMENT",
    status: "APPROVED",
    requestDate: "2025-08-30T17:00:00Z",
    actionDate: "2025-08-31T09:30:00Z",
  },
];

export const OvertimeProvider = ({ children }) => {
  const [overtimeRequests, setOvertimeRequests] = useState(mockOvertimeRequests);
  
  // State for filters, defaults to the current month and year
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Memoize filtered requests for performance.
  // It only recalculates when the source data or filters change.
  const filteredRequests = useMemo(() => {
    return overtimeRequests.filter(req => {
      const reqDate = new Date(req.date);
      return reqDate.getMonth() + 1 === selectedMonth && reqDate.getFullYear() === selectedYear;
    });
  }, [overtimeRequests, selectedMonth, selectedYear]);

  // --- Admin Actions ---

  const approveRequest = useCallback((id) => {
    setOvertimeRequests(prevRequests =>
      prevRequests.map(req =>
        req.id === id
          ? { ...req, status: 'APPROVED', actionDate: new Date().toISOString() }
          : req
      )
    );
  }, []);

  const rejectRequest = useCallback((id) => {
    setOvertimeRequests(prevRequests =>
      prevRequests.map(req =>
        req.id === id
          ? { ...req, status: 'REJECTED', actionDate: new Date().toISOString() }
          : req
      )
    );
  }, []);

  // --- Value provided to consuming components ---
  // FIX: Wrapped the context value in useMemo to prevent unnecessary re-renders in consumer components.
  const contextValue = useMemo(() => ({
    requests: filteredRequests,
    approveRequest,
    rejectRequest,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
  }), [filteredRequests, approveRequest, rejectRequest, selectedMonth, selectedYear]);

  return (
    <OvertimeContext.Provider value={contextValue}>
      {children}
    </OvertimeContext.Provider>
  );
};