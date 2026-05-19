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
  FaInfoCircle,
  FaEdit
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

  // Edit States
  const [isEditMode, setIsEditMode] = useState(false);
  const [editRequestId, setEditRequestId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const [editRequestType, setEditRequestType] = useState("Temporary");
  const [editRequestedMode, setEditRequestedMode] = useState("WFH");
  const [editFromDate, setEditFromDate] = useState("");
  const [editToDate, setEditToDate] = useState("");
  const [editSelectedDays, setEditSelectedDays] = useState([]);
  const [editReason, setEditReason] = useState("");

  useEffect(() => {
    if (user?.employeeId) {
      fetchRequests();
      fetchOfficeSettings();
    }
  }, [user]);

  const fetchRequests = async () => {
    try {
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

  const handleEditClick = (req) => {
    setIsEditMode(true);
    setEditRequestId(req._id);
    setEditRequestType(req.requestType);
    setEditRequestedMode(req.requestedMode);
    setEditFromDate(req.fromDate ? new Date(req.fromDate).toISOString().split('T')[0] : "");
    setEditToDate(req.toDate ? new Date(req.toDate).toISOString().split('T')[0] : "");
    setEditSelectedDays(req.recurringDays || []);
    setEditReason(req.reason || "");
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (editRequestType === "Temporary" && (!editFromDate || !editToDate)) return Swal.fire("Missing Dates", "Please select a start and end date.", "warning");
    if (editRequestType === "Recurring" && editSelectedDays.length === 0) return Swal.fire("Missing Days", "Please select at least one day for the recurring schedule.", "warning");
    if (!editReason.trim()) return Swal.fire("Missing Reason", "Please provide a reason for this request.", "warning");

    const payload = {
      requestType: editRequestType,
      requestedMode: editRequestedMode,
      fromDate: editRequestType === "Temporary" ? editFromDate : null,
      toDate: editRequestType === "Temporary" ? editToDate : null,
      recurringDays: editRequestType === "Recurring" ? editSelectedDays : [],
      reason: editReason
    };

    try {
      setLoading(true);
      await api.put(`/api/work-mode/request/${editRequestId}`, payload);
      Swal.fire({
        title: "Updated!",
        text: "Your request has been updated.",
        icon: "success",
        confirmButtonColor: "#3b82f6"
      });
      setShowEditModal(false);
      fetchRequests();
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Update failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleEditDay = (id) => {
    setEditSelectedDays(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  // --- UI HELPER COMPONENTS ---

  const RequestTypeCard = ({ type, icon, title, desc }) => (
    <div 
      onClick={() => setRequestType(type)}
      className={`cursor-pointer p-4 rounded-3xl border-2 transition-all duration-300 flex items-center gap-4 ${requestType === type ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-lg shadow-blue-100/50' : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'}`}
    >
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${requestType === type ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <h4 className={`font-black text-sm leading-tight mb-0.5 truncate ${requestType === type ? 'text-blue-700' : 'text-slate-700'}`}>{title}</h4>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate">{desc}</p>
      </div>
    </div>
  );

  const ModeRadio = ({ mode, icon, label }) => (
    <label className={`flex-1 cursor-pointer p-5 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-3 ${requestedMode === mode ? (mode === 'WFH' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-lg shadow-emerald-100/50' : 'border-blue-500 bg-blue-50 text-blue-700 shadow-lg shadow-blue-100/50') : 'border-slate-100 hover:bg-slate-50 text-slate-400'}`}>
      <input type="radio" name="reqMode" className="hidden" checked={requestedMode === mode} onChange={() => setRequestedMode(mode)} />
      <div className={`text-2xl transition-transform duration-300 ${requestedMode === mode ? 'scale-110' : ''}`}>{icon}</div>
      <span className="font-black text-xs uppercase tracking-widest">{label}</span>
    </label>
  );

  const renderCurrentStatus = () => {
    if (statusLoading) return <div className="animate-pulse h-32 bg-slate-100 rounded-3xl mb-8"></div>;
    
    const { mode, description } = calculateWorkModeStatus();
    const isWFO = mode === "WFO";
    const statusColor = isWFO ? "bg-gradient-to-br from-blue-600 to-indigo-700 shadow-blue-200" : "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-200";
    
    return (
      <div className={`${statusColor} rounded-[2rem] p-8 text-white shadow-2xl mb-8 relative overflow-hidden group`}>
        {/* Animated Background Icon */}
        <div className="absolute -top-10 -right-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
          {isWFO ? <FaBuilding size={250} /> : <FaLaptopHouse size={250} />}
        </div>
        
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest mb-6 border border-white/20">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Active Mode
          </div>
          
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">{isWFO ? "In-Office" : "Remote Mode"}</h2>
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
                {isWFO ? <FaBuilding size={24}/> : <FaLaptopHouse size={24}/>}
            </div>
          </div>
          
          <p className="text-sm md:text-base font-medium text-white/80 max-w-2xl leading-relaxed italic">
            "{description}"
          </p>
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
  };  return (
    <div className="p-4 md:p-8 min-h-screen font-sans bg-slate-50/20">
      <div className="max-w-6xl mx-auto">
        
        {/* 1. PINNED CURRENT STATUS */}
        {renderCurrentStatus()}

        <div className="flex flex-col gap-8">
          
          {/* TOP SECTION: Form & Pending Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* New Request Form */}
            <div className="lg:col-span-2 space-y-6 order-1">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8">
                <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                  <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow-lg shadow-blue-100">
                    <FaPaperPlane size={18} />
                  </div>
                  New Mode Request
                </h3>

                <form onSubmit={handleSubmit} className="space-y-8">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">1. Select Request Type</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <RequestTypeCard type="Temporary" icon={<FaCalendarAlt />} title="Temporary" desc="Set specific dates" />
                      <RequestTypeCard type="Recurring" icon={<FaSyncAlt />} title="Recurring" desc="Set weekly days" />
                      <RequestTypeCard type="Permanent" icon={<FaInfinity />} title="Permanent" desc="Indefinite change" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">2. Desired Work Mode</label>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <ModeRadio mode="WFO" icon={<FaBuilding />} label="Work From Office" />
                      <ModeRadio mode="WFH" icon={<FaLaptopHouse />} label="Work From Home" />
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 transition-all">
                    {requestType === "Temporary" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        <div>
                          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Start Date</label>
                          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-bold text-slate-700" />
                        </div>
                        <div>
                          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">End Date</label>
                          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-bold text-slate-700" />
                        </div>
                      </div>
                    )}

                    {requestType === "Recurring" && (
                      <div className="animate-fade-in text-center sm:text-left">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-4 ml-1">Select Days of the Week</label>
                        <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                          {daysOfWeek.map(day => (
                            <button 
                              type="button"
                              key={day.id} 
                              onClick={() => toggleDay(day.id)}
                              className={`w-12 h-12 rounded-2xl text-xs font-black transition-all shadow-sm ${selectedDays.includes(day.id) ? "bg-blue-600 text-white transform scale-110 shadow-blue-200" : "bg-white text-slate-400 border border-slate-200 hover:border-blue-300 hover:text-blue-600"}`}
                            >
                              {day.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-wider">Your schedule will repeat every week</p>
                      </div>
                    )}

                    {requestType === "Permanent" && (
                      <div className="text-xs font-bold text-orange-600 bg-orange-50 p-4 rounded-2xl border border-orange-100 animate-fade-in flex items-center gap-3">
                        <div className="bg-orange-500 text-white p-2 rounded-xl shadow-sm">
                          <FaInfinity />
                        </div>
                        This will override your global settings indefinitely until manually changed.
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">3. Reason for Request</label>
                    <textarea 
                      value={reason} 
                      onChange={(e) => setReason(e.target.value)} 
                      placeholder="Why do you need this change?"
                      className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-3xl h-32 focus:ring-2 focus:ring-blue-500 bg-white outline-none resize-none font-medium text-slate-700"
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black text-lg hover:bg-black transition shadow-xl shadow-slate-200 transform active:scale-[0.99] flex justify-center items-center gap-3"
                  >
                    {loading ? <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full"/> : <><FaPaperPlane size={18} /> Send Request</>}
                  </button>
                </form>
              </div>
            </div>

            {/* Pending Request Tracker */}
            <div className="lg:col-span-1 space-y-6 order-2">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                  <div className="bg-amber-500 text-white p-2 rounded-xl shadow-lg shadow-amber-100">
                    <FaHourglassHalf size={16} />
                  </div>
                  <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Track Request</h3>
                </div>
                
                <div className="p-6 flex-1 bg-white">
                  {requests.filter(r => r.status === "Pending").length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-10">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-dashed border-slate-200">
                        <FaCheckCircle className="text-slate-200" size={30} />
                      </div>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No Pending Requests</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {requests.filter(r => r.status === "Pending").map(req => (
                        <div key={req._id} className="relative group bg-amber-50/30 p-5 rounded-3xl border border-amber-100 transition-all hover:bg-amber-50">
                          <div className="flex justify-between items-start mb-4">
                            <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 bg-white px-2.5 py-1 rounded-lg border border-amber-100 shadow-sm">
                              {req.requestType}
                            </span>
                            <button onClick={() => handleEditClick(req)} className="bg-white text-blue-600 p-2.5 rounded-xl shadow-sm border border-blue-50 hover:bg-blue-600 hover:text-white transition-all">
                              <FaEdit size={12} />
                            </button>
                          </div>
                          
                          <div className="mb-4">
                            <h4 className={`text-lg font-black ${req.requestedMode === 'WFH' ? 'text-emerald-700' : 'text-blue-700'}`}>
                              {req.requestedMode === 'WFH' ? 'Remote Work' : 'In-Office'}
                            </h4>
                          </div>

                          <div className="space-y-2 border-t border-amber-100/50 pt-4">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                              <FaCalendarDay className="text-amber-500 opacity-70" size={12}/>
                              <span>
                                {req.requestType === "Temporary" && `${new Date(req.fromDate).toLocaleDateString()} - ${new Date(req.toDate).toLocaleDateString()}`}
                                {req.requestType === "Recurring" && `${req.recurringDays.length} days / week`}
                                {req.requestType === "Permanent" && "Permanent Transition"}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium italic line-clamp-2">"{req.reason}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* History Section */}
          <div className="w-full">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-800 text-white p-2.5 rounded-2xl shadow-lg shadow-slate-100">
                    <FaHistory size={16} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-lg">Request History</h3>
                  </div>
                </div>
              </div>
              
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50/80 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Type & Date</th>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Requested Mode</th>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Schedule Details</th>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason</th>
                      <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {requests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-black uppercase tracking-widest text-xs opacity-30">No history found</td>
                      </tr>
                    ) : (
                      requests.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(req => (
                        <tr key={req._id} className="hover:bg-slate-50/50 transition-all">
                          <td className="px-8 py-6 whitespace-nowrap">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${req.requestType === 'Permanent' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                              {req.requestType}
                            </span>
                            <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tight">{new Date(req.createdAt).toLocaleDateString()}</p>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${req.requestedMode === 'WFH' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                {req.requestedMode === 'WFH' ? <FaLaptopHouse size={14}/> : <FaBuilding size={14}/>}
                              </div>
                              <span className={`font-black text-sm ${req.requestedMode === 'WFH' ? 'text-emerald-700' : 'text-blue-700'}`}>
                                {req.requestedMode === 'WFH' ? 'Remote' : 'Office'}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-xs font-bold text-slate-600 flex items-center gap-2">
                              <FaCalendarDay className="text-slate-300" size={12}/>
                              <span>
                                {req.requestType === "Temporary" && `${new Date(req.fromDate).toLocaleDateString()} - ${new Date(req.toDate).toLocaleDateString()}`}
                                {req.requestType === "Recurring" && `Weekly: ${req.recurringDays.length} Days`}
                                {req.requestType === "Permanent" && "No End Date"}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-xs text-slate-500 max-w-xs truncate italic">"{req.reason || "-"}"</div>
                          </td>
                          <td className="px-8 py-6 text-center">
                            <div className="flex justify-center">{getStatusBadge(req.status)}</div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile History Cards */}
              <div className="md:hidden flex flex-col gap-4 p-4 bg-slate-50/50">
                {requests.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
                    <p className="text-[10px] font-black uppercase tracking-widest">No history available</p>
                  </div>
                ) : (
                  requests.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(req => (
                    <div key={req._id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-5">
                      {/* Header: Type & Status */}
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col gap-1">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg self-start ${req.requestType === 'Permanent' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                            {req.requestType}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-0.5">{new Date(req.createdAt).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}</span>
                        </div>
                        {getStatusBadge(req.status)}
                      </div>

                      {/* Mode & Schedule Details */}
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${req.requestedMode === 'WFH' ? 'bg-emerald-600 text-white shadow-emerald-100' : 'bg-blue-600 text-white shadow-blue-100'}`}>
                          {req.requestedMode === 'WFH' ? <FaLaptopHouse size={20}/> : <FaBuilding size={20}/>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-black text-slate-800 leading-none mb-2">
                            {req.requestedMode === 'WFH' ? 'Remote Mode' : 'Office Mode'}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 self-start">
                            <FaCalendarDay size={10} className="text-slate-400" />
                            <span className="truncate">
                              {req.requestType === "Temporary" && `${new Date(req.fromDate).toLocaleDateString()} - ${new Date(req.toDate).toLocaleDateString()}`}
                              {req.requestType === "Recurring" && `${req.recurringDays.length} Days / Week`}
                              {req.requestType === "Permanent" && "Indefinite Change"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Reason Section */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          <FaInfoCircle size={10} />
                          Reason for Request
                        </div>
                        <p className="text-xs text-slate-600 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 italic font-medium leading-relaxed">
                          "{req.reason || "No reason provided"}"
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <FaEdit className="text-blue-600" /> Edit Request
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                <FaTimesCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <form onSubmit={handleUpdate} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Request Type</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div onClick={() => setEditRequestType("Temporary")} className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center gap-3 min-w-0 ${editRequestType === "Temporary" ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-sm' : 'border-slate-100 hover:border-blue-200'}`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${editRequestType === "Temporary" ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <FaCalendarAlt size={14} />
                      </div>
                      <span className={`text-sm font-bold truncate ${editRequestType === "Temporary" ? 'text-blue-900' : 'text-slate-600'}`}>Temporary</span>
                    </div>
                    <div onClick={() => setEditRequestType("Recurring")} className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center gap-3 min-w-0 ${editRequestType === "Recurring" ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-sm' : 'border-slate-100 hover:border-blue-200'}`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${editRequestType === "Recurring" ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <FaSyncAlt size={14} />
                      </div>
                      <span className={`text-sm font-bold truncate ${editRequestType === "Recurring" ? 'text-blue-900' : 'text-slate-600'}`}>Recurring</span>
                    </div>
                    <div onClick={() => setEditRequestType("Permanent")} className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center gap-3 min-w-0 ${editRequestType === "Permanent" ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-sm' : 'border-slate-100 hover:border-blue-200'}`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${editRequestType === "Permanent" ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <FaInfinity size={14} />
                      </div>
                      <span className={`text-sm font-bold truncate ${editRequestType === "Permanent" ? 'text-blue-900' : 'text-slate-600'}`}>Permanent</span>
                    </div>
                  </div>
                </div>

                {/* Mode Selection */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Desired Work Mode</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className={`flex-1 cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 ${editRequestedMode === "WFO" ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-100 hover:bg-slate-50 text-slate-400'}`}>
                      <input type="radio" name="editReqMode" className="hidden" checked={editRequestedMode === "WFO"} onChange={() => setEditRequestedMode("WFO")} />
                      <FaBuilding className="text-lg flex-shrink-0" />
                      <span className="font-black text-[10px] uppercase tracking-widest">Office</span>
                    </label>
                    <label className={`flex-1 cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 ${editRequestedMode === "WFH" ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-100 hover:bg-slate-50 text-slate-400'}`}>
                      <input type="radio" name="editReqMode" className="hidden" checked={editRequestedMode === "WFH"} onChange={() => setEditRequestedMode("WFH")} />
                      <FaLaptopHouse className="text-lg flex-shrink-0" />
                      <span className="font-black text-[10px] uppercase tracking-widest">Remote</span>
                    </label>
                  </div>
                </div>

                {/* Conditional Fields */}
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  {editRequestType === "Temporary" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">From Date</label>
                        <input type="date" value={editFromDate} onChange={(e) => setEditFromDate(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">To Date</label>
                        <input type="date" value={editToDate} onChange={(e) => setEditToDate(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700" />
                      </div>
                    </div>
                  )}

                  {editRequestType === "Recurring" && (
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Select Days</label>
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        {daysOfWeek.map(day => (
                          <button 
                            type="button"
                            key={day.id} 
                            onClick={() => toggleEditDay(day.id)}
                            className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all shadow-sm ${editSelectedDays.includes(day.id) ? "bg-blue-600 text-white transform scale-105" : "bg-white text-slate-400 border border-slate-200 hover:bg-blue-50"}`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {editRequestType === "Permanent" && (
                    <div className="text-xs font-black text-orange-600 flex items-center gap-3 uppercase tracking-widest bg-white p-4 rounded-2xl border border-orange-100">
                      <FaInfinity className="text-orange-500" size={16}/> Indefinite Transition
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Reason for Request</label>
                  <textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} className="w-full p-4 border border-slate-200 rounded-2xl h-24 outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-600 resize-none" />
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-4 rounded-2xl font-black text-slate-400 bg-slate-50 hover:bg-slate-100 transition active:scale-[0.98]">Cancel</button>
                  <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-blue-100 transition active:scale-[0.98]">
                    {loading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mx-auto"/> : "Update"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EmployeeWorkModeRequest;