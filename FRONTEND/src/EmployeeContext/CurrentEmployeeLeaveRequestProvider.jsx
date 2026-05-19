import React, { useState, useMemo, useEffect } from "react";
import { CurrentEmployeeLeaveRequestContext } from "./CurrentEmployeeLeaveRequestContext";
import api from "../api";

const getMonthOptions = (requests) => {
  const months = requests.map((req) => (req.from ? req.from.slice(0, 7) : null)).filter(Boolean); // "YYYY-MM"
  const uniqueMonths = Array.from(new Set(months));
  return uniqueMonths.sort();
};

// --- helpers ---
const parseYMD = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
const eachDateInclusive = (fromStr, toStr) => {
  const out = [];
  let d = parseYMD(fromStr);
  const end = parseYMD(toStr);
  while (d <= end) {
    out.push(ymd(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
};

const getStatusOptions = () => ["All", "Pending", "Approved", "Rejected"];
const getLeaveTypeOptions = () => ["Sick Leave", "Casual Leave", "Emergency Leave"];

const CurrentEmployeeLeaveRequestProvider = ({ children }) => {
  const loggedUser = useMemo(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("hrmsUser") || sessionStorage.getItem("hrmsUser") || "null"
      );
    } catch {
      return null;
    }
  }, []);
  const employeeId = loggedUser?.employeeId;

  // --- aggregated leaveRequests (keep this as-is; do not change the shape) ---
  const [leaveRequests, setLeaveRequests] = useState([
    {
      id: 1,
      employeeId: "EMP101",
      name: "John Doe",
      from: "2025-07-10",
      to: "2025-07-15",
      reason: "Vacation",
      requestDate: "2025-07-08",
      status: "Approved",
      leaveDayType: "Full Day",
      halfDaySession: null,
      leaveType: "CASUAL",
      actionDate: "2025-07-09",
      leavecategory: "Paid",
      approvedBy: "Manager1",
    },
    {
      id: 2,
      employeeId: "EMP101",
      name: "John Doe",
      from: "2025-07-20",
      to: "2025-07-22",
      reason: "Medical Leave",
      requestDate: "2025-07-18",
      status: "Pending",
      leaveDayType: "Full Day",
      leaveType: "SICK",
      halfDaySession: null,
      actionDate: null,
      leavecategory: "UnPaid",
      approvedBy: null,
    },
    // ...rest of your aggregated dummy data (unchanged)...
  ]);

  // --- NEW: per-day dummy details (used only as fallback when fetching "show more" details fails)
  // Each entry references parentId (the aggregated leave id).
  // DO NOT modify the above aggregated dummy; this is a separate dataset.
  const leaveDetailsDummy = [
    // entries for aggregated leave id 1 (2025-07-10 -> 2025-07-15)
    { id: 101, parentId: 1, date: "2025-07-10", leavecategory: "Paid", leaveType: "CASUAL", leaveDayType: "Full Day" },
    { id: 102, parentId: 1, date: "2025-07-11", leavecategory: "UnPaid", leaveType: "CASUAL", leaveDayType: "Full Day" },
    { id: 103, parentId: 1, date: "2025-07-12", leavecategory: "UnPaid", leaveType: "CASUAL", leaveDayType: "Full Day" },
    { id: 104, parentId: 1, date: "2025-07-13", leavecategory: "UnPaid", leaveType: "CASUAL", leaveDayType: "Full Day" },
    { id: 105, parentId: 1, date: "2025-07-14", leavecategory: "UnPaid", leaveType: "CASUAL", leaveDayType: "Full Day" },
    { id: 106, parentId: 1, date: "2025-07-15", leavecategory: "UnPaid", leaveType: "CASUAL", leaveDayType: "Full Day" },

    // entries for aggregated leave id 2 (2025-07-20 -> 2025-07-22)
    { id: 201, parentId: 2, date: "2025-07-20", leavecategory: "UnPaid", leaveType: "SICK", leaveDayType: "Full Day" },
    { id: 202, parentId: 2, date: "2025-07-21", leavecategory: "UnPaid", leaveType: "SICK", leaveDayType: "Full Day" },
    { id: 203, parentId: 2, date: "2025-07-22", leavecategory: "UnPaid", leaveType: "SICK", leaveDayType: "Full Day" },

    // (You can add additional per-day dummy entries here for other aggregated leaves.)
  ];

  // ✅ fetch aggregated leaves on mount (unchanged behavior)
  useEffect(() => {
    if (!employeeId) return;

    const fetchLeaves = async () => {
      try {
        const { data } = await api.get(`/api/leaves/${employeeId}`);
        setLeaveRequests(data); // backend aggregated data replaces dummy aggregated data
      } catch (error) {
        console.error("Backend not available, using aggregated dummy data", error);
        // keep aggregated dummy data (leaveRequests) as fallback
      }
    };

    fetchLeaves();
  }, [employeeId]);

  const monthOptions = useMemo(() => getMonthOptions(leaveRequests), [leaveRequests]);
  const statusOptions = useMemo(() => getStatusOptions(), []);
  const leaveTypeOptions = useMemo(() => ["All", ...getLeaveTypeOptions()], []);
  const [selectedLeaveType, setSelectedLeaveType] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[monthOptions.length - 1] || "");
  const [selectedStatus, setSelectedStatus] = useState("All");

  const filteredRequests = useMemo(
    () =>
      leaveRequests.filter((req) => {
        const matchMonth = selectedMonth ? req.from && req.from.startsWith(selectedMonth) : true;
        const matchStatus = selectedStatus === "All" ? true : req.status === selectedStatus;
        const matchLeaveType = selectedLeaveType === "All" ? true : req.leaveType === selectedLeaveType;
        return matchMonth && matchStatus && matchLeaveType;
      }),
    [leaveRequests, selectedMonth, selectedStatus, selectedLeaveType]
  );

  // --- UPDATED applyLeave: add aggregated leave only, remove Paid/UnPaid assignment logic
  // inside CurrentEmployeeLeaveRequestProvider.jsx
