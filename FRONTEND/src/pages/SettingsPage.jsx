import React, { useState } from 'react';
// import NotificationSettings from './NotificationSettings'; // Removed as unused
import DepartmentSettings from './DepartmentSettings';
// import SoundSettings from './SoundSettings'; // Removed as unused
import { FaBuilding } from 'react-icons/fa';

const TABS = {
  DEPARTMENT: 'Manage Shift Timings',
};

const SettingsPage = () => {
  // FIXED: Set initial state to TABS.DEPARTMENT so it appears immediately
  const [activeTab, setActiveTab] = useState(TABS.DEPARTMENT);

  const renderContent = () => {
    switch (activeTab) {
      case TABS.DEPARTMENT:
        return <DepartmentSettings />;
      default:
        return <DepartmentSettings />;
    }
  };

  const TabButton = ({ name, icon }) => (
    <button
      onClick={() => setActiveTab(name)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
        activeTab === name
          ? 'bg-blue-600 text-white shadow-md'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      }`}
    >
      {icon}
      {name}
    </button>
  );

  return (
    <div className="p-4 md:p-6 min-h-screen">
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white/20 backdrop-blur-md shadow-sm rounded-2xl border border-gray-300 mb-6">
        <TabButton name={TABS.DEPARTMENT} icon={<FaBuilding />} />
      </div>

      <div className="bg-white/20 backdrop-blur-md shadow-sm rounded-2xl border border-gray-300  animate-fade-in">
        {renderContent()}
      </div>
    </div>
  );
};

export default SettingsPage;