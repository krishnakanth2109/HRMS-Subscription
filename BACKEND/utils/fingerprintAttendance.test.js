// import test from "node:test";
// import assert from "node:assert/strict";

// import { getFingerprintAttendanceDecision } from "./fingerprintAttendance.js";

// const atUtc = (value) => new Date(value);

// test("returns no action for non-fingerprint sessions", () => {
//   const result = getFingerprintAttendanceDecision({
//     loginMethod: "password",
//     now: atUtc("2026-04-09T03:30:00.000Z"),
//   });

//   assert.equal(result.action, "NONE");
//   assert.equal(result.reason, "non_fingerprint_login");
// });

// test("returns punch in for first fingerprint login during morning window", () => {
//   const result = getFingerprintAttendanceDecision({
//     loginMethod: "fingerprint",
//     now: atUtc("2026-04-09T03:30:00.000Z"),
//     todayAttendance: null,
//   });

//   assert.equal(result.action, "PUNCH_IN");
// });

// test("does not return punch in before 08:00 IST", () => {
//   const result = getFingerprintAttendanceDecision({
//     loginMethod: "fingerprint",
//     now: atUtc("2026-04-09T02:20:00.000Z"),
//     todayAttendance: null,
//   });

//   assert.equal(result.action, "NONE");
//   assert.equal(result.reason, "outside_punch_in_window");
// });

// test("returns punch out during evening window when an open work session exists", () => {
//   const result = getFingerprintAttendanceDecision({
//     loginMethod: "fingerprint",
//     now: atUtc("2026-04-09T13:30:00.000Z"),
//     todayAttendance: {
//       punchIn: atUtc("2026-04-09T03:10:00.000Z"),
//       sessions: [{ punchIn: atUtc("2026-04-09T03:10:00.000Z"), punchOut: null }],
//       isFinalPunchOut: false,
//       adminPunchOut: false,
//     },
//   });

//   assert.equal(result.action, "PUNCH_OUT");
// });

// test("does not return punch out when the day is already finalized", () => {
//   const result = getFingerprintAttendanceDecision({
//     loginMethod: "fingerprint",
//     now: atUtc("2026-04-09T13:30:00.000Z"),
//     todayAttendance: {
//       punchIn: atUtc("2026-04-09T03:10:00.000Z"),
//       punchOut: atUtc("2026-04-09T12:40:00.000Z"),
//       sessions: [
//         {
//           punchIn: atUtc("2026-04-09T03:10:00.000Z"),
//           punchOut: atUtc("2026-04-09T12:40:00.000Z"),
//         },
//       ],
//       isFinalPunchOut: true,
//       adminPunchOut: false,
//     },
//   });

//   assert.equal(result.action, "NONE");
//   assert.equal(result.reason, "already_punched_out");
// });
