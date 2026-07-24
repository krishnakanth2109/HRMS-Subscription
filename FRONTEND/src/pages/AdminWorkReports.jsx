import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  FaCheck,
  FaClipboardCheck,
  FaEye,
  FaFilter,
  FaIdBadge,
  FaImages,
  FaMagic,
  FaPercentage,
  FaSearch,
  FaTimes,
  FaTrash,
  FaUserTie,
  FaCalendar,
  FaEdit,
  FaUndo,
  FaDownload,
} from "react-icons/fa";
import ImageEditorModal from "../components/ImageEditor/ImageEditorModal";
import AdminAssignTaskModal from "../components/admin/AdminAssignTaskModal";

import {
  reviewWorkEntry,
  bulkGenerateWorkEntryPercentage,
  deleteWorkEntry,
  generateWorkEntryPercentage,
  getAdminWorkPerformance,
  getAdminWorkRecords,
  getWorkPercentageSettings,
  getShiftByEmployeeId,
} from "../api";
import WorkRecordsCalendar, {
  getMonthRangeFromValue,
  getWorkDateKey,
} from "../components/work/WorkRecordsCalendar";

const getStatusClasses = (status) => {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
};

const getMonthValueFromDate = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
  daily_percentage_display: Number(record?.daily_percentage_display ?? 0),
  monthly_work_percentage: Number(record?.monthly_work_percentage ?? 0),
});

/**
 * Compute total working days in a given month for an employee,
 * based on their shift's weeklyOffDays (0=Sun,1=Mon,...,6=Sat).
 * Mirrors the logic the backend uses for the employee side.
 */
const computeWorkingDaysForMonth = (monthValue, weeklyOffDays = [0]) => {
  if (!monthValue) return 0;
  const [year, month] = monthValue.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d += 1) {
    const dayOfWeek = new Date(year, month - 1, d).getDay(); // 0=Sun
    if (!weeklyOffDays.includes(dayOfWeek)) {
      count += 1;
    }
  }
  return count;
};

// Calculate today score based on Fixed Slot/Day and Admin %
const calculateTodayScore = (adminPercentage, perDaySlotPercentage) => {
  if (!adminPercentage || !perDaySlotPercentage) return 0;
  const score = ((adminPercentage / 100) * parseFloat(perDaySlotPercentage));
  return score.toFixed(2);
};

const handleDownloadImage = async (url, filename) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network response was not ok");
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = filename || "download.jpg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error("Download failed:", error);
    window.open(url, "_blank");
  }
};

