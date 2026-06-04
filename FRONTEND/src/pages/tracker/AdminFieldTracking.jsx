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
} from "lucide-react";
import ModalWrapper from "../../components/ModalWrapper";
import Pagination from "../../components/Pagination";
import {
  getFieldTrackingEmployees,
  getFieldTrackingSetting,
  getFieldTripsForEmployee,
  getRecentFieldTrips,
  updateFieldTrackingSetting,
} from "../../api";

const todayKey = () => new Date().toISOString().slice(0, 10);

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
  return `${hours}h ${minutes}m`;
};

const buildMapUrl = (point) => {
  if (!point) return "";
  const lat = Number(point.latitude);
  const lng = Number(point.longitude);
  const delta = 0.01;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`;
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
  const mapSectionRef = useRef(null);

  const selectedTrip = useMemo(() => {
    if (!tripData?.trips?.length) return null;
    if (!selectedTripId) return tripData.trips[0];
    return tripData.trips.find((trip) => trip._id === selectedTripId) || tripData.trips[0];
  }, [tripData, selectedTripId]);
  const latestPoint = selectedTrip?.path?.[selectedTrip.path.length - 1] || null;
  const mapUrl = useMemo(() => buildMapUrl(latestPoint), [latestPoint]);
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

        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <div ref={mapSectionRef} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm scroll-mt-6">
            <h2 className="mb-4 text-lg font-black text-slate-900">Employee & Date</h2>

            <button
              type="button"
              onClick={() => setEmployeeModalOpen(true)}
              className="mb-4 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
            >
              <span>
                <span className="block text-xs font-black uppercase text-slate-400">Selected employee</span>
                <span className="block text-sm font-black text-slate-900">
                  {selectedEmployee ? selectedEmployee.name : "Choose employee"}
                </span>
                {selectedEmployee && (
                  <span className="block text-xs font-semibold text-slate-500">{selectedEmployee.employeeId}</span>
                )}
              </span>
              <UserRound className="text-blue-600" size={22} />
            </button>

            <label className="mb-2 block text-xs font-black uppercase text-slate-400">Calendar filter</label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <CalendarDays size={18} className="text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none"
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
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
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={16} className={tripLoading ? "animate-spin" : ""} />
              Fetch Locations
            </button>
          </div>

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
                  {selectedTrip.path.length} coordinates
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
              <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                  {mapUrl ? (
                    <iframe title="Latest field location" src={mapUrl} className="h-[420px] w-full border-0" />
                  ) : (
                    <div className="flex h-[420px] items-center justify-center text-sm font-bold text-slate-500">
                      No map point available.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                      <Route size={18} className="text-blue-600" />
                      Trip Summary
                    </div>
                    <div className="space-y-2 text-sm font-semibold text-slate-600">
                      <p>Started: {formatDateTime(selectedTrip.startedAt)}</p>
                      <p>Ended: {selectedTrip.endedAt ? formatDateTime(selectedTrip.endedAt) : "Active"}</p>
                      <p>Distance: {(selectedTrip.distanceKm || 0).toFixed(2)} km</p>
                      <p>Stopped: {formatDuration(selectedTrip.stoppedSeconds)}</p>
                    </div>
                  </div>

                  <div className="max-h-[270px] space-y-2 overflow-y-auto pr-1">
                    {selectedTrip.path.map((point, index) => (
                      <a
                        key={`${point.recordedAt}-${index}`}
                        href={`https://www.google.com/maps?q=${point.latitude},${point.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-slate-200 p-3 transition hover:border-blue-300 hover:bg-blue-50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-black text-slate-400">Point {index + 1}</span>
                          <span className="text-xs font-bold text-slate-500">{formatDateTime(point.recordedAt)}</span>
                        </div>
                        <p className="mt-1 text-xs font-bold text-slate-700">
                          {Number(point.latitude).toFixed(6)}, {Number(point.longitude).toFixed(6)}
                        </p>
                      </a>
                    ))}
                  </div>
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
        containerClass="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-slate-200 p-5">
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

        <div className="max-h-[430px] overflow-y-auto p-5">
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

        <Pagination
          totalItems={employeeTotal}
          itemsPerPage={8}
          currentPage={employeePage}
          onPageChange={setEmployeePage}
        />
      </ModalWrapper>
    </div>
  );
};

export default AdminFieldTracking;
