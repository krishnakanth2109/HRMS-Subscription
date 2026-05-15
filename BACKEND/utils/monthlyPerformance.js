import DailyWorkEntry from "../models/DailyWorkEntry.js";
import Holiday from "../models/Holiday.js";
import Shift from "../models/shiftModel.js";
import Employee from "../models/employeeModel.js";

const HRMS_TIME_ZONE = "Asia/Kolkata";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const getDateKeyInTimeZone = (
  date = new Date(),
  timeZone = HRMS_TIME_ZONE
) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export const getTimeKeyInTimeZone = (
  date = new Date(),
  timeZone = HRMS_TIME_ZONE
) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

export const getDateObjectFromKey = (dateKey) =>
  new Date(`${dateKey}T00:00:00.000+05:30`);

export const getMonthDateRange = (month, year) => {
  const normalizedMonth = Number(month);
  const normalizedYear = Number(year);

  const startDate = new Date(
    `${normalizedYear}-${String(normalizedMonth).padStart(2, "0")}-01T00:00:00.000+05:30`
  );

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  endDate.setMilliseconds(endDate.getMilliseconds() - 1);

  return { startDate, endDate };
};

export const getDaysInMonth = (month, year) =>
  new Date(Number(year), Number(month), 0).getDate();

export const buildPerformanceSummary = ({
  approvedDays = 0,
  rejectedDays = 0,
  pendingDays = 0,
  totalDays,
  totalWorkPercentage = 0,
}) => {
  const approved = Number(approvedDays) || 0;
  const rejected = Number(rejectedDays) || 0;
  const pending = Number(pendingDays) || 0;
  const total = Number(totalDays) || 0;
  const workPercentageTotal = Number(totalWorkPercentage) || 0;
  const submittedDays = approved + rejected + pending;
  const missedDays = Math.max(total - submittedDays, 0);
  const performancePercentage =
    total > 0 ? Number(((approved / total) * 100).toFixed(2)) : 0;
  const monthlyWorkPercentage =
    total > 0 ? Number((workPercentageTotal / total).toFixed(2)) : 0;

  return {
    totalDays: total,
    approvedDays: approved,
    rejectedDays: rejected,
    pendingDays: pending,
    submittedDays,
    missedDays,
    performancePercentage,
    totalWorkPercentage: Number(workPercentageTotal.toFixed(2)),
    monthlyWorkPercentage,
  };
};

export const getCurrentMonthYear = (
  date = new Date(),
  timeZone = HRMS_TIME_ZONE
) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    month: Number(partMap.month),
    year: Number(partMap.year),
  };
};

const resolveEmployeeCodeForShift = async (employee) => {
  if (employee?.employeeId) {
    return employee.employeeId;
  }

  const employeeLookupId = employee?._id || employee;
  if (!employeeLookupId) {
    return null;
  }

  const employeeDoc = await Employee.findById(employeeLookupId).select("employeeId");
  return employeeDoc?.employeeId || null;
};

export const getEmployeeWeeklyOffDays = async (employee) => {
  const employeeCode = await resolveEmployeeCodeForShift(employee);
  const shift = employeeCode
    ? await Shift.findOne({ employeeId: employeeCode, isActive: true })
    : null;

  return Array.isArray(shift?.weeklyOffDays) && shift.weeklyOffDays.length > 0
    ? shift.weeklyOffDays
    : [0];
};

export const getHolidayDateKeysInRange = async (startDate, endDate) => {
  const holidays = await Holiday.find();
  const holidayKeys = new Set();

  holidays.forEach((holiday) => {
    const holidayStart = new Date(`${holiday.startDate}T00:00:00.000+05:30`);
    const holidayEnd = new Date(`${holiday.endDate}T00:00:00.000+05:30`);

    for (
      let currentDate = new Date(holidayStart);
      currentDate <= holidayEnd;
      currentDate.setDate(currentDate.getDate() + 1)
    ) {
      if (currentDate >= startDate && currentDate <= endDate) {
        holidayKeys.add(getDateKeyInTimeZone(currentDate));
      }
    }
  });

  return holidayKeys;
};

