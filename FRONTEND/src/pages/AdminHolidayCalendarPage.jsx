import React, { useState, useEffect } from "react";
import axios from "axios";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

const HolidayCalendar = () => {
  const [holidayData, setHolidayData] = useState({
    name: "",
    description: "",
    date: "",
  });
  const [holidays, setHolidays] = useState([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch all holidays
  const fetchHolidays = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/holidays");
      setHolidays(res.data);
    } catch (err) {
      console.error("Error fetching holidays:", err);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  // Handle form input
  const handleChange = (e) => {
    setHolidayData({ ...holidayData, [e.target.name]: e.target.value });
  };

  // Add holiday
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await axios.post("http://localhost:5000/api/holidays", holidayData);
      setMessage("✅ Holiday added successfully!");
      setHolidayData({ name: "", description: "", date: "" });
      fetchHolidays();
    } catch (error) {
      console.error(error);
      setMessage("❌ Failed to add holiday.");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete holiday
  const deleteHoliday = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/api/holidays/${id}`);
      setMessage("🗑️ Holiday deleted successfully!");
      fetchHolidays();
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to delete holiday.");
    }
  };

  // Highlight holidays in calendar
  const tileClassName = ({ date, view }) => {
    if (view === "month") {
      const isHoliday = holidays.some(
        (holiday) => new Date(holiday.date).toDateString() === date.toDateString()
      );
      return isHoliday 
        ? "bg-gradient-to-br from-red-500 to-pink-600 text-white font-bold rounded-full shadow-lg transform scale-110 transition-all duration-200" 
        : "hover:bg-gray-100 transition-colors duration-200";
    }
  };

  // Custom calendar styling
  const calendarStyles = `
    .react-calendar {
      border: none;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      border-radius: 1rem;
      padding: 1rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
    }
    .react-calendar__navigation button {
      color: #3b82f6;
      font-weight: bold;
      font-size: 1.1rem;
      min-width: 44px;
      background: none;
      border: none;
      margin: 0 5px;
      border-radius: 0.5rem;
      transition: all 0.3s ease;
    }
    .react-calendar__navigation button:hover {
      background: #3b82f6;
      color: white;
      transform: translateY(-2px);
    }
    .react-calendar__tile {
      border-radius: 50%;
      transition: all 0.3s ease;
      margin: 2px;
    }
    .react-calendar__tile:enabled:hover {
      background: #3b82f6;
      color: white;
      transform: scale(1.1);
    }
    .react-calendar__tile--active {
      background: #3b82f6 !important;
      color: white;
      transform: scale(1.1);
    }
  `;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-10 px-4 flex flex-col items-center">
      <style>{calendarStyles}</style>
      
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          🎊 Holiday Management System
        </h1>
        <p className="text-gray-600 text-lg">Manage and view all company holidays</p>
      </div>

      {/* Form */}
      <div className="bg-white/80 backdrop-blur-sm shadow-2xl rounded-3xl p-8 w-full max-w-lg mb-10 border border-white/20">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span className="text-2xl text-white">🎉</span>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Add New Holiday
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block font-semibold text-gray-700 mb-2 text-lg">
              Holiday Name
            </label>
            <input
              type="text"
              name="name"
              value={holidayData.name}
              onChange={handleChange}
              required
              placeholder="Enter holiday name"
              className="w-full border-2 border-gray-200 p-4 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-semibold text-gray-700 mb-2 text-lg">
              Description
            </label>
            <textarea
              name="description"
              value={holidayData.description}
              onChange={handleChange}
              required
              rows="3"
              placeholder="Enter holiday details"
              className="w-full border-2 border-gray-200 p-4 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm resize-none"
            ></textarea>
          </div>

          <div className="space-y-2">
            <label className="block font-semibold text-gray-700 mb-2 text-lg">
              Date
            </label>
            <input
              type="date"
              name="date"
              value={holidayData.date}
              onChange={handleChange}
              required
              className="w-full border-2 border-gray-200 p-4 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg ${
              isLoading 
                ? "bg-gray-400 cursor-not-allowed" 
                : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            } text-white`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-t-2 border-white rounded-full animate-spin mr-2"></div>
                Adding...
              </div>
            ) : (
              "Add Holiday ✨"
            )}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-4 rounded-2xl text-center font-semibold animate-pulse ${
            message.includes("✅") || message.includes("successfully") 
              ? "bg-green-100 text-green-700 border border-green-200" 
              : "bg-red-100 text-red-700 border border-red-200"
          }`}>
            {message}
          </div>
        )}
      </div>

      {/* List of holidays */}
      <div className="w-full max-w-6xl mb-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span className="text-2xl text-white">📋</span>
          </div>
          <h3 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            All Holidays
          </h3>
        </div>
        
        {holidays.length === 0 ? (
          <div className="text-center py-12 bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20">
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📅</span>
            </div>
            <p className="text-gray-500 text-xl">No holidays added yet.</p>
            <p className="text-gray-400 mt-2">Add your first holiday above!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {holidays.map((holiday, index) => (
              <div
                key={holiday._id}
                className="bg-white/80 backdrop-blur-sm shadow-xl p-6 rounded-3xl border-l-4 border-blue-500 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group"
                style={{
                  animationDelay: `${index * 100}ms`,
                  animation: `slideInUp 0.5s ease-out ${index * 100}ms both`
                }}
              >
                <style>{`
                  @keyframes slideInUp {
                    from {
                      opacity: 0;
                      transform: translateY(30px);
                    }
                    to {
                      opacity: 1;
                      transform: translateY(0);
                    }
                  }
                `}</style>
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors duration-300">
                    {holiday.name}
                  </h4>
                  <span className="text-2xl">🎊</span>
                </div>
                <p className="text-gray-600 mb-4 leading-relaxed">{holiday.description}</p>
                <div className="flex justify-between items-center">
                  <p className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    📅 {new Date(holiday.date).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                  <button
                    onClick={() => deleteHoliday(holiday._id)}
                    className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-4 py-2 rounded-xl hover:from-red-600 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="bg-white/80 backdrop-blur-sm shadow-2xl rounded-3xl p-8 w-full max-w-4xl border border-white/20">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span className="text-2xl text-white">📅</span>
          </div>
          <h3 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
            Holiday Calendar
          </h3>
        </div>
        <Calendar 
          tileClassName={tileClassName}
          className="mx-auto"
        />
   
      </div>
    </div>
  );
};

export default HolidayCalendar;