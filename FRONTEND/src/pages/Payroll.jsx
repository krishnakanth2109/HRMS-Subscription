import React, { useState, useEffect, useMemo } from 'react';
import {
  getLeaveRequests,
  getEmployees,
  getAttendanceByDateRange,
  getAllOvertimeRequests,
} from '../api';

// Helper Functions
const LEAVE_YEAR_START_MONTH = 11;

const calculateLeaveDays = (from, to) => {
  if (!from || !to) return 0;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  fromDate.setUTCHours(0, 0, 0, 0);
  toDate.setUTCHours(0, 0, 0, 0);
  const diffTime = Math.abs(toDate - fromDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};

const getCurrentLeaveYear = () => {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  let startYear = currentMonth < LEAVE_YEAR_START_MONTH ? currentYear - 1 : currentYear;

  const startDate = new Date(startYear, LEAVE_YEAR_START_MONTH - 1, 1);
  const endDate = new Date(startYear + 1, LEAVE_YEAR_START_MONTH - 1, 0);

  return { startDate, endDate };
};

const getWorkedStatus = (punchIn, punchOut) => {
  if (!punchIn || !punchOut) {
    return "Working..";
  }
  const workedMilliseconds = new Date(punchOut) - new Date(punchIn);
  const workedHours = workedMilliseconds / (1000 * 60 * 60);
  if (workedHours >= 9) return "Full Day";
  if (workedHours >= 5) return "Half Day";
  if (workedHours > 0) return "Absent";
  return "N/A";
};

// Payroll Slip Modal Component
const PayrollSlipModal = ({ employee, onClose, monthlyWorkingDays, periodStart, periodEnd }) => {
  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  };

  const downloadPayslip = () => {
    const printWindow = window.open('', '_blank');
    const currentDate = new Date().toLocaleDateString('en-IN');
    
    const payslipHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip - ${employee.employeeName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Arial', sans-serif; 
            padding: 40px;
            background: #f5f5f5;
          }
          .payslip-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border: 2px solid #2563eb;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-bottom: 4px solid #1e3a8a;
          }
          .company-name {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 5px;
            letter-spacing: 1px;
          }
          .payslip-title {
            font-size: 18px;
            margin-top: 10px;
            opacity: 0.95;
          }
          .info-section {
            padding: 25px 30px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }
          .info-item {
            display: flex;
            padding: 8px 0;
          }
          .info-label {
            font-weight: 600;
            color: #475569;
            min-width: 140px;
          }
          .info-value {
            color: #1e293b;
            font-weight: 500;
          }
          .section-title {
            background: #e0e7ff;
            padding: 12px 30px;
            font-weight: bold;
            color: #1e40af;
            border-left: 4px solid #2563eb;
            margin: 0;
          }
          .details-table {
            width: 100%;
            border-collapse: collapse;
          }
          .details-table td {
            padding: 12px 30px;
            border-bottom: 1px solid #e2e8f0;
          }
          .details-table tr:last-child td {
            border-bottom: none;
          }
          .label-col {
            font-weight: 500;
            color: #475569;
            width: 60%;
          }
          .value-col {
            text-align: right;
            font-weight: 600;
            color: #1e293b;
          }
          .earnings-section {
            background: #f0fdf4;
          }
          .deductions-section {
            background: #fef2f2;
          }
          .net-salary-row {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
          }
          .net-salary-row td {
            padding: 18px 30px;
            font-size: 18px;
            font-weight: bold;
            border: none;
          }
          .footer {
            padding: 25px 30px;
            background: #f8fafc;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            color: #64748b;
            font-size: 12px;
          }
          .signature-section {
            display: flex;
            justify-content: space-between;
            padding: 30px;
            margin-top: 20px;
          }
          .signature-box {
            text-align: center;
            width: 200px;
          }
          .signature-line {
            border-top: 2px solid #94a3b8;
            margin-top: 60px;
            padding-top: 8px;
            font-weight: 600;
            color: #475569;
          }
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 80px;
            color: rgba(37, 99, 235, 0.05);
            font-weight: bold;
            pointer-events: none;
            z-index: 0;
          }
          .content-wrapper {
            position: relative;
            z-index: 1;
          }
          @media print {
            body { padding: 0; background: white; }
            .payslip-container { box-shadow: none; border: 2px solid #2563eb; }
          }
        </style>
      </head>
      <body>
        <div class="payslip-container">
          <div class="watermark">CONFIDENTIAL</div>
          <div class="content-wrapper">
            <div class="header">
              <div class="company-name">YOUR COMPANY NAME</div>
              <div style="font-size: 14px; margin-top: 5px;">Corporate Office Address | Email: hr@company.com | Phone: +91-XXXXXXXXXX</div>
              <div class="payslip-title">SALARY SLIP</div>
            </div>

            <div class="info-section">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Employee Name:</span>
                  <span class="info-value">${employee.employeeName}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Employee ID:</span>
                  <span class="info-value">${employee.employeeId}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Department:</span>
                  <span class="info-value">${employee.department}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Designation:</span>
                  <span class="info-value">${employee.role}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Pay Period:</span>
                  <span class="info-value">${new Date(periodStart).toLocaleDateString('en-IN')} - ${new Date(periodEnd).toLocaleDateString('en-IN')}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Payment Date:</span>
                  <span class="info-value">${currentDate}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Working Days:</span>
                  <span class="info-value">${monthlyWorkingDays} days</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Days Worked:</span>
                  <span class="info-value">${employee.totalWorkedDays.toFixed(1)} days</span>
                </div>
              </div>
            </div>

            <h3 class="section-title">ATTENDANCE SUMMARY</h3>
            <table class="details-table">
              <tr>
                <td class="label-col">Present Days</td>
                <td class="value-col">${employee.presentDays}</td>
              </tr>
              <tr>
                <td class="label-col">Full Days Worked</td>
                <td class="value-col">${employee.fullDays}</td>
              </tr>
              <tr>
                <td class="label-col">Half Days Worked</td>
                <td class="value-col">${employee.halfDays}</td>
              </tr>
              <tr>
                <td class="label-col">On Time Days</td>
                <td class="value-col">${employee.onTimeDays}</td>
              </tr>
              <tr>
                <td class="label-col">Late Days</td>
                <td class="value-col">${employee.lateDays}</td>
              </tr>
            </table>

            <h3 class="section-title">LEAVE SUMMARY</h3>
            <table class="details-table">
              <tr>
                <td class="label-col">Pending Leaves Available</td>
                <td class="value-col">${employee.pendingLeaves}</td>
              </tr>
              <tr>
                <td class="label-col">Total Leave Days Taken</td>
                <td class="value-col">${employee.totalLeaveDays}</td>
              </tr>
              <tr>
                <td class="label-col">Extra Leaves (Loss of Pay)</td>
                <td class="value-col" style="color: #dc2626;">${employee.extraLeaves}</td>
              </tr>
            </table>

            <h3 class="section-title" style="background: #f0fdf4; color: #059669;">EARNINGS</h3>
            <table class="details-table earnings-section">
              <tr>
                <td class="label-col">Base Salary (Monthly)</td>
                <td class="value-col">${formatCurrency(employee.baseSalary)}</td>
              </tr>
              <tr>
                <td class="label-col">Per Day Salary</td>
                <td class="value-col">${formatCurrency(employee.perDaySalary)}</td>
              </tr>
              <tr>
                <td class="label-col">Worked Days Salary (${employee.totalWorkedDays.toFixed(1)} days)</td>
                <td class="value-col" style="color: #059669; font-size: 16px;">${formatCurrency(employee.workedDaysSalary)}</td>
              </tr>
            </table>

            <h3 class="section-title" style="background: #fef2f2; color: #dc2626;">DEDUCTIONS</h3>
            <table class="details-table deductions-section">
              <tr>
                <td class="label-col">Loss of Pay (${employee.extraLeaves} extra leave days)</td>
                <td class="value-col" style="color: #dc2626; font-size: 16px;">${formatCurrency(employee.lopDeduction)}</td>
              </tr>
              <tr>
                <td class="label-col"><strong>Total Deductions</strong></td>
                <td class="value-col" style="color: #dc2626; font-weight: bold;">${formatCurrency(employee.lopDeduction)}</td>
              </tr>
            </table>

            <table class="details-table">
              <tr class="net-salary-row">
                <td>NET SALARY PAYABLE</td>
                <td style="text-align: right;">${formatCurrency(employee.netPayableSalary)}</td>
              </tr>
            </table>

            <div class="signature-section">
              <div class="signature-box">
                <div class="signature-line">Employee Signature</div>
              </div>
              <div class="signature-box">
                <div class="signature-line">Authorized Signatory</div>
              </div>
            </div>

            <div class="footer">
              <p><strong>Note:</strong> This is a computer-generated payslip and does not require a physical signature.</p>
              <p style="margin-top: 8px;">For any queries, please contact HR Department | Email: hr@company.com</p>
              <p style="margin-top: 15px; font-weight: 600;">*** This is a confidential document ***</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(payslipHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Payroll Summary</h2>
              <p className="text-blue-100 text-sm mt-1">{employee.employeeName} - {employee.employeeId}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:text-blue-600 rounded-full p-2 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {/* Employee Info Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6 border border-blue-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-600 font-medium">Department</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{employee.department}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600 font-medium">Role</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{employee.role}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600 font-medium">Period</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">
                  {new Date(periodStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - {new Date(periodEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 font-medium">Working Days</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{monthlyWorkingDays} days</div>
              </div>
            </div>
          </div>

          {/* Attendance Summary */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <span className="w-1 h-6 bg-blue-600 mr-3"></span>
              Attendance Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white border-2 border-gray-200 rounded-lg p-4 text-center hover:shadow-md transition-shadow">
                <div className="text-2xl font-bold text-blue-600">{employee.presentDays}</div>
                <div className="text-xs text-gray-600 mt-1">Present Days</div>
              </div>
              <div className="bg-white border-2 border-green-200 rounded-lg p-4 text-center hover:shadow-md transition-shadow">
                <div className="text-2xl font-bold text-green-600">{employee.fullDays}</div>
                <div className="text-xs text-gray-600 mt-1">Full Days</div>
              </div>
              <div className="bg-white border-2 border-yellow-200 rounded-lg p-4 text-center hover:shadow-md transition-shadow">
                <div className="text-2xl font-bold text-yellow-600">{employee.halfDays}</div>
                <div className="text-xs text-gray-600 mt-1">Half Days</div>
              </div>
              <div className="bg-white border-2 border-emerald-200 rounded-lg p-4 text-center hover:shadow-md transition-shadow">
                <div className="text-2xl font-bold text-emerald-600">{employee.onTimeDays}</div>
                <div className="text-xs text-gray-600 mt-1">On Time</div>
              </div>
              <div className="bg-white border-2 border-orange-200 rounded-lg p-4 text-center hover:shadow-md transition-shadow">
                <div className="text-2xl font-bold text-orange-600">{employee.lateDays}</div>
                <div className="text-xs text-gray-600 mt-1">Late Days</div>
              </div>
            </div>
          </div>

          {/* Leave Summary */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <span className="w-1 h-6 bg-purple-600 mr-3"></span>
              Leave Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                <div className="text-sm text-purple-700 font-medium">Pending Leaves</div>
                <div className="text-3xl font-bold text-purple-900 mt-2">{employee.pendingLeaves}</div>
              </div>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-700 font-medium">Total Leave Days Taken</div>
                <div className="text-3xl font-bold text-blue-900 mt-2">{employee.totalLeaveDays}</div>
              </div>
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <div className="text-sm text-red-700 font-medium">Extra Leaves (LOP)</div>
                <div className="text-3xl font-bold text-red-900 mt-2">{employee.extraLeaves}</div>
              </div>
            </div>
          </div>

          {/* Salary Breakdown */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <span className="w-1 h-6 bg-green-600 mr-3"></span>
              Salary Breakdown
            </h3>
            <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-3 text-sm text-gray-700">Base Salary (Monthly)</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      {formatCurrency(employee.baseSalary)}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-white">
                    <td className="px-4 py-3 text-sm text-gray-700">Per Day Salary</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      {formatCurrency(employee.perDaySalary)}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      Total Worked Days
                      <span className="text-xs text-gray-500 ml-2">
                        ({employee.fullDays} full + {employee.halfDays} half = {employee.totalWorkedDays.toFixed(1)})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600">
                      {employee.totalWorkedDays.toFixed(1)} days
                    </td>
                  </tr>
                  <tr className="border-b-2 border-gray-300 bg-green-50">
                    <td className="px-4 py-3 text-sm font-bold text-green-800">Worked Salary</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-green-800">
                      {formatCurrency(employee.workedDaysSalary)}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-red-50">
                    <td className="px-4 py-3 text-sm text-red-700">
                      Loss of Pay Deduction
                      <span className="text-xs text-red-600 ml-2">({employee.extraLeaves} extra leaves)</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-red-700">
                      - {formatCurrency(employee.lopDeduction)}
                    </td>
                  </tr>
                  <tr className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                    <td className="px-4 py-4 text-base font-bold">NET PAYABLE SALARY</td>
                    <td className="px-4 py-4 text-right text-xl font-bold">
                      {formatCurrency(employee.netPayableSalary)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Calculation Formula */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-bold text-blue-900 mb-2">📊 Calculation Method:</h4>
            <div className="text-xs text-blue-800 space-y-1">
              <div>• Worked Salary = Total Worked Days ({employee.totalWorkedDays.toFixed(1)}) × Per Day Salary ({formatCurrency(employee.perDaySalary)})</div>
              <div>• LOP Deduction = Extra Leaves ({employee.extraLeaves}) × Per Day Salary ({formatCurrency(employee.perDaySalary)})</div>
              <div>• Net Payable = Worked Salary - LOP Deduction</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={downloadPayslip}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Payslip
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PayrollManagement = () => {
  // State Management
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [employeesMap, setEmployeesMap] = useState(new Map());
  const [allEmployees, setAllEmployees] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [overtimeData, setOvertimeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Payroll Settings
  const [monthlyWorkingDays, setMonthlyWorkingDays] = useState(26);
  const todayISO = new Date().toISOString().split("T")[0];
  const [summaryStartDate, setSummaryStartDate] = useState(
    new Date(new Date().setDate(1)).toISOString().split("T")[0]
  );
  const [summaryEndDate, setSummaryEndDate] = useState(todayISO);

  // Fetch All Data
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [leaves, employees, attendance, overtime] = await Promise.all([
          getLeaveRequests(),
          getEmployees(),
          getAttendanceByDateRange(summaryStartDate, summaryEndDate),
          getAllOvertimeRequests(),
        ]);

        setLeaveRequests(leaves);
        
        const activeEmployees = employees.filter(emp => emp.isActive !== false);
        setAllEmployees(activeEmployees);
        
        const empMap = new Map(
          employees.map((emp) => [emp.employeeId, emp])
        );
        setEmployeesMap(empMap);

        const processedAttendance = Array.isArray(attendance)
          ? attendance.map(item => ({
              ...item,
              workedStatus: getWorkedStatus(item.punchIn, item.punchOut)
            }))
          : [];
        
        setAttendanceData(processedAttendance);
        setOvertimeData(overtime);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [summaryStartDate, summaryEndDate]);

  // Calculate Leave Statistics per Employee
  const employeeLeaveStats = useMemo(() => {
    const stats = new Map();
    const uniqueEmployees = Array.from(employeesMap.entries());
    const today = new Date();
    const { startDate, endDate } = getCurrentLeaveYear();

    uniqueEmployees.forEach(([empId, empData]) => {
      const employeeLeaves = leaveRequests.filter(req => req.employeeId === empId);

      const approvedLeavesThisYear = employeeLeaves.filter(leave => {
        const leaveDate = new Date(leave.from);
        return leave.status === 'Approved' && leaveDate >= startDate && leaveDate <= endDate;
      });
      
      const usedLeavesDaysThisYear = approvedLeavesThisYear.reduce(
        (total, leave) => total + calculateLeaveDays(leave.from, leave.to),
        0
      );

      let monthsPassed = 0;
      if (today >= startDate) {
        monthsPassed = (today.getFullYear() - startDate.getFullYear()) * 12 + 
                      (today.getMonth() - startDate.getMonth()) + 1;
      }
      const earnedLeavesThisYear = Math.max(0, monthsPassed);
      const pendingLeaves = Math.max(0, earnedLeavesThisYear - usedLeavesDaysThisYear);

      const approvedLeaves = employeeLeaves.filter(leave => leave.status === 'Approved');
      const totalLeaveDays = approvedLeaves.reduce(
        (total, leave) => total + calculateLeaveDays(leave.from, leave.to),
        0
      );

      const extraLeaves = Math.max(0, totalLeaveDays - 1);

      stats.set(empId, {
        employeeId: empId,
        pendingLeaves: pendingLeaves,
        totalLeaveDays: totalLeaveDays,
        extraLeaves: extraLeaves,
      });
    });

    return stats;
  }, [leaveRequests, employeesMap]);

  // Calculate Attendance Statistics per Employee
  const employeeAttendanceStats = useMemo(() => {
    if (!attendanceData.length) return new Map();

    const summary = attendanceData.reduce((acc, record) => {
      if (!acc[record.employeeId]) {
        acc[record.employeeId] = {
          employeeId: record.employeeId,
          employeeName: record.employeeName,
          presentDays: 0,
          onTimeDays: 0,
          lateDays: 0,
          fullDays: 0,
          halfDays: 0,
          absentDays: 0,
        };
      }
      
      const empRec = acc[record.employeeId];
      if (record.punchIn) {
        empRec.presentDays++;
        if (record.loginStatus === 'LATE') empRec.lateDays++;
        else if (record.loginStatus === 'ON_TIME') empRec.onTimeDays++;
      }
      
      if (record.workedStatus === "Full Day") empRec.fullDays++;
      else if (record.workedStatus === "Half Day") empRec.halfDays++;
      else if (record.workedStatus === "Absent") empRec.absentDays++;
      
      return acc;
    }, {});

    return new Map(Object.entries(summary));
  }, [attendanceData]);

  // Calculate Payroll Data
  const payrollData = useMemo(() => {
    if (!allEmployees.length || !monthlyWorkingDays) return [];

    return allEmployees.map((emp) => {
      const currentExp = Array.isArray(emp.experienceDetails)
        ? emp.experienceDetails.find((exp) => exp.lastWorkingDate === "Present")
        : null;

      const baseSalary = currentExp?.salary ? Number(currentExp.salary) : 0;
      const perDaySalary = baseSalary / monthlyWorkingDays;

      const attendance = employeeAttendanceStats.get(emp.employeeId) || {
        fullDays: 0,
        halfDays: 0,
        presentDays: 0,
        onTimeDays: 0,
        lateDays: 0,
      };

      const leaves = employeeLeaveStats.get(emp.employeeId) || {
        pendingLeaves: 0,
        totalLeaveDays: 0,
        extraLeaves: 0,
      };

      const totalWorkedDays = attendance.fullDays + (attendance.halfDays * 0.5);
      const workedDaysSalary = totalWorkedDays * perDaySalary;
      const lopDeduction = leaves.extraLeaves * perDaySalary;
      const netPayableSalary = workedDaysSalary - lopDeduction;

      return {
        employeeId: emp.employeeId,
        employeeName: emp.name || "Unknown",
        department: currentExp?.department || "N/A",
        role: currentExp?.role || "N/A",
        baseSalary: baseSalary,
        perDaySalary: perDaySalary,
        fullDays: attendance.fullDays,
        halfDays: attendance.halfDays,
        totalWorkedDays: totalWorkedDays,
        workedDaysSalary: workedDaysSalary,
        pendingLeaves: leaves.pendingLeaves,
        totalLeaveDays: leaves.totalLeaveDays,
        extraLeaves: leaves.extraLeaves,
        lopDeduction: lopDeduction,
        netPayableSalary: netPayableSalary,
        presentDays: attendance.presentDays,
        onTimeDays: attendance.onTimeDays,
        lateDays: attendance.lateDays,
      };
    }).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [allEmployees, employeeAttendanceStats, employeeLeaveStats, monthlyWorkingDays]);

  // Calculate Totals
  const totals = useMemo(() => {
    return payrollData.reduce(
      (acc, emp) => ({
        baseSalary: acc.baseSalary + emp.baseSalary,
        workedDaysSalary: acc.workedDaysSalary + emp.workedDaysSalary,
        lopDeduction: acc.lopDeduction + emp.lopDeduction,
        netPayableSalary: acc.netPayableSalary + emp.netPayableSalary,
        totalFullDays: acc.totalFullDays + emp.fullDays,
        totalHalfDays: acc.totalHalfDays + emp.halfDays,
        totalExtraLeaves: acc.totalExtraLeaves + emp.extraLeaves,
      }),
      { 
        baseSalary: 0, 
        workedDaysSalary: 0, 
        lopDeduction: 0, 
        netPayableSalary: 0,
        totalFullDays: 0,
        totalHalfDays: 0,
        totalExtraLeaves: 0,
      }
    );
  }, [payrollData]);

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN', { 
      maximumFractionDigits: 2, 
      minimumFractionDigits: 2 
    })}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payroll data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">💰 Payroll Management System</h1>
          <p className="text-gray-600">Comprehensive salary calculation based on attendance and leaves</p>
        </div>

        {/* Control Panel */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Payroll Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monthly Working Days
              </label>
              <input
                type="number"
                min="20"
                max="31"
                value={monthlyWorkingDays}
                onChange={(e) => setMonthlyWorkingDays(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Standard working days per month</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={summaryStartDate}
                onChange={(e) => setSummaryStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={summaryEndDate}
                onChange={(e) => setSummaryEndDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-5">
            <div className="text-sm text-gray-600 mb-1">Total Employees</div>
            <div className="text-2xl font-bold text-gray-900">{payrollData.length}</div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow-md border border-blue-200 p-5">
            <div className="text-sm text-blue-700 font-medium mb-1">Base Salary</div>
            <div className="text-xl font-bold text-blue-900">{formatCurrency(totals.baseSalary)}</div>
          </div>
          <div className="bg-green-50 rounded-lg shadow-md border border-green-200 p-5">
            <div className="text-sm text-green-700 font-medium mb-1">Worked Salary</div>
            <div className="text-xl font-bold text-green-900">{formatCurrency(totals.workedDaysSalary)}</div>
          </div>
          <div className="bg-red-50 rounded-lg shadow-md border border-red-200 p-5">
            <div className="text-sm text-red-700 font-medium mb-1">LOP Deductions</div>
            <div className="text-xl font-bold text-red-900">{formatCurrency(totals.lopDeduction)}</div>
            <div className="text-xs text-red-600 mt-1">{totals.totalExtraLeaves} extra leaves</div>
          </div>
          <div className="bg-purple-50 rounded-lg shadow-md border border-purple-200 p-5">
            <div className="text-sm text-purple-700 font-medium mb-1">Net Payable</div>
            <div className="text-xl font-bold text-purple-900">{formatCurrency(totals.netPayableSalary)}</div>
          </div>
        </div>

        {/* Main Payroll Table */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="text-xl font-bold text-gray-900">Employee Payroll Details</h2>
            <p className="text-sm text-gray-600 mt-1">
              Period: {new Date(summaryStartDate).toLocaleDateString()} - {new Date(summaryEndDate).toLocaleDateString()}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r">
                    Employee Details
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r">
                    Base Salary
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r">
                    Full Days
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r">
                    Half Days
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r">
                    Total Worked
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r">
                    Extra Leaves
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r">
                    LOP Deduction
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider bg-green-100 border-r">
                    Net Payable
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider bg-indigo-100">
                    Summary
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payrollData.length > 0 ? (
                  payrollData.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 border-r">
                        <div className="font-semibold text-gray-900">{emp.employeeName}</div>
                        <div className="text-xs text-gray-500">{emp.employeeId}</div>
                        <div className="text-xs text-gray-500">{emp.department} - {emp.role}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-medium text-gray-900 border-r">
                        {formatCurrency(emp.baseSalary)}
                      </td>
                      <td className="px-4 py-3 text-center border-r">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                          {emp.fullDays}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center border-r">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                          {emp.halfDays}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center border-r">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold bg-blue-100 text-blue-800">
                          {emp.totalWorkedDays.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center border-r">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                          emp.extraLeaves > 0 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {emp.extraLeaves}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-medium text-red-700 border-r">
                        {emp.lopDeduction > 0 ? `-${formatCurrency(emp.lopDeduction)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-bold text-green-800 bg-green-50 border-r">
                        {formatCurrency(emp.netPayableSalary)}
                      </td>
                      <td className="px-4 py-3 text-center bg-indigo-50">
                        <button
                          onClick={() => setSelectedEmployee(emp)}
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2 mx-auto"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                      No payroll data available for the selected period
                    </td>
                  </tr>
                )}
              </tbody>
              {payrollData.length > 0 && (
                <tfoot className="bg-gradient-to-r from-gray-100 to-gray-200 border-t-2 border-gray-400">
                  <tr>
                    <td className="px-4 py-4 text-sm font-bold text-gray-900 border-r">
                      TOTALS ({payrollData.length} Employees)
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-bold text-gray-900 border-r">
                      {formatCurrency(totals.baseSalary)}
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-bold text-gray-900 border-r">
                      {totals.totalFullDays}
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-bold text-gray-900 border-r">
                      {totals.totalHalfDays}
                    </td>
                    <td className="px-4 py-4 border-r"></td>
                    <td className="px-4 py-4 text-center text-sm font-bold text-red-700 border-r">
                      {totals.totalExtraLeaves}
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-bold text-red-800 border-r">
                      -{formatCurrency(totals.lopDeduction)}
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-bold text-green-900 bg-green-100 border-r">
                      {formatCurrency(totals.netPayableSalary)}
                    </td>
                    <td className="px-4 py-4 bg-indigo-50"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Calculation Formula Info */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-base font-bold text-blue-900 mb-3">📋 Payroll Calculation Formula</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-900">
            <div className="space-y-2">
              <div className="flex items-start">
                <span className="font-semibold mr-2">•</span>
                <div>
                  <strong>Per Day Salary:</strong> Base Salary ÷ {monthlyWorkingDays} working days
                </div>
              </div>
              <div className="flex items-start">
                <span className="font-semibold mr-2">•</span>
                <div>
                  <strong>Total Worked Days:</strong> Full Days + (Half Days × 0.5)
                </div>
              </div>
              <div className="flex items-start">
                <span className="font-semibold mr-2">•</span>
                <div>
                  <strong>Worked Salary:</strong> Total Worked Days × Per Day Salary
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-start">
                <span className="font-semibold mr-2">•</span>
                <div>
                  <strong>Extra Leaves (LOP):</strong> Total Leave Days - 1 (first leave is paid)
                </div>
              </div>
              <div className="flex items-start">
                <span className="font-semibold mr-2">•</span>
                <div>
                  <strong>LOP Deduction:</strong> Extra Leaves × Per Day Salary
                </div>
              </div>
              <div className="flex items-start">
                <span className="font-semibold mr-2">•</span>
                <div>
                  <strong>Net Payable:</strong> Worked Salary - LOP Deduction
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payroll Slip Modal */}
      {selectedEmployee && (
        <PayrollSlipModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          monthlyWorkingDays={monthlyWorkingDays}
          periodStart={summaryStartDate}
          periodEnd={summaryEndDate}
        />
      )}
    </div>
  );
};

export default PayrollManagement;