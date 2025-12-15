// --- START OF FILE api.js ---

import axios from "axios";

// Automatically determine API base URL depending on environment
const baseURL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT || "http://localhost:5000";

// Debug logs
console.log("🔧 Environment Mode:", import.meta.env.MODE);
console.log("🌐 API Base URL:", baseURL);

// Create a single, consistent Axios instance
const api = axios.create({
  baseURL,
  timeout: 500000, 
  headers: { "Content-Type": "application/json" },
});

/* =============================================================================
   REQUEST INTERCEPTOR → attaches token
============================================================================= */
api.interceptors.request.use(
  (config) => {
    // 1. Try finding standalone token
    let token = sessionStorage.getItem("token") || sessionStorage.getItem("hrms-token");

    // 2. If not found, try finding it inside the user object
    if (!token) {
      const savedUser = sessionStorage.getItem("hrmsUser");
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          // Check common locations: { token: ... } or { data: { token: ... } }
          token = parsed.token || (parsed.data && parsed.data.token);
        } catch (error) {
          console.error("Error parsing hrmsUser for token:", error);
        }
      }
    }

    // 3. Attach token if found
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* =============================================================================
   RESPONSE INTERCEPTOR → BLOCK EMPLOYEE TOAST POPUPS
============================================================================= */
api.interceptors.response.use(
  (response) => {
    // Read logged user
    const rawUser =
      localStorage.getItem("hrmsUser") ||
      sessionStorage.getItem("hrmsUser");

    let user = null;
    try {
      user = rawUser ? JSON.parse(rawUser) : null;
    } catch {}

    const isEmployee = user?.role === "Employee";

    // ❌ Employee should NOT get backend "message" as toast popup
    if (!isEmployee && response?.data?.message) {
      if (window?.toast) {
        window.toast(response.data.message);
      }
    }

    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/* =============================================================================
   AUTH
============================================================================= */
export const loginUser = async (email, password) => {
  try {
    // Return full response so AuthProvider can handle status/headers
    const response = await api.post("/api/auth/login", { email, password });
    return response; 
  } catch (error) {
    console.error("Login failed:", error.response?.data || error.message);
    throw error;
  }
};


/* =============================================================================
   EMPLOYEE MANAGEMENT
============================================================================= */
export const getEmployees = async () => (await api.get("/api/employees")).data;
export const getEmployeeById = async (id) =>
  (await api.get(`/api/employees/${id}`)).data;
export const addEmployee = async (data) =>
  (await api.post("/api/employees", data)).data;
export const updateEmployeeById = async (id, data) =>
  (await api.put(`/api/employees/${id}`, data)).data;
export const deactivateEmployeeById = async (id, data) =>
  (await api.patch(`/api/employees/${id}/deactivate`, data)).data;

// ✅ FIXED: Added 'data' parameter so date/reason are sent to the backend
export const activateEmployeeById = async (id, data) =>
  (await api.patch(`/api/employees/${id}/reactivate`, data)).data;

/* =============================================================================
   IDLE TIME TRACKING
============================================================================= */
export const sendIdleActivity = async (data) => {
  try {
    const response = await api.post("/idletime", data);
    return response.data;
  } catch (error) {
    console.error("Idle time API error:", error.response?.data || error.message);
    throw error;
  }
};

export const getAllIdleTimeRecords = async () => {
  try {
    const res = await api.get("/idletime/all");
    return res.data;
  } catch (error) {
    console.error(
      "Get all idle time error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

/* =============================================================================
   HOLIDAYS
============================================================================= */
export const getHolidays = async () => (await api.get("/api/holidays")).data;
export const addHoliday = async (data) =>
  (await api.post("/api/holidays", data)).data;
export const deleteHolidayById = async (id) =>
  (await api.delete(`/api/holidays/${id}`)).data;

/* =============================================================================
   NOTICES
============================================================================= */
export const getNotices = async () => (await api.get("/api/notices")).data;
export const getAllNoticesForAdmin = async () =>
  (await api.get("/api/notices/all")).data;
export const addNotice = async (data) =>
  (await api.post("/api/notices", data)).data;
export const updateNotice = async (id, data) =>
  (await api.put(`/api/notices/${id}`, data)).data;
export const deleteNoticeById = async (id) =>
  (await api.delete(`/api/notices/${id}`)).data;

export const sendAdminReplyWithImage = async (noticeId, formData) => {
  try {
    const response = await api.post(`/api/notices/${noticeId}/admin-reply`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return response.data;
  } catch (error) {
    console.error("Admin reply with image failed:", error);
    throw error;
  }
};

export const sendReplyWithImage = async (noticeId, formData) => {
  try {
    // Axios usually sets 'Content-Type': 'multipart/form-data' automatically for FormData
    const response = await api.post(`/api/notices/${noticeId}/reply`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return response.data;
  } catch (error) {
    console.error("Reply with image failed:", error);
    throw error;
  }
};

/* =============================================================================
   LEAVES
============================================================================= */
export const getLeaveRequests = async () => (await api.get("/api/leaves")).data;
export const getFilteredLeaveRequests = async (params) =>
  (await api.get("/api/leaves", { params })).data;
export const getLeaveRequestsForEmployee = async (id) =>
  (await api.get(`/api/leaves/${id}`)).data;
export const applyForLeave = async (data) =>
  (await api.post("/api/leaves/apply", data)).data;
export const getLeaveDetailsById = async (id) =>
  (await api.get(`/api/leaves/${id}/details`)).data;
export const approveLeaveRequestById = async (id) =>
  (await api.patch(`/api/leaves/${id}/approve`)).data;
export const rejectLeaveRequestById = async (id) =>
  (await api.patch(`/api/leaves/${id}/reject`)).data;
export const cancelLeaveRequestById = async (id) =>
  (await api.delete(`/api/leaves/cancel/${id}`)).data;

/* =============================================================================
   NOTIFICATIONS
============================================================================= */
export const getNotifications = async () =>
  (await api.get("/api/notifications")).data;
export const addNotificationRequest = async (data) =>
  (await api.post("/api/notifications", data)).data;
export const markNotificationAsRead = async (id) =>
  (await api.patch(`/api/notifications/${id}`, { isRead: true })).data;
export const markAllNotificationsAsRead = async () =>
  (await api.post("/api/notifications/mark-all")).data;

/* =============================================================================
   OVERTIME
============================================================================= */
export const getAllOvertimeRequests = async () =>
  (await api.get("/api/overtime/all")).data;
export const getOvertimeForEmployee = async (id) =>
  (await api.get(`/api/overtime/${id}`)).data;
export const applyForOvertime = async (data) =>
  (await api.post("/api/overtime/apply", data)).data;
export const updateOvertimeStatus = async (id, status) =>
  (await api.put(`/api/overtime/update-status/${id}`, status)).data;
export const cancelOvertime = async (id) => {
  const res = await api.patch(`/api/overtime/cancel/${id}`);
  return res.data;
};
export const deleteOvertime = async (id) =>
  (await api.delete(`/api/overtime/delete/${id}`)).data;

/* =============================================================================
   PERMISSIONS
============================================================================= */
export const getPermissionRequests = async () =>
  (await api.get("/api/permissions")).data;
export const approvePermissionRequestById = async (id) =>
  (await api.patch(`/api/permissions/${id}/approve`)).data;
export const rejectPermissionRequestById = async (id) =>
  (await api.patch(`/api/permissions/${id}/reject`)).data;

/* =============================================================================
   ATTENDANCE
============================================================================= */
export const getAttendanceForEmployee = async (id) =>
  (await api.get(`/api/attendance/${id}`)).data;

export const getAttendanceByDateRange = async (startDate, endDate) =>
  (
    await api.get("/api/admin/attendance/by-range", {
      params: { startDate, endDate },
    })
  ).data;

export const punchIn = async (data) =>
  (await api.post("/api/attendance/punch-in", data)).data;
export const punchOut = async (data) =>
  (await api.post("/api/attendance/punch-out", data)).data;

// ✅ NEW: Added Admin Punch Out function
export const adminPunchOut = async (data) =>
  (await api.post("/api/attendance/admin-punch-out", data)).data;

export const getAllAttendanceRecords = async () => {
  try {
    const response = await api.get("/api/attendance/all");
    return response.data;
  } catch (error) {
    console.error(
      "Get all attendance error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

/* =============================================================================
   USER PROFILE
============================================================================= */
export const getUserProfile = async () =>
  (await api.get("/api/users/profile")).data;
export const updateUserProfile = async (data) =>
  (await api.put("/api/users/profile", data)).data;
export const changeUserPassword = async (data) =>
  (await api.post("/api/users/change-password", data)).data;

/* =============================================================================
   PROFILE PHOTO
============================================================================= */
export const uploadProfilePic = async (formData) => {
  try {
    const response = await api.put("/api/profile/photo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error) {
    console.error(
      "Upload Profile Pic Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export const getProfilePic = async () => {
  try {
    const response = await api.get("/api/profile/me");
    return response.data;
  } catch (error) {
    console.error(
      "Get Profile Pic Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export const deleteProfilePic = async () => {
  try {
    const response = await api.delete("/api/profile/photo");
    return response.data;
  } catch (error) {
    console.error(
      "Delete Profile Pic Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export const getProfilePicByEmployeeId = async (employeeId) => {
  try {
    const response = await api.get(`/api/profile/${employeeId}`);
    return response.data;
  } catch (error) {
    console.error(
      "Get Profile Pic by ID Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export const getAllProfiles = async () => {
  try {
    const response = await api.get("/api/profile/all/profiles");
    return response.data;
  } catch (error) {
    console.error("Get All Profiles Error:", error.message);
    throw error;
  }
};

/* =============================================================================
   SHIFTS
============================================================================= */
export const getAllShifts = async () =>
  (await api.get("/api/shifts/all")).data;

export const getShiftByEmployeeId = async (employeeId) => {
  try {
    const response = await api.get(`/api/shifts/${employeeId}`);
    return response.data.data || response.data;
  } catch (error) {
    console.error("Get shift error:", error.message);
    throw error;
  }
};

export const createOrUpdateShift = async (shiftData) =>
  (await api.post("/api/shifts/create", shiftData)).data;

export const deleteShift = async (employeeId) =>
  (await api.delete(`/api/shifts/${employeeId}`)).data;

export const bulkCreateShifts = async (employeeIds, shiftData, category) =>
  (
    await api.post("/api/shifts/bulk-create", {
      employeeIds,
      shiftData,
      category: category || null,
    })
  ).data;

/* =============================================================================
   SHIFT CATEGORY
============================================================================= */
export const updateEmployeeCategory = async (employeeId, category) => {
  try {
    const response = await api.post("/api/shifts/update-category", {
      employeeId,
      category,
    });
    return response.data;
  } catch (error) {
    console.error("Update employee category error:", error.message);
    throw error;
  }
};

/* =============================================================================
   CATEGORY
============================================================================= */
export const getCategories = async () => {
  try {
    const response = await api.get("/api/categories");
    return response.data;
  } catch (error) {
    console.error("Get categories error:", error.message);
    throw error;
  }
};

export const addCategory = async (id, name) => {
  try {
    const response = await api.post("/api/categories", { id, name });
    return response.data;
  } catch (error) {
    console.error("Add category error:", error.message);
    throw error;
  }
};

export const deleteCategoryApi = async (id) => {
  try {
    const response = await api.delete(`/api/categories/${id}`);
    return response.data;
  } catch (error) {
    console.error("Delete category error:", error.message);
    throw error;
  }
};

export const addMemberToShift = async (category, employee) => {
  try {
    // ✅ FIXED: Added '/api' to the URL
    const res = await fetch(`${baseURL}/api/shifts/add-member`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ category, employee }),
    });

    return await res.json();
  } catch (err) {
    console.error("addMemberToShift error:", err);
    throw err;
  }
};

/* =============================================================================
   ADMIN SETTINGS (WORK MODE)
============================================================================= */

// Get all employees with their work modes
export const getAllEmployeesWithWorkModes = async () => {
  try {
    const response = await api.get("/api/admin/settings/employees-modes");
    return response.data;
  } catch (error) {
    console.error("Get employees with work modes error:", error);
    throw error;
  }
};

// Update specific employee work mode
export const updateEmployeeWorkMode = async (employeeId, mode) => {
  try {
    const response = await api.put("/api/admin/settings/employee-mode", { 
      employeeId, 
      mode 
    });
    return response.data;
  } catch (error) {
    console.error("Update employee work mode error:", error);
    throw error;
  }
};

export default api;