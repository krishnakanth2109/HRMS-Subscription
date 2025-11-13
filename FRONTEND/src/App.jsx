// --- START OF FILE App.jsx ---

import React from "react";
import { Routes, Route } from "react-router-dom";

// Layouts
import LayoutAdmin from "./components/admin/LayoutAdmin";
import LayoutEmployee from "./components/employee/LayoutEmployee";

// Pages
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import EmployeeManagement from "./pages/EmployeeManagement";
import AddEmployee from "./pages/AddEmployee";
import ReactivateEmployee from "./pages/ReactivateEmployee";
import EditEmployee from "./pages/EditEmployee";
// ✅ Corrected import name for clarity
import AdminViewAttendance from "./pages/AdminviewAttendance"; 
import LeaveManagement from "./pages/LeaveManagement";
import AdminLeaveSummary from "./pages/AdminLeaveSummary";
import AdminProfile from "./pages/AdminProfile";
import EmployeeProfile from "./pages/EmployeeProfile";
import EmployeeLeaveSummary from "./pages/EmployeeLeaveSummary";
import AdminNotifications from "./pages/AdminNotifications";
import EmployeesOnLeaveToday from "./pages/EmployeesOnLeaveToday";
import ForgotPassword from "./pages/ForgotPassword";
import EmployeeAttendanceProfile from "./pages/EmployeeAttendanceProfile";
import AdminNotices from "./pages/AdminNotices.jsx";
import AdminHolidayCalendarPage from "./pages/AdminHolidayCalendarPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import SettingsPage from "./pages/SettingsPage";
import Payroll from "./pages/Payroll";

// New Attendance Features
import OvertimeManagement from "./pages/OvertimeManagement";
import PermissionHoursManagement from "./pages/PermissionHoursManagement";
import { OvertimeProvider } from "./context/OvertimeProvider";
import { PermissionHoursProvider } from "./context/PermissionHoursProvider";

// Providers
import { NoticeProvider } from "./context/NoticeProvider";
import HolidayCalendarProvider from "./context/HolidayCalendarProvider";

// Employee pages
import EmployeeDashboard from "./EmployeePages/EmployeeDashboard";
import CurrentEmployeeAttendanceProfile from "./EmployeePages/CurrentEmployeeAttendanceProfile";
// ✅ Corrected import to match the component file name
import LeaveWithModal from "./EmployeePages/EmployeeLeavemanagement"; 
import CurrentEmployeeHolidayCalendar from "./EmployeePages/CurrentEmployeeHolidayCalendar";
import CurrentEmployeeProfile from "./EmployeePages/CurrentEmployeeProfile";
import CurrentEmployeeNoticeBoard from "./EmployeePages/CurrentEmployeeNoticeBoard";
import OvertimeForm from "./EmployeePages/EmployeeOvertimeForm";
import NewEmployeeAttendance from "./EmployeePages/EmployeeAttendance";

// Admin pages
import OvertimeAdmin from "./pages/OvertimeAdmin";
import AdminLeavePanel from "./pages/AdminLeavemanagmentPanel";

// Route protection
import ProtectedRoute from "./components/ProtectedRoute";
import EmployeeDailyAttendance from "./EmployeePages/EmployeeDailyAttendance";


function App() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Admin protected routes */}
      <Route
        element={
          <ProtectedRoute role="admin">
            <LayoutAdmin />
          </ProtectedRoute>
        }
      >
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/profile" element={<AdminProfile />} />
        <Route path="/employees" element={<EmployeeManagement />} />
        <Route path="/employees/add" element={<AddEmployee />} />
        <Route path="/employees/reactivate/:id" element={<ReactivateEmployee />} />
        <Route path="/employees/edit/:id" element={<EditEmployee />} />
        <Route path="/employee/:id/profile" element={<EmployeeProfile />} />
        <Route path="/attendance" element={<AdminViewAttendance />} />
        <Route
          path="/attendance/overtime"
          element={
            <OvertimeProvider>
              <OvertimeManagement />
            </OvertimeProvider>
          }
        />
        <Route
          path="/attendance/permissions"
          element={
            <PermissionHoursProvider>
              <PermissionHoursManagement />
            </PermissionHoursProvider>
          }
        />
        <Route path="/attendance/profile/:employeeId" element={<EmployeeAttendanceProfile />} />
        <Route path="/leave-management" element={<LeaveManagement />} />
        <Route path="/admin/leave-summary" element={<AdminLeaveSummary />} />
        <Route path="/admin/settings" element={<SettingsPage />} />
        <Route path="/admin/payroll" element={<Payroll />} />
        <Route path="/admin/notifications" element={<AdminNotifications />} />
        <Route path="/admin/on-leave-today" element={<EmployeesOnLeaveToday />} />
        <Route path="/admin/notices" element={<NoticeProvider><AdminNotices /></NoticeProvider>} />
        <Route path="/admin/change-password" element={<ChangePasswordPage />} />
        <Route path="/admin/holiday-calendar" element={<AdminHolidayCalendarPage />} />
        <Route path="/admin/admin-overtime" element={<OvertimeAdmin/>} />
        <Route path="/admin/admin-Leavemanage" element={<AdminLeavePanel/>} />
      </Route>

      {/* Employee protected routes */}
      <Route
        element={
          <ProtectedRoute role="employee">
            <NoticeProvider>
              <LayoutEmployee />
            </NoticeProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
        <Route path="/employee/profile" element={<CurrentEmployeeProfile />} />
        <Route path="/employee/attendance" element={<CurrentEmployeeAttendanceProfile />} />
        {/* ✅ Corrected element to use the imported component */}
        <Route path="/employee/leave-management" element={<LeaveWithModal />} />
        <Route path="/employee/empovertime" element={<OvertimeForm/>} />
        <Route path="/employee/my-attendence" element={<EmployeeDailyAttendance/>} />
        {/* ✅ Renamed this route to match its component name */}
        <Route path="/employee/leave-request" element={<LeaveWithModal />} />  
        <Route path="/employee/new-attendence" element={<NewEmployeeAttendance/>} />     
        <Route path="/employee/holiday-calendar" element={<HolidayCalendarProvider><CurrentEmployeeHolidayCalendar /></HolidayCalendarProvider>} />
        <Route path="/employee/notices" element={<CurrentEmployeeNoticeBoard />} />
        <Route path="/employee/leave-summary" element={<EmployeeLeaveSummary />} />
        <Route path="/employee/change-password" element={<ChangePasswordPage />} />
      </Route>
    </Routes>
  );
}

export default App;