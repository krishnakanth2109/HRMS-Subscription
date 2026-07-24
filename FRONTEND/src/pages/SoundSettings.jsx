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

const SoundSettings = () => {
  const { settings, updateSoundSettings } = useContext(SettingsContext);
  const { sound } = settings;

  const handleToggle = (key) => {
    updateSoundSettings({ [key]: !sound[key] });
  };
  
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Sound Settings</h2>
      <div className="divide-y divide-gray-200">
        <Toggle label="Enable All Notification Sounds" enabled={sound.enableNotificationSounds} onChange={() => handleToggle('enableNotificationSounds')} />
        <Toggle label="Punch In Button Sound" enabled={sound.enablePunchInSound} onChange={() => handleToggle('enablePunchInSound')} />
        <Toggle label="Punch Out Button Sound" enabled={sound.enablePunchOutSound} onChange={() => handleToggle('enablePunchOutSound')} />
      </div>
    </div>
  );
};

export default SoundSettings;