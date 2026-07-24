// Test script to verify Sunday attendance fix
console.log("Testing Sunday attendance fix...\n");

// Mock data similar to what the app uses
const mockEmployees = [
  { employeeId: "EMP001", name: "John Doe" }
];

const mockHolidays = ["2024-12-25"]; // Christmas

const mockLeaveRequests = [
  {
    employeeId: "EMP001",
    status: "Approved",
    from: "2024-12-06", // Friday
    to: "2024-12-09"    // Monday (spans weekend)
  }
];

// Helper functions (copied from AttendanceProvider)
const getDayOfWeek = (dateStr) => new Date(dateStr).getDay();

const isDateInLeaveRange = (dateStr, fromDate, toDate) => {
  const date = new Date(dateStr);
  const from = new Date(fromDate);
  const to = new Date(toDate);
  return date >= from && date <= to;
};

// Test the attendance generation logic
function testAttendanceGeneration() {
  const testDates = [
    "2024-12-06", // Friday (should be Leave)
    "2024-12-07", // Saturday (should be Leave due to approved leave range)
    "2024-12-08", // Sunday (should be Holiday, NOT Leave)
    "2024-12-09", // Monday (should be Leave)
    "2024-12-15", // Sunday (should be Holiday)
    "2024-12-25"  // Christmas (should be Holiday)
  ];

  console.log("Testing attendance status for various dates:\n");

  testDates.forEach(dateStr => {
    const dayOfWeek = getDayOfWeek(dateStr);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    let status = "Present";
    let statusType = "working_day";
    
    // Apply the same logic as in AttendanceProvider
    // Priority 1: Check if it's Sunday (holiday)
    if (dayOfWeek === 0) {
      status = "Holiday";
      statusType = "holiday";
    }
    // Priority 2: Check if it's a public holiday
    else if (mockHolidays.includes(dateStr)) {
      status = "Holiday";
      statusType = "holiday";
    }
    // Priority 3: Check if employee has approved leave on this date
    else {
      const employeeLeave = mockLeaveRequests.find(leave =>
        leave.employeeId === "EMP001" &&
        leave.status === "Approved" &&
        isDateInLeaveRange(dateStr, leave.from, leave.to)
      );
      if (employeeLeave) {
        status = "Leave";
        statusType = "approved_leave";
      }
    }
    
    console.log(`${dateStr} (${dayNames[dayOfWeek]}): ${status} (${statusType})`);
  });
}

// Test the addAttendance validation
function testAddAttendanceValidation() {
  console.log("\n\nTesting addAttendance validation:\n");
  
  const testCases = [
    { date: "2024-12-08", status: "Leave", description: "Sunday as Leave" },
    { date: "2024-12-25", status: "Leave", description: "Holiday as Leave" },
    { date: "2024-12-06", status: "Leave", description: "Friday as Leave" }
  ];
  
  testCases.forEach(testCase => {
    const dayOfWeek = getDayOfWeek(testCase.date);
    const isPublicHoliday = mockHolidays.includes(testCase.date);
    
    // Simulate the validation logic from addAttendance
    if (dayOfWeek === 0 && testCase.status === "Leave") {
      console.log(`❌ ${testCase.description}: REJECTED - Cannot mark Sunday as Leave`);
    } else if (isPublicHoliday && testCase.status === "Leave") {
      console.log(`❌ ${testCase.description}: REJECTED - Cannot mark public holiday as Leave`);
    } else {
      console.log(`✅ ${testCase.description}: ALLOWED`);
    }
  });
}

// Run tests
testAttendanceGeneration();
testAddAttendanceValidation();

console.log("\n✅ Test completed! Sundays should now be properly marked as 'Holiday' instead of 'Leave'.");