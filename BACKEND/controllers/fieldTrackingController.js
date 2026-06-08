import mongoose from "mongoose";
import Employee from "../models/employeeModel.js";
import FieldTrackingSetting from "../models/FieldTrackingSetting.js";
import FieldWorkTrip from "../models/FieldWorkTrip.js";

const getRootAdminId = (user) => user?.adminId || user?._id;

const getActorId = (user) => user?.actualId || user?._id;

const isEmployeeRole = (user) => String(user?.role || "").toLowerCase() === "employee";

const isAdminRole = (user) => ["admin", "support-admin"].includes(String(user?.role || "").toLowerCase());

const normalizeCoordinate = ({ latitude, longitude, accuracy, speed, heading, recordedAt }) => {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return {
    latitude: lat,
    longitude: lng,
    accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
    speed: Number.isFinite(Number(speed)) ? Number(speed) : null,
    heading: Number.isFinite(Number(heading)) ? Number(heading) : null,
    recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
  };
};

const getDateRange = (date) => {
  const dateKey = date || new Date().toISOString().slice(0, 10);
  return {
    start: new Date(`${dateKey}T00:00:00.000+05:30`),
    end: new Date(`${dateKey}T23:59:59.999+05:30`),
    dateKey,
  };
};

const formatTrip = (trip) => ({
  _id: trip._id,
  adminId: trip.adminId,
  companyId: trip.companyId,
  employee: trip.employee,
  employeeId: trip.employeeId,
  employeeName: trip.employeeName,
  status: trip.status,
  startedAt: trip.startedAt,
  endedAt: trip.endedAt,
  path: trip.path || [],
  distanceKm: trip.distanceKm || 0,
  stoppedSeconds: trip.stoppedSeconds || 0,
  stops: trip.stops || [],
  createdAt: trip.createdAt,
  updatedAt: trip.updatedAt,
});

const emitFieldTrackingEvent = (io, adminId, event, payload) => {
  if (!io || !adminId) return;
  io.to(`user_${adminId.toString()}`).emit(event, payload);
};

const normalizeStops = (stops = []) =>
  (Array.isArray(stops) ? stops : [])
    .map((stop) => {
      const coordinate = normalizeCoordinate({
        latitude: stop.latitude,
        longitude: stop.longitude,
        recordedAt: stop.stoppedAt,
      });
      if (!coordinate) return null;
      return {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        stoppedAt: coordinate.recordedAt,
        durationSeconds: Number(stop.durationSeconds) || 0,
      };
    })
    .filter(Boolean);

export const recordFieldWorkLocationForEmployee = async ({
  employee,
  tripId,
  body = {},
  io = null,
}) => {
  const setting = await FieldTrackingSetting.findOne({ adminId: employee.adminId }).lean();
  if (!setting?.enabled) {
    return {
      error: {
        status: 403,
        trackingDisabled: true,
        message: "Live tracking is currently off. Location was not recorded.",
      },
    };
  }

  const point = normalizeCoordinate(body);
  if (!point) {
    return { error: { status: 400, message: "Valid latitude and longitude are required." } };
  }

  const query = {
    employee: employee._id,
    status: "active",
  };

  if (tripId && mongoose.Types.ObjectId.isValid(tripId)) {
    query._id = tripId;
  }

  const updateSet = {
    distanceKm: Number(body.distanceKm) || 0,
    stoppedSeconds: Number(body.stoppedSeconds) || 0,
  };

  if (Array.isArray(body.stops)) {
    updateSet.stops = normalizeStops(body.stops);
  }

  const trip = await FieldWorkTrip.findOneAndUpdate(
    query,
    {
      $push: { path: point },
      $set: updateSet,
    },
    { new: true },
  );

  if (!trip) {
    return { error: { status: 404, message: "No active field work trip found." } };
  }

  const payload = {
    tripId: trip._id,
    employee: employee._id,
    employeeId: employee.employeeId,
    employeeName: employee.name,
    point,
    pathLength: trip.path?.length || 0,
    distanceKm: trip.distanceKm || 0,
    stoppedSeconds: trip.stoppedSeconds || 0,
    stops: trip.stops || [],
    status: trip.status,
    startedAt: trip.startedAt,
    updatedAt: trip.updatedAt,
  };

  emitFieldTrackingEvent(io, employee.adminId, "fieldTracking:location", payload);

  return { trip: formatTrip(trip), payload };
};

export const getFieldTrackingSetting = async (req, res) => {
  try {
    const adminId = getRootAdminId(req.user);
    if (!adminId) {
      return res.status(400).json({ message: "Unable to resolve admin account." });
    }

    const setting = await FieldTrackingSetting.findOne({ adminId }).lean();
    return res.json({
      enabled: Boolean(setting?.enabled),
      updatedAt: setting?.updatedAt || null,
    });
  } catch (error) {
    console.error("Error fetching field tracking setting:", error);
    return res.status(500).json({ message: "Failed to fetch field tracking setting." });
  }
};

