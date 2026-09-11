import React, { useState, useEffect, useMemo, useCallback } from "react";
import api, { getEmployees, getIdleTimeForEmployeeByDate, getAttendanceByDateRange } from ".././api";
import {
    FaUserFriends,
    FaRegClock,
    FaCircle,
    FaSyncAlt,
    FaDesktop,
    FaClock,
    FaChartPie,
    FaFilePdf,
    FaTimes,
    FaSearch,
    FaCamera,
    FaExternalLinkAlt,
    FaCalendarAlt,
    FaTrash,
    FaFilter,
    FaLayerGroup,
    FaBolt,
    FaChevronRight,
    FaCode,
    FaGlobe,
    FaEye,
    FaShieldAlt
} from "react-icons/fa";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement } from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement);

const AdminLiveTracking = () => {
    const [rawLiveData, setLiveData] = useState([]);
    const [employeesMap, setEmployeesMap] = useState({});
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | WORKING | IDLE | OFFLINE

    // Filter to only show employees belonging to this admin
    const liveData = useMemo(() => {
        return rawLiveData.filter(record => !!employeesMap[record.employeeId]);
    }, [rawLiveData, employeesMap]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [refreshCountdown, setRefreshCountdown] = useState(10);

    // Modal State
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState(null);
    const [yesterdayIdle, setYesterdayIdle] = useState(0);
    const [reportLoading, setReportLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('report'); // 'report' | 'screenshots' | 'tablogs'

    // Weekly Report State
    const [weeklyOffset, setWeeklyOffset] = useState(0);
    const [weeklyChartData, setWeeklyChartData] = useState(null);
    const [weeklyDataLoading, setWeeklyDataLoading] = useState(false);

    // Screenshots State
    const [screenshots, setScreenshots] = useState([]);
    const [screenshotsLoading, setScreenshotsLoading] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState(null);

    // Tracker Settings
    const [screenshotInterval, setScreenshotInterval] = useState(60);
    const [savingSettings, setSavingSettings] = useState(false);

    useEffect(() => {
        // Fetch tracker settings
        const fetchSettings = async () => {
            try {
                const res = await api.get('/api/idletime/settings/tracker');
                if (res.data && res.data.screenshotIntervalMinutes) {
                    setScreenshotInterval(res.data.screenshotIntervalMinutes);
                }
            } catch (err) {
                console.error("Error fetching tracker settings:", err);
            }
        };
        fetchSettings();
    }, []);

    const handleSaveSettings = async (newInterval) => {
        try {
            setSavingSettings(true);
            const val = parseInt(newInterval, 10);
            if (val > 0) {
                await api.put('/api/idletime/settings/tracker', { screenshotIntervalMinutes: val });
                setScreenshotInterval(val);
                alert(`Tracker screenshot interval updated to ${val} minutes. It will take effect the next time employees' trackers sync.`);
            }
        } catch (err) {
            console.error("Error saving settings", err);
            alert("Failed to save tracker settings.");
        } finally {
            setSavingSettings(false);
        }
    };

    useEffect(() => {
        // Fetch all employees to map IDs to Names once when component loads
        const loadEmployees = async () => {
            try {
                const employees = await getEmployees();
                const map = {};
                employees.forEach(emp => {
                    const empId = emp.employeeId || emp.empId || emp._id;
                    if (empId) map[empId] = emp.name;
                });
                setEmployeesMap(map);
            } catch (err) {
                console.error("Error loading employees mapping:", err);
            }
        };
        loadEmployees();
    }, []);

    const fetchLiveData = useCallback(async (isBackground = false, start = fromDate, end = toDate) => {
        if (!isBackground) setLoading(true);
        try {
            const response = await api.get(`/api/idletime/live-status?startDate=${start}&endDate=${end}&t=${new Date().getTime()}`);
            const data = response.data || [];
            
            setLiveData(data);
            setError(null);
            setLastUpdated(new Date());
            setRefreshCountdown(10);
        } catch (err) {
            console.error("Error fetching live tracking data:", err);
            if (!isBackground) setError("Failed to fetch live tracking data");
        } finally {
            if (!isBackground) setLoading(false);
        }
    }, [fromDate, toDate]);

    // Main fetch interval (10 seconds)
    useEffect(() => {
        fetchLiveData(false, fromDate, toDate);
        const interval = setInterval(() => {
            fetchLiveData(true, fromDate, toDate);
        }, 10000);
        return () => clearInterval(interval);
    }, [fromDate, toDate, fetchLiveData]);

    // Countdown visual timer interval (1 second)
    useEffect(() => {
        const timer = setInterval(() => {
            setRefreshCountdown((prev) => (prev <= 1 ? 10 : prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const getStatusInfo = (record) => {
        const lastPing = new Date(record.lastPing);
        const now = new Date();
        const minutesSincePing = (now - lastPing) / (1000 * 60);

        if (minutesSincePing > 3 || record.currentStatus === "OFFLINE") {
            return {
                text: "Offline",
                color: "text-slate-600",
                bg: "bg-slate-100",
                border: "border-slate-300",
                glow: "bg-slate-400",
                badgeBg: "bg-slate-100/80 text-slate-600 border-slate-200"
            };
        }

        if (record.currentStatus === "IDLE") {
            return {
                text: "Idle",
                color: "text-amber-700",
                bg: "bg-amber-50",
                border: "border-amber-300",
                glow: "bg-amber-500",
                badgeBg: "bg-amber-50/90 text-amber-700 border-amber-200 shadow-[0_0_12px_-2px_rgba(245,158,11,0.25)]"
            };
        }

        return {
            text: "Working",
            color: "text-emerald-700",
            bg: "bg-emerald-50",
            border: "border-emerald-300",
            glow: "bg-emerald-500",
            badgeBg: "bg-emerald-50/90 text-emerald-700 border-emerald-200 shadow-[0_0_12px_-2px_rgba(16,185,129,0.25)]"
        };
    };

    const getAvatarGradient = (name = "") => {
        const colors = [
            "from-blue-600 to-indigo-600",
            "from-indigo-600 to-purple-600",
            "from-violet-600 to-pink-600",
            "from-emerald-600 to-teal-600",
            "from-amber-600 to-orange-600",
            "from-cyan-600 to-blue-600",
            "from-rose-600 to-red-600"
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    };

    const getInitials = (name = "Unknown") => {
        const parts = name.trim().split(" ");
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    const formatTime = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (totalSeconds) => {
        if (!totalSeconds && totalSeconds !== 0) return "0h 0m 0s";
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);
        return `${h}h ${m}m ${s}s`;
    };

    const getStatusSummaryCount = (status) => {
        return liveData.filter(record => {
            const info = getStatusInfo(record);
            return info.text.toUpperCase() === status.toUpperCase();
        }).length;
    };

    // Filtered data based on search and status
    const filteredLiveData = useMemo(() => {
        return liveData.filter(record => {
            const empName = (employeesMap[record.employeeId] || "").toLowerCase();
            const empId = String(record.employeeId || "").toLowerCase();
            const activeWin = String(record.activeWindow || "").toLowerCase();
            const matchesSearch = !searchTerm || 
                empName.includes(searchTerm.toLowerCase()) || 
                empId.includes(searchTerm.toLowerCase()) || 
                activeWin.includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            if (statusFilter === "ALL") return true;
            const statusInfo = getStatusInfo(record);
            return statusInfo.text.toUpperCase() === statusFilter.toUpperCase();
        });
    }, [liveData, employeesMap, searchTerm, statusFilter]);

    const [currentTime, setCurrentTime] = useState(new Date());

    // Live global clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                if (lightboxUrl) {
                    setLightboxUrl(null);
                } else if (selectedEmployee) {
                    closeReportModal();
                }
            }
        };
        if (selectedEmployee || lightboxUrl) {
            window.addEventListener("keydown", handleKeyDown);
        }
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedEmployee, lightboxUrl]);

    const calculateReportStats = (record, idleData, attData) => {
        const dateStr = String(record.date || "").trim();
        const employeeName = employeesMap[String(record.employeeId).trim()] || "Unknown Employee";

        // Stored Idle Time
        const rawTimeline = record.idleTimeline || [];
        const idleTimeline = rawTimeline.map(interval => {
            const start = new Date(interval.startTime || interval.idleStart);
            const end = new Date(interval.endTime || interval.idleEnd);
            const diffSeconds = (end - start) / 1000;
            return {
                idleStart: start,
                idleEnd: end,
                idleDurationSeconds: diffSeconds
            };
        }).sort((a, b) => a.idleStart - b.idleStart);
        const storedIdleSeconds = idleTimeline.reduce((total, span) => total + (span.idleDurationSeconds || 0), 0);

        let totalIdleSeconds = 0;
        let workedSeconds = 0;
        let punchInTime = "N/A";
        let activeIdleExtra = 0;

        if (attData && attData.punchIn) {
            punchInTime = new Date(attData.punchIn).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }

        if (record.trackedWorkSeconds !== undefined && record.trackedIdleSeconds !== undefined) {
            workedSeconds = record.trackedWorkSeconds;
            totalIdleSeconds = record.trackedIdleSeconds;

            if (record.lastPing && record.currentStatus !== "OFFLINE") {
                const lastPingDate = new Date(record.lastPing);
                if (currentTime > lastPingDate) {
                    const elapsedSincePing = (currentTime - lastPingDate) / 1000;
                    if (elapsedSincePing < 30) {
                        if (record.currentStatus === "WORKING") {
                            workedSeconds += elapsedSincePing;
                        } else if (record.currentStatus === "IDLE") {
                            totalIdleSeconds += elapsedSincePing;
                        }
                    }
                }
            }
        } else {
            workedSeconds = 0;
            totalIdleSeconds = storedIdleSeconds;
        }

        return {
            idleSeconds: totalIdleSeconds,
            workedSeconds: workedSeconds,
            totalElapsedSeconds: (workedSeconds + totalIdleSeconds),
            idleTimeline: idleTimeline,
            punchIn: punchInTime,
            activeIdleExtra: activeIdleExtra,
            storedIdleSeconds: storedIdleSeconds,
            tabLogs: record.tabLogs || []
        };
    };

    const [rawReportData, setRawReportData] = useState({ idle: null, attendance: null });

    const fetchReportData = async (record, targetDateStr) => {
        setReportLoading(true);
        const empId = String(record.employeeId || "").trim();
        const employeeName = employeesMap[empId] || record.name || "Unknown Employee";

        try {
            const target = new Date(targetDateStr);
            const yesterday = new Date(target);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            const [idleRes, yesterdayIdleRes, attRes] = await Promise.all([
                getIdleTimeForEmployeeByDate(empId, targetDateStr),
                getIdleTimeForEmployeeByDate(empId, yesterdayStr),
                getAttendanceByDateRange(targetDateStr, targetDateStr)
            ]);

            let yIdle = yesterdayIdleRes?.trackedIdleSeconds || 0;
            if (!yIdle && yesterdayIdleRes?.idleTimeline) {
                const yTimeline = yesterdayIdleRes.idleTimeline.map(i => (new Date(i.endTime || i.idleEnd) - new Date(i.startTime || i.idleStart)) / 1000);
                yIdle = yTimeline.reduce((acc, curr) => acc + curr, 0);
            }
            setYesterdayIdle(yIdle);

            const attData = attRes?.length > 0 ? attRes.find(a =>
                String(a.employeeId || "").trim() === empId ||
                String(a.employeeName || "").toLowerCase().includes(employeeName.toLowerCase())
            ) : null;

            setRawReportData({ idle: idleRes, attendance: attData });

            const stats = calculateReportStats(record, idleRes, attData);
            setReportData(stats);

        } catch (err) {
            console.error("Error fetching report data:", err);
            if (!reportData) {
                setReportData({
                    idleSeconds: 0,
                    workedSeconds: 0,
                    totalElapsedSeconds: 0,
                    idleTimeline: [],
                    punchIn: "N/A"
                });
            }
        } finally {
            setReportLoading(false);
        }
    };

    const fetchWeeklyData = async (empId, empName, offset) => {
        setWeeklyDataLoading(true);
        try {
            const end = new Date();
            end.setDate(end.getDate() - (offset * 7));
            const start = new Date(end);
            start.setDate(end.getDate() - 6);

            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];

            const [attRes, idleRes] = await Promise.all([
                getAttendanceByDateRange(startStr, endStr),
                api.get(`/api/idletime/employee/${empId}`)
            ]);

            const _allIdleData = (idleRes && idleRes.data) ? idleRes.data : idleRes;
            const allIdle = Array.isArray(_allIdleData) ? _allIdleData : [];
            const chartLabels = [];
            const workedData = [];
            const idleData = [];

            let d = new Date(start);
            for (let i = 0; i < 7; i++) {
                const dStr = d.toISOString().split('T')[0];
                chartLabels.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));

                const dailyAtt = attRes?.length > 0 ? attRes.find(a =>
                    (String(a.employeeId || "").trim() === empId || String(a.employeeName || "").toLowerCase().includes(empName.toLowerCase())) && a.date === dStr
                ) : null;

                const dailyIdle = allIdle.find(item => item.date === dStr) || {
                    idleTimeline: [],
                    trackedWorkSeconds: 0,
                    trackedIdleSeconds: 0
                };

                const historicalRecord = {
                    date: dStr,
                    employeeId: empId,
                    currentStatus: "OFFLINE",
                    idleSince: null,
                    trackedWorkSeconds: dailyIdle.trackedWorkSeconds || 0,
                    trackedIdleSeconds: dailyIdle.trackedIdleSeconds || 0,
                    idleTimeline: dailyIdle.idleTimeline || []
                };

                const stats = calculateReportStats(historicalRecord, dailyIdle, dailyAtt);

                workedData.push(parseFloat((stats.workedSeconds / 3600).toFixed(2)));
                idleData.push(parseFloat((stats.idleSeconds / 3600).toFixed(2)));

                d.setDate(d.getDate() + 1);
            }

            setWeeklyChartData({
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Working Hours',
                        data: workedData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 7
                    },
                    {
                        label: 'Idle Hours',
                        data: idleData,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#f59e0b',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 7
                    }
                ]
            });
        } catch (err) {
            console.error("Error fetching weekly data:", err);
            setWeeklyChartData(null);
        } finally {
            setWeeklyDataLoading(false);
        }
    };

    useEffect(() => {
        if (selectedEmployee) {
            fetchWeeklyData(selectedEmployee.employeeId, selectedEmployee.name, weeklyOffset);
        }
    }, [weeklyOffset, selectedEmployee]);

    // Live Ticker Effect
    useEffect(() => {
        if (selectedEmployee && !reportLoading && rawReportData.idle !== undefined) {
            const todayStr = new Date().toISOString().split('T')[0];
            const isToday = selectedDate === todayStr;

            if (isToday) {
                const latestRecord = liveData.find(r => String(r.employeeId).trim() === String(selectedEmployee.employeeId).trim()) || selectedEmployee;
                const stats = calculateReportStats(latestRecord, rawReportData.idle, rawReportData.attendance);
                setReportData(stats);
            }
        }
    }, [currentTime]);

    const fetchScreenshots = async (empId, dateStr) => {
        setScreenshotsLoading(true);
        try {
            const targetDate = dateStr || selectedDate || new Date().toISOString().split('T')[0];
            const res = await api.get(`/api/idletime/screenshots/${empId}?date=${targetDate}`);
            let data = res.data;
            if (!Array.isArray(data)) {
                if (data && Array.isArray(data.screenshots)) data = data.screenshots;
                else if (data && Array.isArray(data.data)) data = data.data;
                else data = [];
            }
            setScreenshots(data);
        } catch (err) {
            console.error("Error fetching screenshots:", err);
            setScreenshots([]);
        } finally {
            setScreenshotsLoading(false);
        }
    };

    const deleteScreenshot = async (url) => {
        if (!window.confirm("Are you sure you want to delete this screenshot?")) return;
        try {
            const targetDate = selectedDate || new Date().toISOString().split('T')[0];
            await api.delete("/api/idletime/screenshots", {
                data: {
                    employeeId: selectedEmployee.employeeId,
                    date: targetDate,
                    screenshotUrl: url
                }
            });
            setScreenshots(prev => prev.filter(s => s.screenshotUrl !== url));
        } catch (err) {
            console.error("Error deleting screenshot:", err);
            alert("Failed to delete screenshot.");
        }
    };

    const handleViewReport = (record) => {
        const empId = String(record.employeeId || "").trim();
        const latestRecord = liveData.find(r => String(r.employeeId).trim() === empId) || record;
        const employeeName = employeesMap[empId] || "Unknown Employee";

        const todayStr = new Date().toISOString().split('T')[0];
        const targetDate = record.date || todayStr;

        setSelectedEmployee({ ...latestRecord, name: employeeName, statusInfo: getStatusInfo(latestRecord), employeeId: empId });
        setReportLoading(true);
        setReportData(null);
        setWeeklyOffset(0);
        setRawReportData({ idle: null, attendance: null });
        setActiveTab('report');
        setScreenshots([]);
        setSelectedDate(targetDate);
        fetchReportData(latestRecord, targetDate);
        fetchScreenshots(empId, targetDate);
    };

    // Auto-sync status only if modal open
    useEffect(() => {
        if (selectedEmployee && !reportLoading) {
            const currentRecord = liveData.find(r => String(r.employeeId).trim() === String(selectedEmployee.employeeId).trim());
            if (currentRecord) {
                const employeeName = employeesMap[String(currentRecord.employeeId).trim()] || selectedEmployee.name;
                setSelectedEmployee({ ...currentRecord, name: employeeName, statusInfo: getStatusInfo(currentRecord) });
                fetchReportData(currentRecord, selectedDate);
            }
        }
    }, [liveData]);

    const closeReportModal = () => {
        setSelectedEmployee(null);
        setReportData(null);
        setScreenshots([]);
        setLightboxUrl(null);
        setActiveTab('report');
    };

    const getRowIdleTime = (record) => {
        let total = record.trackedIdleSeconds || 0;
        if (!total && record.idleTimeline) {
            total = record.idleTimeline.reduce((acc, span) => {
                const start = new Date(span.startTime || span.idleStart);
                const end = new Date(span.endTime || span.idleEnd);
                return acc + ((end - start) / 1000);
            }, 0);
        }
        return formatDuration(total);
    };

    const generatePdf = () => {
        if (!selectedEmployee || !reportData) return;

        const doc = new jsPDF();

        // Title
        doc.setFontSize(18);
        doc.text(`Daily Activity Report`, 14, 22);

        doc.setFontSize(12);
        doc.text(`Date: ${selectedDate}`, 14, 30);
        doc.text(`Employee: ${selectedEmployee.name} (${selectedEmployee.employeeId})`, 14, 36);
        doc.text(`Current Status: ${selectedEmployee.statusInfo.text}`, 14, 42);

        // Summary Table
        autoTable(doc, {
            startY: 50,
            head: [['Metric', 'Value']],
            body: [
                ['Punch In Time', reportData.punchIn],
                ['Exact Working Time', formatDuration(reportData.workedSeconds)],
                ['Exact Idle Time', formatDuration(reportData.idleSeconds)],
                ['Total Tracked Time', formatDuration(reportData.totalElapsedSeconds)],
                ["Yesterday's Idle Time", formatDuration(yesterdayIdle)]
            ],
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] },
            styles: { fontSize: 10 }
        });

        // Idle Timeline Table
        if (reportData.idleTimeline && reportData.idleTimeline.length > 0) {
            const tableData = reportData.idleTimeline.map(interval => [
                new Date(interval.idleStart).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
                new Date(interval.idleEnd).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
                formatDuration(interval.idleDurationSeconds)
            ]);

            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 10,
                head: [['Idle Start', 'Idle End', 'Duration']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [245, 158, 11] }
            });
        } else {
            doc.text("No idle sessions recorded for today.", 14, doc.lastAutoTable.finalY + 15);
        }

        doc.save(`Activity_Report_${selectedEmployee.employeeId}_${selectedDate}.pdf`);
    };

    const workingCount = getStatusSummaryCount("Working");
    const idleCount = getStatusSummaryCount("Idle");
    const offlineCount = getStatusSummaryCount("Offline");
    const totalCount = liveData.length;

    return (
        <div className="min-h-screen bg-slate-50/50 text-slate-800 p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans">
            {/* Background Ambient Glow Accents */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute top-1/4 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 max-w-7xl mx-auto space-y-8">
                {/* ── Top Header Section ── */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white/80 backdrop-blur-xl p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                                <FaBolt className="text-xl animate-pulse" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 bg-clip-text text-transparent tracking-tight">
                                    Live Employee Activity
                                </h1>
                                <p className="text-xs sm:text-sm text-slate-500 font-semibold flex items-center gap-2 mt-0.5">
                                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                                    Real-time desktop tracking & idle analytics telemetry
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Toolbar Controls */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Date Range Selector */}
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-2xl shadow-sm hover:border-indigo-300 transition-colors">
                            <FaCalendarAlt className="text-indigo-500 text-sm" />
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                                <span>From:</span>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    max={toDate}
                                    className="bg-transparent outline-none text-slate-800 font-bold cursor-pointer text-xs"
                                />
                                <span className="text-slate-400 mx-1">•</span>
                                <span>To:</span>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    max={new Date().toISOString().split('T')[0]}
                                    className="bg-transparent outline-none text-slate-800 font-bold cursor-pointer text-xs"
                                />
                            </div>
                        </div>

                        {/* Screenshot Interval */}
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-2xl shadow-sm hover:border-indigo-300 transition-colors">
                            <FaCamera className="text-purple-500 text-sm" />
                            <span className="text-xs font-bold text-slate-600">Snap Interval:</span>
                            <select
                                value={screenshotInterval}
                                onChange={(e) => handleSaveSettings(e.target.value)}
                                disabled={savingSettings}
                                className="bg-transparent border-none outline-none text-indigo-600 font-black text-xs cursor-pointer focus:ring-0"
                            >
                                <option value={1}>1 Min</option>
                                <option value={5}>5 Mins</option>
                                <option value={10}>10 Mins</option>
                                <option value={15}>15 Mins</option>
                                <option value={30}>30 Mins</option>
                                <option value={60}>1 Hour</option>
                            </select>
                        </div>

                        {/* Live Auto-Refresh Pulse Button */}
                        <button
                            onClick={() => {
                                setLoading(true);
                                fetchLiveData(false, fromDate, toDate);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-200 group active:scale-95"
                            title="Click to refresh instantly"
                        >
                            <FaSyncAlt className={`${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} text-white text-xs`} />
                            <span>Auto-sync in <span className="font-mono text-white underline">{refreshCountdown}s</span></span>
                        </button>
                    </div>
                </div>

                {/* ── KPI Metric Hero Cards ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Total Tracked */}
                    <div 
                        onClick={() => setStatusFilter("ALL")}
                        className={`cursor-pointer rounded-3xl p-6 transition-all duration-300 relative overflow-hidden group border ${
                            statusFilter === "ALL" 
                                ? "bg-white border-indigo-500 ring-2 ring-indigo-500/20 shadow-xl shadow-indigo-500/10 -translate-y-1" 
                                : "bg-white/90 backdrop-blur-md border-slate-200/80 hover:border-indigo-300 hover:shadow-lg hover:-translate-y-0.5"
                        }`}
                    >
                        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-purple-500 absolute top-0 left-0"></div>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Tracked</p>
                                <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1">{totalCount}</h3>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                <FaUserFriends className="text-xl" />
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs font-bold text-slate-500">
                            <span>All Registered Trackers</span>
                            <span className="text-indigo-600 font-extrabold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                                View All <FaChevronRight className="text-[10px]" />
                            </span>
                        </div>
                    </div>

                    {/* Working */}
                    <div 
                        onClick={() => setStatusFilter(statusFilter === "WORKING" ? "ALL" : "WORKING")}
                        className={`cursor-pointer rounded-3xl p-6 transition-all duration-300 relative overflow-hidden group border ${
                            statusFilter === "WORKING" 
                                ? "bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xl shadow-emerald-500/10 -translate-y-1" 
                                : "bg-white/90 backdrop-blur-md border-slate-200/80 hover:border-emerald-300 hover:shadow-lg hover:-translate-y-0.5"
                        }`}
                    >
                        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 to-teal-500 absolute top-0 left-0"></div>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Currently Working</p>
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                                </div>
                                <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1">{workingCount}</h3>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                                <FaDesktop className="text-xl" />
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs font-bold text-slate-500">
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                {totalCount > 0 ? Math.round((workingCount / totalCount) * 100) : 0}% Active Rate
                            </span>
                            <span className="text-emerald-600 font-extrabold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                                {statusFilter === "WORKING" ? "Filter On" : "Filter"} <FaChevronRight className="text-[10px]" />
                            </span>
                        </div>
                    </div>

                    {/* Idle */}
                    <div 
                        onClick={() => setStatusFilter(statusFilter === "IDLE" ? "ALL" : "IDLE")}
                        className={`cursor-pointer rounded-3xl p-6 transition-all duration-300 relative overflow-hidden group border ${
                            statusFilter === "IDLE" 
                                ? "bg-white border-amber-500 ring-2 ring-amber-500/20 shadow-xl shadow-amber-500/10 -translate-y-1" 
                                : "bg-white/90 backdrop-blur-md border-slate-200/80 hover:border-amber-300 hover:shadow-lg hover:-translate-y-0.5"
                        }`}
                    >
                        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-500 absolute top-0 left-0"></div>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Currently Idle</p>
                                <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1">{idleCount}</h3>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                                <FaClock className="text-xl" />
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs font-bold text-slate-500">
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                                Away from keyboard
                            </span>
                            <span className="text-amber-600 font-extrabold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                                {statusFilter === "IDLE" ? "Filter On" : "Filter"} <FaChevronRight className="text-[10px]" />
                            </span>
                        </div>
                    </div>

                    {/* Offline */}
                    <div 
                        onClick={() => setStatusFilter(statusFilter === "OFFLINE" ? "ALL" : "OFFLINE")}
                        className={`cursor-pointer rounded-3xl p-6 transition-all duration-300 relative overflow-hidden group border ${
                            statusFilter === "OFFLINE" 
                                ? "bg-white border-slate-500 ring-2 ring-slate-500/20 shadow-xl shadow-slate-500/10 -translate-y-1" 
                                : "bg-white/90 backdrop-blur-md border-slate-200/80 hover:border-slate-300 hover:shadow-lg hover:-translate-y-0.5"
                        }`}
                    >
                        <div className="h-1.5 w-full bg-gradient-to-r from-slate-400 to-slate-600 absolute top-0 left-0"></div>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Offline / Inactive</p>
                                <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1">{offlineCount}</h3>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 group-hover:scale-110 transition-transform">
                                <FaShieldAlt className="text-xl" />
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs font-bold text-slate-500">
                            <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                No recent heartbeat
                            </span>
                            <span className="text-slate-600 font-extrabold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                                {statusFilter === "OFFLINE" ? "Filter On" : "Filter"} <FaChevronRight className="text-[10px]" />
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Search & Filter Command Ribbon ── */}
                <div className="bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col md:flex-row items-center justify-between gap-4">
                    {/* Search bar */}
                    <div className="relative w-full md:w-96">
                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                        <input
                            type="text"
                            placeholder="Search employee name, ID, or app window..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl pl-11 pr-10 py-2.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm("")}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-all"
                            >
                                <FaTimes className="text-xs" />
                            </button>
                        )}
                    </div>

                    {/* Filter Segmented Control */}
                    <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60 overflow-x-auto w-full md:w-auto scrollbar-hide">
                        {[
                            { id: "ALL", label: "All", count: totalCount },
                            { id: "WORKING", label: "Working", count: workingCount, dot: "bg-emerald-500" },
                            { id: "IDLE", label: "Idle", count: idleCount, dot: "bg-amber-500" },
                            { id: "OFFLINE", label: "Offline", count: offlineCount, dot: "bg-slate-400" }
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                onClick={() => setStatusFilter(btn.id)}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                                    statusFilter === btn.id
                                        ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                                }`}
                            >
                                {btn.dot && <span className={`w-2 h-2 rounded-full ${btn.dot}`}></span>}
                                <span>{btn.label}</span>
                                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                                    statusFilter === btn.id ? "bg-indigo-50 text-indigo-600" : "bg-slate-200/60 text-slate-600"
                                }`}>
                                    {btn.count}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Main Data Grid ── */}
                <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    {/* Table View */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 uppercase text-[11px] tracking-wider font-extrabold">
                                    <th className="py-4 px-6 w-1/4">Employee</th>
                                    <th className="py-4 px-6 w-1/6">Live Status</th>
                                    <th className="py-4 px-6 w-1/6">Date</th>
                                    <th className="py-4 px-6 w-1/6">Total Idle Time</th>
                                    <th className="py-4 px-6 w-1/4">Last Heartbeat & Active App</th>
                                    <th className="py-4 px-6 text-right w-1/6">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && liveData.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-24 bg-white">
                                            <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                                                <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
                                                    <FaSyncAlt className="animate-spin text-2xl text-indigo-600" />
                                                </div>
                                                <span className="text-sm font-bold text-slate-700">Connecting telemetry streams...</span>
                                                <span className="text-xs text-slate-400">Fetching live desktop tracker telemetry</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredLiveData.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-24 bg-white">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-3 border border-slate-100">
                                                    <FaRegClock className="text-3xl text-slate-300" />
                                                </div>
                                                <span className="text-base font-bold text-slate-700">No activity records found</span>
                                                <span className="text-xs text-slate-400 mt-1 max-w-sm">
                                                    {searchTerm || statusFilter !== "ALL" 
                                                        ? "Try adjusting your search criteria or clearing filters." 
                                                        : "Ensure employee desktop tracker agents are running and synced."}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLiveData.map((record) => {
                                        const statusInfo = getStatusInfo(record);
                                        const employeeName = employeesMap[record.employeeId] || "Unknown Employee";
                                        const avatarGradient = getAvatarGradient(employeeName);
                                        const initials = getInitials(employeeName);

                                        return (
                                            <tr key={record._id} className="group hover:bg-indigo-50/30 transition-colors duration-150 bg-white">
                                                {/* Employee Column */}
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center gap-3.5">
                                                        {/* Avatar with Status Ring */}
                                                        <div className="relative shrink-0">
                                                            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${avatarGradient} text-white flex items-center justify-center font-black text-sm shadow-md shadow-slate-200`}>
                                                                {initials}
                                                            </div>
                                                            <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${statusInfo.glow} shadow-sm`} />
                                                        </div>
                                                        <div>
                                                            <p className="font-extrabold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">
                                                                {employeeName}
                                                            </p>
                                                            <span className="inline-block text-[11px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md mt-0.5 border border-slate-200/50">
                                                                {record.employeeId}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Status Column */}
                                                <td className="py-4 px-6">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.badgeBg}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.glow} ${statusInfo.text === 'Working' ? 'animate-ping' : ''}`}></span>
                                                        {statusInfo.text}
                                                    </span>
                                                </td>

                                                {/* Date Column */}
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                                                        <FaCalendarAlt className="text-slate-300 text-xs" />
                                                        {record.date}
                                                    </div>
                                                </td>

                                                {/* Total Idle Time */}
                                                <td className="py-4 px-6">
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/60 shadow-sm">
                                                        <FaClock className="text-amber-500" />
                                                        {getRowIdleTime(record)}
                                                    </span>
                                                </td>

                                                {/* Last Heartbeat & Active App */}
                                                <td className="py-4 px-6">
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                            Last ping: <span className="font-bold text-slate-700">{formatTime(record.lastPing)}</span>
                                                        </div>
                                                        {record.activeWindow && (
                                                            <span 
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/80 text-blue-700 rounded-lg text-[11px] font-bold border border-blue-100 max-w-[240px] truncate shadow-sm"
                                                                title={record.activeWindow}
                                                            >
                                                                <FaDesktop className="text-[10px] shrink-0 text-blue-500" />
                                                                <span className="truncate">{record.activeWindow}</span>
                                                            </span>
                                                        )}
                                                        {record.currentIdleScreenshot && statusInfo.text === 'Idle' && (
                                                            <a
                                                                href={record.currentIdleScreenshot}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                title="View current live idle screen"
                                                                className="inline-flex items-center w-fit gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-extrabold hover:bg-amber-100 transition-colors shadow-sm"
                                                                onClick={e => e.stopPropagation()}
                                                            >
                                                                <FaCamera className="text-[10px]" /> Live Screen
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td className="py-4 px-6 text-right">
                                                    <button
                                                        onClick={() => handleViewReport(record)}
                                                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 hover:bg-indigo-600 text-slate-700 hover:text-white border border-slate-200/80 hover:border-indigo-600 rounded-xl text-xs font-extrabold shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-indigo-500/20 group/btn"
                                                    >
                                                        <FaSearch className="text-slate-400 group-hover/btn:text-white transition-colors" />
                                                        <span>Analytics</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile & Tablet Card List */}
                    <div className="lg:hidden divide-y divide-slate-100 bg-white">
                        {loading && liveData.length === 0 ? (
                            <div className="text-center py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                                <FaSyncAlt className="animate-spin text-2xl text-indigo-600" />
                                <span className="text-sm font-bold text-slate-700">Connecting telemetry streams...</span>
                            </div>
                        ) : filteredLiveData.length === 0 ? (
                            <div className="text-center py-20 px-6 flex flex-col items-center justify-center text-slate-400">
                                <FaRegClock className="text-3xl text-slate-300 mb-2" />
                                <span className="text-base font-bold text-slate-700">No activity records found</span>
                            </div>
                        ) : (
                            filteredLiveData.map((record) => {
                                const statusInfo = getStatusInfo(record);
                                const employeeName = employeesMap[record.employeeId] || "Unknown Employee";
                                const avatarGradient = getAvatarGradient(employeeName);
                                const initials = getInitials(employeeName);

                                return (
                                    <div key={`mobile-${record._id}`} className="p-5 flex flex-col gap-4 hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${avatarGradient} text-white flex items-center justify-center font-black text-sm shadow-md`}>
                                                    {initials}
                                                </div>
                                                <div>
                                                    <p className="font-extrabold text-slate-900 text-sm">{employeeName}</p>
                                                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/50">
                                                        {record.employeeId}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.badgeBg}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.glow}`}></span>
                                                {statusInfo.text}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
                                            <div>
                                                <span className="text-slate-400 font-bold block text-[10px] uppercase">Date</span>
                                                <span className="font-bold text-slate-700">{record.date}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 font-bold block text-[10px] uppercase">Total Idle Time</span>
                                                <span className="font-extrabold text-amber-700">{getRowIdleTime(record)}</span>
                                            </div>
                                            <div className="col-span-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                                                <span className="text-slate-500 font-medium">Beat: {formatTime(record.lastPing)}</span>
                                                {record.currentIdleScreenshot && statusInfo.text === 'Idle' && (
                                                    <a
                                                        href={record.currentIdleScreenshot}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md"
                                                    >
                                                        Live Shot
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleViewReport(record)}
                                            className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                                        >
                                            <FaSearch /> View Full Activity Analytics
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* ── Fullscreen Lightbox ── */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 sm:p-8"
                    onClick={() => setLightboxUrl(null)}
                >
                    <div className="relative max-w-7xl w-full flex items-center justify-center h-full">
                        <img 
                            src={lightboxUrl} 
                            alt="Screenshot Full View" 
                            className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl border border-slate-800 object-contain" 
                        />
                        <button
                            className="absolute top-4 right-4 sm:top-2 sm:right-2 text-white bg-slate-800/80 hover:bg-red-600 p-3 rounded-full transition-all duration-200 shadow-xl border border-slate-700 group"
                            onClick={(e) => { e.stopPropagation(); setLightboxUrl(null); }}
                            title="Close preview"
                        >
                            <FaTimes className="text-lg group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Employee Activity Report Modal ── */}
            {selectedEmployee && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xl"
                    onClick={closeReportModal}
                >
                    <div
                        className="bg-white border border-slate-200/80 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Modal Floating Button */}
                        <button
                            onClick={closeReportModal}
                            className="absolute top-5 right-5 z-[60] p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all duration-200 group border border-transparent hover:border-red-100"
                            title="Close (Esc)"
                        >
                            <FaTimes className="text-xl group-hover:scale-110 transition-transform" />
                        </button>

                        {/* Modal Header */}
                        <div className="bg-white border-b border-slate-100 px-6 py-6 sm:px-8 flex flex-col md:flex-row justify-between items-start md:items-center z-10 gap-6">
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarGradient(selectedEmployee.name)} text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/20 shrink-0`}>
                                    {getInitials(selectedEmployee.name)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                            {selectedEmployee.name}
                                        </h2>
                                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 font-mono text-xs font-extrabold rounded-lg border border-slate-200">
                                            {selectedEmployee.employeeId}
                                        </span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 border ${selectedEmployee.statusInfo.badgeBg}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${selectedEmployee.statusInfo.glow}`}></span>
                                            {selectedEmployee.statusInfo.text}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center gap-2">
                                        <span>Date: {selectedDate}</span>
                                        {selectedEmployee.activeWindow && (
                                            <>
                                                <span>•</span>
                                                <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-bold truncate max-w-xs">
                                                    {selectedEmployee.activeWindow}
                                                </span>
                                            </>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Segmented Tab Switcher */}
                            <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200/60 shadow-inner overflow-x-auto w-full md:w-auto scrollbar-hide shrink-0">
                                <button
                                    onClick={() => setActiveTab('report')}
                                    className={`flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 whitespace-nowrap ${
                                        activeTab === 'report'
                                            ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <FaChartPie className={activeTab === 'report' ? 'text-indigo-600' : 'text-slate-400'} />
                                    Analytics
                                </button>
                                <button
                                    onClick={() => setActiveTab('screenshots')}
                                    className={`flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 whitespace-nowrap ${
                                        activeTab === 'screenshots'
                                            ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <FaCamera className={activeTab === 'screenshots' ? 'text-indigo-600' : 'text-slate-400'} />
                                    Screenshots
                                    {screenshots.length > 0 && (
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                            activeTab === 'screenshots' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                                        }`}>
                                            {screenshots.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('tablogs')}
                                    className={`flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 whitespace-nowrap ${
                                        activeTab === 'tablogs'
                                            ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <FaDesktop className={activeTab === 'tablogs' ? 'text-indigo-600' : 'text-slate-400'} />
                                    Tab Logs
                                    {reportData?.tabLogs?.length > 0 && (
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                            activeTab === 'tablogs' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                                        }`}>
                                            {reportData.tabLogs.length}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 sm:p-8 overflow-y-auto bg-slate-50/50 flex-1">
                            {/* ── TAB 1: ACTIVITY REPORT ── */}
                            {activeTab === 'report' && (
                                reportLoading ? (
                                    <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
                                        <FaSyncAlt className="animate-spin text-4xl text-indigo-500" />
                                        <p className="font-bold text-slate-600">Calculating activity telemetry...</p>
                                    </div>
                                ) : (
                                    reportData && (
                                        <div className="space-y-6">
                                            {/* 4 Summary Stat Cards */}
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                {/* Working */}
                                                <div className="bg-white rounded-2xl p-5 border border-emerald-200/60 shadow-sm relative overflow-hidden group">
                                                    <div className="h-1 w-full bg-emerald-500 absolute top-0 left-0"></div>
                                                    <span className="text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider block mb-1">Total Working</span>
                                                    <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
                                                        {formatDuration(reportData.workedSeconds)}
                                                    </span>
                                                </div>

                                                {/* Idle */}
                                                <div className="bg-white rounded-2xl p-5 border border-amber-200/60 shadow-sm relative overflow-hidden group">
                                                    <div className="h-1 w-full bg-amber-500 absolute top-0 left-0"></div>
                                                    <span className="text-amber-700 text-[10px] font-extrabold uppercase tracking-wider block mb-1">Total Idle</span>
                                                    <span className="text-xl sm:text-2xl font-black text-amber-700 font-mono">
                                                        {formatDuration(reportData.idleSeconds)}
                                                    </span>
                                                </div>

                                                {/* Yesterday's Idle */}
                                                <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm relative overflow-hidden group">
                                                    <div className="h-1 w-full bg-slate-400 absolute top-0 left-0"></div>
                                                    <span className="text-slate-500 text-[10px] font-extrabold uppercase tracking-wider block mb-1">Yesterday's Idle</span>
                                                    <span className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
                                                        {formatDuration(yesterdayIdle)}
                                                    </span>
                                                </div>

                                                {/* PDF Download Button */}
                                                <div className="bg-white rounded-2xl p-4 border border-slate-200/60 flex items-center justify-center shadow-sm">
                                                    <button
                                                        onClick={generatePdf}
                                                        className="w-full h-full min-h-[44px] flex items-center justify-center py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md shadow-indigo-500/20 transition-all gap-2"
                                                    >
                                                        <FaFilePdf className="text-base" /> Download PDF Report
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Charts & Timeline Row */}
                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                                {/* Doughnut Chart */}
                                                <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center">
                                                    <h3 className="text-base font-extrabold text-slate-800 mb-6 self-start tracking-tight">
                                                        Activity Ratio (Today)
                                                    </h3>
                                                    <div className="w-48 h-48 relative flex items-center justify-center">
                                                        {reportData.workedSeconds === 0 && reportData.idleSeconds === 0 ? (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold border-2 border-dashed border-slate-200 rounded-full bg-slate-50">
                                                                No Activity
                                                            </div>
                                                        ) : (
                                                            <Doughnut
                                                                data={{
                                                                    labels: ['Working', 'Idle'],
                                                                    datasets: [{
                                                                        data: [reportData.workedSeconds, reportData.idleSeconds],
                                                                        backgroundColor: ['#10b981', '#f59e0b'],
                                                                        borderColor: ['#fff', '#fff'],
                                                                        borderWidth: 4,
                                                                        cutout: '75%',
                                                                        hoverOffset: 6
                                                                    }]
                                                                }}
                                                                options={{
                                                                    plugins: {
                                                                        legend: { position: 'bottom', labels: { color: '#64748b', font: { weight: 'bold', size: 11 }, padding: 15, usePointStyle: true } }
                                                                    },
                                                                    maintainAspectRatio: false
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Idle Intervals Timeline Log */}
                                                <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/80 shadow-sm flex flex-col overflow-hidden max-h-80">
                                                    <div className="px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10 flex justify-between items-center">
                                                        <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Idle Intervals Log</h3>
                                                        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-extrabold rounded-lg border border-amber-200/60">
                                                            {reportData.idleTimeline?.length || 0} Sessions
                                                        </span>
                                                    </div>
                                                    <div className="overflow-y-auto p-4 sm:p-6 space-y-3">
                                                        {reportData.idleTimeline && reportData.idleTimeline.length > 0 ? (
                                                            reportData.idleTimeline.map((item, idx) => (
                                                                <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 hover:bg-slate-100/80 transition-colors">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs">
                                                                            {idx + 1}
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-xs font-bold text-slate-700">
                                                                                {new Date(item.idleStart).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                                                <span className="text-slate-400 mx-2">→</span>
                                                                                {new Date(item.idleEnd).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <span className="text-amber-700 font-mono font-black text-xs bg-amber-100/70 px-2.5 py-1 rounded-lg border border-amber-200/50">
                                                                        {formatDuration(item.idleDurationSeconds)}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                                                                <FaClock className="text-3xl text-slate-300 mb-2" />
                                                                <p className="font-bold text-slate-600 text-sm">No Idle Periods Recorded</p>
                                                                <p className="text-xs text-slate-400">Employee was continuously active during this period.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Weekly Summary Line Chart */}
                                            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                                    <div>
                                                        <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Weekly Overview (Last 7 Days)</h3>
                                                        <p className="text-xs text-slate-500 font-semibold">Tracked active vs idle working hours</p>
                                                    </div>
                                                    <select
                                                        className="bg-slate-50 text-slate-700 border border-slate-200/80 rounded-xl px-4 py-2 text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-sm"
                                                        value={weeklyOffset}
                                                        onChange={(e) => setWeeklyOffset(Number(e.target.value))}
                                                    >
                                                        <option value={0}>Current Week</option>
                                                        <option value={1}>1 Week Ago</option>
                                                        <option value={2}>2 Weeks Ago</option>
                                                        <option value={3}>3 Weeks Ago</option>
                                                        <option value={4}>4 Weeks Ago</option>
                                                    </select>
                                                </div>

                                                <div className="w-full h-72 relative">
                                                    {weeklyDataLoading ? (
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3 bg-slate-50/50 rounded-2xl">
                                                            <FaSyncAlt className="animate-spin text-2xl text-indigo-500" />
                                                            <span className="font-bold text-xs">Loading historical trends...</span>
                                                        </div>
                                                    ) : weeklyChartData ? (
                                                        <Line
                                                            data={weeklyChartData}
                                                            options={{
                                                                responsive: true,
                                                                maintainAspectRatio: false,
                                                                plugins: {
                                                                    legend: { labels: { color: '#64748b', font: { weight: 'bold', size: 11 }, usePointStyle: true } },
                                                                    tooltip: {
                                                                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                                                        padding: 12,
                                                                        cornerRadius: 12,
                                                                        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} hrs` }
                                                                    }
                                                                },
                                                                scales: {
                                                                    x: { ticks: { color: '#94a3b8', font: { weight: 'bold', size: 10 } }, grid: { color: 'rgba(226, 232, 240, 0.6)' } },
                                                                    y: {
                                                                        beginAtZero: true,
                                                                        ticks: { color: '#94a3b8', font: { weight: 'bold', size: 10 } },
                                                                        grid: { color: 'rgba(226, 232, 240, 0.6)' },
                                                                        title: { display: true, text: 'Hours Tracked', color: '#64748b', font: { weight: 'bold', size: 11 } }
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold bg-slate-50/50 rounded-2xl text-xs">
                                                            No weekly data available
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                )
                            )}

                            {/* ── TAB 2: TAB LOGS ── */}
                            {activeTab === 'tablogs' && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                <FaDesktop className="text-lg" />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-extrabold text-slate-900">Application & Tab History</h3>
                                                <p className="text-xs text-slate-500 font-semibold">Active window titles logged during work sessions</p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg border border-slate-200">
                                            Total: {reportData?.tabLogs?.length || 0} Records
                                        </span>
                                    </div>

                                    {reportLoading ? (
                                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                                            <FaSyncAlt className="animate-spin text-3xl text-indigo-500" />
                                            <p className="font-bold text-xs">Loading tab logs...</p>
                                        </div>
                                    ) : reportData?.tabLogs?.length > 0 ? (
                                        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
                                            <div className="divide-y divide-slate-100">
                                                <div className="hidden md:grid grid-cols-12 bg-slate-50/80 px-6 py-3.5 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider">
                                                    <div className="col-span-6">Application Window</div>
                                                    <div className="col-span-4">Time Interval</div>
                                                    <div className="col-span-2 text-right">Duration</div>
                                                </div>
                                                {reportData.tabLogs.map((log, idx) => (
                                                    <div key={idx} className="flex flex-col md:grid md:grid-cols-12 px-6 py-4 hover:bg-slate-50/70 transition-colors gap-2 md:gap-4 items-center text-xs">
                                                        <div className="col-span-6 font-bold text-slate-800 break-words w-full flex items-center gap-2.5">
                                                            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                                                            <span className="truncate">{log.title}</span>
                                                        </div>
                                                        <div className="col-span-4 text-slate-500 font-semibold flex items-center gap-1.5 w-full">
                                                            <FaClock className="text-slate-300 text-xs" />
                                                            {new Date(log.startTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                                                            <span className="text-slate-300">→</span>
                                                            {new Date(log.endTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                        <div className="col-span-2 text-right w-full">
                                                            <span className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-700 font-mono font-bold text-[11px] rounded-lg border border-indigo-100">
                                                                {formatDuration(log.durationSeconds)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center">
                                            <FaDesktop className="text-4xl text-slate-300 mb-2" />
                                            <p className="font-bold text-slate-700 text-sm">No Window Logs Captured</p>
                                            <p className="text-xs text-slate-400">Desktop tracker did not report any window changes today.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── TAB 3: SCREENSHOTS GALLERY ── */}
                            {activeTab === 'screenshots' && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                                                <FaCamera className="text-lg" />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-extrabold text-slate-900">Desktop Screenshots Gallery</h3>
                                                <p className="text-xs text-slate-500 font-semibold">Periodic screen captures synced from desktop agent</p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg border border-slate-200">
                                            Total: {screenshots.length} Screenshots
                                        </span>
                                    </div>

                                    {screenshotsLoading ? (
                                        <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
                                            <FaSyncAlt className="animate-spin text-3xl text-indigo-500" />
                                            <p className="font-bold text-xs">Loading screenshot media...</p>
                                        </div>
                                    ) : screenshots.length === 0 ? (
                                        <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center">
                                            <FaCamera className="text-4xl text-slate-300 mb-2" />
                                            <p className="font-bold text-slate-700 text-sm">No Screenshots Found</p>
                                            <p className="text-xs text-slate-400">No screen captures recorded for this date.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {screenshots.map((ss, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col"
                                                >
                                                    {/* Screenshot Thumbnail */}
                                                    <div 
                                                        className="relative h-48 bg-slate-100 cursor-pointer overflow-hidden"
                                                        onClick={() => setLightboxUrl(ss.screenshotUrl)}
                                                    >
                                                        <img
                                                            src={ss.screenshotUrl}
                                                            alt={`Screenshot ${idx + 1}`}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                            onError={(e) => { e.target.src = 'https://via.placeholder.com/400x200?text=Image+Unavailable'; }}
                                                        />
                                                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <div className="w-10 h-10 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-lg">
                                                                <FaSearch className="text-sm" />
                                                            </div>
                                                        </div>

                                                        {/* Status Chip */}
                                                        <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider shadow-sm text-white ${
                                                            ss.type === 'WORKING' ? 'bg-emerald-600' : 'bg-amber-600'
                                                        }`}>
                                                            {ss.type || 'IDLE'}
                                                        </span>
                                                        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-md">
                                                            {new Date(ss.capturedAt || ss.idleStart).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>

                                                    {/* Meta info footer */}
                                                    <div className="p-4 bg-white flex items-center justify-between">
                                                        <div>
                                                            <p className="text-xs font-extrabold text-slate-800">
                                                                {ss.type === 'WORKING' ? 'Working Active Shot' : 'Idle Time Interval'}
                                                            </p>
                                                            {ss.type !== 'WORKING' && (
                                                                <p className="text-[11px] text-amber-700 font-bold mt-0.5">
                                                                    Duration: {Math.floor((ss.idleDurationSeconds || 0) / 60)}m {Math.round((ss.idleDurationSeconds || 0) % 60)}s
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <a
                                                                href={ss.screenshotUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 border border-slate-200 flex items-center justify-center text-xs transition-colors"
                                                                title="Open in new tab"
                                                            >
                                                                <FaExternalLinkAlt />
                                                            </a>
                                                            <button
                                                                onClick={() => deleteScreenshot(ss.screenshotUrl)}
                                                                className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 flex items-center justify-center text-xs transition-colors"
                                                                title="Delete screenshot"
                                                            >
                                                                <FaTrash />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLiveTracking;
