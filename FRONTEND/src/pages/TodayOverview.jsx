// --- START OF FILE TodayOverview.jsx ---

import React, { useState, useEffect, useMemo, useCallback } from "react";
import api, {
  getAttendanceByDateRange,
  getLeaveRequests,
  getEmployees,
  getAllShifts
} from "../api";
import {
  FaClock,
  FaCheckCircle,
  FaUserSlash,
  FaCalendarAlt,
  FaSearch,
  FaCalendarDay,
  FaTimes,
  FaArrowRight,
  FaEllipsisV,
  FaPhone,
  FaEnvelope,
  FaIdBadge,
  FaBuilding,
  FaWhatsapp,
  FaPhoneAlt,
  FaComment,
  FaUserClock,
  FaExclamationCircle,
  FaUserCheck,
  FaList,
  FaThLarge,
  FaFilter
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

// --- Helper functions ---
const getSecureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http:")) {
    return url.replace("http:", "https:");
  }
  return url;
};

const formatDateDMY = (dateInput) => {
  if (!dateInput) return "--";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "--";
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const LiveTimer = ({ startTime }) => {
  const [timeStr, setTimeStr] = useState("00:00:00");

  useEffect(() => {
    if (!startTime) return;
    
    const updateTimer = () => {
      const now = new Date();
      const start = new Date(startTime);
      const diffMs = now - start;

      if (diffMs < 0) {
        setTimeStr("00:00:00");
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
      const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
      const seconds = (totalSeconds % 60).toString().padStart(2, '0');

      setTimeStr(`${hours}:${minutes}:${seconds}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
      <span className="font-mono font-medium text-green-700 text-xs sm:text-sm">
        {timeStr}
      </span>
    </div>
  );
};

// Calculate login status
const calculateLoginStatus = (punchInTime, shiftData, apiStatus) => {
  if (!punchInTime) return { status: "--", isLate: false };
  
  const statusUpper = (apiStatus || "").toUpperCase();
  if (statusUpper === "LATE") {
    return { status: "LATE", isLate: true };
  }
  
  if (shiftData && shiftData.shiftStartTime) {
    try {
      const punchDate = new Date(punchInTime);
      const [sHour, sMin] = shiftData.shiftStartTime.split(':').map(Number);
      const shiftDate = new Date(punchDate);
      shiftDate.setHours(sHour, sMin, 0, 0);
      const grace = shiftData.lateGracePeriod || 15;
      shiftDate.setMinutes(shiftDate.getMinutes() + grace);
      
      if (punchDate > shiftDate) {
        return { status: "LATE", isLate: true };
      }
    } catch (e) {
      console.error("Date calc error", e);
    }
  }
  
  return { status: "ON TIME", isLate: false };
};

// --- Components ---

const LoginStatusBadge = ({ status }) => {
  const config = {
    "ON TIME": {
      label: 'On Time',
      icon: <FaUserCheck className="text-xs" />,
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500'
    },
    "LATE": {
      label: 'Late',
      icon: <FaExclamationCircle className="text-xs" />,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      dot: 'bg-amber-500'
    },
    "--": {
      label: 'Not Logged',
      icon: <FaUserSlash className="text-xs" />,
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      text: 'text-slate-600',
      dot: 'bg-slate-400'
    }
  };

  const { label, icon, bg, border, text, dot } = config[status] || config["--"];

  return (
    <div className={`inline-flex items-center px-2.5 py-1 rounded-full ${bg} ${border} border ${text} font-medium text-xs whitespace-nowrap`}>
      <div className={`w-1.5 h-1.5 rounded-full ${dot} mr-1.5`}></div>
      {icon && <span className="mr-1">{icon}</span>}
      {label}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const config = {
    WORKING: { 
      label: 'Working', 
      icon: <FaClock className="text-xs" />,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
      dot: 'bg-blue-500'
    },
    COMPLETED: { 
      label: 'Completed', 
      icon: <FaCheckCircle className="text-xs" />,
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500'
    },
    NOT_LOGGED_IN: { 
      label: 'LOGIN REQUIRED', 
      icon: <FaUserSlash className="text-xs" />,
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      text: 'text-slate-600',
      dot: 'bg-slate-400'
    },
    ON_LEAVE: { 
      label: 'On Leave', 
      icon: <FaCalendarAlt className="text-xs" />,
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-700',
      dot: 'bg-purple-500'
    },
    LATE: { 
      label: 'Late', 
      icon: <FaUserClock className="text-xs" />,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      dot: 'bg-amber-500'
    }
  };

  const { label, icon, bg, border, text, dot } = config[status] || config.WORKING;

  return (
    <div className={`inline-flex items-center px-2.5 py-1 rounded-full ${bg} ${border} border ${text} font-medium text-xs whitespace-nowrap`}>
      <div className={`w-1.5 h-1.5 rounded-full ${dot} mr-1.5`}></div>
      {icon && <span className="mr-1">{icon}</span>}
      {label}
    </div>
  );
};

const StatCard = ({ icon, title, value, color, onClick, category, isActive }) => {
  const colors = {
    WORKING: { 
      bg: 'bg-gradient-to-br from-blue-500/5 via-blue-500/2 to-transparent',
      border: 'border-blue-200',
      text: 'text-blue-600',
      gradient: 'from-blue-500 to-blue-600'
    },
    COMPLETED: { 
      bg: 'bg-gradient-to-br from-emerald-500/5 via-emerald-500/2 to-transparent',
      border: 'border-emerald-200',
      text: 'text-emerald-600',
      gradient: 'from-emerald-500 to-emerald-600'
    },
    NOT_LOGGED_IN: { 
      bg: 'bg-gradient-to-br from-slate-500/5 via-slate-500/2 to-transparent',
      border: 'border-slate-200',
      text: 'text-slate-600',
      gradient: 'from-slate-500 to-slate-600'
    },
    ON_LEAVE: { 
      bg: 'bg-gradient-to-br from-purple-500/5 via-purple-500/2 to-transparent',
      border: 'border-purple-200',
      text: 'text-purple-600',
      gradient: 'from-purple-500 to-purple-600'
    },
    LATE: { 
      bg: 'bg-gradient-to-br from-amber-500/5 via-amber-500/2 to-transparent',
      border: 'border-amber-200',
      text: 'text-amber-600',
      gradient: 'from-amber-500 to-amber-600'
    }
  };

  const config = colors[category] || colors.WORKING;

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl p-5 cursor-pointer transition-all duration-300 ${
        isActive ? 'ring-2 ring-offset-2' : ''
      } ${config.bg} border ${config.border} ${
        isActive ? `ring-${category === 'WORKING' ? 'blue' : category === 'COMPLETED' ? 'emerald' : category === 'NOT_LOGGED_IN' ? 'slate' : category === 'ON_LEAVE' ? 'purple' : 'amber'}-500/30` : ''
      }`}
    >
      <div className="absolute top-0 right-0 w-20 h-20 -mr-4 -mt-4 opacity-10">
        <div className={`w-full h-full bg-gradient-to-br ${config.gradient} rounded-full`}></div>
      </div>
      
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">{title}</p>
            <p className="text-2xl font-bold text-slate-900">
              {value}
            </p>
          </div>
          <div className={`p-2.5 rounded-lg ${config.bg}`}>
            {React.cloneElement(icon, { 
              className: `text-lg ${config.text}` 
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const CallModal = ({ isOpen, onClose, employee, phoneNumber }) => {
  if (!isOpen) return null;
  
  const isDisabled = !phoneNumber;

  const handleNormalCall = () => {
    if (!phoneNumber) return;
    window.open(`tel:${phoneNumber}`, '_self');
    onClose();
  };

  const handleWhatsAppCall = () => {
    if (!phoneNumber) return;
    window.open(`https://wa.me/${phoneNumber}`, '_blank');
    onClose();
  };

  const handleWhatsAppMessage = () => {
    if (!phoneNumber) return;
    const message = `Hi ${employee?.employeeName || 'there'}, How are you?`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${phoneNumber}?text=${encodedMessage}`, '_blank');
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Contact Employee</h3>
              <p className="text-sm text-slate-600 mt-0.5">{employee?.employeeName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
            >
              <FaTimes className="text-base" />
            </button>
          </div>
        </div>
        
        <div className="p-5">
          <div className="text-center mb-5">
            <div className="w-14 h-14 bg-gradient-to-br from-slate-700 to-slate-900 rounded-full flex items-center justify-center mx-auto mb-3">
              <FaPhoneAlt className="text-white text-xl" />
            </div>
            <h4 className="text-base font-semibold text-slate-900">{employee?.employeeName}</h4>
            <p className="text-sm text-slate-500 mt-0.5">ID: {employee?.employeeId}</p>
            <p className={`text-lg font-semibold mt-2 ${!phoneNumber ? 'text-red-500' : 'text-slate-900'}`}>
              {phoneNumber || 'No phone number linked'}
            </p>
          </div>
          
          <div className="space-y-2.5">
            <motion.button
              whileHover={{ scale: isDisabled ? 1 : 1.01 }}
              whileTap={{ scale: isDisabled ? 1 : 0.99 }}
              onClick={handleNormalCall}
              disabled={isDisabled}
              className={`w-full py-3 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2.5 border 
                ${isDisabled ? 'bg-slate-300 border-slate-300 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 border-slate-900'}`}
            >
              <FaPhoneAlt className="text-base" />
              Make Phone Call
            </motion.button>
            
            <motion.button
              whileHover={{ scale: isDisabled ? 1 : 1.01 }}
              whileTap={{ scale: isDisabled ? 1 : 0.99 }}
              onClick={handleWhatsAppCall}
              disabled={isDisabled}
               className={`w-full py-3 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2.5 border 
                ${isDisabled ? 'bg-emerald-300 border-emerald-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600'}`}
            >
              <FaWhatsapp className="text-base" />
              WhatsApp Call
            </motion.button>
            
            <motion.button
              whileHover={{ scale: isDisabled ? 1 : 1.01 }}
              whileTap={{ scale: isDisabled ? 1 : 0.99 }}
              onClick={handleWhatsAppMessage}
              disabled={isDisabled}
              className={`w-full py-3 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2.5 border 
                ${isDisabled ? 'bg-blue-300 border-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 border-blue-600'}`}
            >
              <FaComment className="text-base" />
              WhatsApp Message
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const MessageModal = ({ isOpen, onClose, employee, phoneNumber }) => {
  const [message, setMessage] = useState(`Hi ${employee?.employeeName || 'there'}, How are you?`);

  if (!isOpen) return null;
  const isDisabled = !phoneNumber;

  const handleSendMessage = (platform) => {
    if (!phoneNumber) return;
    let url = '';
    const encodedMessage = encodeURIComponent(message);
    
    if (platform === 'whatsapp') {
      url = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
      window.open(url, '_blank');
    } else if (platform === 'sms') {
      url = `sms:${phoneNumber}?body=${encodedMessage}`;
      window.open(url, '_self');
    }
    
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Send Message</h3>
              <p className="text-sm text-slate-600 mt-0.5">To: {employee?.employeeName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
            >
              <FaTimes className="text-base" />
            </button>
          </div>
        </div>
        
        <div className="p-5">
          {!phoneNumber && (
             <div className="mb-4 bg-red-50 text-red-600 px-3 py-2 rounded text-sm text-center font-medium">
               ⚠️ This employee has no phone number linked.
             </div>
          )}

          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none h-28 text-sm"
              placeholder="Type your message here..."
            />
            <div className="text-xs text-slate-500 mt-1.5">
              {message.length} characters
            </div>
          </div>
          
          <div className="space-y-2.5">
            <motion.button
              whileHover={{ scale: isDisabled ? 1 : 1.01 }}
              whileTap={{ scale: isDisabled ? 1 : 0.99 }}
              onClick={() => handleSendMessage('whatsapp')}
              disabled={isDisabled}
               className={`w-full py-3 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2.5 border 
                ${isDisabled ? 'bg-emerald-300 border-emerald-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600'}`}
            >
              <FaWhatsapp className="text-base" />
              Send via WhatsApp
            </motion.button>
            
            <motion.button
              whileHover={{ scale: isDisabled ? 1 : 1.01 }}
              whileTap={{ scale: isDisabled ? 1 : 0.99 }}
              onClick={() => handleSendMessage('sms')}
              disabled={isDisabled}
              className={`w-full py-3 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2.5 border 
                ${isDisabled ? 'bg-blue-300 border-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 border-blue-600'}`}
            >
              <FaComment className="text-base" />
              Send as SMS
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const EmployeeCard = ({ employee, onImageClick, category, onCallClick, onMessageClick }) => {
  const profilePic = employee.profilePic;
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setShowDropdown(false);
    if (showDropdown) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [showDropdown]);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setShowDropdown(!showDropdown);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-slate-200 relative flex flex-col h-full"
    >
      <div className="p-4 flex-grow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div 
              className="relative cursor-pointer group"
              onClick={() => onImageClick(profilePic)}
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                {profilePic ? (
                  <img 
                    src={profilePic} 
                    alt={employee.employeeName} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                    <span className="text-white font-semibold text-base">
                      {(employee.employeeName || "U").charAt(0)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="overflow-hidden">
              <h3 className="font-semibold text-slate-900 text-base truncate" title={employee.employeeName}>
                {employee.employeeName}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <FaIdBadge className="text-slate-400 text-xs" />
                <span className="text-xs text-slate-600 font-mono">{employee.employeeId}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <FaBuilding className="text-slate-400 text-xs" />
                <span className="text-xs text-slate-600 truncate" title={employee.department}>
                  {employee.department}
                </span>
              </div>
            </div>
          </div>
          
          <div className="relative">
            {/* ✅ FIXED: REMOVED CHECK FOR PHONE NUMBER SO ICON ALWAYS SHOWS */}
            <button 
              onClick={toggleDropdown}
              className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
            >
              <FaEllipsisV className="text-sm" />
            </button>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="py-1">
                    <button
                      onClick={() => {
                        onCallClick(employee);
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition-colors"
                    >
                      <FaPhone className="text-xs" /> Call
                    </button>
                    <button
                      onClick={() => {
                        onMessageClick(employee);
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition-colors"
                    >
                      <FaEnvelope className="text-xs" /> Message
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Status</span>
            <StatusBadge status={category} />
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Login Status</span>
            <LoginStatusBadge status={employee.loginStatus?.status || "--"} />
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Time Today</span>
            <div className="text-right">
              {employee.punchIn ? (
                <>
                  <div className="text-sm font-medium text-emerald-700">
                    {new Date(employee.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {employee.punchOut && (
                    <div className="text-xs text-rose-700">
                      {new Date(employee.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-xs text-slate-400">--</span>
              )}
            </div>
          </div>
          
          {category === 'WORKING' && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Duration</span>
              <LiveTimer startTime={employee.punchIn} />
            </div>
          )}
          
          {employee.isOnLeave && (
            <div className="bg-purple-50 rounded-md p-2.5 border border-purple-100">
              <div className="text-xs font-medium text-purple-800">{employee.leaveType}</div>
              <div className="text-xs text-purple-700 mt-0.5 line-clamp-1">"{employee.reason}"</div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// --- Table View Component ---
const TableView = ({ data, onImageClick, onCallClick, onMessageClick }) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Employee
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Punch In / Out
              </th>
               <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Duration / Notes
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {data.map((employee, idx) => (
              <tr key={employee.employeeId || idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div 
                      className="flex-shrink-0 h-10 w-10 cursor-pointer"
                      onClick={() => onImageClick(employee.profilePic)}
                    >
                      {employee.profilePic ? (
                        <img className="h-10 w-10 rounded-full object-cover border border-slate-200" src={employee.profilePic} alt="" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-medium">
                          {(employee.employeeName || "U").charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-slate-900">{employee.employeeName}</div>
                      <div className="text-xs text-slate-500">{employee.department} • {employee.employeeId}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1 items-start">
                    <StatusBadge status={employee.category} />
                    <LoginStatusBadge status={employee.loginStatus?.status || "--"} />
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {employee.punchIn ? (
                    <div className="text-sm text-slate-700">
                      <div className="font-medium text-emerald-700">
                        In: {new Date(employee.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {employee.punchOut && (
                        <div className="text-rose-700">
                          Out: {new Date(employee.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">--</span>
                  )}
                </td>
                <td className="px-6 py-4">
                   {employee.category === 'WORKING' ? (
                     <LiveTimer startTime={employee.punchIn} />
                   ) : employee.isOnLeave ? (
                     <div className="text-xs">
                        <span className="font-medium text-purple-700 block">{employee.leaveType}</span>
                        <span className="text-slate-500 truncate max-w-[150px] block" title={employee.reason}>"{employee.reason}"</span>
                     </div>
                   ) : (
                     <span className="text-sm text-slate-400">--</span>
                   )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {/* ✅ FIXED: REMOVED CHECK FOR PHONE NUMBER */}
                    <div className="flex items-center justify-end gap-2">
                       <button 
                        onClick={() => onCallClick(employee)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        title="Call"
                       >
                         <FaPhoneAlt size={14} />
                       </button>
                       <button 
                        onClick={() => onMessageClick(employee)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                        title="Message"
                       >
                         <FaComment size={14} />
                       </button>
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


// --- Main Component ---
const TodayOverview = () => {
  // State
  const [attendanceData, setAttendanceData] = useState([]);
  const [leaveData, setLeaveData] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [shiftsMap, setShiftsMap] = useState({});
  const [employeeImages, setEmployeeImages] = useState({});
  const [loading, setLoading] = useState(false);
  
  // Filters & UI State
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("card"); // 'card' or 'table'
  const [filterType, setFilterType] = useState("WORKING"); // Default "Working"
  const [departmentFilter, setDepartmentFilter] = useState("All");
  
  // Modals
  const [previewImage, setPreviewImage] = useState(null);
  const [callModal, setCallModal] = useState({ isOpen: false, employee: null });
  const [messageModal, setMessageModal] = useState({ isOpen: false, employee: null });
  const [employeePhoneNumbers, setEmployeePhoneNumbers] = useState({});

  // Optimized data fetch
  const fetchAllData = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      
      const [
        attendanceRes,
        leaveRes,
        employeesRes,
        shiftsRes
      ] = await Promise.all([
        getAttendanceByDateRange(today, today),
        getLeaveRequests(),
        getEmployees(),
        getAllShifts()
      ]);

      setAttendanceData(Array.isArray(attendanceRes) ? attendanceRes : []);
      setLeaveData(Array.isArray(leaveRes) ? leaveRes : []);
      setAllEmployees(Array.isArray(employeesRes) ? employeesRes : []);

      const shiftsArray = Array.isArray(shiftsRes) ? shiftsRes : shiftsRes?.data || [];
      const map = {};
      shiftsArray.forEach(shift => {
        if (shift.employeeId) map[shift.employeeId] = shift;
      });
      setShiftsMap(map);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Fetch employee details
  useEffect(() => {
    const fetchEmployeeDetails = async () => {
      if (allEmployees.length === 0) return;
      
      const newImages = {};
      const newPhoneNumbers = {};
      const employeesToProcess = allEmployees.slice(0, 20);
      
      await Promise.all(
        employeesToProcess.map(async (emp) => {
          const empId = emp.employeeId;
          if (!empId) return;
          try {
            const res = await api.get(`/api/profile/${empId}`);
            if (res?.data?.profilePhoto?.url) {
              newImages[empId] = getSecureUrl(res.data.profilePhoto.url);
            }
            if (res?.data?.phone) {
              newPhoneNumbers[empId] = res.data.phone;
            }
          } catch (err) {}
        })
      );
      
      if (Object.keys(newImages).length > 0) setEmployeeImages(prev => ({ ...prev, ...newImages }));
      if (Object.keys(newPhoneNumbers).length > 0) setEmployeePhoneNumbers(prev => ({ ...prev, ...newPhoneNumbers }));
    };
    
    if (allEmployees.length > 0) fetchEmployeeDetails();
  }, [allEmployees]);

  // Initial data fetch
  useEffect(() => {
    fetchAllData();
  }, []);

  // 1. Consolidate Raw Data
  const allDailyData = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const empNameMap = allEmployees.reduce((acc, emp) => {
      acc[emp.employeeId] = emp.name || emp.employeeName;
      return acc;
    }, {});

    const attendanceWithDetails = attendanceData.map(item => {
      const shift = shiftsMap[item.employeeId];
      const realName = empNameMap[item.employeeId] || item.employeeName || item.employeeId;
      const department = allEmployees.find(e => e.employeeId === item.employeeId)?.experienceDetails?.[0]?.department || 'Unassigned';
      const loginStatus = calculateLoginStatus(item.punchIn, shift, item.loginStatus);
      
      return {
        ...item,
        employeeName: realName,
        department,
        category: !item.punchIn ? 'NOT_LOGGED_IN' : (item.punchIn && !item.punchOut ? 'WORKING' : 'COMPLETED'),
        isOnLeave: false,
        loginStatus,
        profilePic: employeeImages[item.employeeId],
        phoneNumber: employeePhoneNumbers[item.employeeId] || null
      };
    });

    const activeEmployeeIds = new Set(allEmployees.filter(e => e.isActive !== false).map(e => e.employeeId));

    const onLeaveToday = leaveData.filter(leave => {
      if (leave.status !== 'Approved') return false;
      return today >= leave.from && today <= leave.to;
    }).map(leave => {
      const emp = allEmployees.find(e => e.employeeId === leave.employeeId);
      return {
        employeeId: leave.employeeId,
        employeeName: empNameMap[leave.employeeId] || leave.employeeName || leave.employeeId,
        category: 'ON_LEAVE',
        isOnLeave: true,
        leaveType: leave.leaveType,
        reason: leave.reason,
        department: emp?.experienceDetails?.[0]?.department || 'Unassigned',
        punchIn: null,
        punchOut: null,
        loginStatus: { status: "--", isLate: false },
        profilePic: employeeImages[leave.employeeId],
        phoneNumber: employeePhoneNumbers[leave.employeeId] || null
      };
    });

    const presentIds = new Set(attendanceData.map(att => att.employeeId));
    const onLeaveIds = new Set(onLeaveToday.map(l => l.employeeId));
    
    const notLoggedIn = Array.from(activeEmployeeIds)
      .filter(id => !presentIds.has(id) && !onLeaveIds.has(id))
      .map(id => {
        const emp = allEmployees.find(e => e.employeeId === id);
        return {
          employeeId: id,
          employeeName: empNameMap[id] || id,
          category: 'NOT_LOGGED_IN',
          isOnLeave: false,
          department: emp?.experienceDetails?.[0]?.department || 'Unassigned',
          punchIn: null,
          punchOut: null,
          loginStatus: { status: "--", isLate: false },
          profilePic: employeeImages[id],
          phoneNumber: employeePhoneNumbers[id] || null
        };
      });

    return [...attendanceWithDetails, ...onLeaveToday, ...notLoggedIn];
  }, [attendanceData, leaveData, allEmployees, shiftsMap, employeeImages, employeePhoneNumbers]);

  // 2. Department Filter Data (Source for Stats)
  const departmentFilteredData = useMemo(() => {
    if (departmentFilter === "All") {
      return allDailyData;
    }
    return allDailyData.filter(item => item.department === departmentFilter);
  }, [allDailyData, departmentFilter]);

  // 3. Calculate Stats (Counts) based on Department Data
  const stats = useMemo(() => {
    // This uses departmentFilteredData so counts don't go to zero when 'Late' or 'Working' is selected
    const baseData = departmentFilteredData;
    
    return {
      working: baseData.filter(item => item.category === 'WORKING').length,
      completed: baseData.filter(item => item.category === 'COMPLETED').length,
      notLoggedIn: baseData.filter(item => item.category === 'NOT_LOGGED_IN').length,
      onLeave: baseData.filter(item => item.category === 'ON_LEAVE').length,
      late: baseData.filter(item => item.loginStatus?.isLate === true).length,
      total: baseData.length
    };
  }, [departmentFilteredData]);

  // 4. Final Display Data (Filtered by Dropdown Selection + Search)
  const finalDisplayData = useMemo(() => {
    let filtered = departmentFilteredData;

    // Apply Dropdown Filter
    if (filterType !== 'ALL') {
        if (filterType === 'LATE') {
            filtered = filtered.filter(item => item.loginStatus?.isLate === true);
        } else {
            filtered = filtered.filter(item => item.category === filterType);
        }
    }

    // Apply Search
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.employeeName.toLowerCase().includes(lowerTerm) ||
        item.employeeId.toLowerCase().includes(lowerTerm) ||
        item.department.toLowerCase().includes(lowerTerm) ||
        (item.phoneNumber && item.phoneNumber.includes(searchTerm))
      );
    }

    return filtered;
  }, [departmentFilteredData, filterType, searchTerm]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const total = departmentFilteredData.length;
    const working = departmentFilteredData.filter(i => i.category === 'WORKING').length;
    const completed = departmentFilteredData.filter(i => i.category === 'COMPLETED').length;
    const late = departmentFilteredData.filter(i => i.loginStatus?.isLate === true).length;
    const withPhone = departmentFilteredData.filter(i => i.phoneNumber).length;
    
    return {
      total,
      present: working + completed,
      late,
      withPhone,
      attendanceRate: total > 0 ? Math.round(((working + completed) / total) * 100) : 0
    };
  }, [departmentFilteredData]);

  const departments = useMemo(() => {
    const depts = allDailyData.map(item => item.department).filter(Boolean);
    return ['All', ...new Set(depts)];
  }, [allDailyData]);

  // Handlers
  const handleCallClick = (employee) => setCallModal({ isOpen: true, employee });
  const handleMessageClick = (employee) => setMessageModal({ isOpen: true, employee });

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => fetchAllData(), 180000); // 3 min
    return () => clearInterval(interval);
  }, [fetchAllData]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 ">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between h-auto sm:h-20 py-4 sm:py-0 gap-4 sm:gap-0">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="p-2 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg shadow">
                <FaCalendarDay className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  Today's Overview
                </h1>
                <p className="text-sm text-slate-500 flex items-center gap-1.5">
                  <span>{formatDateDMY(new Date())}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-medium">Live Updates</span>
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-grow sm:flex-grow-0">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-56 text-sm shadow-sm"
                />
              </div>
              
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={fetchAllData}
                disabled={loading}
                className={`px-3.5 py-2.5 font-medium rounded-lg transition-all text-sm flex items-center gap-1.5 whitespace-nowrap ${
                  loading 
                    ? 'bg-slate-300 text-slate-700 cursor-not-allowed' 
                    : 'bg-slate-800 text-white hover:bg-slate-900'
                }`}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Grid - Counts won't reset to zero when filtering */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard
            icon={<FaClock />}
            title="Working"
            value={stats.working}
            category="WORKING"
            isActive={filterType === 'WORKING'}
            onClick={() => setFilterType('WORKING')}
          />
          <StatCard
            icon={<FaCheckCircle />}
            title="Completed"
            value={stats.completed}
            category="COMPLETED"
            isActive={filterType === 'COMPLETED'}
            onClick={() => setFilterType('COMPLETED')}
          />
          <StatCard
            icon={<FaUserSlash />}
            title="LOGIN REQUIRED"
            value={stats.notLoggedIn}
            category="NOT_LOGGED_IN"
            isActive={filterType === 'NOT_LOGGED_IN'}
            onClick={() => setFilterType('NOT_LOGGED_IN')}
          />
          <StatCard
            icon={<FaCalendarAlt />}
            title="On Leave"
            value={stats.onLeave}
            category="ON_LEAVE"
            isActive={filterType === 'ON_LEAVE'}
            onClick={() => setFilterType('ON_LEAVE')}
          />
          <StatCard
            icon={<FaUserClock />}
            title="Late"
            value={stats.late}
            category="LATE"
            isActive={filterType === 'LATE'}
            onClick={() => setFilterType('LATE')}
          />
        </div>

        {/* Controls Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            
            {/* Filter Group */}
            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
              {/* Layout Dropdown */}
              <div className="flex items-center gap-2">
                 <span className="text-sm font-medium text-slate-700">Layout:</span>
                 <div className="relative">
                    <select
                        value={viewMode}
                        onChange={(e) => setViewMode(e.target.value)}
                        className="appearance-none bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-9 p-2.5 pr-8 cursor-pointer"
                    >
                        <option value="card">Cards View</option>
                        <option value="table">Table View</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                         {viewMode === 'card' ? <FaThLarge className="text-slate-500 text-xs"/> : <FaList className="text-slate-500 text-xs"/>}
                    </div>
                 </div>
              </div>

              {/* Status Filter Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">Filter Status:</span>
                <div className="relative">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="appearance-none bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-9 p-2.5 pr-8 cursor-pointer"
                    >
                        <option value="ALL">All Employees</option>
                        <option value="WORKING">Working</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="NOT_LOGGED_IN">LOGIN REQUIRED</option>
                        <option value="ON_LEAVE">On Leave</option>
                        <option value="LATE">Late</option>
                    </select>
                     <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                         <FaFilter className="text-slate-500 text-xs"/>
                    </div>
                </div>
              </div>
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-sm font-medium text-slate-700">Dept:</span>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-48 p-2.5"
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
             <span>Showing <strong>{finalDisplayData.length}</strong> results</span>
             <span>Department Total: {departmentFilteredData.length}</span>
          </div>
        </div>

        {/* Content Area (Card Grid or Table) */}
        {loading && finalDisplayData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600 text-sm">Loading employee data...</p>
          </div>
        ) : finalDisplayData.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaCalendarDay className="text-slate-400 text-2xl" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No employees found</h3>
            <p className="text-slate-500 text-sm">Try changing your filters</p>
          </div>
        ) : (
          viewMode === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {finalDisplayData.map((employee, idx) => (
                <EmployeeCard
                  key={employee.employeeId || idx}
                  employee={employee}
                  category={employee.category}
                  onImageClick={setPreviewImage}
                  onCallClick={handleCallClick}
                  onMessageClick={handleMessageClick}
                />
              ))}
            </div>
          ) : (
            <TableView 
               data={finalDisplayData} 
               onImageClick={setPreviewImage}
               onCallClick={handleCallClick}
               onMessageClick={handleMessageClick}
            />
          )
        )}

        {/* Summary Footer */}
        <div className="mt-10 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-6 border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Department Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
              <div className="text-sm font-medium text-slate-500 mb-1">Attendance Rate</div>
              <div className="text-2xl font-semibold text-slate-900">
                {summaryMetrics.attendanceRate}%
              </div>
              <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"
                  style={{ width: `${summaryMetrics.attendanceRate}%` }}
                ></div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
              <div className="text-sm font-medium text-slate-500 mb-1">Active Employees</div>
              <div className="text-2xl font-semibold text-slate-900">{summaryMetrics.present}</div>
              <div className="mt-1 text-xs text-slate-600">Currently engaged</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
              <div className="text-sm font-medium text-slate-500 mb-1">Contactable</div>
              <div className="text-2xl font-semibold text-blue-700">
                {summaryMetrics.withPhone}
              </div>
              <div className="mt-1 text-xs text-slate-600">Employees with phone</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
              <div className="text-sm font-medium text-slate-500 mb-1">Punctuality Issues</div>
              <div className="text-2xl font-semibold text-amber-700">{summaryMetrics.late}</div>
              <div className="mt-1 text-xs text-slate-600">Late arrivals</div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {callModal.isOpen && (
          <CallModal
            isOpen={callModal.isOpen}
            onClose={() => setCallModal({ isOpen: false, employee: null })}
            employee={callModal.employee}
            phoneNumber={employeePhoneNumbers[callModal.employee?.employeeId]}
          />
        )}

        {messageModal.isOpen && (
          <MessageModal
            isOpen={messageModal.isOpen}
            onClose={() => setMessageModal({ isOpen: false, employee: null })}
            employee={messageModal.employee}
            phoneNumber={employeePhoneNumbers[messageModal.employee?.employeeId]}
          />
        )}

        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-3xl max-h-[85vh]"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute -top-10 right-0 text-white hover:text-slate-300 p-2"
              >
                <FaTimes size={20} />
              </button>
              <img
                src={previewImage}
                alt="Profile"
                className="rounded-lg shadow-2xl max-w-full max-h-[85vh] object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TodayOverview;
// --- END OF FILE TodayOverview.jsx ---