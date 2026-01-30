// --- START OF FILE App.jsx ---

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom"; // ✅ Added Navigate

// Layouts
import LayoutAdmin from "./components/admin/LayoutAdmin";
import LayoutEmployee from "./components/employee/LayoutEmployee";

// Master Imports
import MasterLogin from "./pages/master/MasterLogin";
import LayoutMaster from "./components/master/LayoutMaster";
import MasterDashboard from "./pages/master/MasterDashboard";
import MasterAdminUsers from "./pages/master/MasterAdminUsers";
import MasterSettings from "./pages/master/MasterSettings";

// Pages
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import EmployeeManagement from "./pages/EmployeeManagement";
import AddEmployee from "./pages/AddEmployee";
import ReactivateEmployee from "./pages/ReactivateEmployee";
import EditEmployee from "./pages/EditEmployee";
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
import SubsHome from "./SubscriptionPages/SubsHome"

// Attendance Features
import OvertimeManagement from "./pages/OvertimeManagement";
import PermissionHoursManagement from "./pages/PermissionHoursManagement";
import { OvertimeProvider } from "./context/OvertimeProvider";
import { PermissionHoursProvider } from "./context/PermissionHoursProvider";

// Providers
import { NoticeProvider } from "./context/NoticeProvider";
import HolidayCalendarProvider from "./context/HolidayCalendarProvider";
import CurrentEmployeeNotificationProvider from "./EmployeeContext/CurrentEmployeeNotificationProvider";
import { EmployeeProvider } from "./context/EmployeeProvider";

// Employee pages
import EmployeeDashboard from "./EmployeePages/EmployeeDashboard";
import CurrentEmployeeAttendanceProfile from "./EmployeePages/CurrentEmployeeAttendanceProfile";
import LeaveWithModal from "./EmployeePages/EmployeeLeavemanagement";
import CurrentEmployeeHolidayCalendar from "./EmployeePages/CurrentEmployeeHolidayCalendar";
import CurrentEmployeeProfile from "./EmployeePages/CurrentEmployeeProfile";
import CurrentEmployeeNoticeBoard from "./EmployeePages/CurrentEmployeeNoticeBoard";
import OvertimeForm from "./EmployeePages/EmployeeOvertimeForm";
import NewEmployeeAttendance from "./EmployeePages/EmployeeAttendance";
import EmployeeDailyAttendance from "./EmployeePages/EmployeeDailyAttendance";
import EmployeeNotifications from "./pages/EmployeeNotifications";
import EmployeeTeamsPage from "./EmployeePages/EmployeeTeamsPage";


// Admin pages
import OvertimeAdmin from "./pages/OvertimeAdmin";
import AdminLeavePanel from "./pages/AdminLeavemanagmentPanel";
import AdminGroupPage from "./pages/AdminGroupPage";


// Route protection
import ProtectedRoute from "./components/ProtectedRoute";

import AdminLocationSettings from "./components/AdminLocationSettings";
import EmployeeWorkModeRequest from "./EmployeePages/EmployeeWorkModeRequest";
import RequestPunchOut from "./EmployeePages/RequestPunchOut";
import AdminLateRequests from "./pages/AdminLateRequests";
import MeetingGenerator from "./pages/meeting";
import TodayOverview from "./pages/TodayOverview";
import EmployeeViewRules from "./EmployeePages/EmployeeViewRules";
import AdminRulesPost from "./pages/AdminRulespost";
import PaymentSuccess from "./SubscriptionPages/PaymentSuccess";

// ----------------------------------------------------------------------
// ✅ 1. NEW COMPONENT: Redirects logged-in users away from Public Pages
// ----------------------------------------------------------------------
const PublicRoute = ({ children }) => {
  // 1. Check Master Login
  const masterToken = sessionStorage.getItem("masterToken");
  if (masterToken) {
    return <Navigate to="/master/dashboard" replace />;
  }

  // 2. Check Regular User (Admin/Employee)
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  const userStr = localStorage.getItem("hrmsUser") || sessionStorage.getItem("hrmsUser");

  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      // Normalized role check
      const role = user.role ? user.role.toLowerCase() : "";

      if (role === "admin") {
        return <Navigate to="/admin/dashboard" replace />;
      }
      if (role === "employee") {
        return <Navigate to="/employee/dashboard" replace />;
      }
    } catch (error) {
      console.error("Error parsing user data, staying on public page.");
    }
  }

  // Not logged in? Render the page (SubsHome or Login)
  return children;
};

