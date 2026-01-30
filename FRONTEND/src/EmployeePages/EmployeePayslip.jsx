import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getEmployeePayroll } from '../api';
import { FaPrint, FaExclamationCircle } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const EmployeePayslip = () => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [payslipData, setPayslipData] = useState(null);
  const [employeeDetails, setEmployeeDetails] = useState(null);
  
  // Default to current month (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // --- IMAGES ---
  const WATERMARK_IMAGE_LINK = "https://vagarioussolutions.com/assets/logo-8p5st92j.png"; 
  const SIGNATURE_IMAGE_LINK = "https://signature.freefire-name.com/img.php?f=6&t=Sanjay%20Kumar";

  // Load Employee details from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("hrmsUser");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const empData = parsed.data || parsed;
        setEmployeeDetails(empData);
      } catch (e) {
        console.error("Error parsing user data:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (user?.employeeId && selectedMonth) {
      fetchPayslip();
    }
  }, [selectedMonth, user]);

  const fetchPayslip = async () => {
    setLoading(true);
    setPayslipData(null);
    try {
      const res = await getEmployeePayroll(user.employeeId, selectedMonth);
      setPayslipData(res.data);
    } catch (error) {
      if (error.response && error.response.status !== 404) {
        console.error("Error fetching payslip:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'decimal',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'NA';
    return new Date(dateString).toLocaleDateString('en-GB'); // DD/MM/YYYY
  };

  const handlePrint = () => {
    window.print();
  };

  const getMonthYear = (dateStr) => {
    const date = new Date(dateStr + "-01");
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  // Helper to extract safe values
  const {
    employeeId,
    name,
    personalDetails = {},
    bankDetails = {},
    experienceDetails = []
  } = employeeDetails || {};

  const currentJob = experienceDetails.length > 0 
    ? experienceDetails[experienceDetails.length - 1] 
    : {};

  // Calculate leaves
  const leavesTaken = payslipData ? (payslipData.attendanceSummary.totalDaysInMonth - payslipData.attendanceSummary.workedDays) : 0;

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans print:bg-white print:p-0 print:m-0">
      
      {/* --- Controls (Hidden on Print) --- */}
<div className="max-w-5xl mx-auto mb-8 print:hidden">
  <div className="bg-white rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg border border-gray-100">
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Payslip Viewer</h1>
      <p className="text-sm text-gray-500">View and manage your monthly payslips</p>
    </div>
    
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
      <div className="relative w-full sm:w-auto">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Month
        </label>
        <div className="relative">
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="pl-4 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-auto min-w-[180px] transition-colors"
          />
        </div>
      </div>
      
      {payslipData && (
        <button 
          onClick={handlePrint}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 w-full sm:w-auto"
        >
          <FaPrint className="text-sm" />
          Print / Download
        </button>
      )}
    </div>
  </div>
</div>

      {/* --- Content Area --- */}
      <div className="max-w-[850px] mx-auto print:max-w-none print:w-full print:mx-0">
        
        {loading ? (
          <div className="text-center p-10 bg-white">Loading...</div>
        ) : !payslipData ? (
       <div className="text-center p-8 md:p-12 bg-white rounded-xl shadow-lg border border-gray-100">
  <div className="flex justify-center mb-4">
    <FaExclamationCircle className="text-4xl md:text-5xl text-amber-400" />
  </div>
  
  <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-2">
    No Payslip Available
  </h3>
  
  <div className="space-y-1 mb-6">
    <p className="text-gray-600">
      No payslip found for the selected month.
    </p>
    <p className="text-gray-500 text-sm">
      Payslip has not been released for the selected period.
    </p>
  </div>
  
  <div className="inline-flex items-center text-sm text-blue-600 bg-blue-50 px-4 py-2 rounded-lg">
    <span className="mr-2">ℹ️</span>
    <span>Please check back later or contact HR for assistance.</span>
  </div>
</div>
        ) : (
          /* --- THE PAYSLIP --- */
          /* Note: We force width to 210mm (A4) and height to 297mm (A4) during print */
          <div id="payslip-container" className="bg-white p-8 relative print:p-0 print:m-0 text-black">
            
            {/* Outer Border Box */}
            <div className="border-2 border-gray-800 relative flex flex-col justify-between print:border-2 print:border-black print:h-[295mm]">
                
                {/* --- 1. WATERMARK IMAGE --- */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
                    <img 
                      src={WATERMARK_IMAGE_LINK} 
                      alt="Watermark" 
                      className="w-[500px] opacity-10 object-contain" 
                    />
                </div>

                {/* Content Wrapper */}
                <div className="relative z-10 print:pt-4">
                    
                    {/* Header */}
                    <div className="text-center pt-6 pb-2 print:pt-2">
                        <h1 className="text-3xl font-bold text-gray-900 uppercase font-serif tracking-wide print:text-4xl">
                            VAGARIOUS SOLUTIONS PVT. LTD.
                        </h1>
                        <h2 className="text-base font-bold text-gray-700 mt-2 uppercase print:text-lg">
                            PAYSLIP FOR THE MONTH {getMonthYear(selectedMonth)}
                        </h2>
                        <p className="text-sm text-gray-600 mt-1 px-4 font-medium print:text-sm">
                            Spline Arcade 201, 2nd floor, Above Rayalaseema Spice Restaurant, Madhapur, Hyderabad, 500081
                        </p>
                    </div>

                    {/* Divider Line */}
                    <hr className="border-gray-800 mx-4 my-2" />

                    {/* Employee Details Grid */}
                    <div className="p-4 text-sm font-medium print:text-sm print:p-2">
                        <div className="flex justify-between gap-8">
                            {/* Left Column */}
                            <div className="flex-1 space-y-1">
                                <div className="flex">
                                    <span className="w-32">Employee Name</span><span className="mr-2">:</span><span className="font-bold">{payslipData.employeeName}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">Designation</span><span className="mr-2">:</span><span>{payslipData.role}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">Department</span><span className="mr-2">:</span><span>{currentJob.department || 'IT'}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">PAN Number</span><span className="mr-2">:</span><span>{personalDetails.panNumber || 'NA'}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">Branch</span><span className="mr-2">:</span><span>Hyderabad</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">Bank Name</span><span className="mr-2">:</span><span>{bankDetails.bankName || 'NA'}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">No. Of Working Days</span><span className="mr-2">:</span><span>{payslipData.attendanceSummary.totalDaysInMonth}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">UAN NO</span><span className="mr-2">:</span><span>{personalDetails.uan || 'NA'}</span>
                                </div>
                            </div>

                            {/* Right Column */}
                            <div className="flex-1 space-y-1">
                                <div className="flex">
                                    <span className="w-32">Employee Code</span><span className="mr-2">:</span><span>{payslipData.employeeId}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">Location</span><span className="mr-2">:</span><span>HYDERABAD</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">Joining Date</span><span className="mr-2">:</span><span>{currentJob.joiningDate ? formatDate(currentJob.joiningDate) : 'NA'}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">PF Account No</span><span className="mr-2">:</span><span>NA</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">Bank Account No</span><span className="mr-2">:</span><span>{bankDetails.accountNumber || 'NA'}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">Grade</span><span className="mr-2">:</span><span>Associate</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">Leaves Taken</span><span className="mr-2">:</span><span>{String(leavesTaken).padStart(2, '0')}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">LOP</span><span className="mr-2">:</span><span>{String(payslipData.attendanceSummary.lopDays || 0).padStart(2, '0')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Salary Table */}
                    <div className="mx-4 mt-2 border-t-2 border-b-2 border-black">
                        <div className="flex border-b border-black">
                             <div className="w-1/2 py-2 pl-2 font-bold uppercase tracking-wider border-r border-black">EARNINGS</div>
                             <div className="w-1/2 py-2 text-right pr-2 font-bold uppercase tracking-wider">DEDUCTIONS</div>
                        </div>

                        <div className="flex">
                            {/* EARNINGS COLUMN */}
                            <div className="w-1/2 border-r border-black">
                                <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">Basic Salary</span><span>{formatCurrency(payslipData.breakdown.basic)}</span></div>
                                <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">House Rent Allow</span><span>{formatCurrency(payslipData.breakdown.hra)}</span></div>
                                <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">Travelling Allowance</span><span>{formatCurrency(payslipData.breakdown.conveyance)}</span></div>
                                <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">Medical Allowances</span><span>{formatCurrency(payslipData.breakdown.medical)}</span></div>
                                <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">Special Allowances</span><span>{formatCurrency(payslipData.breakdown.special)}</span></div>
                                {/* Empty Spacer */}
                                <div className="h-24"></div> 
                            </div>

                            {/* DEDUCTIONS COLUMN */}
                            <div className="w-1/2">
                                <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">PF</span><span>{formatCurrency(payslipData.breakdown.pf)}</span></div>
                                <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">Professional Tax</span><span>{formatCurrency(payslipData.breakdown.pt)}</span></div>
                                <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">LOP</span><span>{formatCurrency(payslipData.salaryDetails.lopDeduction)}</span></div>
                                <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">Other Deductions</span><span>{formatCurrency(payslipData.salaryDetails.lateDeduction)}</span></div>
                            </div>
                        </div>

                        {/* Totals Row */}
                        <div className="flex border-t border-black font-bold text-sm">
                            <div className="w-1/2 border-r border-black flex justify-between px-2 py-2">
                                <span>Gross Amount</span>
                                <span>{formatCurrency(payslipData.breakdown.gross)}</span>
                            </div>
                            <div className="w-1/2 flex justify-between px-2 py-2">
                                <span>Total Deduction</span>
                                <span>{formatCurrency(payslipData.salaryDetails.totalDeductions)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Net Salary Section */}
                    <div className="mx-4 mt-4">
                        <p className="font-bold text-lg">
                            Net Salary : {formatCurrency(payslipData.salaryDetails.netPayableSalary)}
                        </p>
                    </div>
                </div>

                {/* Footer Section (Signature & Note) */}
                <div className="relative z-10 mx-4 pb-4 print:pb-8">
                    
                    {/* --- 2. SIGNATURE IMAGE --- */}
                    <div className="flex justify-end mb-4">
                        <div className="text-center">
                            <img 
                              src={SIGNATURE_IMAGE_LINK} 
                              alt="Signature" 
                              className="h-14 mx-auto mb-1 object-contain"
                            />
                            <p className="text-xs font-bold border-t border-black pt-1 px-4">Authorized Signatory</p>
                        </div>
                    </div>

                    {/* --- 3. NOTE --- */}
                    <div className="text-center text-xs font-medium border-t border-gray-300 pt-2 print:text-[10px]">
                        <p>Note: This is a computer-generated payslip, hence no physical signature is required.</p>
                        <p>If you have any queries regarding this payslip, please contact the HR department.</p>
                    </div>
                </div>

            </div>
          </div>
        )}
      </div>

      {/* --- Print CSS Configuration --- */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0; /* Important: removes browser default margins */
          }

          body {
            margin: 0;
            padding: 0;
            background-color: white;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide everything not in payslip */
          body * {
            visibility: hidden;
          }

          /* Show payslip container */
          #payslip-container, #payslip-container * {
            visibility: visible;
          }

          #payslip-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;  /* Exact A4 Width */
            min-height: 297mm; /* Exact A4 Height */
            padding: 10mm; /* Inner padding for the content */
            margin: 0;
            background-color: white;
            box-sizing: border-box; /* Ensures padding is included in width */
            display: block;
          }
          
          /* Ensure flexbox works correctly in print */
          .flex {
            display: flex !important;
          }
          
          /* Force text color to black for crisp printing */
          .text-gray-600, .text-gray-700, .text-gray-900 {
            color: #000 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default EmployeePayslip;