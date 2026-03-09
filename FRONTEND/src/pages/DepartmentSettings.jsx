import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import {
  FaClock,
  FaUserTie,
  FaSave,
  FaSearch,
  FaEdit,
  FaTrash,
  FaCheckCircle,
  FaTimesCircle,
  FaUsers,
  FaTag,
  FaInfoCircle,
  FaLayerGroup,
  FaPlus,
  FaTimes,
  FaCheck,
  FaExclamationCircle,
  FaUsersCog
} from "react-icons/fa";
import {
  getEmployees,
  getAllShifts,
  createOrUpdateShift,
  deleteShift,
  bulkCreateShifts,
  // ✅ Imported Notice APIs for Group Persistence
  getAllNoticesForAdmin,
  addNotice,
  updateNotice
} from "../api";

const DepartmentSettings = () => {
  const { user } = useContext(AuthContext);

  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [viewMode, setViewMode] = useState("individual"); // "individual" | "bulk"

  // -------------------------------------------------------------------------
  // ✅ GROUP MANAGEMENT STATE (Server Synced)
  // -------------------------------------------------------------------------
  const [groups, setGroups] = useState([]);
  const [groupConfigId, setGroupConfigId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState("all");
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  // Group Form State
  const [groupForm, setGroupForm] = useState({ name: "", members: [] });
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [viewUnassigned, setViewUnassigned] = useState(false);

  // Default Form State 
  const defaultShift = {
    shiftStartTime: "09:00",
    shiftEndTime: "18:00",
    lateGracePeriod: 15,
    fullDayHours: 9,
    halfDayHours: 4.5,
    autoExtendShift: true,
    weeklyOffDays: [0], // Sunday
  };

  const [shiftForm, setShiftForm] = useState(defaultShift);
  const [bulkShiftForm, setBulkShiftForm] = useState(defaultShift);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

  // ---------------- Fetch Data ----------------
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [employeesData, shiftsData, noticesData] = await Promise.all([
        getEmployees(),
        getAllShifts(),
        getAllNoticesForAdmin() // Fetch notices to get groups
      ]);

      const empList = Array.isArray(employeesData) ? employeesData : (employeesData?.data || []);
      const shiftList = Array.isArray(shiftsData) ? shiftsData : (shiftsData?.data || []);
      
      // ✅ FILTER ONLY ACTIVE EMPLOYEES (isActive === true)
      const activeEmployees = empList.filter(emp => emp.isActive === true);

      setEmployees(activeEmployees);
      setShifts(shiftList);

      // ✅ EXTRACT GROUPS
      if (Array.isArray(noticesData)) {
        const configNotice = noticesData.find(n => n.title === "__SYSTEM_GROUPS_CONFIG__");
        if (configNotice) {
          setGroupConfigId(configNotice._id);
          try {
            const parsedGroups = JSON.parse(configNotice.description);
            if (Array.isArray(parsedGroups)) setGroups(parsedGroups);
          } catch (e) { console.error("Error parsing groups", e); }
        }
      }

    } catch (error) {
      console.error("Fetch error:", error);
      showMessage("error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Group Logic (Server Sync) ----------------
  const saveGroupsToBackend = async (updatedGroups) => {
    try {
      const payload = {
        title: "__SYSTEM_GROUPS_CONFIG__",
        description: JSON.stringify(updatedGroups),
        recipients: []
      };
      if (groupConfigId) {
        await updateNotice(groupConfigId, payload);
      } else {
        const res = await addNotice(payload);
        // If created new, update config ID if response returns it, or re-fetch
        if(res && res._id) setGroupConfigId(res._id); 
      }
      setGroups(updatedGroups);
    } catch (error) {
      console.error("Failed to save groups", error);
      showMessage("error", "Could not save groups to server");
    }
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) { showMessage("error", "Group name required"); return; }
    if (groupForm.members.length === 0) { showMessage("error", "Select members"); return; }

    let updatedGroups;
    if (editingGroupId) {
      updatedGroups = groups.map(g =>
        g.id === editingGroupId ? { ...g, name: groupForm.name, members: groupForm.members } : g
      );
    } else {
      const newGroup = {
        id: Date.now().toString(),
        name: groupForm.name,
        members: groupForm.members
      };
      updatedGroups = [...groups, newGroup];
    }
    await saveGroupsToBackend(updatedGroups);
    resetGroupForm();
    showMessage("success", "Group saved successfully");
  };

  const handleEditGroup = (group) => {
    setEditingGroupId(group.id);
    setGroupForm({ name: group.name, members: group.members });
    setViewUnassigned(false);
  };

  const handleDeleteGroup = (groupId) => {
    if (window.confirm("Delete this group?")) {
      const updatedGroups = groups.filter(g => g.id !== groupId);
      saveGroupsToBackend(updatedGroups);
      if (editingGroupId === groupId) resetGroupForm();
      if (selectedGroupId === groupId) setSelectedGroupId("all");
    }
  };

  const resetGroupForm = () => {
    setGroupForm({ name: "", members: [] });
    setEditingGroupId(null);
    setGroupSearchTerm("");
    setViewUnassigned(false);
  };

  const toggleGroupMemberSelection = (employeeId) => {
    setGroupForm(prev => {
      const isSelected = prev.members.includes(employeeId);
      if (isSelected) {
        return { ...prev, members: prev.members.filter(id => id !== employeeId) };
      } else {
        return { ...prev, members: [...prev.members, employeeId] };
      }
    });
  };

  const getUnassignedEmployees = () => {
    const assignedIds = new Set();
    groups.forEach(g => {
      if (Array.isArray(g.members)) {
        g.members.forEach(m => assignedIds.add(String(m)));
      }
    });
    // Match against employee._id because groups store _id
    return employees.filter(e => !assignedIds.has(String(e._id)));
  };

  // ---------------- Helpers ----------------
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);

    const existingShift = shifts.find(
      (s) => s.employeeId === employee.employeeId
    );

    if (existingShift) {
      setShiftForm({
        shiftStartTime: existingShift.shiftStartTime || "09:00",
        shiftEndTime: existingShift.shiftEndTime || "18:00",
        lateGracePeriod: existingShift.lateGracePeriod ?? 15,
        fullDayHours: existingShift.fullDayHours || 9,
        halfDayHours: existingShift.halfDayHours || 4.5,
        autoExtendShift: existingShift.autoExtendShift ?? true,
        weeklyOffDays: existingShift.weeklyOffDays || [0],
      });
    } else {
      setShiftForm(defaultShift);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setShiftForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleBulkFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBulkShiftForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleWeeklyOffToggle = (day, isBulk = false) => {
    const setter = isBulk ? setBulkShiftForm : setShiftForm;
    setter((prev) => {
      const current = prev.weeklyOffDays || [];
      if (current.includes(day)) {
        return { ...prev, weeklyOffDays: current.filter((d) => d !== day) };
      } else {
        return { ...prev, weeklyOffDays: [...current, day] };
      }
    });
  };

  const handleBulkEmployeeToggle = (employeeId) => {
    setSelectedEmployeeIds((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  const handleSelectAllEmployees = () => {
    if (selectedEmployeeIds.length === filteredEmployees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployees.map((emp) => emp.employeeId));
    }
  };

  // ---------------- Save Logic ----------------
  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) {
      showMessage("error", "Please select an employee first");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        employeeId: selectedEmployee.employeeId,
        shiftStartTime: shiftForm.shiftStartTime,
        shiftEndTime: shiftForm.shiftEndTime,
        lateGracePeriod: Number(shiftForm.lateGracePeriod),
        fullDayHours: Number(shiftForm.fullDayHours),
        halfDayHours: Number(shiftForm.halfDayHours),
        autoExtendShift: shiftForm.autoExtendShift,
        weeklyOffDays: shiftForm.weeklyOffDays,
      };
      await createOrUpdateShift(payload);
      showMessage("success", `Shift saved for ${selectedEmployee.name}`);
      await fetchData();
    } catch (error) {
      console.error("Save shift error:", error);
      showMessage("error", error.response?.data?.message || "Failed to save shift");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSaveShift = async (e) => {
    e.preventDefault();
    if (selectedEmployeeIds.length === 0) {
      showMessage("error", "Please select at least one employee");
      return;
    }
    setSaving(true);
    try {
      const shiftData = {
        shiftStartTime: bulkShiftForm.shiftStartTime,
        shiftEndTime: bulkShiftForm.shiftEndTime,
        lateGracePeriod: Number(bulkShiftForm.lateGracePeriod),
        fullDayHours: Number(bulkShiftForm.fullDayHours),
        halfDayHours: Number(bulkShiftForm.halfDayHours),
        autoExtendShift: bulkShiftForm.autoExtendShift,
        weeklyOffDays: bulkShiftForm.weeklyOffDays,
      };
      await bulkCreateShifts(selectedEmployeeIds, shiftData);
      showMessage("success", `Updated ${selectedEmployeeIds.length} employees`);
      setSelectedEmployeeIds([]);
      await fetchData();
    } catch (error) {
      console.error("Bulk save error:", error);
      showMessage("error", error.response?.data?.message || "Failed to save shifts");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (employeeId) => {
    if (!window.confirm("Reset shift to default?")) return;
    try {
      await deleteShift(employeeId);
      showMessage("success", "Shift reset successfully");
      await fetchData();
      if (selectedEmployee?.employeeId === employeeId) {
        setShiftForm(defaultShift);
      }
    } catch (error) {
      showMessage("error", "Failed to delete shift");
    }
  };

  // ---------------- Filtering ----------------
  const baseFilteredEmployees = employees.filter((emp) => {
    const q = searchTerm.toLowerCase();
    return (
      emp.name?.toLowerCase().includes(q) ||
      emp.employeeId?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q)
    );
  });

  // ✅ Updated Filter Logic using Groups
  const filteredEmployees = baseFilteredEmployees.filter((emp) => {
    if (selectedGroupId === "all") return true;
    if (selectedGroupId === "unassigned") {
      // Check if employee._id is NOT in any group
      const allGroupMembers = new Set(groups.flatMap(g => g.members));
      return !allGroupMembers.has(String(emp._id));
    }
    const group = groups.find(g => g.id === selectedGroupId);
    // Check if employee._id is in the selected group
    return group ? group.members.includes(String(emp._id)) : false;
  });

  const weekDays = [
    { value: 0, label: "Sun" }, { value: 1, label: "Mon" }, { value: 2, label: "Tue" },
    { value: 3, label: "Wed" }, { value: 4, label: "Thu" }, { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto font-sans">
      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <span className="p-2 bg-blue-100 rounded-lg text-blue-600"><FaClock /></span>
            Shift Management
          </h1>
          <div className="flex items-center gap-2 mt-1">
             <p className="text-gray-600 text-sm">Configure timings in Indian Standard Time (IST)</p>
             <span className="bg-orange-100 text-orange-800 text-[10px] px-2 py-0.5 rounded-full font-bold border border-orange-200">
               🇮🇳 IST Active
             </span>
          </div>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button onClick={() => setViewMode("individual")} className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 ${viewMode === "individual" ? "bg-white shadow text-blue-700" : "text-gray-600"}`}><FaUserTie /> Individual</button>
          <button onClick={() => setViewMode("bulk")} className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 ${viewMode === "bulk" ? "bg-white shadow text-blue-700" : "text-gray-600"}`}><FaUsers /> Bulk</button>
        </div>
      </div>

      {/* ALERTS */}
      {message.text && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {message.type === "success" ? <FaCheckCircle /> : <FaTimesCircle />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* ✅ GROUP FILTER (Replaces Category Filter) */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 text-sm flex gap-2 items-center"><FaLayerGroup className="text-blue-500"/> Filter by Group</h3>
          <button onClick={() => setIsGroupModalOpen(true)} className="flex items-center gap-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"><FaUsersCog /> Manage Groups</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSelectedGroupId("all")} className={`px-3 py-1 rounded-full text-xs font-semibold border ${selectedGroupId === "all" ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}>All</button>
          <button onClick={() => setSelectedGroupId("unassigned")} className={`px-3 py-1 rounded-full text-xs font-semibold border ${selectedGroupId === "unassigned" ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}>Unassigned</button>
          {groups.map((group) => (
            <button 
              key={group.id} 
              onClick={() => setSelectedGroupId(group.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${selectedGroupId === group.id ? "bg-indigo-600 text-white" : "bg-white text-gray-600"}`}
            >
              {group.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: EMPLOYEE LIST */}
        <div className="lg:col-span-5 flex flex-col h-[600px] bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
              <input type="text" placeholder="Search employees..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex justify-between items-center mt-2">
               <p className="text-xs text-gray-500">Showing {filteredEmployees.length} employees</p>
               {viewMode === "bulk" && (
                 <button onClick={handleSelectAllEmployees} className="text-xs text-blue-600 font-bold hover:underline">
                   {selectedEmployeeIds.length === filteredEmployees.length && filteredEmployees.length > 0 ? "Deselect All" : "Select All"}
                 </button>
               )}
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {filteredEmployees.map((emp) => (
              <div 
                key={emp.employeeId} 
                onClick={() => viewMode === "bulk" ? handleBulkEmployeeToggle(emp.employeeId) : handleEmployeeSelect(emp)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  (viewMode === "individual" && selectedEmployee?.employeeId === emp.employeeId) || (viewMode === "bulk" && selectedEmployeeIds.includes(emp.employeeId))
                    ? "bg-blue-50 border-blue-500" 
                    : "bg-white border-gray-100 hover:bg-gray-50"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {viewMode === "bulk" && <input type="checkbox" checked={selectedEmployeeIds.includes(emp.employeeId)} readOnly className="w-4 h-4 text-blue-600 rounded" />}
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{emp.name}</p>
                      <p className="text-xs text-gray-500">{emp.employeeId} </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filteredEmployees.length === 0 && <div className="text-center text-gray-400 text-sm mt-10">No employees found.</div>}
          </div>
        </div>

        {/* RIGHT COLUMN: FORM */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          {viewMode === "individual" ? (
            selectedEmployee ? (
              <form onSubmit={handleSaveShift} className="h-full flex flex-col">
                <div className="mb-4 pb-4 border-b border-gray-100">
                  <h2 className="text-xl font-bold text-gray-800">Edit Shift (IST)</h2>
                  <p className="text-sm text-gray-600">For <span className="font-semibold text-blue-600">{selectedEmployee.name}</span> ({selectedEmployee.employeeId})</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">Start Time (IST)</label>
                    <input type="time" name="shiftStartTime" value={shiftForm.shiftStartTime} onChange={handleFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">End Time (IST)</label>
                    <input type="time" name="shiftEndTime" value={shiftForm.shiftEndTime} onChange={handleFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">Full Day Work Hours</label>
                    <input type="number" step="0.5" name="fullDayHours" value={shiftForm.fullDayHours} onChange={handleFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">Half Day Work Hours</label>
                    <input type="number" step="0.5" name="halfDayHours" value={shiftForm.halfDayHours} onChange={handleFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">Grace (Mins)</label>
                    <input type="number" name="lateGracePeriod" value={shiftForm.lateGracePeriod} onChange={handleFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>
                  <div>
                     <label className="flex items-center gap-2 text-sm mt-6 cursor-pointer">
                        <input type="checkbox" name="autoExtendShift" checked={shiftForm.autoExtendShift} onChange={handleFormChange} className="w-4 h-4 text-blue-600"/>
                        Auto-extend shift if late
                     </label>
                  </div>
                </div>
                
                <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded flex items-center gap-2">
                   <FaInfoCircle className="text-blue-500" />
                   Timings entered here are treated as Indian Standard Time by the server. Work hours are manual.
                </div>

                <div className="mt-4">
                  <label className="text-xs font-bold text-gray-700 uppercase block mb-2">Weekly Offs</label>
                  <div className="flex flex-wrap gap-2">
                    {weekDays.map((d) => (
                      <button key={d.value} type="button" onClick={() => handleWeeklyOffToggle(d.value)} className={`px-3 py-1 rounded text-xs font-bold ${shiftForm.weeklyOffDays.includes(d.value) ? "bg-red-500 text-white" : "bg-gray-200 text-gray-600"}`}>{d.label}</button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 flex justify-center items-center gap-2">
                    {saving ? "Saving..." : <><FaSave /> Save Shift</>}
                  </button>
                  {shifts.some(s => s.employeeId === selectedEmployee.employeeId) && (
                    <button type="button" onClick={() => handleDeleteShift(selectedEmployee.employeeId)} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200"><FaTrash /></button>
                  )}
                </div>
              </form>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <FaUserTie className="text-5xl mb-3 opacity-20" />
                <p>Select an employee to configure shift</p>
              </div>
            )
          ) : (
            <form onSubmit={handleBulkSaveShift} className="h-full flex flex-col">
              <div className="mb-4 pb-4 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">Bulk Shift Update (IST)</h2>
                <p className="text-sm text-gray-600">Applying to <span className="font-bold text-blue-600">{selectedEmployeeIds.length}</span> employees</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">Start Time (IST)</label>
                    <input type="time" name="shiftStartTime" value={bulkShiftForm.shiftStartTime} onChange={handleBulkFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">End Time (IST)</label>
                    <input type="time" name="shiftEndTime" value={bulkShiftForm.shiftEndTime} onChange={handleBulkFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">Full Day Work Hours</label>
                    <input type="number" step="0.5" name="fullDayHours" value={bulkShiftForm.fullDayHours} onChange={handleBulkFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">Half Day Work Hours</label>
                    <input type="number" step="0.5" name="halfDayHours" value={bulkShiftForm.halfDayHours} onChange={handleBulkFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">Grace (Mins)</label>
                    <input type="number" name="lateGracePeriod" value={bulkShiftForm.lateGracePeriod} onChange={handleBulkFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>
              </div>
              
              <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded flex items-center gap-2">
                   <FaInfoCircle className="text-blue-500" />
                   Timings entered here are treated as Indian Standard Time by the server. Work hours are manual.
              </div>

              <div className="mt-4">
                  <label className="text-xs font-bold text-gray-700 uppercase block mb-2">Weekly Offs</label>
                  <div className="flex flex-wrap gap-2">
                    {weekDays.map((d) => (
                      <button key={d.value} type="button" onClick={() => handleWeeklyOffToggle(d.value, true)} className={`px-3 py-1 rounded text-xs font-bold ${bulkShiftForm.weeklyOffDays.includes(d.value) ? "bg-red-500 text-white" : "bg-gray-200 text-gray-600"}`}>{d.label}</button>
                    ))}
                  </div>
              </div>
              
              <div className="mt-auto pt-6">
                <button type="submit" disabled={saving || selectedEmployeeIds.length === 0} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
                   {saving ? "Processing..." : `Apply to ${selectedEmployeeIds.length} Employees`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ✅ MANAGE GROUPS MODAL */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-[95%] md:w-full max-w-4xl h-[90vh] md:h-[80vh] flex flex-col md:flex-row overflow-hidden">
            {/* Left Panel: List */}
            <div className="w-full md:w-1/3 h-[35%] md:h-full bg-slate-50 border-r border-slate-200 flex flex-col border-b md:border-b-0">
              <div className="p-5 border-b border-slate-200 bg-white"><h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><FaLayerGroup className="text-blue-600" /> My Groups</h3></div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {groups.length === 0 && (<div className="text-center py-10 text-slate-400"><p>No groups created yet.</p></div>)}
                {groups.map(group => (
                  <div
                    key={group.id}
                    onClick={() => handleEditGroup(group)}
                    className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center group cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
                  >
                    <div className="min-w-0 flex-1"><h4 className="font-bold text-slate-700 truncate">{group.name}</h4><p className="text-xs text-slate-500">{group.members.length} members</p></div>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><FaTrash /></button>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-slate-100 border-t border-slate-200"><div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">System</div><div onClick={() => { setViewUnassigned(true); resetGroupForm(); }} className={`bg-white p-3 rounded-lg border shadow-sm cursor-pointer transition-all ${viewUnassigned ? 'border-orange-400 ring-1 ring-orange-400' : 'border-slate-200 hover:border-orange-300'}`}><div className="flex justify-between items-center"><h4 className={`font-bold text-sm ${viewUnassigned ? 'text-orange-700' : 'text-slate-600'}`}>Unassigned Employees</h4><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${viewUnassigned ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-600'}`}>{getUnassignedEmployees().length}</span></div></div></div>
            </div>
            
            {/* Right Panel: Form */}
            <div className="w-full md:w-2/3 h-[65%] md:h-full flex flex-col bg-white">
              {viewUnassigned ? (
                <><div className="p-5 border-b border-slate-100 flex justify-between items-center bg-orange-50/50"><div><h3 className="font-bold text-xl text-orange-800 flex items-center gap-2"><FaExclamationCircle /> Unassigned Employees</h3></div><button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100"><FaTimes size={20} /></button></div><div className="p-6 flex-1 overflow-y-auto"><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{getUnassignedEmployees().length === 0 ? (<div className="col-span-2 text-center py-12 text-slate-400"><FaCheck className="mx-auto mb-2 text-green-400" size={24} /><p>All employees assigned!</p></div>) : (getUnassignedEmployees().map(emp => (<div key={emp._id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50"><div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">{emp.name.charAt(0)}</div><div className="min-w-0"><p className="text-sm font-bold text-slate-700 truncate">{emp.name}</p><p className="text-xs text-slate-500">{emp.employeeId}</p></div></div>)))}</div></div></>
              ) : (
                <><div className="p-5 border-b border-slate-100 flex justify-between items-center"><div><h3 className="font-bold text-xl text-slate-800">{editingGroupId ? 'Edit Group' : 'Create New Group'}</h3></div><button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100"><FaTimes size={20} /></button></div><div className="p-6 flex-1 overflow-y-auto"><div className="mb-6"><label className="block text-sm font-bold text-slate-700 mb-2">Group Name</label><input type="text" placeholder="e.g. Marketing Team" value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" /></div><div className="mb-3 flex justify-between items-end"><label className="block text-sm font-bold text-slate-700">Select Members ({groupForm.members.length})</label><input type="text" placeholder="Search..." value={groupSearchTerm} onChange={e => setGroupSearchTerm(e.target.value)} className="text-sm border border-slate-300 rounded-md px-3 py-1.5 focus:border-blue-500 outline-none" /></div><div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto bg-slate-50/50">{employees.filter(e => e.name.toLowerCase().includes(groupSearchTerm.toLowerCase())).map(emp => { const isSelected = groupForm.members.includes(emp._id); return (<div key={emp._id} onClick={() => toggleGroupMemberSelection(emp._id)} className={`flex items-center gap-3 p-3 border-b border-slate-100 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-white'}`}><div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>{isSelected && <FaCheck className="text-white text-xs" />}</div><div><p className={`text-sm font-semibold ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>{emp.name}</p><p className="text-xs text-slate-500">{emp.employeeId}</p></div></div>) })}</div></div><div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">{editingGroupId && (<button onClick={resetGroupForm} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg">Cancel Edit</button>)}<button onClick={handleSaveGroup} className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md flex items-center gap-2">{editingGroupId ? <FaSave /> : <FaPlus size={12} />} {editingGroupId ? 'Update' : 'Create'}</button></div></>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentSettings;