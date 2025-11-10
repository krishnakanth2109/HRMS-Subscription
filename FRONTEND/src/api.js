// --- START OF FILE api.js ---

import axios from "axios";

// Determine the base URL based on the environment
const baseURL =
  process.env.NODE_ENV === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT;

// Create an Axios instance with the base URL
const api = axios.create({
  baseURL: baseURL,
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

// ------------------ Employee API Calls ------------------
export const getEmployeeById = async (id) => {
  const response = await api.get(`/employees/${id}`);
  return response.data;
};

export const updateEmployeeById = async (id, employeeData) => {
  const response = await api.put(`/employees/${id}`, employeeData);
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


export default api;