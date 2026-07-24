import React, { useContext } from 'react';
import { SettingsContext } from '../context/SettingsContext';

const Toggle = ({ label, enabled, onChange }) => (
  <div className="flex items-center justify-between py-3">
    <span className="text-gray-700">{label}</span>
    <button
      onClick={onChange}
      className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ${
        enabled ? 'bg-blue-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

const NotificationSettings = () => {
  const { settings, updateNotificationSettings } = useContext(SettingsContext);
  const { notifications } = settings;

  const handleToggle = (key) => {
    updateNotificationSettings({ [key]: !notifications[key] });
  };
  
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Notifications</h2>
      <div className="divide-y divide-gray-200">
        <Toggle label="Enable All Notifications" enabled={notifications.enableAll} onChange={() => handleToggle('enableAll')} />
        <Toggle label="Daily Leave Request Emails" enabled={notifications.dailyLeaveRequests} onChange={() => handleToggle('dailyLeaveRequests')} />
        <Toggle label="OT Request Emails" enabled={notifications.otRequests} onChange={() => handleToggle('otRequests')} />
        <Toggle label="Permission Hours Emails" enabled={notifications.permissionHours} onChange={() => handleToggle('permissionHours')} />
      </div>
    </div>
  );
};

export default NotificationSettings;