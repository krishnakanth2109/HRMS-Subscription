import React, { useEffect, useState } from "react";
import api from "../api";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaCalendarAlt,
} from "react-icons/fa";

const EmployeeTeamsPage = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchTeams = async () => {
    try {
      const res = await api.get("/api/groups/my-teams");

      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];

      // 🔧 TEMP MOCK STATS (replace with real API later)
      const enriched = list.map((team) => ({
        ...team,
        attendance: {
          present: Math.floor(Math.random() * 10) + 5,
          absent: Math.floor(Math.random() * 3),
          onLeave: Math.floor(Math.random() * 2),
        },
        leaves: {
          approved: Math.floor(Math.random() * 4),
          pending: Math.floor(Math.random() * 2),
        },
      }));

      setTeams(enriched);
    } catch (err) {
      console.error(err);
      setError("Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  if (loading) {
    return <div className="p-6 text-slate-400">Loading teams...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">{error}</div>;
  }

  if (!teams.length) {
    return (
      <div className="p-6 text-center text-slate-400">
        You are not assigned to any team yet.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">My Teams</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {teams.map((team) => (
          <div
            key={team._id}
            className="bg-white shadow-md rounded-xl border border-slate-200 p-5"
          >
            {/* ================= HEADER ================= */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {team.groupName}
                </h2>
                <p className="text-xs text-slate-500">
                  Code: {team.groupCode}
                </p>
              </div>

              <span
                className={`text-xs px-3 py-1 rounded-full ${
                  team.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {team.status}
              </span>
            </div>

            {/* ================= LEADER ================= */}
            <div className="mb-4">
              <p className="text-sm text-slate-500 mb-1">Team Leader</p>
              <p className="font-medium text-slate-700">
                {team.groupLeader?.name}{" "}
                <span className="text-xs text-slate-500">
                  ({team.groupLeader?.designation || "Leader"})
                </span>
              </p>
            </div>

            {/* ================= ATTENDANCE ================= */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-slate-700 mb-2">
                Attendance Summary
              </p>

              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  icon={<FaCheckCircle />}
                  label="Present"
                  value={team.attendance.present}
                  color="green"
                />
                <StatCard
                  icon={<FaTimesCircle />}
                  label="Absent"
                  value={team.attendance.absent}
                  color="red"
                />
                <StatCard
                  icon={<FaClock />}
                  label="On Leave"
                  value={team.attendance.onLeave}
                  color="yellow"
                />
              </div>
            </div>

            {/* ================= LEAVES ================= */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-slate-700 mb-2">
                Leave Requests
              </p>

              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={<FaCalendarAlt />}
                  label="Approved"
                  value={team.leaves.approved}
                  color="blue"
                />
                <StatCard
                  icon={<FaCalendarAlt />}
                  label="Pending"
                  value={team.leaves.pending}
                  color="orange"
                />
              </div>
            </div>

            {/* ================= MEMBERS ================= */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">
                Members
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {team.members?.map((m) => (
                  <div
                    key={m.employee?._id}
                    className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg"
                  >
                    <span className="text-sm text-slate-700">
                      {m.employee?.name}
                    </span>

                    <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full capitalize">
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ================= REUSABLE STAT CARD ================= */
const StatCard = ({ icon, label, value, color }) => {
  const colors = {
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    yellow: "bg-yellow-100 text-yellow-700",
    blue: "bg-blue-100 text-blue-700",
    orange: "bg-orange-100 text-orange-700",
  };

  return (
    <div className={`rounded-lg p-3 flex items-center gap-3 ${colors[color]}`}>
      <div className="text-lg">{icon}</div>
      <div>
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
};

export default EmployeeTeamsPage;
