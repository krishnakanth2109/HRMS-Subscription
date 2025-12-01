import React, { useState, useEffect, useContext, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import Swal from "sweetalert2";
import { 
  FaPaperPlane, 
  FaHistory, 
  FaCalendarAlt, 
  FaClock, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaHourglassHalf,
  FaBuilding,
  FaLaptopHouse,
  FaInfinity,
  FaSyncAlt,
  FaCalendarDay,
  FaInfoCircle
} from "react-icons/fa";

const EmployeeWorkModeRequest = () => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  
  // Office Config State for Dynamic Status Calculation
  const [officeConfig, setOfficeConfig] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Form State
  const [requestType, setRequestType] = useState("Temporary");
  const [requestedMode, setRequestedMode] = useState("WFH");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedDays, setSelectedDays] = useState([]);
  const [reason, setReason] = useState("");

  const daysOfWeek = [
    { id: 1, label: "Mon" }, { id: 2, label: "Tue" }, { id: 3, label: "Wed" },
    { id: 4, label: "Thu" }, { id: 5, label: "Fri" }, { id: 6, label: "Sat" }, { id: 0, label: "Sun" }
  ];

  useEffect(() => {
    if (user?.employeeId) {
      fetchRequests();
      fetchOfficeSettings();
    }
  }, [user]);

  const fetchRequests = async () => {
    try {
      // ✅ FIX: Updated URL to match adminRoutes structure
      const { data } = await api.get(`/api/admin/requests/my/${user.employeeId}`);
      setRequests(data);
    } catch (err) { console.error("Error fetching requests", err); }
  };

  const fetchOfficeSettings = async () => {
    setStatusLoading(true);
    try {
      // Fetch full settings to calculate detailed description locally
      const { data } = await api.get("/api/admin/settings/office");
      setOfficeConfig(data);
    } catch (err) {
      console.error("Failed to load office settings", err);
    } finally {
      setStatusLoading(false);
    }
  };

  // ✅ LOGIC TO CALCULATE DETAILED STATUS (Same as Dashboard)
  const calculateWorkModeStatus = useCallback(() => {
    const defaults = { 
      mode: officeConfig?.globalWorkMode || 'WFO', 
      description: "Adhering to standard company-wide policy." 
    };

    if (!officeConfig || !user) return defaults;

    const empConfig = officeConfig.employeeWorkModes?.find(e => e.employeeId === user.employeeId);
    
    // If no config found or rule is Global
    if (!empConfig || empConfig.ruleType === "Global") {
      return defaults;
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    // 1. Check Temporary
    if (empConfig.ruleType === "Temporary" && empConfig.temporary) {
      const from = new Date(empConfig.temporary.fromDate);
      const to = new Date(empConfig.temporary.toDate);
      from.setHours(0,0,0,0);
      to.setHours(23,59,59,999);
      
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      const fromStr = new Date(empConfig.temporary.fromDate).toLocaleDateString('en-US', options);
      const toStr = new Date(empConfig.temporary.toDate).toLocaleDateString('en-US', options);

      if (today >= from && today <= to) {
        return {
          mode: empConfig.temporary.mode,
          description: `Temporary schedule active from ${fromStr} to ${toStr}.`
        };
      }
    }

    // 2. Check Recurring
    if (empConfig.ruleType === "Recurring" && empConfig.recurring) {
      const currentDay = new Date().getDay(); // 0=Sun, 1=Mon
      const daysMap = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
      
      // Get readable mode text
      const modeText = empConfig.recurring.mode === "WFH" ? "Remote" : "Work From Office";
      
      // Get all assigned days sorted
      const sortedDays = [...(empConfig.recurring.days || [])].sort((a,b) => a - b);
      const allDaysStr = sortedDays.map(d => daysMap[d]).join(", ");
      
      if (empConfig.recurring.days.includes(currentDay)) {
        return {
          mode: empConfig.recurring.mode,
          description: `Recurring schedule active. Assigned to work ${modeText} on ${allDaysStr}.`
        };
      } else {
        // Even if not active today, show the recurring schedule details
        return {
            ...defaults,
            description: `Recurring schedule exists (${modeText} on ${allDaysStr}), but today follows Global settings.`
        };
      }
    }

    // 3. Check Permanent
    if (empConfig.ruleType === "Permanent") {
      return {
        mode: empConfig.permanentMode,
        description: "Permanently assigned override by administration."
      };
    }

    return defaults;
  }, [officeConfig, user]);

  const toggleDay = (id) => {
    setSelectedDays(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (requestType === "Temporary" && (!fromDate || !toDate)) return Swal.fire("Missing Dates", "Please select a start and end date.", "warning");
    if (requestType === "Recurring" && selectedDays.length === 0) return Swal.fire("Missing Days", "Please select at least one day for the recurring schedule.", "warning");
    if (!reason.trim()) return Swal.fire("Missing Reason", "Please provide a reason for this request.", "warning");

    const payload = {
      employeeId: user.employeeId,
      employeeName: user.name,
      department: user.department || user.experienceDetails?.[user.experienceDetails.length - 1]?.department || "N/A",
      requestType,
      requestedMode,
      fromDate: requestType === "Temporary" ? fromDate : null,
      toDate: requestType === "Temporary" ? toDate : null,
      recurringDays: requestType === "Recurring" ? selectedDays : [],
      reason
    };

    try {
      setLoading(true);
      // ✅ FIX: Updated URL to match adminRoutes structure
      await api.post("/api/admin/request", payload);
      Swal.fire({
        title: "Submitted!",
        text: "Your request has been sent to administration.",
        icon: "success",
        confirmButtonColor: "#3b82f6"
      });
      setReason("");
      setSelectedDays([]);
      setFromDate("");
      setToDate("");
      fetchRequests(); // Refresh history
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Submission failed", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- UI HELPER COMPONENTS ---

  const RequestTypeCard = ({ type, icon, title, desc }) => (
    <div 
      onClick={() => setRequestType(type)}
      className={`cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${requestType === type ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
    >
      <div className={`p-2 rounded-full ${requestType === type ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
        {icon}
      </div>
      <div>
        <h4 className={`font-bold text-sm ${requestType === type ? 'text-blue-900' : 'text-gray-700'}`}>{title}</h4>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
    </div>
  );

  const ModeRadio = ({ mode, icon, label }) => (
    <label className={`flex-1 cursor-pointer p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-2 ${requestedMode === mode ? (mode === 'WFH' ? 'border-green-500 bg-green-50 text-green-700' : 'border-blue-500 bg-blue-50 text-blue-700') : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
      <input type="radio" name="reqMode" className="hidden" checked={requestedMode === mode} onChange={() => setRequestedMode(mode)} />
      <div className="text-2xl">{icon}</div>
      <span className="font-bold text-sm">{label}</span>
    </label>
  );

  const renderCurrentStatus = () => {
    if (statusLoading) return <div className="animate-pulse h-32 bg-gray-200 rounded-xl mb-8"></div>;
    
    // Get detailed status from logic
    const { mode, description } = calculateWorkModeStatus();
    
    const isWFO = mode === "WFO";
    const statusColor = isWFO ? "bg-gradient-to-r from-blue-600 to-indigo-700" : "bg-gradient-to-r from-green-500 to-emerald-600";
    
    return (
      <div className={`${statusColor} rounded-xl p-6 text-white shadow-lg mb-8 relative overflow-hidden`}>
        {/* Background Icon */}
        <div className="absolute top-0 right-0 p-4 opacity-10">
          {isWFO ? <FaBuilding size={100} /> : <FaLaptopHouse size={100} />}
        </div>
        
        <div className="relative z-10">
          <h2 className="text-sm uppercase tracking-wide font-medium opacity-90 mb-1">Current Active Mode</h2>
          
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl font-bold">{isWFO ? "Work From Office" : "Work From Home"}</span>
            <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                {isWFO ? <FaBuilding size={20}/> : <FaLaptopHouse size={20}/>}
            </div>
          </div>
          
          {/* Detailed Description like Dashboard */}
          <div className="flex items-start gap-2 bg-black/20 backdrop-blur-md p-3 rounded-lg text-sm font-medium border border-white/10">
            <FaInfoCircle className="mt-0.5 flex-shrink-0" size={14} />
            <span className="leading-tight">{description}</span>
          </div>
        </div>
      </div>
    );
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case "Approved": return <span className="flex items-center gap-1.5 text-green-700 bg-green-100 border border-green-200 px-2.5 py-1 rounded-full text-xs font-bold"><FaCheckCircle/> Approved</span>;
      case "Rejected": return <span className="flex items-center gap-1.5 text-red-700 bg-red-100 border border-red-200 px-2.5 py-1 rounded-full text-xs font-bold"><FaTimesCircle/> Rejected</span>;
      default: return <span className="flex items-center gap-1.5 text-yellow-700 bg-yellow-100 border border-yellow-200 px-2.5 py-1 rounded-full text-xs font-bold"><FaHourglassHalf/> Pending</span>;
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* 1. PINNED CURRENT STATUS */}
        {renderCurrentStatus()}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 2. REQUEST FORM (Left Column) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <FaPaperPlane className="text-blue-600" /> New Request
              </h3>

              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Request Type Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Select Request Type</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <RequestTypeCard type="Temporary" icon={<FaCalendarAlt />} title="Temporary" desc="Specific dates" />
                    <RequestTypeCard type="Recurring" icon={<FaSyncAlt />} title="Recurring" desc="Weekly days" />
                    <RequestTypeCard type="Permanent" icon={<FaInfinity />} title="Permanent" desc="Indefinite change" />
                  </div>
                </div>

                {/* Mode Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Desired Work Mode</label>
                  <div className="flex gap-4">
                    <ModeRadio mode="WFO" icon={<FaBuilding />} label="Work From Office" />
                    <ModeRadio mode="WFH" icon={<FaLaptopHouse />} label="Work From Home" />
                  </div>
                </div>

                {/* Conditional Fields */}
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 transition-all">
                  {requestType === "Temporary" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">From Date</label>
                        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">To Date</label>
                        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    </div>
                  )}

                  {requestType === "Recurring" && (
                    <div className="animate-fade-in">
                      <label className="block text-sm font-bold text-gray-700 mb-3">Select Days of the Week</label>
                      <div className="flex flex-wrap gap-2">
                        {daysOfWeek.map(day => (
                          <button 
                            type="button"
                            key={day.id} 
                            onClick={() => toggleDay(day.id)}
                            className={`w-10 h-10 rounded-full text-xs font-bold transition-all shadow-sm ${selectedDays.includes(day.id) ? "bg-blue-600 text-white transform scale-110" : "bg-white text-gray-600 border border-gray-200 hover:bg-blue-50"}`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Selected days will apply weekly.</p>
                    </div>
                  )}

                  {requestType === "Permanent" && (
                    <div className="text-sm text-gray-600 italic animate-fade-in flex items-center gap-2">
                      <FaInfinity className="text-orange-500"/> This will override your global settings indefinitely until changed.
                    </div>
                  )}
                </div>

                {/* Reason Field */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Reason for Request</label>
                  <textarea 
                    value={reason} 
                    onChange={(e) => setReason(e.target.value)} 
                    placeholder="Briefly explain why you need this change..."
                    className="w-full p-3 border border-gray-300 rounded-xl h-24 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold text-lg hover:bg-black transition shadow-lg transform active:scale-[0.99] flex justify-center items-center gap-2"
                >
                  {loading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"/> : <><FaPaperPlane size={16} /> Submit Request</>}
                </button>
              </form>
            </div>
          </div>

          {/* 3. REQUEST HISTORY (Right Column) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-full max-h-[800px]">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <FaHistory className="text-blue-500" /> Request History
                </h3>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {requests.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                    <FaHistory size={30} className="mb-2 opacity-20"/>
                    <p className="text-sm">No requests found.</p>
                  </div>
                ) : (
                  requests.map(req => (
                    <div key={req._id} className="group bg-white p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${req.requestType === 'Permanent' ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                          {req.requestType}
                        </span>
                        <span className="text-[10px] text-gray-400">{new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`font-bold text-sm ${req.requestedMode === 'WFH' ? 'text-green-600' : 'text-blue-600'}`}>
                          {req.requestedMode === 'WFH' ? 'Work From Home' : 'Work From Office'}
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 mb-3 flex items-start gap-1.5">
                        <FaCalendarDay className="mt-0.5 opacity-50"/>
                        <span>
                          {req.requestType === "Temporary" && `${new Date(req.fromDate).toLocaleDateString()} ➝ ${new Date(req.toDate).toLocaleDateString()}`}
                          {req.requestType === "Recurring" && `Repeats: ${req.recurringDays.length} days/week`}
                          {req.requestType === "Permanent" && "Permanent Change"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                        {getStatusBadge(req.status)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default EmployeeWorkModeRequest;