export const updateFieldTrackingSetting = async (req, res) => {
  try {
    if (!isAdminRole(req.user)) {
      return res.status(403).json({ message: "Only admins can update live tracking." });
    }

    const adminId = getRootAdminId(req.user);
    const enabled = Boolean(req.body?.enabled);

    const setting = await FieldTrackingSetting.findOneAndUpdate(
      { adminId },
      {
        $set: {
          enabled,
          updatedBy: getActorId(req.user),
          updatedByModel: req.user.role === "support-admin" ? "SupportAdmin" : "Admin",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    return res.json({
      message: enabled ? "Live field tracking enabled." : "Live field tracking disabled.",
      enabled: setting.enabled,
      updatedAt: setting.updatedAt,
    });
  } catch (error) {
    console.error("Error updating field tracking setting:", error);
    return res.status(500).json({ message: "Failed to update field tracking setting." });
  }
};

export const listTrackingEmployees = async (req, res) => {
  try {
    if (!isAdminRole(req.user)) {
      return res.status(403).json({ message: "Only admins can view employees." });
    }

    const adminId = getRootAdminId(req.user);
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(5, Number.parseInt(req.query.limit, 10) || 10));
    const search = String(req.query.search || "").trim();

    const query = { adminId, isActive: true, status: { $ne: "Inactive" } };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const [employees, total] = await Promise.all([
      Employee.find(query)
        .select("_id employeeId name email company companyName currentRole currentDepartment")
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Employee.countDocuments(query),
    ]);

    const employeeIds = employees.map((employee) => employee._id);
    const activeTrips = await FieldWorkTrip.find({
      adminId,
      employee: { $in: employeeIds },
      status: "active",
    })
      .select("employee updatedAt")
      .lean();

    const liveEmployeeMap = new Map(
      activeTrips.map((trip) => [String(trip.employee), trip.updatedAt]),
    );

    return res.json({
      data: employees.map((employee) => ({
        ...employee,
        isFieldLive: liveEmployeeMap.has(String(employee._id)),
        lastFieldUpdateAt: liveEmployeeMap.get(String(employee._id)) || null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Error listing field tracking employees:", error);
    return res.status(500).json({ message: "Failed to fetch employees." });
  }
};

export const startFieldWorkTrip = async (req, res) => {
  try {
    if (!isEmployeeRole(req.user)) {
      return res.status(403).json({ message: "Only employees can start field work." });
    }

    const employee = req.user;
    const adminId = employee.adminId;
    const companyId = employee.company;

    const setting = await FieldTrackingSetting.findOne({ adminId }).lean();
    if (!setting?.enabled) {
      return res.status(403).json({
        trackingDisabled: true,
        message: "Live tracking is currently off. Please contact admin before starting field work.",
      });
    }

    const activeTrip = await FieldWorkTrip.findOne({
      employee: employee._id,
      status: "active",
    });

    if (activeTrip) {
      emitFieldTrackingEvent(req.app.get("io"), adminId, "fieldTracking:tripStarted", {
        trip: formatTrip(activeTrip),
      });
      return res.json({ message: "Active field work trip resumed.", trip: formatTrip(activeTrip) });
    }

    const firstPoint = normalizeCoordinate(req.body || {});
    const trip = await FieldWorkTrip.create({
      adminId,
      companyId,
      employee: employee._id,
      employeeId: employee.employeeId,
      employeeName: employee.name,
      status: "active",
      startedAt: new Date(),
      path: firstPoint ? [firstPoint] : [],
    });

    emitFieldTrackingEvent(req.app.get("io"), adminId, "fieldTracking:tripStarted", {
      trip: formatTrip(trip),
    });

    return res.status(201).json({ message: "Field work trip started.", trip: formatTrip(trip) });
  } catch (error) {
    console.error("Error starting field work trip:", error);
    return res.status(500).json({ message: "Failed to start field work trip." });
  }
};

export const postFieldWorkLocation = async (req, res) => {
  try {
    if (!isEmployeeRole(req.user)) {
      return res.status(403).json({ message: "Only employees can post field locations." });
    }

    const tripId = req.params.tripId || req.body.tripId;
    const result = await recordFieldWorkLocationForEmployee({
      employee: req.user,
      tripId,
      body: req.body || {},
      io: req.app.get("io"),
    });

    if (result.error) {
      return res.status(result.error.status).json({
        trackingDisabled: result.error.trackingDisabled,
        message: result.error.message,
      });
    }

    return res.json({ message: "Location recorded.", trip: result.trip });
  } catch (error) {
    console.error("Error posting field work location:", error);
    return res.status(500).json({ message: "Failed to record location." });
  }
};

export const stopFieldWorkTrip = async (req, res) => {
  try {
    if (!isEmployeeRole(req.user)) {
      return res.status(403).json({ message: "Only employees can stop field work." });
    }

    const employee = req.user;
    const tripId = req.params.tripId || req.body.tripId;

    if (!tripId || !mongoose.Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ message: "Valid tripId is required." });
    }

    const stops = Array.isArray(req.body.stops)
      ? req.body.stops
          .map((stop) => normalizeCoordinate({
            latitude: stop.latitude,
            longitude: stop.longitude,
            recordedAt: stop.stoppedAt,
          }))
          .filter(Boolean)
          .map((stop, index) => ({
            latitude: stop.latitude,
            longitude: stop.longitude,
            stoppedAt: stop.recordedAt,
            durationSeconds: Number(req.body.stops[index]?.durationSeconds) || 0,
          }))
      : [];

    const trip = await FieldWorkTrip.findOneAndUpdate(
      { _id: tripId, employee: employee._id, status: "active" },
      {
        $set: {
          status: "completed",
          endedAt: new Date(),
          distanceKm: Number(req.body.distanceKm) || 0,
          stoppedSeconds: Number(req.body.stoppedSeconds) || 0,
          stops,
        },
      },
      { new: true },
    );

    if (!trip) {
      return res.status(404).json({ message: "Active trip not found." });
    }

    emitFieldTrackingEvent(req.app.get("io"), employee.adminId, "fieldTracking:tripStopped", {
      trip: formatTrip(trip),
    });

    return res.json({ message: "Field work trip completed.", trip: formatTrip(trip) });
  } catch (error) {
    console.error("Error stopping field work trip:", error);
    return res.status(500).json({ message: "Failed to stop field work trip." });
  }
};

export const getMyActiveTrip = async (req, res) => {
  try {
    if (!isEmployeeRole(req.user)) {
      return res.status(403).json({ message: "Only employees can view active field work." });
    }

    const trip = await FieldWorkTrip.findOne({
      employee: req.user._id,
      status: "active",
    }).lean();

    return res.json({ trip: trip ? formatTrip(trip) : null });
  } catch (error) {
    console.error("Error fetching active field work trip:", error);
    return res.status(500).json({ message: "Failed to fetch active trip." });
  }
};

export const getEmployeeTripsByDate = async (req, res) => {
  try {
    if (!isAdminRole(req.user)) {
      return res.status(403).json({ message: "Only admins can view field locations." });
    }

    const adminId = getRootAdminId(req.user);
    const employeeParam = req.params.employeeId;
    const employeeQuery = { adminId };

    if (mongoose.Types.ObjectId.isValid(employeeParam)) {
      employeeQuery._id = employeeParam;
    } else {
      employeeQuery.employeeId = employeeParam;
    }

    const employee = await Employee.findOne(employeeQuery)
      .select("_id employeeId name email companyName")
      .lean();

    if (!employee) {
      return res.status(404).json({ message: "Employee not found for this admin." });
    }

    const { start, end, dateKey } = getDateRange(req.query.date);
    const trips = await FieldWorkTrip.find({
      adminId,
      employee: employee._id,
      startedAt: { $gte: start, $lte: end },
    })
      .sort({ startedAt: -1 })
      .lean();

    return res.json({
      employee,
      date: dateKey,
      trips: trips.map(formatTrip),
    });
  } catch (error) {
    console.error("Error fetching field work trips:", error);
    return res.status(500).json({ message: "Failed to fetch field work trips." });
  }
};

export const getMyTripsByDate = async (req, res) => {
  try {
    if (!isEmployeeRole(req.user)) {
      return res.status(403).json({ message: "Only employees can view their field locations." });
    }

    const employeeId = req.user._id;
    const adminId = req.user.adminId;

    const { start, end, dateKey } = getDateRange(req.query.date);
    const trips = await FieldWorkTrip.find({
      adminId,
      employee: employeeId,
      startedAt: { $gte: start, $lte: end },
    })
      .sort({ startedAt: -1 })
      .lean();

    return res.json({
      date: dateKey,
      trips: trips.map(formatTrip),
    });
  } catch (error) {
    console.error("Error fetching my field work trips:", error);
    return res.status(500).json({ message: "Failed to fetch field work trips." });
  }
};

export const getRecentFieldTrips = async (req, res) => {
  try {
    if (!isAdminRole(req.user)) {
      return res.status(403).json({ message: "Only admins can view field trip history." });
    }

    const adminId = getRootAdminId(req.user);
    const limit = Math.min(50, Math.max(5, Number.parseInt(req.query.limit, 10) || 10));

    const trips = await FieldWorkTrip.aggregate([
      { $match: { adminId: new mongoose.Types.ObjectId(adminId) } },
      { $sort: { startedAt: -1 } },
      {
        $group: {
          _id: "$employee",
          trip: { $first: "$$ROOT" },
        },
      },
      { $replaceRoot: { newRoot: "$trip" } },
      { $sort: { startedAt: -1 } },
      { $limit: limit },
    ]);

    return res.json({
      data: trips.map(formatTrip),
    });
  } catch (error) {
    console.error("Error fetching recent field trips:", error);
    return res.status(500).json({ message: "Failed to fetch recent field trips." });
  }
};
