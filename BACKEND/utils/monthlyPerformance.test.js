import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPerformanceSummary,
  getDateKeyInTimeZone,
  getDaysInMonth,
  getMonthDateRange,
  getTimeKeyInTimeZone,
} from "./monthlyPerformance.js";

test("buildPerformanceSummary calculates percentage and missed days", () => {
  const summary = buildPerformanceSummary({
    approvedDays: 12,
    rejectedDays: 3,
    pendingDays: 2,
    totalDays: 30,
    totalWorkPercentage: 840,
  });

  assert.deepEqual(summary, {
    totalDays: 30,
    approvedDays: 12,
    rejectedDays: 3,
    pendingDays: 2,
    submittedDays: 17,
    missedDays: 13,
    performancePercentage: 40,
    totalWorkPercentage: 840,
    monthlyWorkPercentage: 28,
  });
});

test("buildPerformanceSummary uses working-day total for monthly work percentage", () => {
  const summary = buildPerformanceSummary({
    approvedDays: 16,
    rejectedDays: 2,
    pendingDays: 1,
    totalDays: 20,
    totalWorkPercentage: 1400,
  });

  assert.equal(summary.monthlyWorkPercentage, 70);
  assert.equal(summary.missedDays, 1);
});

test("getDaysInMonth supports leap-year February", () => {
  assert.equal(getDaysInMonth(2, 2028), 29);
  assert.equal(getDaysInMonth(2, 2027), 28);
});

test("timezone helpers return IST date and time keys", () => {
  const date = new Date("2026-04-16T13:45:10.000Z");

  assert.equal(getDateKeyInTimeZone(date), "2026-04-16");
  assert.equal(getTimeKeyInTimeZone(date), "19:15:10");
});

test("getMonthDateRange returns inclusive month bounds", () => {
  const { startDate, endDate } = getMonthDateRange(4, 2026);

  assert.equal(startDate.toISOString(), "2026-03-31T18:30:00.000Z");
  assert.equal(endDate.toISOString(), "2026-04-30T18:29:59.999Z");
});
