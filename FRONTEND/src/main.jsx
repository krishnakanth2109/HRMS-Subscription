// --- START OF FILE main.jsx ---

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { BrowserRouter } from "react-router-dom";

// Providers
import { AuthProvider } from "./context/AuthProvider";
import { ThemeProvider } from "./context/ThemeContext";
import { AttendanceProvider } from "./context/AttendanceProvider";
import { LeaveRequestProvider } from "./context/LeaveRequestProvider";
import { SettingsProvider } from "./context/SettingsProvider";
import { NotificationProvider } from "./context/NotificationProvider";
import HolidayCalendarProvider from "./context/HolidayCalendarProvider";

import CurrentEmployeeAttendanceProvider from "./EmployeeContext/CurrentEmployeeAttendanceProvider";
import CurrentEmployeeLeaveRequestProvider from "./EmployeeContext/CurrentEmployeeLeaveRequestProvider";
import { CurrentEmployeeProvider } from "./EmployeeContext/CurrentEmployeeProvider";
import CurrentEmployeeNotificationProvider from "./EmployeeContext/CurrentEmployeeNotificationProvider";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <LeaveRequestProvider>
            <AttendanceProvider>
              <SettingsProvider>
                <NotificationProvider>
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
              </SettingsProvider>
            </AttendanceProvider>
          </LeaveRequestProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);

// --- END OF FILE main.jsx ---
