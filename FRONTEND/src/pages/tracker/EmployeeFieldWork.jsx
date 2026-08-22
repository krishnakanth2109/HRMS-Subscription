import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, MapPin, Navigation, Power, RefreshCw, Route, CalendarDays, Coffee, Camera } from "lucide-react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { io } from "socket.io-client";
import {
  getFieldTrackingSetting,
  getMyActiveFieldTrip,
  getMyFieldTrips,
  postFieldTripLocation,
  startFieldTrip,
  stopFieldTrip,
  uploadBreakPhotoApi,
  snapToRoadsProxy,
} from "../../api";

const SOCKET_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT || "http://localhost:5000";

const LOCATION_INTERVAL_MS = 15000;

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

const STOP_RADIUS_KM = 0.05;
const STOP_MIN_SECONDS = 120;

// Kalman-style accuracy gate: discard GPS pings worse than this (in metres).
// Satellites give ~5-15m; cell towers give 100-2000m. 40m is a safe threshold.
const GPS_ACCURACY_THRESHOLD_M = 40;

// ==========================================
// GOOGLE MAPS LOADER (singleton — shared with AdminFieldTracking)
// ==========================================
const GOOGLE_MAPS_KEY_FALLBACK = import.meta.env.VITE_GOOGLE_MAPS_KEY || "";
let _empGoogleApi = null;

const getGoogleApi = async (key) => {
  if (_empGoogleApi) return _empGoogleApi;
  const apiKey = key || GOOGLE_MAPS_KEY_FALLBACK;
  if (!apiKey) throw new Error("Google Maps API key is missing.");
  
  setOptions({
    key: apiKey,
    version: "weekly"
  });
  
  await importLibrary("maps");
  await importLibrary("marker");
  
  _empGoogleApi = window.google;
  return _empGoogleApi;
};

// ==========================================
// SNAP-TO-ROADS (via backend proxy)
// ==========================================
const callSnapToRoads = async (waypoints) => {
  if (!waypoints || waypoints.length < 2) return waypoints;
  try {
    const result = await snapToRoadsProxy(waypoints.slice(0, 100));
    const snapped = result?.snappedPoints;
    if (Array.isArray(snapped) && snapped.length >= 2) return snapped;
  } catch (err) {
    console.warn("[EmployeeFieldWork:snapToRoads] fallback to raw GPS:", err.message);
  }
  return waypoints;
};

// ==========================================
// SVG MARKER HELPERS
// ==========================================
const makePinSvg = (fill, label) =>
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
      <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z"
            fill="${fill}" stroke="#fff" stroke-width="2"/>
      <circle cx="18" cy="18" r="8" fill="#fff" fill-opacity="0.9"/>
      <text x="18" y="22" text-anchor="middle" font-size="9" font-weight="700" fill="${fill}">${label}</text>
    </svg>`
  );

const makeCircleSvg = (fill) =>
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
      <circle cx="7" cy="7" r="5" fill="${fill}" stroke="#fff" stroke-width="2"/>
    </svg>`
  );

const ICONS = {
  start:   { url: makePinSvg("#16a34a", "S"), size: [36, 44], anchor: [18, 44] },
  end:     { url: makePinSvg("#f97316", "E"), size: [36, 44], anchor: [18, 44] },
  current: { url: makePinSvg("#2563eb", "L"), size: [36, 44], anchor: [18, 44] },
  stop:    { url: makePinSvg("#ef4444", "!"), size: [36, 44], anchor: [18, 44] },
  brk:     { url: makePinSvg("#f59e0b", "B"), size: [36, 44], anchor: [18, 44] },
  dot:     { url: makeCircleSvg("#10b981"), size: [14, 14], anchor: [7, 7] },
};

const makeIcon = (google, key) => ({
  url: ICONS[key].url,
  scaledSize: new google.maps.Size(...ICONS[key].size),
  anchor: new google.maps.Point(...ICONS[key].anchor),
});

