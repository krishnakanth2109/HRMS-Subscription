// --- START OF FILE api.js ---

import axios from "axios";

// This logic automatically chooses the correct backend URL.
const baseURL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT;

// Debug logs to confirm the correct URL is being used
console.log("🔧 Environment Mode:", import.meta.env.MODE);
console.log("🌐 API Base URL:", baseURL);

const api = axios.create({
  baseURL: baseURL,
  timeout: 60000,
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

// ✅ ADDED: Leave Request API Calls
// ------------------ Leave API Calls ------------------
export const getLeaveRequests = async () => {
  const response = await api.get("/api/leaves");
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

// ✅ ADDED: Overtime API Calls
// ------------------ Overtime API Calls ------------------
export const getOvertimeRequests = async () => {
  const response = await api.get("/api/overtime");
  return response.data;
};
export const approveOvertimeRequestById = async (id) => {
  const response = await api.patch(`/api/overtime/${id}/approve`);
  return response.data;
};
export const rejectOvertimeRequestById = async (id) => {
  const response = await api.patch(`/api/overtime/${id}/reject`);
  return response.data;
};

// ✅ ADDED: Permission Hours API Calls
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

export default api;