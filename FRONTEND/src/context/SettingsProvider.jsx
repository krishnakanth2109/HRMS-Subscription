import React, { useState, useCallback, useMemo } from 'react';
import { SettingsContext } from './SettingsContext';

// --- MOCK BACKEND DATA ---
// This JSON object simulates the entire state of the settings module.
const mockSettingsData = {
  notifications: {
    enableAll: true,
    dailyLeaveRequests: false,
    otRequests: false,
    permissionHours: false,
  },
  sound: {
    enableNotificationSounds: true,
    enablePunchInSound: true,
    enablePunchOutSound: true,
  },
  companyInfo: {
    logoUrl: null, // No logo uploaded initially
    companyName: 'Vagarious Solutions Pvt Ltd.',
    address: '123 Tech Park, Silicon Valley, Cyberabad',
    gstNumber: '29ABCDE1234F1Z5',
    panNumber: 'ABCDE1234F',
    branches: ['Main Branch - Hyderabad', 'Satellite Office - Bangalore'],
  },
  // This array simulates the `policy_rules` table
  departmentRules: [
    {
      id: 1,
      ruleName: 'Default Full-Time Policy',
      departmentName: null, // null means it applies to all departments
      empType: 'FULL_TIME',
      priority: 100,
      monthlyPaidLeaves: 1,
      officeStart: '09:30',
      officeEnd: '18:30',
      lateLoginThreshold: '09:30',
      fullDayHours: 9,
      halfDayHours: 4,
    },
    {
      id: 2,
      ruleName: 'IT Department Late Shift',
      departmentName: 'IT',
      empType: null, // null means it applies to all employee types in this dept
      priority: 10, // Higher priority (lower number)
      monthlyPaidLeaves: 1,
      officeStart: '10:00',
      officeEnd: '19:00',
      lateLoginThreshold: '10:15',
      fullDayHours: 9,
      halfDayHours: 4,
    },
     {
      id: 3,
      ruleName: 'Intern Standard Hours',
      departmentName: null,
      empType: 'INTERN',
      priority: 50,
      monthlyPaidLeaves: 0,
      officeStart: '10:00',
      officeEnd: '17:00',
      lateLoginThreshold: '10:00',
      fullDayHours: 7,
      halfDayHours: 3.5,
    },
  ],
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(mockSettingsData);

  // --- API-like functions to update settings ---
  // In a real app, these would make PATCH/POST requests to your backend.

  const updateNotificationSettings = useCallback((newNotificationSettings) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      notifications: { ...prevSettings.notifications, ...newNotificationSettings },
    }));
    // Here you would add the API call, e.g., api.patch('/settings/notifications', newNotificationSettings)
    console.log("Updated Notification Settings:", newNotificationSettings);
  }, []);

  const updateSoundSettings = useCallback((newSoundSettings) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      sound: { ...prevSettings.sound, ...newSoundSettings },
    }));
    console.log("Updated Sound Settings:", newSoundSettings);
  }, []);
  
  const updateCompanyInfo = useCallback((newCompanyInfo) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      companyInfo: { ...prevSettings.companyInfo, ...newCompanyInfo },
    }));
    console.log("Updated Company Info:", newCompanyInfo);
  }, []);

  const updateDepartmentRule = useCallback((ruleId, updatedRule) => {
     setSettings(prevSettings => ({
      ...prevSettings,
      departmentRules: prevSettings.departmentRules.map(rule =>
        rule.id === ruleId ? { ...rule, ...updatedRule } : rule
      ),
    }));
    console.log("Updated Department Rule:", ruleId, updatedRule);
  }, []);

  // The value provided to the context consumers
  const contextValue = useMemo(() => ({
    settings,
    updateNotificationSettings,
    updateSoundSettings,
    updateCompanyInfo,
    updateDepartmentRule,
  }), [settings, updateNotificationSettings, updateSoundSettings, updateCompanyInfo, updateDepartmentRule]);

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};