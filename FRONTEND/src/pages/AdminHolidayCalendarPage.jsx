import React, { useState, useEffect, useCallback, useRef } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import * as XLSX from "xlsx"; 
import Swal from "sweetalert2"; 
// ✅ IMPORTS UPDATED: Added updateHoliday
import { getHolidays, addHoliday, updateHoliday, deleteHolidayById, getEmployees } from "../api";
// ✅ ICONS UPDATED: Added FaEdit
import { 
  FaChevronLeft, 
  FaChevronRight, 
  FaFileImport,
  FaPlus,
  FaTimes,
  FaTrash,
  FaEdit, 
  FaCalendarAlt,
  FaBirthdayCake,
} from "react-icons/fa";

const AdminHolidayCalendarPage = () => {
  // --- Form State ---
  const [holidayData, setHolidayData] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
  });

  const [holidays, setHolidays] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [activeDate, setActiveDate] = useState(new Date()); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // ✅ NEW: Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  // Cursors for month view
  const [birthdayCursor, setBirthdayCursor] = useState(new Date());
  const [holidayCursor, setHolidayCursor] = useState(new Date());

  // Toggles for "Show All"
  const [showAllHolidays, setShowAllHolidays] = useState(false);
  const [showAllBirthdays, setShowAllBirthdays] = useState(false);

  // Year Filter State
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const fileInputRef = useRef(null);

  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // ✅ HELPER: Formats date safely for input fields (YYYY-MM-DD)
  const formatDateForInput = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0];
  };

  /* =========================================================
      FETCH DATA
  ==========================================================*/
  const fetchHolidays = useCallback(async () => {
    try {
      const response = await getHolidays();
      setHolidays(response);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchBirthdays = useCallback(async () => {
    try {
      const allEmployees = await getEmployees();
      const result = allEmployees
        .filter((emp) => emp.personalDetails?.dob)
        .map((emp) => ({
          name: emp.name,
          dob: new Date(emp.personalDetails.dob),
        }));
      setBirthdays(result);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchHolidays(); fetchBirthdays(); }, [fetchHolidays, fetchBirthdays]);

  const handleChange = (e) => setHolidayData({ ...holidayData, [e.target.name]: e.target.value });

  /* =========================================================
      HANDLERS
  ==========================================================*/

  const handleCloseModal = () => {
    setHolidayData({ name: "", description: "", startDate: "", endDate: "" });
    setIsEditing(false);
    setEditId(null);
    setIsModalOpen(false);
  };

  // ✅ NEW: Handle Edit Click
  const handleEdit = (holiday) => {
    setHolidayData({
      name: holiday.name,
      description: holiday.description,
      startDate: formatDateForInput(holiday.startDate),
      endDate: formatDateForInput(holiday.endDate)
    });
    setEditId(holiday._id);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => { 
    e.preventDefault();
    setLoading(true);
    try {
      // Ensure End Date is set
      const payload = { ...holidayData, endDate: holidayData.endDate || holidayData.startDate };

      if (isEditing) {
        // ✅ UPDATE EXISTING
        await updateHoliday(editId, payload);
        Swal.fire('Success', 'Holiday updated successfully', 'success');
      } else {
        // ✅ ADD NEW
        await addHoliday(payload);
        Swal.fire('Success', 'Holiday added successfully', 'success');
      }

      fetchHolidays();
      handleCloseModal();
    } catch (error) {
      console.error(error);
      Swal.fire('Error', 'Operation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        await deleteHolidayById(id);
        fetchHolidays();
        Swal.fire('Deleted!', 'Holiday has been deleted.', 'success');
      }
    });
  };

  const findKey = (obj, searchStr) => Object.keys(obj).find(key => key.toLowerCase().replace(/[^a-z]/g, '').includes(searchStr.toLowerCase()));

  const parseImportDate = (val) => {
     if (!val) return null;
     if (typeof val === 'number') return new Date(Math.round((val - 25569) * 86400 * 1000));
     if (typeof val === 'string') {
       const match = val.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
       if (match) return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
       const stdDate = new Date(val);
       return isNaN(stdDate.getTime()) ? null : stdDate;
     }
     return null;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        let addedCount = 0;
        const promises = [];
        for (const row of data) {
          const nameKey = findKey(row, "name") || findKey(row, "holiday");
          const descKey = findKey(row, "desc") || findKey(row, "description") || findKey(row, "detail");
          const startKey = findKey(row, "start") || findKey(row, "date");
          if (!startKey) continue;
          const startDate = parseImportDate(row[startKey]);
          if (!startDate || isNaN(startDate.getTime())) continue;
          const toLocalISO = (d) => {
            const offset = d.getTimezoneOffset() * 60000;
            return new Date(d.getTime() - offset).toISOString().split('T')[0];
          };
          const exists = holidays.some(h => normalizeDate(h.startDate).getTime() === normalizeDate(startDate).getTime());
          if (!exists) {
            promises.push(addHoliday({
              name: nameKey ? row[nameKey] : "Holiday",
              description: descKey ? row[descKey] : "",
              startDate: toLocalISO(startDate),
              endDate: toLocalISO(startDate)
            }));
            addedCount++;
          }
        }
        await Promise.all(promises);
        if (addedCount > 0) {
          Swal.fire('Success', `Imported ${addedCount} holidays!`, 'success');
          fetchHolidays();
          handleCloseModal();
        } else {
          Swal.fire('Info', 'No new holidays found.', 'info');
        }
      } catch (error) {
        console.error("Import Error", error);
        Swal.fire("Error", "Failed to parse file.", "error");
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const changeMonth = (setter) => (increment) => {
    setter((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + increment);
      return newDate;
    });
  };

  // --- FILTERING LOGIC ---
  const displayedBirthdays = showAllBirthdays 
    ? [...birthdays].sort((a, b) => a.dob.getMonth() - b.dob.getMonth() || a.dob.getDate() - b.dob.getDate())
    : birthdays.filter((b) => b.dob.getMonth() === birthdayCursor.getMonth()).sort((a, b) => a.dob.getDate() - b.dob.getDate());

  const availableYears = [...new Set([
    new Date().getFullYear(),
    ...holidays.map(h => new Date(h.startDate).getFullYear())
  ])].sort((a,b) => a - b);

  const displayedHolidays = showAllHolidays
    ? [...holidays]
        .filter(h => new Date(h.startDate).getFullYear() === parseInt(selectedYear))
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    : holidays
        .filter((h) => {
          const hDate = normalizeDate(h.startDate);
          return hDate.getMonth() === holidayCursor.getMonth() && hDate.getFullYear() === holidayCursor.getFullYear();
        })
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  /* =========================================================
      CALENDAR LOGIC
  ==========================================================*/
  const getTileDetails = (date) => {
    const current = normalizeDate(date);
    const holiday = holidays.find(h => {
      const s = normalizeDate(h.startDate);
      const e = normalizeDate(h.endDate);
      return current >= s && current <= e;
    });
    const birthday = birthdays.find(b => b.dob.getDate() === date.getDate() && b.dob.getMonth() === date.getMonth());
    return { holiday, birthday };
  };

  const tileClassName = ({ date, view }) => {
    if (view !== "month") return "";
    const { holiday, birthday } = getTileDetails(date);
    if (holiday) return "holiday-date-circle";
    if (birthday) return "birthday-date-circle";
    return "";
  };

  const tileContent = ({ date, view }) => {
    if (view !== "month") return null;
    const { holiday, birthday } = getTileDetails(date);
    if (!holiday && !birthday) return null;
    return (
      <div className="relative w-full h-full flex items-start justify-center group">
        <div className="absolute top-1 flex gap-1 items-center justify-center">
          {birthday && (<span className="text-sm animate-pulse">🎂</span>)}
        </div>
        <div className="custom-tooltip hidden group-hover:block">
          {holiday && (
            <div className="mb-2">
              <div className="font-bold text-green-300">🎉 {holiday.name}</div>
              {holiday.description && (
                <div className="text-[10px] text-gray-300 whitespace-normal leading-tight max-w-[150px] mt-1 border-t border-gray-600 pt-1">
                  {holiday.description}
                </div>
              )}
            </div>
          )}
          {birthday && (
            <div className="text-orange-300 font-bold">🎂 Birthday: {birthday.name}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Holiday Calendar</h1>
            <p className="text-slate-500 text-sm mt-1">Manage holidays & track birthdays</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-slate-800 transition">
            <FaPlus className="inline mr-2"/> Add New Holiday
          </button>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* --- LEFT SIDE: LISTS --- */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* HOLIDAYS CONTAINER */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-600 flex justify-between items-center text-white">
                <div className="flex items-center gap-2"><FaCalendarAlt /> <span className="font-bold">Holidays</span></div>
                
                <div className="flex items-center gap-2">
                  {showAllHolidays && (
                    <select 
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition text-white outline-none border-none cursor-pointer"
                    >
                      {availableYears.map(year => (
                        <option key={year} value={year} className="text-slate-800 bg-white">
                          {year}
                        </option>
                      ))}
                    </select>
                  )}
                  <button onClick={() => setShowAllHolidays(!showAllHolidays)} className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition">
                    {showAllHolidays ? "View Month" : "View All"}
                  </button>
                  {!showAllHolidays && (
                    <div className="flex items-center gap-1 bg-white/20 rounded-lg px-1">
                      <button onClick={() => changeMonth(setHolidayCursor)(-1)} className="p-1 hover:bg-white/20 rounded"><FaChevronLeft size={10}/></button>
                      <span className="text-xs font-mono w-16 text-center">{holidayCursor.toLocaleString('default',{month:'short', year:'2-digit'})}</span>
                      <button onClick={() => changeMonth(setHolidayCursor)(1)} className="p-1 hover:bg-white/20 rounded"><FaChevronRight size={10}/></button>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-3 min-h-[200px] max-h-[300px] overflow-y-auto custom-scrollbar">
                {displayedHolidays.length === 0 ? <p className="text-center text-gray-400 text-xs py-4">No holidays {showAllHolidays ? `in ${selectedYear}` : "this month"}</p> : 
                  displayedHolidays.map(h => (
                  <div key={h._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:shadow-md transition group">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center bg-white border border-emerald-100 shadow-sm w-10 h-10 rounded-lg text-emerald-600 font-bold leading-none">
                        <span className="text-sm">{new Date(h.startDate).getDate()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{h.name}</p>
                        <p className="text-[10px] text-slate-400">{new Date(h.startDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    {/* ✅ UPDATED BUTTONS: BIG & VISIBLE */}
                    <div className="flex gap-2">
                        <button 
                            onClick={() => handleEdit(h)} 
                            className="text-blue-500 hover:bg-blue-50 p-2 rounded-full transition-colors"
                            title="Edit"
                        >
                            <FaEdit size={16}/>
                        </button>
                        <button 
                            onClick={() => handleDelete(h._id)} 
                            className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                            title="Delete"
                        >
                            <FaTrash size={16}/>
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* BIRTHDAYS CONTAINER (Unchanged) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
               <div className="p-4 bg-gradient-to-r from-orange-400 to-pink-500 flex justify-between items-center text-white">
                <div className="flex items-center gap-2"><FaBirthdayCake /> <span className="font-bold">Birthdays</span></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowAllBirthdays(!showAllBirthdays)} className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition">
                    {showAllBirthdays ? "View Month" : "View All"}
                  </button>
                  {!showAllBirthdays && (
                    <div className="flex items-center gap-1 bg-white/20 rounded-lg px-1">
                      <button onClick={() => changeMonth(setBirthdayCursor)(-1)} className="p-1 hover:bg-white/20 rounded"><FaChevronLeft size={10}/></button>
                      <span className="text-xs font-mono w-16 text-center">{birthdayCursor.toLocaleString('default',{month:'short', year:'2-digit'})}</span>
                      <button onClick={() => changeMonth(setBirthdayCursor)(1)} className="p-1 hover:bg-white/20 rounded"><FaChevronRight size={10}/></button>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 space-y-3 min-h-[200px] max-h-[300px] overflow-y-auto custom-scrollbar">
                {displayedBirthdays.length === 0 ? <p className="text-center text-gray-400 text-xs py-4">No birthdays {showAllBirthdays ? "found" : "this month"}</p> :
                  displayedBirthdays.map((b, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 hover:bg-orange-50 rounded-lg transition">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 text-xs font-bold">
                      {b.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{b.name}</p>
                      <p className="text-[10px] text-slate-400">{b.dob.getDate()} {b.dob.toLocaleString('default',{month:'short'})}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* --- RIGHT SIDE: CALENDAR (Unchanged) --- */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 h-full relative">
              <Calendar
                tileClassName={tileClassName}
                tileContent={tileContent}
                onActiveStartDateChange={({ activeStartDate }) => setActiveDate(activeStartDate)}
                className="best-ui-calendar"
                next2Label={null}
                prev2Label={null}
                formatShortWeekday={(locale, date) => ['M', 'T', 'W', 'T', 'F', 'S', 'S'][date.getDay() === 0 ? 6 : date.getDay() - 1]}
              />
              <div className="flex justify-center gap-8 mt-10 pt-6 border-t border-slate-50">
                <div className="flex items-center gap-2">
                   <span className="px-3 py-1.5 rounded-lg text-white text-xs font-bold bg-gradient-to-r from-emerald-400 to-teal-500 shadow-md shadow-emerald-100 flex items-center gap-2">🎉 Holiday</span>
                </div>
                <div className="flex items-center gap-2">
                   <span className="px-3 py-1.5 rounded-lg text-white text-xs font-bold bg-gradient-to-r from-orange-400 to-pink-500 shadow-md shadow-rose-100 flex items-center gap-2">🎂 Birthday</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
              {/* Dynamic Title */}
              <h3 className="font-bold text-lg text-slate-800">
                {isEditing ? "Edit Holiday" : "Add Holiday"}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600"><FaTimes/></button>
            </div>
            
            <div className="p-6 space-y-6">
              
              {/* Hide Import functionality during Edit Mode */}
              {!isEditing && (
                <>
                  <div className="border border-dashed border-blue-300 bg-blue-50 rounded-xl p-4 flex flex-col items-center justify-center gap-2">
                    <p className="text-xs text-blue-600 font-medium">Bulk Import via Excel</p>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx,.csv" />
                    <button 
                      onClick={() => fileInputRef.current.click()}
                      disabled={loading}
                      className="bg-white text-blue-600 px-4 py-1.5 rounded-lg shadow-sm text-xs font-bold border border-blue-100 hover:bg-blue-100"
                    >
                      <FaFileImport className="inline mr-1"/> Choose File
                    </button>
                  </div>
                  <div className="relative text-center">
                    <span className="bg-white px-2 text-xs text-gray-400 relative z-10">OR MANUALLY</span>
                    <div className="absolute top-1/2 left-0 w-full border-t border-gray-100"></div>
                  </div>
                </>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <input 
                  name="name" 
                  value={holidayData.name} 
                  onChange={handleChange} 
                  placeholder="Holiday Name" 
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-800 outline-none" 
                  required 
                />
                <textarea 
                  name="description" 
                  value={holidayData.description} 
                  onChange={handleChange} 
                  placeholder="Description" 
                  rows="2" 
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-800 outline-none resize-none" 
                />
                <div className="flex gap-3">
                  <div className="w-1/2">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Start Date</label>
                    <input type="date" name="startDate" value={holidayData.startDate} onChange={handleChange} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none" required />
                  </div>
                  <div className="w-1/2">
                    <label className="text-[10px] uppercase font-bold text-gray-400">End Date</label>
                    <input type="date" name="endDate" value={holidayData.endDate} min={holidayData.startDate} onChange={handleChange} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none" />
                  </div>
                </div>
                {/* Dynamic Submit Button */}
                <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition shadow-lg">
                  {loading ? "Processing..." : (isEditing ? "Update Holiday" : "Add Holiday")}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- CSS (Unchanged) --- */}
      <style>{`
        .react-calendar { width: 100%; border: none; font-family: inherit; }
        .react-calendar__navigation { margin-bottom: 30px; display: flex; }
        .react-calendar__navigation__label { font-size: 1.5rem; font-weight: 800; color: #000000 !important; }
        .react-calendar__navigation button { min-width: 44px; background: none; font-size: 1.5rem; color: #000000 !important; }
        .react-calendar__navigation button:hover { color: #000000 !important; background: transparent;}
        .react-calendar__month-view__weekdays { text-align: center; font-size: 0.8rem; font-weight: 700; color: #94a3b8; margin-bottom: 20px; border-bottom: 1px solid #f8fafc; padding-bottom: 10px;}
        .react-calendar__month-view__weekdays__weekday abbr { text-decoration: none; }
        .react-calendar__month-view__days { display: grid !important; grid-template-columns: repeat(7, 1fr); row-gap: 12px; }
        .react-calendar__tile { border-radius: 10px; padding: 6px; height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 6px; background: transparent !important; position: relative; overflow: visible !important;}
        .react-calendar__tile abbr { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; min-width: 32px; min-height: 32px; border-radius: 50%; font-weight: 600; font-size: 0.95rem; color: #475569; transition: all 0.2s ease;}
        .react-calendar__tile:not(.holiday-date-circle):not(.birthday-date-circle):hover abbr { background-color: #f1f5f9; color: #0f172a;}
        .react-calendar__tile--now abbr { background-color: transparent; border: 2px solid #3b82f6; color: #3b82f6; font-weight: 800;}
        .holiday-date-circle abbr { background-color: #10b981 !important; color: white !important; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);}
        .birthday-date-circle abbr { background-color: #f43f5e !important; color: white !important; box-shadow: 0 4px 10px rgba(244, 63, 94, 0.3);}
        .custom-tooltip { position: absolute; bottom: 120%; left: 50%; transform: translateX(-50%); background: #1e293b; padding: 8px 12px; border-radius: 10px; font-size: 12px; z-index: 50; white-space: nowrap; box-shadow: 0 10px 25px rgba(0,0,0,0.3); pointer-events: none;}
        .custom-tooltip::after { content: ""; position: absolute; top: 100%; left: 50%; margin-left: -5px; border-width: 5px; border-style: solid; border-color: #1e293b transparent transparent transparent;}
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
      `}</style>
    </div>
  );
};

export default AdminHolidayCalendarPage;