const AdminWorkReports = () => {
  const [filters, setFilters] = useState({
    employee_query: "",
    start_date: "",
    end_date: "",
    status: "",
    selected_date: getTodayDate(),
  });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedPerformanceMonth, setSelectedPerformanceMonth] = useState("");
  const [selectedEmployeePerformance, setSelectedEmployeePerformance] = useState(null);
  const [selectedEmployeeCalendarRecords, setSelectedEmployeeCalendarRecords] = useState([]);
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState("");
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [employeeCalendarLoading, setEmployeeCalendarLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showAllImages, setShowAllImages] = useState(false);
  const [showAssignTaskModal, setShowAssignTaskModal] = useState(false);

  const [percentageSaving, setPercentageSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [percentageSettings, setPercentageSettings] = useState({
    auto_generate_percentage: true,
    default_daily_target_percentage: 70,
  });
  const [percentageInputs, setPercentageInputs] = useState({});
  const [adminComments, setAdminComments] = useState({});
  const [adminMedia, setAdminMedia] = useState({});
  const [editingImage, setEditingImage] = useState(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState([]);
  const [selectedEmployeeShift, setSelectedEmployeeShift] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [employeeShiftCache, setEmployeeShiftCache] = useState({}); // Cache for employee shifts

  const monthOptions = useMemo(() => buildMonthOptions(), []);

  /**
   * Working days for the selected performance month, derived from
   * the employee's personal shift (weeklyOffDays). Falls back to
   * the performance API totalWorkingDays if shift not yet loaded.
   */
  const computedWorkingDays = useMemo(() => {
    if (selectedEmployeeShift) {
      return computeWorkingDaysForMonth(
        selectedPerformanceMonth,
        selectedEmployeeShift.weeklyOffDays || [0]
      );
    }
    return selectedEmployeePerformance?.totalWorkingDays || 0;
  }, [selectedEmployeeShift, selectedPerformanceMonth, selectedEmployeePerformance?.totalWorkingDays]);

  /** Per-day percentage slot based on employee's real working days */
  const perDaySlotPercentage = useMemo(() => {
    if (!computedWorkingDays) return 0;
    return (100 / computedWorkingDays).toFixed(2);
  }, [computedWorkingDays]);

  const getSuggestedPercentage = (record) =>
    record.employee_submitted_percentage ??
    record.daily_work_percentage ??
    percentageSettings.default_daily_target_percentage ??
    0;

  const fetchRecords = async () => {
    setLoading(true);
    try {
      // If a specific date is selected, use that date range
      const dateFilters = filters.selected_date
        ? {
            ...filters,
            start_date: filters.selected_date,
            end_date: filters.selected_date,
            selected_date: undefined,
          }
        : filters;

      const response = await getAdminWorkRecords(dateFilters);
      if (response.success) {
        setRecords((response.data || []).map(normalizeWorkRecord));
      }
    } catch (error) {
      console.error("Admin work records load failed:", error);
      Swal.fire("Error", "Unable to load work reports.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const response = await getWorkPercentageSettings();
      if (response.success) {
        setPercentageSettings(response.data);
      }
    } catch (error) {
      console.error("Percentage settings load failed:", error);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchSettings();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [filters]);

  useEffect(() => {
    setPercentageInputs((current) => {
      const next = {};
      records.forEach((record) => {
        next[record._id] =
          current[record._id] !== undefined
            ? current[record._id]
            : getSuggestedPercentage(record);
      });
      return next;
    });
  }, [records, percentageSettings.default_daily_target_percentage]);

  useEffect(() => {
    const recordIds = new Set(records.map((record) => record._id));
    setSelectedEntryIds((current) => current.filter((id) => recordIds.has(id)));
  }, [records]);

  useEffect(() => {
    if (!selectedRecord) return;

    const freshRecord = records.find((record) => record._id === selectedRecord._id);
    if (freshRecord) {
      setSelectedRecord(freshRecord);
      return;
    }

    setSelectedRecord(null);
    setSelectedEmployeePerformance(null);
  }, [records, selectedRecord]);

  useEffect(() => {
    if (!selectedRecord?.employeeId?._id || !selectedPerformanceMonth) {
      setSelectedEmployeePerformance(null);
      return;
    }

    const loadSelectedEmployeePerformance = async () => {
      setPerformanceLoading(true);
      try {
        const [year, month] = selectedPerformanceMonth.split("-").map(Number);
        const response = await getAdminWorkPerformance(
          selectedRecord.employeeId._id,
          month,
          year
        );

        if (response.success) {
          setSelectedEmployeePerformance(response.data || null);
        }
      } catch (error) {
        console.error("Admin monthly performance load failed:", error);
        Swal.fire("Error", "Unable to load employee monthly percentage.", "error");
      } finally {
        setPerformanceLoading(false);
      }
    };

    loadSelectedEmployeePerformance();
  }, [selectedPerformanceMonth, selectedRecord?.employeeId?._id, records]);

  useEffect(() => {
    if (!selectedRecord?.employeeId?._id || !selectedRecord?.employeeId?.employeeId || !selectedPerformanceMonth) {
      setSelectedEmployeeCalendarRecords([]);
      return;
    }

    const loadSelectedEmployeeCalendar = async () => {
      setEmployeeCalendarLoading(true);
      try {
        const { startDate, endDate } = getMonthRangeFromValue(selectedPerformanceMonth);
        const response = await getAdminWorkRecords({
          employee_query: selectedRecord.employeeId.employeeId,
          start_date: startDate,
          end_date: endDate,
        });

        if (response.success) {
          const nextRecords = (response.data || [])
            .map(normalizeWorkRecord)
            .filter(
              (record) =>
                record.employeeId?._id?.toString?.() ===
                selectedRecord.employeeId._id?.toString?.()
            );

          setSelectedEmployeeCalendarRecords(nextRecords);
          setSelectedCalendarDateKey((current) => {
            if (current && current.startsWith(selectedPerformanceMonth)) {
              return current;
            }

            const recordDateKey = getWorkDateKey(selectedRecord.date);
            const firstRecordDateKey = nextRecords[0] ? getWorkDateKey(nextRecords[0].date) : "";

            return recordDateKey || firstRecordDateKey || `${selectedPerformanceMonth}-01`;
          });
        }
      } catch (error) {
        console.error("Admin employee calendar load failed:", error);
      } finally {
        setEmployeeCalendarLoading(false);
      }
    };

    loadSelectedEmployeeCalendar();
  }, [
    records,
    selectedPerformanceMonth,
    selectedRecord?.employeeId?._id,
    selectedRecord?.employeeId?.employeeId,
    selectedRecord?.date,
  ]);

  /* ------------------------------------------------------------------
     Fetch the selected employee's shift to get their weeklyOffDays
     so we can compute accurate per-day slot percentages.
  ------------------------------------------------------------------ */
  useEffect(() => {
    const empId = selectedRecord?.employeeId?.employeeId;

    setSelectedEmployeeShift(null);

    if (!empId) {
      setShiftLoading(false);
      return;
    }

    // Check cache first
    if (employeeShiftCache[empId]) {
      setSelectedEmployeeShift(employeeShiftCache[empId]);
      setShiftLoading(false);
      return;
    }

    let cancelled = false;

    const loadShift = async () => {
      setShiftLoading(true);
      try {
        const shiftData = await getShiftByEmployeeId(empId);
        if (!cancelled && shiftData) {
          setSelectedEmployeeShift(shiftData);
          // Cache the result
          setEmployeeShiftCache(prev => ({ ...prev, [empId]: shiftData }));
        }
      } catch (error) {
        console.error("Employee shift load failed:", error);
        if (!cancelled) {
          setSelectedEmployeeShift(null);
        }
      } finally {
        if (!cancelled) {
          setShiftLoading(false);
        }
      }
    };

    loadShift();

    return () => {
      cancelled = true;
    };
  }, [selectedRecord?.employeeId?.employeeId, employeeShiftCache]);

  const selectedCalendarRecord = useMemo(
    () =>
      selectedEmployeeCalendarRecords.find(
        (record) => getWorkDateKey(record.date) === selectedCalendarDateKey
      ) || null,
    [selectedCalendarDateKey, selectedEmployeeCalendarRecords]
  );

  const displayedRecord = selectedCalendarRecord || selectedRecord;

  const summary = useMemo(
    () => ({
      total: records.length,
      pending: records.filter((record) => record.status === "pending").length,
      approved: records.filter((record) => record.status === "approved").length,
      rejected: records.filter((record) => record.status === "rejected").length,
    }),
    [records]
  );

  const selectableRecords = useMemo(
    () => records.filter((record) => record.evening_time),
    [records]
  );

  const selectableEntryIds = useMemo(
    () => selectableRecords.map((record) => record._id),
    [selectableRecords]
  );
  const bulkSelectionEnabled = Boolean(percentageSettings.auto_generate_percentage);

  const allSelectableChecked =
    bulkSelectionEnabled &&
    selectableEntryIds.length > 0 &&
    selectableEntryIds.every((entryId) => selectedEntryIds.includes(entryId));

  useEffect(() => {
    if (!bulkSelectionEnabled && selectedEntryIds.length > 0) {
      setSelectedEntryIds([]);
    }
  }, [bulkSelectionEnabled, selectedEntryIds.length]);

  const handleSearch = async (event) => {
    event.preventDefault();
    await fetchRecords();
  };

  const handleClearFilters = async () => {
    const todayDate = getTodayDate();
    const clearedFilters = {
      employee_query: "",
      start_date: "",
      end_date: "",
      status: "",
      selected_date: todayDate,
    };
    setFilters(clearedFilters);
    setLoading(true);
    try {
      const response = await getAdminWorkRecords({
        employee_query: "",
        start_date: todayDate,
        end_date: todayDate,
        status: "",
      });
      if (response.success) {
        setRecords((response.data || []).map(normalizeWorkRecord));
      }
    } catch (error) {
      Swal.fire("Error", "Unable to clear filters right now.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (newDate) => {
    setFilters((current) => ({
      ...current,
      selected_date: newDate,
      start_date: "",
      end_date: "",
    }));
  };

  const handleOpenRecord = (record) => {
    setSelectedRecord(record);
    setSelectedPerformanceMonth(getMonthValueFromDate(record.date));
    setSelectedCalendarDateKey(getWorkDateKey(record.date));
    setShowAllImages(false);
  };

  const handleToggleRecordSelection = (recordId) => {
    if (!bulkSelectionEnabled) return;

    setSelectedEntryIds((current) =>
      current.includes(recordId)
        ? current.filter((id) => id !== recordId)
        : [...current, recordId]
    );
  };

  const handleToggleSelectAll = () => {
    if (!bulkSelectionEnabled) return;

    setSelectedEntryIds((current) =>
      allSelectableChecked ? current.filter((id) => !selectableEntryIds.includes(id)) : selectableEntryIds
    );
  };

  const handleQuickAction = async (id, action) => {
    setActionLoading(id);
    setActionType(action);
    
    try {
      const manualValue = percentageInputs[id];
      const normalizedManualValue =
        manualValue === "" || manualValue === undefined || manualValue === null
          ? undefined
          : Number(manualValue);
      const formData = new FormData();
      formData.append("status", action);

      if (action === "approved" && normalizedManualValue !== undefined && !Number.isNaN(normalizedManualValue)) {
        formData.append("daily_work_percentage", normalizedManualValue);
      }

      if (adminComments[id]) {
        formData.append("admin_comment", adminComments[id]);
      }

      const files = adminMedia[id] || [];
      for (let i = 0; i < files.length; i++) {
        if (files[i] && files[i].originalFile) {
          formData.append("admin_images", files[i].editedFile ?? files[i].originalFile);
        } else {
          formData.append("admin_images", files[i]);
        }
      }

      const response = await reviewWorkEntry(id, formData);
      
      if (response?.success) {
        Swal.fire("Updated", response.message, "success");
        await fetchRecords();
      }
    } catch (error) {
      Swal.fire(
        "Update failed",
        error.response?.data?.message || "Please try again.",
        "error"
      );
    } finally {
      setActionLoading(null);
      setActionType(null);
    }
  };

  const handleGeneratePercentage = async (record) => {
    setPercentageSaving(true);
    try {
      const manualValue = percentageInputs[record._id];
      const normalizedManualValue =
        manualValue === "" || manualValue === undefined || manualValue === null
          ? undefined
          : Number(manualValue);
      const response = await generateWorkEntryPercentage(
        record._id,
        Number.isNaN(normalizedManualValue) ? undefined : normalizedManualValue
      );
      if (response.success) {
        Swal.fire("Updated", response.message, "success");
        await fetchRecords();
      }
    } catch (error) {
      Swal.fire(
        "Generation failed",
        error.response?.data?.message || "Please try again.",
        "error"
      );
    } finally {
      setPercentageSaving(false);
    }
  };

  const handleBulkApply = async () => {
    if (!bulkSelectionEnabled) {
      Swal.fire(
        "Auto generate is off",
        "Turn on Auto Generate to select employees and apply one percentage to multiple employees.",
        "warning"
      );
      return;
    }

    if (!selectedEntryIds.length) {
      Swal.fire("Select employees", "Choose at least one employee record first.", "warning");
      return;
    }

    const normalizedPercentage = Number(percentageSettings.default_daily_target_percentage);
    if (
      Number.isNaN(normalizedPercentage) ||
      normalizedPercentage < 0 ||
      normalizedPercentage > 100
    ) {
      Swal.fire(
        "Invalid percentage",
        "Enter a value between 0 and 100 before applying.",
        "warning"
      );
      return;
    }

    setBulkApplying(true);
    try {
      const response = await bulkGenerateWorkEntryPercentage(
        selectedEntryIds,
        normalizedPercentage
      );

      if (response.success) {
        const skippedCount = response.skipped?.length || 0;
        Swal.fire(
          "Applied",
          skippedCount
            ? `${response.message} Skipped ${skippedCount} record(s) without evening update.`
            : response.message,
          "success"
        );
        await fetchRecords();
      }
    } catch (error) {
      Swal.fire(
        "Bulk apply failed",
        error.response?.data?.message || "Please try again.",
        "error"
      );
    } finally {
      setBulkApplying(false);
    }
  };

  const handleDelete = async (record) => {
    const result = await Swal.fire({
      title: "Delete this work record?",
      text: "This will remove the stored work content for this day.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Delete",
    });

    if (!result.isConfirmed) return;

    setDeleting(true);
    try {
      const response = await deleteWorkEntry(record._id);
      if (response.success) {
        Swal.fire("Deleted", response.message, "success");
        setSelectedRecord((current) => (current?._id === record._id ? null : current));
        await fetchRecords();
      }
    } catch (error) {
      Swal.fire(
        "Delete failed",
        error.response?.data?.message || "Please try again.",
        "error"
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff,_#f8fafc_40%,_#f8fafc)] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-white via-slate-50 to-gray-50 p-6 shadow-lg border border-gray-100 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-md">
                  <FaClipboardCheck className="h-4 w-4 text-white" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                  Admin Review Panel
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
                Performance Management
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <p className="max-w-2xl text-sm text-gray-500 leading-relaxed md:text-base">
                  Manage Employee Work Submissions Efficiently
                </p>
                <button 
                  onClick={() => setShowAssignTaskModal(true)}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow hover:shadow-lg transition-all"
                >
                  Assign Task
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {/* Total Card */}
              <div className="group rounded-xl bg-white p-3 text-center shadow-sm border border-gray-100 transition-all hover:shadow-md hover:border-indigo-200">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total</p>
                </div>
                <p className="text-2xl font-black text-gray-800 group-hover:text-indigo-600 transition-colors">
                  {summary.total}
                </p>
              </div>

              {/* Pending Card */}
              <div className="group rounded-xl bg-white p-3 text-center shadow-sm border border-gray-100 transition-all hover:shadow-md hover:border-amber-200">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <svg className="h-3.5 w-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Pending</p>
                </div>
                <p className="text-2xl font-black text-amber-600 group-hover:text-amber-700 transition-colors">
                  {summary.pending}
                </p>
              </div>

              {/* Approved Card */}
              <div className="group rounded-xl bg-white p-3 text-center shadow-sm border border-gray-100 transition-all hover:shadow-md hover:border-emerald-200">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Approved</p>
                </div>
                <p className="text-2xl font-black text-emerald-600 group-hover:text-emerald-700 transition-colors">
                  {summary.approved}
                </p>
              </div>

              {/* Rejected Card */}
              <div className="group rounded-xl bg-white p-3 text-center shadow-sm border border-gray-100 transition-all hover:shadow-md hover:border-rose-200">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <svg className="h-3.5 w-3.5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Rejected</p>
                </div>
                <p className="text-2xl font-black text-rose-600 group-hover:text-rose-700 transition-colors">
                  {summary.rejected}
                </p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSearch} className="rounded-2xl bg-white p-5 shadow-md border border-gray-100">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
              <FaFilter className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">Filter Reports</h2>
              <p className="text-xs text-gray-400">Search by employee name, ID, or date</p>
            </div>
          </div>

          {/* Filter Fields */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Employee Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <FaIdBadge className="h-3 w-3" />
                Employee
              </label>
              <input
                type="text"
                placeholder="Name or ID..."
                value={filters.employee_query}
                onChange={(event) => setFilters({...filters, employee_query: event.target.value})}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Date Picker */}
            <div className="w-[180px]">
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <FaCalendar className="h-3 w-3" />
                Date
              </label>
              <input
                type="date"
                value={filters.selected_date}
                onChange={(event) => handleDateChange(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Status Filter */}
            <div className="w-[140px]">
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                Status
              </label>
              <select
                value={filters.status}
                onChange={(event) => setFilters({...filters, status: event.target.value})}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Clear Button */}
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 active:scale-95"
            >
              <FaTimes className="h-3 w-3" />
              Clear
            </button>

            {/* Search Button */}
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-md active:scale-95"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </button>
          </div>

          {/* Active Filter Indicator */}
          {filters.selected_date && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 border border-blue-100">
              <svg className="h-3.5 w-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-blue-700">
                Showing data for: <span className="font-semibold">{getFormattedDate(filters.selected_date)}</span>
              </p>
              <button
                type="button"
                onClick={() => handleDateChange("")}
                className="ml-auto text-blue-500 hover:text-blue-700"
              >
                <FaTimes className="h-3 w-3" />
              </button>
            </div>
          )}
        </form>

        <div className="rounded-2xl bg-white p-5 shadow-md border border-gray-100">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-sm">
              <FaPercentage className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">Auto Percentage Control</h2>
              <p className="text-xs text-gray-400">Manage default targets and bulk apply scores</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-end gap-4">
            {/* Auto Generate Toggle */}
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Auto Generate
              </label>
              <button
                type="button"
                onClick={() =>
                  setPercentageSettings((current) => ({
                    ...current,
                    auto_generate_percentage: !current.auto_generate_percentage,
                  }))
                }
                className={`w-full rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                  percentageSettings.auto_generate_percentage
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                    : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                }`}
                disabled={settingsLoading}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className={`h-1.5 w-1.5 rounded-full ${percentageSettings.auto_generate_percentage ? "bg-emerald-500" : "bg-gray-400"}`} />
                  {percentageSettings.auto_generate_percentage ? "Auto Generate ON" : "Manual Mode OFF"}
                </div>
              </button>
            </div>

            {/* Default Target Percentage */}
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Default Target
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={percentageSettings.default_daily_target_percentage}
                  onChange={(event) =>
                    setPercentageSettings((current) => ({
                      ...current,
                      default_daily_target_percentage: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 pr-8 text-sm text-gray-700 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">%</span>
              </div>
            </div>

            {/* Bulk Apply Button */}
            <button
              type="button"
              onClick={handleBulkApply}
              disabled={!bulkSelectionEnabled || !selectedEntryIds.length || bulkApplying}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-emerald-600 hover:to-teal-600 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {bulkApplying ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Applying...
                </>
              ) : (
                <>
                  <FaCheck className="h-3.5 w-3.5" />
                  Apply to Selected ({selectedEntryIds.length})
                </>
              )}
            </button>
          </div>

          {/* Info Note */}
          {!bulkSelectionEnabled && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 border border-amber-100">
              <svg className="h-3.5 w-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-700">
                Auto Generate is <span className="font-semibold">OFF</span>. Turn it on to enable bulk selection and auto-apply scores.
              </p>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-[28px] bg-white shadow-xl shadow-slate-200/60">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center text-slate-400">
              <FaUserTie size={44} className="mb-4 opacity-30" />
              <p className="text-lg font-semibold text-slate-500">No work reports found.</p>
              <p className="mt-2 max-w-md text-sm">
                Try another employee name or ID, or adjust the filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Bulk Selection
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    Select all or only the employees you want before clicking Apply.
                  </p>
                </div>
                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={allSelectableChecked}
                    onChange={handleToggleSelectAll}
                    disabled={!bulkSelectionEnabled}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  Select All Eligible
                </label>
              </div>

              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-5 py-4">Select</th>
                    <th className="px-5 py-4">Employee</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Today Score</th>
                    <th className="px-5 py-4">Monthly %</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((record) => {
                    const isSelectable = Boolean(record.evening_time) && bulkSelectionEnabled;
                    const isChecked = selectedEntryIds.includes(record._id);
                    
                    const monthlyPercentage = Number(record.monthly_work_percentage || 0);
                    const todayScoreValue = Number(record.daily_percentage_display || 0);

                    return (
                      <tr key={record._id} className="hover:bg-slate-50/80">
                        <td className="px-5 py-4">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!isSelectable}
                            title={
                              !bulkSelectionEnabled
                                ? "Turn on Auto Generate to enable bulk selection"
                                : isSelectable
                                ? "Select this employee record"
                                : "Evening update is required before bulk apply"
                            }
                            onChange={() => handleToggleRecordSelection(record._id)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-900">
                            {record.employeeId?.name || "Employee"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {record.employeeId?.employeeId || "-"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {record.employeeId?.email || ""}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                          {new Date(record.date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${getStatusClasses(
                              record.status
                            )}`}
                          >
                            {record.status}
                          </span>
                          <p className="mt-2 text-xs font-semibold text-slate-500">
                            {record.evening_time
                              ? `Evening: ${record.evening_time}`
                              : "Morning only"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          {record.status === "approved" ? (
                            <div className="text-center">
                              <p className="text-lg font-black text-emerald-600">
                                +{todayScoreValue}%
                              </p>
                              <p className="text-[10px] text-gray-400">today score</p>
                            </div>
                          ) : (
                            <div className="text-center">
                              <p className="text-sm font-medium text-gray-400">No actions</p>
                              <p className="text-[10px] text-gray-300">done yet</p>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-lg font-black text-cyan-600">
                          {monthlyPercentage}%
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => handleOpenRecord(record)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:shadow-lg"
                          >
                            <FaEye />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedRecord ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="relative max-h-[90vh] w-full max-w-7xl overflow-hidden rounded-3xl bg-white shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            {/* Top Action Bar - Fixed at top */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-6 py-4 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg">
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Work Details</h3>
                  <p className="text-xs text-gray-500">Review and manage employee submission</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRecord(null);
                  setSelectedEmployeePerformance(null);
                  setSelectedEmployeeShift(null);
                }}
                className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-gray-800 hover:shadow-md active:scale-95"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="max-h-[calc(90vh-70px)] overflow-y-auto bg-gradient-to-b from-gray-50 to-white px-6 py-6">
              {/* Employee Header Card */}
              <div className="mb-6 rounded-2xl bg-gradient-to-r from-white to-gray-50 p-5 shadow-md border border-gray-100">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        ID: {selectedRecord.employeeId?.employeeId || "-"}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(selectedRecord.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedRecord.employeeId?.name || "Employee"}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">{selectedRecord.employeeId?.email || ""}</p>
                  </div>
                  <div className={`rounded-full px-4 py-1.5 text-sm font-semibold shadow-sm ${
                    selectedRecord.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    selectedRecord.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {selectedRecord.status === 'approved' ? '✓ Approved' :
                     selectedRecord.status === 'rejected' ? '✗ Rejected' :
                     '⏳ Pending Review'}
                  </div>
                </div>
              </div>

              {/* Main Layout - 12 Columns */}
              <div className="grid gap-6 lg:grid-cols-12 items-start">
                {/* Left Column: Updates & Performance Overview */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                  {/* Updates Grid */}
                  <div className="grid gap-6 sm:grid-cols-2">
                    {/* Morning Update Card */}
                    <div className="group rounded-2xl bg-white p-5 shadow-md border border-gray-100 transition-all hover:shadow-lg hover:border-amber-200 flex flex-col">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 shadow-md">
                      <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">Morning Update</span>
                      <p className="text-[10px] text-gray-400">Plan for the day</p>
                    </div>
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900 line-clamp-2">{selectedRecord.morning_title}</h3>
                  <p className="mb-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-600 line-clamp-4">
                    {selectedRecord.morning_description}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {selectedRecord.morning_time || "-"}
                  </div>
                </div>

                {/* Evening Update Card */}
                <div className="group rounded-2xl bg-white p-5 shadow-md border border-gray-100 transition-all hover:shadow-lg hover:border-indigo-200 flex flex-col">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-600 shadow-md">
                      <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Evening Update</span>
                      <p className="text-[10px] text-gray-400">Day completion report</p>
                    </div>
                  </div>
                  <p
                    className={`mb-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-600 ${
                      expanded ? "" : "line-clamp-4"
                    }`}
                  >
                    {selectedRecord.evening_description || "Evening update has not been submitted yet."}
                  </p>

                  {(selectedRecord.evening_description || "").length > 120 && (
                    <button
                      onClick={() => setExpanded(!expanded)}
                      className="mb-3 text-xs font-medium text-indigo-600 hover:underline"
                    >
                      {expanded ? "Show Less" : "Read More"}
                    </button>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {selectedRecord.evening_time || "Not submitted"}
                  </div>

                  {/* Images Section */}
                  <div className="mt-4">
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Attachments ({selectedRecord.images?.length || 0})
                    </p>
                    {selectedRecord.images?.length ? (
                      <div className="grid grid-cols-3 gap-2">
                        {selectedRecord.images.slice(0, showAllImages ? undefined : 3).map((image, idx) => (
                          <div
                            key={image._id}
                            className="group relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50 transition-all hover:shadow-md"
                          >
                            <img
                              src={image.image_url}
                              alt={`Work evidence ${idx + 1}`}
                              className="h-20 w-full object-cover transition-transform group-hover:scale-105 cursor-pointer"
                              onClick={() => setPreviewImage(image.image_url)}
                            />
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/20">
                              <svg className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                            </div>
                            <div className="absolute top-1 right-1 flex gap-1 bg-white/80 p-1 rounded backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadImage(image.image_url, `work-evidence-${idx + 1}.jpg`);
                                }}
                                className="text-indigo-600 hover:text-indigo-800 p-1"
                                title="Download image"
                              >
                                <FaDownload size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {selectedRecord.images.length > 3 && !showAllImages && (
                          <div 
                            className="flex h-20 items-center justify-center rounded-xl bg-gray-100 text-xs font-semibold text-gray-500 cursor-pointer hover:bg-gray-200 transition-colors"
                            onClick={() => setShowAllImages(true)}
                          >
                            +{selectedRecord.images.length - 3} more
                          </div>
                        )}
                        {selectedRecord.images.length > 3 && showAllImages && (
                          <div 
                            className="col-span-3 flex h-10 items-center justify-center rounded-xl bg-gray-100 text-xs font-semibold text-gray-500 cursor-pointer hover:bg-gray-200 transition-colors mt-2"
                            onClick={() => setShowAllImages(false)}
                          >
                            Show Less
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center text-sm text-gray-400">
                        No attachments
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Performance Overview Card */}
              <div className="rounded-2xl bg-white p-5 shadow-md border border-gray-100">
                <h3 className="mb-4 text-sm font-bold text-gray-800 flex items-center gap-2">
                  <svg className="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  Performance Overview
                </h3>
                {/* Month Selector */}
                  <div className="mb-4">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Review Month
                      </span>
                      <select
                        value={selectedPerformanceMonth}
                        onChange={(event) => setSelectedPerformanceMonth(event.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-700 outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      >
                        {monthOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Stats Grid */}
                  <div className="mb-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-sky-50 to-sky-100 p-3 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Fixed Slot/Day</p>
                      <p className="mt-1 text-2xl font-bold text-sky-700">
                        {(performanceLoading || shiftLoading)
                          ? "..."
                          : computedWorkingDays
                            ? `${perDaySlotPercentage}%`
                            : "0%"}
                      </p>
                      <p className="mt-0.5 text-[9px] font-medium text-sky-500">
                        100% ÷ {(shiftLoading || performanceLoading) ? "..." : computedWorkingDays} working days
                        {selectedEmployeeShift && !shiftLoading && (
                          <span className="block text-sky-400">
                            (off: {(selectedEmployeeShift.weeklyOffDays || [0])
                              .map((d) => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d])
                              .join(", ")})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 p-3 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Monthly %</p>
                      <p className="mt-1 text-2xl font-bold text-indigo-700">
                        {performanceLoading ? "..." : `${selectedEmployeePerformance?.monthlyWorkPercentage || selectedRecord.monthly_work_percentage || 0}%`}
                      </p>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-cyan-50 to-cyan-100 p-3 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">Employee %</p>
                      <p className="mt-1 text-2xl font-bold text-cyan-700">
                        {selectedRecord.employee_submitted_percentage ?? "-"}%
                      </p>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 p-3 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Admin %</p>
                      <p className="mt-1 text-2xl font-bold text-violet-700">
                        {selectedRecord.daily_work_percentage || 0}%
                      </p>
                      <p className="mt-0.5 text-[9px] font-medium text-violet-500">{selectedRecord.percentage_mode || "none"}</p>
                    </div>
                  </div>

              </div>
            </div>

            {/* Right Column: Admin Actions */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-white p-5 shadow-md border border-gray-100 sticky top-6">
                <h3 className="mb-4 text-sm font-bold text-gray-800 flex items-center gap-2">
                  <svg className="h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Admin Review
                </h3>
                {selectedRecord.evening_time ? (
                  <div className="space-y-4">
                    {/* Percentage Input with Save Button */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                          Set Approval Percentage
                        </label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={
                                percentageInputs[selectedRecord._id] ??
                                getSuggestedPercentage(selectedRecord)
                              }
                              onChange={(event) =>
                                setPercentageInputs((current) => ({
                                  ...current,
                                  [selectedRecord._id]: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 pr-10 text-sm font-medium text-gray-700 outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleGeneratePercentage(selectedRecord)}
                            disabled={percentageSaving}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-indigo-700 hover:to-indigo-800 hover:shadow-md active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {percentageSaving ? (
                              <>
                                <svg className="h-3.5 w-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Saving...
                              </>
                            ) : (
                              <>
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Save
                              </>
                            )}
                          </button>
                        </div>
                        <p className="mt-1 text-[11px] text-gray-500">
                          Suggested: <span className="font-semibold text-indigo-600">{getSuggestedPercentage(selectedRecord)}%</span>
                          {computedWorkingDays > 0 && !shiftLoading && (
                            <span className="ml-2 text-sky-500">
                              → contributes <span className="font-semibold">{((getSuggestedPercentage(selectedRecord) / 100) * (100 / computedWorkingDays)).toFixed(2)}%</span> to monthly
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Admin Comments & Media */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                          Admin Comment
                        </label>
                        <textarea
                          value={adminComments[selectedRecord._id] ?? (selectedRecord.admin_comment || "")}
                          onChange={(e) => setAdminComments((prev) => ({ ...prev, [selectedRecord._id]: e.target.value }))}
                          placeholder="Leave a comment about this work report..."
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 min-h-[80px]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                          Upload Media (Images)
                        </label>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => {
                            const newFiles = Array.from(e.target.files).map(f => ({
                              id: crypto.randomUUID(),
                              originalFile: f,
                              editedFile: null,
                              previewUrl: URL.createObjectURL(f)
                            }));
                            setAdminMedia((prev) => ({ ...prev, [selectedRecord._id]: newFiles }));
                          }}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                        />
                        {adminMedia[selectedRecord._id]?.length > 0 && (
                          <div className="mt-3">
                            <p className="mb-2 text-xs font-semibold text-gray-500">Selected Images (To Upload):</p>
                            <div className="grid grid-cols-3 gap-2">
                              {adminMedia[selectedRecord._id].map((item) => (
                                <div key={item.id} className="group relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50 transition-all hover:shadow-md h-20">
                                  <img
                                    src={item.previewUrl}
                                    alt="Upload preview"
                                    className="h-full w-full object-cover transition-transform group-hover:scale-105 cursor-pointer"
                                    onClick={() => setPreviewImage(item.previewUrl)}
                                  />
                                  <div className="absolute top-1 right-1 flex gap-1 bg-white/80 p-1 rounded backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      type="button" 
                                      onClick={() => setEditingImage(item)}
                                      className="text-indigo-600 hover:text-indigo-800 p-1"
                                      title="Edit image"
                                    >
                                      <FaEdit size={12} />
                                    </button>
                                    {item.editedFile && (
                                      <button 
                                        type="button" 
                                        onClick={() => {
                                          setAdminMedia(prev => ({
                                            ...prev,
                                            [selectedRecord._id]: prev[selectedRecord._id].map(f => 
                                              f.id === item.id ? { ...f, editedFile: null, previewUrl: URL.createObjectURL(f.originalFile) } : f
                                            )
                                          }));
                                        }}
                                        className="text-amber-600 hover:text-amber-800 p-1"
                                        title="Revert to original"
                                      >
                                        <FaUndo size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedRecord.admin_images?.length > 0 && (
                          <div className="mt-3">
                            <p className="mb-2 text-xs font-semibold text-gray-500">Previously Uploaded Admin Images:</p>
                            <div className="grid grid-cols-3 gap-2">
                              {selectedRecord.admin_images.map((img, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setPreviewImage(img.image_url)}
                                  className="group relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50 transition-all hover:shadow-md"
                                >
                                  <img
                                    src={img.image_url}
                                    alt={`Admin evidence ${idx + 1}`}
                                    className="h-20 w-full object-cover transition-transform group-hover:scale-105"
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Quick Actions */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                          Quick Actions
                        </label>
                        <div className="flex gap-2">
                          {/* Approve Button */}
                          <button
                            type="button"
                            onClick={() => handleQuickAction(selectedRecord._id, "approved")}
                            disabled={actionLoading === selectedRecord._id}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-emerald-600 hover:to-emerald-700 hover:shadow-md active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {actionLoading === selectedRecord._id && actionType === 'approved' ? (
                              <>
                                <svg className="h-3.5 w-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                              </>
                            ) : (
                              <>
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Approve
                              </>
                            )}
                          </button>

                          {/* Reject Button */}
                          <button
                            type="button"
                            onClick={() => handleQuickAction(selectedRecord._id, "rejected")}
                            disabled={actionLoading === selectedRecord._id}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-rose-600 hover:to-rose-700 hover:shadow-md active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {actionLoading === selectedRecord._id && actionType === 'rejected' ? (
                              <>
                                <svg className="h-3.5 w-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                              </>
                            ) : (
                              <>
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Reject
                              </>
                            )}
                          </button>

                          {/* Pending Button */}
                          <button
                            type="button"
                            onClick={() => handleQuickAction(selectedRecord._id, "pending")}
                            disabled={actionLoading === selectedRecord._id}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-amber-600 hover:to-amber-700 hover:shadow-md active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {actionLoading === selectedRecord._id && actionType === 'pending' ? (
                              <>
                                <svg className="h-3.5 w-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                              </>
                            ) : (
                              <>
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Pending
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDelete(selectedRecord)}
                        disabled={deleting}
                        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 transition-all hover:bg-red-50 hover:border-red-200 hover:text-red-600 hover:shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {deleting ? (
                          <>
                            <svg className="h-3.5 w-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Deleting...
                          </>
                        ) : (
                          <>
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete Record
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-sm font-semibold text-amber-700">Awaiting Evening Update</p>
                      </div>
                      <p className="text-xs text-amber-600">
                        Admin actions available after employee submits evening update
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Calendar and Day Details Section */}
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl bg-white p-4 shadow-md border border-gray-100">
                  <WorkRecordsCalendar
                    monthValue={selectedPerformanceMonth}
                    records={selectedEmployeeCalendarRecords}
                    selectedDateKey={selectedCalendarDateKey}
                    onSelectDate={setSelectedCalendarDateKey}
                    loading={employeeCalendarLoading}
                    title="Work Performance Calendar"
                    description="Click any date to view work details"
                  />
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-md border border-gray-100">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Selected Day Details</h3>
                      <p className="text-xs text-gray-500">Review specific date information</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                      {getDateLabelFromKey(selectedCalendarDateKey)}
                    </span>
                  </div>

                  {displayedRecord ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Morning Focus</p>
                          <h4 className="mt-1 text-base font-bold text-gray-900">{displayedRecord.morning_title}</h4>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(displayedRecord.status)}`}>
                          {displayedRecord.status}
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-white p-3 border border-amber-100">
                          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            Morning
                          </p>
                          <p className="text-sm text-gray-700 line-clamp-3">{displayedRecord.morning_description}</p>
                          <p className="mt-2 text-xs text-gray-400">⏰ {displayedRecord.morning_time || "-"}</p>
                        </div>
                        <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-white p-3 border border-indigo-100">
                          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                            Evening
                          </p>
                          <p className="text-sm text-gray-700 line-clamp-3">{displayedRecord.evening_description || "Not submitted"}</p>
                          <p className="mt-2 text-xs text-gray-400">⏰ {displayedRecord.evening_time || "-"}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-cyan-50 p-2 text-center">
                          <p className="text-[9px] font-semibold uppercase text-cyan-600">Employee</p>
                          <p className="text-base font-bold text-cyan-700">{displayedRecord.employee_submitted_percentage ?? "-"}%</p>
                        </div>
                        <div className="rounded-xl bg-indigo-50 p-2 text-center">
                          <p className="text-[9px] font-semibold uppercase text-indigo-600">Admin</p>
                          <p className="text-base font-bold text-indigo-700">{displayedRecord.daily_work_percentage || 0}%</p>
                        </div>
                        {displayedRecord.status === "approved" ? (
                          <div className="rounded-xl bg-emerald-50 p-2 text-center">
                            <p className="text-[9px] font-semibold uppercase text-emerald-600">Selected Day Score</p>
                            <p className="text-base font-bold text-emerald-700">
                              +{displayedRecord.daily_percentage_display || 0}%
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl bg-gray-50 p-2 text-center">
                            <p className="text-[9px] font-semibold uppercase text-gray-500">Status</p>
                            <p className="text-xs font-medium text-gray-500 mt-1">No actions done</p>
                          </div>
                        )}
                      </div>

                      {displayedRecord.images?.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold text-gray-500">Attachments</p>
                          <div className="grid grid-cols-4 gap-2">
                            {displayedRecord.images.slice(0, 4).map((image) => (
                              <button
                                key={image._id}
                                type="button"
                                onClick={() => setPreviewImage(image.image_url)}
                                className="overflow-hidden rounded-lg border border-gray-100 transition-all hover:shadow-md"
                              >
                                <img src={image.image_url} alt="Work evidence" className="h-14 w-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
                      <svg className="h-10 w-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="font-semibold text-gray-600">No record on this date</p>
                      <p className="mt-1 text-xs text-gray-400">Select another date from calendar</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {previewImage ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-[28px] bg-white p-4 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewImage("")}
              className="absolute right-4 top-4 rounded-full bg-slate-900 px-3 py-2 text-xs font-bold text-white"
            >
              Close
            </button>
            <img
              src={previewImage}
              alt="Work evidence preview"
              className="max-h-[82vh] rounded-[22px] object-contain"
            />
          </div>
        </div>
      ) : null}
      {editingImage && (
        <ImageEditorModal
          imageSrc={editingImage.previewUrl}
          fileName={editingImage.originalFile.name}
          onSave={(editedFile, editedPreviewUrl) => {
            setAdminMedia(prev => ({
              ...prev,
              [selectedRecord._id]: prev[selectedRecord._id].map(f => 
                f.id === editingImage.id ? { ...f, editedFile, previewUrl: editedPreviewUrl } : f
              )
            }));
            setEditingImage(null);
          }}
          onClose={() => setEditingImage(null)}
        />
      )}
      {showAssignTaskModal && (
        <AdminAssignTaskModal onClose={() => setShowAssignTaskModal(false)} />
      )}
    </div>
  );
};

export default AdminWorkReports;

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Format date for display
const getFormattedDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};
