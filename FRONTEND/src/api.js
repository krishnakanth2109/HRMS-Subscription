// --- START OF FILE api.js ---

import axios from "axios";

// This logic automatically chooses the correct backend URL based on the environment.
const baseURL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT;

// Debug logs to confirm the correct URL is being used during development
console.log("🔧 Environment Mode:", import.meta.env.MODE);
console.log("🌐 API Base URL:", baseURL);

// Create a centralized Axios instance that will be used for all API calls.
const api = axios.create({
  baseURL: baseURL,
  timeout: 60000, // Increased timeout for potentially slower server responses
  headers: { 'Content-Type': 'application/json' }
});

/**
 * =============================================================================
 * API Service Functions
 * =============================================================================
 */

// ------------------ Auth API Calls ------------------
export const loginUser = async (email, password) => {
  try {
    const response = await api.post("/api/auth/login", { email, password });
    return response.data;
  } catch (error) {
    console.error("Login failed:", error.response?.data || error.message);
    throw error;
  }
};

// ------------------ Employee API Calls ------------------
export const getEmployees = async () => {
  const response = await api.get("/api/employees");
  return response.data;
};

export const getEmployeeById = async (id) => {
  const response = await api.get(`/api/employees/${id}`);
  return response.data;
};

export const addEmployee = async (employeeData) => {
  const response = await api.post("/api/employees", employeeData);
  return response.data;
};

export const updateEmployeeById = async (id, employeeData) => {
  const response = await api.put(`/api/employees/${id}`, employeeData);
  return response.data;
};

export const deactivateEmployeeById = async (id, data) => {
  const response = await api.patch(`/api/employees/${id}/deactivate`, data);
  return response.data;
};

export const activateEmployeeById = async (id) => {
  const response = await api.patch(`/api/employees/${id}/activate`);
  return response.data;
};

// ------------------ Holiday API Calls ------------------
export const getHolidays = async () => {
  const response = await api.get("/api/holidays");
  return response.data;
};

export const addHoliday = async (holidayData) => {
  const response = await api.post("/api/holidays", holidayData);
  return response.data;
};

export const deleteHolidayById = async (id) => {
  const response = await api.delete(`/api/holidays/${id}`);
  return response.data;
};

// ------------------ Notice API Calls ------------------
export const getNotices = async () => {
  const response = await api.get("/api/notices");
  return response.data;
};

export const addNotice = async (noticeData) => {
  const response = await api.post("/api/notices", noticeData);
  return response.data;
};

// ------------------ Leave Request API Calls ------------------
export const getLeaveRequests = async () => {
  const response = await api.get("/api/leaves");
  return response.data;
};

export const getFilteredLeaveRequests = async (params) => {
  const response = await api.get("/api/leaves", { params });
  return response.data;
};

export const getLeaveRequestsForEmployee = async (employeeId) => {
  const response = await api.get(`/api/leaves/${employeeId}`);
  return response.data;
};

export const applyForLeave = async (leaveData) => {
  const response = await api.post("/api/leaves/apply", leaveData);
  return response.data;
};

export const getLeaveDetailsById = async (leaveId) => {
    const response = await api.get(`/api/leaves/${leaveId}/details`);
    return response.data;
};

export const approveLeaveRequestById = async (id) => {
  const response = await api.patch(`/api/leaves/${id}/approve`);
  return response.data;
};

export const rejectLeaveRequestById = async (id) => {
  const response = await api.patch(`/api/leaves/${id}/reject`);
  return response.data;
};

// ------------------ Overtime API Calls ------------------
export const getAllOvertimeRequests = async () => {
  const response = await api.get("/api/overtime/all");
  return response.data;
};

export const getOvertimeForEmployee = async (employeeId) => {
  const response = await api.get(`/api/overtime/${employeeId}`);
  return response.data;
};

export const applyForOvertime = async (overtimeData) => {
  const response = await api.post("/api/overtime/apply", overtimeData);
  return response.data;
};

export const updateOvertimeStatus = async (id, statusData) => {
  const response = await api.put(`/api/overtime/update-status/${id}`, statusData);
  return response.data;
};

// ------------------ Permission Hours API Calls ------------------
export const getPermissionRequests = async () => {
  const response = await api.get("/api/permissions");
  return response.data;
};

export const approvePermissionRequestById = async (id) => {
  const response = await api.patch(`/api/permissions/${id}/approve`);
  return response.data;
};

export const rejectPermissionRequestById = async (id) => {
  const response = await api.patch(`/api/permissions/${id}/reject`);
  return response.data;
};

// ------------------ Attendance API Calls ------------------
export const getAttendanceForEmployee = async (employeeId) => {
  const response = await api.get(`/api/attendance/${employeeId}`);
  return response.data;
};

export const punchIn = async (punchData) => {
  const response = await api.post("/api/attendance/punch-in", punchData);
  return response.data;
};

export const punchOut = async (punchData) => {
  const response = await api.post("/api/attendance/punch-out", punchData);
  return response.data;
};

// We export the configured axios instance as a default export in case it's needed for special cases,
// but it's best practice to use the named function exports above.
export default api;