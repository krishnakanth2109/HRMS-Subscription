// [file name]: AdminLocationSettings.jsx
// [file content begin]
import React, { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import { 
  FaMapMarkerAlt, FaSave, FaSatelliteDish, FaUsers, 
  FaLaptopHouse, FaBuilding, FaSearch, FaLayerGroup, 
  FaUndo, FaCheckSquare, FaPlus, FaTrash, FaTimes,
  FaUserMinus, FaListAlt, FaUserPlus, FaCheck, FaCalendarAlt, FaClock, FaEdit,
  FaEnvelopeOpenText, FaCheckCircle, FaTimesCircle,
  FaLocationArrow
} from "react-icons/fa";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import api from "../api"; 

// --- LEAFLET ICON FIX ---
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- MAP SUB-COMPONENTS ---
const LocationMarker = ({ position, setPosition }) => {
  const map = useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return position ? <Marker position={position} /> : null;
};

const RecenterMap = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 15);
  }, [center]);
  return null;
};

// --- MODALS ---

// 1. Schedule Modal
const ScheduleModal = ({ isOpen, onClose, employee, onSave }) => {
  const [activeTab, setActiveTab] = useState("Temporary");
  const [tempMode, setTempMode] = useState("WFH");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [recurMode, setRecurMode] = useState("WFH");
  const [recurDays, setRecurDays] = useState([]);
  const [permMode, setPermMode] = useState("WFO");

  useEffect(() => {
    if (isOpen && employee && employee.config) {
      const { ruleType, temporary, recurring, permanentMode } = employee.config;
      if (ruleType === "Temporary" && temporary) {
        setActiveTab("Temporary");
        setTempMode(temporary.mode);
        setFromDate(temporary.fromDate ? temporary.fromDate.split('T')[0] : "");
        setToDate(temporary.toDate ? temporary.toDate.split('T')[0] : "");
      } else if (ruleType === "Recurring" && recurring) {
        setActiveTab("Recurring");
        setRecurMode(recurring.mode);
        setRecurDays(recurring.days || []);
      } else if (ruleType === "Permanent") {
        setActiveTab("Permanent");
        setPermMode(permanentMode);
      } else {
        setActiveTab("Temporary"); 
      }
    }
  }, [isOpen, employee]);

  if (!isOpen || !employee) return null;

  const daysOfWeek = [
    { id: 1, label: "Mon" }, { id: 2, label: "Tue" }, { id: 3, label: "Wed" },
    { id: 4, label: "Thu" }, { id: 5, label: "Fri" }, { id: 6, label: "Sat" }, { id: 0, label: "Sun" }
  ];

  const toggleDay = (dayId) => {
    setRecurDays(prev => prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]);
  };

  const handleSave = () => {
    let payload = { employeeId: employee.employeeId, ruleType: activeTab };
    if (activeTab === "Temporary") {
      if (!fromDate || !toDate) return Swal.fire("Error", "Please select From and To dates.", "error");
      if (new Date(fromDate) > new Date(toDate)) return Swal.fire("Error", "To Date cannot be before From Date", "error");
      payload = { ...payload, mode: tempMode, fromDate, toDate };
    } else if (activeTab === "Recurring") {
      if (recurDays.length === 0) return Swal.fire("Error", "Select at least one day.", "error");
      payload = { ...payload, mode: recurMode, days: recurDays };
    } else if (activeTab === "Permanent") {
      payload = { ...payload, mode: permMode };
    }
    onSave(payload);
  };

  const handleResetToGlobal = () => {
    onSave({ employeeId: employee.employeeId, ruleType: "Global" });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
             <h3 className="text-xl font-bold text-gray-800">Manage Schedule</h3>
             <p className="text-sm text-gray-500">for {employee.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500"><FaTimes size={20}/></button>
        </div>
        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl">
           {["Temporary", "Recurring", "Permanent"].map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{tab}</button>
           ))}
        </div>
        <div className="flex-1 mb-6">
          {activeTab === "Temporary" && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 mb-2">Set a temporary mode. Automatically reverts to Global settings after the "To Date".</div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Work Mode</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="tempMode" value="WFO" checked={tempMode === "WFO"} onChange={e => setTempMode(e.target.value)} className="text-blue-600"/> <span className="text-sm font-medium">Work From Office</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="tempMode" value="WFH" checked={tempMode === "WFH"} onChange={e => setTempMode(e.target.value)} className="text-green-600"/> <span className="text-sm font-medium">Work From Home</span></label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-500 mb-1">From Date</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full p-2 border rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">To Date</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full p-2 border rounded-lg text-sm" /></div>
              </div>
            </div>
          )}
          {activeTab === "Recurring" && (
             <div className="space-y-4 animate-fade-in">
               <div className="bg-purple-50 p-3 rounded-lg text-xs text-purple-700 mb-2">Set specific days to have a fixed mode. Other days follow Global settings.</div>
               <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">On Selected Days:</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="recurMode" value="WFO" checked={recurMode === "WFO"} onChange={e => setRecurMode(e.target.value)} className="text-blue-600"/> <span className="text-sm font-medium">Work From Office</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="recurMode" value="WFH" checked={recurMode === "WFH"} onChange={e => setRecurMode(e.target.value)} className="text-green-600"/> <span className="text-sm font-medium">Work From Home</span></label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Select Days</label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map(day => (
                    <button key={day.id} onClick={() => toggleDay(day.id)} className={`w-10 h-10 rounded-full text-xs font-bold transition-all ${recurDays.includes(day.id) ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>{day.label}</button>
                  ))}
                </div>
              </div>
             </div>
          )}
          {activeTab === "Permanent" && (
            <div className="space-y-4 animate-fade-in">
               <div className="bg-orange-50 p-3 rounded-lg text-xs text-orange-700 mb-2">Permanently override Global settings for this employee until changed manually.</div>
               <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Select Permanent Mode</label>
                <div className="flex flex-col gap-2">
                   {['WFO', 'WFH'].map(m => (
                     <label key={m} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${permMode === m ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'hover:bg-gray-50 border-gray-200'}`}>
                       <input type="radio" name="permMode" value={m} checked={permMode === m} onChange={(e) => setPermMode(e.target.value)} className="w-4 h-4 text-blue-600" />
                       <span className="font-semibold text-gray-700">{m === 'WFO' ? 'Work From Office' : 'Work From Home'}</span>
                     </label>
                   ))}
                </div>
               </div>
            </div>
          )}
        </div>
        <div className="flex justify-between pt-4 border-t">
          <button onClick={handleResetToGlobal} className="text-red-500 text-sm font-bold hover:underline flex items-center gap-1"><FaUndo size={12}/> Reset to Global</button>
          <div className="flex gap-3">
             <button onClick={onClose} className="px-4 py-2 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
             <button onClick={handleSave} className="px-6 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-black transition">Save Rule</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 2. Pending Requests Modal (UPDATED WITH CORRECT ENDPOINTS)
