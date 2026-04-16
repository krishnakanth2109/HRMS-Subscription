import React, { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getEmployeePayroll } from '../api';
import api from '../api';
import { FaPrint, FaExclamationCircle } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const EmployeePayslip = () => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [payslipData, setPayslipData] = useState(null);
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [templateImageUrl, setTemplateImageUrl] = useState(null);
  
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
    setTemplateImageUrl(null);
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

  // ✅ Fetch the template via backend proxy, detect type, render PDF page 1 to image
  useEffect(() => {
    if (!payslipData?.templateUrl) {
      setTemplateImageUrl(null);
      return;
    }

    let cancelled = false;

    const loadTemplate = async () => {
      try {
        console.log('📥 Fetching template via proxy:', payslipData.templateUrl);
        
        const response = await api.get(
          `/api/offer-letters/templates/fetch?url=${encodeURIComponent(payslipData.templateUrl)}`,
          { responseType: 'arraybuffer' }
        );

        if (cancelled) return;

        const bytes = new Uint8Array(response.data);
        
        // Detect file type by magic bytes
        const isPDF = bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
        const isPNG = bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
        const isJPG = bytes.length > 2 && bytes[0] === 0xFF && bytes[1] === 0xD8;

        if (isJPG || isPNG) {
          const blob = new Blob([bytes], { type: isPNG ? 'image/png' : 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          if (!cancelled) {
            setTemplateImageUrl(url);
            console.log('✅ Template loaded as image');
          }
        } else if (isPDF) {
          console.log('📄 Template is PDF, rendering page 1 via pdf.js...');
          
          // Dynamically load pdf.js from CDN
          if (!window.pdfjsLib) {
            await new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
              script.onload = resolve;
              script.onerror = reject;
              document.head.appendChild(script);
            });
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          }

          const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 3 }); // High-res for quality
          
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          
          await page.render({ canvasContext: ctx, viewport }).promise;
          
          if (!cancelled) {
            const dataUrl = canvas.toDataURL('image/png');
            setTemplateImageUrl(dataUrl);
            console.log('✅ Template PDF page 1 rendered to image');
          }
        } else {
          console.warn('⚠️ Unknown template file type');
        }
      } catch (err) {
        console.warn('Template background failed:', err.message);
        if (!cancelled) setTemplateImageUrl(null);
      }
    };

    loadTemplate();
    return () => { cancelled = true; };
  }, [payslipData?.templateUrl]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'decimal',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'NA';
    return new Date(dateString).toLocaleDateString('en-GB');
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
    experienceDetails = [],
    companyName = 'VAGARIOUS SOLUTIONS PVT. LTD.'
  } = employeeDetails || {};

  const currentJob = experienceDetails.length > 0 
    ? experienceDetails[experienceDetails.length - 1] 
    : {};

  const attendanceSummary = payslipData?.attendanceSummary || {};
  const salaryDetails = payslipData?.salaryDetails || {};
  const breakdown = payslipData?.breakdown || {};

  const leavesTaken = (attendanceSummary.totalDaysInMonth || 0) - (attendanceSummary.workedDays || 0);

  // Whether we have a letterhead template
  const hasTemplate = !!templateImageUrl;

  return (
    <div className="min-h-screen p-4 font-sans print:bg-white print:p-0 print:m-0">
      
      {/* --- Enforce Print Margins and Background Bleed --- */}
      <style>{`
        @media print {
          @page { margin: 0; size: A4 portrait; }
          body { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          #payslip-container {
            width: 100% !important;
            height: 100vh !important;
            max-height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
        }
      `}</style>
      
      {/* --- Controls (Hidden on Print) --- */}
      <div className="max-w-5xl mx-auto mb-8 print:hidden">
        <div className="bg-white rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Payslip Viewer</h1>
            <p className="text-sm text-gray-500">View and manage your monthly payslips</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-auto">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Month</label>
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-4 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-auto min-w-[180px] transition-colors"
              />
            </div>
            
            {payslipData && (
              <button 
                onClick={handlePrint}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 w-full sm:w-auto mt-auto"
              >
                <FaPrint className="text-sm" />
                Print / Download
              </button>
            )}
          </div>
        </div>
      </div>

      {/* --- Content Area --- */}
      <div className="max-w-5xl mx-auto print:max-w-none print:w-full print:mx-0">
        
        {loading ? (
          <div className="text-center p-10 bg-white">Loading...</div>
        ) : !payslipData ? (
          <div className="text-center p-8 md:p-12 bg-white rounded-xl shadow-lg border border-gray-100">
            <div className="flex justify-center mb-4">
              <FaExclamationCircle className="text-4xl md:text-5xl text-amber-400" />
            </div>
            <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-2">No Payslip Available</h3>
            <div className="space-y-1 mb-6">
              <p className="text-gray-600">No payslip found for the selected month.</p>
              <p className="text-gray-500 text-sm">Payslip has not been released for the selected period.</p>
            </div>
            <div className="inline-flex items-center text-sm text-blue-600 bg-blue-50 px-4 py-2 rounded-lg">
              <span className="mr-2">ℹ️</span>
              <span>Please check back later or contact HR for assistance.</span>
            </div>
          </div>
        ) : (
          /* --- THE PAYSLIP (with letterhead background) --- */
          <div 
            id="payslip-container" 
            className="bg-white relative print:p-0 print:m-0 text-black"
            style={{
              /* A4 aspect ratio container */
              width: '100%',
              maxWidth: '210mm',
              minHeight: hasTemplate ? '297mm' : 'auto',
              margin: '0 auto',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            
            {/* ========== FULL LETTERHEAD BACKGROUND (100% opacity) ========== */}
            {hasTemplate && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 0,
                pointerEvents: 'none',
              }}>
                <img
                  src={templateImageUrl}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    objectPosition: 'top',
                    display: 'block',
                  }}
                />
              </div>
            )}

            {/* ========== PAYSLIP CONTENT (overlaid on letterhead) ========== */}
            <div style={{
              position: 'relative',
              zIndex: 1,
              /* Generous padding to respect template header/footer areas */
              paddingTop: hasTemplate ? '170px' : '32px',
              paddingBottom: hasTemplate ? '80px' : '32px',
              paddingLeft: hasTemplate ? '40px' : '32px',
              paddingRight: hasTemplate ? '40px' : '32px',
            }}>
              
              {/* --- Company Header (shown only if NO template, since template has its own header) --- */}
              {!hasTemplate && (
                <div className="text-center pt-4 pb-2 border-2 border-gray-800 border-b-0 px-4">
                  <h1 className="text-3xl font-bold text-gray-900 uppercase font-serif tracking-wide">
                    {companyName}
                  </h1>
                  <h2 className="text-base font-bold text-gray-700 mt-2 uppercase">
                    PAYSLIP FOR THE MONTH {getMonthYear(selectedMonth)}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1 px-4 font-medium">
                    Spline Arcade 201, 2nd floor, Above Rayalaseema Spice Restaurant, Madhapur, Hyderabad, 500081
                  </p>
                </div>
              )}

              {/* If template exists, show a smaller inline header for the month */}
              {hasTemplate && (
                <div className="text-center mb-3">
                  <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
                    PAYSLIP FOR THE MONTH {getMonthYear(selectedMonth)}
                  </h2>
                </div>
              )}

              {/* Main content box */}
              <div style={{
                border: hasTemplate ? '1px solid rgba(0,0,0,0.3)' : '2px solid #1f2937',
                background: hasTemplate ? 'rgba(255,255,255,0.85)' : 'white',
                borderRadius: hasTemplate ? '4px' : '0',
                position: 'relative',
              }}>

                {/* Watermark (only shown when no template) */}
                {!hasTemplate && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
                    <img src={WATERMARK_IMAGE_LINK} alt="Watermark" className="w-[500px] opacity-10 object-contain" />
                  </div>
                )}

                <div className="relative z-10">
                  {/* Employee Details Grid */}
                  <div className="p-4 text-sm font-medium">
                    <div className="flex justify-between gap-8">
                      {/* Left Column */}
                      <div className="flex-1 space-y-1">
                        <div className="flex"><span className="w-36 text-gray-600">Employee Name</span><span className="mr-2">:</span><span className="font-bold text-gray-900">{payslipData.employeeName}</span></div>
                        <div className="flex"><span className="w-36 text-gray-600">Designation</span><span className="mr-2">:</span><span>{payslipData.role}</span></div>
                        <div className="flex"><span className="w-36 text-gray-600">Department</span><span className="mr-2">:</span><span>{currentJob.department || 'IT'}</span></div>
                        <div className="flex"><span className="w-36 text-gray-600">PAN Number</span><span className="mr-2">:</span><span>{personalDetails.panNumber || 'NA'}</span></div>
                        <div className="flex"><span className="w-36 text-gray-600">Branch</span><span className="mr-2">:</span><span>Hyderabad</span></div>
                        <div className="flex"><span className="w-36 text-gray-600">Bank Name</span><span className="mr-2">:</span><span>{bankDetails.bankName || 'NA'}</span></div>
                        <div className="flex"><span className="w-36 text-gray-600">No. Of Working Days</span><span className="mr-2">:</span><span>{attendanceSummary.totalDaysInMonth}</span></div>
                        <div className="flex"><span className="w-36 text-gray-600">UAN NO</span><span className="mr-2">:</span><span>{personalDetails.uan || 'NA'}</span></div>
                      </div>

                      {/* Right Column */}
                      <div className="flex-1 space-y-1">
                        <div className="flex"><span className="w-36 text-gray-600">Employee Code</span><span className="mr-2">:</span><span>{payslipData.employeeId}</span></div>
                        <div className="flex"><span className="w-36 text-gray-600">Location</span><span className="mr-2">:</span><span>HYDERABAD</span></div>
                        <div className="flex"><span className="w-36 text-gray-600">Joining Date</span><span className="mr-2">:</span><span>{currentJob.joiningDate ? formatDate(currentJob.joiningDate) : 'NA'}</span></div>
                        <div className="flex"><span className="w-36 text-gray-600">PF Account No</span><span className="mr-2">:</span><span>NA</span></div>
                        <div className="flex"><span className="w-36 text-gray-600">Bank Account No</span><span className="mr-2">:</span><span>{bankDetails.accountNumber || 'NA'}</span></div>
                        <div className="flex"><span className="w-36 text-gray-600">Grade</span><span className="mr-2">:</span><span>Associate</span></div>
                        <div className="flex"><span className="w-36 text-gray-600">Leaves Taken</span><span className="mr-2">:</span><span>{String(leavesTaken).padStart(2, '0')}</span></div>
                        <div className="flex"><span className="w-36 text-gray-600">LOP</span><span className="mr-2">:</span><span>{String(attendanceSummary.lopDays || 0).padStart(2, '0')}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Salary Table */}
                  <div className="mx-4 mt-2 border-t-2 border-b-2 border-black">
                    <div className="flex border-b border-black">
                      <div className="w-1/2 py-2 pl-2 font-bold uppercase tracking-wider border-r border-black text-sm">EARNINGS</div>
                      <div className="w-1/2 py-2 text-right pr-2 font-bold uppercase tracking-wider text-sm">DEDUCTIONS</div>
                    </div>

                    <div className="flex">
                      {/* EARNINGS */}
                      <div className="w-1/2 border-r border-black">
                        <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">Basic Salary</span><span>{formatCurrency(breakdown.basic)}</span></div>
                        <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">House Rent Allow</span><span>{formatCurrency(breakdown.hra)}</span></div>
                        <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">Travelling Allowance</span><span>{formatCurrency(breakdown.conveyance)}</span></div>
                        <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">Medical Allowances</span><span>{formatCurrency(breakdown.medical)}</span></div>
                        <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">Special Allowances</span><span>{formatCurrency(breakdown.special)}</span></div>
                        <div className="h-16"></div>
                      </div>

                      {/* DEDUCTIONS */}
                      <div className="w-1/2">
                        <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">PF</span><span>{formatCurrency(breakdown.pf)}</span></div>
                        <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">Professional Tax</span><span>{formatCurrency(breakdown.pt)}</span></div>
                        <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">LOP</span><span>{formatCurrency(salaryDetails.lopDeduction)}</span></div>
                        <div className="flex justify-between px-2 py-1 text-sm"><span className="uppercase">Other Deductions</span><span>{formatCurrency(salaryDetails.lateDeduction)}</span></div>
                      </div>
                    </div>

                    {/* Totals */}
                    <div className="flex border-t border-black font-bold text-sm">
                      <div className="w-1/2 border-r border-black flex justify-between px-2 py-2">
                        <span>Gross Amount</span><span>{formatCurrency(breakdown.gross)}</span>
                      </div>
                      <div className="w-1/2 flex justify-between px-2 py-2">
                        <span>Total Deduction</span><span>{formatCurrency(salaryDetails.totalDeductions)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Net Salary */}
                  <div className="mx-4 mt-4 mb-2">
                    <p className="font-bold text-lg">Net Salary : {formatCurrency(salaryDetails.netPayableSalary)}</p>
                  </div>
                </div>

                {/* Signature & Note */}
                <div className="relative z-10 mx-4 pb-4">
                  <div className="flex justify-end mb-4">
                    <div className="text-center">
                      <img src={SIGNATURE_IMAGE_LINK} alt="Signature" className="h-14 mx-auto mb-1 object-contain" />
                      <p className="text-xs font-bold border-t border-black pt-1 px-4">Authorized Signatory</p>
                    </div>
                  </div>
                  <div className="text-center text-xs font-medium border-t border-gray-300 pt-2">
                    <p>Note: This is a computer-generated payslip, hence no physical signature is required.</p>
                    <p>If you have any queries regarding this payslip, please contact the HR department.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- Print CSS --- */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background-color: white;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * { visibility: hidden; }
          #payslip-container, #payslip-container * { visibility: visible; }
          #payslip-container {
            position: absolute;
            left: 0; top: 0;
            width: 210mm;
            height: 297mm;
            padding: 0;
            margin: 0;
            background-color: white;
            box-sizing: border-box;
          }
          .flex { display: flex !important; }
        }
      `}</style>
    </div>
  );
};

export default EmployeePayslip;