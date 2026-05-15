import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  FaCalendarAlt,
  FaCamera,
  FaChartLine,
  FaClipboardList,
  FaCloudUploadAlt,
  FaClock,
  FaPercentage,
  FaUpload,
  FaInfoCircle,
  FaTimes,
  FaCheckCircle,
  FaHourglassHalf,
  FaChartPie,
  FaChevronDown,
  FaBuilding,
  FaCalendarWeek,
  FaBriefcase,
  FaCalculator,
  FaDownload,
} from "react-icons/fa";

import {
  getMyDailyWorkRecords,
  submitEveningWork,
  submitMorningWork,
} from "../api";
import WorkRecordsCalendar, {
  getWorkDateKey,
} from "../components/work/WorkRecordsCalendar";

const getCurrentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const getMonthLabel = (monthValue) => {
  const [year, month] = monthValue.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const buildMonthOptions = (count = 24) => {
  const options = [];
  const now = new Date();

  for (let index = 0; index < count; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    options.push({
      value,
      label: getMonthLabel(value),
    });
  }

  return options;
};

const getTodayDateKey = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
};

const getStatusClasses = (status) => {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
};

const getDateLabelFromKey = (dateKey) => {
  if (!dateKey) return "";

  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
};

const normalizeWorkRecord = (record) => ({
  ...record,
  employee_submitted_percentage:
    record?.employee_submitted_percentage ??
    record?.employeeSubmittedPercentage ??
    null,
  daily_work_percentage: Number(record?.daily_work_percentage ?? 0),
});

