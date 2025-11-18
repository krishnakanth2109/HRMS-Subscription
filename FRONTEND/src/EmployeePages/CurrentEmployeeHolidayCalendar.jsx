import React, { useEffect, useState } from "react";
import { getHolidays } from "../api"; // Your centralized API function
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css"; // We will override this
import { FaCalendarDay, FaGift, FaStar } from "react-icons/fa";

const EmployeeHolidays = () => {
  const [holidays, setHolidays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDate, setActiveDate] = useState(new Date());

  // Fetch holidays from the backend
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const data = await getHolidays();
        setHolidays(data);
      } catch (err) {
        console.error("Error fetching holidays:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHolidays();
  }, []);

  // Calculate the number of holidays in the currently active month
  const holidaysThisMonth = holidays.filter(holiday => {
    const holidayDate = new Date(holiday.date);
    return holidayDate.getMonth() === activeDate.getMonth() && holidayDate.getFullYear() === activeDate.getFullYear();
  }).length;
  
  // Custom function to add content (like tooltips) to calendar tiles
  const tileContent = ({ date, view }) => {
    if (view === "month") {
      const holiday = holidays.find(h => new Date(h.date).toDateString() === date.toDateString());
      if (holiday) {
        return <div className="holiday-tooltip">{holiday.name}</div>;
      }
    }
  };

  // Custom function to apply styles to calendar tiles
  const tileClassName = ({ date, view }) => {
    if (view === "month") {
      const isHoliday = holidays.some(h => new Date(h.date).toDateString() === date.toDateString());
      if (isHoliday) {
        return "holiday-tile";
      }
    }
  };
  
  // Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex justify-center animate-pulse">
        <div className="w-full max-w-6xl space-y-12">
          <div className="h-12 bg-gray-200 rounded-lg w-1/3 mx-auto"></div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 bg-gray-200 rounded-2xl h-96"></div>
            <div className="bg-gray-200 rounded-2xl h-48"></div>
          </div>
          <div className="h-8 bg-gray-200 rounded-lg w-1/4 mx-auto"></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => <div key={i} className="bg-gray-200 h-40 rounded-2xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent mb-3 animate-gradient-x">
            Company Holidays
          </h2>
          <p className="text-lg text-gray-600">Plan your year with our official holiday schedule.</p>
        </div>

        {/* Calendar & Stats Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16 items-start">
          <div className="lg:col-span-2 bg-white shadow-2xl rounded-3xl p-6 sm:p-8 border border-slate-100">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center flex items-center justify-center gap-3">
              <FaCalendarDay className="text-indigo-500" /> Holiday Calendar
            </h3>
            <Calendar 
              tileClassName={tileClassName}
              tileContent={tileContent}
              onActiveStartDateChange={({ activeStartDate }) => setActiveDate(activeStartDate)}
              className="w-full border-none"
            />
          </div>
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-2xl rounded-3xl p-8 text-center flex flex-col justify-center h-full">
            <h3 className="text-2xl font-bold mb-4">Holidays This Month</h3>
            <div className="text-7xl font-extrabold my-4 animate-bounce-slow">
              {holidaysThisMonth}
            </div>
            <p className="opacity-80">
              {new Date(activeDate).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Holiday List Section */}
        <div className="w-full max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-gray-800 mb-8 text-center">
            Upcoming Holidays List
          </h3>
          {holidays.length === 0 ? (
            <div className="text-center bg-white p-12 rounded-2xl shadow-lg">
                <p className="text-2xl text-gray-400 mb-4">📭</p>
                <p className="text-gray-600 font-semibold text-lg">No holidays posted yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {holidays.map((holiday) => (
                <div key={holiday._id} className="group relative bg-white shadow-lg p-6 rounded-2xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -skew-x-12 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  <div className="flex items-center gap-5">
                    <div className="flex-shrink-0 text-3xl font-bold text-indigo-600 bg-indigo-50 p-4 rounded-xl text-center">
                      <div className="leading-none">{new Date(holiday.date).getDate()}</div>
                      <div className="text-sm font-medium tracking-wide">{new Date(holiday.date).toLocaleString('default', { month: 'short' })}</div>
                    </div>
                    <div className="flex-grow">
                      <h4 className="text-xl font-bold text-gray-900 mb-1">{holiday.name}</h4>
                      <p className="text-gray-500 font-semibold text-sm">{new Date(holiday.date).toLocaleDateString('en-US', { weekday: 'long' })}</p>
                    </div>
                    <FaStar className="text-yellow-400 text-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CSS for custom styling and animations */}
      <style>{`
        /* Calendar Styling */
        .react-calendar { font-family: inherit; border: none; }
        .react-calendar__navigation button { font-weight: bold; font-size: 1.1rem; border-radius: 0.5rem; transition: background-color 0.2s; }
        .react-calendar__navigation button:hover { background-color: #f3f4f6; }
        .react-calendar__month-view__weekdays__weekday { text-align: center; font-weight: 600; color: #6366F1; text-decoration: none; }
        .react-calendar__tile { border-radius: 0.5rem; transition: all 0.2s; position: relative; }
        .react-calendar__tile:enabled:hover, .react-calendar__tile:enabled:focus { background: #eef2ff; }
        .react-calendar__tile--now { background: #e0e7ff !important; font-weight: bold; }
        
        /* Holiday Tile Styling */
        .holiday-tile {
          background: linear-gradient(135deg, #8B5CF6, #6366F1) !important;
          color: white !important;
          font-weight: bold;
          border-radius: 0.5rem !important;
        }
        .holiday-tile:hover .holiday-tooltip {
          opacity: 1;
          transform: translateY(0);
        }
        
        /* Holiday Tooltip */
        .holiday-tooltip {
          position: absolute;
          bottom: 105%;
          left: 50%;
          transform: translateX(-50%) translateY(10px);
          background-color: #333;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s, transform 0.3s;
          z-index: 10;
        }
        .holiday-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-width: 5px;
          border-style: solid;
          border-color: #333 transparent transparent transparent;
        }
        
        /* Animations */
        @keyframes gradient-x-animation { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .animate-gradient-x { background-size: 200% 200%; animation: gradient-x-animation 4s ease infinite; }
        .animate-bounce-slow { animation: bounce 2s infinite; }
      `}</style>
    </div>
  );
};

export default EmployeeHolidays;