// ----------------------------------------------------------------------
// Existing Master Protection
// ----------------------------------------------------------------------
const ProtectedMasterRoute = ({ children }) => {
  const isMaster = sessionStorage.getItem("masterToken"); 
  return isMaster ? children : <MasterLogin />;
};

function App() {
  return (
    <Routes>
      {/* 
         ✅ 2. WRAP PUBLIC ROUTES 
         If user is logged in, these will auto-redirect to dashboard 
      */}
      <Route 
        path="/" 
        element={
          <PublicRoute>
            <SubsHome />
          </PublicRoute>
        } 
      />
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } 
      /> 
      
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/payment-success" element={<PaymentSuccess />} />

      {/* ------------------ MASTER ROUTES ------------------ */}
      {/* 
         Master Login is also a public route in essence, 
         but we handle the redirect inside the login logic mostly. 
         However, wrapping it prevents double login.
      */}
      <Route 
        path="/master" 
        element={
           <PublicRoute>
             <MasterLogin />
           </PublicRoute>
        } 
      />
      
      <Route 
        path="/master" 
        element={
          <ProtectedMasterRoute>
            <LayoutMaster />
          </ProtectedMasterRoute>
        }
      >
        <Route path="dashboard" element={<MasterDashboard />} />
        <Route path="admins" element={<MasterAdminUsers />} />
        <Route path="settings" element={<MasterSettings />} />
      </Route>


      {/* ------------------ ADMIN ROUTES ------------------ */}
      <Route
        element={
          <ProtectedRoute role="admin">
            <EmployeeProvider> 
              <LayoutAdmin />
            </EmployeeProvider>
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
        <Route path="/admin/shifttype" element={<AdminLocationSettings />} />
        <Route path="/admin/payroll" element={<Payroll />} />
        <Route path="/admin/notifications" element={<AdminNotifications />} />
        <Route path="/admin/on-leave-today" element={<EmployeesOnLeaveToday />} />
        {/* 🔥 GROUP MANAGEMENT */}
        <Route path="/admin/groups" element={<AdminGroupPage />} />

        <Route
          path="/admin/notices"
          element={
            <NoticeProvider>
              <AdminNotices />
            </NoticeProvider>
          }
        />

        <Route path="/admin/change-password" element={<ChangePasswordPage />} />
        <Route path="/admin/holiday-calendar" element={<AdminHolidayCalendarPage />} />
        <Route path="/admin/admin-overtime" element={<OvertimeAdmin />} />
        <Route path="/admin/admin-Leavemanage" element={<AdminLeavePanel />} />
        <Route path="/admin/late-requests" element={<AdminLateRequests />} />
        <Route path="/admin/meeting" element={<MeetingGenerator />} />
        <Route path="/admin/today-overview" element={<TodayOverview />} />
        <Route path="/admin/rules" element={<AdminRulesPost />} />
      </Route>

      {/* ------------------ EMPLOYEE ROUTES ------------------ */}
      <Route
        element={
          <ProtectedRoute role="employee">
            <CurrentEmployeeNotificationProvider>
              <NoticeProvider>
                <LayoutEmployee />
              </NoticeProvider>
            </CurrentEmployeeNotificationProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
        <Route path="/employee/profile" element={<CurrentEmployeeProfile />} />
        <Route path="/employee/attendance" element={<CurrentEmployeeAttendanceProfile />} />
        <Route path="/employee/notifications" element={<EmployeeNotifications />} />
        <Route path="/employee/leave-management" element={<LeaveWithModal />} />
        <Route path="/employee/empovertime" element={<OvertimeForm />} />
        <Route path="/employee/reuestworkmode" element={<EmployeeWorkModeRequest />} />
        <Route path="/employee/requestpunchout" element={<RequestPunchOut />} />
        <Route path="/employee/my-attendence" element={<EmployeeDailyAttendance />} />
        <Route path="/employee/new-attendence" element={<NewEmployeeAttendance />} />
        <Route path="/employee/rules" element={<EmployeeViewRules />} />

        <Route
          path="/employee/teams"
          element={<EmployeeTeamsPage />}
        />


        <Route
          path="/employee/holiday-calendar"
          element={
            <HolidayCalendarProvider>
              <CurrentEmployeeHolidayCalendar />
            </HolidayCalendarProvider>
          }
        />

        <Route path="/employee/notices" element={<CurrentEmployeeNoticeBoard />} />
        <Route path="/employee/leave-summary" element={<EmployeeLeaveSummary />} />
        <Route path="/employee/change-password" element={<ChangePasswordPage />} />
      </Route>
    </Routes>
  );
}

export default App;