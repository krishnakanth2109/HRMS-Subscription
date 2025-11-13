import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { getLeaveRequests, getEmployees } from "../api"; // ✅ make sure correct path

const COLORS = { Approved: "#22c55e", Rejected: "#ef4444", Pending: "#f59e0b" };
const STATUS_FILTERS = ["All", "Pending", "Approved", "Rejected"];

const StatCard = ({ title, value, colorClass }) => (
  <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center text-center">
    <p className={`text-4xl font-bold ${colorClass}`}>{value}</p>
    <p className="text-sm font-medium text-gray-600 mt-2">{title}</p>
  </div>
);

const AdminLeaveSummary = () => {
  const [allRequests, setAllRequests] = useState([]);
  const [employeesMap, setEmployeesMap] = useState(new Map());
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const chartRef = useRef(null);

  // ✅ Fetch both leaves & employees
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        const [leaves, employees] = await Promise.all([
          getLeaveRequests(),
          getEmployees(),
        ]);
        setAllRequests(leaves);

        const empMap = new Map(
          employees.map((emp) => [emp.employeeId, emp.name])
        );
        setEmployeesMap(empMap);
      } catch (err) {
        console.error("Error fetching summary data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // ✅ Attach employee names
  const enrichedRequests = useMemo(() => {
    return allRequests.map((req) => ({
      ...req,
      employeeName: employeesMap.get(req.employeeId) || "Unknown",
    }));
  }, [allRequests, employeesMap]);

  // ✅ Extract available months
  const allMonths = useMemo(() => {
    const months = new Set();
    enrichedRequests.forEach((req) => {
      if (req.from) months.add(req.from.slice(0, 7)); // YYYY-MM
    });
    return Array.from(months).sort().reverse();
  }, [enrichedRequests]);

  // ✅ Filter by status & month
  const filteredRequests = useMemo(() => {
    return enrichedRequests.filter((req) => {
      const matchesStatus =
        statusFilter === "All" || req.status === statusFilter;
      const matchesMonth =
        selectedMonth === "All" || req.from.startsWith(selectedMonth);
      return matchesStatus && matchesMonth;
    });
  }, [enrichedRequests, statusFilter, selectedMonth]);

  // ✅ Summary Stats
  const summaryStats = useMemo(() => {
    const stats = { Approved: 0, Rejected: 0, Pending: 0, Total: filteredRequests.length };
    filteredRequests.forEach((r) => {
      if (r.status in stats) stats[r.status]++;
    });
    return stats;
  }, [filteredRequests]);

  // ✅ Chart Data
  const chartData = useMemo(
    () =>
      Object.entries(summaryStats)
        .filter(([k, v]) => k !== "Total" && v > 0)
        .map(([name, value]) => ({ name, value })),
    [summaryStats]
  );

  // ✅ Export CSV
  const exportCSV = () => {
    const headers = ["Employee Name", "From", "To", "Status"];
    const rows = filteredRequests.map((req) =>
      [`"${req.employeeName}"`, req.from, req.to, req.status].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    saveAs(new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `leave_summary_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // ✅ Export PDF
  const exportPDF = async () => {
    setIsExporting(true);
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    let tableStartY = 40;

    pdf
      .setFontSize(18)
      .setFont(undefined, "bold")
      .text("Leave Summary Report", pdfWidth / 2, 20, { align: "center" });
    pdf
      .setFontSize(10)
      .text(`Generated: ${new Date().toLocaleDateString()}`, pdfWidth / 2, 28, {
        align: "center",
      });

    if (chartRef.current && chartData.length > 0) {
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: "#fff",
      });
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 160;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", (pdfWidth - imgWidth) / 2, 35, imgWidth, imgHeight);
      tableStartY = 40 + imgHeight;
    }

    autoTable(pdf, {
      startY: tableStartY,
      head: [["Employee", "From", "To", "Status"]],
      body: filteredRequests.map((r) => [
        r.employeeName,
        r.from,
        r.to,
        r.status,
      ]),
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
    });

    pdf.save(`leave_summary_${new Date().toISOString().slice(0, 10)}.pdf`);
    setIsExporting(false);
  };

  if (isLoading)
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-600 text-lg font-medium">Loading data...</p>
      </div>
    );

  return (
    <div className="bg-gray-50 min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Leave Summary</h1>
          <div className="flex gap-3">
            <button
              onClick={exportCSV}
              disabled={filteredRequests.length === 0}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              Export CSV
            </button>
            <button
              onClick={exportPDF}
              disabled={filteredRequests.length === 0 || isExporting}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-gray-400"
            >
              {isExporting ? "Generating..." : "Export PDF"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 bg-white p-4 rounded-lg shadow">
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full mt-1 p-2 border rounded-md"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full mt-1 p-2 border rounded-md"
            >
              <option value="All">All</option>
              {allMonths.map((m) => (
                <option key={m} value={m}>
                  {new Date(`${m}-02`).toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                  })}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard title="Total" value={summaryStats.Total} colorClass="text-blue-600" />
          <StatCard title="Approved" value={summaryStats.Approved} colorClass="text-green-600" />
          <StatCard title="Rejected" value={summaryStats.Rejected} colorClass="text-red-600" />
        </div>

        {/* Chart + Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div ref={chartRef} className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
              Leave Status Chart
            </h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={100}
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-20 text-gray-500">
                No data for selected filters
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow overflow-x-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Leave Requests</h3>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Employee ID</th>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">From</th>
                  <th className="p-3 text-left">To</th>
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr key={req._id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-800">{req.employeeId}</td>
                    <td className="p-3 font-medium text-gray-800">{req.employeeName}</td>
                    <td className="p-3 text-gray-600">{req.from}</td>
                    <td className="p-3 text-gray-600">{req.to}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          req.status === "Approved"
                            ? "bg-green-100 text-green-800"
                            : req.status === "Rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRequests.length === 0 && (
              <div className="text-center py-10 text-gray-500">
                No requests match the filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLeaveSummary;
