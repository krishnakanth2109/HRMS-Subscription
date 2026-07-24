// import { useContext } from "react";
// import { EmployeeContext } from "../context/EmployeeContext";
// import { AttendanceContext } from "../context/AttendanceContext";
// import { LeaveRequestContext } from "../context/LeaveRequestContext";
// import { NoticeContext } from "../context/NoticeContext";
// import { FaUser, FaCalendarCheck, FaClipboardList, FaBullhorn } from "react-icons/fa";

// const EmployeeDashboard = () => {
//   // Get John Doe's info
//   const { employees } = useContext(EmployeeContext);
//   const employee = employees.find(e => e.employeeId === "EMP101");
//   const { attendanceRecords } = useContext(AttendanceContext);
//   const { leaveRequests } = useContext(LeaveRequestContext);
//   // Robust context check for notices
//   const noticeContext = useContext(NoticeContext);
//   // If context is undefined, fallback to empty array
//   const notices = noticeContext?.notices ?? [];

//   // Attendance summary
//   const presentDays = attendanceRecords.filter(r => r.employeeId === "EMP101" && r.status === "Present").length;
//   const leaveDays = attendanceRecords.filter(r => r.employeeId === "EMP101" && r.status === "Leave").length;
//   const absentDays = attendanceRecords.filter(r => r.employeeId === "EMP101" && r.status === "Absent").length;
//   const totalDays = presentDays + leaveDays + absentDays;

//   // Leave summary
//   const approvedLeaves = leaveRequests.filter(lr => lr.employeeId === "EMP101" && lr.status === "Approved").length;
//   const pendingLeaves = leaveRequests.filter(lr => lr.employeeId === "EMP101" && lr.status === "Pending").length;
//   const rejectedLeaves = leaveRequests.filter(lr => lr.employeeId === "EMP101" && lr.status === "Rejected").length;