const applyLeave = async ({ from, to, reason, leaveType, halfDaySession, leaveDayType }) => {
  const days = eachDateInclusive(from, to);
  const leaveDays = days.length === 1 && leaveDayType === "Half Day" ? 0.5 : days.length;

  let nextId = leaveRequests.length + 1;

  const newAggregatedLeave = {
    id: nextId,
    employeeId: "EMP101",
    name: "John Doe",
    from,
    to,
    reason,
    requestDate: new Date().toISOString().slice(0, 10),
    status: "Pending",
    leaveDayType: leaveDayType || "Full Day",
    halfDaySession: leaveDayType === "Half Day" ? halfDaySession : null,
    leaveType,
    actionDate: null,
    approvedBy: null,
    leavecategory: null,
    leaveDays, // <-- now includes 0.5 for half-day
  };

  try {
    const { data: saved } = await api.post("/api/leaves/apply", newAggregatedLeave);
    setLeaveRequests((prev) => [...prev, saved]);
  } catch (err) {
    console.error("Backend save failed; adding aggregated leave locally", err);
    setLeaveRequests((prev) => [...prev, newAggregatedLeave]);
  }
};



  // --- NEW: fetch per-day details for a leave (tries backend, falls back to leaveDetailsDummy)
  const fetchLeaveDetails = async (leaveId) => {
    try {
      // try backend endpoint (adjust path to your API)
      const { data } = await api.get(`/api/leaves/${leaveId}/details`);
      // Expecting data to be an array of per-day objects like [{date: "2025-07-10", leavecategory: "Paid"}, ...]
      return data;
    } catch (err) {
      console.warn(`Failed to fetch details for leaveId ${leaveId}, using dummy`, err);
      // fallback to per-day dummy entries for this parentId
      return leaveDetailsDummy
        .filter((d) => d.parentId === leaveId)
        .map(({ id, date, leavecategory, leaveType, leaveDayType }) => ({
          id,
          date,
          leavecategory,
          leaveType,
          leaveDayType,
        }));
    }
  };

  const [sandwichLeaves] = useState([
    { date: "2025-09-11", from: "2025-09-10", to: "2025-09-12" },
    { date: "2025-09-25", from: "2025-09-24", to: "2025-09-26" },
  ]);

  return (
    <CurrentEmployeeLeaveRequestContext.Provider
      value={{
        leaveRequests,
        setLeaveRequests,
        monthOptions,
        selectedMonth,
        setSelectedMonth,
        statusOptions,
        selectedStatus,
        setSelectedStatus,
        filteredRequests,
        applyLeave,
        sandwichLeaves,
        leaveTypeOptions,
        selectedLeaveType,
        setSelectedLeaveType,
        // NEW export:
        fetchLeaveDetails,
      }}
    >
      {children}
    </CurrentEmployeeLeaveRequestContext.Provider>
  );
};

export default CurrentEmployeeLeaveRequestProvider;
