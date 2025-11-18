// --- START OF FILE api.js ---

import axios from "axios";

// Automatically determine API base URL depending on environment
const baseURL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT;

// Debug logs
console.log("🔧 Environment Mode:", import.meta.env.MODE);
console.log("🌐 API Base URL:", baseURL);

// Create a single, consistent Axios instance
const api = axios.create({
  baseURL,
  timeout: 500000,
  headers: { "Content-Type": "application/json" },
});

// Automatically attach token from sessionStorage
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("hrms-token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ============================================================================
   AUTH
============================================================================ */
export const loginUser = async (email, password) => {
  try {
    const response = await api.post("/api/auth/login", { email, password });
    return response.data;
  } catch (error) {
    console.error("Login failed:", error.response?.data || error.message);
    throw error;
  }
};

/* ============================================================================
   EMPLOYEE
============================================================================ */
export const getEmployees = async () => (await api.get("/api/employees")).data;
export const getEmployeeById = async (id) => (await api.get(`/api/employees/${id}`)).data;
export const addEmployee = async (data) => (await api.post("/api/employees", data)).data;
export const updateEmployeeById = async (id, data) => (await api.put(`/api/employees/${id}`, data)).data;
export const deactivateEmployeeById = async (id, data) => (await api.patch(`/api/employees/${id}/deactivate`, data)).data;
export const activateEmployeeById = async (id) => (await api.patch(`/api/employees/${id}/activate`)).data;

/* ============================================================================
   HOLIDAYS
============================================================================ */
export const getHolidays = async () => (await api.get("/api/holidays")).data;
export const addHoliday = async (data) => (await api.post("/api/holidays", data)).data;
export const deleteHolidayById = async (id) => (await api.delete(`/api/holidays/${id}`)).data;

/* ============================================================================
   NOTICES
============================================================================ */
export const getNotices = async () => (await api.get("/api/notices")).data;
export const getAllNoticesForAdmin = async () => (await api.get("/api/notices/all")).data;
export const addNotice = async (data) => (await api.post("/api/notices", data)).data;
export const updateNotice = async (id, data) => (await api.put(`/api/notices/${id}`, data)).data;
export const deleteNoticeById = async (id) => (await api.delete(`/api/notices/${id}`)).data;

/* ============================================================================
   LEAVES
============================================================================ */
export const getLeaveRequests = async () => (await api.get("/api/leaves")).data;
export const getFilteredLeaveRequests = async (params) => (await api.get("/api/leaves", { params })).data;
export const getLeaveRequestsForEmployee = async (id) => (await api.get(`/api/leaves/${id}`)).data;
export const applyForLeave = async (data) => (await api.post("/api/leaves/apply", data)).data;
export const getLeaveDetailsById = async (id) => (await api.get(`/api/leaves/${id}/details`)).data;
export const approveLeaveRequestById = async (id) => (await api.patch(`/api/leaves/${id}/approve`)).data;
export const rejectLeaveRequestById = async (id) => (await api.patch(`/api/leaves/${id}/reject`)).data;
export const cancelLeaveRequestById = async (id) => (await api.delete(`/api/leaves/cancel/${id}`)).data;

/* ============================================================================
   NOTIFICATIONS
============================================================================ */
export const getNotifications = async () => (await api.get("/api/notifications")).data;
export const addNotificationRequest = async (data) => (await api.post("/api/notifications", data)).data;
export const markNotificationAsRead = async (id) => (await api.patch(`/api/notifications/${id}`, { isRead: true })).data;
export const markAllNotificationsAsRead = async () => (await api.patch("/api/notifications/mark-all")).data;

/* ============================================================================
   OVERTIME
============================================================================ */
export const getAllOvertimeRequests = async () => (await api.get("/api/overtime/all")).data;
export const getOvertimeForEmployee = async (id) => (await api.get(`/api/overtime/${id}`)).data;
export const applyForOvertime = async (data) => (await api.post("/api/overtime/apply", data)).data;
export const updateOvertimeStatus = async (id, status) => (await api.put(`/api/overtime/update-status/${id}`, status)).data;

/* ============================================================================
   PERMISSIONS
============================================================================ */
export const getPermissionRequests = async () => (await api.get("/api/permissions")).data;
export const approvePermissionRequestById = async (id) => (await api.patch(`/api/permissions/${id}/approve`)).data;
export const rejectPermissionRequestById = async (id) => (await api.patch(`/api/permissions/${id}/reject`)).data;

/* ============================================================================
   ATTENDANCE
============================================================================ */
export const getAttendanceForEmployee = async (id) => (await api.get(`/api/attendance/${id}`)).data;
export const getAttendanceByDateRange = async (startDate, endDate) =>
  (await api.get("/api/admin/attendance/by-range", { params: { startDate, endDate } })).data;
export const punchIn = async (data) => (await api.post("/api/attendance/punch-in", data)).data;
export const punchOut = async (data) => (await api.post("/api/attendance/punch-out", data)).data;

/* ============================================================================
   USER PROFILE
============================================================================ */
export const getUserProfile = async () => (await api.get("/api/users/profile")).data;
export const updateUserProfile = async (data) => (await api.put("/api/users/profile", data)).data;
export const changeUserPassword = async (data) => (await api.post("/api/users/change-password", data)).data;

/* ============================================================================
   PROFILE PHOTO (Cloudinary Integration)
============================================================================ */
export const uploadProfilePic = async (formData) => {
  try {
    const response = await api.put("/api/profile/photo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error) {
    console.error("Upload Profile Pic Error:", error.response?.data || error.message);
    throw error;
  }
};

export const getProfilePic = async () => {
  try {
    const response = await api.get("/api/profile/me");
    return response.data;
  } catch (error) {
    console.error("Get Profile Pic Error:", error.response?.data || error.message);
    throw error;
  }
};

export const deleteProfilePic = async () => {
  try {
    const response = await api.delete("/api/profile/photo");
    return response.data;
  } catch (error) {
    console.error("Delete Profile Pic Error:", error.response?.data || error.message);
    throw error;
  }
};

export const getProfilePicByEmployeeId = async (employeeId) => {
  try {
    const response = await api.get(`/api/profile/${employeeId}`);
    return response.data;
  } catch (error) {
    console.error("Get Profile Pic by ID Error:", error.response?.data || error.message);
    throw error;
  }
};

export const getAllProfiles = async () => {
  try {
    const response = await api.get("/api/profile/all/profiles");
    return response.data;
  } catch (error) {
    console.error("Get All Profiles Error:", error.response?.data || error.message);
    throw error;
  }
};

/* ============================================================================
   EXPORT
============================================================================ */
export default api;