// ==========================================
// LIVE TRIP MAP — Google Maps
// ==========================================
const LiveTripMap = ({ mapsKey, path = [], stops = [], breaks = [], currentPoint = null, isActiveTrip = false }) => {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const infoWindowRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  // Live marker updated in-place (no React re-render) for smooth tracking
  const currentMarkerRef = useRef(null);

  // Filter valid points
  const routePoints = useMemo(
    () => path.filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))),
    [path]
  );

  const stopPoints = useMemo(
    () => stops.filter((s) => Number.isFinite(Number(s.latitude)) && Number.isFinite(Number(s.longitude))),
    [stops]
  );

  // Sampled waypoints for snap-to-roads (max 100)
  const waypoints = useMemo(() => {
    if (routePoints.length < 2) return [];
    const sampled = [];
    let lastT = 0;
    for (let i = 0; i < routePoints.length; i++) {
      const pt = routePoints[i];
      const t = pt.recordedAt ? new Date(pt.recordedAt).getTime() : i * 3000;
      if (i === 0 || i === routePoints.length - 1 || t - lastT >= LOCATION_INTERVAL_MS) {
        sampled.push({ lat: pt.latitude, lng: pt.longitude });
        lastT = t;
      }
    }
    if (sampled.length <= 100) return sampled;
    const step = (sampled.length - 1) / 99;
    return Array.from({ length: 100 }, (_, i) => sampled[Math.round(i * step)]);
  }, [routePoints]);

  const waypointsKey = waypoints.map((p) => `${p.lat},${p.lng}`).join(";");

  // Init map once (Strict-Mode safe)
  useEffect(() => {
    if (!mapDivRef.current || !mapsKey) return;
    let cancelled = false;
    getGoogleApi(mapsKey).then((google) => {
      if (cancelled || !mapDivRef.current) return;
      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(mapDivRef.current, {
          center: { lat: 20.5937, lng: 78.9629 },
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: "greedy",
        });
        infoWindowRef.current = new google.maps.InfoWindow();
      }
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [mapsKey]);

  const clearStaticOverlays = useCallback(() => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    polylineRef.current?.setMap(null);
    polylineRef.current = null;
    infoWindowRef.current?.close();
  }, []);

  // Redraw static overlays (polyline, start, stops, breaks) when path/stops/breaks change
  useEffect(() => {
    if (!routePoints.length) { clearStaticOverlays(); return; }
    let cancelled = false;

    const draw = async () => {
      if (!mapsKey) return;
      const google = await getGoogleApi(mapsKey);
      if (cancelled || !mapRef.current) return;
      clearStaticOverlays();

      const map = mapRef.current;
      const iw = infoWindowRef.current;
      const newMarkers = [];

      // Snap to roads via backend proxy
      const snapped = waypoints.length >= 2
        ? await callSnapToRoads(waypoints)
        : routePoints.map((p) => ({ lat: p.latitude, lng: p.longitude }));
      if (cancelled) return;

      // Polyline
      const poly = new google.maps.Polyline({
        path: snapped,
        geodesic: true,
        strokeColor: "#10B981",
        strokeOpacity: 0.9,
        strokeWeight: 5,
      });
      poly.setMap(map);
      polylineRef.current = poly;

      // Intermediate dots (every 3rd raw point)
      routePoints.forEach((pt, i) => {
        if (i === 0 || i === routePoints.length - 1 || i % 3 !== 0) return;
        const m = new google.maps.Marker({
          position: { lat: pt.latitude, lng: pt.longitude },
          map,
          icon: makeIcon(google, "dot"),
          title: `Point ${i + 1}`,
          optimized: true,
        });
        newMarkers.push(m);
      });

      // Start marker
      const s = routePoints[0];
      const startM = new google.maps.Marker({
        position: { lat: s.latitude, lng: s.longitude },
        map,
        icon: makeIcon(google, "start"),
        title: "Start",
        zIndex: 10,
      });
      startM.addListener("click", () => {
        iw.setContent(`<b style="color:#16a34a">Start</b><br/><span style="font-size:12px">${s.recordedAt ? new Date(s.recordedAt).toLocaleTimeString("en-IN") : "--"}</span>`);
        iw.open(map, startM);
      });
      newMarkers.push(startM);

      // Stop markers
      stopPoints.forEach((stop, i) => {
        const m = new google.maps.Marker({
          position: { lat: stop.latitude, lng: stop.longitude },
          map,
          icon: makeIcon(google, "stop"),
          title: `Stop ${i + 1}`,
          zIndex: 8,
        });
        m.addListener("click", () => {
          iw.setContent(
            `<b style="color:#ef4444">Stop ${i + 1}</b><br/>` +
            `<span style="font-size:12px">${stop.stoppedAt ? new Date(stop.stoppedAt).toLocaleTimeString("en-IN") : "--"}</span><br/>` +
            `<span style="font-size:12px">Duration: ${formatDuration(stop.durationSeconds)}</span>`
          );
          iw.open(map, m);
        });
        newMarkers.push(m);
      });

      // Break markers
      breaks.forEach((b, i) => {
        const lat = Number(b.latitude); const lng = Number(b.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const m = new google.maps.Marker({
          position: { lat, lng },
          map,
          icon: makeIcon(google, "brk"),
          title: `Break ${i + 1}`,
          zIndex: 8,
        });
        m.addListener("click", () => {
          iw.setContent(
            `<b style="color:#f59e0b">Break ${i + 1}</b><br/>` +
            `<span style="font-size:12px">${b.startedAt ? new Date(b.startedAt).toLocaleTimeString("en-IN") : "--"}</span><br/>` +
            `<span style="font-size:12px">Duration: ${formatDuration(b.durationSeconds)}</span>` +
            (b.description ? `<br/><i style="font-size:11px">"${b.description}"</i>` : "") +
            (b.photoUrl ? `<br/><a href="${b.photoUrl}" target="_blank"><img src="${b.photoUrl}" style="max-height:80px;margin-top:6px;border-radius:6px"/></a>` : "")
          );
          iw.open(map, m);
        });
        newMarkers.push(m);
      });

      markersRef.current = newMarkers;

      // Fit bounds
      const allLL = [
        ...routePoints.map((p) => ({ lat: p.latitude, lng: p.longitude })),
        ...stopPoints.map((s) => ({ lat: s.latitude, lng: s.longitude })),
        ...breaks.map((b) => ({ lat: Number(b.latitude), lng: Number(b.longitude) })).filter((ll) => Number.isFinite(ll.lat) && Number.isFinite(ll.lng)),
      ];
      if (allLL.length === 1) { map.setCenter(allLL[0]); map.setZoom(16); }
      else if (allLL.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        allLL.forEach((ll) => bounds.extend(ll));
        map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      }
    };

    draw();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePoints, stopPoints, breaks, waypointsKey, mapsKey]);

  // Live: update current-position marker IN-PLACE (no full redraw) for smooth tracking
  useEffect(() => {
    if (!mapRef.current) return;
    const lat = Number(currentPoint?.latitude);
    const lng = Number(currentPoint?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const pos = { lat, lng };
    let cancelled = false;

    if (!mapsKey) return;

    getGoogleApi(mapsKey).then((google) => {
      if (cancelled || !mapRef.current) return;
      const map = mapRef.current;

      if (!currentMarkerRef.current) {
        currentMarkerRef.current = new google.maps.Marker({
          position: pos,
          map,
          icon: makeIcon(google, isActiveTrip ? "current" : "end"),
          title: isActiveTrip ? "Current Location" : "End",
          zIndex: 20,
        });
      } else {
        currentMarkerRef.current.setPosition(pos);
        currentMarkerRef.current.setIcon(makeIcon(google, isActiveTrip ? "current" : "end"));
      }

      if (isActiveTrip) {
        map.panTo(pos);
      }
    });

    return () => { cancelled = true; };
  }, [currentPoint?.latitude, currentPoint?.longitude, isActiveTrip, mapsKey]);

  useEffect(() => {
    return () => {
      currentMarkerRef.current?.setMap(null);
      currentMarkerRef.current = null;
    };
  }, []);

  return (
    <div style={{ position: "relative", height: "420px", width: "100%" }}>
      <div ref={mapDivRef} style={{ height: "100%", width: "100%", borderRadius: "12px" }} />
      {!mapsKey && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center", background: "#f1f5f9", borderRadius: 12,
          flexDirection: "column", gap: 8,
        }}>
          <MapPin size={40} style={{ color: "#94a3b8" }} />
          <p style={{ fontWeight: 700, color: "#475569" }}>Google Maps key not configured.</p>
          <p style={{ fontSize: 12, color: "#94a3b8" }}>Waiting for admin config...</p>
        </div>
      )}
    </div>
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

const getHistoryTripDuration = (trip) => {
  if (!trip || !trip.startedAt) return 0;
  const start = new Date(trip.startedAt).getTime();
  const end = trip.endedAt ? new Date(trip.endedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 1000));
};

