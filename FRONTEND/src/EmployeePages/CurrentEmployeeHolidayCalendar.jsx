import React, { useEffect, useState, useRef } from "react";
import { getHolidays, getEmployees } from "../api";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { 
  FaCalendarCheck, 
  FaUmbrellaBeach, 
  FaBirthdayCake, 
  FaChevronLeft, 
  FaChevronRight,
  FaCalendarDay,
  FaGift,
  FaChevronDown,
  FaChevronUp
} from "react-icons/fa";

const EmployeeHolidays = () => {
  const [holidays, setHolidays] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDate, setActiveDate] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [showPopup, setShowPopup] = useState(false);
  const [popupContent, setPopupContent] = useState([]);
  const [expandedHolidays, setExpandedHolidays] = useState(false);
  const [expandedBirthdays, setExpandedBirthdays] = useState(false);
  const calendarRef = useRef(null);

  // --- LOGIC: HELPER FUNCTIONS ---
  const normalize = (d) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const getDaysDiff = (targetDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(target - today);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };

  // --- LOGIC: FETCH DATA ---
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const data = await getHolidays();
        const formatted = data.map((h) => ({
          ...h,
          start: normalize(h.startDate),
          end: normalize(h.endDate || h.startDate),
        }));
        setHolidays(formatted);
      } catch (err) {
        console.error("Error fetching holidays:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHolidays();
  }, []);

  useEffect(() => {
    const fetchBirthdays = async () => {
      try {
        const employees = await getEmployees();
        const list = employees
          .filter((emp) => emp.personalDetails?.dob)
          .map((emp) => ({
            name: emp.name,
            role: emp.designation || "Employee",
            dob: new Date(emp.personalDetails.dob),
          }));
        setBirthdays(list);
      } catch (err) {
        console.error("Error loading birthdays:", err);
      }
    };
    fetchBirthdays();
  }, []);

  // --- LOGIC: CALCULATIONS ---

  // 1. Next Upcoming Holiday
  const upcomingHoliday = holidays
    .filter(h => h.start >= new Date())
    .sort((a, b) => a.start - b.start)[0];

  // 2. Filtered Lists
  const allUpcomingHolidays = holidays
    .filter(h => h.start >= new Date())
    .sort((a, b) => a.start - b.start);

  const displayHolidays = expandedHolidays 
    ? allUpcomingHolidays 
    : allUpcomingHolidays.slice(0, 4);

  // Filter Birthdays: Match Month AND (if current month, day >= today)
  const currentMonthBirthdays = birthdays
    .filter(b => b.dob.getMonth() === activeDate.getMonth())
    .filter(b => {
      const today = new Date();
      // If viewing the current real-time month, filter out passed days
      if (activeDate.getMonth() === today.getMonth() && activeDate.getFullYear() === today.getFullYear()) {
        return b.dob.getDate() >= today.getDate();
      }
      return true;
    })
    .sort((a, b) => a.dob.getDate() - b.dob.getDate());

  const displayBirthdays = expandedBirthdays
    ? currentMonthBirthdays
    : currentMonthBirthdays.slice(0, 3);

  // 3. Stats Counts
  const getWeekendsInMonth = (year, month) => {
    let count = 0;
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
      const day = date.getDay();
      if (day === 0 || day === 6) count++;
      date.setDate(date.getDate() + 1);
    }
    return count;
  };

  const currentYear = activeDate.getFullYear();
  const currentMonth = activeDate.getMonth();
  
  const stats = {
    holidays: holidays.filter(h => h.start.getMonth() === currentMonth && h.start.getFullYear() === currentYear).length,
    weekends: getWeekendsInMonth(currentYear, currentMonth),
    birthdays: currentMonthBirthdays.length,
  };

  // --- UI: CALENDAR CUSTOMIZATION ---
  
  const tileContent = ({ date, view }) => {
    if (view === "month") {
      const d = normalize(date);
      const isHoliday = holidays.some((h) => d >= h.start && d <= h.end);
      const isBirthday = birthdays.some((b) => b.dob.getDate() === d.getDate() && b.dob.getMonth() === d.getMonth());

      return (
        <div className="flex justify-center gap-1 mt-1">
          {isHoliday && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
          {isBirthday && <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>}
        </div>
      );
    }
  };

  const handleDateHover = (event, date) => {
    if (!date) {
      setShowPopup(false);
      return;
    }
    
    const d = normalize(date);
    const dateEvents = [];
    
    // Check for holidays
    holidays.forEach(h => {
      if (d >= h.start && d <= h.end) {
        dateEvents.push({
          type: 'holiday',
          name: h.name,
          description: h.description || "National holiday",
          daysUntil: getDaysDiff(h.start),
          icon: <FaUmbrellaBeach className="text-blue-500" />
        });
      }
    });
    
    // Check for birthdays
    birthdays.forEach(b => {
      if (b.dob.getDate() === d.getDate() && b.dob.getMonth() === d.getMonth()) {
        dateEvents.push({
          type: 'birthday',
          name: b.name,
          role: b.role,
          icon: <FaBirthdayCake className="text-purple-500" />
        });
      }
    });
    
    if (dateEvents.length > 0) {
      const rect = event.target.getBoundingClientRect();
      setPopupPosition({
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY - 100
      });
      setPopupContent(dateEvents);
      setHoveredDate(date);
      setShowPopup(true);
    } else {
      setShowPopup(false);
    }
  };

  const handleDateLeave = () => {
    setTimeout(() => {
      if (!document.querySelector('.date-popup:hover')) {
        setShowPopup(false);
      }
    }, 100);
  };

  const tileClassName = ({ date }) => {
    const today = normalize(new Date());
    const current = normalize(date);
    if (today.getTime() === current.getTime()) {
      return "custom-calendar-tile today-tile font-bold text-blue-600 rounded-lg";
    }
    return "custom-calendar-tile font-medium text-gray-700 hover:bg-gray-50 rounded-lg";
  };

  if (isLoading) return <div className="p-10 flex justify-center text-gray-500">Loading Calendar...</div>;

  return (
    <div className="min-h-screen  p-4 md:p-8 font-sans">
      <div className="max-w-[1800px] mx-auto space-y-8">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col border border-gray-200 shadow-sm bg-white rounded-2xl p-6 md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Company Holiday Calendar</h1>
            <p className="text-gray-600 mt-2">Track holidays & celebrate with your colleagues</p>
          </div>
          <div className="flex items-center gap-3 bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm">
            <FaCalendarDay className="text-blue-500" />
            <span className="text-sm font-medium text-gray-700">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </span>
          </div>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Holidays</p>
                <h3 className="text-2xl font-bold text-gray-800 mt-1">{stats.holidays}</h3>
                <span className="text-xs text-gray-400">This month</span>
              </div>
              <div className="p-3 rounded-full bg-blue-50">
                <FaUmbrellaBeach className="text-blue-500 text-xl" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Weekends</p>
                <h3 className="text-2xl font-bold text-gray-800 mt-1">{stats.weekends}</h3>
                <span className="text-xs text-gray-400">This month</span>
              </div>
              <div className="p-3 rounded-full bg-indigo-50">
                <FaCalendarCheck className="text-indigo-500 text-xl" />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Birthdays</p>
                <h3 className="text-2xl font-bold text-gray-800 mt-1">{stats.birthdays}</h3>
                <span className="text-xs text-gray-400">Upcoming</span>
              </div>
              <div className="p-3 rounded-full bg-orange-50">
                <FaBirthdayCake className="text-orange-500 text-xl" />
              </div>
            </div>
          </div>

          {/* Next Holiday Card */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-5 rounded-2xl shadow-sm text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90 mb-1">Next Holiday</p>
                <h3 className="text-xl font-bold">
                  {upcomingHoliday ? upcomingHoliday.name : "None"}
                </h3>
                {upcomingHoliday && (
                  <p className="text-sm opacity-90 mt-1">
                    {getDaysDiff(upcomingHoliday.start)} days to go
                  </p>
                )}
              </div>
              <div className="p-3 rounded-full bg-white/20">
                <FaGift className="text-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT GRID - 3 equal columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT: CALENDAR */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Calendar</h3>
    
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setActiveDate(new Date(activeDate.getFullYear(), activeDate.getMonth() - 1, 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                >
                  <FaChevronLeft />
                </button>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-medium">
                  {activeDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
                </div>
                <button 
                  onClick={() => setActiveDate(new Date(activeDate.getFullYear(), activeDate.getMonth() + 1, 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                >
                  <FaChevronRight />
                </button>
              </div>
            </div>

            <div 
              ref={calendarRef}
              className="relative"
              onMouseLeave={handleDateLeave}
            >
              <Calendar 
                onChange={setActiveDate} 
                value={activeDate}
                activeStartDate={activeDate}
                onActiveStartDateChange={({ activeStartDate }) => setActiveDate(activeStartDate)}
                tileContent={tileContent}
                tileClassName={tileClassName}
                className="compact-calendar w-full border-none font-sans"
                prevLabel={null}
                nextLabel={null}
                navigationLabel={null}
                showNeighboringMonth={false}
                tileProps={({ date }) => ({
                  onMouseEnter: (e) => handleDateHover(e, date),
                  onMouseLeave: handleDateLeave
                })}
              />

              {/* Date Hover Popup */}
              {showPopup && popupContent.length > 0 && (
                <div 
                  className="date-popup fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-80 animate-fadeIn"
                  style={{
                    left: `${popupPosition.x}px`,
                    top: `${popupPosition.y}px`,
                    transform: 'translateX(-50%)'
                  }}
                  onMouseEnter={() => setShowPopup(true)}
                  onMouseLeave={() => setShowPopup(false)}
                >
                  <div className="absolute -bottom-2 left-1/2 w-4 h-4 bg-white border-r border-b border-gray-200 rotate-45 transform -translate-x-1/2"></div>
                  <div className="mb-3 pb-2 border-b border-gray-100">
                    <h4 className="font-bold text-lg text-gray-800">
                      {hoveredDate?.toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric'
                      })}
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {popupContent.map((event, index) => (
                      <div key={index} className={`p-3 rounded-lg ${event.type === 'holiday' ? 'bg-blue-50' : 'bg-purple-50'}`}>
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {event.icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <p className="font-bold text-gray-800">{event.name}</p>
                              {event.daysUntil !== undefined && (
                                <span className="text-xs font-bold px-2 py-1 bg-white rounded-full text-blue-600">
                                  {event.daysUntil} days
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {event.type === 'holiday' ? event.description : event.role}
                            </p>
                            {event.type === 'birthday' && (
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs font-medium text-purple-600">
                                  Birthday
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Calendar Legend */}
            <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm text-gray-600">Holiday</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span className="text-sm text-gray-600">Birthday</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-100 border-2 border-blue-400"></div>
                <span className="text-sm text-gray-600">Today</span>
              </div>
            </div>
          </div>

          {/* MIDDLE: UPCOMING HOLIDAYS */}
          <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 transition-all duration-300 flex flex-col ${expandedHolidays ? 'h-auto' : 'h-full'}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-lg">
                  <FaUmbrellaBeach className="text-blue-500 text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">Upcoming Holidays</h3>
                  <p className="text-gray-500 text-sm">Next holidays</p>
                </div>
              </div>
            </div>
            
            <div className={`space-y-3 flex-1 ${expandedHolidays ? '' : 'overflow-hidden'}`}>
              {displayHolidays.length === 0 ? (
                <div className="text-center py-8">
                  <FaUmbrellaBeach className="text-gray-300 text-3xl mx-auto mb-3" />
                  <p className="text-gray-400">No upcoming holidays</p>
                </div>
              ) : (
                displayHolidays.map((h, i) => (
                  <div 
                    key={i} 
                    className="bg-gradient-to-r from-blue-50 to-white border border-blue-100 rounded-xl p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[50px]">
                        <div className="text-2xl font-bold text-blue-600">
                          {h.start.getDate().toString().padStart(2, '0')}
                        </div>
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">
                          {h.start.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-800 text-sm mb-1">{h.name}</h4>
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {h.description || "National holiday"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {allUpcomingHolidays.length > 4 && (
              <div className="pt-4 mt-auto">
                <button 
                  onClick={() => setExpandedHolidays(!expandedHolidays)}
                  className="w-full py-2.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {expandedHolidays ? (
                    <>
                      <FaChevronUp size={12} />
                      Show Less
                    </>
                  ) : (
                    <>
                      <FaChevronDown size={12} />
                      Show All ({allUpcomingHolidays.length - 4} more)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: BIRTHDAYS */}
          <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 transition-all duration-300 flex flex-col ${expandedBirthdays ? 'h-auto' : 'h-full'}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-purple-50 p-2 rounded-lg">
                  <FaBirthdayCake className="text-purple-500 text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">Upcoming Birthdays</h3>
                  <p className="text-gray-500 text-sm">{currentMonthBirthdays.length} upcoming</p>
                </div>
              </div>
            </div>

            <div className={`space-y-3 flex-1 ${expandedBirthdays ? '' : 'overflow-hidden'}`}>
              {displayBirthdays.length === 0 ? (
                <div className="text-center py-8">
                  <FaBirthdayCake className="text-gray-300 text-3xl mx-auto mb-3" />
                  <p className="text-gray-400">No upcoming birthdays</p>
                </div>
              ) : (
                displayBirthdays.map((b, i) => (
                  <div 
                    key={i} 
                    className="bg-gradient-to-r from-purple-50 to-white border border-purple-100 rounded-xl p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 flex items-center justify-center font-bold text-lg text-purple-600">
                          {b.name.charAt(0)}
                        </div>
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                          <FaBirthdayCake className="text-white text-xs" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-800 text-sm">{b.name}</h4>
                        <p className="text-xs text-gray-600">{b.role}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-purple-600">
                          {b.dob.getDate().toString().padStart(2, '0')}
                        </div>
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          {b.dob.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {currentMonthBirthdays.length > 3 && (
              <div className="pt-4 mt-auto">
                <button 
                  onClick={() => setExpandedBirthdays(!expandedBirthdays)}
                  className="w-full py-2.5 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {expandedBirthdays ? (
                    <>
                      <FaChevronUp size={12} />
                      Show Less
                    </>
                  ) : (
                    <>
                      <FaChevronDown size={12} />
                      Show All ({currentMonthBirthdays.length - 3} more)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CUSTOM STYLES */}
      <style>{`
        .compact-calendar { 
            width: 100%; 
            background: transparent; 
            font-family: inherit; 
            line-height: 1.125em;
            border: none !important;
        }
        .react-calendar__navigation { display: none; }
        
        .react-calendar__month-view__weekdays {
            text-align: center;
            text-transform: uppercase;
            font-weight: 600;
            font-size: 0.75em;
            color: #6b7280;
            margin-bottom: 0.5rem;
        }
        .react-calendar__month-view__weekdays__weekday abbr {
            text-decoration: none;
        }

        .react-calendar__tile {
            max-width: 100%;
            padding: 14px 6px !important;
            background: none;
            text-align: center;
            line-height: 16px;
            font-size: 14px;
            transition: all 0.2s ease;
            border: none !important;
        }
        .react-calendar__tile:enabled:hover,
        .react-calendar__tile:enabled:focus {
            background-color: #f3f4f6 !important;
            border-radius: 8px;
        }
        
        .react-calendar__tile--now {
            background: #eff6ff !important;
            border: 2px solid #3b82f6 !important;
            border-radius: 8px;
            color: #3b82f6 !important;
            font-weight: bold;
        }
        
        .react-calendar__tile--active {
            background: #eff6ff !important; 
            color: #3b82f6 !important;
        }

        .today-tile {
            background: #eff6ff !important;
            border: 2px solid #3b82f6 !important;
            border-radius: 8px;
            color: #3b82f6 !important;
        }

        /* Remove all borders from calendar */
        .react-calendar,
        .react-calendar__viewContainer,
        .react-calendar__month-view,
        .react-calendar__month-view__days {
            border: none !important;
        }

        .react-calendar__month-view__days__day {
            border: none !important;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .line-clamp-2 {
          overflow: hidden;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }
      `}</style>
    </div>
  );
};

export default EmployeeHolidays;