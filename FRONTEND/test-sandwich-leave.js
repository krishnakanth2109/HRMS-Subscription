// Test file to verify sandwich leave calculation
// Inline implementation of the sandwich leave logic for testing

// Helper: get previous date string (YYYY-MM-DD)
function getPrevDate(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Helper: get next date string (YYYY-MM-DD)
function getNextDate(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns a list of sandwich leave dates for an employee.
 * @param approvedLeaves Array of approved leave dates (YYYY-MM-DD)
 * @param holidays Array of holiday dates (YYYY-MM-DD)
 */
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

// Test data
const approvedLeaves = [
  '2025-07-11', // Friday - before weekend
  '2025-07-14', // Monday - after weekend
  '2025-08-14', // Thursday - before Independence Day
  '2025-08-16', // Friday - after Independence Day
];

const holidays = [
  '2025-01-01', // New Year's Day
  '2025-01-26', // Republic Day
  '2025-08-15', // Independence Day
  '2025-10-02', // Gandhi Jayanti
  '2025-12-25', // Christmas
];

console.log('🧪 Testing Sandwich Leave Calculation...\n');

console.log('📅 Approved Leave Dates:', approvedLeaves);
console.log('🎉 Holiday Dates:', holidays);

const sandwichLeaves = getSandwichLeaveDates(approvedLeaves, holidays);

console.log('\n📊 Sandwich Leave Results:');
console.log('🥪 Sandwich Leave Dates:', sandwichLeaves);
console.log('📈 Total Sandwich Leaves:', sandwichLeaves.length);

// Expected result: Independence Day (2025-08-15) should be identified as sandwich leave
// because there are approved leaves on 2025-08-14 and 2025-08-16

console.log('\n🔍 Detailed Analysis:');
holidays.forEach(holiday => {
  const prev = getPrevDate(holiday);
  const next = getNextDate(holiday);
  const hasPrevLeave = approvedLeaves.includes(prev);
  const hasNextLeave = approvedLeaves.includes(next);
  const isSandwich = hasPrevLeave && hasNextLeave;
  
  console.log(`Holiday: ${holiday}`);
  console.log(`  Previous day (${prev}): ${hasPrevLeave ? '✅ Leave' : '❌ No Leave'}`);
  console.log(`  Next day (${next}): ${hasNextLeave ? '✅ Leave' : '❌ No Leave'}`);
  console.log(`  Is Sandwich Leave: ${isSandwich ? '🥪 YES' : '❌ NO'}`);
  console.log('');
});

if (sandwichLeaves.includes('2025-08-15')) {
  console.log('✅ Test PASSED: Independence Day correctly identified as sandwich leave');
} else {
  console.log('❌ Test FAILED: Independence Day should be identified as sandwich leave');
}

// Test edge case: No sandwich leaves
const noSandwichLeaves = ['2025-07-01', '2025-07-02'];
const noSandwichResult = getSandwichLeaveDates(noSandwichLeaves, holidays);

console.log('\n🧪 Edge Case Test (No Sandwich Leaves):');
console.log('📅 Leave Dates:', noSandwichLeaves);
console.log('🥪 Sandwich Leaves:', noSandwichResult);

if (noSandwichResult.length === 0) {
  console.log('✅ Edge Case PASSED: No sandwich leaves correctly identified');
} else {
  console.log('❌ Edge Case FAILED: Should have no sandwich leaves');
}

// Test realistic HRMS scenario
console.log('\n🏢 HRMS Realistic Scenario Test:');
const hrmsApprovedLeaves = [
  '2025-07-12', // Saturday (weekend leave)
  '2025-07-14', // Monday (after Sunday holiday)
];

const hrmsHolidays = [
  '2025-07-13', // Sunday (public holiday)
];

const hrmsSandwichResult = getSandwichLeaveDates(hrmsApprovedLeaves, hrmsHolidays);
console.log('📅 HRMS Leave Dates:', hrmsApprovedLeaves);
console.log('🎉 HRMS Holiday Dates:', hrmsHolidays);
console.log('🥪 HRMS Sandwich Leaves:', hrmsSandwichResult);

if (hrmsSandwichResult.includes('2025-07-13')) {
  console.log('✅ HRMS Test PASSED: Sunday correctly identified as sandwich leave');
} else {
  console.log('❌ HRMS Test FAILED: Sunday should be identified as sandwich leave');
}

console.log('\n🎉 Sandwich Leave Calculation Test Complete!');
console.log('📋 Summary:');
console.log(`   - Main Test: ${sandwichLeaves.includes('2025-08-15') ? 'PASSED' : 'FAILED'}`);
console.log(`   - Edge Case: ${noSandwichResult.length === 0 ? 'PASSED' : 'FAILED'}`);
console.log(`   - HRMS Scenario: ${hrmsSandwichResult.includes('2025-07-13') ? 'PASSED' : 'FAILED'}`);