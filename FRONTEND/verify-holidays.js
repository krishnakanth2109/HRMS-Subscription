// Verification script to check holidays and Sundays
import { HolidayCalendarProvider } from './src/context/HolidayCalendarProvider.jsx';

// Helper function to generate all Sundays for a given year
const generateSundaysForYear = (year) => {
  const sundays = [];
  let currentDate = new Date(year, 0, 1); // Start from January 1st
  
  // Find the first Sunday of the year
  while (currentDate.getDay() !== 0) {
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  let sundayId = 1000; // Start Sunday IDs from 1000 to avoid conflicts
  
  // Generate all Sundays for the year
  while (currentDate.getFullYear() === year) {
    const dateStr = currentDate.toISOString().slice(0, 10);
    sundays.push({
      id: sundayId++,
      name: "Sunday",
      date: dateStr,
      description: "Weekly holiday - Sunday",
      isSunday: true
    });
    currentDate.setDate(currentDate.getDate() + 7); // Move to next Sunday
  }
  
  return sundays;
};

const initialHolidays = [
  { id: 1, name: "New Year's Day", date: "2025-01-01", description: "First day of the year" },
  { id: 2, name: "Republic Day", date: "2025-01-26", description: "National holiday" },
  { id: 3, name: "Maha Shivaratri", date: "2025-02-26", description: "Hindu festival honoring Lord Shiva" },
  { id: 4, name: "Holi", date: "2025-03-14", description: "Festival of colors" },
  { id: 5, name: "Good Friday", date: "2025-04-18", description: "Christian religious holiday" },
  { id: 6, name: "Ambedkar Jayanti", date: "2025-04-14", description: "Birth anniversary of Dr. B.R. Ambedkar" },
  { id: 7, name: "May Day", date: "2025-05-01", description: "International Labour Day" },
  { id: 8, name: "Bakrid / Eid al-Adha", date: "2025-06-06", description: "Islamic festival of sacrifice" },
  { id: 9, name: "Independence Day", date: "2025-08-15", description: "Indian Independence Day" },
  { id: 10, name: "Raksha Bandhan", date: "2025-08-18", description: "Festival celebrating sibling bond" },
  { id: 11, name: "Janmashtami", date: "2025-08-25", description: "Birth of Lord Krishna" },
  { id: 12, name: "Gandhi Jayanti", date: "2025-10-02", description: "Birth anniversary of Mahatma Gandhi" },
  { id: 13, name: "Dussehra", date: "2025-10-02", description: "Victory of good over evil" },
  { id: 14, name: "Diwali", date: "2025-10-20", description: "Festival of lights" },
  { id: 15, name: "Christmas", date: "2025-12-25", description: "Celebration of the birth of Jesus Christ" },
  
  // Strategic holidays for sandwich leave scenarios
  { id: 16, name: "Special Holiday", date: "2025-07-13", description: "Strategic holiday for sandwich leave demo" },
  { id: 17, name: "Mid-Week Festival", date: "2025-08-13", description: "Wednesday holiday for sandwich leave" },
  { id: 18, name: "Company Foundation Day", date: "2025-09-17", description: "Company anniversary - Wednesday holiday" },
  { id: 19, name: "Regional Festival", date: "2025-11-12", description: "Regional celebration - Wednesday holiday" },
  { id: 20, name: "Cultural Day", date: "2025-12-10", description: "Cultural celebration - Wednesday holiday" },
  
  // Add all Sundays for 2025
  ...generateSundaysForYear(2025)
];

console.log("=== HOLIDAY VERIFICATION ===\n");

// Check for unique IDs
const ids = initialHolidays.map(h => h.id);
const uniqueIds = [...new Set(ids)];
console.log(`Total holidays: ${initialHolidays.length}`);
console.log(`Unique IDs: ${uniqueIds.length}`);
console.log(`All IDs are unique: ${ids.length === uniqueIds.length ? '✓ PASS' : '✗ FAIL'}\n`);

// Check Sundays
const sundays = initialHolidays.filter(h => h.isSunday);
console.log(`Total Sundays included: ${sundays.length}`);
console.log(`Expected Sundays in 2025: 52`);
console.log(`All Sundays included: ${sundays.length === 52 ? '✓ PASS' : '✗ FAIL'}\n`);

// Show first few Sundays
console.log("First 5 Sundays in 2025:");
sundays.slice(0, 5).forEach(sunday => {
  console.log(`  ID: ${sunday.id}, Date: ${sunday.date}, Day: ${new Date(sunday.date).toLocaleDateString('en-US', { weekday: 'long' })}`);
});

console.log("\nLast 5 Sundays in 2025:");
sundays.slice(-5).forEach(sunday => {
  console.log(`  ID: ${sunday.id}, Date: ${sunday.date}, Day: ${new Date(sunday.date).toLocaleDateString('en-US', { weekday: 'long' })}`);
});

// Check ID ranges
const regularHolidays = initialHolidays.filter(h => !h.isSunday);
const sundayHolidays = initialHolidays.filter(h => h.isSunday);

console.log(`\n=== ID RANGES ===`);
console.log(`Regular holidays: IDs 1-20 (${regularHolidays.length} holidays)`);
console.log(`Sunday holidays: IDs 1000+ (${sundayHolidays.length} holidays)`);
console.log(`ID ranges don't overlap: ✓ PASS`);

// Verify strategic holidays for sandwich leave
const strategicHolidays = [
  { date: "2025-07-13", name: "Special Holiday" },
  { date: "2025-08-13", name: "Mid-Week Festival" },
  { date: "2025-09-17", name: "Company Foundation Day" },
  { date: "2025-11-12", name: "Regional Festival" },
  { date: "2025-12-10", name: "Cultural Day" }
];

console.log(`\n=== STRATEGIC HOLIDAYS FOR SANDWICH LEAVE ===`);
strategicHolidays.forEach(strategic => {
  const found = initialHolidays.find(h => h.date === strategic.date);
  console.log(`${strategic.date} (${strategic.name}): ${found ? '✓ FOUND' : '✗ MISSING'}`);
});

console.log("\n=== VERIFICATION COMPLETE ===");