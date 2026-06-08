import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, MapPin, Navigation, Power, RefreshCw, Route, CalendarDays } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { io } from "socket.io-client";
import {
  getFieldTrackingSetting,
  getMyActiveFieldTrip,
  getMyFieldTrips,
  postFieldTripLocation,
  startFieldTrip,
  stopFieldTrip,
} from "../../api";

const SOCKET_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT || "http://localhost:5000";

const LOCATION_INTERVAL_MS = 3000;

const getCurrentUser = () => {
  try {
    const raw = sessionStorage.getItem("hrmsUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const calculateDistanceKm = (a, b) => {
  if (!a || !b) return 0;
  const earthRadius = 6371;
  const dLat = (Number(b.latitude) - Number(a.latitude)) * (Math.PI / 180);
  const dLng = (Number(b.longitude) - Number(a.longitude)) * (Math.PI / 180);
  const lat1 = Number(a.latitude) * (Math.PI / 180);
  const lat2 = Number(b.latitude) * (Math.PI / 180);
  const hav =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadius * (2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav)));
};

const formatDuration = (seconds = 0) => {
  const total = Number(seconds) || 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const STOP_RADIUS_KM = 0.03;
const STOP_MIN_SECONDS = 120;

const toLatLng = (point) => {
  if (!point) return null;
  if (Array.isArray(point)) {
    const lat = Number(point[0]);
    const lng = Number(point[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }

  const lat = Number(point.latitude ?? point.lat);
  const lng = Number(point.longitude ?? point.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
};

const normalizeMapPoint = (point) => {
  const position = toLatLng(point);
  if (!position) return null;
  return {
    ...point,
    latitude: Number(point.latitude ?? point.lat ?? position[0]),
    longitude: Number(point.longitude ?? point.lng ?? position[1]),
    position,
  };
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

const ResizeAndFitMap = ({ positions, currentPosition }) => {
  const map = useMap();

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    if (currentPosition) {
      map.setView(currentPosition, 15, { animate: true });
      return;
    }

    if (!positions.length) return;
    if (positions.length === 1) {
      map.setView(positions[0], 16);
    } else {
      map.fitBounds(positions, { maxZoom: 16, padding: [36, 36] });
    }
  }, [currentPosition, map, positions]);

  return null;
};

const LiveTripMap = ({ path = [], stops = [], currentPoint = null, isActiveTrip = false }) => {
  const routePoints = useMemo(() => path.map(normalizeMapPoint).filter(Boolean), [path]);
  const stopPoints = useMemo(() => stops.map(normalizeMapPoint).filter(Boolean), [stops]);
  const currentMapPoint = useMemo(() => normalizeMapPoint(currentPoint), [currentPoint]);
  const routePositions = routePoints.map((point) => point.position);
  const visibleRoutePositions = routePositions;
  const currentPosition = currentMapPoint?.position || routePositions[routePositions.length - 1] || null;
  const allPositions = [
    ...visibleRoutePositions,
    ...stopPoints.map((point) => point.position),
    ...(currentPosition ? [currentPosition] : []),
  ];
  const center = currentPosition || allPositions[0] || [20.5937, 78.9629];

  return (
    <MapContainer center={center} zoom={15} className="h-[420px] w-full" scrollWheelZoom>
      <ResizeAndFitMap positions={allPositions} currentPosition={currentPosition} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {visibleRoutePositions.length > 1 && (
        <Polyline positions={visibleRoutePositions} pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.85 }} />
      )}

      {routePoints[0] && (
        <Marker position={routePoints[0].position} icon={startPinIcon}>
          <Popup>Start point</Popup>
        </Marker>
      )}

      {currentPosition && (
        <Marker position={currentPosition} icon={isActiveTrip ? currentPinIcon : endPinIcon}>
          <Popup>{isActiveTrip ? "Current location" : "End location"}</Popup>
        </Marker>
      )}

      {stopPoints.map((stop, index) => (
        <Marker key={`${stop.latitude}-${stop.longitude}-${index}`} position={stop.position} icon={stopPinIcon}>
          <Popup>
            <div className="text-xs font-semibold text-slate-700">
              <p className="font-black text-red-700">Stop {index + 1}</p>
              <p>{stop.stoppedAt ? new Date(stop.stoppedAt).toLocaleTimeString("en-IN") : "--"}</p>
              <p>Duration: {formatDuration(stop.durationSeconds)}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      <div className="leaflet-top leaflet-right">
        <div className="m-3 rounded-xl bg-white/95 px-3 py-2 text-xs font-black text-slate-700 shadow">
          Captured GPS route
        </div>
      </div>
    </MapContainer>
  );
};

const positionToPoint = (position) => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: position.coords.accuracy,
  speed: position.coords.speed,
  heading: position.coords.heading,
  recordedAt: new Date().toISOString(),
});

const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    });
  });