//   return (
//     <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 min-h-screen">
//       <h2 className="text-3xl font-bold text-blue-800 mb-6 flex items-center gap-3">
//         <FaUser className="text-blue-600" /> Welcome, {employee?.name || "Employee"}!
//       </h2>
//       <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
//         {/* Attendance Card */}
//         <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
//           <FaCalendarCheck className="text-3xl text-green-500 mb-2" />
//           <div className="text-lg font-bold text-gray-700">Attendance</div>
//           <div className="flex gap-4 mt-2">
//             <div className="flex flex-col items-center">
//               <span className="text-green-600 font-bold text-xl">{presentDays}</span>
//               <span className="text-xs text-gray-500">Present</span>
//             </div>
//             <div className="flex flex-col items-center">
//               <span className="text-yellow-600 font-bold text-xl">{leaveDays}</span>
//               <span className="text-xs text-gray-500">Leave</span>
//             </div>
//             <div className="flex flex-col items-center">
//               <span className="text-red-600 font-bold text-xl">{absentDays}</span>
//               <span className="text-xs text-gray-500">Absent</span>
//             </div>
//           </div>
//           <div className="mt-4 text-xs text-gray-400">Total Days: {totalDays}</div>
//         </div>
//         {/* Leave Card */}
//         <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
//           <FaClipboardList className="text-3xl text-blue-500 mb-2" />
//           <div className="text-lg font-bold text-gray-700">Leave Requests</div>
//           <div className="flex gap-4 mt-2">
//             <div className="flex flex-col items-center">
//               <span className="text-blue-600 font-bold text-xl">{approvedLeaves}</span>
//               <span className="text-xs text-gray-500">Approved</span>
//             </div>
//             <div className="flex flex-col items-center">
//               <span className="text-yellow-600 font-bold text-xl">{pendingLeaves}</span>
//               <span className="text-xs text-gray-500">Pending</span>
//             </div>
//             <div className="flex flex-col items-center">
//               <span className="text-red-600 font-bold text-xl">{rejectedLeaves}</span>
//               <span className="text-xs text-gray-500">Rejected</span>
//             </div>
//           </div>
//         </div>
//         {/* Profile Card */}
//         <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
//           <FaUser className="text-3xl text-purple-500 mb-2" />
//           <div className="text-lg font-bold text-gray-700">My Profile</div>
//           <div className="mt-2 text-sm text-gray-600 text-center">
//             <div><span className="font-semibold">ID:</span> {employee?.employeeId}</div>
//             <div><span className="font-semibold">Department:</span> {employee?.department}</div>
//             <div><span className="font-semibold">Email:</span> {employee?.email}</div>
//             <div><span className="font-semibold">Phone:</span> {employee?.phone}</div>
//           </div>
//           <button
//             className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition"
//             onClick={() => window.location.href = "/employee/profile"}
//           >
//             View Profile
//           </button>
//         </div>
//         {/* Notices Card */}
//         <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col items-center">
//           <FaBullhorn className="text-4xl text-orange-500 mb-2 animate-bounce" />
//           <div className="text-xl font-bold text-gray-800 mb-2">Latest Notice</div>
//           <div className="mt-2 w-full">
//             {Array.isArray(notices) && notices.length > 0 ? (
//               notices[0] && notices[0].title ? (
//                 <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg shadow mb-2">
//                   <div className="font-semibold text-orange-700 text-lg">{notices[0].title}</div>
//                   <div className="text-gray-700 mt-1">{notices[0].message}</div>
//                   <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
//                     <span>By {notices[0].author || 'Admin'}</span>
//                     <span>{notices[0].date || ''}</span>
//                   </div>
//                 </div>
//               ) : (
//                 <div className="text-gray-400 text-sm">No notices yet.</div>
//               )
//             ) : (
//               <div className="text-gray-400 text-sm text-center py-4">No notices yet.<br/>Admin has not posted any notices.</div>
//             )}
//           </div>
//           <button
//             className="mt-4 px-6 py-2 rounded-lg bg-orange-500 text-white font-semibold shadow hover:bg-orange-600 transition text-base"
//             onClick={() => window.location.href = "/employee/notices"}
//           >
//             View All Notices
//           </button>
//         </div>
//       </div>
//       {/* Attendance Chart (Bar) */}
//       <div className="bg-white rounded-xl shadow p-8 mt-8">
//         <h3 className="text-xl font-bold text-blue-700 mb-4">Attendance Overview</h3>
//         {/* Improved bar chart with values and animation */}
//         <div className="flex gap-8 items-end h-48 justify-center relative">
//           {/* Present Bar */}
//           <div className="flex flex-col items-center">
//             <span className="font-bold text-green-700 mb-2">{presentDays}</span>
//             <div
//               className="bg-green-500 w-12 rounded-t-lg transition-all duration-700 flex items-end justify-center"
//               style={{ height: totalDays ? `${presentDays / totalDays * 180}px` : '0px', minHeight: '8px' }}
//             >
//               {/* Show percentage if data exists */}
//               {totalDays > 0 && (
//                 <span className="text-xs text-white font-semibold mb-1">{((presentDays / totalDays) * 100).toFixed(0)}%</span>
//               )}
//             </div>
//             <span className="text-xs mt-2 text-green-700">Present</span>
//           </div>
//           {/* Leave Bar */}
//           <div className="flex flex-col items-center">
//             <span className="font-bold text-yellow-700 mb-2">{leaveDays}</span>
//             <div
//               className="bg-yellow-500 w-12 rounded-t-lg transition-all duration-700 flex items-end justify-center"
//               style={{ height: totalDays ? `${leaveDays / totalDays * 180}px` : '0px', minHeight: '8px' }}
//             >
//               {totalDays > 0 && (
//                 <span className="text-xs text-white font-semibold mb-1">{((leaveDays / totalDays) * 100).toFixed(0)}%</span>
//               )}
//             </div>
//             <span className="text-xs mt-2 text-yellow-700">Leave</span>
//           </div>
//           {/* Absent Bar */}
//           <div className="flex flex-col items-center">
//             <span className="font-bold text-red-700 mb-2">{absentDays}</span>
//             <div
//               className="bg-red-500 w-12 rounded-t-lg transition-all duration-700 flex items-end justify-center"
//               style={{ height: totalDays ? `${absentDays / totalDays * 180}px` : '0px', minHeight: '8px' }}
//             >
//               {totalDays > 0 && (
//                 <span className="text-xs text-white font-semibold mb-1">{((absentDays / totalDays) * 100).toFixed(0)}%</span>
//               )}
//             </div>
//             <span className="text-xs mt-2 text-red-700">Absent</span>
//           </div>
//         </div>
//         {/* Legend and empty state */}
//         {totalDays === 0 && (
//           <div className="text-center text-gray-400 mt-8 text-lg">No attendance data available for this month.</div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default EmployeeDashboard;
