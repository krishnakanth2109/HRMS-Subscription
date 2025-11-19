import mongoose from "mongoose";

// ----------------------------
// Idle Span Schema
// ----------------------------
const idleSpanSchema = new mongoose.Schema(
  {
    idleStart: { type: Date, required: true },
    idleEnd: { type: Date, required: true },
    idleDurationSeconds: { type: Number, required: true },
  },
  { _id: true }
);

// ----------------------------
// Main IdleTime Schema
// ----------------------------
const idleTimeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    department: { type: String },
    role: { type: String },

    // Day format YYYY-MM-DD
    date: { type: String, required: true },

    // All idle sessions for that day
    idleTimeline: {
      type: [idleSpanSchema],
      default: [],
    },

    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// ----------------------------
// 🔒 UNIQUE INDEX (VERY IMPORTANT)
// Ensures only 1 record per employee per day
// ----------------------------
idleTimeSchema.index(
  { employeeId: 1, date: 1 },
  { unique: true }
);

// ----------------------------
// 🔍 Avoid storing duplicate idle spans in timeline
// (Extra protection on DB level)
// ----------------------------
idleTimeSchema.pre("save", function (next) {
  if (!this.idleTimeline || this.idleTimeline.length === 0) {
    return next();
  }

  // Remove duplicate idle spans with same start/end
  const unique = [];
  const seen = new Set();

  this.idleTimeline.forEach((span) => {
    const key = span.idleStart.toISOString() + "-" + span.idleEnd.toISOString();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(span);
    }
  });

  this.idleTimeline = unique;
  next();
});

export default mongoose.model("IdleTime", idleTimeSchema);
