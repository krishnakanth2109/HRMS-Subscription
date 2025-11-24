import mongoose from "mongoose";

const LocationSchema = new mongoose.Schema({
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  address: { type: String, default: null },
  timestamp: { type: Date, default: null }
}, { _id: false });

const DailySchema = new mongoose.Schema({
  date: { type: String, required: true },
  punchIn: { type: Date, default: null },
  punchOut: { type: Date, default: null },

  // Location tracking
  punchInLocation: { type: LocationSchema, default: null },
  punchOutLocation: { type: LocationSchema, default: null },

  workedHours: { type: Number, default: 0 },
  workedMinutes: { type: Number, default: 0 },
  workedSeconds: { type: Number, default: 0 },

  displayTime: { type: String, default: "0h 0m 0s" },

  status: {
    type: String,
    enum: ["NOT_STARTED", "WORKING", "COMPLETED", "ABSENT"],
    default: "NOT_STARTED",
  },

  loginStatus: {
    type: String,
    enum: ["ON_TIME", "LATE", "NOT_APPLICABLE"],
    default: "NOT_APPLICABLE",
  },

  // ✅ FIXED: Added "ABSENT" to the enum list to prevent crash
  workedStatus: {
    type: String,
    enum: ["FULL_DAY", "HALF_DAY", "QUARTER_DAY", "ABSENT", "NOT_APPLICABLE"],
    default: "NOT_APPLICABLE",
  },

  // ✅ ADDED: Because your route tries to save this field
  attendanceCategory: {
    type: String,
    enum: ["FULL_DAY", "HALF_DAY", "ABSENT", "NOT_APPLICABLE"],
    default: "NOT_APPLICABLE"
  }
});

const AttendanceSchema = new mongoose.Schema({
  // ✅ FIXED: unique: true is sufficient. Do not add index:true here to avoid duplicate warning.
  employeeId: { type: String, required: true, unique: true },
  employeeName: { type: String, required: true },
  attendance: [DailySchema],
});

export default mongoose.model("Attendance", AttendanceSchema);