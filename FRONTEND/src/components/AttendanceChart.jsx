import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Group attendance data by date
const groupByDate = (records = []) => {
  const grouped = {};

  records.forEach((record) => {
    const date = record.date;
    const status = record.status;

    if (!grouped[date]) {
      // Add day code to the date
      const dateObj = new Date(date);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayCode = dayNames[dateObj.getDay()];
      const formattedDate = `${dayCode}\n${date.split('-')[2]}/${date.split('-')[1]}`;
      
      grouped[date] = { 
        date, 
        displayDate: formattedDate,
        Present: 0, 
        Absent: 0, 
        Leave: 0 
      };
    }

    if (status === "Present" || status === "Absent" || status === "Leave") {
      grouped[date][status]++;
    }
  });

  return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
};

const CurrentAttendanceChart = ({ data = [] }) => {
  const chartData = groupByDate(data);

  // Custom tooltip to show full date
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = chartData.find(item => item.displayDate === label);
      const fullDate = dataPoint ? new Date(dataPoint.date).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }) : label;
      
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold text-gray-800">{fullDate}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.dataKey}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={chartData}>
          <XAxis 
            dataKey="displayDate" 
            tick={{ fontSize: 12 }}
            interval={0}
            angle={0}
            textAnchor="middle"
          />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="Present" fill="#4ade80" />
          <Bar dataKey="Absent" fill="#f87171" />
          <Bar dataKey="Leave" fill="#facc15" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CurrentAttendanceChart;
