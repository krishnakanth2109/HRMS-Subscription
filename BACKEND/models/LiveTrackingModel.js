import mongoose from "mongoose";

// ---------------------------------------------------
// Schema for an individual IDLE time segment
// ---------------------------------------------------
const idleSegmentSchema = new mongoose.Schema(
    {
        startTime: { type: Date, required: true },
        endTime: { type: Date, required: true },
        idleDurationSeconds: { type: Number, required: false }
    },
    { _id: false }
);

// ---------------------------------------------------
// Sub-object schema for each date's logged data
// ---------------------------------------------------
const dailyLiveSchema = new mongoose.Schema(
    {
        currentStatus: { type: String, enum: ["WORKING", "IDLE", "OFFLINE"], default: "OFFLINE" },
        lastPing: { type: Date },
        idleSince: { type: Date, default: null },
        idleTimeline: { type: [idleSegmentSchema], default: [] },
        trackedWorkSeconds: { type: Number, default: 0 },
        trackedIdleSeconds: { type: Number, default: 0 }
    },
    { _id: false, timestamps: true }
);

// ---------------------------------------------------
// Main LiveTracking Schema
// ONE document per employee, with dates as sub-objects
// ---------------------------------------------------
const liveTrackingSchema = new mongoose.Schema(
    {
        employeeId: { type: String, required: true, unique: true },
        dates: {
            type: Map,
            of: dailyLiveSchema,
            default: {}
        }
    },
    { timestamps: true }
);

export default mongoose.model("LiveTracking", liveTrackingSchema);