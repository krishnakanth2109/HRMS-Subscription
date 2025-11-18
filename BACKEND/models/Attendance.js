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

  // ✅ ADDED: Location tracking for punch in/out
  punchInLocation: { type: LocationSchema, default: null },
  punchOutLocation: { type: LocationSchema, default: null },

  workedHours: { type: Number, default: 0 },
  workedMinutes: { type: Number, default: 0 },
  workedSeconds: { type: Number, default: 0 },

  displayTime: { type: String, default: "0h 0m 0s" },

  status: {
    type: String,
    enum: ["NOT_STARTED", "WORKING", "COMPLETED"],
    default: "NOT_STARTED",
  },

  loginStatus: {
    type: String,
    enum: ["ON_TIME", "LATE", "NOT_APPLICABLE"],
    default: "NOT_APPLICABLE",
  },

  workedStatus: {
    type: String,
    enum: ["FULL_DAY", "HALF_DAY", "QUARTER_DAY", "NOT_APPLICABLE"],
    default: "NOT_APPLICABLE",
  },
});

const AttendanceSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  employeeName: { type: String, required: true },
  attendance: [DailySchema],
});

export default mongoose.model("Attendance", AttendanceSchema);