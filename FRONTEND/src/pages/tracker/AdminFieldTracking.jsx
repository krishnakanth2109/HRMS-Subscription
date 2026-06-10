import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Grid2X2,
  LocateFixed,
  List,
  MapPin,
  Power,
  RefreshCw,
  Route,
  Search,
  UserRound,
  Coffee,
} from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { io } from "socket.io-client";
import ModalWrapper from "../../components/ModalWrapper";
import Pagination from "../../components/Pagination";
import {
  getFieldTrackingEmployees,
  getFieldTrackingSetting,
  getFieldTripsForEmployee,
  getRecentFieldTrips,
  updateFieldTrackingSetting,
} from "../../api";

const SOCKET_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT || "http://localhost:5000";

const todayKey = () => new Date().toISOString().slice(0, 10);

const toDateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const getCurrentUser = () => {
  try {
    const raw = sessionStorage.getItem("hrmsUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const sameId = (a, b) => String(a || "") === String(b || "");

const isSamePoint = (a, b) =>
  a &&
  b &&
  String(a.recordedAt || "") === String(b.recordedAt || "") &&
  Number(a.latitude) === Number(b.latitude) &&
  Number(a.longitude) === Number(b.longitude);

const formatDateTime = (value) => {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatDuration = (seconds = 0) => {
  const total = Number(seconds) || 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const getLiveStopDurationSeconds = (stop, index, stops, isActiveTrip, now = Date.now()) => {
  const stored = Number(stop.durationSeconds) || 0;
  if (!isActiveTrip || !stop.stoppedAt) return stored;

  if (!stop.isActive) return stored;

  const isLastStop = index === stops.length - 1;
  if (!isLastStop) return stored;

  const live = Math.floor((now - new Date(stop.stoppedAt).getTime()) / 1000);
  return Math.max(stored, live);
};

const computeLiveStoppedSeconds = (trip, now = Date.now()) => {
  if (!trip) return 0;

  const stops = trip.stops || [];
  if (trip.status !== "active" || !stops.length) {
    return Number(trip.stoppedSeconds) || 0;
  }

  const activeStop = stops.find((s) => s.isActive);
  if (activeStop) {
    const nonActiveStopsDuration = stops
      .filter((s) => !s.isActive)
      .reduce((sum, s) => sum + (Number(s.durationSeconds) || 0), 0);

    const liveStopDuration = Math.max(0, Math.floor((now - new Date(activeStop.stoppedAt).getTime()) / 1000));
    return nonActiveStopsDuration + liveStopDuration;
  }

  return Number(trip.stoppedSeconds) || 0;
};

const toLatLng = (point) => {
  if (!point) return null;
  const lat = Number(point.latitude);
  const lng = Number(point.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
};

const stopPinIcon = L.divIcon({
  className: "",
  html: renderToStaticMarkup(
    <div
      style={{
        alignItems: "center",
        background: "#ef4444",
        border: "3px solid #ffffff",
        borderRadius: "9999px",
        boxShadow: "0 8px 18px rgba(15, 23, 42, 0.28)",
        color: "#ffffff",
        display: "flex",
        height: "34px",
        justifyContent: "center",
        width: "34px",
      }}
    >
      <MapPin size={21} strokeWidth={3} />
    </div>
  ),
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -17],
});

const breakPinIcon = L.divIcon({
  className: "",
  html: renderToStaticMarkup(
    <div
      style={{
        alignItems: "center",
        background: "#f59e0b",
        border: "3px solid #ffffff",
        borderRadius: "9999px",
        boxShadow: "0 8px 18px rgba(15, 23, 42, 0.28)",
        color: "#ffffff",
        display: "flex",
        height: "34px",
        justifyContent: "center",
        width: "34px",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
        <line x1="6" x2="6" y1="2" y2="4" />
        <line x1="10" x2="10" y1="2" y2="4" />
        <line x1="14" x2="14" y1="2" y2="4" />
      </svg>
    </div>
  ),
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -17],
});

const intermediatePinIcon = L.divIcon({
  className: "",
  html: renderToStaticMarkup(
    <div
      style={{
        alignItems: "center",
        background: "#10b981",
        border: "2px solid #ffffff",
        borderRadius: "9999px",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
        display: "flex",
        height: "12px",
        width: "12px",
      }}
    />
  ),
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -6],
});

const createMapPinIcon = (background) =>
  L.divIcon({
    className: "",
    html: renderToStaticMarkup(
      <div
        style={{
          alignItems: "center",
          background,
          border: "3px solid #ffffff",
          borderRadius: "9999px",
          boxShadow: "0 8px 18px rgba(15, 23, 42, 0.28)",
          color: "#ffffff",
          display: "flex",
          height: "34px",
          justifyContent: "center",
          width: "34px",
        }}
      >
        <MapPin size={21} strokeWidth={3} />
      </div>
    ),
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });

const startPinIcon = createMapPinIcon("#16a34a");
const currentPinIcon = createMapPinIcon("#2563eb");
const endPinIcon = createMapPinIcon("#f97316");

const createArrowIcon = (angle) =>
  L.divIcon({
    className: "",
    html: `<div style="
      transform: rotate(${angle}deg);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      background-color: #10B981;
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <polyline points="12 5 19 12 12 19"></polyline>
      </svg>
    </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const MapViewController = ({ positions, focusedLocation }) => {
  const map = useMap();

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    const timers = [100, 300, 800, 1500].map((delay) =>
      window.setTimeout(() => {
        map.invalidateSize({ debounceStart: true });
      }, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [map, positions, focusedLocation]);

  useEffect(() => {
    if (focusedLocation) {
      map.setView(focusedLocation, 17);
    } else {
      if (!positions.length) return;

      if (positions.length === 1) {
        map.setView(positions[0], 16);
      } else {
        map.fitBounds(positions, { maxZoom: 16, padding: [36, 36] });
      }
    }
  }, [map, positions, focusedLocation]);

  return null;
};

const TripRouteMap = ({ routePoints, stopPoints, breaks = [], isActiveTrip = false, focusedLocation, setFocusedLocation }) => {
  const routePositions = useMemo(() => routePoints.map((point) => point.position), [routePoints]);
  const stopPositions = stopPoints.map((point) => point.position);
  const breakPositions = useMemo(() => breaks.map((b) => toLatLng(b)).filter(Boolean), [breaks]);

  const [osrmPath, setOsrmPath] = useState([]);

  // Sample routePoints every 15 seconds based on recordedAt
  const sampledPoints = useMemo(() => {
    if (routePoints.length === 0) return [];
    const sampled = [];
    let lastTime = 0;
    for (let i = 0; i < routePoints.length; i++) {
      const pt = routePoints[i];
      let time = pt.recordedAt ? new Date(pt.recordedAt).getTime() : NaN;
      if (Number.isNaN(time)) {
        time = i * 3000; // 3 seconds fallback interval
      }
      if (i === 0) {
        sampled.push(pt);
        lastTime = time;
      } else if (i === routePoints.length - 1) {
        if (sampled[sampled.length - 1] !== pt) {
          sampled.push(pt);
        }
      } else {
        if (time - lastTime >= 15000) {
          sampled.push(pt);
          lastTime = time;
        }
      }
    }
    return sampled;
  }, [routePoints]);

  // Capped waypoints for OSRM to avoid URL length limit (max 60 points)
  const osrmWaypoints = useMemo(() => {
    if (sampledPoints.length <= 60) {
      return sampledPoints.map((p) => p.position);
    }
    const waypoints = [];
    const step = (sampledPoints.length - 1) / 59;
    for (let i = 0; i < 60; i++) {
      const idx = Math.round(i * step);
      waypoints.push(sampledPoints[idx].position);
    }
    return waypoints;
  }, [sampledPoints]);

  const pathKey = useMemo(() => {
    return osrmWaypoints.map((pos) => `${pos[0]},${pos[1]}`).join(";");
  }, [osrmWaypoints]);

  useEffect(() => {
    if (osrmWaypoints.length < 2) {
      setOsrmPath([]);
      return;
    }

    let active = true;
    const fetchRoute = async () => {
      try {
        const coordsString = osrmWaypoints.map((p) => `${p[1]},${p[0]}`).join(";");
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error("OSRM route fetch failed");
        }
        const data = await res.json();
        if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates) {
          const snapped = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          if (active) {
            setOsrmPath(snapped);
          }
        }
      } catch (err) {
        console.error("OSRM Routing failed, falling back to straight breadcrumbs:", err);
      }
    };

    fetchRoute();
    return () => {
      active = false;
    };
  }, [pathKey, osrmWaypoints]);

  const polylinePositions = osrmPath.length > 0 ? osrmPath : routePositions;

  const arrowMarkers = useMemo(() => {
    if (polylinePositions.length < 2) return [];
    const markers = [];
    const step = Math.max(5, Math.floor(polylinePositions.length / 8));
    for (let i = 0; i < polylinePositions.length - 1; i += step) {
      const current = polylinePositions[i];
      const nextIndex = Math.min(i + 1, polylinePositions.length - 1);
      const next = polylinePositions[nextIndex];
      const latDiff = next[0] - current[0];
      const lngDiff = next[1] - current[1];
      if (Math.abs(latDiff) > 1e-7 || Math.abs(lngDiff) > 1e-7) {
        const angle = -Math.atan2(latDiff, lngDiff) * 180 / Math.PI;
        markers.push({
          position: current,
          angle,
          key: `arrow-${i}`
        });
      }
    }
    return markers;
  }, [polylinePositions]);

  const allPositions = [...routePositions, ...stopPositions, ...breakPositions];
  const center = allPositions[0] || [20.5937, 78.9629];
  const startPoint = routePoints[0];
  const endPoint = routePoints[routePoints.length - 1];

  return (
    <MapContainer center={center} zoom={13} className="h-[520px] w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewController positions={allPositions} focusedLocation={focusedLocation} />

      {polylinePositions.length > 1 && (
        <Polyline positions={polylinePositions} pathOptions={{ color: "#10B981", weight: 5, opacity: 0.8 }} />
      )}

      {arrowMarkers.map((arrow) => (
        <Marker
          key={arrow.key}
          position={arrow.position}
          icon={createArrowIcon(arrow.angle)}
          interactive={false}
        />
      ))}

      <div className="leaflet-top leaflet-right flex flex-col gap-2 m-3 items-end">
        <div className="rounded-xl bg-white/95 px-3 py-2 text-xs font-black text-slate-700 shadow select-none">
          Captured GPS route
        </div>
        {focusedLocation && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setFocusedLocation(null);
            }}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-black shadow transition pointer-events-auto"
          >
            Show Full Route
          </button>
        )}
      </div>

      {startPoint && (
        <Marker position={startPoint.position} icon={startPinIcon}>
          <Popup>
            <div className="text-xs font-semibold text-slate-700">
              <p className="font-black text-slate-900">Start</p>
              <p>{formatDateTime(startPoint.recordedAt)}</p>
            </div>
          </Popup>
        </Marker>
      )}

      {endPoint && (
        <Marker position={endPoint.position} icon={isActiveTrip ? currentPinIcon : endPinIcon}>
          <Popup>
            <div className="text-xs font-semibold text-slate-700">
              <p className="font-black text-slate-900">{isActiveTrip ? "Current Location" : "End Location"}</p>
              <p>{formatDateTime(endPoint.recordedAt)}</p>
            </div>
          </Popup>
        </Marker>
      )}

      {stopPoints.map((stop, index) => (
        <Marker
          key={`stop-${stop.stoppedAt || index}-${index}`}
          position={stop.position}
          icon={stopPinIcon}
        >
          <Popup>
            <div className="text-xs font-semibold text-slate-700">
              <p className="font-black text-red-700">Stop {index + 1}</p>
              <p>{formatDateTime(stop.stoppedAt)}</p>
              <p>Duration: {formatDuration(stop.durationSeconds)}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {breaks.map((b, index) => {
        const pos = toLatLng(b);
        if (!pos) return null;
        return (
          <Marker key={`break-${b.startedAt || index}-${index}`} position={pos} icon={breakPinIcon}>
            <Popup>
              <div className="text-xs font-semibold text-slate-700">
                <p className="font-black text-amber-700">Break {index + 1}</p>
                <p>{b.startedAt ? new Date(b.startedAt).toLocaleTimeString("en-IN") : "--"}</p>
                <p>Duration: {formatDuration(b.durationSeconds)}</p>
                {b.description && (
                  <p className="mt-1 font-bold text-slate-600 italic">"{b.description}"</p>
                )}
                {b.photoUrl && (
                  <div className="mt-2 overflow-hidden rounded border border-slate-100">
                    <a href={b.photoUrl} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={b.photoUrl} alt="Break Proof" className="max-h-[100px] w-full object-cover cursor-zoom-in" />
                    </a>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
};

const AdminFieldTracking = () => {
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [settingLoading, setSettingLoading] = useState(true);
  const [savingSetting, setSavingSetting] = useState(false);

  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeViewMode, setEmployeeViewMode] = useState("list");
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState("all");
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeTotal, setEmployeeTotal] = useState(0);
  const [employeeLoading, setEmployeeLoading] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [tripData, setTripData] = useState(null);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [tripLoading, setTripLoading] = useState(false);
  const [tripError, setTripError] = useState("");
  const [recentTrips, setRecentTrips] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [liveTick, setLiveTick] = useState(0);
  const [focusedLocation, setFocusedLocation] = useState(null);
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const mapSectionRef = useRef(null);
  const selectedEmployeeRef = useRef(null);
  const selectedDateRef = useRef(selectedDate);

  useEffect(() => {
    setFocusedLocation(null);
  }, [selectedTripId, selectedEmployee?._id, selectedDate]);

  const selectedTrip = useMemo(() => {
    if (!tripData?.trips?.length) return null;
    if (!selectedTripId) return tripData.trips[0];
    return tripData.trips.find((trip) => trip._id === selectedTripId) || tripData.trips[0];
  }, [tripData, selectedTripId]);
  const routePoints = useMemo(
    () =>
      (selectedTrip?.path || [])
        .map((point) => ({ ...point, position: toLatLng(point) }))
        .filter((point) => point.position),
    [selectedTrip],
  );
  const stopPoints = useMemo(() => {
    const stops = selectedTrip?.stops || [];
    const isActiveTrip = selectedTrip?.status === "active";
    return stops
      .map((stop, index) => ({
        ...stop,
        position: toLatLng(stop),
        durationSeconds: getLiveStopDurationSeconds(stop, index, stops, isActiveTrip),
      }))
      .filter((stop) => stop.position);
  }, [selectedTrip, liveTick]);

  const displayStoppedSeconds = useMemo(
    () => computeLiveStoppedSeconds(selectedTrip),
    [selectedTrip, liveTick],
  );
  const displayDurationSeconds = useMemo(() => {
    if (!selectedTrip || !selectedTrip.startedAt) return 0;
    const start = new Date(selectedTrip.startedAt).getTime();
    const end = selectedTrip.endedAt ? new Date(selectedTrip.endedAt).getTime() : Date.now();
    return Math.max(0, Math.floor((end - start) / 1000));
  }, [selectedTrip, liveTick]);
  const visibleEmployees = useMemo(
    () => employees.filter((employee) => employeeStatusFilter === "all" || employee.isFieldLive),
    [employees, employeeStatusFilter],
  );

  const loadSetting = useCallback(async () => {
    try {
      setSettingLoading(true);
      const data = await getFieldTrackingSetting();
      setTrackingEnabled(Boolean(data.enabled));
    } catch (error) {
      console.error("Failed to load field tracking setting:", error);
    } finally {
      setSettingLoading(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    if (!employeeModalOpen) return;
    try {
      setEmployeeLoading(true);
      const result = await getFieldTrackingEmployees({
        page: employeePage,
        limit: 8,
        search: employeeSearch,
      });
      setEmployees(result.data || []);
      setEmployeeTotal(result.pagination?.total || 0);
    } catch (error) {
      console.error("Failed to load tracking employees:", error);
    } finally {
      setEmployeeLoading(false);
    }
  }, [employeeModalOpen, employeePage, employeeSearch]);

  const loadTrips = useCallback(async () => {
    if (!selectedEmployee) return;
    try {
      setTripLoading(true);
      setTripError("");
      const data = await getFieldTripsForEmployee(selectedEmployee._id, selectedDate);
      setTripData(data);
      setSelectedTripId(null);
    } catch (error) {
      console.error("Failed to load employee field trips:", error);
      setTripError(error.response?.data?.message || "Unable to load field trips.");
      setTripData(null);
    } finally {
      setTripLoading(false);
    }
  }, [selectedEmployee, selectedDate]);

  const loadRecentTrips = useCallback(async () => {
    try {
      setRecentLoading(true);
      const data = await getRecentFieldTrips(10);
      setRecentTrips(data.data || []);
    } catch (error) {
      console.error("Failed to load recent field trips:", error);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  const upsertLiveTrip = useCallback((incomingTrip) => {
    if (!incomingTrip) return;

    setTripData((prev) => {
      const selectedEmployeeId = selectedEmployeeRef.current?._id;
      const selectedDateValue = selectedDateRef.current;

      if (!sameId(incomingTrip.employee, selectedEmployeeId) || toDateKey(incomingTrip.startedAt) !== selectedDateValue) {
        return prev;
      }

      if (!prev) {
        return {
          employee: {
            _id: incomingTrip.employee,
            employeeId: incomingTrip.employeeId,
            name: incomingTrip.employeeName,
          },
          date: selectedDateValue,
          trips: [incomingTrip],
        };
      }

      const trips = prev.trips || [];
      const existingIndex = trips.findIndex((trip) => sameId(trip._id, incomingTrip._id));
      if (existingIndex === -1) {
        return { ...prev, trips: [incomingTrip, ...trips] };
      }

      return {
        ...prev,
        trips: trips.map((trip, index) => (index === existingIndex ? { ...trip, ...incomingTrip } : trip)),
      };
    });
  }, []);

  const appendLivePoint = useCallback((payload) => {
    if (!payload?.tripId || !payload?.point) return;

    setTripData((prev) => {
      const selectedEmployeeId = selectedEmployeeRef.current?._id;
      const selectedDateValue = selectedDateRef.current;

      if (!sameId(payload.employee, selectedEmployeeId) || toDateKey(payload.startedAt || payload.point.recordedAt) !== selectedDateValue) {
        return prev;
      }

      if (!prev?.trips?.length) return prev;

      let changed = false;
      const trips = prev.trips.map((trip) => {
        if (!sameId(trip._id, payload.tripId)) return trip;

        const path = trip.path || [];
        const nextPath = path.some((point) => isSamePoint(point, payload.point))
          ? path
          : [...path, payload.point];

        changed = true;
        return {
          ...trip,
          status: payload.status || trip.status,
          distanceKm: payload.distanceKm ?? trip.distanceKm,
          stoppedSeconds: payload.stoppedSeconds ?? trip.stoppedSeconds,
          stops: Array.isArray(payload.stops) ? payload.stops : trip.stops,
          breaks: Array.isArray(payload.breaks) ? payload.breaks : trip.breaks,
          updatedAt: payload.updatedAt || trip.updatedAt,
          path: nextPath,
        };
      });

      return changed ? { ...prev, trips } : prev;
    });
  }, []);

  useEffect(() => {
    loadSetting();
  }, [loadSetting]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    loadRecentTrips();
  }, [loadRecentTrips]);

  useEffect(() => {
    selectedEmployeeRef.current = selectedEmployee;
  }, [selectedEmployee]);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    if (selectedTrip?.status !== "active") return undefined;
    const timer = setInterval(() => setLiveTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [selectedTrip?._id, selectedTrip?.status]);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user?._id) return undefined;

    const socket = io(SOCKET_URL, { transports: ["polling", "websocket"] });

    socket.on("connect", () => {
      socket.emit("authenticate", user._id);
    });

    socket.on("fieldTracking:tripStarted", ({ trip }) => {
      upsertLiveTrip(trip);
      loadRecentTrips();
      loadEmployees();
    });

    socket.on("fieldTracking:location", (payload) => {
      appendLivePoint(payload);
    });

    socket.on("fieldTracking:tripStopped", ({ trip }) => {
      upsertLiveTrip(trip);
      loadRecentTrips();
      loadEmployees();
    });

    return () => {
      socket.disconnect();
    };
  }, [appendLivePoint, loadEmployees, loadRecentTrips, upsertLiveTrip]);

  const handleToggle = async () => {
    const nextValue = !trackingEnabled;
    try {
      setSavingSetting(true);
      const result = await updateFieldTrackingSetting(nextValue);
      setTrackingEnabled(Boolean(result.enabled));
    } catch (error) {
      console.error("Failed to update field tracking setting:", error);
      alert(error.response?.data?.message || "Unable to update tracking setting.");
    } finally {
      setSavingSetting(false);
    }
  };

  const chooseEmployee = (employee) => {
    setSelectedEmployee(employee);
    setEmployeeModalOpen(false);
  };

  const viewTripDetails = (trip) => {
    const date = new Date(trip.startedAt).toISOString().slice(0, 10);
    setSelectedDate(date);
    setSelectedEmployee({
      _id: trip.employee,
      employeeId: trip.employeeId,
      name: trip.employeeName,
    });
    setTripData({
      employee: {
        _id: trip.employee,
        employeeId: trip.employeeId,
        name: trip.employeeName,
      },
      date,
      trips: [trip],
    });
    setSelectedTripId(trip._id);
    window.requestAnimationFrame(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const setDateOffset = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().slice(0, 10));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-600 p-3 text-white">
                  <LocateFixed size={24} />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-slate-900">Live Tracking</h1>
                  <p className="text-sm font-semibold text-slate-500">
                    Control field-work tracking and review employee location visits by date.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span
                className={`rounded-full px-4 py-2 text-sm font-black ${
                  trackingEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {settingLoading ? "Checking..." : trackingEnabled ? "Tracking On" : "Tracking Off"}
              </span>
              <button
                type="button"
                onClick={handleToggle}
                disabled={savingSetting || settingLoading}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white shadow-lg transition disabled:opacity-60 ${
                  trackingEnabled ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                <Power size={18} />
                {savingSetting ? "Saving..." : trackingEnabled ? "Turn Off" : "Turn On"}
              </button>
            </div>
          </div>
        </div>

        <div ref={mapSectionRef} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm scroll-mt-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <button
              type="button"
              onClick={() => setEmployeeModalOpen(true)}
              className="flex min-h-[58px] flex-1 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
            >
              <span className="min-w-0">
                <span className="block text-xs font-black uppercase text-slate-400">Selected employee</span>
                <span className="block truncate text-sm font-black text-slate-900">
                  {selectedEmployee ? selectedEmployee.name : "Choose employee"}
                </span>
                {selectedEmployee && (
                  <span className="block text-xs font-semibold text-slate-500">{selectedEmployee.employeeId}</span>
                )}
              </span>
              <UserRound className="shrink-0 text-blue-600" size={22} />
            </button>

            <div className="min-w-0 flex-1">
              <label className="mb-2 block text-xs font-black uppercase text-slate-400">Calendar filter</label>
              <div className="flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <CalendarDays size={18} className="shrink-0 text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:w-auto sm:min-w-[260px]">
              <button type="button" onClick={() => setDateOffset(0)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200">
                Today
              </button>
              <button type="button" onClick={() => setDateOffset(-1)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200">
                Yesterday
              </button>
              <button type="button" onClick={() => setDateOffset(-7)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200">
                7 Days
              </button>
            </div>

            <button
              type="button"
              onClick={loadTrips}
              disabled={!selectedEmployee || tripLoading}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 xl:w-44"
            >
              <RefreshCw size={16} className={tripLoading ? "animate-spin" : ""} />
              Fetch Locations
            </button>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Visited Locations</h2>
                <p className="text-sm font-semibold text-slate-500">
                  {selectedEmployee ? `${selectedEmployee.name} on ${selectedDate}` : "Select an employee to view trips."}
                </p>
              </div>
              {selectedTrip && (
                <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700">
                  {selectedTrip.status === "active" ? "Live route" : "Recorded route"}
                  {stopPoints.length ? ` · ${stopPoints.length} stops` : ""}
                </span>
              )}
            </div>

            {tripError && <div className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{tripError}</div>}

            {!selectedEmployee ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
                <div>
                  <MapPin className="mx-auto mb-3 text-slate-300" size={46} />
                  <p className="font-black text-slate-700">Choose an employee to view field-work locations.</p>
                </div>
              </div>
            ) : tripLoading ? (
              <div className="flex min-h-[420px] items-center justify-center text-sm font-black text-slate-500">Loading trips...</div>
            ) : !selectedTrip ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl bg-slate-50 text-center">
                <p className="font-black text-slate-600">No field-work locations found for this date.</p>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  {routePoints.length ? (
                    <TripRouteMap
                      routePoints={routePoints}
                      stopPoints={stopPoints}
                      breaks={selectedTrip?.breaks || []}
                      isActiveTrip={selectedTrip.status === "active"}
                      focusedLocation={focusedLocation}
                      setFocusedLocation={setFocusedLocation}
                    />
                  ) : (
                    <div className="flex h-[520px] items-center justify-center text-sm font-bold text-slate-500">
                      Waiting for route data...
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Dropdown - Trips */}
                  {selectedTrip && (
                    <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50">
                      <div className="mb-2 flex items-center justify-between text-sm font-black text-slate-900">
                        <div className="flex items-center gap-2">
                          <Route size={18} className="text-blue-600" />
                          Trips
                        </div>
                        <button
                          type="button"
                          onClick={() => setPointsModalOpen(true)}
                          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 text-xs font-black shadow-sm transition"
                        >
                          View Points
                        </button>
                      </div>
                      {tripData?.trips?.length > 1 && (
                        <select
                          value={selectedTrip?._id || ""}
                          onChange={(e) => setSelectedTripId(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-400 cursor-pointer animate-none"
                        >
                          {tripData.trips.map((trip, index) => (
                            <option key={trip._id} value={trip._id}>
                              Trip - {tripData.trips.length - index} ({new Date(trip.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                      <Route size={18} className="text-blue-600" />
                      Trip Summary
                    </div>
                    <div className="space-y-2 text-sm font-semibold text-slate-600">
                      <p>Started: {formatDateTime(selectedTrip.startedAt)}</p>
                      <p>Ended: {selectedTrip.endedAt ? formatDateTime(selectedTrip.endedAt) : "Active"}</p>
                      <p>Duration: {formatDuration(displayDurationSeconds)}</p>
                      <p>Distance: {(selectedTrip.distanceKm || 0).toFixed(2)} km</p>
                      <p>Stopped: {formatDuration(displayStoppedSeconds)}</p>
                      <p>Stops: {stopPoints.length}</p>
                      <p>Breaks: {selectedTrip.breaks?.length || 0}</p>
                    </div>
                  </div>

                  {stopPoints.length > 0 && (
                    <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-black text-red-700">
                        <MapPin size={18} />
                        Stopped Locations
                      </div>
                      <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                        {stopPoints.map((stop, index) => {
                          const isFocused =
                            focusedLocation &&
                            focusedLocation[0] === stop.position[0] &&
                            focusedLocation[1] === stop.position[1];
                          return (
                            <button
                              key={`${stop.stoppedAt || index}-${index}`}
                              type="button"
                              onClick={() => {
                                if (isFocused) {
                                  setFocusedLocation(null);
                                } else {
                                  setFocusedLocation(stop.position);
                                }
                              }}
                              className={`w-full text-left rounded-xl border p-3 transition-all ${
                                isFocused
                                  ? "border-red-400 bg-red-100/50 shadow-sm"
                                  : "border-red-100 bg-white hover:bg-red-50/50 hover:border-red-200"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-black text-red-500">Stop {index + 1}</span>
                                <span className="text-xs font-bold text-slate-500">{formatDateTime(stop.stoppedAt)}</span>
                              </div>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                Duration: {formatDuration(stop.durationSeconds)}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedTrip.breaks?.length > 0 && (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-black text-amber-700">
                        <Coffee size={18} />
                        Break Locations
                      </div>
                      <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                        {selectedTrip.breaks.map((b, index) => {
                          const pos = toLatLng(b);
                          if (!pos) return null;
                          const isFocused =
                            focusedLocation &&
                            focusedLocation[0] === pos[0] &&
                            focusedLocation[1] === pos[1];
                          return (
                            <button
                              key={`break-item-${b.startedAt || index}-${index}`}
                              type="button"
                              onClick={() => {
                                if (isFocused) {
                                  setFocusedLocation(null);
                                } else {
                                  setFocusedLocation(pos);
                                }
                              }}
                              className={`w-full text-left rounded-xl border p-3 transition-all ${
                                isFocused
                                  ? "border-amber-400 bg-amber-100/50 shadow-sm"
                                  : "border-amber-100 bg-white hover:bg-amber-50/50 hover:border-amber-200"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-black text-amber-500">Break {index + 1}</span>
                                <span className="text-xs font-bold text-slate-500">{formatDateTime(b.startedAt)}</span>
                              </div>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                Duration: {formatDuration(b.durationSeconds)}
                              </p>
                              {b.description && (
                                <p className="mt-1 text-xs text-slate-600 italic">"{b.description}"</p>
                              )}
                              {b.photoUrl && (
                                <div className="mt-2 overflow-hidden rounded border border-slate-100 max-h-[80px] bg-slate-50">
                                  <img src={b.photoUrl} alt="Break Proof Thumbnail" className="max-h-[80px] w-full object-cover" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Recent History</h2>
              <p className="text-sm font-semibold text-slate-500">
                Latest field-work trips across employees.
              </p>
            </div>
            <button
              type="button"
              onClick={loadRecentTrips}
              disabled={recentLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw size={16} className={recentLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="px-5 py-4 text-left font-black uppercase tracking-wide">Emp ID</th>
                  <th className="px-5 py-4 text-left font-black uppercase tracking-wide">Name</th>
                  <th className="px-5 py-4 text-left font-black uppercase tracking-wide">Start Time</th>
                  <th className="px-5 py-4 text-left font-black uppercase tracking-wide">Distance</th>
                  <th className="px-5 py-4 text-left font-black uppercase tracking-wide">End Time</th>
                  <th className="px-5 py-4 text-center font-black uppercase tracking-wide">View Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentLoading ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-10 text-center font-black text-slate-500">
                      Loading recent history...
                    </td>
                  </tr>
                ) : recentTrips.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-10 text-center font-black text-slate-500">
                      No recent field-work history found.
                    </td>
                  </tr>
                ) : (
                  recentTrips.map((trip) => (
                    <tr key={trip._id} className="transition hover:bg-blue-50/60">
                      <td className="px-5 py-4 font-black text-blue-700">{trip.employeeId}</td>
                      <td className="px-5 py-4 font-black text-slate-900">{trip.employeeName}</td>
                      <td className="px-5 py-4 font-semibold text-slate-600">{formatDateTime(trip.startedAt)}</td>
                      <td className="px-5 py-4 font-black text-slate-900">{(trip.distanceKm || 0).toFixed(2)} km</td>
                      <td className="px-5 py-4 font-semibold text-slate-600">
                        {trip.endedAt ? formatDateTime(trip.endedAt) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Live
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => viewTripDetails(trip)}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-blue-700"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ModalWrapper
        isOpen={employeeModalOpen}
        onClose={() => setEmployeeModalOpen(false)}
        backdropClass="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/10 p-4 backdrop-blur-md animate-fadeIn"
        containerClass="relative z-[2010] flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="shrink-0 border-b border-slate-200 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-black text-slate-900">Select Employee</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setEmployeeStatusFilter("all")}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                    employeeStatusFilter === "all"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setEmployeeStatusFilter("live")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition ${
                    employeeStatusFilter === "live"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-emerald-700"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Live
                </button>
              </div>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setEmployeeViewMode("list")}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition ${
                    employeeViewMode === "list"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  <List size={15} />
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setEmployeeViewMode("grid")}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition ${
                    employeeViewMode === "grid"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  <Grid2X2 size={15} />
                  Grid
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Search size={18} className="text-slate-400" />
            <input
              value={employeeSearch}
              onChange={(event) => {
                setEmployeeSearch(event.target.value);
                setEmployeePage(1);
              }}
              placeholder="Search employee, ID, or email"
              className="w-full bg-transparent text-sm font-semibold outline-none"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {employeeLoading ? (
            <div className="py-10 text-center text-sm font-black text-slate-500">Loading employees...</div>
          ) : employees.length === 0 ? (
            <div className="py-10 text-center text-sm font-black text-slate-500">No employees found.</div>
          ) : visibleEmployees.length === 0 ? (
            <div className="py-10 text-center text-sm font-black text-slate-500">No live employees found.</div>
          ) : employeeViewMode === "list" ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              {visibleEmployees.map((employee, index) => (
                <button
                  key={employee._id}
                  type="button"
                  onClick={() => chooseEmployee(employee)}
                  className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-blue-50 ${
                    index !== visibleEmployees.length - 1 ? "border-b border-slate-100" : ""
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-blue-700">
                      {employee.name?.split(" ").map((part) => part[0]).join("").slice(0, 2) || "E"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-black text-slate-900">{employee.name}</p>
                        {employee.isFieldLive && (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
                            Live
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs font-semibold text-slate-500">{employee.email}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-blue-700">
                    {employee.employeeId}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleEmployees.map((employee) => (
                <button
                  key={employee._id}
                  type="button"
                  onClick={() => chooseEmployee(employee)}
                  className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-black text-slate-900">{employee.name}</p>
                    {employee.isFieldLive && (
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]" title="Currently in field work" />
                    )}
                  </div>
                  <p className="text-xs font-bold text-blue-600">{employee.employeeId}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">{employee.email}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100">
          <Pagination
            totalItems={employeeTotal}
            itemsPerPage={8}
            currentPage={employeePage}
            onPageChange={setEmployeePage}
          />
        </div>
      </ModalWrapper>

      {/* Points List Modal */}
      <ModalWrapper
        isOpen={pointsModalOpen}
        onClose={() => setPointsModalOpen(false)}
        title={`Recorded GPS Points - ${selectedEmployee?.name || ""}`}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-500">
            Below is the list of all GPS coordinates captured for this trip. Click "Focus" to center the map on a specific point.
          </p>
          
          <div className="max-h-[400px] overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-xs font-semibold text-slate-600">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Coordinates</th>
                  <th className="px-4 py-3">Speed</th>
                  <th className="px-4 py-3">Accuracy</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {routePoints.map((pt, index) => (
                  <tr key={`point-row-${index}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-black text-slate-900">{index + 1}</td>
                    <td className="px-4 py-3">{formatDateTime(pt.recordedAt)}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono">
                      {pt.latitude.toFixed(6)}, {pt.longitude.toFixed(6)}
                    </td>
                    <td className="px-4 py-3">
                      {pt.speed !== null && pt.speed !== undefined ? `${(pt.speed * 3.6).toFixed(1)} km/h` : "0 km/h"}
                    </td>
                    <td className="px-4 py-3">
                      {pt.accuracy !== null && pt.accuracy !== undefined ? `±${Math.round(pt.accuracy)}m` : "--"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setFocusedLocation(pt.position);
                          setPointsModalOpen(false);
                          window.requestAnimationFrame(() => {
                            mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                          });
                        }}
                        className="rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white px-2.5 py-1 text-[10px] font-black text-slate-700 transition cursor-pointer"
                      >
                        Focus
                      </button>
                    </td>
                  </tr>
                ))}
                {routePoints.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400">
                      No coordinates recorded for this trip.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </ModalWrapper>
    </div>
  );
};

export default AdminFieldTracking;
