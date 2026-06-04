import mongoose from "mongoose";

const coordinateSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, default: null },
    speed: { type: Number, default: null },
    heading: { type: Number, default: null },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const stopSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    stoppedAt: { type: Date, default: Date.now },
    durationSeconds: { type: Number, default: 0 },
  },
  { _id: false },
);

const fieldWorkTripSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now, index: true },
    endedAt: { type: Date, default: null },
    path: { type: [coordinateSchema], default: [] },
    distanceKm: { type: Number, default: 0 },
    stoppedSeconds: { type: Number, default: 0 },
    stops: { type: [stopSchema], default: [] },
  },
  { timestamps: true },
);

fieldWorkTripSchema.index({ adminId: 1, employee: 1, startedAt: -1 });
fieldWorkTripSchema.index({ employee: 1, status: 1 });

export default mongoose.model("FieldWorkTrip", fieldWorkTripSchema);