export const getWorkingDayBreakdown = async (employee, month, year) => {
  const { startDate, endDate } = getMonthDateRange(month, year);
  const weeklyOffDays = await getEmployeeWeeklyOffDays(employee);
  const holidayKeys = await getHolidayDateKeysInRange(startDate, endDate);

  const workingDateKeys = [];
  const weeklySummarySeed = {};

  for (
    let currentDate = new Date(startDate);
    currentDate <= endDate;
    currentDate.setDate(currentDate.getDate() + 1)
  ) {
    const currentKey = getDateKeyInTimeZone(currentDate);
    const localDate = new Date(`${currentKey}T00:00:00.000+05:30`);
    const dayOfWeek = localDate.getDay();
    const dayOfMonth = localDate.getDate();
    const weekNumber = Math.ceil(dayOfMonth / 7);
    const weekKey = `Week ${weekNumber}`;

    if (!weeklySummarySeed[weekKey]) {
      weeklySummarySeed[weekKey] = {
        weekLabel: weekKey,
        workingDays: 0,
        totalPercentage: 0,
      };
    }

    const isWeeklyOff = weeklyOffDays.includes(dayOfWeek);
    const isHoliday = holidayKeys.has(currentKey);

    if (!isWeeklyOff && !isHoliday) {
      workingDateKeys.push(currentKey);
      weeklySummarySeed[weekKey].workingDays += 1;
    }
  }

  return {
    workingDateKeys,
    totalWorkingDays: workingDateKeys.length,
    weeklySummarySeed,
    weeklyOffLabels: weeklyOffDays.map((day) => DAY_NAMES[day]),
    holidayCount: holidayKeys.size,
  };
};

export const buildWeeklyPerformance = (
  weeklySummarySeed,
  entries = [],
  totalWorkingDays = 0
) => {
  const weeklyMap = Object.fromEntries(
    Object.entries(weeklySummarySeed).map(([key, value]) => [key, { ...value }])
  );

  entries.forEach((entry) => {
    const entryKey = getDateKeyInTimeZone(new Date(entry.date));
    const localDate = new Date(`${entryKey}T00:00:00.000+05:30`);
    const weekKey = `Week ${Math.ceil(localDate.getDate() / 7)}`;

    if (!weeklyMap[weekKey]) {
      weeklyMap[weekKey] = {
        weekLabel: weekKey,
        workingDays: 0,
        totalPercentage: 0,
      };
    }

    weeklyMap[weekKey].totalPercentage += Number(entry.daily_work_percentage) || 0;
  });

  return Object.values(weeklyMap).map((week) => ({
    ...week,
    weeklyPercentage:
      totalWorkingDays > 0
        ? Number((week.totalPercentage / totalWorkingDays).toFixed(2))
        : 0,
  }));
};

export const calculateMonthlyPerformance = async (employee, month, year) => {
  const employeeId = employee?._id || employee;
  const { startDate, endDate } = getMonthDateRange(month, year);
  const {
    workingDateKeys,
    totalWorkingDays,
    weeklySummarySeed,
    weeklyOffLabels,
    holidayCount,
  } = await getWorkingDayBreakdown(employee, month, year);

  const entries = await DailyWorkEntry.find({
    employeeId,
    date: {
      $gte: startDate,
      $lte: endDate,
    },
  }).sort({ date: 1 });

  const workingEntries = entries.filter((entry) =>
    workingDateKeys.includes(getDateKeyInTimeZone(new Date(entry.date)))
  );

  const latestGeneratedEntry =
    [...workingEntries]
      .filter(
        (entry) => entry.percentage_generated_at || entry.percentage_mode !== "none"
      )
      .sort((leftEntry, rightEntry) => {
        const rightDate =
          new Date(rightEntry.percentage_generated_at || rightEntry.createdAt).getTime();
        const leftDate =
          new Date(leftEntry.percentage_generated_at || leftEntry.createdAt).getTime();

        return rightDate - leftDate;
      })[0] || null;

  const counts = workingEntries.reduce(
    (accumulator, entry) => {
      accumulator[entry.status] += 1;
      accumulator.totalWorkPercentage += Number(entry.daily_work_percentage) || 0;
      return accumulator;
    },
    { approved: 0, rejected: 0, pending: 0, totalWorkPercentage: 0 }
  );

  const summary = buildPerformanceSummary({
    approvedDays: counts.approved,
    rejectedDays: counts.rejected,
    pendingDays: counts.pending,
    totalDays: totalWorkingDays,
    totalWorkPercentage: counts.totalWorkPercentage,
  });

  const latestDailyPercentage = Number(latestGeneratedEntry?.daily_work_percentage || 0);
  const employeePortalDailyPercentage =
    totalWorkingDays > 0
      ? Number((latestDailyPercentage / totalWorkingDays).toFixed(2))
      : 0;

  return {
    ...summary,
    totalCalendarDays: getDaysInMonth(month, year),
    totalWorkingDays,
    holidayCount,
    weeklyOffLabels,
    employeePortalDailyPercentage,
    latestGeneratedDate: latestGeneratedEntry?.date || null,
    weeklyPerformance: buildWeeklyPerformance(
      weeklySummarySeed,
      workingEntries,
      totalWorkingDays
    ),
  };
};
