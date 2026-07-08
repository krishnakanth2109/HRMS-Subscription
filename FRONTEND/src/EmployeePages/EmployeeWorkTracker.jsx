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
  FaEdit,
  FaTrash,
  FaSave,
} from "react-icons/fa";

import {
  getMyDailyWorkRecords,
  submitEveningWork,
  submitMorningWork,
  editEveningWork,
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
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 md:px-6 bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-t-2xl">
          <div className="min-w-0">
            <h3 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2 truncate">
              <FaChartPie className="text-indigo-500 shrink-0" />
              Monthly Work Details
            </h3>
            <p className="text-[10px] md:text-sm text-slate-500 mt-1 truncate">
              {getMonthLabel(selectedMonth)} • Working Days: {totalWorkingDays || 0}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition shrink-0"
          >
            <FaTimes />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          <button
            onClick={() => setActiveTab("breakdown")}
            className={`px-4 py-3 text-sm font-medium transition relative ${activeTab === "breakdown"
              ? "text-indigo-600 border-b-2 border-indigo-600"
              : "text-slate-500 hover:text-slate-700"
              }`}
          >
            Day-wise Breakdown
          </button>
          <button
            onClick={() => setActiveTab("formula")}
            className={`px-4 py-3 text-sm font-medium transition relative ${activeTab === "formula"
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
            <div className="space-y-4">
              {calculateDailyContributions.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <FaCheckCircle className="mx-auto text-4xl mb-4 text-slate-200" />
                  <p className="font-semibold">No approved entries found</p>
                  <p className="text-xs mt-1">Your approved daily logs will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Table Header - Desktop Only */}
                  <div className="hidden md:grid grid-cols-12 gap-2 pb-3 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <div className="col-span-5">Date & Task</div>
                    <div className="col-span-2 text-center">Approved</div>
                    <div className="col-span-2 text-center">Slot</div>
                    <div className="col-span-3 text-right">Contribution</div>
                  </div>

                  {/* Data Rows */}
                  <div className="space-y-2">
                    {calculateDailyContributions.map((item, idx) => (
                      <div
                        key={item.date}
                        className={`p-3 md:p-0 md:bg-transparent md:grid md:grid-cols-12 md:gap-2 md:py-3 rounded-xl border border-slate-100 md:border-0 shadow-sm md:shadow-none bg-white ${idx % 2 === 0 ? "md:bg-slate-50/50" : ""
                          }`}
                      >
                        {/* Mobile: Date Header */}
                        <div className="md:col-span-5 mb-2 md:mb-0">
                          <div className="flex justify-between items-start md:block">
                            <div className="font-bold text-slate-800 text-sm md:text-sm">{item.formattedDate}</div>
                            <div className="md:hidden">
                              <span className="text-[10px] font-black text-cyan-600 bg-cyan-50 px-2 py-1 rounded-lg">
                                +{item.contributionDisplay}%
                              </span>
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {item.morning_title}
                          </div>
                        </div>

                        {/* Approved % */}
                        <div className="flex justify-between md:contents text-xs md:text-sm border-t border-slate-50 pt-2 md:pt-0">
                          <span className="md:hidden text-slate-400 font-medium">Approved %</span>
                          <div className="md:col-span-2 text-center">
                            <span className="font-bold text-indigo-600 md:bg-indigo-50 md:px-2 md:py-1 md:rounded-lg">
                              {item.approvedPercentage}%
                            </span>
                          </div>
                        </div>

                        {/* Slot % */}
                        <div className="flex justify-between md:contents text-xs md:text-sm mt-1 md:mt-0">
                          <span className="md:hidden text-slate-400 font-medium">Fixed Slot</span>
                          <div className="md:col-span-2 text-center text-slate-600 font-medium">
                            {item.fixedSlotPercentage.toFixed(2)}%
                          </div>
                        </div>

                        {/* Desktop Contribution */}
                        <div className="hidden md:block md:col-span-3 text-right">
                          <span className="font-black text-cyan-600 text-sm">
                            +{item.contributionDisplay}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total Summary Card */}
                  <div className="mt-6 overflow-hidden rounded-2xl border border-indigo-100 shadow-lg shadow-indigo-100/50">
                    <div className="bg-indigo-600 p-4 text-white">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold opacity-90 uppercase tracking-widest">Total Monthly Progress</span>
                        <span className="text-2xl font-black">{monthlyWorkPercentage || 0}%</span>
                      </div>
                    </div>
                    <div className="bg-white p-4">
                      <div className="flex items-center gap-3 text-xs text-slate-500 leading-relaxed">
                        <div className="p-2 bg-amber-50 rounded-lg shrink-0">
                          <FaInfoCircle className="text-amber-500" />
                        </div>
                        <p>
                          <strong>Calculation logic:</strong> Each day's contribution is calculated as
                          <span className="text-indigo-600 font-bold mx-1">({fixedDailySlot.toFixed(2)}% × Approved %)</span>
                          and added to the monthly total.
                        </p>
                      </div>
                    </div>
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

  // Edit states
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editEveningDescription, setEditEveningDescription] = useState("");
  const [editEveningPercentage, setEditEveningPercentage] = useState("");
  const [editEveningImages, setEditEveningImages] = useState([]);
  const [editExistingImages, setEditExistingImages] = useState([]);
  const [editImagesToDelete, setEditImagesToDelete] = useState([]);
  const [editSubmitting, setEditSubmitting] = useState(false);

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

  const openEditForm = (record) => {
    setEditingRecordId(record._id);
    setEditEveningDescription(record.evening_description || "");
    setEditEveningPercentage(record.employee_submitted_percentage || "");
    setEditExistingImages(record.images || []);
    setEditEveningImages([]);
    setEditImagesToDelete([]);
  };

  const closeEditForm = () => {
    setEditingRecordId(null);
  };

  const handleEditFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    const validTypes = ["image/jpeg", "image/jpg", "image/png"];
    const invalidFile = files.find((file) => !validTypes.includes(file.type));

    if (invalidFile) {
      Swal.fire("Invalid file", "Only JPG and PNG images are allowed.", "warning");
      event.target.value = "";
      return;
    }
    setEditEveningImages(prev => [...prev, ...files].slice(0, 5));
  };

  const handleDeleteExistingImage = (imageId) => {
    setEditExistingImages(prev => prev.filter(img => img._id !== imageId));
    setEditImagesToDelete(prev => [...prev, imageId]);
  };

  const handleRemoveNewImage = (indexToRemove) => {
    setEditEveningImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleEditSubmit = async (event, recordId) => {
    event.preventDefault();
    const normalizedPercentage = Number(editEveningPercentage);

    if (!editEveningDescription.trim()) {
      Swal.fire("Missing details", "Please add the evening description.", "warning");
      return;
    }

    if (
      editEveningPercentage === "" ||
      Number.isNaN(normalizedPercentage) ||
      normalizedPercentage < 0 ||
      normalizedPercentage > 100
    ) {
      Swal.fire(
        "Invalid percentage",
        "Please enter your work percentage between 0 and 100.",
        "warning"
      );
      return;
    }

    setEditSubmitting(true);
    try {
      const response = await editEveningWork(
        recordId,
        editEveningDescription,
        editEveningImages,
        editImagesToDelete,
        normalizedPercentage
      );

      if (response.success) {
        Swal.fire("Updated", response.message, "success");
        closeEditForm();
        const currentMonth = getCurrentMonthValue();
        setSelectedMonth(currentMonth);
        await loadRecords(currentMonth);
      }
    } catch (error) {
      Swal.fire(
        "Edit failed",
        error.response?.data?.message || "Please try again.",
        "error"
      );
    } finally {
      setEditSubmitting(false);
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
                  <div
                    key={`${file.name}-${file.size}`}
                    className="flex items-center gap-2 rounded-lg bg-slate-100 p-2 border border-slate-200"
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt="preview"
                      className="h-10 w-10 rounded-md object-cover"
                    />
                    <span className="text-xs font-semibold text-slate-700 max-w-[120px] truncate">
                      {file.name}
                    </span>
                  </div>
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
    <div className="min-h-screen  p-3 md:p-8">
      <div className="mx-auto max-w-7xl space-y-4 md:space-y-6">
        {/* Header Section */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 md:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-lg border border-blue-100">
                <FaClipboardList className="h-3 w-3 text-blue-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                  Daily Work Tracker
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                Your Daily <span className="text-blue-600">Performance Records</span>
              </h1>
              <p className="text-xs md:text-sm text-slate-500 font-medium leading-relaxed max-w-2xl">
                Submit morning plans, close the day with outcomes, and watch your monthly progress build up automatically.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 lg:shrink-0">
              {/* Review Month */}
              <div className="flex-1 sm:w-48">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">
                  Review Month
                </label>
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  >
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <FaChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]" />
                </div>
              </div>

              {/* Calculated Days Dropdown */}
              <div className="flex-1 sm:w-52">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">
                  Calculated Days
                </label>
                <div className="relative">
                  <button
                    onClick={() => setOpenDropdown(openDropdown === 'calculatedDays' ? null : 'calculatedDays')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 flex items-center justify-between transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <FaCalculator className="text-indigo-500 text-xs" />
                      View Details
                    </span>
                    <FaChevronDown className={`text-slate-400 text-xs transition-transform duration-200 ${openDropdown === 'calculatedDays' ? 'rotate-180' : ''}`} />
                  </button>

                  {openDropdown === 'calculatedDays' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                      <div className="absolute top-full right-0 mt-2 w-full sm:w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-2 space-y-1">
                          {calculatedDaysOptions.map((option, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleDropdownSelect(option)}
                              className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-4 group"
                            >
                              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-white transition-colors">
                                {option.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="block truncate">{option.label}</span>
                                {option.description && (
                                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{option.description}</p>
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

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Work Status Summary */}
          <div className="rounded-3xl bg-white p-5 shadow-lg shadow-slate-200/60 border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-slate-50">
                  <FaClipboardList className="h-3 w-3 text-slate-400" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Work Status Summary
                </p>
              </div>
              <div className="flex items-center justify-between px-1">
                <div className="text-center">
                  <p className="text-xl md:text-2xl font-black text-emerald-600">{performance?.approvedDays || 0}</p>
                  <p className="text-[8px] font-bold uppercase text-emerald-600/70">Approved</p>
                </div>
                <div className="w-px h-8 bg-slate-100"></div>
                <div className="text-center">
                  <p className="text-xl md:text-2xl font-black text-rose-600">{performance?.rejectedDays || 0}</p>
                  <p className="text-[8px] font-bold uppercase text-rose-600/70">Rejected</p>
                </div>
                <div className="w-px h-8 bg-slate-100"></div>
                <div className="text-center">
                  <p className="text-xl md:text-2xl font-black text-amber-600">
                    {(() => {
                      const totalWorkingDays = performance?.totalWorkingDays || 0;
                      const approvedDays = performance?.approvedDays || 0;
                      const rejectedDays = performance?.rejectedDays || 0;
                      const submittedDays = approvedDays + rejectedDays;
                      const now = new Date();
                      const currentMonth = now.getMonth();
                      const currentYear = now.getFullYear();
                      const selectedMonthDate = new Date(selectedMonth);
                      const isCurrentMonth = selectedMonthDate.getMonth() === currentMonth &&
                        selectedMonthDate.getFullYear() === currentYear;
                      let workingDaysPassed = totalWorkingDays;
                      if (isCurrentMonth) {
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
                          if (!weeklyOffs.includes(dayOfWeek) && !holidays.includes(dateKey)) daysPassed++;
                        }
                        workingDaysPassed = daysPassed;
                      }
                      return Math.max(0, workingDaysPassed - submittedDays);
                    })()}
                  </p>
                  <p className="text-[8px] font-bold uppercase text-amber-600/70">Missed</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-[9px] font-bold text-slate-400">
              <span>PROGRESS</span>
              <span className="text-slate-500 uppercase">
                {(() => {
                  const total = performance?.totalWorkingDays || 0;
                  const now = new Date();
                  const selectedMonthDate = new Date(selectedMonth);
                  if (selectedMonthDate.getMonth() === now.getMonth()) {
                    return `${performance?.approvedDays || 0} / ${total} Days`;
                  }
                  return `${total} Working Days`;
                })()}
              </span>
            </div>
          </div>

          {/* Fixed Slot Per Day */}
          <div className="rounded-3xl bg-gradient-to-br from-white to-sky-50 p-5 shadow-lg shadow-slate-200/60 border border-sky-100 group hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-100">
                  <FaChartLine className="h-3.5 w-3.5 text-sky-500" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Fixed Slot / Day
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <p className="text-3xl md:text-4xl font-black text-sky-600 group-hover:scale-105 transition-transform origin-left">
                {fixedSlotPercentage}%
              </p>
              <span className="text-[10px] font-bold text-sky-400 bg-sky-50 px-2 py-0.5 rounded-lg">
                {performance?.totalWorkingDays || 0}d
              </span>
            </div>
            <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
              Based on {performance?.totalWorkingDays || 0} working days
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Daily Share %
                </p>
              </div>
              <FaInfoCircle className="text-slate-300 text-[10px] group-hover:text-cyan-400 transition" />
            </div>
            <p className="mt-3 text-3xl md:text-4xl font-black text-cyan-600 group-hover:scale-105 transition-transform origin-left">
              {latestDailyCalculatedPercentage}%
            </p>
            <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate">
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Monthly Work %
                </p>
              </div>
              <FaInfoCircle className="text-slate-300 text-[10px] group-hover:text-indigo-400 transition" />
            </div>
            <p className="mt-3 text-3xl md:text-4xl font-black text-indigo-600 group-hover:scale-105 transition-transform origin-left">
              {performance?.monthlyWorkPercentage || 0}%
            </p>
            <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
              Current Month Total
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
          <div className="rounded-[28px] bg-white p-5 md:p-6 shadow-xl shadow-slate-200/60 border border-slate-100">
            <div className="mb-6">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Weekly Performance</h2>
              <p className="mt-1 text-xs md:text-sm text-slate-500 font-medium">
                Sum of approved daily work percentages within each week.
              </p>
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
              {performance.weeklyPerformance.map((week) => (
                <div
                  key={week.weekLabel}
                  className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 group hover:bg-white hover:shadow-lg transition-all"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {week.weekLabel}
                  </p>
                  <p className="mt-2 text-3xl font-black text-indigo-600">
                    {week.weeklyPercentage}%
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                      Working days: {week.workingDays}
                    </span>
                  </div>
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
                      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="mb-5 flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            <FaCalendarAlt className="text-blue-400" />
                            {new Date(record.date).toLocaleDateString()}
                          </p>
                          <h3 className="mt-2 text-lg font-black text-slate-900 leading-tight">
                            {record.morning_title}
                          </h3>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {record.status === "pending" && record.evening_time && editingRecordId !== record._id && (
                            <button
                              type="button"
                              onClick={() => openEditForm(record)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-100 transition"
                            >
                              <FaEdit size={12} />
                              Edit
                            </button>
                          )}
                          <span
                            className={`inline-flex items-center rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${getStatusClasses(
                              record.status
                            )}`}
                          >
                            {record.status}
                          </span>
                        </div>
                      </div>

                      {editingRecordId === record._id ? (
                        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-5 mt-4">
                          <h4 className="mb-4 text-sm font-black text-indigo-900 uppercase tracking-widest">Edit Evening Report</h4>
                          <div className="space-y-4">
                            <div>
                              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                                Update Evening Description
                              </label>
                              <textarea
                                value={editEveningDescription}
                                onChange={(e) => setEditEveningDescription(e.target.value)}
                                rows={3}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400"
                              />
                            </div>
                            <div>
                              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                                Update Percentage
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={editEveningPercentage}
                                onChange={(e) => setEditEveningPercentage(e.target.value)}
                                className="w-full max-w-[200px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                                Manage Images
                              </label>

                              {/* Existing Images */}
                              {editExistingImages.length > 0 && (
                                <div className="mb-3 flex flex-wrap gap-2">
                                  {editExistingImages.map(img => (
                                    <div key={img._id} className="relative group rounded-lg overflow-hidden border border-slate-200">
                                      <img src={img.image_url} alt="existing" className="w-16 h-16 object-cover" />
                                      <button type="button" onClick={() => handleDeleteExistingImage(img._id)} className="absolute inset-0 bg-red-500/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <FaTrash className="text-white" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* New Images */}
                              {editEveningImages.length > 0 && (
                                <div className="mb-3 flex flex-wrap gap-2">
                                  {editEveningImages.map((file, idx) => (
                                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-emerald-200">
                                      <img src={URL.createObjectURL(file)} alt="new" className="w-16 h-16 object-cover" />
                                      <button type="button" onClick={() => handleRemoveNewImage(idx)} className="absolute inset-0 bg-red-500/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <FaTrash className="text-white" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {(editExistingImages.length + editEveningImages.length) < 5 && (
                                <label className="inline-block cursor-pointer rounded-xl border border-dashed border-indigo-300 bg-white px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50">
                                  <input type="file" multiple accept="image/png,image/jpeg,image/jpg" onChange={handleEditFileChange} className="hidden" />
                                  + Upload
                                </label>
                              )}
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-indigo-100">
                              <button type="button" onClick={closeEditForm} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                              <button type="button" disabled={editSubmitting} onClick={(e) => handleEditSubmit(e, record._id)} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                                <FaSave size={12} />
                                {editSubmitting ? "Saving..." : "Save Changes"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
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

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl bg-white p-4 border border-slate-100">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                Your Submitted %
                              </p>
                              <p className="mt-1 text-2xl font-black text-cyan-600">
                                {record.employee_submitted_percentage ?? "-"}%
                              </p>
                            </div>

                            <div className="rounded-2xl bg-white p-4 border border-slate-100">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    Final Approved %
                                  </p>
                                  <p className="mt-1 text-2xl font-black text-indigo-600">
                                    {record.daily_work_percentage || 0}%
                                  </p>
                                </div>
                                <div className="text-left sm:text-right text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                  <p>Mode: {record.percentage_mode || "none"}</p>
                                  <p className="mt-0.5">
                                    {record.percentage_generated_at
                                      ? new Date(record.percentage_generated_at).toLocaleDateString()
                                      : "Pending"}
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
                        </>
                      )}
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
