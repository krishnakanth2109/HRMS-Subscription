import React, { useState, useCallback } from "react";
import { HolidayCalendarContext } from "./HolidayCalendarContext";

// Helper to generate all Sundays for a given year using UTC to prevent timezone issues
function getSundaysForYear(year) {
  const sundays = [];
  // Use Date.UTC to create a date in a timezone-agnostic way (Jan 1st)
  const date = new Date(Date.UTC(year, 0, 1)); 

  // Find the first Sunday of the year
  // getUTCDay() returns the day of the week (0 for Sunday, 6 for Saturday)
  while (date.getUTCDay() !== 0) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  let sundayCount = 0;
  // Iterate through the year, adding each Sunday to the list
  while (date.getUTCFullYear() === year) {
    sundays.push({
      // Creates a unique ID like 2025001, 2025002, etc.
      id: Number(`${year}00${++sundayCount}`), 
      name: "Sunday",
      // Use toISOString and slice to get a consistent YYYY-MM-DD format
      date: date.toISOString().slice(0, 10),
      description: "Weekly holiday",
    });
    // Move to the next Sunday
    date.setUTCDate(date.getUTCDate() + 7); 
  }
  return sundays;
}

// Years: current, -2, -1, +1, +2 to cover a wider range for testing
const currentYear = new Date().getFullYear();
const sundayYears = [
  currentYear - 2,
  currentYear - 1,
  currentYear,
  currentYear + 1,
  currentYear + 2,
];
const allSundays = sundayYears.flatMap(getSundaysForYear);

// Updated static holidays with accurate dates for 2025
const staticHolidays = [
  { id: 1, name: "New Year's Day", date: "2025-01-01", description: "First day of the year" },
  { id: 2, name: "Republic Day", date: "2025-01-26", description: "National holiday" },
  { id: 3, name: "Maha Shivaratri", date: "2025-02-26", description: "Hindu festival honoring Lord Shiva" },
  { id: 4, name: "Holi", date: "2025-03-14", description: "Festival of colors" },
  { id: 5, name: "Ambedkar Jayanti", date: "2025-04-14", description: "Birth anniversary of Dr. B.R. Ambedkar" },
  { id: 6, name: "Good Friday", date: "2025-04-18", description: "Christian religious holiday" },
  { id: 7, name: "May Day", date: "2025-05-01", description: "International Labour Day" },
  { id: 8, name: "Eid al-Fitr", date: "2025-05-02", description: "Islamic festival ending Ramadan" },
  { id: 9, name: "Bakrid / Eid al-Adha", date: "2025-06-06", description: "Islamic festival of sacrifice" },
  { id: 10, name: "Independence Day", date: "2025-08-15", description: "Indian Independence Day" },
  { id: 11, name: "Raksha Bandhan", date: "2025-08-09", description: "Festival celebrating sibling bond" },
  { id: 12, name: "Ganesh Chaturthi", date: "2025-08-29", description: "Hindu festival celebrating Lord Ganesha" },
  { id: 13, name: "Gandhi Jayanti", date: "2025-10-02", description: "Birth anniversary of Mahatma Gandhi" },
  { id: 14, name: "Dussehra", date: "2025-10-02", description: "Victory of good over evil" },
  { id: 15, name: "Diwali", date: "2025-10-20", description: "Festival of lights" },
  { id: 16, name: "Christmas", date: "2025-12-25", description: "Celebration of the birth of Jesus Christ" },
];

// Merge Sundays and static holidays, sort by date
const initialHolidays = [...staticHolidays, ...allSundays].sort((a, b) => a.date.localeCompare(b.date));

const HolidayCalendarProvider = ({ children }) => {
  const [holidays, setHolidays] = useState(initialHolidays);

  // Only expose CRUD and query utilities
  const addHoliday = useCallback((holiday) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    // Disallow adding holidays on past or present dates
    if (holiday.date <= todayStr) {
      console.warn("Cannot add a holiday for a past or present date.");
      return;
    }
    // Prevent duplicate holidays on the same date
    if (holidays.some(h => h.date === holiday.date)) {
      console.warn("Cannot add a holiday; a holiday already exists on this date.");
      return;
    }
    setHolidays(prev => [
      ...prev,
      { ...holiday, id: Date.now() }
    ]);
  }, [holidays]);

  const editHoliday = useCallback((id, updated) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    // Disallow editing a holiday to a past or present date
    if (updated.date <= todayStr) {
      console.warn("Cannot edit holiday to a past or present date.");
      return;
    }
    // Prevent editing a holiday to a date that already has a different holiday
    if (holidays.some(h => h.date === updated.date && h.id !== id)) {
      console.warn("Cannot edit holiday; a different holiday already exists on this date.");
      return;
    }
    setHolidays((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...updated } : h))
    );
  }, [holidays]);

  const deleteHoliday = useCallback((id) => {
    const holiday = holidays.find(h => h.id === id);
    const todayStr = new Date().toISOString().slice(0, 10);
    // Disallow deleting holidays that are in the past or present
    if (holiday?.date <= todayStr) {
      console.warn("Cannot delete a holiday that is in the past or present.");
      return;
    }
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  }, [holidays]);

  const getHolidayDates = useCallback(() => {
    return holidays.map(h => h.date).sort();
  }, [holidays]);

  const getHolidayByDate = useCallback((dateStr) => {
    return holidays.find(h => h.date === dateStr);
  }, [holidays]);

  // New: Replace all holidays
  const setAllHolidays = useCallback((newHolidays) => {
    setHolidays(Array.isArray(newHolidays) ? newHolidays : []);
  }, []);

  return (
    <HolidayCalendarContext.Provider
      value={{
        holidays,
        addHoliday,
        editHoliday,
        deleteHoliday,
        getHolidayDates,
        getHolidayByDate,
        setAllHolidays, // Expose new function
      }}
    >
      {children}
    </HolidayCalendarContext.Provider>
  );
};

export default HolidayCalendarProvider;
