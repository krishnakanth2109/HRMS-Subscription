// const IST_TIME_ZONE = "Asia/Kolkata";

// const WINDOW_MINUTES = {
//   morningStart: 8 * 60,
//   morningEnd: 11 * 60,
//   eveningStart: 18 * 60,
//   eveningEnd: 20 * 60,
// };

// const getTimeZoneParts = (date, timeZone = IST_TIME_ZONE) => {
//   const formatter = new Intl.DateTimeFormat("en-US", {
//     timeZone,
//     year: "numeric",
//     month: "2-digit",
//     day: "2-digit",
//     hour: "2-digit",
//     minute: "2-digit",
//     hour12: false,
//   });

//   const parts = formatter.formatToParts(date).reduce((acc, part) => {
//     if (part.type !== "literal") acc[part.type] = part.value;
//     return acc;
//   }, {});

//   return {
//     year: Number(parts.year),
//     month: Number(parts.month),
//     day: Number(parts.day),
//     hour: Number(parts.hour),
//     minute: Number(parts.minute),
//   };
// };

// const toDateString = ({ year, month, day }) =>
//   `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

// const toMinutes = ({ hour, minute }) => hour * 60 + minute;

// const isWithinWindow = (value, start, end) => value >= start && value <= end;

// const hasOpenWorkSession = (todayAttendance) =>
//   Array.isArray(todayAttendance?.sessions) &&
//   todayAttendance.sessions.some((session) => session?.punchIn && !session?.punchOut);

// export const getFingerprintAttendanceDecision = ({
//   loginMethod,
//   now = new Date(),
//   todayAttendance = null,
//   timeZone = IST_TIME_ZONE,
// } = {}) => {
//   const parts = getTimeZoneParts(now, timeZone);
//   const today = toDateString(parts);
//   const currentMinutes = toMinutes(parts);

//   if (loginMethod !== "fingerprint") {
//     return { action: "NONE", reason: "non_fingerprint_login", today };
//   }

//   const hasPunchIn = Boolean(todayAttendance?.punchIn);
//   const hasFinalPunchOut =
//     Boolean(todayAttendance?.punchOut) &&
//     (Boolean(todayAttendance?.isFinalPunchOut) || Boolean(todayAttendance?.adminPunchOut));

//   if (!hasPunchIn) {
//     if (
//       isWithinWindow(
//         currentMinutes,
//         WINDOW_MINUTES.morningStart,
//         WINDOW_MINUTES.morningEnd
//       )
//     ) {
//       return { action: "PUNCH_IN", reason: "first_fingerprint_login_morning", today };
//     }

//     return { action: "NONE", reason: "outside_punch_in_window", today };
//   }

//   if (hasFinalPunchOut) {
//     return { action: "NONE", reason: "already_punched_out", today };
//   }

//   if (!hasOpenWorkSession(todayAttendance)) {
//     return { action: "NONE", reason: "no_open_work_session", today };
//   }

//   if (
//     isWithinWindow(
//       currentMinutes,
//       WINDOW_MINUTES.eveningStart,
//       WINDOW_MINUTES.eveningEnd
//     )
//   ) {
//     return { action: "PUNCH_OUT", reason: "fingerprint_login_evening", today };
//   }

//   return { action: "NONE", reason: "outside_punch_out_window", today };
// };

// export { IST_TIME_ZONE };
