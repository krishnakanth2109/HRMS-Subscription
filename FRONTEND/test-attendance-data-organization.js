// Test script to verify attendance data organization
const testAttendanceDataOrganization = () => {
  console.log("🧪 Testing Attendance Data Organization Logic");
  console.log("=" .repeat(50));

  // Mock data similar to what's in the providers
  const mockEmployees = [
    { employeeId: "EMP101", name: "John Doe" },
    { employeeId: "EMP102", name: "Alice Johnson" }
  ];

  const mockHolidays = [
    "2025-01-01", // New Year
    "2025-01-26", // Republic Day
    "2025-07-13", // Strategic holiday
    "2025-08-15"  // Independence Day
  ];

  const mockLeaveRequests = [
    {
      employeeId: "EMP101",
      from: "2025-07-10",
      to: "2025-07-12",
      status: "Approved"
    },
    {
      employeeId: "EMP102",
      from: "2025-08-14",
      to: "2025-08-16",
      status: "Approved"
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

  // Test the logic for different scenarios
  const testCases = [
    { date: "2025-07-06", expected: "Holiday", reason: "Sunday" },
    { date: "2025-07-13", expected: "Holiday", reason: "Public Holiday" },
    { date: "2025-07-10", expected: "Leave", reason: "Approved Leave for EMP101" },
    { date: "2025-07-14", expected: "Present", reason: "Regular working day" },
    { date: "2025-08-15", expected: "Holiday", reason: "Independence Day" }
  ];

  console.log("Testing status determination logic:");
  console.log("-".repeat(40));

  testCases.forEach(testCase => {
    const { date, expected, reason } = testCase;
    const dayOfWeek = getDayOfWeek(date);
    let actualStatus = "Present";
    let statusType = "working_day";

    // Apply the same logic as in AttendanceProvider
    if (dayOfWeek === 0) {
      actualStatus = "Holiday";
      statusType = "holiday";
    } else if (mockHolidays.includes(date)) {
      actualStatus = "Holiday";
      statusType = "holiday";
    } else {
      const employeeLeave = mockLeaveRequests.find(leave =>
        leave.employeeId === "EMP101" &&
        leave.status === "Approved" &&
        isDateInLeaveRange(date, leave.from, leave.to)
      );
      if (employeeLeave) {
        actualStatus = "Leave";
        statusType = "approved_leave";
      }
    }

    const result = actualStatus === expected ? "✅ PASS" : "❌ FAIL";
    console.log(`${result} ${date} (${getDayName(dayOfWeek)}): Expected "${expected}", Got "${actualStatus}" - ${reason}`);
  });

  console.log("\n" + "=".repeat(50));
  console.log("📊 Data Organization Summary:");
  console.log("- Holiday: Public holidays and Sundays");
  console.log("- Leave: Approved leave requests");
  console.log("- Present: Employee punched in (with punch times)");
  console.log("- Absent: Employee didn't come without approved leave");
  console.log("=".repeat(50));
};

// Helper function to get day name
const getDayName = (dayOfWeek) => {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[dayOfWeek];
};

// Run the test
testAttendanceDataOrganization();