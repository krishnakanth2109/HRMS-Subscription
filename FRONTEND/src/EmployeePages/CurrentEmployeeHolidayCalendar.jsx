// --- START OF FILE EmployeeHolidays.jsx ---
import React, { useEffect, useState } from "react";
import { getHolidays } from "../api"; 
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { FaCalendarDay, FaGift, FaStar } from "react-icons/fa";

const EmployeeHolidays = () => {
  const [holidays, setHolidays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDate, setActiveDate] = useState(new Date());

  // Normalize date (timezone-safe)
  const normalize = (d) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  // Fetch holidays
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const data = await getHolidays();

        const formatted = data.map((h) => ({
          ...h,
          start: normalize(h.startDate),
          end: normalize(h.endDate || h.startDate), // single or multi-day
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

  // Month-wise filtered holidays for list
  const filteredHolidays = holidays.filter((h) => {
    return (
      h.start.getMonth() === activeDate.getMonth() &&
      h.start.getFullYear() === activeDate.getFullYear()
    );
  });

  // Monthly holiday count logic
  const holidaysThisMonth = holidays.reduce((total, h) => {
    const year = activeDate.getFullYear();
    const month = activeDate.getMonth();

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const start = h.start < monthStart ? monthStart : h.start;
    const end = h.end > monthEnd ? monthEnd : h.end;

    if (start <= end) {
      return (
        total +
        (Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1)
      );
    }

    return total;
  }, 0);

  // Tooltip
  const tileContent = ({ date, view }) => {
    if (view === "month") {
      const d = normalize(date);
      const holiday = holidays.find((h) => d >= h.start && d <= h.end);
      return holiday ? <div className="holiday-tooltip">{holiday.name}</div> : null;
    }
  };

  // Highlight holiday range
  const tileClassName = ({ date, view }) => {
    if (view === "month") {
      const d = normalize(date);
      const isHoliday = holidays.some((h) => d >= h.start && d <= h.end);
      return isHoliday ? "holiday-tile" : null;
    }
  };

  // Loading Skeleton
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
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-40 rounded-2xl"></div>
            ))}
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
          <h2 className="text-4xl pb-2 sm:text-5xl font-extrabold bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent mb-3 animate-gradient-x">
            Company Holidays
          </h2>
          <p className="text-lg text-gray-600">
            Plan your year with our official holiday schedule.
          </p>
        </div>

        {/* Calendar & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16 items-start">
          <div className="lg:col-span-2 bg-white shadow-2xl rounded-3xl p-6 sm:p-8 border border-slate-100">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center flex items-center justify-center gap-3">
              <FaCalendarDay className="text-indigo-500" /> Holiday Calendar
            </h3>

            <Calendar
              tileClassName={tileClassName}
              tileContent={tileContent}
              onActiveStartDateChange={({ activeStartDate }) =>
                setActiveDate(activeStartDate)
              }
              className="w-full border-none mx-auto"
            />
          </div>

          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-2xl rounded-3xl p-8 text-center flex flex-col justify-center h-full">
            <h3 className="text-2xl font-bold mb-4">Holidays This Month</h3>
            <div className="text-7xl font-extrabold my-4 animate-bounce-slow">
              {holidaysThisMonth}
            </div>
            <p className="opacity-80">
              {activeDate.toLocaleString("default", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Month-wise Holiday List */}
        <div className="w-full max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-gray-800 mb-8 text-center">
            Upcoming Holidays ({activeDate.toLocaleString("default", { month: "long" })})
          </h3>

          {filteredHolidays.length === 0 ? (
            <div className="text-center bg-white p-12 rounded-2xl shadow-lg">
              <p className="text-2xl text-gray-400 mb-4">📭</p>
              <p className="text-gray-600 font-semibold text-lg">
                No holidays found for this month.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredHolidays.map((h) => (
                <div
                  key={h._id}
                  className="group relative bg-white shadow-lg p-6 rounded-2xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -skew-x-12 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>

                  <div className="flex items-center gap-5">
                    <div className="flex-shrink-0 text-3xl font-bold text-indigo-600 bg-indigo-50 p-4 rounded-xl text-center">
                      <div className="leading-none">{h.start.getDate()}</div>
                      <div className="text-sm font-medium tracking-wide">
                        {h.start.toLocaleString("default", { month: "short" })}
                      </div>
                    </div>

                    <div className="flex-grow">
                      <h4 className="text-xl font-bold text-gray-900 mb-1">
                        {h.name}
                      </h4>

                      <p className="text-gray-500 font-semibold text-sm">
                        {h.start.toLocaleDateString()} → {h.end.toLocaleDateString()}
                      </p>
                    </div>

                    <FaStar className="text-yellow-400 text-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CSS stays the same */}
      <style>{`
        .react-calendar { font-family: inherit; border: none; }
        .holiday-tile {
          background: linear-gradient(135deg, #8B5CF6, #6366F1) !important;
          color: white !important;
          font-weight: bold;
        }
        .holiday-tooltip {
          position: absolute;
          bottom: 105%;
          left: 50%;
          transform: translateX(-50%);
          background: #333;
          color: white;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          opacity: 0;
          transition: 0.3s;
        }
        .holiday-tile:hover .holiday-tooltip {
          opacity: 1;
        }
        .animate-bounce-slow { animation: bounce 2s infinite; }
      `}</style>
    </div>
  );
};

export default EmployeeHolidays;
// --- END OF FILE EmployeeHolidays.jsx ---