const EmployeeFieldWork = () => {
  const [activeTab, setActiveTab] = useState("live");
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [googleMapsKey, setGoogleMapsKey] = useState("");
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
  const [isBreakActive, setIsBreakActive] = useState(false);
  const [activeBreak, setActiveBreak] = useState(null);
  const [breaks, setBreaks] = useState([]);
  const [tripPhotos, setTripPhotos] = useState([]);


  const [breakDescription, setBreakDescription] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState("");

  const [historyDate, setHistoryDate] = useState(todayKey());
  const [historyTrips, setHistoryTrips] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [selectedHistoryTripId, setSelectedHistoryTripId] = useState(null);

  const socketRef = useRef(null);
  const locationWatchRef = useRef(null);
  const activeTripIdRef = useRef(null);
  const lastPointRef = useRef(null);
  const startTimeRef = useRef(null);
  const distanceRef = useRef(0);
  const stopCandidateRef = useRef(null);
  const stoppedSecondsRef = useRef(0);
  const stopsRef = useRef([]);
  const breaksRef = useRef([]);
  const tripPhotosRef = useRef([]);
  const isBreakActiveRef = useRef(false);
  const lastRecordTimeRef = useRef(0);

  const latestPoint = points[points.length - 1] || null;

  const stopLocationWatch = useCallback(() => {
    if (locationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }
  }, []);

  const getLiveStoppedSeconds = useCallback((now = Date.now()) => {
    let total = stoppedSecondsRef.current;
    if (isBreakActiveRef.current) {
      return total;
    }
    const candidate = stopCandidateRef.current;
    if (!candidate) return total;

    const idleSeconds = Math.floor((now - candidate.startedAt) / 1000);
    if (idleSeconds >= STOP_MIN_SECONDS) {
      total += (idleSeconds - STOP_MIN_SECONDS);
    }
    return total;
  }, []);

  const syncStopMarker = useCallback((now = Date.now()) => {
    if (isBreakActiveRef.current) return;
    const candidate = stopCandidateRef.current;
    if (!candidate) return;

    const idleSeconds = Math.floor((now - candidate.startedAt) / 1000);
    if (idleSeconds < STOP_MIN_SECONDS) return;

    const stopData = {
      latitude: candidate.point.latitude,
      longitude: candidate.point.longitude,
      stoppedAt: new Date(candidate.startedAt).toISOString(),
      durationSeconds: idleSeconds - STOP_MIN_SECONDS,
      isActive: true,
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
        durationSeconds: idleSeconds - STOP_MIN_SECONDS,
        isActive: false,
      };

      if (!candidate.recorded) {
        stopsRef.current = [...stopsRef.current, stopData];
      } else {
        const updatedStops = [...stopsRef.current];
        updatedStops[updatedStops.length - 1] = stopData;
        stopsRef.current = updatedStops;
      }
      setStops([...stopsRef.current]);
      stoppedSecondsRef.current += (idleSeconds - STOP_MIN_SECONDS);
    }

    stopCandidateRef.current = null;
  }, []);

  const trackStopCandidate = useCallback((point) => {
    if (isBreakActiveRef.current) {
      return;
    }
    const recordedAt = new Date(point.recordedAt).getTime();
    const pointTime = Number.isFinite(recordedAt) ? recordedAt : Date.now();

    const candidate = stopCandidateRef.current;
    if (!candidate) {
      stopCandidateRef.current = { point, startedAt: pointTime };
      return;
    }

    const distanceFromCandidate = calculateDistanceKm(candidate.point, point);

    if (distanceFromCandidate >= STOP_RADIUS_KM) {
      finalizeStop(pointTime);
      stopCandidateRef.current = { point, startedAt: pointTime };
    }

    setStoppedSeconds(getLiveStoppedSeconds(pointTime));
  }, [finalizeStop, getLiveStoppedSeconds]);

  const handleTrackingDisabled = useCallback(() => {
    setTrackingEnabled(false);
    setError("Admin turned off live tracking. Location posting has stopped.");
    stopLocationWatch();
    setIsTracking(false);
  }, [stopLocationWatch]);

  const sendLocationUpdate = useCallback(
    async (tripId, point, currentBreaks = breaksRef.current) => {
      const payload = {
        tripId,
        point,
        distanceKm: distanceRef.current,
        stoppedSeconds: getLiveStoppedSeconds(),
        stops: stopsRef.current,
        breaks: currentBreaks,
        photos: tripPhotosRef.current,
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
        breaks: currentBreaks,
      });
      return result;
    },
    [getLiveStoppedSeconds, handleTrackingDisabled],
  );

  const handleWatchPositionUpdate = useCallback(
    async (position) => {
      const tripId = activeTripIdRef.current;
      if (!tripId) return;

      // ─── GPS ACCURACY GATE (Algorithm: Accuracy-Threshold Filtering) ───────
      // Only accept GPS pings that are within GPS_ACCURACY_THRESHOLD_M metres.
      // Cell-tower triangulation can report ±500m-2000m accuracy, which creates
      // large zigzag artefacts. This single guard eliminates 95% of route noise.
      const accuracyM = position.coords.accuracy;
      if (accuracyM > GPS_ACCURACY_THRESHOLD_M) {
        console.debug(
          `[EmployeeFieldWork] GPS ping rejected: accuracy=${accuracyM.toFixed(0)}m > threshold=${GPS_ACCURACY_THRESHOLD_M}m`
        );
        return;
      }

      const now = Date.now();
      if (now - lastRecordTimeRef.current < LOCATION_INTERVAL_MS) return;
      lastRecordTimeRef.current = now;

      try {
        const point = positionToPoint(position);
        const moved = calculateDistanceKm(lastPointRef.current, point);

        trackStopCandidate(point);
        setPoints((prev) => [...prev, point]);

        if (!lastPointRef.current || moved >= 0.01) {
          distanceRef.current += moved;
          setDistanceKm(distanceRef.current);
          lastPointRef.current = point;
        }

        await sendLocationUpdate(tripId, point);
      } catch (err) {
        console.error("Failed to handle field location update:", err);
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
      stopLocationWatch();

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          handleWatchPositionUpdate(position);
        },
        (err) => {
          console.error("Failed to capture field location:", err);
          setError(err.message || "Unable to read current location.");
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        }
      );
      locationWatchRef.current = watchId;
    },
    [handleWatchPositionUpdate, stopLocationWatch],
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
      if (setting.googleMapsKey) {
        setGoogleMapsKey(setting.googleMapsKey);
      }

      if (active.trip) {
        setActiveTrip(active.trip);
        setPoints(active.trip.path || []);
        distanceRef.current = Number(active.trip.distanceKm) || 0;
        setDistanceKm(distanceRef.current);
        stopsRef.current = active.trip.stops || [];
        setStops(stopsRef.current);
        breaksRef.current = active.trip.breaks || [];
        setBreaks(breaksRef.current);
        tripPhotosRef.current = active.trip.photos || [];
        setTripPhotos(tripPhotosRef.current);
        stoppedSecondsRef.current = Number(active.trip.stoppedSeconds) || 0;
        setStoppedSeconds(stoppedSecondsRef.current);
        lastPointRef.current = active.trip.path?.[active.trip.path.length - 1] || null;
        startTimeRef.current = active.trip.startedAt ? new Date(active.trip.startedAt).getTime() : Date.now();
        lastRecordTimeRef.current = Date.now();
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
      stopLocationWatch();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [stopLocationWatch]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  useEffect(() => {
    if (!isTracking || !startTimeRef.current) return undefined;
    const timer = setInterval(() => {
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - startTimeRef.current) / 1000));
      if (!isBreakActiveRef.current) {
        setStoppedSeconds(getLiveStoppedSeconds(now));
        syncStopMarker(now);
      }
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
      breaksRef.current = [];
      setBreaks([]);
      tripPhotosRef.current = [];
      setTripPhotos([]);
      setActiveBreak(null);
      setIsBreakActive(false);
      isBreakActiveRef.current = false;
      stoppedSecondsRef.current = 0;
      setStoppedSeconds(0);
      stopCandidateRef.current = { point: firstPoint, startedAt: Date.now() };
      lastPointRef.current = firstPoint;
      startTimeRef.current = trip.startedAt ? new Date(trip.startedAt).getTime() : Date.now();
      setElapsedSeconds(0);
      setIsTracking(true);
      lastRecordTimeRef.current = Date.now();
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
      stopLocationWatch();
      finalizeStop(Date.now());
      const result = await stopFieldTrip(activeTrip._id, {
        distanceKm: distanceRef.current,
        stoppedSeconds: stoppedSecondsRef.current,
        stops: stopsRef.current,
        breaks: breaksRef.current,
        photos: tripPhotosRef.current,
      });
      setActiveTrip(result.trip);
      setStops(result.trip?.stops || stopsRef.current);
      setBreaks(result.trip?.breaks || breaksRef.current);
      setTripPhotos(result.trip?.photos || tripPhotosRef.current);
      setIsTracking(false);
      setIsBreakActive(false);
      isBreakActiveRef.current = false;
      setActiveBreak(null);
      setBreakDescription("");
    } catch (err) {
      console.error("Failed to stop field trip:", err);
      setError(err.response?.data?.message || "Unable to stop field work.");
    } finally {
      setStopping(false);
    }
  };

  const startBreak = async () => {
    if (!activeTrip?._id) return;
    try {
      let pt = null;
      try {
        const position = await getCurrentPosition();
        pt = positionToPoint(position);
      } catch (geoErr) {
        console.warn("Failed to get current GPS coordinate for start break, falling back to last point:", geoErr);
        pt = lastPointRef.current || (points.length > 0 ? points[points.length - 1] : null);
      }

      if (!pt) {
        throw new Error("Unable to capture location coordinates. Please try again.");
      }

      finalizeStop(Date.now());
      setBreakDescription("");
      const breakData = {
        latitude: pt.latitude,
        longitude: pt.longitude,
        startedAt: new Date().toISOString(),
        endedAt: null,
        durationSeconds: 0,
        photoUrl: null,
        description: "",
      };
      setActiveBreak(breakData);
      setIsBreakActive(true);
      isBreakActiveRef.current = true;
      alert("Break started!");
    } catch (err) {
      console.error("Failed to start break:", err);
      alert(err.message || "Unable to start break.");
    }
  };

  const endBreak = async () => {
    if (!activeBreak || !activeTrip?._id) return;
    try {
      const endedAt = new Date();
      const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - new Date(activeBreak.startedAt).getTime()) / 1000));
      const finalBreak = {
        ...activeBreak,
        endedAt: endedAt.toISOString(),
        durationSeconds,
      };
      const updatedBreaks = [...breaksRef.current, finalBreak];
      breaksRef.current = updatedBreaks;
      setBreaks(updatedBreaks);
      setActiveBreak(null);
      setIsBreakActive(false);
      isBreakActiveRef.current = false;

      // Immediately send location update to save the finalized break
      let pt = null;
      try {
        const position = await getCurrentPosition();
        pt = positionToPoint(position);
      } catch (geoErr) {
        console.warn("Failed to get current GPS coordinate for end break, falling back to last point:", geoErr);
        pt = lastPointRef.current || (points.length > 0 ? points[points.length - 1] : null);
      }

      if (pt) {
        await sendLocationUpdate(activeTrip._id, pt, updatedBreaks);
      } else {
        console.warn("No location point available to sync break end.");
      }
      setBreakDescription("");
      alert("Break ended!");
    } catch (err) {
      console.error("Failed to end break:", err);
      alert("Break ended, but failed to sync final coordinates.");
    }
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !activeTrip?._id || !activeBreak) return;

    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append("image", file);

      const response = await uploadBreakPhotoApi(activeTrip._id, formData);
      if (response?.success && response?.url) {
        const uploadedUrl = response.url;
        const updatedBreak = { ...activeBreak, photoUrl: uploadedUrl };
        setActiveBreak(updatedBreak);
        alert("Break photo uploaded successfully!");
      }
    } catch (err) {
      console.error("Failed to upload break photo:", err);
      alert("Failed to upload break photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleTripPhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !activeTrip?._id) return;

    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append("image", file);

      const response = await uploadBreakPhotoApi(activeTrip._id, formData);
      if (response?.success && response?.url) {
        const uploadedUrl = response.url;
        const newPhotos = [...tripPhotosRef.current, uploadedUrl];
        tripPhotosRef.current = newPhotos;
        setTripPhotos(newPhotos);
        alert("Trip photo uploaded successfully!");

        try {
          const position = await getCurrentPosition();
          const pt = positionToPoint(position);
          await sendLocationUpdate(activeTrip._id, pt);
        } catch (geoErr) {
          console.warn("Could not sync location after photo upload", geoErr);
        }
      }
    } catch (err) {
      console.error("Failed to upload trip photo:", err);
      alert("Failed to upload trip photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
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

              {isTracking && (
                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    onClick={isBreakActive ? endBreak : startBreak}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black text-white shadow-md transition ${
                      isBreakActive ? "bg-amber-500 hover:bg-amber-600" : "bg-slate-700 hover:bg-slate-800"
                    }`}
                  >
                    <Coffee size={16} />
                    {isBreakActive ? "End Break" : "Start Break"}
                  </button>

                  {isBreakActive && (
                    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 space-y-3">
                      <p className="text-xs font-black text-amber-800 uppercase tracking-wider">Break in progress</p>
                      
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-600">
                         Description
                        </label>
                        <input
                          type="text"
                          value={breakDescription}
                          onChange={(e) => {
                            setBreakDescription(e.target.value);
                            setActiveBreak((prev) => prev ? { ...prev, description: e.target.value } : null);
                          }}
                          placeholder="Why are you taking a break?"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-amber-400"
                        />
                      </div>
                      
                      {activeBreak?.photoUrl ? (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                            ✓ Photo Uploaded
                          </p>
                          <div className="overflow-hidden rounded-lg border border-amber-200">
                            <img src={activeBreak.photoUrl} alt="Break proof" className="max-h-[120px] w-full object-cover" />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-slate-600">
                            Upload Proof Photo (Only during break)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              disabled={uploadingPhoto}
                              className="hidden"
                              id="break-photo-file"
                            />
                            <label
                              htmlFor="break-photo-file"
                              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                            >
                              <Camera size={14} />
                              {uploadingPhoto ? "Uploading to Cloudinary..." : "Take/Upload Photo"}
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTrip && !isBreakActive && (
                <div className="mt-4 rounded-xl border border-indigo-100 bg-white p-4 space-y-3">
                  <label className="block text-xs font-bold text-slate-600">
                    Trip Photos ({tripPhotos.length})
                  </label>
                  
                  {tripPhotos.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {tripPhotos.map((url, i) => (
                        <div key={i} className="overflow-hidden rounded-lg border border-slate-200 aspect-square">
                          <img src={url} alt="Trip photo" className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleTripPhotoUpload}
                      disabled={uploadingPhoto}
                      className="hidden"
                      id="trip-photo-file"
                    />
                    <label
                      htmlFor="trip-photo-file"
                      className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 text-xs font-black text-indigo-700 shadow-sm transition hover:bg-indigo-100"
                    >
                      <Camera size={16} />
                      {uploadingPhoto ? "Uploading..." : "Take/Upload Trip Photo"}
                    </label>
                  </div>
                </div>
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
                  <LiveTripMap mapsKey={googleMapsKey} path={points} stops={stops} breaks={breaks} currentPoint={latestPoint} isActiveTrip={isTracking} />
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
                      mapsKey={googleMapsKey}
                      path={selectedHistoryTrip.path}
                      stops={selectedHistoryTrip.stops}
                      breaks={selectedHistoryTrip.breaks || []}
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
                        <p>Duration: {formatDuration(getHistoryTripDuration(selectedHistoryTrip))}</p>
                        <p>Distance: {(selectedHistoryTrip.distanceKm || 0).toFixed(2)} km</p>
                        <p>Stopped: {formatDuration(selectedHistoryTrip.stoppedSeconds)}</p>
                        <p>Stops: {selectedHistoryTrip.stops?.length || 0}</p>
                        <p>Breaks: {selectedHistoryTrip.breaks?.length || 0}</p>
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

                    {selectedHistoryTrip.breaks?.length > 0 && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-3 flex items-center gap-2 text-sm font-black text-amber-700">
                          <Coffee size={18} />
                          Break Locations
                        </div>
                        <div className="space-y-2">
                          {selectedHistoryTrip.breaks.map((b, index) => (
                            <div key={`history-break-${b.startedAt || index}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-black text-amber-500">Break {index + 1}</span>
                                <span className="text-[10px] font-semibold text-slate-500">
                                  {b.startedAt
                                    ? new Date(b.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                                    : "--"}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                Duration: {formatDuration(b.durationSeconds)}
                              </p>
                              {b.description && (
                                <p className="mt-1 text-[11px] text-slate-600 italic">"{b.description}"</p>
                              )}
                              {b.photoUrl && (
                                <div className="mt-2 overflow-hidden rounded border border-slate-100 max-h-[80px] bg-slate-50">
                                  <a href={b.photoUrl} target="_blank" rel="noopener noreferrer">
                                    <img src={b.photoUrl} alt="Break Proof Thumbnail" className="max-h-[80px] w-full object-cover cursor-zoom-in" />
                                  </a>
                                </div>
                              )}
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