const todayKey = () => new Date().toISOString().slice(0, 10);

const EmployeeFieldWork = () => {
  const [activeTab, setActiveTab] = useState("live");
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [points, setPoints] = useState([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stoppedSeconds, setStoppedSeconds] = useState(0);
  const [stops, setStops] = useState([]);
  const [error, setError] = useState("");

  const [historyDate, setHistoryDate] = useState(todayKey());
  const [historyTrips, setHistoryTrips] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [selectedHistoryTripId, setSelectedHistoryTripId] = useState(null);

  const socketRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const activeTripIdRef = useRef(null);
  const lastPointRef = useRef(null);
  const startTimeRef = useRef(null);
  const distanceRef = useRef(0);
  const stopCandidateRef = useRef(null);
  const stoppedSecondsRef = useRef(0);
  const stopsRef = useRef([]);

  const latestPoint = points[points.length - 1] || null;

  const stopLocationInterval = useCallback(() => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }, []);

  const getLiveStoppedSeconds = useCallback((now = Date.now()) => {
    let total = stoppedSecondsRef.current;
    const candidate = stopCandidateRef.current;
    if (!candidate) return total;

    const idleSeconds = Math.floor((now - candidate.startedAt) / 1000);
    if (idleSeconds >= STOP_MIN_SECONDS) {
      total += idleSeconds;
    }
    return total;
  }, []);

  const syncStopMarker = useCallback((now = Date.now()) => {
    const candidate = stopCandidateRef.current;
    if (!candidate) return;

    const idleSeconds = Math.floor((now - candidate.startedAt) / 1000);
    if (idleSeconds < STOP_MIN_SECONDS) return;

    const stopData = {
      latitude: candidate.point.latitude,
      longitude: candidate.point.longitude,
      stoppedAt: new Date(candidate.startedAt).toISOString(),
      durationSeconds: idleSeconds,
    };

    if (!candidate.recorded) {
      stopsRef.current = [...stopsRef.current, stopData];
      candidate.recorded = true;
    } else {
      const updatedStops = [...stopsRef.current];
      updatedStops[updatedStops.length - 1] = stopData;
      stopsRef.current = updatedStops;
    }
    setStops([...stopsRef.current]);
  }, []);

  const finalizeStop = useCallback((endedAt = Date.now()) => {
    const candidate = stopCandidateRef.current;
    if (!candidate) return;

    const idleSeconds = Math.floor((endedAt - candidate.startedAt) / 1000);
    if (idleSeconds >= STOP_MIN_SECONDS) {
      const stopData = {
        latitude: candidate.point.latitude,
        longitude: candidate.point.longitude,
        stoppedAt: new Date(candidate.startedAt).toISOString(),
        durationSeconds: idleSeconds,
      };

      if (!candidate.recorded) {
        stopsRef.current = [...stopsRef.current, stopData];
      } else {
        const updatedStops = [...stopsRef.current];
        updatedStops[updatedStops.length - 1] = stopData;
        stopsRef.current = updatedStops;
      }
      setStops([...stopsRef.current]);
      stoppedSecondsRef.current += idleSeconds;
    }

    stopCandidateRef.current = null;
  }, []);

  const trackStopCandidate = useCallback((point, movedKm) => {
    const recordedAt = new Date(point.recordedAt).getTime();
    const pointTime = Number.isFinite(recordedAt) ? recordedAt : Date.now();

    if (!lastPointRef.current) {
      stopCandidateRef.current = { point, startedAt: pointTime };
      return;
    }

    if (movedKm >= STOP_RADIUS_KM) {
      finalizeStop(pointTime);
      stopCandidateRef.current = { point, startedAt: pointTime };
    } else if (!stopCandidateRef.current) {
      stopCandidateRef.current = { point: lastPointRef.current, startedAt: pointTime };
    }

    setStoppedSeconds(getLiveStoppedSeconds(pointTime));
  }, [finalizeStop, getLiveStoppedSeconds]);

  const handleTrackingDisabled = useCallback(() => {
    setTrackingEnabled(false);
    setError("Admin turned off live tracking. Location posting has stopped.");
    stopLocationInterval();
    setIsTracking(false);
  }, [stopLocationInterval]);

  const sendLocationUpdate = useCallback(
    async (tripId, point) => {
      const payload = {
        tripId,
        point,
        distanceKm: distanceRef.current,
        stoppedSeconds: getLiveStoppedSeconds(),
        stops: stopsRef.current,
      };

      const socket = socketRef.current;
      if (socket?.connected) {
        return new Promise((resolve, reject) => {
          socket.emit("fieldTracking:postLocation", payload, (ack) => {
            if (!ack?.ok) {
              if (ack?.trackingDisabled) {
                handleTrackingDisabled();
              }
              reject(new Error(ack?.message || "Failed to send location."));
              return;
            }
            resolve(ack);
          });
        });
      }

      const result = await postFieldTripLocation(tripId, {
        ...point,
        distanceKm: distanceRef.current,
        stoppedSeconds: getLiveStoppedSeconds(),
        stops: stopsRef.current,
      });
      return result;
    },
    [getLiveStoppedSeconds, handleTrackingDisabled],
  );

  const captureAndSendLocation = useCallback(
    async (tripId) => {
      if (!tripId) return;

      try {
        const position = await getCurrentPosition();
        const point = positionToPoint(position);
        const moved = calculateDistanceKm(lastPointRef.current, point);

        trackStopCandidate(point, moved);
        setPoints((prev) => [...prev, point]);

        if (!lastPointRef.current || moved >= 0.01) {
          distanceRef.current += moved;
          setDistanceKm(distanceRef.current);
          lastPointRef.current = point;
        }

        await sendLocationUpdate(tripId, point);
      } catch (err) {
        console.error("Failed to capture/send field location:", err);
        if (err.response?.data?.trackingDisabled) {
          handleTrackingDisabled();
          return;
        }
        setError(err.message || "Unable to read current location.");
      }
    },
    [handleTrackingDisabled, sendLocationUpdate, trackStopCandidate],
  );

  const startLocationBroadcast = useCallback(
    (tripId) => {
      if (!navigator.geolocation) {
        setError("Geolocation is not supported on this device.");
        return;
      }

      activeTripIdRef.current = tripId;
      stopLocationInterval();
      captureAndSendLocation(tripId);
      locationIntervalRef.current = setInterval(() => {
        captureAndSendLocation(activeTripIdRef.current);
      }, LOCATION_INTERVAL_MS);
    },
    [captureAndSendLocation, stopLocationInterval],
  );

  const loadState = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [setting, active] = await Promise.all([
        getFieldTrackingSetting(),
        getMyActiveFieldTrip(),
      ]);

      setTrackingEnabled(Boolean(setting.enabled));
      if (active.trip) {
        setActiveTrip(active.trip);
        setPoints(active.trip.path || []);
        distanceRef.current = Number(active.trip.distanceKm) || 0;
        setDistanceKm(distanceRef.current);
        stopsRef.current = active.trip.stops || [];
        setStops(stopsRef.current);
        stoppedSecondsRef.current = Number(active.trip.stoppedSeconds) || 0;
        setStoppedSeconds(stoppedSecondsRef.current);
        lastPointRef.current = active.trip.path?.[active.trip.path.length - 1] || null;
        startTimeRef.current = active.trip.startedAt ? new Date(active.trip.startedAt).getTime() : Date.now();
        if (setting.enabled) {
          setIsTracking(true);
          startLocationBroadcast(active.trip._id);
        }
      }
    } catch (err) {
      console.error("Failed to load field work state:", err);
      setError(err.response?.data?.message || "Unable to load field work.");
    } finally {
      setLoading(false);
    }
  }, [startLocationBroadcast]);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user?._id) return undefined;

    const socket = io(SOCKET_URL, { transports: ["polling", "websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("authenticate", user._id);
    });

    return () => {
      stopLocationInterval();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [stopLocationInterval]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  useEffect(() => {
    if (!isTracking || !startTimeRef.current) return undefined;
    const timer = setInterval(() => {
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - startTimeRef.current) / 1000));
      setStoppedSeconds(getLiveStoppedSeconds(now));
      syncStopMarker(now);
    }, 1000);
    return () => clearInterval(timer);
  }, [getLiveStoppedSeconds, isTracking, syncStopMarker]);

  const handleStartTrip = async () => {
    try {
      setStarting(true);
      setError("");
      const position = await getCurrentPosition();
      const firstPoint = positionToPoint(position);
      const result = await startFieldTrip(firstPoint);
      const trip = result.trip;
      setActiveTrip(trip);
      setPoints(trip.path || [firstPoint]);
      distanceRef.current = 0;
      setDistanceKm(0);
      stopsRef.current = [];
      setStops([]);
      stoppedSecondsRef.current = 0;
      setStoppedSeconds(0);
      stopCandidateRef.current = { point: firstPoint, startedAt: Date.now() };
      lastPointRef.current = firstPoint;
      startTimeRef.current = trip.startedAt ? new Date(trip.startedAt).getTime() : Date.now();
      setElapsedSeconds(0);
      setIsTracking(true);
      startLocationBroadcast(trip._id);
    } catch (err) {
      console.error("Failed to start field trip:", err);
      setError(err.response?.data?.message || err.message || "Unable to start field work.");
    } finally {
      setStarting(false);
    }
  };

  const handleStopTrip = async () => {
    if (!activeTrip?._id) return;
    try {
      setStopping(true);
      setError("");
      stopLocationInterval();
      finalizeStop(Date.now());
      const result = await stopFieldTrip(activeTrip._id, {
        distanceKm: distanceRef.current,
        stoppedSeconds: stoppedSecondsRef.current,
        stops: stopsRef.current,
      });
      setActiveTrip(result.trip);
      setStops(result.trip?.stops || stopsRef.current);
      setIsTracking(false);
    } catch (err) {
      console.error("Failed to stop field trip:", err);
      setError(err.response?.data?.message || "Unable to stop field work.");
    } finally {
      setStopping(false);
    }
  };

  const selectedHistoryTrip = useMemo(() => {
    if (!historyTrips.length) return null;
    if (!selectedHistoryTripId) return historyTrips[0];
    return historyTrips.find((trip) => trip._id === selectedHistoryTripId) || historyTrips[0];
  }, [historyTrips, selectedHistoryTripId]);

  const loadHistoryTrips = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistoryError("");
      const data = await getMyFieldTrips(historyDate);
      setHistoryTrips(data.trips || []);
      setSelectedHistoryTripId(null);
    } catch (err) {
      console.error("Failed to load history trips:", err);
      setHistoryError(err.response?.data?.message || "Unable to load history trips.");
      setHistoryTrips([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyDate]);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistoryTrips();
    }
  }, [activeTab, historyDate, loadHistoryTrips]);

  const setDateOffset = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setHistoryDate(date.toISOString().slice(0, 10));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-600 p-3 text-white">
                <Navigation size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900">Field Work</h1>
                <p className="text-sm font-semibold text-slate-500">
                  Start a field trip and share your live route with admin.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("live")}
                  className={`rounded-lg px-4 py-2 text-xs font-black transition ${
                    activeTab === "live"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  Live Tracking
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className={`rounded-lg px-4 py-2 text-xs font-black transition ${
                    activeTab === "history"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  Trip History
                </button>
              </div>

              <button
                type="button"
                onClick={activeTab === "live" ? loadState : loadHistoryTrips}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {error && <div className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

        {activeTab === "live" ? (
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm font-black text-slate-700">Admin live tracking</span>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${trackingEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {trackingEnabled ? "On" : "Off"}
                </span>
              </div>

              {!trackingEnabled ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                  <LocateFixed className="mx-auto mb-3 text-slate-300" size={42} />
                  <p className="font-black text-slate-800">Field work is disabled</p>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    Admin must turn on live tracking before you can start a trip.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={isTracking ? handleStopTrip : handleStartTrip}
                  disabled={loading || starting || stopping}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black text-white shadow-lg transition disabled:opacity-60 ${
                    isTracking ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  <Power size={18} />
                  {starting ? "Starting..." : stopping ? "Stopping..." : isTracking ? "Stop Trip" : "Start Trip"}
                </button>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase text-slate-400">Duration</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{formatDuration(elapsedSeconds)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase text-slate-400">Distance</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{distanceKm.toFixed(2)} km</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase text-slate-400">Stops</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{stops.length}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase text-slate-400">Stopped</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{formatDuration(stoppedSeconds)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Current Trip</h2>
                  <p className="text-sm font-semibold text-slate-500">
                    {isTracking ? "Live route in progress" : activeTrip ? "Trip completed" : "No trip started yet."}
                  </p>
                </div>
                <Route className="text-blue-600" size={24} />
              </div>

              {latestPoint ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  <LiveTripMap path={points} stops={stops} currentPoint={latestPoint} isActiveTrip={isTracking} />
                </div>
              ) : (
                <div className="flex min-h-[360px] items-center justify-center rounded-2xl bg-slate-50 text-center">
                  <div>
                    <MapPin className="mx-auto mb-3 text-slate-300" size={46} />
                    <p className="font-black text-slate-700">Start a trip to capture your field-work locations.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
                <div className="min-w-0 flex-1">
                  <label className="mb-2 block text-xs font-black uppercase text-slate-400">Calendar filter</label>
                  <div className="flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <CalendarDays size={18} className="shrink-0 text-slate-400" />
                    <input
                      type="date"
                      value={historyDate}
                      onChange={(event) => setHistoryDate(event.target.value)}
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
                  onClick={loadHistoryTrips}
                  disabled={historyLoading}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 xl:w-44"
                >
                  <RefreshCw size={16} className={historyLoading ? "animate-spin" : ""} />
                  Fetch History
                </button>
              </div>
            </div>

            {historyError && <div className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{historyError}</div>}

            {historyLoading ? (
              <div className="flex min-h-[420px] items-center justify-center text-sm font-black text-slate-500 bg-white border border-slate-200 rounded-2xl">
                Loading history...
              </div>
            ) : historyTrips.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl bg-white border border-slate-200 text-center">
                <div>
                  <MapPin className="mx-auto mb-3 text-slate-300" size={46} />
                  <p className="font-black text-slate-700">No field-work history found for this date.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-lg font-black text-slate-900">Trip Route</h2>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    <LiveTripMap
                      path={selectedHistoryTrip.path}
                      stops={selectedHistoryTrip.stops}
                      currentPoint={selectedHistoryTrip.path?.[selectedHistoryTrip.path.length - 1] || null}
                      isActiveTrip={selectedHistoryTrip.status === "active"}
                    />
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-lg font-black text-slate-900">Trips on {historyDate}</h2>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {historyTrips.map((trip) => (
                        <button
                          key={trip._id}
                          type="button"
                          onClick={() => setSelectedHistoryTripId(trip._id)}
                          className={`flex flex-col rounded-xl border p-4 text-left transition ${
                            selectedHistoryTrip?._id === trip._id
                              ? "border-emerald-500 bg-emerald-50/40"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <span
                            className={`mb-2 self-start rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                              trip.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {trip.status}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            Start: {new Date(trip.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            End: {trip.endedAt ? new Date(trip.endedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Active"}
                          </span>
                          <span className="mt-2 text-sm font-black text-slate-900">{(trip.distanceKm || 0).toFixed(2)} km</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                        <Route size={18} className="text-blue-600" />
                        Trip Summary
                      </div>
                      <div className="space-y-2 text-sm font-semibold text-slate-600">
                        <p>Started: {new Date(selectedHistoryTrip.startedAt).toLocaleString("en-IN")}</p>
                        <p>Ended: {selectedHistoryTrip.endedAt ? new Date(selectedHistoryTrip.endedAt).toLocaleString("en-IN") : "Active"}</p>
                        <p>Distance: {(selectedHistoryTrip.distanceKm || 0).toFixed(2)} km</p>
                        <p>Stopped: {formatDuration(selectedHistoryTrip.stoppedSeconds)}</p>
                        <p>Stops: {selectedHistoryTrip.stops?.length || 0}</p>
                      </div>
                    </div>

                    {selectedHistoryTrip.stops?.length > 0 && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-3 flex items-center gap-2 text-sm font-black text-red-700">
                          <MapPin size={18} />
                          Stopped Locations
                        </div>
                        <div className="space-y-2">
                          {selectedHistoryTrip.stops.map((stop, index) => (
                            <div key={`${stop.stoppedAt}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-black text-red-500">Stop {index + 1}</span>
                                <span className="text-[10px] font-semibold text-slate-500">
                                  {stop.stoppedAt
                                    ? new Date(stop.stoppedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                                    : "--"}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                Duration: {formatDuration(stop.durationSeconds)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeFieldWork;
