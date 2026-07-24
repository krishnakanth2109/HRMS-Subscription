import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Define colors for each department slice
const COLORS = ["#60a5fa", "#34d399", "#facc15", "#f472b6", "#c084fc", "#f87171"];

const DepartmentPieChart = ({ data }) => {
  if (!data || data.length === 0) return <p className="text-center">No data to display</p>;

  const departmentCounts = data.reduce((acc, emp) => {
    acc[emp.department] = (acc[emp.department] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(departmentCounts).map(([dept, count]) => ({
    name: dept,
    value: count,
  }));

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            label
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DepartmentPieChart;
