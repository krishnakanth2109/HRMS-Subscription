// Test script to verify sandwich leave scenarios
// This script tests the sandwich leave calculation with our new data

// Mock data based on our providers
const holidays = [
  "2025-01-01", "2025-01-26", "2025-02-26", "2025-03-14", "2025-04-18",
  "2025-04-14", "2025-05-01", "2025-06-06", "2025-08-15", "2025-08-18",
  "2025-08-25", "2025-10-02", "2025-10-02", "2025-10-20", "2025-12-25",
  // Strategic holidays for sandwich leave
  "2025-07-13", "2025-08-13", "2025-09-17", "2025-11-12", "2025-12-10"
];

const leaveRequests = [
  // EMP101 - July scenario: Leave on 12th (Sat) and 14th (Mon), holiday on 13th (Sun)
  { employeeId: "EMP101", from: "2025-07-12", to: "2025-07-12", status: "Approved" },
  { employeeId: "EMP101", from: "2025-07-14", to: "2025-07-14", status: "Approved" },
  
  // EMP102 - August scenario: Leave on 12th (Tue) and 14th (Thu), holiday on 13th (Wed)
  { employeeId: "EMP102", from: "2025-08-12", to: "2025-08-12", status: "Approved" },
  { employeeId: "EMP102", from: "2025-08-14", to: "2025-08-14", status: "Approved" },
  
  // EMP103 - September scenario: Leave on 16th (Tue) and 18th (Thu), holiday on 17th (Wed)
  { employeeId: "EMP103", from: "2025-09-16", to: "2025-09-16", status: "Approved" },
  { employeeId: "EMP103", from: "2025-09-18", to: "2025-09-18", status: "Approved" },
  
  // EMP104 - November scenario: Leave on 11th (Tue) and 13th (Thu), holiday on 12th (Wed)
  { employeeId: "EMP104", from: "2025-11-11", to: "2025-11-11", status: "Approved" },
  { employeeId: "EMP104", from: "2025-11-13", to: "2025-11-13", status: "Approved" },
  
  // EMP105 - December scenario: Leave on 9th (Tue) and 11th (Thu), holiday on 10th (Wed)
  { employeeId: "EMP105", from: "2025-12-09", to: "2025-12-09", status: "Approved" },
  { employeeId: "EMP105", from: "2025-12-11", to: "2025-12-11", status: "Approved" },
];

// Helper functions (copied from utils.ts)
function getPrevDate(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getNextDate(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function expandLeaveRange(from, to) {
  const dates = [];
  let current = new Date(from);
  const end = new Date(to);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function getSandwichLeaveDates(approvedLeaves, holidays) {
  const leaveSet = new Set(approvedLeaves);
  const sandwichLeaves = [];
  holidays.forEach((holiday) => {
    const prev = getPrevDate(holiday);
    const next = getNextDate(holiday);
    if (leaveSet.has(prev) && leaveSet.has(next)) {
      sandwichLeaves.push(holiday);
    }
  });
  return sandwichLeaves;
}

function getApprovedLeaveDatesByEmployee(employeeId) {
  return leaveRequests
    .filter(lr => lr.employeeId === employeeId && lr.status === "Approved")
    .flatMap(lr => expandLeaveRange(lr.from, lr.to));
}

// Test each employee's sandwich leave scenarios
console.log("=== SANDWICH LEAVE SCENARIOS TEST ===\n");

const employees = ["EMP101", "EMP102", "EMP103", "EMP104", "EMP105"];

employees.forEach(empId => {
  console.log(`Employee: ${empId}`);
  
  // Get approved leave dates
  const approvedLeaves = getApprovedLeaveDatesByEmployee(empId);
  console.log(`  Approved Leave Dates: ${approvedLeaves.join(", ")}`);
  
  // Calculate sandwich leaves
  const sandwichLeaves = getSandwichLeaveDates(approvedLeaves, holidays);
  console.log(`  Sandwich Leave Dates: ${sandwichLeaves.join(", ")}`);
  console.log(`  Sandwich Leave Count: ${sandwichLeaves.length}`);
  
  // Show the sandwich pattern
  sandwichLeaves.forEach(holiday => {
    const prev = getPrevDate(holiday);
    const next = getNextDate(holiday);
    console.log(`    Pattern: ${prev} (Leave) -> ${holiday} (Holiday) -> ${next} (Leave)`);
  });
  
  console.log("");
});

// Summary
const totalSandwichLeaves = employees.reduce((total, empId) => {
  const approvedLeaves = getApprovedLeaveDatesByEmployee(empId);
  const sandwichLeaves = getSandwichLeaveDates(approvedLeaves, holidays);
  return total + sandwichLeaves.length;
}, 0);

console.log(`=== SUMMARY ===`);
console.log(`Total Employees with Sandwich Leaves: ${employees.length}`);
console.log(`Total Sandwich Leave Days: ${totalSandwichLeaves}`);
console.log(`Strategic Holidays Added: 5`);
console.log(`Strategic Leave Requests Added: 10`);

// Verify specific scenarios
console.log(`\n=== SCENARIO VERIFICATION ===`);
console.log(`EMP101 - July 13th (2025-07-13) should be sandwich leave: ${getSandwichLeaveDates(getApprovedLeaveDatesByEmployee("EMP101"), holidays).includes("2025-07-13") ? "✓ PASS" : "✗ FAIL"}`);
console.log(`EMP102 - August 13th (2025-08-13) should be sandwich leave: ${getSandwichLeaveDates(getApprovedLeaveDatesByEmployee("EMP102"), holidays).includes("2025-08-13") ? "✓ PASS" : "✗ FAIL"}`);
console.log(`EMP103 - September 17th (2025-09-17) should be sandwich leave: ${getSandwichLeaveDates(getApprovedLeaveDatesByEmployee("EMP103"), holidays).includes("2025-09-17") ? "✓ PASS" : "✗ FAIL"}`);
console.log(`EMP104 - November 12th (2025-11-12) should be sandwich leave: ${getSandwichLeaveDates(getApprovedLeaveDatesByEmployee("EMP104"), holidays).includes("2025-11-12") ? "✓ PASS" : "✗ FAIL"}`);
console.log(`EMP105 - December 10th (2025-12-10) should be sandwich leave: ${getSandwichLeaveDates(getApprovedLeaveDatesByEmployee("EMP105"), holidays).includes("2025-12-10") ? "✓ PASS" : "✗ FAIL"}`);