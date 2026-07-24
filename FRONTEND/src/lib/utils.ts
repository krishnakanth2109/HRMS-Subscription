import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// utils.js
// Helper: get previous date string (YYYY-MM-DD)
export function getPrevDate(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Helper: get next date string (YYYY-MM-DD)
export function getNextDate(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns a list of sandwich leave dates for an employee.
 * @param approvedLeaves Array of approved leave dates (YYYY-MM-DD)
 * @param holidays Array of holiday dates (YYYY-MM-DD)
 */
export function getSandwichLeaveDates(approvedLeaves: string[], holidays: string[]): string[] {
  const leaveSet = new Set(approvedLeaves);
  const sandwichLeaves: string[] = [];
  holidays.forEach((holiday) => {
    const prev = getPrevDate(holiday);
    const next = getNextDate(holiday);
    if (leaveSet.has(prev) && leaveSet.has(next)) {
      sandwichLeaves.push(holiday);
    }
  });
  return sandwichLeaves;
}

/**
 * Returns the count of sandwich leaves for an employee.
 * @param approvedLeaves Array of approved leave dates (YYYY-MM-DD)
 * @param holidays Array of holiday dates (YYYY-MM-DD)
 */
export function getSandwichLeaveCount(approvedLeaves: string[], holidays: string[]): number {
  return getSandwichLeaveDates(approvedLeaves, holidays).length;
}

/**
 * Returns detailed sandwich leave information for an employee.
 * @param approvedLeaves Array of approved leave dates (YYYY-MM-DD)
 * @param holidays Array of holiday dates (YYYY-MM-DD)
 */
export function getSandwichLeaveDetails(approvedLeaves: string[], holidays: string[]): {
  count: number;
  dates: string[];
  details: Array<{
    holidayDate: string;
    leaveBefore: string;
    leaveAfter: string;
  }>;
} {
  const leaveSet = new Set(approvedLeaves);
  const sandwichLeaves: string[] = [];
  const details: Array<{
    holidayDate: string;
    leaveBefore: string;
    leaveAfter: string;
  }> = [];

  holidays.forEach((holiday) => {
    const prev = getPrevDate(holiday);
    const next = getNextDate(holiday);
    if (leaveSet.has(prev) && leaveSet.has(next)) {
      sandwichLeaves.push(holiday);
      details.push({
        holidayDate: holiday,
        leaveBefore: prev,
        leaveAfter: next,
      });
    }
  });

  return {
    count: sandwichLeaves.length,
    dates: sandwichLeaves,
    details,
  };
}

/**
 * Check if a specific date is a Sunday
 * @param dateStr Date string in YYYY-MM-DD format
 */
export function isSunday(dateStr: string): boolean {
  return new Date(dateStr).getDay() === 0;
}

/**
 * Get all Sundays in a given month
 * @param year Year (e.g., 2025)
 * @param month Month (1-12)
 */
export function getSundaysInMonth(year: number, month: number): string[] {
  const sundays: string[] = [];
  const date = new Date(year, month - 1, 1); // month is 0-indexed in Date constructor
  
  // Find first Sunday of the month
  while (date.getDay() !== 0 && date.getMonth() === month - 1) {
    date.setDate(date.getDate() + 1);
  }
  
  // Collect all Sundays in the month
  while (date.getMonth() === month - 1) {
    sundays.push(date.toISOString().slice(0, 10));
    date.setDate(date.getDate() + 7);
  }
  
  return sundays;
}