const PendingRequestsModal = ({ isOpen, onClose, onRequestAction, onRefresh }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) fetchRequests();
  }, [isOpen]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // ✅ FIX: Changed from /api/work-mode/all-requests to /api/admin/requests
      const { data } = await api.get("/api/admin/requests");
      setRequests(data);
    } catch (err) { 
      console.error("Error fetching requests:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleAction = async (requestId, action) => {
    try {
      // ✅ FIX: Changed endpoint to /api/admin/requests/action
      await api.put("/api/admin/requests/action", { requestId, action });
      Swal.fire("Success", `Request ${action}`, "success");
      fetchRequests(); // Refresh list to update status
      onRefresh(); // Refresh main employee list
    } catch (err) {
      Swal.fire("Error", "Action failed", "error");
    }
  };

  const handleDelete = async (requestId) => {
    Swal.fire({
      title: "Delete Request?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          // ✅ FIX: Changed endpoint to /api/admin/requests/:id
          await api.delete(`/api/admin/requests/${requestId}`);
          Swal.fire("Deleted!", "Request has been deleted.", "success");
          fetchRequests();
        } catch (err) {
          Swal.fire("Error", "Delete failed", "error");
        }
      }
    });
  };

  const getFormattedDays = (days) => {
    const daysMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    if (!days || days.length === 0) return "No days selected";
    return days.sort((a,b)=>a-b).map(d => daysMap[d]).join(", ");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-4xl shadow-2xl h-[80vh] flex flex-col border border-gray-100">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FaEnvelopeOpenText className="text-blue-600"/> Manage Requests</h3>
              <p className="text-sm text-gray-500">Approve, reject, or delete employee work mode requests.</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500"><FaTimes size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl p-4">
           {loading ? <div className="text-center text-gray-500 py-10">Loading...</div> : requests.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-gray-400">
               <FaCheckCircle size={40} className="mb-2 opacity-20"/>
               <p>No requests found.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 gap-4">
                {requests.map(req => (
                  <div key={req._id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-start md:items-center relative">
                     <div className="flex-1">
                        <div className="flex justify-between items-start">
                           <div>
                             <h4 className="font-bold text-gray-800">{req.employeeName}</h4>
                             <p className="text-xs text-gray-500">{req.employeeId} • {req.department}</p>
                           </div>
                           <div className="flex flex-col items-end gap-1">
                             <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded uppercase">{req.requestType}</span>
                             {req.status === 'Approved' && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded flex items-center gap-1"><FaCheckCircle/> Approved</span>}
                             {req.status === 'Rejected' && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded flex items-center gap-1"><FaTimesCircle/> Rejected</span>}
                           </div>
                        </div>
                        
                        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                           <div>
                             <span className="text-gray-500 text-xs font-bold block">REQUESTED MODE</span>
                             <span className={`font-bold ${req.requestedMode === 'WFH' ? 'text-green-600' : 'text-blue-600'}`}>
                               {req.requestedMode === 'WFH' ? 'Work From Home' : 'Work From Office'}
                             </span>
                           </div>
                           <div>
                             <span className="text-gray-500 text-xs font-bold block">DURATION / DAYS</span>
                             <span className="text-gray-700 font-medium">
                               {req.requestType === "Temporary" && `${new Date(req.fromDate).toLocaleDateString()} to ${new Date(req.toDate).toLocaleDateString()}`}
                               {req.requestType === "Recurring" && getFormattedDays(req.recurringDays)}
                               {req.requestType === "Permanent" && "Indefinite"}
                             </span>
                           </div>
                        </div>
                        <div className="mt-2 bg-gray-50 p-2 rounded text-xs text-gray-600 italic border-l-2 border-gray-300">
                           "{req.reason}"
                        </div>
                     </div>
                     
                     <div className="flex flex-col gap-2">
                        {req.status === 'Pending' && (
                          <div className="flex gap-2">
                            <button onClick={() => handleAction(req._id, "Approved")} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-bold shadow flex items-center gap-1 transition">
                              <FaCheckCircle/> Approve
                            </button>
                            <button onClick={() => handleAction(req._id, "Rejected")} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1 transition">
                              <FaTimesCircle/> Reject
                            </button>
                          </div>
                        )}
                        <button onClick={() => handleDelete(req._id)} className="text-gray-400 hover:text-red-500 text-sm flex items-center justify-end gap-1 px-3 py-1 hover:bg-red-50 rounded transition mt-1">
                           <FaTrash/> Delete
                        </button>
                     </div>
                  </div>
                ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

// 3. Bulk Update Modal
const BulkModeModal = ({ isOpen, onClose, onSave, selectedCount }) => {
  const [mode, setMode] = useState("Global");
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl border border-gray-100">
        <h3 className="text-xl font-bold mb-2 text-gray-800">Bulk Update</h3>
        <p className="text-gray-500 mb-6 text-sm">Set permanent mode for <span className="font-bold text-blue-600">{selectedCount}</span> selected employees.</p>
        <div className="space-y-3 mb-8">
          {['Global', 'WFO', 'WFH'].map((m) => (
            <label key={m} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${mode === m ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'hover:bg-gray-50 border-gray-200'}`}>
              <input type="radio" name="bulkMode" value={m} checked={mode === m} onChange={(e) => setMode(e.target.value)} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
              <span className="font-semibold text-gray-700">{m === 'Global' ? 'Follow Global Settings' : m === 'WFO' ? 'Work From Office' : 'Work From Home'}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition">Cancel</button>
          <button onClick={() => onSave(mode)} className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 transition transform active:scale-95">Update Employees</button>
        </div>
      </div>
    </div>
  );
};

// 4. Add Member Modal
const AddMemberModal = ({ isOpen, onClose, onAdd, allEmployees, activeCategory }) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  if (!isOpen) return null;
  const uncategorized = allEmployees.filter(e => e.category === "Uncategorized" && (e.name.toLowerCase().includes(search.toLowerCase()) || e.employeeId.includes(search)));
  const toggleSelect = (id) => { setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };
  const handleAdd = () => { if(selectedIds.length === 0) return Swal.fire("Error", "Select at least one employee", "error"); onAdd(selectedIds); setSelectedIds([]); };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl h-[80vh] flex flex-col border border-gray-100">
        <div className="flex justify-between items-center mb-4">
            <div><h3 className="text-xl font-bold text-gray-800">Add Members to '{activeCategory}'</h3><p className="text-sm text-gray-500">Select employees from Uncategorized list.</p></div>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500"><FaTimes size={20}/></button>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
            <div className="mb-2 relative"><FaSearch className="absolute top-3.5 left-4 text-gray-400" /><input type="text" placeholder="Search Uncategorized employees..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full p-3 pl-11 border border-gray-300 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-xl bg-gray-50 p-2">
            {uncategorized.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-gray-400"><p>No uncategorized employees found.</p></div>) : (
                uncategorized.map(emp => (
                    <label key={emp.employeeId} className="flex items-center gap-4 p-3 border-b border-gray-100 last:border-0 hover:bg-white rounded-lg cursor-pointer transition-colors group">
                    <input type="checkbox" checked={selectedIds.includes(emp.employeeId)} onChange={() => toggleSelect(emp.employeeId)} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"/>
                    <div className="flex-1"><div className="font-bold text-gray-800 group-hover:text-blue-700 transition">{emp.name}</div><div className="text-xs text-gray-500">{emp.employeeId} • {emp.department}</div></div>
                    </label>
                ))
            )}
            </div>
            <div className="text-right text-sm font-medium text-gray-500 mt-2">{selectedIds.length} selected</div>
        </div>
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
          <button onClick={onClose} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition">Cancel</button>
          <button onClick={handleAdd} className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition transform active:scale-95">Add to {activeCategory}</button>
        </div>
      </div>
    </div>
  );
};

// 5. Category Modal
const CategoryModal = ({ isOpen, onClose, onSave, allEmployees }) => {
  const [catName, setCatName] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  if (!isOpen) return null;
  const filtered = allEmployees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.employeeId.includes(search));
  const toggleSelect = (id) => { setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };
  const handleSave = () => { if(!catName.trim()) return Swal.fire("Error", "Enter Category Name", "error"); if(selectedIds.length === 0) return Swal.fire("Error", "Select at least one employee", "error"); onSave(catName, selectedIds); setCatName(""); setSelectedIds([]); };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl h-[85vh] flex flex-col border border-gray-100">
        <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-bold text-gray-800">Create New Category</h3><button onClick={onClose} className="text-gray-400 hover:text-red-500"><FaTimes size={20}/></button></div>
        <div className="mb-6"><label className="block text-sm font-bold text-gray-700 mb-2">Category Name</label><input type="text" placeholder="e.g. Interns, Night Shift, Sales Team" value={catName} onChange={(e) => setCatName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition" /></div>
        <div className="flex-1 flex flex-col min-h-0">
            <div className="mb-2 relative"><FaSearch className="absolute top-3.5 left-4 text-gray-400" /><input type="text" placeholder="Search employees to add..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full p-3 pl-11 border border-gray-300 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition" /></div>
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-xl bg-gray-50 p-2">
            {filtered.map(emp => (
                <label key={emp.employeeId} className="flex items-center gap-4 p-3 border-b border-gray-100 last:border-0 hover:bg-white rounded-lg cursor-pointer transition-colors group">
                <input type="checkbox" checked={selectedIds.includes(emp.employeeId)} onChange={() => toggleSelect(emp.employeeId)} className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"/>
                <div className="flex-1"><div className="font-bold text-gray-800 group-hover:text-purple-700 transition">{emp.name}</div><div className="text-xs text-gray-500">{emp.employeeId} • {emp.department}</div></div>
                {selectedIds.includes(emp.employeeId) && <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">Selected</span>}
                </label>
            ))}
            </div>
            <div className="text-right text-sm font-medium text-gray-500 mt-2">{selectedIds.length} employees selected</div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={onClose} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition">Cancel</button>
          <button onClick={handleSave} className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition transform active:scale-95">Create Category</button>
        </div>
      </div>
    </div>
  );
};

// 6. Exceptions List Modal
const ExceptionsModal = ({ isOpen, onClose, employees }) => {
  if (!isOpen) return null;
  const exceptions = employees.filter(e => e.ruleType && e.ruleType !== 'Global');
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 h-[70vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b pb-4">
            <div><h3 className="text-xl font-bold text-gray-800">Work Mode Rules</h3><p className="text-sm text-gray-500">Employees with specific schedules or overrides.</p></div>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500"><FaTimes size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto">
           {exceptions.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-gray-400"><FaCheckSquare size={40} className="mb-2 opacity-20"/><p>No special rules found. Everyone follows Global.</p></div>
           ) : (
             <table className="w-full text-sm text-left">
               <thead className="bg-gray-50 text-gray-600 uppercase font-bold text-xs"><tr><th className="px-4 py-3 rounded-l-lg">Employee</th><th className="px-4 py-3">Rule Type</th><th className="px-4 py-3 rounded-r-lg text-right">Details</th></tr></thead>
               <tbody className="divide-y divide-gray-100">
                 {exceptions.map(emp => (
                   <tr key={emp.employeeId} className="hover:bg-gray-50 transition">
                     <td className="px-4 py-3"><div className="font-bold text-gray-800">{emp.name}</div><div className="text-xs text-gray-500">{emp.employeeId}</div></td>
                     <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${emp.ruleType === 'Temporary' ? 'bg-blue-100 text-blue-700' : emp.ruleType === 'Recurring' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>{emp.ruleType}</span></td>
                     <td className="px-4 py-3 text-right text-xs text-gray-600">{emp.ruleType === 'Permanent' && <span>{emp.config.permanentMode}</span>}{emp.ruleType === 'Temporary' && <span>{emp.config.temporary.mode} until {emp.config.temporary.toDate?.split('T')[0]}</span>}{emp.ruleType === 'Recurring' && <span>{emp.config.recurring.mode} on {emp.config.recurring.days.length} days</span>}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           )}
        </div>
        <div className="mt-4 pt-4 border-t flex justify-end"><button onClick={onClose} className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition">Close</button></div>
      </div>
    </div>
  );
};

// --- Main Component ---

const AdminLocationSettings = () => {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({ 
    latitude: "", 
    longitude: "", 
    allowedRadius: 200, 
    globalWorkMode: "WFO",
    requireAccurateLocation: true 
  });
  const [employees, setEmployees] = useState([]); 
  const [categories, setCategories] = useState([]); 
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All"); 
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [pendingCount, setPendingCount] = useState(0); // Added pending count state
  
  // Modals
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showExceptionsModal, setShowExceptionsModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  
  // New Requests Modal State
  const [showRequestsModal, setShowRequestsModal] = useState(false);

  // Map
  const [showMap, setShowMap] = useState(false);
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]); 
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchingMap, setSearchingMap] = useState(false);

  useEffect(() => { 
    fetchSettings(); 
    fetchEmployees(); 
    fetchPendingCount(); // Fetch count on mount
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get("/api/admin/settings/office");
      if (data) {
        setSettings({ 
          latitude: data.officeLocation?.latitude || "", 
          longitude: data.officeLocation?.longitude || "", 
          allowedRadius: data.allowedRadius || 200, 
          globalWorkMode: data.globalWorkMode || "WFO",
          requireAccurateLocation: data.requireAccurateLocation !== undefined ? data.requireAccurateLocation : true
        });
        if (data.officeLocation?.latitude) { 
          setMapCenter([data.officeLocation.latitude, data.officeLocation.longitude]); 
          setSelectedCoords([data.officeLocation.latitude, data.officeLocation.longitude]); 
        }
      }
    } catch (error) { console.error(error); }
  };

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const { data } = await api.get("/api/admin/settings/employees-modes");
      setEmployees(data.employees || []);
      setCategories(data.categories || []);
    } catch (error) { Swal.fire("Error", "Failed to load employees", "error"); } finally { setLoadingEmployees(false); }
  };

  // Added function to fetch pending requests count
  const fetchPendingCount = async () => {
    try {
      const { data } = await api.get("/api/admin/requests");
      const pending = data.filter(req => req.status === 'Pending');
      setPendingCount(pending.length);
    } catch (error) {
      console.error("Error fetching pending count:", error);
    }
  };

  // Wrapper to refresh all data (employees and pending count)
  const handleRefreshData = () => {
    fetchEmployees();
    fetchPendingCount();
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) return Swal.fire("Error", "Geolocation not supported", "error");
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => { setSettings((prev) => ({ ...prev, latitude: position.coords.latitude, longitude: position.coords.longitude })); setLoading(false); Swal.fire("Success", "Location captured!", "success"); },
      () => { setLoading(false); Swal.fire("Error", "Unable to retrieve location.", "error"); },
      { enableHighAccuracy: true }
    );
  };

  // Map Logic
  const openMap = () => { 
    if (settings.latitude && settings.longitude) { 
      const lat = parseFloat(settings.latitude); 
      const lng = parseFloat(settings.longitude); 
      setMapCenter([lat, lng]); 
      setSelectedCoords([lat, lng]); 
    } 
    setShowMap(true); 
  };
  
  const handleMapSearch = async () => { 
    if(!searchQuery) return; 
    setSearchingMap(true); 
    try { 
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`); 
      const data = await response.json(); 
      if(data && data.length > 0) { 
        const { lat, lon } = data[0]; 
        const newCenter = [parseFloat(lat), parseFloat(lon)]; 
        setMapCenter(newCenter); 
      } else { 
        Swal.fire("Not Found", "Location not found.", "info"); 
      } 
    } catch (err) { 
      Swal.fire("Error", "Search failed.", "error"); 
    } finally { 
      setSearchingMap(false); 
    } 
  };
  
  const confirmLocation = () => { 
    if(selectedCoords) { 
      setSettings(prev => ({ ...prev, latitude: selectedCoords[0], longitude: selectedCoords[1] })); 
      setShowMap(false); 
    } else { 
      Swal.fire("Select Location", "Please click on the map to place a pin.", "warning"); 
    } 
  };

  const handleSaveGlobalSettings = async () => {
    // If WFO mode is selected and requireAccurateLocation is enabled, validate coordinates
    if (settings.globalWorkMode === "WFO" && settings.requireAccurateLocation && (!settings.latitude || !settings.longitude)) { 
      return Swal.fire("Warning", "Please set Latitude and Longitude for WFO with accurate location enabled.", "warning"); 
    }
    
    try { 
      setLoading(true); 
      await api.put("/api/admin/settings/office", { 
        officeLocation: { 
          latitude: parseFloat(settings.latitude || 0), 
          longitude: parseFloat(settings.longitude || 0) 
        }, 
        allowedRadius: parseInt(settings.allowedRadius), 
        globalWorkMode: settings.globalWorkMode,
        requireAccurateLocation: settings.requireAccurateLocation
      }); 
      Swal.fire("Saved", "Global settings updated.", "success"); 
    } catch (error) { 
      Swal.fire("Error", "Failed to save settings.", "error"); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleOpenScheduleModal = (employee) => { setEditingEmployee(employee); setScheduleModalOpen(true); };
  const handleSaveSchedule = async (payload) => { try { setScheduleModalOpen(false); await api.put("/api/admin/settings/employee-mode", payload); Swal.fire("Success", "Schedule updated!", "success"); fetchEmployees(); } catch (error) { Swal.fire("Error", "Failed to update schedule", "error"); } };

  const toggleSelectAll = (filteredEmps) => { const ids = filteredEmps.map(e => e.employeeId); if (ids.every(id => selectedEmployees.includes(id))) { setSelectedEmployees(prev => prev.filter(id => !ids.includes(id))); } else { setSelectedEmployees(prev => [...new Set([...prev, ...ids])]); } };
  const toggleSelection = (id) => { setSelectedEmployees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };
  const handleBulkUpdate = async (mode) => { try { setShowBulkModal(false); await api.post("/api/admin/settings/employee-mode/bulk", { employeeIds: selectedEmployees, mode }); Swal.fire("Success", "Bulk update completed", "success"); fetchEmployees(); setSelectedEmployees([]); } catch (err) { Swal.fire("Error", "Bulk update failed", "error"); } };
  const handleResetAll = () => { Swal.fire({ title: "Reset All Employees?", text: "Everyone will revert to Global Settings.", icon: "warning", showCancelButton: true, confirmButtonColor: "#d33", confirmButtonText: "Reset All" }).then(async (result) => { if (result.isConfirmed) { try { await api.post("/api/admin/settings/employee-mode/reset"); Swal.fire("Reset!", "Done.", "success"); fetchEmployees(); } catch (err) { Swal.fire("Error", "Reset failed", "error"); } } }); };

  const handleSaveCategory = async (name, ids) => { try { setShowCategoryModal(false); setShowAddMemberModal(false); await api.post("/api/admin/settings/categories", { name, employeeIds: ids }); Swal.fire("Success", `Category '${name}' saved!`, "success"); fetchEmployees(); setActiveCategory(name); } catch (err) { Swal.fire("Error", "Failed to save category", "error"); } };
  const handleAddMembersToCategory = (newIds) => { const currentCategoryEmployees = employees.filter(e => e.category === activeCategory); const existingIds = currentCategoryEmployees.map(e => e.employeeId); const combinedIds = [...existingIds, ...newIds]; handleSaveCategory(activeCategory, combinedIds); };
  const handleDeleteCategory = async () => { if (activeCategory === "All" || activeCategory === "Uncategorized") return; Swal.fire({ title: `Delete '${activeCategory}'?`, text: "Employees will be moved to 'Uncategorized'.", icon: "warning", showCancelButton: true, confirmButtonColor: "#d33", confirmButtonText: "Yes, delete it!" }).then(async (result) => { if (result.isConfirmed) { try { await api.delete(`/api/admin/settings/categories/${activeCategory}`); Swal.fire("Deleted!", "Category removed.", "success"); setActiveCategory("All"); fetchEmployees(); } catch (err) { Swal.fire("Error", "Delete failed", "error"); } } }); };
  const handleRemoveFromCategory = async (employee) => { try { await api.put("/api/admin/settings/categories/remove-employee", { categoryName: employee.category, employeeId: employee.employeeId }); Swal.fire("Removed", `${employee.name} moved to Uncategorized.`, "success"); fetchEmployees(); } catch (err) { Swal.fire("Error", "Failed to remove employee", "error"); } };

  const searchFiltered = employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.employeeId.includes(searchTerm));
  const displayEmployees = useMemo(() => { if (activeCategory === "All") return searchFiltered; if (activeCategory === "Uncategorized") return searchFiltered.filter(e => e.category === "Uncategorized"); return searchFiltered.filter(e => e.category === activeCategory); }, [searchFiltered, activeCategory]);
  const getCategoryCount = (catName) => { if(catName === "All") return employees.length; return employees.filter(e => e.category === catName).length; };

  const renderStatusBadge = (emp) => {
    const isActiveWFO = emp.currentEffectiveMode === "WFO";
    const bgClass = isActiveWFO ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800";
    let details = "Following Global"; let icon = null;
    if (emp.ruleType === "Permanent") { details = "Permanent Override"; icon = <FaSave className="mr-1"/>; } else if (emp.ruleType === "Temporary") { details = `Until ${emp.config.temporary?.toDate?.split("T")[0]}`; icon = <FaCalendarAlt className="mr-1"/>; } else if (emp.ruleType === "Recurring") { details = "Weekly Schedule"; icon = <FaClock className="mr-1"/>; }
    return (<div className="flex flex-col items-end"><span className={`px-2 py-0.5 rounded text-xs font-bold ${bgClass} mb-1`}>{emp.currentEffectiveMode}</span><span className="text-[10px] text-gray-500 flex items-center">{icon} {details}</span></div>);
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-indigo-50 min-h-screen font-sans relative">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Global Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
             <div className="flex items-center gap-3">
                 <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><FaSatelliteDish size={18} /></div>
                 <div><h2 className="font-bold text-gray-800 text-lg">Global Configuration</h2><p className="text-xs text-gray-500">Base office settings and default mode.</p></div>
             </div>
          </div>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
             <div className="space-y-6">
                 <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Default Global Mode</label>
                     <div className="flex bg-gray-100 p-1 rounded-xl">
                        <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg cursor-pointer transition-all ${settings.globalWorkMode === "WFO" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                          <input 
                            type="radio" 
                            value="WFO" 
                            checked={settings.globalWorkMode === "WFO"} 
                            onChange={(e) => setSettings({ ...settings, globalWorkMode: e.target.value })} 
                            className="hidden" 
                          />
                          <FaBuilding /> 
                          <span className="font-bold text-sm">Office</span>
                        </label>
                        <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg cursor-pointer transition-all ${settings.globalWorkMode === "WFH" ? "bg-white text-green-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                          <input 
                            type="radio" 
                            value="WFH" 
                            checked={settings.globalWorkMode === "WFH"} 
                            onChange={(e) => setSettings({ ...settings, globalWorkMode: e.target.value })} 
                            className="hidden" 
                          />
                          <FaLaptopHouse /> 
                          <span className="font-bold text-sm">Remote</span>
                        </label>
                     </div>
                 </div>
                 
                 {/* Location Accuracy Toggle - Only show when WFO is selected */}
                 {settings.globalWorkMode === "WFO" && (
                   <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                     <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center gap-2">
                         <FaLocationArrow className="text-blue-600" />
                         <label className="block text-sm font-bold text-gray-700">Enforce Office Location</label>
                       </div>
                       <div className="relative inline-block w-12 mr-2 align-middle select-none">
                         <input 
                           type="checkbox" 
                           id="requireAccurateLocation"
                           checked={settings.requireAccurateLocation}
                           onChange={(e) => setSettings({ ...settings, requireAccurateLocation: e.target.checked })}
                           className="sr-only"
                         />
                         <label 
                           htmlFor="requireAccurateLocation" 
                           className={`block h-6 w-12 cursor-pointer rounded-full transition-all duration-200 ${settings.requireAccurateLocation ? 'bg-blue-600' : 'bg-gray-300'}`}
                         >
                           <div className={`h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ${settings.requireAccurateLocation ? 'translate-x-6' : 'translate-x-0'}`}></div>
                         </label>
                       </div>
                     </div>
                     <p className="text-xs text-gray-600">
                       {settings.requireAccurateLocation 
                         ? "Employees must be at the office location to punch in. GPS coordinates will be validated."
                         : "Employees can work from anywhere. Office location will not be enforced for punch-in."
                       }
                     </p>
                   </div>
                 )}
                 
                 <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Geo-Fencing Radius</label>
                   <select 
                     value={settings.allowedRadius} 
                     onChange={(e) => setSettings({ ...settings, allowedRadius: e.target.value })} 
                     className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" 
                     disabled={settings.globalWorkMode === "WFH" || (settings.globalWorkMode === "WFO" && !settings.requireAccurateLocation)}
                   >
                     <option value="50">50 Meters (Strict)</option>
                     <option value="100">100 Meters</option>
                     <option value="200">200 Meters (Standard)</option>
                     <option value="500">500 Meters</option>
                     <option value="1000">1 Kilometer</option>
                   </select>
                   {settings.globalWorkMode === "WFO" && !settings.requireAccurateLocation && (
                     <p className="text-xs text-gray-500 mt-1">Radius setting is disabled when location enforcement is off.</p>
                   )}
                 </div>
             </div>
             <div className="space-y-6">
                 <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Office Coordinates</label>
                      <div className="flex gap-2">
                        <button 
                          onClick={handleGetCurrentLocation} 
                          className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition ${settings.requireAccurateLocation ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                          disabled={!settings.requireAccurateLocation}
                        >
                          <FaMapMarkerAlt /> Auto-Detect
                        </button>
                        <button 
                          onClick={openMap} 
                          className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition ${settings.requireAccurateLocation ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                          disabled={!settings.requireAccurateLocation}
                        >
                          <FaMapMarkerAlt /> Choose on Map
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <span className="absolute top-2.5 left-3 text-gray-400 text-[10px] font-bold">LAT</span>
                        <input 
                          type="number" 
                          value={settings.latitude} 
                          onChange={(e) => setSettings({...settings, latitude: e.target.value})} 
                          className={`w-full pl-9 p-2.5 ${!settings.requireAccurateLocation ? 'bg-gray-100' : 'bg-white'} border border-gray-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none`} 
                          placeholder="0.0000" 
                          disabled={!settings.requireAccurateLocation}
                        />
                      </div>
                      <div className="relative">
                        <span className="absolute top-2.5 left-3 text-gray-400 text-xs font-bold">LNG</span>
                        <input 
                          type="number" 
                          value={settings.longitude} 
                          onChange={(e) => setSettings({...settings, longitude: e.target.value})} 
                          className={`w-full pl-10 p-2.5 ${!settings.requireAccurateLocation ? 'bg-gray-100' : 'bg-white'} border border-gray-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none`} 
                          placeholder="0.0000" 
                          disabled={!settings.requireAccurateLocation}
                        />
                      </div>
                    </div>
                    {!settings.requireAccurateLocation && (
                      <p className="text-xs text-gray-500 mt-2 italic">
                        Coordinates are not required when location enforcement is disabled.
                      </p>
                    )}
                 </div>
                 <button onClick={handleSaveGlobalSettings} disabled={loading} className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-black transition shadow-sm flex justify-center items-center gap-2">{loading ? "Saving..." : <><FaSave /> Save Configuration</>}</button>
             </div>
          </div>
        </div>

        {/* Employee Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col min-h-[600px]">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="bg-purple-100 p-3 rounded-xl text-purple-600"><FaUsers size={20} /></div>
                    <div><h2 className="text-xl font-bold text-gray-800">Work Mode Management</h2><p className="text-sm text-gray-500">Manage individual exceptions and categories.</p></div>
                </div>
                <div className="flex flex-wrap gap-3">
                    {/* NEW BUTTON FOR REQUESTS WITH BADGE */}
<button
  onClick={() => setShowRequestsModal(true)}
  className="relative bg-blue-600 text-white border border-blue-600 px-3 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-blue-700 transition text-sm shadow-md"
>
  <FaEnvelopeOpenText />
  <span>Requests</span>

  {pendingCount > 0 && (
    <>
      {/* Ping animation */}
      <span className="absolute -top-2 -right-2 inline-flex h-5 w-5 rounded-full bg-red-500 opacity-75 animate-ping"></span>

      {/* Actual count */}
      <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white">
        {pendingCount > 9 ? "9+" : pendingCount}
      </span>
    </>
  )}
</button>

                    <button onClick={() => setShowExceptionsModal(true)} className="bg-orange-50 text-orange-600 border border-orange-200 px-3 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-orange-100 transition text-sm"><FaListAlt /> View Exceptions</button>
                    <button onClick={() => setShowCategoryModal(true)} className="bg-blue-600 text-white px-3 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-blue-700 shadow-sm transition transform active:scale-95 text-sm"><FaPlus /> Create Category</button>
                    <button onClick={handleResetAll} className="bg-white text-red-500 border border-red-100 px-3 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-red-50 hover:border-red-200 transition text-sm"><FaUndo /> Reset All</button>
                </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">{["All", "Uncategorized", ...categories].map((cat) => (<button key={cat} onClick={() => setActiveCategory(cat)} className={`whitespace-nowrap px-4 py-2 rounded-full font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${activeCategory === cat ? "bg-gray-900 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{cat}<span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeCategory === cat ? "bg-white/20 text-white" : "bg-white text-gray-500"}`}>{getCategoryCount(cat)}</span></button>))}</div>
          </div>

          <div className="p-4 bg-gray-50/50 flex flex-col md:flex-row gap-4 items-center justify-between border-b border-gray-100">
            <div className="relative w-full md:w-80"><FaSearch className="absolute top-3 left-3 text-gray-400" size={14} /><input type="text" placeholder="Search employees..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none shadow-sm transition" /></div>
            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                {activeCategory !== "All" && activeCategory !== "Uncategorized" && (<button onClick={() => setShowAddMemberModal(true)} className="text-blue-600 hover:text-blue-700 font-semibold text-sm flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 transition"><FaUserPlus size={14} /> Add Members</button>)}
                {activeCategory !== "All" && activeCategory !== "Uncategorized" && (<button onClick={handleDeleteCategory} className="text-red-500 hover:text-red-700 font-semibold text-sm flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg border border-red-100 transition"><FaTrash size={14} /> Delete '{activeCategory}'</button>)}
                <div className="flex items-center gap-4 pl-4 border-l border-gray-200"><label className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold text-gray-600 hover:text-gray-900"><input type="checkbox" checked={displayEmployees.length > 0 && displayEmployees.every(e => selectedEmployees.includes(e.employeeId))} onChange={() => toggleSelectAll(displayEmployees)} className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500" /> Select All</label>{selectedEmployees.length > 0 && (<button onClick={() => setShowBulkModal(true)} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-black shadow-lg animate-fade-in flex items-center gap-2"><FaCheckSquare /> Update ({selectedEmployees.length})</button>)}</div>
            </div>
          </div>

          <div className="flex-1 bg-white p-6 min-h-[400px]">
             {loadingEmployees ? (<div className="flex flex-col items-center justify-center h-64 text-gray-400"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4"></div><p className="text-sm">Loading profiles...</p></div>) : displayEmployees.length === 0 ? (<div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50"><FaUsers size={32} className="mb-3 opacity-20" /><p className="text-sm">No employees found in this category.</p></div>) : (
                 <div className="grid grid-cols-1 gap-3">
                     {displayEmployees.map(employee => (
                         <div key={employee.employeeId} className={`group bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center gap-4 ${selectedEmployees.includes(employee.employeeId) ? "ring-1 ring-purple-500 bg-purple-50/5" : ""}`}>
                             <div className="flex items-center gap-4 flex-1 w-full"><input type="checkbox" checked={selectedEmployees.includes(employee.employeeId)} onChange={() => toggleSelection(employee.employeeId)} className="w-4 h-4 text-purple-600 rounded cursor-pointer focus:ring-purple-500" /><div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 text-purple-700 font-bold text-xs">{employee.name.charAt(0)}</div><div className="min-w-0"><h4 className="font-bold text-gray-800 text-sm truncate">{employee.name}</h4><p className="text-[11px] text-gray-500 truncate">{employee.employeeId} • {employee.department} {employee.category !== 'Uncategorized' && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded ml-1">{employee.category}</span>}</p></div></div>
                             <div className="flex items-center gap-3 w-full md:w-auto justify-end">{activeCategory !== "All" && activeCategory !== "Uncategorized" && (<button onClick={() => handleRemoveFromCategory(employee)} className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition tooltip-container" title="Remove from Category"><FaUserMinus /></button>)}<div className="flex items-center gap-3 pl-3 border-l border-gray-100">{renderStatusBadge(employee)}<button onClick={() => handleOpenScheduleModal(employee)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition" title="Manage Schedule"><FaEdit size={16} /></button></div></div>
                         </div>
                     ))}
                 </div>
             )}
          </div>
        </div>
      </div>

      {/* Map Modal */}
      {showMap && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4 animate-fade-in"><div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden"><div className="bg-gray-100 px-6 py-4 flex justify-between items-center border-b"><h3 className="font-bold text-lg text-gray-800 flex items-center gap-2"><FaMapMarkerAlt className="text-red-500"/> Select Office Location</h3><button onClick={() => setShowMap(false)} className="text-gray-500 hover:text-gray-800 transition"><FaTimes size={20}/></button></div><div className="p-4 bg-white border-b flex gap-2"><input type="text" placeholder="Search place (e.g., Hyderabad, Office Name)" className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleMapSearch()} /><button onClick={handleMapSearch} disabled={searchingMap} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2">{searchingMap ? "Searching..." : <><FaSearch /> Search</>}</button></div><div className="flex-1 relative bg-gray-200"><MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><RecenterMap center={mapCenter} /><LocationMarker position={selectedCoords} setPosition={setSelectedCoords} /></MapContainer><div className="absolute bottom-4 left-4 right-4 bg-white p-3 rounded-lg shadow-lg z-[1000] text-sm flex justify-between items-center gap-3 border border-gray-200"><div><span className="font-bold text-gray-700">Selected: </span> {selectedCoords ? `${selectedCoords[0].toFixed(5)}, ${selectedCoords[1].toFixed(5)}` : "None (Click map to select)"}</div></div></div><div className="p-4 bg-gray-50 border-t flex justify-end gap-3"><button onClick={() => setShowMap(false)} className="px-5 py-2 text-gray-600 font-semibold hover:bg-gray-200 rounded-lg transition">Cancel</button><button onClick={confirmLocation} className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-lg flex items-center gap-2 transition transform active:scale-95"><FaCheck /> Confirm Location</button></div></div></div>)}

      {/* Modals */}
      <BulkModeModal isOpen={showBulkModal} onClose={() => setShowBulkModal(false)} onSave={handleBulkUpdate} selectedCount={selectedEmployees.length} />
      <CategoryModal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} onSave={handleSaveCategory} allEmployees={employees} />
      <ExceptionsModal isOpen={showExceptionsModal} onClose={() => setShowExceptionsModal(false)} employees={employees} />
      <AddMemberModal isOpen={showAddMemberModal} onClose={() => setShowAddMemberModal(false)} onAdd={handleAddMembersToCategory} allEmployees={employees} activeCategory={activeCategory} />
      <ScheduleModal isOpen={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} employee={editingEmployee} onSave={handleSaveSchedule} />
      <PendingRequestsModal isOpen={showRequestsModal} onClose={() => setShowRequestsModal(false)} onRequestAction={() => {}} onRefresh={handleRefreshData} />
    </div>
  );
};

export default AdminLocationSettings;
// [file content end]