// Component for Monthly Percentage Breakdown Popup
const MonthlyPercentageBreakdown = ({ isOpen, onClose, records, totalWorkingDays, monthlyWorkPercentage, selectedMonth }) => {
  const [activeTab, setActiveTab] = useState("breakdown");

  const fixedDailySlot = useMemo(() => {
    if (!totalWorkingDays || totalWorkingDays === 0) return 0;
    return 100 / totalWorkingDays;
  }, [totalWorkingDays]);

  const calculateDailyContributions = useMemo(() => {
    if (!records || records.length === 0 || !totalWorkingDays) return [];

    const approvedEntries = records
      .filter(record => record.status === "approved" && record.daily_work_percentage > 0)
      .map(record => {
        const dateKey = getWorkDateKey(record.date);
        const dailyContrib = (record.daily_work_percentage / 100) * fixedDailySlot;
        return {
          date: dateKey,
          formattedDate: new Date(record.date).toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          approvedPercentage: record.daily_work_percentage,
          fixedSlotPercentage: fixedDailySlot,
          contribution: dailyContrib,
          contributionDisplay: dailyContrib.toFixed(2),
          morning_title: record.morning_title,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return approvedEntries;
  }, [records, totalWorkingDays, fixedDailySlot]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/70 p-4">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-t-2xl">
          <div>
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FaChartPie className="text-indigo-500" />
              Monthly Work Percentage Details
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {getMonthLabel(selectedMonth)} • Total Working Days: {totalWorkingDays || 0}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <FaTimes />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          <button
            onClick={() => setActiveTab("breakdown")}
            className={`px-4 py-3 text-sm font-medium transition relative ${
              activeTab === "breakdown"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Day-wise Breakdown
          </button>
          <button
            onClick={() => setActiveTab("formula")}
            className={`px-4 py-3 text-sm font-medium transition relative ${
              activeTab === "formula"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            How it's Calculated
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {activeTab === "breakdown" && (
            <div>
              {calculateDailyContributions.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <FaCheckCircle className="mx-auto text-3xl mb-3 text-slate-300" />
                  <p>No approved days with percentage yet.</p>
                  <p className="text-sm mt-1">Approved work entries will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Header Row */}
                  <div className="grid grid-cols-12 gap-2 pb-2 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <div className="col-span-4">Date</div>
                    <div className="col-span-3 text-center">Approved %</div>
                    <div className="col-span-3 text-center">Fixed Slot</div>
                    <div className="col-span-2 text-right">Contribution</div>
                  </div>

                  {/* Data Rows */}
                  {calculateDailyContributions.map((item, idx) => (
                    <div
                      key={item.date}
                      className={`grid grid-cols-12 gap-2 py-2 rounded-lg ${
                        idx % 2 === 0 ? "bg-slate-50" : ""
                      }`}
                    >
                      <div className="col-span-4">
                        <div className="font-medium text-slate-700 text-sm">{item.formattedDate}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[180px]">
                          {item.morning_title?.substring(0, 30)}
                        </div>
                      </div>
                      <div className="col-span-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                          {item.approvedPercentage}%
                        </span>
                      </div>
                      <div className="col-span-3 text-center text-slate-600 text-sm">
                        {item.fixedSlotPercentage.toFixed(2)}%
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="font-bold text-cyan-600">
                          +{item.contributionDisplay}%
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Total Row */}
                  <div className="mt-4 pt-3 border-t-2 border-slate-200">
                    <div className="grid grid-cols-12 gap-2 py-2 bg-indigo-50 rounded-lg px-3">
                      <div className="col-span-7">
                        <span className="font-bold text-slate-700">Total Monthly Work %</span>
                      </div>
                      <div className="col-span-3 text-center">
                        <span className="font-bold text-indigo-600 text-lg">
                          {monthlyWorkPercentage || 0}%
                        </span>
                      </div>
                      <div className="col-span-2 text-right text-sm text-slate-500">
                        (Sum of all contributions)
                      </div>
                    </div>
                  </div>

                  {/* Summary Info */}
                  <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <p className="text-xs text-amber-700">
                      <strong>💡 Understanding this calculation:</strong> Each approved day adds a proportional share 
                      to your monthly total. The fixed slot per day ({fixedDailySlot.toFixed(2)}%) 
                      is multiplied by your approved percentage to get the daily contribution.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "formula" && (
            <div className="space-y-5">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <h4 className="font-bold text-blue-800 mb-2">📊 Formula Explanation</h4>
                <div className="space-y-3 text-sm text-slate-700">
                  <p>
                    <strong className="text-blue-700">Monthly Work %</strong> = Sum of contributions from all approved days in the month
                  </p>
                  <div className="bg-white p-3 rounded-lg font-mono text-xs">
                    monthlyWorkPercentage = Σ (daily_contribution)
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <h4 className="font-bold text-emerald-800 mb-2">📐 Daily Contribution Formula</h4>
                <div className="space-y-3 text-sm text-slate-700">
                  <p>
                    <strong>Fixed Slot per Day</strong> = 100% ÷ Total Working Days in Month
                  </p>
                  <div className="bg-white p-3 rounded-lg font-mono text-xs">
                    fixedDailySlot = 100 / {totalWorkingDays || 0} = {fixedDailySlot.toFixed(2)}%
                  </div>
                  <p className="mt-2">
                    <strong>Daily Contribution</strong> = (Approved % ÷ 100) × Fixed Slot per Day
                  </p>
                  <div className="bg-white p-3 rounded-lg font-mono text-xs">
                    dailyContribution = (approvedPercentage / 100) × fixedDailySlot
                  </div>
                  <div className="bg-white p-3 rounded-lg font-mono text-xs text-emerald-600">
                    Example: (90% / 100) × {fixedDailySlot.toFixed(2)}% = {(90 / 100 * fixedDailySlot).toFixed(2)}% added to monthly total
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                <h4 className="font-bold text-purple-800 mb-2">📅 Working Days Considered</h4>
                <p className="text-sm text-slate-700">
                  Total Working Days = {totalWorkingDays || 0} days
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  This includes all working days in the month (excluding weekly offs and company holidays).
                </p>
              </div>

              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                <h4 className="font-bold text-amber-800 mb-2">⚠️ Important Notes</h4>
                <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                  <li>Only <strong className="text-amber-700">APPROVED</strong> days contribute to the monthly percentage</li>
                  <li>Rejected or pending days do not add any contribution</li>
                  <li>The fixed slot ensures fair distribution across all working days</li>
                  <li>Your monthly percentage cannot exceed 100% even if you get 100% on all days</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 rounded-b-2xl flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Single Dropdown component for all info cards
const InfoDropdown = ({ icon, label, value, options, isOpen, onToggle, onSelect, colorClass }) => {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`w-full rounded-3xl bg-white p-5 shadow-lg shadow-slate-200/60 transition-all hover:shadow-xl cursor-pointer group ${colorClass}`}
      >
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            {icon}
            {label}
          </p>
          <FaChevronDown className={`text-slate-400 text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
        <p className="mt-3 text-3xl font-black text-slate-900 group-hover:scale-105 transition-transform">
          {value}
        </p>
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={onToggle}
          />
          <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="max-h-48 overflow-y-auto">
              {options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelect(option)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const EmployeeWorkTracker = () => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue());
  const [records, setRecords] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [morningSubmitting, setMorningSubmitting] = useState(false);
  const [eveningSubmitting, setEveningSubmitting] = useState(false);
  const [morningForm, setMorningForm] = useState({
    title: "",
    description: "",
  });
  const [eveningDescription, setEveningDescription] = useState("");
  const [eveningPercentage, setEveningPercentage] = useState("");
  const [eveningImages, setEveningImages] = useState([]);
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState("");
  const [showWorkPercentageCalendar, setShowWorkPercentageCalendar] = useState(false);
  const [showCalendarPopup, setShowCalendarPopup] = useState(false);
  const [showMonthlyBreakdown, setShowMonthlyBreakdown] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  
  const monthOptions = useMemo(() => buildMonthOptions(), []);

  // Calculate fixed slot percentage based on total working days
  const fixedSlotPercentage = useMemo(() => {
    const totalWorkingDays = performance?.totalWorkingDays || 0;
    if (totalWorkingDays === 0) return 0;
    return (100 / totalWorkingDays).toFixed(2);
  }, [performance?.totalWorkingDays]);

  // Single dropdown options containing all three metrics
  const calculatedDaysOptions = useMemo(() => {
    return [
      { 
        label: `📊 Working Days: ${performance?.totalWorkingDays || 0} days`, 
        value: "workingDays",
        icon: <FaBriefcase className="text-emerald-500" />,
        description: `Total working days in ${getMonthLabel(selectedMonth)}`
      },
      { 
        label: `📅 Weekly Off: ${performance?.weeklyOffLabels?.join(", ") || "Sunday"}`, 
        value: "weeklyOff",
        icon: <FaCalendarWeek className="text-amber-500" />,
        description: "Weekly off days pattern"
      },
      { 
        label: `🏢 Holidays: ${performance?.holidayCount || 0} days`, 
        value: "holidays",
        icon: <FaBuilding className="text-purple-500" />,
        description: `Company holidays in ${getMonthLabel(selectedMonth)}`
      },
    ];
  }, [performance?.totalWorkingDays, performance?.weeklyOffLabels, performance?.holidayCount, selectedMonth]);

  const todayDateKey = useMemo(() => getTodayDateKey(), []);

  const todayRecord = useMemo(
    () =>
      records.find((record) => {
        const recordDate = new Date(record.date);
        const localRecordDate = new Date(
          recordDate.getTime() - recordDate.getTimezoneOffset() * 60 * 1000
        )
          .toISOString()
          .split("T")[0];

        return localRecordDate === todayDateKey;
      }) || null,
    [records, todayDateKey]
  );

  const isViewingCurrentMonth = useMemo(
    () => selectedMonth === todayDateKey.slice(0, 7),
    [selectedMonth, todayDateKey]
  );

  // Filter records based on selected date from calendar
  const displayedRecords = useMemo(() => {
    if (selectedCalendarDateKey) {
      // Show only the selected date's record if a date is selected
      const selectedRecord = records.find(
        (record) => getWorkDateKey(record.date) === selectedCalendarDateKey
      );
      return selectedRecord ? [selectedRecord] : [];
    }
    
    if (isViewingCurrentMonth) {
      return todayRecord ? [todayRecord] : [];
    }

    return records;
  }, [isViewingCurrentMonth, records, todayRecord, selectedCalendarDateKey]);

  const latestDailyCalculatedPercentage = useMemo(
    () => Number(performance?.employeePortalDailyPercentage ?? 0),
    [performance?.employeePortalDailyPercentage]
  );

  const latestDailyPercentageLabel = useMemo(() => {
    if (!performance?.latestGeneratedDate) {
      return "Visible after admin approval";
    }

    return `Calculated share from ${new Date(
      performance.latestGeneratedDate
    ).toLocaleDateString()}`;
  }, [performance?.latestGeneratedDate]);

  const selectedCalendarRecord = useMemo(
    () =>
      records.find((record) => getWorkDateKey(record.date) === selectedCalendarDateKey) || null,
    [records, selectedCalendarDateKey]
  );

  const selectedCalendarDailyShare = useMemo(() => {
    const totalWorkingDays = Number(performance?.totalWorkingDays ?? 0);
    const selectedApprovedPercentage = Number(
      selectedCalendarRecord?.daily_work_percentage ?? 0
    );

    if (!selectedCalendarRecord || !totalWorkingDays) {
      return 0;
    }

    return Number((selectedApprovedPercentage / totalWorkingDays).toFixed(2));
  }, [performance?.totalWorkingDays, selectedCalendarRecord]);

  const loadRecords = async (monthValue = selectedMonth) => {
    setLoading(true);
    try {
      const [year, month] = monthValue.split("-");
      const response = await getMyDailyWorkRecords(Number(month), Number(year));
      if (response.success) {
        setRecords((response.data || []).map(normalizeWorkRecord));
        setPerformance(response.performance || null);
      }
    } catch (error) {
      console.error("Daily work load failed:", error);
      Swal.fire("Error", "Unable to load your work tracker right now.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [selectedMonth]);

  useEffect(() => {
    setSelectedCalendarDateKey((current) => {
      if (current && current.startsWith(selectedMonth)) {
        return current;
      }

      const todayInSelectedMonth = todayDateKey.startsWith(selectedMonth)
        ? todayDateKey
        : null;
      const firstRecordDateKey = records[0] ? getWorkDateKey(records[0].date) : "";

      return todayInSelectedMonth || firstRecordDateKey || `${selectedMonth}-01`;
    });
  }, [records, selectedMonth, todayDateKey]);

  const handleMorningSubmit = async (event) => {
    event.preventDefault();

    if (!morningForm.title.trim() || !morningForm.description.trim()) {
      Swal.fire("Missing details", "Please fill title and description.", "warning");
      return;
    }

    setMorningSubmitting(true);
    try {
      const response = await submitMorningWork(morningForm);
      if (response.success) {
        Swal.fire("Submitted", response.message, "success");
        setMorningForm({ title: "", description: "" });
        const currentMonth = getCurrentMonthValue();
        setSelectedMonth(currentMonth);
        await loadRecords(currentMonth);
      }
    } catch (error) {
      Swal.fire(
        "Morning work failed",
        error.response?.data?.message || "Please try again.",
        "error"
      );
    } finally {
      setMorningSubmitting(false);
    }
  };

  const handleEveningFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    const validTypes = ["image/jpeg", "image/jpg", "image/png"];
    const invalidFile = files.find((file) => !validTypes.includes(file.type));

    if (invalidFile) {
      Swal.fire("Invalid file", "Only JPG and PNG images are allowed.", "warning");
      event.target.value = "";
      return;
    }

    setEveningImages(files);
  };

  const handleEveningSubmit = async (event) => {
    event.preventDefault();
    const normalizedPercentage = Number(eveningPercentage);

    if (!eveningDescription.trim()) {
      Swal.fire("Missing details", "Please add the evening description.", "warning");
      return;
    }

    if (
      eveningPercentage === "" ||
      Number.isNaN(normalizedPercentage) ||
      normalizedPercentage < 0 ||
      normalizedPercentage > 100
    ) {
      Swal.fire(
        "Missing percentage",
        "Please enter your work percentage between 0 and 100.",
        "warning"
      );
      return;
    }

    setEveningSubmitting(true);
    try {
      const response = await submitEveningWork(
        eveningDescription,
        eveningImages,
        normalizedPercentage
      );
      if (response.success) {
        Swal.fire("Submitted", response.message, "success");
        setEveningDescription("");
        setEveningPercentage("");
        setEveningImages([]);
        if (response.data?._id) {
          setRecords((current) => {
            const nextRecord = normalizeWorkRecord(response.data);
            const withoutCurrentDay = current.filter((record) => record._id !== nextRecord._id);
            return [nextRecord, ...withoutCurrentDay];
          });
        }
        const currentMonth = getCurrentMonthValue();
        setSelectedMonth(currentMonth);
        await loadRecords(currentMonth);
      }
    } catch (error) {
      Swal.fire(
        "Evening work failed",
        error.response?.data?.message || "Please try again.",
        "error"
      );
    } finally {
      setEveningSubmitting(false);
    }
  };

  const handleDateSelect = (dateKey) => {
    setSelectedCalendarDateKey(dateKey);
    setShowCalendarPopup(false);
  };

  const handleClosePopup = () => {
    setShowCalendarPopup(false);
    setSelectedCalendarDateKey("");
  };

  const handleDropdownSelect = (option) => {
    // Show info alert with details for the selected metric
    if (option.value === 'workingDays') {
      Swal.fire({
        title: 'Working Days',
        html: `
          <div class="text-left">
            <p class="mb-2"><strong>Total Working Days:</strong> ${performance?.totalWorkingDays || 0} days</p>
            <p class="text-sm text-slate-500">This includes all working days in ${getMonthLabel(selectedMonth)} excluding weekly offs and company holidays.</p>
            <p class="text-sm text-slate-500 mt-2"><strong>Fixed Slot per Day:</strong> ${fixedSlotPercentage}%</p>
          </div>
        `,
        icon: 'info',
        confirmButtonColor: '#6366f1',
      });
    } else if (option.value === 'weeklyOff') {
      Swal.fire({
        title: 'Weekly Off Pattern',
        html: `
          <div class="text-left">
            <p class="mb-2"><strong>Weekly Off Days:</strong> ${performance?.weeklyOffLabels?.join(", ") || "Sunday"}</p>
            <p class="text-sm text-slate-500">These days are considered non-working days and are excluded from total working days calculation.</p>
          </div>
        `,
        icon: 'info',
        confirmButtonColor: '#6366f1',
      });
    } else if (option.value === 'holidays') {
      Swal.fire({
        title: 'Company Holidays',
        html: `
          <div class="text-left">
            <p class="mb-2"><strong>Total Holidays:</strong> ${performance?.holidayCount || 0} days</p>
            <p class="text-sm text-slate-500">Company declared holidays in ${getMonthLabel(selectedMonth)} that are excluded from working days.</p>
          </div>
        `,
        icon: 'info',
        confirmButtonColor: '#6366f1',
      });
    }
    setOpenDropdown(null);
  };

  // Helper function to render morning update section based on submission status
const renderMorningUpdateSection = () => {
  const morningSubmitted = Boolean(todayRecord?.morning_time);
  const eveningSubmitted = Boolean(todayRecord?.evening_time);

  // If morning is NOT submitted - show ONLY morning form
  if (!morningSubmitted) {
    return (
      <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Morning Update</h2>
            <p className="mt-1 text-sm text-slate-500">
              Submit the first work update for today. Only one morning entry is allowed each day.
            </p>
          </div>
        </div>

        <form onSubmit={handleMorningSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Morning Title
            </label>
            <input
              type="text"
              value={morningForm.title}
              onChange={(event) =>
                setMorningForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="What is the main focus this morning?"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Morning Description
            </label>
            <textarea
              rows="4"
              value={morningForm.description}
              onChange={(event) =>
                setMorningForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Describe your planned tasks, meetings, or priorities."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400"
            />
          </div>

          <button
            type="submit"
            disabled={morningSubmitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FaClock />
            {morningSubmitting ? "Submitting..." : "Submit Morning Work"}
          </button>
        </form>
      </div>
    );
  }

  // If morning IS submitted - show ONLY evening form
  if (morningSubmitted && !eveningSubmitted) {
    return (
      <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Evening Update</h2>
            <p className="mt-1 text-sm text-slate-500">
              Complete your day by submitting evening work details.
            </p>
          </div>
          {todayRecord?.morning_time && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              Morning submitted at {todayRecord.morning_time}
            </span>
          )}
        </div>

        <form onSubmit={handleEveningSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Evening Description
            </label>
            <textarea
              rows="5"
              value={eveningDescription}
              onChange={(event) => setEveningDescription(event.target.value)}
              placeholder="Summarize what was completed, blockers resolved, and outcomes achieved."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-cyan-400"
            />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
              <FaPercentage className="text-indigo-500" />
              Your work percentage for today
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Enter your score out of 100
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={eveningPercentage}
                  onChange={(event) => setEveningPercentage(event.target.value)}
                  placeholder="Example: 82"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400"
                />
              </div>
              <p className="max-w-xs text-xs font-semibold leading-relaxed text-slate-500">
                This value is sent to admin as your own daily score suggestion.
              </p>
            </div>
          </div>

          <label className="block rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-cyan-400 hover:bg-cyan-50/60">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              multiple
              onChange={handleEveningFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <span className="rounded-2xl bg-white p-3 text-cyan-600 shadow">
                <FaUpload size={20} />
              </span>
              <p className="font-semibold text-slate-700">Upload work images</p>
              <p className="text-xs">PNG or JPG only, up to 5 images.</p>
            </div>
          </label>

          {eveningImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {eveningImages.map((file) => (
                <span
                  key={`${file.name}-${file.size}`}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {file.name}
                </span>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={eveningSubmitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FaCloudUploadAlt />
            {eveningSubmitting ? "Submitting..." : "Submit Evening Work"}
          </button>
        </form>
      </div>
    );
  }

  // If both morning and evening are submitted - show status message
  if (morningSubmitted && eveningSubmitted) {
    const workStatus = todayRecord?.status;
    
    if (workStatus === 'pending') {
      return (
        <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
          <div className="mb-5">
            <h2 className="text-2xl font-black text-slate-900">Work Submitted</h2>
            <p className="mt-1 text-sm text-slate-500">
              Your complete work for today has been submitted and is pending admin approval.
            </p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-5 text-center">
            <p className="text-amber-700 font-semibold">
              ⏳ Your work is under review. After approval, you can see today's score in "My Records".
            </p>
          </div>
        </div>
      );
    }
    
    if (workStatus === 'approved') {
      return (
        <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
          <div className="mb-5">
            <h2 className="text-2xl font-black text-slate-900">Work Approved</h2>
            <p className="mt-1 text-sm text-slate-500">
              Your work has been approved by the admin.
            </p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-5 text-center">
            <p className="text-emerald-700 font-semibold">
              ✅ Your work has been approved! View your score in "My Records" section below.
            </p>
          </div>
        </div>
      );
    }
    
    if (workStatus === 'rejected') {
      return (
        <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
          <div className="mb-5">
            <h2 className="text-2xl font-black text-slate-900">Work Rejected</h2>
            <p className="mt-1 text-sm text-slate-500">
              Your submission was reviewed and requires changes.
            </p>
          </div>
          <div className="rounded-2xl bg-rose-50 p-5 text-center">
            <p className="text-rose-700 font-semibold">
              ❌ Your work was rejected. Please contact your manager for more information.
            </p>
          </div>
        </div>
      );
    }
  }

  return null;
};

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef4ff,_#f8fafc_45%,_#f8fafc)] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5">
                <FaClipboardList className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Daily Work Tracker
                </span>
              </div>
              <h1 className="text-lg font-semibold text-slate-800 md:text-xl">
                Your Daily <span className="text-blue-600">Performance Records</span>
              </h1>
              <p className="text-xs text-slate-500">
                Submit your morning plan, close the day with real outcomes, add your
                own work score, and watch your monthly progress build up.
              </p>
              <div className="pt-2">
            
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 min-w-[320px]">
              {/* Review Month Dropdown */}
              <div className="min-w-[160px]">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Review Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                >
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Single Dropdown for Calculated Days */}
              <div className="min-w-[180px]">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Calculated Days
                </label>
                <div className="relative">
                  <button
                    onClick={() => setOpenDropdown(openDropdown === 'calculatedDays' ? null : 'calculatedDays')}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <FaCalculator className="text-indigo-500 text-xs" />
                      View Details
                    </span>
                    <FaChevronDown className={`text-slate-400 text-xs transition-transform duration-200 ${openDropdown === 'calculatedDays' ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {openDropdown === 'calculatedDays' && (
                    <>
                      <div 
                        className="fixed inset-0 z-40"
                        onClick={() => setOpenDropdown(null)}
                      />
                      <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="py-1">
                          {calculatedDaysOptions.map((option, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleDropdownSelect(option)}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 flex items-center gap-3"
                            >
                              <span className="text-base">{option.icon || (option.value === 'workingDays' ? '📊' : option.value === 'weeklyOff' ? '📅' : '🏢')}</span>
                              <div className="flex-1">
                                <span>{option.label}</span>
                                {option.description && (
                                  <p className="text-xs text-slate-400 mt-0.5">{option.description}</p>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  {/* Combined Status Card - Approved/Rejected/Missed Days */}
  <div className="rounded-3xl bg-gradient-to-br from-white to-slate-50 p-5 shadow-lg shadow-slate-200/60 border border-slate-100">
    <div className="flex items-center gap-2 mb-4">
      <div className="p-1.5 rounded-lg bg-slate-100">
        <FaClipboardList className="h-3.5 w-3.5 text-slate-500" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Work Status Summary
      </p>
    </div>
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 text-center">
        <p className="text-2xl font-black text-emerald-600">
          {performance?.approvedDays || 0}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
          Approved
        </p>
      </div>
      <div className="w-px h-8 bg-slate-200"></div>
      <div className="flex-1 text-center">
        <p className="text-2xl font-black text-rose-600">
          {performance?.rejectedDays || 0}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">
          Rejected
        </p>
      </div>
      <div className="w-px h-8 bg-slate-200"></div>
      <div className="flex-1 text-center">
        <p className="text-2xl font-black text-amber-600">
          {(() => {
            // Calculate missed days based on working days passed in the month
            const totalWorkingDays = performance?.totalWorkingDays || 0;
            const approvedDays = performance?.approvedDays || 0;
            const rejectedDays = performance?.rejectedDays || 0;
            const submittedDays = approvedDays + rejectedDays;
            
            // Get current date to determine how many working days have passed
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const selectedMonthDate = new Date(selectedMonth);
            const isCurrentMonth = selectedMonthDate.getMonth() === currentMonth && 
                                   selectedMonthDate.getFullYear() === currentYear;
            
            let workingDaysPassed = totalWorkingDays;
            
            if (isCurrentMonth) {
              // For current month, calculate working days passed up to today
              const weeklyOffs = performance?.weeklyOffLabels?.map(day => 
                ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day)
              ) || [0]; // Sunday default
              
              const holidays = performance?.holidayDates || [];
              
              let daysPassed = 0;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              for (let d = new Date(currentYear, currentMonth, 1); d <= today; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getDay();
                const dateKey = d.toISOString().split('T')[0];
                
                // Check if it's a working day (not weekend and not holiday)
                if (!weeklyOffs.includes(dayOfWeek) && !holidays.includes(dateKey)) {
                  daysPassed++;
                }
              }
              workingDaysPassed = daysPassed;
            }
            
            const missedDays = Math.max(0, workingDaysPassed - submittedDays);
            return missedDays;
          })()}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
          Missed
        </p>
      </div>
    </div>
    <div className="mt-3 pt-2 border-t border-slate-100">
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>📊 Total Days</span>
        <span className="font-semibold text-slate-600">
          {(() => {
            const totalWorkingDays = performance?.totalWorkingDays || 0;
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const selectedMonthDate = new Date(selectedMonth);
            const isCurrentMonth = selectedMonthDate.getMonth() === currentMonth && 
                                   selectedMonthDate.getFullYear() === currentYear;
            
            if (isCurrentMonth) {
              // For current month, show working days passed
              const weeklyOffs = performance?.weeklyOffLabels?.map(day => 
                ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day)
              ) || [0];
              const holidays = performance?.holidayDates || [];
              
              let daysPassed = 0;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              for (let d = new Date(currentYear, currentMonth, 1); d <= today; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getDay();
                const dateKey = d.toISOString().split('T')[0];
                if (!weeklyOffs.includes(dayOfWeek) && !holidays.includes(dateKey)) {
                  daysPassed++;
                }
              }
              return `${daysPassed} / ${totalWorkingDays} working days passed`;
            }
            return `${totalWorkingDays} total working days`;
          })()}
        </span>
      </div>
    </div>
  </div>

  {/* Fixed Slot Per Day */}
  <div className="rounded-3xl bg-gradient-to-br from-white to-sky-50 p-5 shadow-lg shadow-slate-200/60 border border-sky-100 group hover:shadow-xl transition-all">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-sky-100">
          <FaChartLine className="h-3.5 w-3.5 text-sky-500" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Fixed Slot Per Day
        </p>
      </div>
      <span className="text-[9px] font-mono text-sky-400 bg-sky-50 px-1.5 py-0.5 rounded-full">
        {performance?.totalWorkingDays || 0} days
      </span>
    </div>
    <p className="mt-3 text-4xl font-black text-sky-600 group-hover:scale-105 transition-transform origin-left">
      {fixedSlotPercentage}%
    </p>
    <p className="mt-2 text-[11px] font-medium text-slate-400">
      100% ÷ {performance?.totalWorkingDays || 0} working days
    </p>
  </div>

  {/* Daily Percentage */}
  <div 
    className="rounded-3xl bg-gradient-to-br from-white to-cyan-50 p-5 shadow-lg shadow-slate-200/60 border border-cyan-100 cursor-pointer transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] group"
    onClick={() => setShowMonthlyBreakdown(true)}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-cyan-100">
          <FaPercentage className="h-3.5 w-3.5 text-cyan-500" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Last Assigned Percentage
        </p>
      </div>
      <FaInfoCircle className="text-slate-300 text-[10px] group-hover:text-cyan-400 transition" />
    </div>
    <p className="mt-3 text-4xl font-black text-cyan-600 group-hover:scale-105 transition-transform origin-left">
      {latestDailyCalculatedPercentage}%
    </p>
    <p className="mt-2 text-[11px] font-medium text-slate-400">
      {latestDailyPercentageLabel}
    </p>
  </div>

  {/* Monthly Work % */}
  <div 
    className="rounded-3xl bg-gradient-to-br from-white to-indigo-50 p-5 shadow-lg shadow-slate-200/60 border border-indigo-100 cursor-pointer transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] group"
    onClick={() => setShowMonthlyBreakdown(true)}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-indigo-100">
          <FaPercentage className="h-3.5 w-3.5 text-indigo-500" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Monthly Work %
        </p>
      </div>
      <FaInfoCircle className="text-slate-300 text-[10px] group-hover:text-indigo-400 transition" />
    </div>
    <p className="mt-3 text-4xl font-black text-indigo-600 group-hover:scale-105 transition-transform origin-left">
      {performance?.monthlyWorkPercentage || 0}%
    </p>
    <p className="mt-2 text-[11px] font-medium text-slate-400">
      Running month percentage
    </p>
  </div>
</div>
        {/* Monthly Percentage Breakdown Popup */}
        <MonthlyPercentageBreakdown
          isOpen={showMonthlyBreakdown}
          onClose={() => setShowMonthlyBreakdown(false)}
          records={records}
          totalWorkingDays={performance?.totalWorkingDays || 0}
          monthlyWorkPercentage={performance?.monthlyWorkPercentage || 0}
          selectedMonth={selectedMonth}
        />

        {performance?.weeklyPerformance?.length ? (
          <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
            <div className="mb-5">
              <h2 className="text-2xl font-black text-slate-900">Weekly Performance</h2>
              <p className="mt-1 text-sm text-slate-500">
                Weekly score is the sum of all approved daily work percentages within that week,
                carried forward from the first working day to the last approved day of that week.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {performance.weeklyPerformance.map((week) => (
                <div
                  key={week.weekLabel}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    {week.weekLabel}
                  </p>
                  <p className="mt-3 text-3xl font-black text-indigo-600">
                    {week.weeklyPercentage}%
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Working days: {week.workingDays}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            {renderMorningUpdateSection()}

          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    Review Work Percentage
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Open the work percentage calendar to view daily records, submitted score,
                    approved score, and performance details month-wise.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCalendarPopup(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl"
                >
                  <FaCalendarAlt />
                  Work Percentage Calendar
                </button>
              </div>
            </div>

            {showCalendarPopup && (
              <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4">
                <div className="w-full max-w-5xl rounded-[32px] bg-white p-6 shadow-2xl">
                  <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900">Work Percentage Calendar</h3>
                      <p className="mt-1 max-w-2xl text-sm text-slate-500">
                        Click any date to view that day's work details in the records section below.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleClosePopup}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                    >
                      ×
                    </button>
                  </div>

                  <WorkRecordsCalendar
                    monthValue={selectedMonth}
                    records={records}
                    selectedDateKey={selectedCalendarDateKey || todayDateKey}
                    onSelectDate={handleDateSelect}
                    loading={loading}
                    isModal
                  />
                </div>
              </div>
            )}

            <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
              <div className="mb-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">My Records</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedCalendarDateKey 
                      ? `Showing record for ${new Date(selectedCalendarDateKey).toLocaleDateString()}`
                      : isViewingCurrentMonth 
                        ? "Showing today's record. Click on any date in the calendar to view specific day details."
                        : "Review your submitted score, the admin-approved score, and all work submissions for the selected month."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {selectedCalendarDateKey && (
                    <button
                      type="button"
                      onClick={() => setSelectedCalendarDateKey("")}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                    >
                      Clear Filter
                    </button>
                  )}
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {displayedRecords.length} {displayedRecords.length === 1 ? "entry" : "entries"}
                  </span>
                </div>
              </div>

              {loading ? (
                <div className="flex min-h-[420px] items-center justify-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
                </div>
              ) : displayedRecords.length === 0 ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center text-slate-400">
                  {selectedCalendarDateKey ? (
                    <>
                      <FaCalendarAlt size={46} className="mb-4 opacity-30" />
                      <p className="text-lg font-semibold text-slate-500">
                        No work record for {new Date(selectedCalendarDateKey).toLocaleDateString()}
                      </p>
                      <p className="mt-2 max-w-sm text-sm">
                        This date doesn't have any work submission yet.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedCalendarDateKey("")}
                        className="mt-4 rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-200"
                      >
                        Clear Selection
                      </button>
                    </>
                  ) : isViewingCurrentMonth ? (
                    <>
                      <FaClipboardList size={46} className="mb-4 opacity-30" />
                      <p className="text-lg font-semibold text-slate-500">
                        You have not yet submitted today’s work update.
                      </p>
                      <p className="mt-2 max-w-sm text-sm">
                        Submit your morning work first to see today’s entry here.
                      </p>
                    </>
                  ) : (
                    <>
                      <FaClipboardList size={46} className="mb-4 opacity-30" />
                      <p className="text-lg font-semibold text-slate-500">
                        No work entries for this month yet.
                      </p>
                      <p className="mt-2 max-w-sm text-sm">
                        Your approved, rejected, and pending work logs will appear here once
                        submitted.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {displayedRecords.map((record) => (
                    <article
                      key={record._id}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm"
                    >
                      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                            <FaCalendarAlt />
                            {new Date(record.date).toLocaleDateString()}
                          </p>
                          <h3 className="mt-2 text-lg font-black text-slate-900">
                            {record.morning_title}
                          </h3>
                        </div>
                        <span
                          className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${getStatusClasses(
                            record.status
                          )}`}
                        >
                          {record.status}
                        </span>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4">
                          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Morning
                          </p>
                          <p className="text-sm text-slate-700">{record.morning_description}</p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">
                            Time: {record.morning_time || "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white p-4">
                          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Evening
                          </p>
                          <p className="text-sm text-slate-700">
                            {record.evening_description || "Evening work not submitted yet."}
                          </p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">
                            Time: {record.evening_time || "-"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Your Submitted %
                          </p>
                          <p className="mt-2 text-2xl font-black text-cyan-600">
                            {record.employee_submitted_percentage ?? "-"}%
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                                Final Approved %
                              </p>
                              <p className="mt-2 text-2xl font-black text-indigo-600">
                                {record.daily_work_percentage || 0}%
                              </p>
                            </div>
                            <div className="text-left sm:text-right text-xs font-semibold text-slate-500">
                              <p>Mode: {record.percentage_mode || "none"}</p>
                              <p>
                                Generated:{" "}
                                {record.percentage_generated_at
                                  ? new Date(record.percentage_generated_at).toLocaleString()
                                  : "Not generated"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {record.images?.length ? (
                        <div className="mt-4">
                          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            <FaCamera />
                            Uploaded Images
                          </p>
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                            {record.images.map((image) => (
                              <a
                                key={image._id}
                                href={image.image_url}
                                target="_blank"
                                rel="noreferrer"
                                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                              >
                                <img
                                  src={image.image_url}
                                  alt="Work evidence"
                                  className="h-28 w-full object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeWorkTracker;
