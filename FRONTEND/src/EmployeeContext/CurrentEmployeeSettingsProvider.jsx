import { useState, useEffect, useContext } from 'react';
import { CurrentEmployeeSettingsContext } from './CurrentEmployeeSettingsContext';
import { CurrentEmployeeContext } from './CurrentEmployeeContext';

export const CurrentEmployeeSettingsProvider = ({ children }) => {
  const { currentEmployee } = useContext(CurrentEmployeeContext);
  
  // Default settings
  const defaultSettings = {
    notifications: true,
    email: true,
    requestButtonSound: true,
    punchInSound: true,
    punchOutSound: true,
  };

  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(false);

  // Get settings key for current employee
  const getSettingsKey = () => {
    return currentEmployee?._id ? `employee_settings_${currentEmployee._id}` : null;
  };

  // Load settings from sessionStorage on component mount
  useEffect(() => {
    const settingsKey = getSettingsKey();
    if (settingsKey) {
      try {
        const savedSettings = JSON.parse(sessionStorage.getItem(settingsKey));
        if (savedSettings) {
          setSettings({ ...defaultSettings, ...savedSettings });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        setSettings(defaultSettings);
      }
    }
  }, [currentEmployee?._id]);

  // Save settings to sessionStorage
  const saveSettings = async (newSettings) => {
    const settingsKey = getSettingsKey();
    if (!settingsKey) return;

    setLoading(true);
    try {
      // Update state
      setSettings(newSettings);
      
      // Save to sessionStorage
      sessionStorage.setItem(settingsKey, JSON.stringify(newSettings));
      
      // Here you could also make an API call to save to backend
      // await api.updateEmployeeSettings(currentEmployee._id, newSettings);
      
    } catch (error) {
      console.error('Error saving settings:', error);
      // Revert to previous settings on error
      const settingsKey = getSettingsKey();
      try {
        const savedSettings = JSON.parse(sessionStorage.getItem(settingsKey));
        if (savedSettings) {
          setSettings(savedSettings);
        }
      } catch (revertError) {
        setSettings(defaultSettings);
      }
    } finally {
      setLoading(false);
    }
  };

  // Update individual setting
  const updateSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    await saveSettings(newSettings);
  };

  // Reset to default settings
  const resetSettings = async () => {
    await saveSettings(defaultSettings);
  };

  // Toggle setting
  const toggleSetting = async (key) => {
    const newValue = !settings[key];
    await updateSetting(key, newValue);
  };

  // Play sound based on settings
  const playSound = (soundType) => {
    let shouldPlay = false;
    
    switch (soundType) {
      case 'request':
        shouldPlay = settings.requestButtonSound;
        break;
      case 'punchIn':
        shouldPlay = settings.punchInSound;
        break;
      case 'punchOut':
        shouldPlay = settings.punchOutSound;
        break;
      default:
        return;
    }

    if (shouldPlay) {
      // Create a simple beep sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = soundType === 'punchIn' ? 800 : soundType === 'punchOut' ? 600 : 700;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    }
  };

  const contextValue = {
    settings,
    loading,
    updateSetting,
    toggleSetting,
    resetSettings,
    saveSettings,
    playSound,
  };

  return (
    <CurrentEmployeeSettingsContext.Provider value={contextValue}>
      {children}
    </CurrentEmployeeSettingsContext.Provider>
  );
};