import React, { useState, useEffect } from "react";
import api, { getEmployees, getIdleTimeForEmployeeByDate, getAttendanceByDateRange } from ".././api";
import {
    FaUserFriends,
    FaCircle,
    FaSyncAlt,
    FaClock,
    FaChartPie,
    FaFilePdf,
    FaTimes,
    FaSearch,
    FaCalendarAlt
} from "react-icons/fa";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement } from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement);

const AdminLiveTracking = () => {
    const [liveData, setLiveData] = useState([]);
    const [employeesMap, setEmployeesMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal State
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState(null);
    const [yesterdayIdle, setYesterdayIdle] = useState(0);
    const [reportLoading, setReportLoading] = useState(false);
    const [rawReportData, setRawReportData] = useState({ idle: null, attendance: null });
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
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

    // Invisible Auto-Refresh Implementation
    const fetchLiveData = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            const response = await api.get(`/api/idletime/live-status?t=${new Date().getTime()}`);
            setLiveData(response.data || []);
            setError(null);
        } catch (err) {
            console.error("Error fetching live tracking data:", err);
            if (!isBackground) setError("Failed to fetch live tracking data");
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    // Auto-refresh every 4 seconds seamlessly
    useEffect(() => {
        fetchLiveData(false);
        const interval = setInterval(() => {
            fetchLiveData(true); // background refresh = true
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // Global ticking clock for smooth UI updates
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const getStatusInfo = (record) => {
        const lastPing = new Date(record.lastPing);
        const now = new Date();
        const minutesSincePing = (now - lastPing) / (1000 * 60);

        if (minutesSincePing > 3 || record.currentStatus === "OFFLINE") {
            return { text: "Offline", color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" };
        }
        if (record.currentStatus === "IDLE") {
            return { text: "Idle", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" };
        }
        return { text: "Working", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
    };

    const formatDuration = (totalSeconds) => {
        if (!totalSeconds && totalSeconds !== 0) return "0h 0m 0s";
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);
        return `${h}h ${m}m ${s}s`;
    };

    const getStatusSummaryCount = (status) => {
        return liveData.filter(record => getStatusInfo(record).text.toUpperCase() === status.toUpperCase()).length;
    };

    // Calculate Idle Time directly (ignoring work time completely)
    const calculateReportStats = (empInfo, idleData, attData, isToday) => {
        const rawTimeline = idleData?.idleTimeline || empInfo?.idleTimeline || [];
        const idleTimeline = rawTimeline.map(interval => {
            const start = new Date(interval.startTime || interval.idleStart);
            const end = new Date(interval.endTime || interval.idleEnd);
            return {
                idleStart: start,
                idleEnd: end,
                idleDurationSeconds: (end - start) / 1000
            };
        });
        
        const storedIdleSeconds = idleTimeline.reduce((total, span) => total + (span.idleDurationSeconds || 0), 0);
        let totalIdleSeconds = idleData?.trackedIdleSeconds !== undefined ? idleData.trackedIdleSeconds : storedIdleSeconds;

        let punchInTime = "N/A";
        if (attData && attData.punchIn) {
            punchInTime = new Date(attData.punchIn).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }

        // Live smooth ticking logic only if viewing 'Today' and status is IDLE
        if (isToday && empInfo.lastPing && empInfo.currentStatus === "IDLE") {
            const lastPingDate = new Date(empInfo.lastPing);
            if (currentTime > lastPingDate) {
                const elapsedSincePing = (currentTime - lastPingDate) / 1000;
                if (elapsedSincePing < 30) {
                    totalIdleSeconds += elapsedSincePing;
                }
            }
        }

        return {
            idleSeconds: totalIdleSeconds,
            idleTimeline: idleTimeline,
            punchIn: punchInTime
        };
    };

    const fetchReportData = async (empInfo, targetDateStr) => {
        setReportLoading(true);
        const empId = String(empInfo.employeeId || "").trim();
        const employeeName = employeesMap[empId] || empInfo.name || "Unknown Employee";

        try {
            const target = new Date(targetDateStr);
            const yesterday = new Date(target);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            // Fetch target date, yesterday's idle time, and attendance in parallel
            const [targetIdleRes, yesterdayIdleRes, attRes] = await Promise.all([
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

            // Match Attendance
            const attData = attRes?.length > 0 ? attRes.find(a =>
                String(a.employeeId || "").trim() === empId ||
                String(a.employeeName || "").toLowerCase().includes(employeeName.toLowerCase())
            ) : null;

            setRawReportData({ idle: targetIdleRes, attendance: attData });

            const isToday = targetDateStr === new Date().toISOString().split('T')[0];
            const stats = calculateReportStats(empInfo, targetIdleRes, attData, isToday);
            setReportData(stats);

        } catch (err) {
            console.error("Error fetching report data:", err);
            setReportData({ idleSeconds: 0, idleTimeline: [], punchIn: "N/A" });
        } finally {
            setReportLoading(false);
        }
    };

    const handleViewReport = (record) => {
        const empId = String(record.employeeId || "").trim();
        const latestRecord = liveData.find(r => String(r.employeeId).trim() === empId) || record;
        const employeeName = employeesMap[empId] || "Unknown Employee";

        const todayStr = new Date().toISOString().split('T')[0];
        const targetDate = record.date || todayStr;

        setSelectedEmployee({ ...latestRecord, name: employeeName, statusInfo: getStatusInfo(latestRecord) });
        setSelectedDate(targetDate);
        fetchReportData(latestRecord, targetDate);
    };

    const handleDateChange = (newDate) => {
        setSelectedDate(newDate);
        if (selectedEmployee) {
            fetchReportData(selectedEmployee, newDate);
        }
    };

    // Live Ticker Effect (only ticks if viewing Today's date)
    useEffect(() => {
        if (selectedEmployee && !reportLoading && rawReportData.idle !== null) {
            const todayStr = new Date().toISOString().split('T')[0];
            const isToday = selectedDate === todayStr;

            if (isToday) {
                const latestRecord = liveData.find(r => String(r.employeeId).trim() === String(selectedEmployee.employeeId).trim()) || selectedEmployee;
                const stats = calculateReportStats(latestRecord, rawReportData.idle, rawReportData.attendance, isToday);
                setReportData(stats);
            }
        }
    }, [currentTime]);

    const closeReportModal = () => {
        setSelectedEmployee(null);
        setReportData(null);
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

        doc.setFontSize(18);
        doc.text(`Daily Idle Time Report`, 14, 22);
        doc.setFontSize(12);
        doc.text(`Date: ${selectedDate}`, 14, 30);
        doc.text(`Employee: ${selectedEmployee.name} (${selectedEmployee.employeeId})`, 14, 36);
        doc.text(`Status (Current): ${selectedEmployee.statusInfo.text}`, 14, 42);

        autoTable(doc, {
            startY: 50,
            head: [['Metric', 'Value']],
            body: [
                ['Punch In Time', reportData.punchIn],
                ['Exact Idle Time', formatDuration(reportData.idleSeconds)],
                ["Yesterday's Idle Time", formatDuration(yesterdayIdle)]
            ],
            theme: 'grid',
            headStyles: { fillColor: [63, 81, 181] },
            styles: { fontSize: 10 }
        });

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
            doc.text("No idle sessions recorded for this date.", 14, doc.lastAutoTable.finalY + 15);
        }

        doc.save(`Idle_Report_${selectedEmployee.employeeId}_${selectedDate}.pdf`);
    };

    // Constructing Data for the New Bar Chart
    const barChartData = {
        labels: reportData?.idleTimeline?.map(item => {
            const start = new Date(item.idleStart).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
            const end = new Date(item.idleEnd).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
            return `${start} - ${end}`;
        }) || [],
        datasets: [
            {
                label: 'Idle Duration (Mins)',
                data: reportData?.idleTimeline?.map(item => (item.idleDurationSeconds / 60).toFixed(2)) || [],
                backgroundColor: 'rgba(245, 158, 11, 0.85)',
                borderColor: 'rgba(217, 119, 6, 1)',
                borderWidth: 1,
                borderRadius: 4,
                maxBarThickness: 60 // Prevents single bar from getting massively wide
            }
        ]
    };

    return (
        <div className="p-6 min-h-screen text-slate-800 bg-slate-50">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-indigo-700 flex items-center gap-3">
                        Live Idle Time Tracking
                    </h1>
                    <p className="text-slate-500 mt-2 flex items-center gap-2">
                        Monitor exact desktop idle activities in real-time
                    </p>
                </div>

                <button
                    onClick={() => fetchLiveData(false)}
                    className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 rounded-lg shadow-sm transition-all font-medium"
                >
                    <FaSyncAlt className={loading ? "animate-spin text-indigo-400" : "text-indigo-400"} />
                    Refresh Data
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-slate-500 font-medium text-sm">Total Tracked Employees</h3>
                        <FaUserFriends className="text-slate-400 text-lg" />
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{liveData.length}</p>
                </div>

                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-slate-500 font-medium text-sm">Currently Idle</h3>
                        <FaCircle className="text-amber-500 text-xs" />
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-3xl font-bold text-slate-800">{getStatusSummaryCount("Idle")}</p>
                        <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 font-semibold rounded-full border border-amber-200">Away</span>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-slate-500 font-medium text-sm">Offline / Inactive</h3>
                        <FaCircle className="text-red-500 text-xs" />
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-3xl font-bold text-slate-800">{getStatusSummaryCount("Offline")}</p>
                        <span className="text-xs px-2 py-1 bg-red-50 text-red-700 font-semibold rounded-full border border-red-200">Inactive</span>
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
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                <th className="p-4 font-semibold w-1/4">Employee</th>
                                <th className="p-4 font-semibold w-1/4">Status</th>
                                <th className="p-4 font-semibold w-1/6">Date</th>
                                <th className="p-4 font-semibold w-1/6">Total Idle Time</th>
                                <th className="p-4 font-semibold w-1/6 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {liveData.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-12">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                                <FaClock className="text-xl text-slate-400" />
                                            </div>
                                            <span className="text-sm font-medium text-slate-500 mb-1">No data available</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                liveData.map((record) => {
                                    const statusInfo = getStatusInfo(record);
                                    const employeeName = employeesMap[record.employeeId] || "Unknown";
                                    return (
                                        <tr key={record._id} className="group hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-800">{employeeName}</span>
                                                    <span className="text-xs text-slate-500 font-mono">{record.employeeId}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${statusInfo.bg} ${statusInfo.color} border ${statusInfo.border}`}>
                                                    <FaCircle className="text-[8px]" />
                                                    {statusInfo.text}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm text-slate-600">{record.date}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                                                    {getRowIdleTime(record)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => handleViewReport(record)}
                                                    className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg text-sm font-semibold flex items-center gap-2 ml-auto shadow-sm transition-all duration-200 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow"
                                                >
                                                    <FaSearch className="text-indigo-500 text-sm" />
                                                    Insights
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

            {/* Modal for Details & Report */}
            {selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">

                        {/* Modal Header */}
                        <div className="bg-white border-b border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center z-10 gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-indigo-700 flex items-center gap-3">
                                    <FaChartPie className="text-indigo-500 shrink-0" />
                                    Employee Idle Insights
                                </h2>
                                <p className="text-slate-500 mt-1 flex items-center gap-2 font-medium">
                                    <span className="text-slate-800">{selectedEmployee.name}</span>
                                    <span className="text-xs px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-full text-slate-600">{selectedEmployee.employeeId}</span>
                                    <span className={`text-xs ml-2 flex items-center gap-1 font-semibold ${selectedEmployee.statusInfo.color}`}>
                                        <FaCircle className="text-[8px]"/> {selectedEmployee.statusInfo.text}
                                    </span>
                                </p>
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
                            {reportLoading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-500">
                                    <FaSyncAlt className="animate-spin text-4xl mb-4 text-indigo-500" />
                                    <p className="font-medium">Loading analytics from database...</p>
                                </div>
                            ) : (
                                reportData && (
                                    <>
                                        {/* Quick Analytics Cards */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col shadow-sm">
                                                <span className="text-amber-700 text-xs font-bold mb-1 uppercase tracking-wider">Exact Idle Time (Selected Date)</span>
                                                <span className="text-3xl font-extrabold text-amber-600">{formatDuration(reportData.idleSeconds)}</span>
                                            </div>
                                            
                                            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col shadow-sm">
                                                <span className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">Yesterday's Idle Time</span>
                                                <span className="text-3xl font-extrabold text-slate-700">{formatDuration(yesterdayIdle)}</span>
                                            </div>
                                            
                                            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center shadow-sm">
                                                <button
                                                    onClick={generatePdf}
                                                    className="w-full flex items-center justify-center py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow transition-all gap-2"
                                                >
                                                    <FaFilePdf /> Download PDF Report
                                                </button>
                                            </div>
                                        </div>

                                        {/* Side by Side Layout for Graph and Table */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            
                                            {/* Graph Section */}
                                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[350px]">
                                                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Idle Time Intervals (Minutes)</h3>
                                                <div className="w-full flex-grow relative">
                                                    {reportData.idleTimeline && reportData.idleTimeline.length > 0 ? (
                                                        <Bar 
                                                            data={barChartData} 
                                                            options={{
                                                                responsive: true,
                                                                maintainAspectRatio: false,
                                                                plugins: {
                                                                    legend: { display: false },
                                                                    tooltip: {
                                                                        callbacks: { label: (ctx) => `${ctx.raw} mins` },
                                                                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                                                        titleFont: { size: 13 },
                                                                        bodyFont: { size: 14, weight: 'bold' },
                                                                        padding: 10
                                                                    }
                                                                },
                                                                scales: {
                                                                    y: {
                                                                        beginAtZero: true,
                                                                        title: { display: true, text: 'Duration in Minutes', color: '#64748b', font: { weight: 'bold' } },
                                                                        ticks: { color: '#64748b' },
                                                                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                                                                    },
                                                                    x: {
                                                                        ticks: { color: '#64748b', font: { size: 11 } },
                                                                        grid: { display: false }
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="absolute inset-0 flex items-center justify-center text-slate-500 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                                                            No idle intervals recorded for {selectedDate}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Timeline Table */}
                                            <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden h-[350px] shadow-sm">
                                                <h3 className="text-lg font-bold text-slate-800 p-4 border-b border-slate-200 bg-white sticky top-0 z-10">
                                                    Detailed Idle Logs
                                                </h3>
                                                <div className="overflow-y-auto flex-grow">
                                                    {reportData.idleTimeline && reportData.idleTimeline.length > 0 ? (
                                                        <table className="w-full text-left text-sm">
                                                            <thead className="bg-slate-50 sticky top-0 shadow-sm">
                                                                <tr>
                                                                    <th className="px-5 py-3 text-slate-600 font-bold">Idle Start Time</th>
                                                                    <th className="px-5 py-3 text-slate-600 font-bold">Idle End Time</th>
                                                                    <th className="px-5 py-3 text-slate-600 font-bold text-right">Duration</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {reportData.idleTimeline.map((item, idx) => (
                                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                                        <td className="px-5 py-3 text-slate-700 font-medium">
                                                                            {new Date(item.idleStart).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                                        </td>
                                                                        <td className="px-5 py-3 text-slate-700 font-medium">
                                                                            {new Date(item.idleEnd).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                                        </td>
                                                                        <td className="px-5 py-3 text-amber-600 font-bold font-mono text-right">
                                                                            {formatDuration(item.idleDurationSeconds)}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    ) : (
                                                        <div className="p-8 h-full flex flex-col items-center justify-center text-slate-400">
                                                            <FaClock className="text-4xl mb-3 text-slate-300" />
                                                            <p className="font-medium text-slate-500">No idle sessions recorded.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                        </div>
                                    </>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLiveTracking;