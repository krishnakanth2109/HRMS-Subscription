import React, { useEffect, useState } from "react";
import { getHolidays } from "../api"; // Import the centralized API function
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

const EmployeeHolidays = () => {
  const [holidays, setHolidays] = useState([]);

  // Fetch holidays from backend
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        // Use the imported getHolidays function
        const data = await getHolidays();
        setHolidays(data);
      } catch (err) {
        console.error("Error fetching holidays:", err);
      }
    };
    fetchHolidays();
  }, []);

  // Highlight holidays in calendar
  const tileClassName = ({ date, view }) => {
    if (view === "month") {
      const isHoliday = holidays.some(
        (holiday) => new Date(holiday.date).toDateString() === date.toDateString()
      );
      return isHoliday ? "bg-red-500 text-white rounded-full" : null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 flex flex-col items-center">
      {/* Header */}
      <h2 className="text-3xl font-bold text-blue-600 mb-6 text-center">
        🎉 Company Holidays
      </h2>

      {/* Calendar Section */}
      <div className="bg-white shadow-md rounded-2xl p-6 w-full max-w-3xl mb-10">
        <h3 className="text-xl font-semibold text-gray-700 mb-3 text-center">
          📅 Holiday Calendar
        </h3>
        <Calendar tileClassName={tileClassName} />
        <p className="text-sm text-gray-500 text-center mt-2">
          *Holidays are marked in red
        </p>
      </div>

      {/* Holiday List Section */}
      <div className="w-full max-w-4xl">
        <h3 className="text-2xl font-bold text-blue-600 mb-4 text-center">
          🗓️ Upcoming Holidays
        </h3>

        {holidays.length === 0 ? (
          <p className="text-gray-600 text-center">No holidays available.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {holidays.map((holiday) => (
              <div
                key={holiday._id}
                className="bg-white shadow-md p-5 rounded-xl border-l-4 border-green-500 hover:shadow-lg transition"
              >
                <h4 className="text-lg font-semibold text-gray-800 mb-1">
                  {holiday.name}
                </h4>
                <p className="text-gray-600 mb-2">{holiday.description}</p>
                <p className="text-sm text-gray-500">
                  📅 {new Date(holiday.date).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeHolidays;