import React, { useState, useEffect } from "react";
import api, { getEmployees, getIdleTimeForEmployeeByDate, getAttendanceByDateRange } from ".././api";
import {
    FaUserFriends, FaRegClock,
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
    FaCalendarAlt
} from "react-icons/fa";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement } from "chart.js";
import { Doughnut, Line, Bar } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement);

const AdminLiveTracking = () => {
    const [liveData, setLiveData] = useState([]);
    const [employeesMap, setEmployeesMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [refreshCountdown, setRefreshCountdown] = useState(10);

    // Modal State
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState(null);
    const [yesterdayIdle, setYesterdayIdle] = useState(0);
    const [reportLoading, setReportLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('report'); // 'report' | 'screenshots'

    // Weekly Report State
    const [weeklyOffset, setWeeklyOffset] = useState(0);
    const [weeklyChartData, setWeeklyChartData] = useState(null);
    const [weeklyDataLoading, setWeeklyDataLoading] = useState(false);

    // Screenshots State
    const [screenshots, setScreenshots] = useState([]);
    const [screenshotsLoading, setScreenshotsLoading] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState(null);

    useEffect(() => {
        // Fetch all employees to map IDs to Names once when component loads
        const loadEmployees = async () => {
            try {
                const employees = await getEmployees();
                const map = {};
                employees.forEach(emp => {
                    // Employee ID mapping (handles formatting differences)
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

    const fetchLiveData = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            // Added cache-busting timestamp to guarantee fresh data
            const response = await api.get(`/api/idletime/live-status?t=${new Date().getTime()}`);
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
    };

    // Main fetch interval (10 seconds)
    useEffect(() => {
        fetchLiveData(false);
        const interval = setInterval(() => {
            fetchLiveData(true);
        }, 10000);
        return () => clearInterval(interval);
    }, []);

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
                color: "text-red-500",
                bg: "bg-red-500/10",
                border: "border-red-500/20"
            };
        }

        if (record.currentStatus === "IDLE") {
            return {
                text: "Idle",
                color: "text-amber-500",
                bg: "bg-amber-500/10",
                border: "border-amber-500/20"
            };
        }

        return {
            text: "Working",
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20"
        };
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

    const [currentTime, setCurrentTime] = useState(new Date());

    // Effect to maintain a "Live" global clock for ticking calculations
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const calculateReportStats = (record, idleData, attData) => {
        const dateStr = String(record.date || "").trim();
        const employeeName = employeesMap[String(record.employeeId).trim()] || "Unknown Employee";

        // 1. Get Stored Idle Time from Live DB (Synchronously connected)
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
        }).sort((a, b) => a.idleStart - b.idleStart); // Sort in chronological order
        const storedIdleSeconds = idleTimeline.reduce((total, span) => total + (span.idleDurationSeconds || 0), 0);

        let totalIdleSeconds = 0;
        let workedSeconds = 0;
        let punchInTime = "N/A";
        let activeIdleExtra = 0;

        // Ensure we retrieve the punchIn time for the report display
        if (attData && attData.punchIn) {
            punchInTime = new Date(attData.punchIn).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }

        // 2. EXCLUSIVE TRACKER LOGIC
        // Only use the explicitly tracked times sent by the desktop tracker.
        if (record.trackedWorkSeconds !== undefined && record.trackedIdleSeconds !== undefined) {
            workedSeconds = record.trackedWorkSeconds;
            totalIdleSeconds = record.trackedIdleSeconds;

            // Add smooth ticking between backend refreshes (capped at 30s to match heartbeat interval)
            if (record.lastPing && record.currentStatus !== "OFFLINE") {
                const lastPingDate = new Date(record.lastPing);
                if (currentTime > lastPingDate) {
                    const elapsedSincePing = (currentTime - lastPingDate) / 1000;
                    // Cap at 30s — if more time has passed, the tracker is offline/lagging
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
            // If they are offline or tracker hasn't sent telemetry yet, just show 0 for exact work
            workedSeconds = 0;
            // Still display historical stored idle time for the day if they logged off
            totalIdleSeconds = storedIdleSeconds;
        }

        return {
            idleSeconds: totalIdleSeconds,
            workedSeconds: workedSeconds,
            totalElapsedSeconds: (workedSeconds + totalIdleSeconds),
            idleTimeline: idleTimeline,
            punchIn: punchInTime,
            activeIdleExtra: activeIdleExtra,
            storedIdleSeconds: storedIdleSeconds
        };
    };

    // Keep base API data for live ticking
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

            // Fetch target date, yesterday's idle time, and attendance in parallel
            const [idleRes, yesterdayIdleRes, attRes] = await Promise.all([
                getIdleTimeForEmployeeByDate(empId, targetDateStr),
                getIdleTimeForEmployeeByDate(empId, yesterdayStr),
                getAttendanceByDateRange(targetDateStr, targetDateStr)
            ]);

            // Setup Yesterday's Idle total
            let yIdle = yesterdayIdleRes?.trackedIdleSeconds || 0;
            if (!yIdle && yesterdayIdleRes?.idleTimeline) {
                const yTimeline = yesterdayIdleRes.idleTimeline.map(i => (new Date(i.endTime || i.idleEnd) - new Date(i.startTime || i.idleStart)) / 1000);
                yIdle = yTimeline.reduce((acc, curr) => acc + curr, 0);
            }
            setYesterdayIdle(yIdle);

            // Find matching attendance
            const attData = attRes?.length > 0 ? attRes.find(a =>
                String(a.employeeId || "").trim() === empId ||
                String(a.employeeName || "").toLowerCase().includes(employeeName.toLowerCase())
            ) : null;

            // Store raw results
            setRawReportData({ idle: idleRes, attendance: attData });

            // Initial calculation
            const stats = calculateReportStats(record, idleRes, attData);
            setReportData(stats);

        } catch (err) {
            console.error("Error fetching report data:", err);
            // Fallback
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
                        borderColor: 'rgba(16, 185, 129, 1)',
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.3,
                        pointBackgroundColor: 'rgba(16, 185, 129, 1)',
                    },
                    {
                        label: 'Idle Hours',
                        data: idleData,
                        borderColor: 'rgba(245, 158, 11, 1)',
                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.3,
                        pointBackgroundColor: 'rgba(245, 158, 11, 1)',
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

    // "Live Ticker" Effect: Recalculate modal stats every second while modal is open
    useEffect(() => {
        if (selectedEmployee && !reportLoading && rawReportData.idle !== undefined) {
            const todayStr = new Date().toISOString().split('T')[0];
            const isToday = selectedDate === todayStr;

            if (isToday) {
                // Find LATEST state from liveData periodically
                const latestRecord = liveData.find(r => String(r.employeeId).trim() === String(selectedEmployee.employeeId).trim()) || selectedEmployee;
                const stats = calculateReportStats(latestRecord, rawReportData.idle, rawReportData.attendance);
                setReportData(stats);
            }
        }
    }, [currentTime]); // Ticks every second

    const fetchScreenshots = async (empId) => {
        setScreenshotsLoading(true);
        try {
            const res = await api.get(`/api/idletime/screenshots/${empId}`);
            let data = res.data || [];
            setScreenshots(data);
        } catch (err) {
            console.error("Error fetching screenshots:", err);
            setScreenshots([]);
        } finally {
            setScreenshotsLoading(false);
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
        fetchScreenshots(empId);
    };

    const handleDateChange = (newDate) => {
        setSelectedDate(newDate);
        if (selectedEmployee) {
            fetchReportData(selectedEmployee, newDate);
        }
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
            headStyles: { fillColor: [63, 81, 181] },
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

    return (
        <div className="p-6 min-h-screen text-slate-800 bg-slate-50">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
                        Idle Time & Live Activity Tracking
                    </h1>
                    <p className="text-slate-500 mt-2 flex items-center gap-2">
                        Monitor real-time desktop activity from employees
                    </p>
                </div>

                <button
                    onClick={() => {
                        setLoading(true);
                        fetchLiveData(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 rounded-lg shadow-sm transition-all font-medium"
                >
                    <FaSyncAlt className={loading ? "animate-spin text-indigo-400" : "text-indigo-400"} />
                    Auto-Refresh in {refreshCountdown}s
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-gray-500 font-medium text-sm">Total Tracked</h3>
                        <FaUserFriends className="text-gray-400 text-lg" />
                    </div>
                    <p className="text-3xl font-semibold text-gray-900">{liveData.length}</p>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-gray-500 font-medium text-sm">Currently Working</h3>
                        <FaCircle className="text-emerald-500 text-xs" />
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-3xl font-semibold text-gray-900">{getStatusSummaryCount("Working")}</p>
                        <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 font-medium rounded-full">Active</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-gray-500 font-medium text-sm">Currently Idle</h3>
                        <FaCircle className="text-amber-500 text-xs" />
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-3xl font-semibold text-gray-900">{getStatusSummaryCount("Idle")}</p>
                        <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 font-medium rounded-full">Away</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-gray-500 font-medium text-sm">Offline / Inactive</h3>
                        <FaCircle className="text-red-500 text-xs" />
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-3xl font-semibold text-gray-900">{getStatusSummaryCount("Offline")}</p>
                        <span className="text-xs px-2 py-1 bg-red-50 text-red-700 font-medium rounded-full">Inactive</span>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl mb-6 shadow-sm">
                    {error}
                </div>
            )}

            {/* Data Grid */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-gray-700">
                                <th className="p-4 font-semibold w-1/5">Employee</th>
                                <th className="p-4 font-semibold w-1/6">Status</th>
                                <th className="p-4 font-semibold w-1/6">Date</th>
                                <th className="p-4 font-semibold w-1/6">Total Idle Time</th>
                                <th className="p-4 font-semibold w-1/6">Last Heartbeat</th>
                                <th className="p-4 font-semibold w-1/6 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading && liveData.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-12">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <FaSyncAlt className="animate-spin text-2xl mb-3 text-indigo-500" />
                                            <span className="text-sm font-medium">Loading data...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : liveData.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-12">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                                <FaRegClock className="text-xl text-gray-400" />
                                            </div>
                                            <span className="text-sm font-medium text-gray-500 mb-1">No data available</span>
                                            <span className="text-xs text-gray-400">No live tracking data available for today yet. Make sure desktop trackers are running.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                liveData.map((record) => {
                                    const statusInfo = getStatusInfo(record);
                                    const employeeName = employeesMap[record.employeeId] || "Unknown";
                                    return (
                                        <tr key={record._id} className="group hover:bg-gray-50/80 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900">{employeeName}</span>
                                                    <span className="text-xs text-gray-400 font-mono">{record.employeeId}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${statusInfo.bg} ${statusInfo.color} border ${statusInfo.border}`}>
                                                    <FaCircle className="text-[8px]" />
                                                    {statusInfo.text}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm text-gray-500">{record.date}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                                                    {getRowIdleTime(record)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                                    <FaClock className="text-gray-400 text-xs" />
                                                    {formatTime(record.lastPing)}
                                                    {/* Live screenshot indicator for IDLE employees */}
                                                    {record.currentIdleScreenshot && statusInfo.text === 'Idle' && (
                                                        <a
                                                            href={record.currentIdleScreenshot}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            title="View live idle screenshot"
                                                            className="ml-1 flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold hover:bg-amber-200 transition-colors"
                                                            onClick={e => e.stopPropagation()}
                                                        >
                                                            <FaCamera className="text-[10px]" /> Live Shot
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => handleViewReport(record)}
                                                    className="
             px-4 py-2 
             bg-white 
             text-indigo-600 
             border border-indigo-200 
             rounded-lg 
             text-sm font-semibold 
             flex items-center gap-2 ml-auto
             shadow-sm 
             transition-all duration-200 
             hover:bg-indigo-50 
             hover:border-indigo-300 
             hover:shadow-md 
             hover:-translate-y-0.5"
                                                >
                                                    <FaSearch className="text-indigo-500 text-sm" />
                                                    Details
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Lightbox */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
                    onClick={() => setLightboxUrl(null)}
                >
                    <img src={lightboxUrl} alt="Idle Screenshot" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl border border-slate-700" />
                    <button
                        className="absolute top-4 right-4 text-white bg-slate-700 hover:bg-slate-600 p-2 rounded-full"
                        onClick={() => setLightboxUrl(null)}
                    >
                        <FaTimes />
                    </button>
                </div>
            )}

            {/* Modal for Details & Report */}
            {selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">

                        {/* Modal Header */}
                        <div className="bg-white border-b border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center z-10 gap-4">
                            <div>
                                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
                                    <FaChartPie className="text-indigo-500 shrink-0" />
                                    Employee Activity Report
                                </h2>
                                <p className="text-slate-500 mt-1 flex items-center gap-2 font-medium flex-wrap">
                                    <span className="text-slate-800">{selectedEmployee.name}</span>
                                    <span className="text-xs px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-full text-slate-600">{selectedEmployee.employeeId}</span>
                                    <span className={`text-xs ml-1 flex items-center gap-1 font-semibold ${selectedEmployee.statusInfo.color}`}>
                                        <FaCircle className="text-[8px]"/> {selectedEmployee.statusInfo.text}
                                    </span>
                                </p>
                                {/* Tab Switcher */}
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={() => setActiveTab('report')}
                                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'report'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                                            }`}
                                    >
                                        <FaChartPie className="inline mr-1.5" /> Activity Report
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('screenshots')}
                                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${activeTab === 'screenshots'
                                                ? 'bg-amber-600 text-white'
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                                            }`}
                                    >
                                        <FaCamera />
                                        Idle Screenshots
                                        {screenshots.length > 0 && (
                                            <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded-full">{screenshots.length}</span>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center bg-white border border-slate-300 shadow-sm rounded-lg px-3 py-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                                    <FaCalendarAlt className="text-indigo-400 mr-2 text-sm" />
                                    <input 
                                        type="date" 
                                        value={selectedDate}
                                        onChange={(e) => handleDateChange(e.target.value)}
                                        className="bg-transparent text-slate-700 outline-none text-sm font-semibold cursor-pointer"
                                    />
                                </div>
                                <button onClick={closeReportModal} className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 p-2.5 rounded-full transition-all">
                                    <FaTimes />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto bg-slate-50/50">

                            {/* ===== ACTIVITY REPORT TAB ===== */}
                            {activeTab === 'report' && (
                                reportLoading ? (
                                    <div className="py-20 flex flex-col items-center justify-center text-slate-500">
                                        <FaSyncAlt className="animate-spin text-4xl mb-4 text-indigo-500" />
                                        <p className="font-medium">Loading analytics from database...</p>
                                    </div>
                                ) : (
                                    reportData && (
                                        <>
                                            {/* Quick Analytics Cards */}
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex flex-col shadow-sm">
                                                    <span className="text-emerald-700 text-xs font-bold mb-1 uppercase tracking-wider">Exact Working Time</span>
                                                    <span className="text-3xl font-bold text-emerald-600">{formatDuration(reportData.workedSeconds)}</span>
                                                </div>
                                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col shadow-sm">
                                                    <span className="text-amber-700 text-xs font-bold mb-1 uppercase tracking-wider">Exact Idle Time</span>
                                                    <span className="text-3xl font-bold text-amber-600">{formatDuration(reportData.idleSeconds)}</span>
                                                </div>
                                                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col shadow-sm">
                                                    <span className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">Yesterday's Idle</span>
                                                    <span className="text-3xl font-bold text-slate-700">{formatDuration(yesterdayIdle)}</span>
                                                </div>
                                                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center shadow-sm">
                                                    <button
                                                        onClick={generatePdf}
                                                        className="w-full flex items-center justify-center py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg font-bold shadow-lg transition-all gap-2"
                                                    >
                                                        <FaFilePdf /> Download PDF
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-4">
                                                {/* Doughnut Chart */}
                                                <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col items-center justify-center shadow-sm">
                                                    <h3 className="text-lg font-bold text-slate-800 mb-4 self-start">Activity Ratio (Today)</h3>
                                                    <div className="w-48 h-48">
                                                        {reportData.workedSeconds === 0 && reportData.idleSeconds === 0 ? (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-full">No Data</div>
                                                        ) : (
                                                            <Doughnut
                                                                data={{
                                                                    labels: ['Working', 'Idle'],
                                                                    datasets: [{
                                                                        data: [reportData.workedSeconds, reportData.idleSeconds],
                                                                        backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(245, 158, 11, 0.8)'],
                                                                        borderColor: ['rgba(16, 185, 129, 1)', 'rgba(245, 158, 11, 1)'],
                                                                        borderWidth: 1,
                                                                        cutout: '70%'
                                                                    }]
                                                                }}
                                                                options={{
                                                                    plugins: {
                                                                        legend: { position: 'bottom', labels: { color: '#64748b' } }
                                                                    },
                                                                    maintainAspectRatio: false
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Timeline Table */}
                                                <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden max-h-72 shadow-sm">
                                                    <h3 className="text-lg font-bold text-slate-800 p-4 border-b border-slate-200 sticky top-0 bg-white">Idle Intervals Log</h3>
                                                    <div className="overflow-y-auto">
                                                        {reportData.idleTimeline && reportData.idleTimeline.length > 0 ? (
                                                            <table className="w-full text-left text-sm">
                                                                <thead className="bg-slate-50 sticky top-0">
                                                                    <tr>
                                                                        <th className="px-4 py-2 text-slate-600 font-bold">Idle Start</th>
                                                                        <th className="px-4 py-2 text-slate-600 font-bold">Idle End</th>
                                                                        <th className="px-4 py-2 text-slate-600 font-bold">Duration</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {reportData.idleTimeline.map((item, idx) => (
                                                                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                                                            <td className="px-4 py-2 text-slate-700">{new Date(item.idleStart).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                                            <td className="px-4 py-2 text-slate-700">{new Date(item.idleEnd).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                                            <td className="px-4 py-2 text-amber-600 font-mono font-bold">{formatDuration(item.idleDurationSeconds)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        ) : (
                                                            <div className="p-8 text-center text-slate-500">
                                                                <FaClock className="text-4xl mx-auto mb-2 opacity-20" />
                                                                No idle sessions recorded for this user today yet.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Weekly Chart View */}
                                            <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col mt-4 shadow-sm">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="text-lg font-bold text-slate-800">Weekly Summary (Past 7 Days)</h3>
                                                    <select
                                                        className="bg-white text-slate-700 border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 text-sm"
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

                                                <div className="w-full h-64 relative">
                                                    {weeklyDataLoading ? (
                                                        <div className="absolute inset-0 flex items-center justify-center text-slate-400 gap-2">
                                                            <FaSyncAlt className="animate-spin text-xl" /> Fetching history...
                                                        </div>
                                                    ) : weeklyChartData ? (
                                                        <Line
                                                            data={weeklyChartData}
                                                            options={{
                                                                responsive: true,
                                                                maintainAspectRatio: false,
                                                                plugins: {
                                                                    legend: { labels: { color: '#64748b' } },
                                                                    tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} hrs` } }
                                                                },
                                                                scales: {
                                                                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(226, 232, 240, 0.5)' } },
                                                                    y: {
                                                                        beginAtZero: true,
                                                                        ticks: { color: '#94a3b8' },
                                                                        grid: { color: 'rgba(226, 232, 240, 0.5)' },
                                                                        title: { display: true, text: 'Hours', color: '#64748b' }
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                                                            Data could not be loaded
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )
                                )
                            )}

                            {/* ===== IDLE SCREENSHOTS TAB ===== */}
                            {activeTab === 'screenshots' && (
                                <div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <FaCamera className="text-amber-500 text-xl" />
                                        <h3 className="text-xl font-bold text-slate-800">Idle Screenshots</h3>
                                        <span className="text-xs text-slate-500">(captured automatically after 9 mins of idle)</span>
                                    </div>

                                    {screenshotsLoading ? (
                                        <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
                                            <FaSyncAlt className="animate-spin text-3xl text-amber-500" />
                                            <p>Loading screenshots...</p>
                                        </div>
                                    ) : screenshots.length === 0 ? (
                                        <div className="py-16 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-200 rounded-xl bg-white">
                                            <FaCamera className="text-5xl mb-3 opacity-20" />
                                            <p className="font-medium">No idle screenshots found</p>
                                            <p className="text-sm text-slate-400 mt-1">Screenshots are captured after 9 consecutive minutes of idle time</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            {screenshots.map((ss, idx) => (
                                                <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-amber-400 transition-all group shadow-sm">
                                                    {/* Thumbnail */}
                                                    <div
                                                        className="relative cursor-pointer overflow-hidden h-44"
                                                        onClick={() => setLightboxUrl(ss.screenshotUrl)}
                                                    >
                                                        <img
                                                            src={ss.screenshotUrl}
                                                            alt={`Idle at ${ss.date}`}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                            onError={(e) => { e.target.src = 'https://via.placeholder.com/400x180?text=Screenshot+Not+Found'; }}
                                                        />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                                            <FaSearch className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                        <span className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                                                            {ss.date}
                                                        </span>
                                                    </div>
                                                    {/* Meta info */}
                                                    <div className="p-3">
                                                        <div className="flex justify-between items-center">
                                                            <div className="text-sm">
                                                                <span className="text-slate-500">Idle: </span>
                                                                <span className="text-amber-600 font-mono font-medium">
                                                                    {new Date(ss.idleStart).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                                <span className="text-slate-400 mx-1">→</span>
                                                                <span className="text-amber-600 font-mono font-medium">
                                                                    {new Date(ss.idleEnd).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <a
                                                                href={ss.screenshotUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-slate-400 hover:text-indigo-500 transition-colors"
                                                                title="Open full size"
                                                            >
                                                                <FaExternalLinkAlt className="text-sm" />
                                                            </a>
                                                        </div>
                                                        <p className="text-xs text-slate-400 mt-1">
                                                            Duration: <span className="text-slate-600">{Math.floor((ss.idleDurationSeconds || 0) / 60)}m {Math.round((ss.idleDurationSeconds || 0) % 60)}s</span>
                                                        </p>
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