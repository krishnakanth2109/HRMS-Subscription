import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, MapPin, Navigation, Power, RefreshCw, Route } from "lucide-react";
import {
  getFieldTrackingSetting,
  getMyActiveFieldTrip,
  postFieldTripLocation,
  startFieldTrip,
  stopFieldTrip,
} from "../../api";

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

const EmployeeFieldWork = () => {
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [points, setPoints] = useState([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");

  const watchRef = useRef(null);
  const lastPointRef = useRef(null);
  const startTimeRef = useRef(null);
  const distanceRef = useRef(0);

  const latestPoint = points[points.length - 1] || null;

  const mapLink = useMemo(() => {
    if (!latestPoint) return "";
    return `https://www.google.com/maps?q=${latestPoint.latitude},${latestPoint.longitude}`;
  }, [latestPoint]);

  const stopWatch = useCallback(() => {
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  const postLocation = useCallback(async (tripId, point) => {
    const moved = calculateDistanceKm(lastPointRef.current, point);
    if (!lastPointRef.current || moved >= 0.01) {
      distanceRef.current += moved;
      setDistanceKm(distanceRef.current);
      setPoints((prev) => [...prev, point]);
      lastPointRef.current = point;
    }

    await postFieldTripLocation(tripId, {
      ...point,
      distanceKm: distanceRef.current,
      stoppedSeconds: 0,
    });
  }, []);

  const startWatch = useCallback(
    (tripId) => {
      if (!navigator.geolocation) {
        setError("Geolocation is not supported on this device.");
        return;
      }

      stopWatch();
      watchRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const point = positionToPoint(position);
          postLocation(tripId, point).catch((err) => {
            console.error("Failed to post field location:", err);
            if (err.response?.data?.trackingDisabled) {
              setTrackingEnabled(false);
              setError("Admin turned off live tracking. Location posting has stopped.");
              stopWatch();
              setIsTracking(false);
            }
          });
        },
        (geoError) => {
          console.error("Geolocation error:", geoError);
          setError(geoError.message || "Unable to read current location.");
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
      );
    },
    [postLocation, stopWatch],
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
        lastPointRef.current = active.trip.path?.[active.trip.path.length - 1] || null;
        startTimeRef.current = active.trip.startedAt ? new Date(active.trip.startedAt).getTime() : Date.now();
        if (setting.enabled) {
          setIsTracking(true);
          startWatch(active.trip._id);
        }
      }
    } catch (err) {
      console.error("Failed to load field work state:", err);
      setError(err.response?.data?.message || "Unable to load field work.");
    } finally {
      setLoading(false);
    }
  }, [startWatch]);

  useEffect(() => {
    loadState();
    return () => stopWatch();
  }, [loadState, stopWatch]);

  useEffect(() => {
    if (!isTracking || !startTimeRef.current) return undefined;
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isTracking]);

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
      lastPointRef.current = firstPoint;
      startTimeRef.current = trip.startedAt ? new Date(trip.startedAt).getTime() : Date.now();
      setElapsedSeconds(0);
      setIsTracking(true);
      startWatch(trip._id);
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
      stopWatch();
      const result = await stopFieldTrip(activeTrip._id, {
        distanceKm: distanceRef.current,
        stoppedSeconds: 0,
        stops: [],
      });
      setActiveTrip(result.trip);
      setIsTracking(false);
    } catch (err) {
      console.error("Failed to stop field trip:", err);
      setError(err.response?.data?.message || "Unable to stop field work.");
    } finally {
      setStopping(false);
    }
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
                  Start a field trip and share live location coordinates with admin.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadState}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {error && <div className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

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
                <p className="text-xs font-black uppercase text-slate-400">Points</p>
                <p className="mt-1 text-lg font-black text-slate-900">{points.length}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-400">Status</p>
                <p className="mt-1 text-lg font-black text-slate-900">{isTracking ? "Live" : "Idle"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Current Trip</h2>
                <p className="text-sm font-semibold text-slate-500">
                  {activeTrip ? `Trip ${activeTrip._id}` : "No trip started yet."}
                </p>
              </div>
              <Route className="text-blue-600" size={24} />
            </div>

            {latestPoint ? (
              <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                    <MapPin size={18} className="text-emerald-600" />
                    Latest coordinate
                  </div>
                  <p className="text-2xl font-black text-slate-900">
                    {Number(latestPoint.latitude).toFixed(6)}, {Number(latestPoint.longitude).toFixed(6)}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    Accuracy: {latestPoint.accuracy ? `${Math.round(latestPoint.accuracy)} m` : "--"}
                  </p>
                  {mapLink && (
                    <a
                      href={mapLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
                    >
                      Open in Google Maps
                    </a>
                  )}
                </div>

                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {points.map((point, index) => (
                    <div key={`${point.recordedAt}-${index}`} className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs font-black text-slate-400">Point {index + 1}</p>
                      <p className="mt-1 text-xs font-bold text-slate-700">
                        {Number(point.latitude).toFixed(5)}, {Number(point.longitude).toFixed(5)}
                      </p>
                    </div>
                  ))}
                </div>
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
      </div>
    </div>
  );
};

export default EmployeeFieldWork;
