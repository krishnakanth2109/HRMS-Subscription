import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { BrowserRouter } from 'react-router-dom';

import { ThemeProvider } from "./context/ThemeContext";
import { EmployeeProvider } from './context/EmployeeProvider';
import { AttendanceProvider } from './context/AttendanceProvider';
import { LeaveRequestProvider } from './context/LeaveRequestProvider';
import { SettingsProvider } from './context/SettingsProvider';
import AdminProvider from './context/AdminProvider';
import { AuthProvider } from './context/AuthProvider';
import { NotificationProvider } from "./context/NotificationProvider";
import HolidayCalendarProvider from './context/HolidayCalendarProvider';

import CurrentEmployeeAttendanceProvider from './EmployeeContext/CurrentEmployeeAttendanceProvider';
import CurrentEmployeeLeaveRequestProvider from './EmployeeContext/CurrentEmployeeLeaveRequestProvider';
import { CurrentEmployeeProvider } from './EmployeeContext/CurrentEmployeeProvider';
import CurrentEmployeeNotificationProvider from './EmployeeContext/CurrentEmployeeNotificationProvider';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <EmployeeProvider>
          <LeaveRequestProvider>
            <AttendanceProvider>
              <SettingsProvider>
                <AdminProvider>
                  <AuthProvider>
                    <NotificationProvider>

                      {/* ✅ FIX: Move CurrentEmployeeProvider BEFORE attendance */}
                      <CurrentEmployeeProvider> 
                        <CurrentEmployeeAttendanceProvider> 
                          <CurrentEmployeeLeaveRequestProvider>
                            <CurrentEmployeeNotificationProvider>
                              <HolidayCalendarProvider>
                                <App />
                              </HolidayCalendarProvider>
                            </CurrentEmployeeNotificationProvider>
                          </CurrentEmployeeLeaveRequestProvider>
                        </CurrentEmployeeAttendanceProvider>
                      </CurrentEmployeeProvider>

                    </NotificationProvider>
                  </AuthProvider>
                </AdminProvider>
              </SettingsProvider>
            </AttendanceProvider>
          </LeaveRequestProvider>
        </EmployeeProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
