import React, { useContext } from 'react';
import { CurrentEmployeeSettingsContext } from '../EmployeeContext/CurrentEmployeeSettingsContext';
import { FaBell, FaEnvelope, FaVolumeUp, FaSignInAlt, FaSignOutAlt, FaUndo, FaCheck } from 'react-icons/fa';

const EmployeeSettings = () => {
  const {
    settings,
    loading,
    toggleSetting,
    resetSettings,
    playSound,
  } = useContext(CurrentEmployeeSettingsContext);

  const handleToggle = async (settingKey) => {
    await toggleSetting(settingKey);
    
    // Play sound for sound-related settings when enabled
    if (settingKey === 'requestButtonSound' && !settings[settingKey]) {
      setTimeout(() => playSound('request'), 100);
    } else if (settingKey === 'punchInSound' && !settings[settingKey]) {
      setTimeout(() => playSound('punchIn'), 100);
    } else if (settingKey === 'punchOutSound' && !settings[settingKey]) {
      setTimeout(() => playSound('punchOut'), 100);
    }
  };

  const handleTestSound = (soundType) => {
    playSound(soundType);
  };

  const handleResetSettings = async () => {
    if (window.confirm('Are you sure you want to reset all settings to default?')) {
      await resetSettings();
    }
  };

  const settingsConfig = [
    {
      key: 'notifications',
      title: 'Notifications',
      description: 'Enable or disable all notifications',
      icon: <FaBell className="text-blue-500" />,
    },
    {
      key: 'email',
      title: 'Email Notifications',
      description: 'Receive notifications via email',
      icon: <FaEnvelope className="text-green-500" />,
    },
    {
      key: 'requestButtonSound',
      title: 'Request Button Sound',
      description: 'Play sound when clicking request buttons',
      icon: <FaVolumeUp className="text-purple-500" />,
      hasTest: true,
      testType: 'request',
    },
    {
      key: 'punchInSound',
      title: 'Punch In Sound',
      description: 'Play sound when punching in',
      icon: <FaSignInAlt className="text-green-500" />,
      hasTest: true,
      testType: 'punchIn',
    },
    {
      key: 'punchOutSound',
      title: 'Punch Out Sound',
      description: 'Play sound when punching out',
      icon: <FaSignOutAlt className="text-red-500" />,
      hasTest: true,
      testType: 'punchOut',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Settings</h1>
              <p className="text-gray-600">Customize your experience and preferences</p>
            </div>
            <button
              onClick={handleResetSettings}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <FaUndo />
              Reset to Default
            </button>
          </div>
        </div>

        {/* Settings List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Preferences</h2>
          
          <div className="space-y-6">
            {settingsConfig.map((setting) => (
              <div key={setting.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="text-2xl">{setting.icon}</div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{setting.title}</h3>
                    <p className="text-sm text-gray-600">{setting.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Test Sound Button */}
                  {setting.hasTest && settings[setting.key] && (
                    <button
                      onClick={() => handleTestSound(setting.testType)}
                      className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
                      title="Test Sound"
                    >
                      Test
                    </button>
                  )}
                  
                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings[setting.key]}
                      onChange={() => handleToggle(setting.key)}
                      disabled={loading}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Status Indicator */}
          {loading && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
                <span className="text-sm">Saving settings...</span>
              </div>
            </div>
          )}

          {!loading && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <FaCheck className="text-sm" />
                <span className="text-sm">All settings saved automatically</span>
              </div>
            </div>
          )}
        </div>

        {/* Additional Information */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">About Settings</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>• <strong>Notifications:</strong> Controls all in-app notifications and alerts</p>
            <p>• <strong>Email Notifications:</strong> Controls email alerts for important updates</p>
            <p>• <strong>Sound Settings:</strong> Controls audio feedback for various actions</p>
            <p>• Settings are automatically saved when changed</p>
            <p>• Use the "Reset to Default" button to restore original settings</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeSettings;