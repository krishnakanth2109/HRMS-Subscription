// --- START OF FILE Paste February 23, 2026 - 4:15PM ---

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';
// ✅ FIX: Imported your custom 'api' instance instead of raw axios
import api from '../api';
import {
  getLeaveRequests,
  getEmployees,
  getAttendanceByDateRange,
  getHolidays,
  getAllShifts,
  getPayrollRules,
  savePayrollRules,
  getOfferLetterTemplates
} from '../api';

// --- DEFAULT RULES ---
const DEFAULT_RULES = {
  basicPercentage: 40,
  hraPercentage: 40,
  conveyance: 1600,
  medical: 1250,
  travellingAllowance: 800,
  otherAllowance: 1000,
  // PF Defaults
  pfCalculationMethod: 'percentage', // 'percentage' | 'fixed'
  pfPercentage: 12,
  employerPfPercentage: 12,
  pfFixedAmountEmployee: 0,
  pfFixedAmountEmployer: 0,
  // PT Defaults
  ptSlab1Amount: 150,
  ptSlab2Amount: 200
};

// --- HELPER FUNCTIONS ---
const normalizeDate = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateLeaveDays = (from, to) => {
  if (!from || !to) return 0;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(toDate - fromDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};

const isDateInRange = (dateStr, startStr, endStr) => {
  const d = new Date(dateStr);
  const start = new Date(startStr);
  const end = new Date(endStr);
  d.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return d >= start && d <= end;
};

const getWorkedStatus = (punchIn, punchOut, status, fullDayThreshold = 9, halfDayThreshold = 4.5) => {
  const statusUpper = (status || "").toUpperCase();
  if (statusUpper === "LEAVE") return "Leave";
  if (statusUpper === "HOLIDAY") return "Holiday";
  if (statusUpper === "ABSENT" && !punchIn) return "Absent";
  if (punchIn && !punchOut) return "Working..";
  if (!punchIn) return "Absent";

  const workedMilliseconds = new Date(punchOut) - new Date(punchIn);
  const workedHours = workedMilliseconds / (1000 * 60 * 60);

  if (workedHours >= fullDayThreshold) return "Full Day";
  if (workedHours >= halfDayThreshold) return "Half Day";
  return "Absent";
};

const calculateLoginStatus = (punchInTime, shiftData, apiStatus) => {
  if (!punchInTime) return "--";
  if (apiStatus === "LATE") return "LATE";
  if (shiftData && shiftData.shiftStartTime) {
    try {
      const punchDate = new Date(punchInTime);
      const [sHour, sMin] = shiftData.shiftStartTime.split(':').map(Number);
      const shiftDate = new Date(punchDate);
      shiftDate.setHours(sHour, sMin, 0, 0);
      const grace = shiftData.lateGracePeriod || 15;
      shiftDate.setMinutes(shiftDate.getMinutes() + grace);
      if (punchDate > shiftDate) return "LATE";
    } catch (e) {
      console.error("Date calc error", e);
    }
  }
  return "ON_TIME";
};

// ✅ Get total days in the month
const getTotalDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

const exportToExcel = (data, fileName) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = { Sheets: { 'Payroll Data': ws }, SheetNames: ['Payroll Data'] };
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
  saveAs(dataBlob, `${fileName}.xlsx`);
};

// ✅ Helper: Get Current Employment Type
const getCurrentEmploymentType = (employee) => {
  if (employee && Array.isArray(employee.experienceDetails)) {
    const currentExp = employee.experienceDetails.find(exp => exp.lastWorkingDate === "Present") ||
      employee.experienceDetails[employee.experienceDetails.length - 1];
    return currentExp?.employmentType || "N/A";
  }
  return "N/A";
};

// Helper function to get date range based on selected month
const getDateRangeFromMonth = (yearMonth) => {
  if (!yearMonth) {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      startDate: formatDate(firstDay),
      endDate: formatDate(today)
    };
  }

  const [year, month] = yearMonth.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of month

  const today = new Date();
  const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  // If selected month is current month, end date is today
  if (yearMonth === currentYearMonth) {
    return {
      startDate: formatDate(startDate),
      endDate: formatDate(today)
    };
  }

  // For past months, end date is last day of that month
  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  };
};

// --- CONFIGURATION MODAL ---
const PayrollConfigModal = ({ isOpen, onClose, currentRules, onSave }) => {
  const [rules, setRules] = useState(currentRules);

  useEffect(() => {
    if (currentRules) setRules(currentRules);
  }, [currentRules]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      // Not used currently
    } else if (name === 'pfCalculationMethod') {
      setRules(prev => ({ ...prev, [name]: value }));
    } else {
      setRules(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    }
  };

  const handleSave = () => {
    onSave(rules);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">⚙️ Payroll Rules</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
            <h4 className="font-bold text-blue-800 text-sm mb-2 uppercase">Earnings Structure</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600">Basic Salary (% of Total)</label>
                <input type="number" name="basicPercentage" value={rules.basicPercentage} onChange={handleChange} className="w-full border rounded p-2 mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">HRA (% of Basic)</label>
                <input type="number" name="hraPercentage" value={rules.hraPercentage} onChange={handleChange} className="w-full border rounded p-2 mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Conveyance (Fixed ₹)</label>
                <input type="number" name="conveyance" value={rules.conveyance} onChange={handleChange} className="w-full border rounded p-2 mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Medical (Fixed ₹)</label>
                <input type="number" name="medical" value={rules.medical} onChange={handleChange} className="w-full border rounded p-2 mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Travelling Allowance (Fixed ₹)</label>
                <input type="number" name="travellingAllowance" value={rules.travellingAllowance} onChange={handleChange} className="w-full border rounded p-2 mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Other Allowance (Fixed ₹)</label>
                <input type="number" name="otherAllowance" value={rules.otherAllowance} onChange={handleChange} className="w-full border rounded p-2 mt-1" />
              </div>
            </div>
          </div>

          <div className="bg-red-50 p-3 rounded-lg border border-red-100">
            <h4 className="font-bold text-red-800 text-sm mb-2 uppercase">Deductions (PF & PT)</h4>

            {/* PF METHOD SELECTION */}
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-700 block mb-2">PF Calculation Method:</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="pfCalculationMethod"
                    value="percentage"
                    checked={rules.pfCalculationMethod === 'percentage'}
                    onChange={handleChange}
                    className="accent-blue-600"
                  />
                  <span className="text-sm">Percentage Based</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="pfCalculationMethod"
                    value="fixed"
                    checked={rules.pfCalculationMethod === 'fixed'}
                    onChange={handleChange}
                    className="accent-blue-600"
                  />
                  <span className="text-sm">Fixed Amount</span>
                </label>
              </div>
            </div>

            {/* CONDITIONAL PF INPUTS */}
            {rules.pfCalculationMethod === 'percentage' ? (
              <div className="grid grid-cols-2 gap-4 mb-4 bg-white p-2 rounded border">
                <div>
                  <label className="text-xs font-semibold text-gray-600">PF Employee (% of Basic)</label>
                  <input type="number" name="pfPercentage" value={rules.pfPercentage} onChange={handleChange} className="w-full border rounded p-2 mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">PF Employer (% of Basic)</label>
                  <input type="number" name="employerPfPercentage" value={rules.employerPfPercentage} onChange={handleChange} className="w-full border rounded p-2 mt-1" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 mb-4 bg-white p-2 rounded border">
                <div>
                  <label className="text-xs font-semibold text-gray-600">PF Fixed Employee (₹)</label>
                  <input type="number" name="pfFixedAmountEmployee" value={rules.pfFixedAmountEmployee} onChange={handleChange} className="w-full border rounded p-2 mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">PF Fixed Employer (₹)</label>
                  <input type="number" name="pfFixedAmountEmployer" value={rules.pfFixedAmountEmployer} onChange={handleChange} className="w-full border rounded p-2 mt-1" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div>
                <label className="text-xs font-semibold text-gray-600">PT Slab 1 (&gt;15k) Amount (₹)</label>
                <input type="number" name="ptSlab1Amount" value={rules.ptSlab1Amount} onChange={handleChange} className="w-full border rounded p-2 mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">PT Slab 2 (&gt;20k) Amount (₹)</label>
                <input type="number" name="ptSlab2Amount" value={rules.ptSlab2Amount} onChange={handleChange} className="w-full border rounded p-2 mt-1" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition">Save Changes</button>
            <button onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- TEMPLATE PICKER MODAL ---
const TemplatePickerModal = ({ onSelect, onClose }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOfferLetterTemplates()
      .then(data => setTemplates(data || []))
      .catch(err => console.error('Failed to load templates:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, backdropFilter: 'blur(6px)'
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '32px',
        width: '92%', maxWidth: '700px', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.35)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#1e293b' }}>🖨️ Choose a Letterhead</h2>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>Select a template background for the payslip PDF</p>
          </div>
          <button onClick={onClose} style={{
            background: '#ef4444', border: 'none', color: '#fff',
            width: 36, height: 36, borderRadius: '50%', fontSize: '1.2rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>✕</button>
        </div>

        {/* Template Grid */}
        <div style={{ overflowY: 'auto', flex: 1, marginTop: '18px' }}>
          {loading && (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>Loading templates...</p>
          )}
          {!loading && templates.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 20px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📄</div>
              <p style={{ color: '#64748b', fontSize: '1rem', fontWeight: 600 }}>No templates found</p>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Upload letterhead templates in the Offer Letter section first.</p>
            </div>
          )}
          {!loading && templates.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '16px' }}>
              {templates.map(t => (
                <div
                  key={t._id}
                  onClick={() => onSelect(t)}
                  style={{
                    border: '2px solid #e2e8f0', borderRadius: '14px', padding: '12px',
                    cursor: 'pointer', textAlign: 'center', transition: 'all 0.18s',
                    background: '#f8fafc',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#eef2ff'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    height: 110, background: '#e2e8f0', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '10px', overflow: 'hidden', position: 'relative'
                  }}>
                    {/\.(jpg|jpeg|png)$/i.test(t.templateUrl || '') ? (
                      <img
                        src={`/api/offer-letters/templates/fetch?url=${encodeURIComponent(t.templateUrl)}`}
                        alt={t.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                      />
                    ) : null}
                    <div style={{
                      display: /\.(jpg|jpeg|png)$/i.test(t.templateUrl || '') ? 'none' : 'flex',
                      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      width: '100%', height: '100%'
                    }}>
                      <span style={{ fontSize: '2.5rem' }}>📄</span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>PDF Template</span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.name}
                  </p>
                  {t.companyName && (
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#64748b' }}>{t.companyName}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>Click a template to generate the payslip</p>
          <button onClick={onClose} style={{
            padding: '10px 24px', borderRadius: '10px', border: '1px solid #cbd5e1',
            background: '#f1f5f9', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem'
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ✅ STEP 2: LETTERHEAD PICKER inside Release flow
const LetterheadPickerModal = ({ onSelect, onSkip, selectedIds, periodStart, periodEnd }) => {
  const [templates, setTemplates] = useState([]);
  const [loadingT, setLoadingT] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    getOfferLetterTemplates()
      .then(data => setTemplates(data || []))
      .catch(() => {})
      .finally(() => setLoadingT(false));
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, backdropFilter: 'blur(6px)'
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '32px',
        width: '92%', maxWidth: '680px', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.35)'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#1e293b' }}>🖨️ Select Letterhead</h2>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                Choose a background template for the payslip PDF — <strong>{selectedIds} employee{selectedIds > 1 ? 's' : ''}</strong> • {periodStart} → {periodEnd}
              </p>
            </div>
          </div>
          <div style={{ marginTop: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 14px', fontSize: '0.8rem', color: '#92400e' }}>
            💡 The selected template will be stored with the payslips and displayed to employees on their Pay-Slip page.
          </div>
        </div>

        {/* Grid */}
        <div style={{ overflowY: 'auto', flex: 1, marginTop: '16px' }}>
          {loadingT && <p style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 0' }}>Loading templates...</p>}
          {!loadingT && templates.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📄</div>
              <p style={{ color: '#64748b', fontWeight: 600 }}>No templates found</p>
              <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Upload letterheads in Offer Letter → Template Manager first.</p>
            </div>
          )}
          {!loadingT && templates.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '14px' }}>
              {templates.map(t => {
                const isChosen = selectedTemplate?._id === t._id;
                return (
                  <div
                    key={t._id}
                    onClick={() => setSelectedTemplate(isChosen ? null : t)}
                    style={{
                      border: isChosen ? '2.5px solid #6366f1' : '2px solid #e2e8f0',
                      borderRadius: '14px', padding: '10px',
                      cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                      background: isChosen ? '#eef2ff' : '#f8fafc',
                      boxShadow: isChosen ? '0 6px 20px rgba(99,102,241,0.2)' : 'none',
                      transform: isChosen ? 'translateY(-2px)' : 'none',
                      position: 'relative'
                    }}
                  >
                    {isChosen && (
                      <div style={{ position: 'absolute', top: 8, right: 8, background: '#6366f1', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>✓</div>
                    )}
                    <div style={{ height: 95, background: '#e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', overflow: 'hidden' }}>
                      {/\.(jpg|jpeg|png)$/i.test(t.templateUrl || '') ? (
                        <img src={t.templateUrl} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      ) : <span style={{ fontSize: '2.2rem' }}>📄</span>}
                    </div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</p>
                    {t.companyName && <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: '#64748b' }}>{t.companyName}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
          <button onClick={() => onSkip()} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f1f5f9', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', color: '#475569' }}>Skip (No Template)</button>
          <button
            onClick={() => onSelect(selectedTemplate)}
            disabled={!selectedTemplate}
            style={{
              padding: '10px 28px', borderRadius: '10px', border: 'none',
              background: selectedTemplate ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : '#e2e8f0',
              color: selectedTemplate ? '#fff' : '#94a3b8',
              fontWeight: 700, cursor: selectedTemplate ? 'pointer' : 'not-allowed', fontSize: '0.88rem'
            }}
          >{selectedTemplate ? `✅ Use "${selectedTemplate.name}"` : 'Select a Template'}</button>
        </div>
      </div>
    </div>
  );
};

// ✅ RELEASE PAYSLIP SELECTION MODAL
const ReleasePayslipModal = ({ isOpen, onClose, payrollData, periodStart, periodEnd, onConfirmRelease }) => {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showLetterhead, setShowLetterhead] = useState(false);

  // Reset every time modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      setSearchQuery('');
      setShowLetterhead(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatCurrency = (val) =>
    `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const filteredData = payrollData.filter(emp =>
    emp.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allFilteredSelected =
    filteredData.length > 0 && filteredData.every(emp => selectedIds.has(emp.employeeId));
  const someFilteredSelected =
    filteredData.some(emp => selectedIds.has(emp.employeeId)) && !allFilteredSelected;

  const handleSelectAll = () => {
    const updated = new Set(selectedIds);
    if (allFilteredSelected) {
      filteredData.forEach(emp => updated.delete(emp.employeeId));
    } else {
      filteredData.forEach(emp => updated.add(emp.employeeId));
    }
    setSelectedIds(updated);
  };

  const handleToggle = (empId) => {
    const updated = new Set(selectedIds);
    updated.has(empId) ? updated.delete(empId) : updated.add(empId);
    setSelectedIds(updated);
  };

  const selectedCount = selectedIds.size;

  const totalNetSelected = payrollData
    .filter(emp => selectedIds.has(emp.employeeId))
    .reduce((sum, emp) => sum + emp.netPayableSalary, 0);

  const handleRelease = () => {
    if (selectedCount === 0) {
      Swal.fire({ icon: 'warning', title: 'No Employees Selected', text: 'Please select at least one employee to release the payslip.', confirmButtonColor: '#3b82f6' });
      return;
    }
    // Go to Step 2 — letterhead picker
    setShowLetterhead(true);
  };

  const handleLetterheadSelected = (template) => {
    setShowLetterhead(false);
    onConfirmRelease(payrollData.filter(emp => selectedIds.has(emp.employeeId)), template?.templateUrl || null);
  };

  return (
    <>
      {showLetterhead && (
        <LetterheadPickerModal
          selectedIds={selectedCount}
          periodStart={periodStart}
          periodEnd={periodEnd}
          onSelect={handleLetterheadSelected}
          onSkip={() => handleLetterheadSelected(null)}
        />
      )}

      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white px-6 py-5 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-xl font-bold tracking-tight">🚀 Release Payslips</h2>
              <p className="text-indigo-200 text-sm mt-0.5">
                Step 1 of 2 — Select Employees &nbsp;→&nbsp; {periodStart} → {periodEnd}
              </p>
            </div>
            <button onClick={onClose} className="bg-white/10 hover:bg-white/25 rounded-full p-2 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search + Select All bar */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 shrink-0 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Search by name or ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none transition" />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <div onClick={handleSelectAll} className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${ allFilteredSelected ? 'bg-indigo-600 border-indigo-600' : someFilteredSelected ? 'bg-indigo-100 border-indigo-400' : 'bg-white border-gray-300 group-hover:border-indigo-400' }`}>
                {allFilteredSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                {someFilteredSelected && !allFilteredSelected && <div className="w-2.5 h-0.5 bg-indigo-600 rounded" />}
              </div>
              <span className="text-sm font-semibold text-gray-700">{allFilteredSelected ? 'Deselect All' : 'Select All'}</span>
              <span className="text-xs text-gray-400">({filteredData.length} shown)</span>
            </label>
          </div>

          {/* Employee List */}
          <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
            {filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm font-medium">No employees found</p>
              </div>
            ) : filteredData.map((emp) => {
              const isSelected = selectedIds.has(emp.employeeId);
              return (
                <div key={emp.employeeId} onClick={() => handleToggle(emp.employeeId)}
                  className={`flex items-center gap-4 px-6 py-3.5 cursor-pointer transition-all duration-150 ${ isSelected ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-gray-50 border-l-4 border-transparent' }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${ isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300' }`}>
                    {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all ${ isSelected ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-100 text-gray-600' }`}>
                    {emp.employeeName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{emp.employeeName}</p>
                    <p className="text-xs text-gray-500">{emp.employeeId} &middot; {emp.role}</p>
                  </div>
                  <div className="hidden sm:flex gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">F:{emp.fullDays}</span>
                    <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">H:{emp.halfDays}</span>
                    {emp.lopDays > 0 && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">LOP:{emp.lopDays}</span>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-extrabold ${ isSelected ? 'text-indigo-700' : 'text-gray-700' }`}>{formatCurrency(emp.netPayableSalary)}</p>
                    <p className="text-[10px] text-gray-400">net pay</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-4 border-t border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-4">
              <div className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${ selectedCount > 0 ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-gray-100 text-gray-500 border border-gray-200' }`}>
                {selectedCount === 0 ? 'No employees selected' : `${selectedCount} employee${selectedCount > 1 ? 's' : ''} selected`}
              </div>
              {selectedCount > 0 && (
                <div className="text-right">
                  <p className="text-xs text-gray-500 font-medium">Total Net Payable</p>
                  <p className="text-lg font-extrabold text-indigo-700">{formatCurrency(totalNetSelected)}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleRelease} disabled={selectedCount === 0}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow ${ selectedCount > 0 ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white hover:shadow-lg active:scale-[0.98]' : 'bg-gray-200 text-gray-400 cursor-not-allowed' }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Next: Choose Letterhead →
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// --- PAYSLIP MODAL COMPONENT ---
const PayrollSlipModal = ({ employee, onClose, periodStart, periodEnd }) => {
  const [companyData, setCompanyData] = useState(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // ✅ Fetch company details dynamically — employee.companyId holds emp.company (ObjectId)
  useEffect(() => {
    const fetchCompany = async () => {
      if (!employee.companyId) return; // fallback to companyName snapshot below
      try {
        const res = await api.get(`/api/companies/${employee.companyId}`);
        setCompanyData(res.data);
      } catch (err) {
        console.error("Failed to fetch company data:", err);
      }
    };
    fetchCompany();
  }, [employee.companyId]);

  // ✅ Derive display values from fetched company (fallback to employee fields)
  const companyName = companyData?.name || employee.companyName || "N/A";
  const companyAddress = companyData
    ? [
      companyData.officeLocation?.address,
      companyData.officeLocation?.city,
      companyData.officeLocation?.state,
      companyData.officeLocation?.zipCode,
      companyData.officeLocation?.country
    ].filter(Boolean).join(', ')
    : "";

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  };

  const SIGNATURE_URL = "https://payroll-assets.s3.ap-south-1.amazonaws.com/signature.png";

  const handleExportSingle = () => {
    const exportData = [{
      "Employee ID": employee.employeeId,
      "Name": employee.employeeName,
      "Pay Period": `${periodStart} to ${periodEnd}`,
      "Total Days in Month": employee.totalDaysInMonth,
      "Worked Days": employee.workedDays,
      "Week Off Days (Paid)": employee.weekOffDays,
      "Holiday Days (Paid)": employee.holidayDays,
      "Per Day Salary": employee.perDaySalary,
      "Calculated Salary": employee.calculatedSalary,
      "Total Earnings": employee.breakdown.gross,
      "PF Employee": employee.breakdown.pf,
      "PF Employer": employee.breakdown.employerPf,
      "PT Deduction": employee.breakdown.pt,
      "LOP Deduction": employee.lopDeduction,
      "Late Deduction": employee.lateDeduction,
      "Total Deductions": employee.totalDeductions,
      "Net Payable": employee.netPayableSalary
    }];
    exportToExcel(exportData, `Payslip_${employee.employeeName}_${periodStart}`);
  };

  // Builds the raw payslip HTML (used both for print and PDF)
  const buildPayslipHTML = useCallback((pfLabel, employerPfLabel) => {
    return `
      <div style="font-family:'Arial',sans-serif;color:#000;font-size:13px;line-height:1.5;">
        <div style="display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:16px;">
          <div>
            <div style="font-size:18px;font-weight:bold;text-transform:uppercase;color:#1e3a8a;">${companyName}</div>
            <div style="font-size:11px;color:#555;">${companyAddress}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:16px;font-weight:bold;">PAYSLIP</div>
            <div style="font-size:11px;">${new Date(periodStart).toLocaleDateString()} – ${new Date(periodEnd).toLocaleDateString()}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
          <tr><td style="background:#f1f5f9;font-weight:bold;padding:5px 7px;border:1px solid #ddd;">Name</td><td style="padding:5px 7px;border:1px solid #ddd;">${employee.employeeName}</td><td style="background:#f1f5f9;font-weight:bold;padding:5px 7px;border:1px solid #ddd;">Emp ID</td><td style="padding:5px 7px;border:1px solid #ddd;">${employee.employeeId}</td></tr>
          <tr><td style="background:#f1f5f9;font-weight:bold;padding:5px 7px;border:1px solid #ddd;">Designation</td><td style="padding:5px 7px;border:1px solid #ddd;">${employee.role}</td><td style="background:#f1f5f9;font-weight:bold;padding:5px 7px;border:1px solid #ddd;">Work Summary</td><td style="padding:5px 7px;border:1px solid #ddd;">Full:${employee.fullDays} | Half:${employee.halfDays} | WeekOff:${employee.weekOffDays} | Hol:${employee.holidayDays}</td></tr>
          <tr><td style="background:#f1f5f9;font-weight:bold;padding:5px 7px;border:1px solid #ddd;">Total Days in Month</td><td style="padding:5px 7px;border:1px solid #ddd;">${employee.totalDaysInMonth}</td><td style="background:#f1f5f9;font-weight:bold;padding:5px 7px;border:1px solid #ddd;">Worked Days</td><td style="padding:5px 7px;border:1px solid #ddd;">${employee.workedDays}</td></tr>
          <tr><td style="background:#f1f5f9;font-weight:bold;padding:5px 7px;border:1px solid #ddd;">Per Day Salary</td><td style="padding:5px 7px;border:1px solid #ddd;">${formatCurrency(employee.perDaySalary)}</td><td style="background:#f1f5f9;font-weight:bold;padding:5px 7px;border:1px solid #ddd;">Calculated Salary</td><td style="padding:5px 7px;border:1px solid #ddd;">${formatCurrency(employee.calculatedSalary)}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
          <tr style="background:#f1f5f9;font-weight:bold;"><th style="padding:6px 7px;border:1px solid #ddd;text-align:left;width:38%;">EARNINGS</th><th style="padding:6px 7px;border:1px solid #ddd;text-align:right;width:12%;">AMOUNT</th><th style="padding:6px 7px;border:1px solid #ddd;text-align:left;width:38%;">DEDUCTIONS</th><th style="padding:6px 7px;border:1px solid #ddd;text-align:right;width:12%;">AMOUNT</th></tr>
          <tr><td style="padding:5px 7px;border:1px solid #ddd;">Basic Salary</td><td style="padding:5px 7px;border:1px solid #ddd;text-align:right;">${formatCurrency(employee.monthlyBreakdown.basic)}</td><td style="padding:5px 7px;border:1px solid #ddd;">${pfLabel}</td><td style="padding:5px 7px;border:1px solid #ddd;text-align:right;">${formatCurrency(employee.breakdown.pf)}</td></tr>
          <tr><td style="padding:5px 7px;border:1px solid #ddd;">HRA</td><td style="padding:5px 7px;border:1px solid #ddd;text-align:right;">${formatCurrency(employee.monthlyBreakdown.hra)}</td><td style="padding:5px 7px;border:1px solid #ddd;">${employerPfLabel}</td><td style="padding:5px 7px;border:1px solid #ddd;text-align:right;">${formatCurrency(employee.breakdown.employerPf)}</td></tr>
          <tr><td style="padding:5px 7px;border:1px solid #ddd;">Conveyance</td><td style="padding:5px 7px;border:1px solid #ddd;text-align:right;">${formatCurrency(employee.monthlyBreakdown.conveyance)}</td><td style="padding:5px 7px;border:1px solid #ddd;">Professional Tax</td><td style="padding:5px 7px;border:1px solid #ddd;text-align:right;">${formatCurrency(employee.breakdown.pt)}</td></tr>
          <tr><td style="padding:5px 7px;border:1px solid #ddd;">Medical</td><td style="padding:5px 7px;border:1px solid #ddd;text-align:right;">${formatCurrency(employee.monthlyBreakdown.medical)}</td><td style="padding:5px 7px;border:1px solid #ddd;">LOP Deduction (${employee.lopDays} days)</td><td style="padding:5px 7px;border:1px solid #ddd;text-align:right;">${formatCurrency(employee.lopDeduction)}</td></tr>
          <tr><td style="padding:5px 7px;border:1px solid #ddd;">Travelling Allowance</td><td style="padding:5px 7px;border:1px solid #ddd;text-align:right;">${formatCurrency(employee.monthlyBreakdown.travellingAllowance)}</td><td style="padding:5px 7px;border:1px solid #ddd;">Late Penalty (${employee.latePenaltyDays} half days)</td><td style="padding:5px 7px;border:1px solid #ddd;text-align:right;">${formatCurrency(employee.lateDeduction)}</td></tr>
          <tr><td style="padding:5px 7px;border:1px solid #ddd;">Other Allowance</td><td style="padding:5px 7px;border:1px solid #ddd;text-align:right;">${formatCurrency(employee.monthlyBreakdown.otherAllowance)}</td><td style="padding:5px 7px;border:1px solid #ddd;"></td><td style="padding:5px 7px;border:1px solid #ddd;"></td></tr>
          <tr><td style="padding:5px 7px;border:1px solid #ddd;">Special</td><td style="padding:5px 7px;border:1px solid #ddd;text-align:right;">${formatCurrency(employee.monthlyBreakdown.special)}</td><td style="padding:5px 7px;border:1px solid #ddd;"></td><td style="padding:5px 7px;border:1px solid #ddd;"></td></tr>
          <tr style="background:#eff6ff;font-weight:bold;"><td style="padding:6px 7px;border:1px solid #ddd;">GROSS EARNINGS</td><td style="padding:6px 7px;border:1px solid #ddd;text-align:right;">${formatCurrency(employee.breakdown.gross)}</td><td style="padding:6px 7px;border:1px solid #ddd;">TOTAL DEDUCTIONS</td><td style="padding:6px 7px;border:1px solid #ddd;text-align:right;">${formatCurrency(employee.totalDeductions)}</td></tr>
        </table>
    <div style="padding:10px 14px;text-align:center;font-weight:bold;font-size:15px;border-radius:4px;color:#000;">NET SALARY PAYABLE: ${formatCurrency(employee.netPayableSalary)}
</div>

<div style="margin-top:36px;text-align:right;padding-right:20px;">
          <img src="${SIGNATURE_URL}" height="45" style="display:block;margin-left:auto;margin-bottom:4px;" />
          <span style="font-size:12px;color:#333;">Authorized Signatory</span>
        </div>
      </div>
    `;
  }, [employee, companyName, companyAddress, periodStart, periodEnd]);

  // Plain print (no template — opens browser print dialog as before)
  const downloadPayslip = () => {
    const pfLabel = employee.appliedRules.pfCalculationMethod === 'fixed' ? 'Employee PF (Fixed)' : `Employee PF (${employee.appliedRules.pfPercentage}%)`;
    const employerPfLabel = employee.appliedRules.pfCalculationMethod === 'fixed' ? 'Employer PF (Fixed)' : `Employer PF (${employee.appliedRules.employerPfPercentage}%)`;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Payslip - ${employee.employeeName}</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Arial',sans-serif;padding:24px;}</style></head><body>${buildPayslipHTML(pfLabel, employerPfLabel)}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  // Template-based PDF generation
  const handleTemplateSelected = async (template) => {
    setShowTemplatePicker(false);
    setGeneratingPdf(true);
    try {
      const { generateOfferLetterPdf } = await import('../utils/offerLetterPdfGenerator');
      const pfLabel = employee.appliedRules.pfCalculationMethod === 'fixed' ? 'Employee PF (Fixed)' : `Employee PF (${employee.appliedRules.pfPercentage}%)`;
      const employerPfLabel = employee.appliedRules.pfCalculationMethod === 'fixed' ? 'Employer PF (Fixed)' : `Employer PF (${employee.appliedRules.employerPfPercentage}%)`;
      const htmlContent = buildPayslipHTML(pfLabel, employerPfLabel);
      const dataUri = await generateOfferLetterPdf(htmlContent, template.templateUrl);

      // Open PDF in new tab for printing/saving
      const win = window.open('', '_blank');
      win.document.write(`<!DOCTYPE html><html><head><title>Payslip – ${employee.employeeName}</title><style>*{margin:0;padding:0;}body{background:#525659;display:flex;justify-content:center;}iframe{width:100vw;height:100vh;border:none;}</style></head><body><iframe src="${dataUri}" /></body></html>`);
      win.document.close();
    } catch (err) {
      console.error('Template payslip generation failed:', err);
      Swal.fire('Error', 'Could not generate the payslip with the selected template.', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-fadeIn">
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 sticky top-0 z-10 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-wide">Payslip Detail</h2>
            <p className="text-blue-100 text-sm">{employee.employeeName} ({employee.employeeId})</p>
            <p className="text-blue-200 text-xs mt-0.5 font-medium">{companyName}{companyAddress ? ` · ${companyAddress}` : ''}</p>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition"><span className="text-2xl">×</span></button>
        </div>

        <div className="p-8 space-y-6">

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gray-50 p-4 rounded-xl text-center border">
              <p className="text-xs text-gray-500 font-bold uppercase">Work Summary</p>
              <div className="flex justify-center gap-1 mt-1 flex-wrap">
                <span className="text-xs font-bold bg-green-200 text-green-800 px-2 py-1 rounded">Full: {employee.fullDays}</span>
                <span className="text-xs font-bold bg-yellow-200 text-yellow-800 px-2 py-1 rounded">Half: {employee.halfDays}</span>
                <span className="text-xs font-bold bg-blue-200 text-blue-800 px-2 py-1 rounded">Off: {employee.weekOffDays}</span>
                <span className="text-xs font-bold bg-emerald-200 text-emerald-800 px-2 py-1 rounded">Hol: {employee.holidayDays}</span>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl text-center border border-blue-100">
              <p className="text-xs text-blue-600 font-bold uppercase">Month Days</p>
              <p className="text-xl font-extrabold text-blue-900">{employee.totalDaysInMonth}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl text-center border border-purple-100">
              <p className="text-xs text-purple-600 font-bold uppercase">Worked Days</p>
              <p className="text-xl font-extrabold text-purple-900">{employee.workedDays}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-xl text-center border border-green-100">
              <p className="text-xs text-green-600 font-bold uppercase">Gross Salary</p>
              <p className="text-xl font-extrabold text-green-900">{formatCurrency(employee.breakdown.gross)}</p>
            </div>
            <div className="bg-indigo-50 p-4 rounded-xl text-center border border-indigo-100">
              <p className="text-xs text-indigo-600 font-bold uppercase">Net Pay</p>
              <p className="text-xl font-extrabold text-indigo-900">{formatCurrency(employee.netPayableSalary)}</p>
            </div>
          </div>

          {/* Calculation Breakdown */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-bold text-blue-800 text-sm mb-3">📊 Salary Calculation Breakdown</h4>
            {/* ✅ Week Off + Holiday badges */}
            <div className="flex gap-2 mb-3 flex-wrap">
              <span className="text-[11px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                📅 Week Offs (rest): {employee.weekOffDays} days (paid)
              </span>
              <span className="text-[11px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">
                🎉 Holidays (rest): {employee.holidayDays} days (paid)
              </span>
              <span className="text-[11px] text-gray-500 px-2 py-0.5 rounded border border-gray-200 bg-gray-50 italic">
                * If worked on off/holiday → counted in Worked Days only
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="bg-white p-3 rounded border">
                <p className="text-gray-600 text-xs">Gross Salary ÷ Total Days in Month</p>
                <p className="font-bold text-gray-800">{formatCurrency(employee.breakdown.gross)} ÷ {employee.totalDaysInMonth} = {formatCurrency(employee.perDaySalary)}/day</p>
              </div>
              <div className="bg-white p-3 rounded border">
                <p className="text-gray-600 text-xs">(Worked Days + Week Offs + Holidays) × Per Day Salary</p>
                <p className="font-bold text-gray-800">
                  ({employee.workedDays} + <span className="text-blue-600">{employee.weekOffDays}</span> + <span className="text-green-600">{employee.holidayDays}</span>) × {formatCurrency(employee.perDaySalary)} = {formatCurrency(employee.calculatedSalary)}
                </p>
              </div>
              <div className="bg-white p-3 rounded border">
                <p className="text-gray-600 text-xs">LOP Deduction ({employee.lopDays} days)</p>
                <p className="font-bold text-red-700">{employee.lopDays} × {formatCurrency(employee.perDaySalary)} = -{formatCurrency(employee.lopDeduction)}</p>
              </div>
              <div className="bg-white p-3 rounded border">
                <p className="text-gray-600 text-xs">Late Penalty ({employee.lateDaysCount} late → {employee.latePenaltyDays} half days)</p>
                <p className="font-bold text-red-700">{employee.latePenaltyDays} × {formatCurrency(employee.perDaySalary)} = -{formatCurrency(employee.lateDeduction)}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-8">
            {/* EARNINGS */}
            <div className="flex-1">
              <h3 className="text-lg font-bold text-green-700 mb-3 border-b pb-2">Earnings</h3>
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b">
                  <tr>
                    <th className="text-left py-2">Component</th>
                    <th className="text-right py-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-2">Basic Salary</td>
                    <td className="text-right font-medium">{formatCurrency(employee.monthlyBreakdown.basic)}</td>
                  </tr>
                  <tr>
                    <td className="py-2">HRA</td>
                    <td className="text-right font-medium">{formatCurrency(employee.monthlyBreakdown.hra)}</td>
                  </tr>
                  <tr>
                    <td className="py-2">Conveyance</td>
                    <td className="text-right font-medium">{formatCurrency(employee.monthlyBreakdown.conveyance)}</td>
                  </tr>
                  <tr>
                    <td className="py-2">Medical</td>
                    <td className="text-right font-medium">{formatCurrency(employee.monthlyBreakdown.medical)}</td>
                  </tr>
                  <tr>
                    <td className="py-2">Travelling Allowance</td>
                    <td className="text-right font-medium">{formatCurrency(employee.monthlyBreakdown.travellingAllowance)}</td>
                  </tr>
                  <tr>
                    <td className="py-2">Other Allowance</td>
                    <td className="text-right font-medium">{formatCurrency(employee.monthlyBreakdown.otherAllowance)}</td>
                  </tr>
                  <tr>
                    <td className="py-2">Special</td>
                    <td className="text-right font-medium">{formatCurrency(employee.monthlyBreakdown.special)}</td>
                  </tr>
                  <tr className="bg-green-50">
                    <td className="py-2 font-bold">Gross Total</td>
                    <td className="text-right font-bold text-green-800">{formatCurrency(employee.breakdown.gross)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* DEDUCTIONS */}
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-700 mb-3 border-b pb-2">Deductions</h3>
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b">
                  <tr>
                    <th className="text-left py-2">Component</th>
                    <th className="text-right py-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-2">
                      {employee.appliedRules.pfCalculationMethod === 'fixed'
                        ? 'Employee PF (Fixed)'
                        : `Employee PF (${employee.appliedRules.pfPercentage}%)`}
                    </td>
                    <td className="text-right font-medium text-red-600">{formatCurrency(employee.breakdown.pf)}</td>
                  </tr>
                  <tr>
                    <td className="py-2">
                      {employee.appliedRules.pfCalculationMethod === 'fixed'
                        ? 'Employer PF (Fixed)'
                        : `Employer PF (${employee.appliedRules.employerPfPercentage}%)`}
                    </td>
                    <td className="text-right font-medium text-red-600">{formatCurrency(employee.breakdown.employerPf)}</td>
                  </tr>
                  <tr><td className="py-2">Professional Tax</td><td className="text-right font-medium text-red-600">{formatCurrency(employee.breakdown.pt)}</td></tr>
                  <tr><td className="py-2">LOP Deduction ({employee.lopDays} days)</td><td className="text-right font-medium text-red-600">{formatCurrency(employee.lopDeduction)}</td></tr>
                  <tr><td className="py-2">Late Penalty ({employee.latePenaltyDays} half days)</td><td className="text-right font-medium text-red-600">{formatCurrency(employee.lateDeduction)}</td></tr>
                  <tr className="bg-red-50"><td className="py-2 font-bold">Total Deductions</td><td className="text-right font-bold text-red-700">{formatCurrency(employee.totalDeductions)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gray-800 text-white p-4 rounded-lg flex justify-between items-center text-lg shadow-lg">
            <span className="font-bold">NET SALARY PAYABLE</span>
            <span className="font-extrabold text-2xl">{formatCurrency(employee.netPayableSalary)}</span>
          </div>

          <div className="flex gap-4 pt-4">
            {/* Plain Print */}
            <button
              onClick={downloadPayslip}
              className="flex-1 bg-gray-700 hover:bg-gray-800 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition text-sm"
            >🖨️ Print (Plain)</button>
            {/* Template-layered PDF */}
            <button
              onClick={() => setShowTemplatePicker(true)}
              disabled={generatingPdf}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition text-sm disabled:opacity-60"
            >{generatingPdf ? '⏳ Generating...' : '🖨️ Print with Letterhead'}</button>
            <button onClick={handleExportSingle} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition">📊 Export Excel</button>
            <button onClick={onClose} className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold text-gray-700">Close</button>
          </div>

          {/* Template picker popup */}
          {showTemplatePicker && (
            <TemplatePickerModal
              onSelect={handleTemplateSelected}
              onClose={() => setShowTemplatePicker(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const PayrollManagement = () => {
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  // ✅ NEW: Release modal state
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [payrollRules, setPayrollRules] = useState(DEFAULT_RULES);
  const [saving, setSaving] = useState(false); // Loading state for saving

  // ✅ MONTH SELECTION LOGIC
  const today = new Date();
  const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth);

  // Generate date range based on selected month
  const dateRange = useMemo(() => getDateRangeFromMonth(selectedMonth), [selectedMonth]);
  const summaryStartDate = dateRange.startDate;
  const summaryEndDate = dateRange.endDate;

  const [searchQuery, setSearchQuery] = useState("");

  const [allEmployees, setAllEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [shifts, setShifts] = useState([]);

  // Generate available months (last 12 months including current)
  const availableMonths = useMemo(() => {
    const months = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      months.push({ value: yearMonth, label: monthName });
    }
    return months;
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        try {
          const res = await getPayrollRules();
          const fetchedData = res?.data || res;
          if (fetchedData && typeof fetchedData.basicPercentage !== 'undefined') {
            setPayrollRules(fetchedData);
          }
        } catch (e) { console.error("Rules fetch error", e); }

        const [leavesRes, empRes, attRes, holidayRes, shiftRes] = await Promise.all([
          getLeaveRequests(),
          getEmployees(),
          getAttendanceByDateRange(summaryStartDate, summaryEndDate),
          getHolidays(),
          getAllShifts()
        ]);

        // ✅ FILTER: Only include active AND Full Time employees in payroll
        let activeEmps = (Array.isArray(empRes) ? empRes : empRes.data).filter(e => e.isActive !== false);

        // ✅ ADDED: Filter to only include Full Time employees
        activeEmps = activeEmps.filter(emp => {
          const employmentType = getCurrentEmploymentType(emp);
          return employmentType === "Full-Time";
        });

        setLeaveRequests(leavesRes || []);
        setAllEmployees(activeEmps);
        setAttendanceData(attRes || []);
        setHolidays((holidayRes || []).map(h => ({
          ...h,
          start: normalizeDate(h.startDate),
          end: normalizeDate(h.endDate || h.startDate)
        })));
        setShifts(Array.isArray(shiftRes) ? shiftRes : shiftRes.data || []);

      } catch (error) {
        console.error("Error loading payroll data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [summaryStartDate, summaryEndDate]);

  const handleSaveRules = async (newRules) => {
    try {
      await savePayrollRules(newRules);
      setPayrollRules(newRules);
      Swal.fire('Success', 'Rules updated', 'success');
    } catch (e) {
      Swal.fire('Error', 'Failed to save rules', 'error');
    }
  };

  // ✅ CORE PAYROLL CALCULATION (UPDATED WITH NEW PF LOGIC)
  const processedPayroll = useMemo(() => {
    if (!allEmployees.length) return [];

    const shiftMap = {};
    shifts.forEach(s => {
      shiftMap[s.employeeId] = {
        weeklyOffDays: s.weeklyOffDays || [0],
        fullDayHours: s.fullDayHours || 9,
        halfDayHours: s.halfDayHours || 4.5,
        shiftStartTime: s.shiftStartTime,
        lateGracePeriod: s.lateGracePeriod || 15
      };
    });

    const attSummary = {};
    attendanceData.forEach(rec => {
      if (!attSummary[rec.employeeId]) {
        attSummary[rec.employeeId] = {
          fullDays: 0, halfDays: 0, workedDays: 0, lateCount: 0, absentDays: 0
        };
      }
      const shift = shiftMap[rec.employeeId];
      const status = getWorkedStatus(rec.punchIn, rec.punchOut, rec.status, shift?.fullDayHours, shift?.halfDayHours);

      if (status === "Full Day") {
        attSummary[rec.employeeId].fullDays++;
        attSummary[rec.employeeId].workedDays += 1;
      } else if (status === "Half Day") {
        attSummary[rec.employeeId].halfDays++;
        attSummary[rec.employeeId].workedDays += 0.5;
      } else if (status === "Leave") {
        attSummary[rec.employeeId].workedDays += 1;
      } else if (status.includes("Absent")) {
        attSummary[rec.employeeId].absentDays++;
      }

      const loginStatus = calculateLoginStatus(rec.punchIn, shift, rec.loginStatus);
      if (loginStatus === "LATE") attSummary[rec.employeeId].lateCount++;
    });

    const leaveSummary = {};
    allEmployees.forEach(emp => {
      const empId = emp.employeeId;
      const shift = shiftMap[empId] || { weeklyOffDays: [0] };

      const approvedLeaves = leaveRequests.filter(l =>
        l.employeeId === empId && l.status === "Approved" &&
        (isDateInRange(l.from, summaryStartDate, summaryEndDate) || isDateInRange(l.to, summaryStartDate, summaryEndDate))
      );

      const totalLeaveDays = approvedLeaves.reduce((total, l) => total + calculateLeaveDays(l.from, l.to), 0);

      const attendancePunches = new Set(attendanceData.filter(r => r.employeeId === empId && r.punchIn).map(r => formatDate(r.date)));
      const appliedLeaveDates = new Set();
      approvedLeaves.forEach(l => {
        let c = new Date(l.from);
        const e = new Date(l.to);
        while (c <= e) { appliedLeaveDates.add(formatDate(c)); c = addDays(c, 1); }
      });

      let absentCount = 0;
      let loopStart = new Date(summaryStartDate);
      let loopEnd = new Date(summaryEndDate);
      for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(d);
        const dayOfWeek = d.getDay();
        const isHol = holidays.some(h => dateStr >= formatDate(h.start) && dateStr <= formatDate(h.end));

        if (isHol || shift.weeklyOffDays.includes(dayOfWeek)) continue;
        if (attendancePunches.has(dateStr) || appliedLeaveDates.has(dateStr)) continue;
        absentCount++;
      }

      const monthlyCredit = 1;
      const totalConsumed = totalLeaveDays + absentCount;
      const extraLeaves = Math.max(0, totalConsumed - monthlyCredit);
      const paidLeaveCredit = Math.min(totalConsumed, monthlyCredit);

      // ✅ COUNT WEEK-OFF & HOLIDAY DAYS — NO DOUBLE COUNT
      const todayNow = new Date();
      todayNow.setHours(23, 59, 59, 999);

      let weekOffCount = 0;
      let holidayCount = 0;
      for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
        if (d > todayNow) break;

        const dateStr = formatDate(d);
        const dayOfWeek = d.getDay();
        const isHol = holidays.some(h => dateStr >= formatDate(h.start) && dateStr <= formatDate(h.end));
        const isWeekOff = shift.weeklyOffDays.includes(dayOfWeek);

        if (!isHol && !isWeekOff) continue;
        if (attendancePunches.has(dateStr)) continue;

        if (isHol) {
          holidayCount++;
        } else {
          weekOffCount++;
        }
      }

      leaveSummary[empId] = { totalLeaveDays, absentDays: absentCount, totalConsumed, extraLeaves, paidLeaveCredit, weekOffDays: weekOffCount, holidayDays: holidayCount };
    });

    return allEmployees.map(emp => {
      const currentExp = Array.isArray(emp.experienceDetails) ? emp.experienceDetails.find((exp) => exp.lastWorkingDate === "Present") : null;
      const baseSalary = currentExp?.salary ? Number(currentExp.salary) : 0;
      const shift = shiftMap[emp.employeeId] || { weeklyOffDays: [0] };

      const endDate = new Date(summaryEndDate);
      const totalDaysInMonth = getTotalDaysInMonth(endDate.getFullYear(), endDate.getMonth() + 1);

      const att = attSummary[emp.employeeId] || { fullDays: 0, halfDays: 0, workedDays: 0, lateCount: 0, absentDays: 0 };
      const leaves = leaveSummary[emp.employeeId] || { totalLeaveDays: 0, absentDays: 0, paidLeaveCredit: 0, extraLeaves: 0 };

      const ruleBasic = Number(payrollRules.basicPercentage) || 0;
      const ruleHra = Number(payrollRules.hraPercentage) || 0;
      const ruleConv = Number(payrollRules.conveyance) || 0;
      const ruleMed = Number(payrollRules.medical) || 0;
      const ruleTravelling = Number(payrollRules.travellingAllowance) || 0;
      const ruleOther = Number(payrollRules.otherAllowance) || 0;

      const rulePtSlab1Amount = Number(payrollRules.ptSlab1Amount) || 0;
      const rulePtSlab2Amount = Number(payrollRules.ptSlab2Amount) || 0;
      const thresholdSlab1 = 15000;
      const thresholdSlab2 = 20000;

      const monthlyTotal = baseSalary;
      const monthlyBasic = monthlyTotal * (ruleBasic / 100);
      const monthlyHRA = monthlyBasic * (ruleHra / 100);
      const monthlyConv = ruleConv;
      const monthlyMed = ruleMed;
      const monthlyTravelling = ruleTravelling;
      const monthlyOther = ruleOther;
      const monthlySpecial = Math.max(0, monthlyTotal - (monthlyBasic + monthlyHRA + monthlyConv + monthlyMed + monthlyTravelling + monthlyOther));

      const perDaySalary = monthlyTotal / totalDaysInMonth;
      const totalWorkedDays = att.workedDays + leaves.paidLeaveCredit;
      const weekOffDays = leaves.weekOffDays || 0;
      const holidayDays = leaves.holidayDays || 0;
      const calculatedSalary = (totalWorkedDays + weekOffDays + holidayDays) * perDaySalary;
      const lopDeduction = leaves.extraLeaves * perDaySalary;
      const latePenaltyDays = Math.floor(att.lateCount / 3) * 0.5;
      const lateDeduction = latePenaltyDays * perDaySalary;

      let pfDeduction = 0;
      let employerPfAmount = 0;
      if (payrollRules.pfCalculationMethod === 'fixed') {
        pfDeduction = Number(payrollRules.pfFixedAmountEmployee) || 0;
        employerPfAmount = Number(payrollRules.pfFixedAmountEmployer) || 0;
      } else {
        const rulePf = Number(payrollRules.pfPercentage) || 0;
        const ruleEmployerPf = Number(payrollRules.employerPfPercentage) || 0;
        pfDeduction = monthlyBasic * (rulePf / 100);
        employerPfAmount = monthlyBasic * (ruleEmployerPf / 100);
      }

      let ptDeduction = 0;
      if (monthlyTotal >= thresholdSlab2) {
        ptDeduction = rulePtSlab2Amount;
      } else if (monthlyTotal >= thresholdSlab1) {
        ptDeduction = rulePtSlab1Amount;
      }

      const totalDeductions = pfDeduction + employerPfAmount + ptDeduction + lopDeduction + lateDeduction;
      const netPayableSalary = Math.max(0, calculatedSalary - totalDeductions);

      return {
        employeeId: emp.employeeId,
        employeeName: emp.name,
        companyId: emp.company || null,
        companyName: emp.companyName || null,
        role: currentExp?.role || "N/A",
        totalDaysInMonth,
        workedDays: totalWorkedDays,
        weekOffDays,
        holidayDays,
        fullDays: att.fullDays,
        halfDays: att.halfDays,
        absentDays: leaves.absentDays,
        totalLeavesConsumed: leaves.totalLeaveDays,
        lopDays: leaves.extraLeaves,
        lateDaysCount: att.lateCount,
        latePenaltyDays,
        perDaySalary,
        calculatedSalary,
        appliedRules: payrollRules,
        monthlyBreakdown: {
          basic: monthlyBasic,
          hra: monthlyHRA,
          conveyance: monthlyConv,
          medical: monthlyMed,
          travellingAllowance: monthlyTravelling,
          otherAllowance: monthlyOther,
          special: monthlySpecial,
          total: monthlyTotal
        },
        breakdown: {
          basic: monthlyBasic,
          hra: monthlyHRA,
          conveyance: monthlyConv,
          medical: monthlyMed,
          travellingAllowance: monthlyTravelling,
          otherAllowance: monthlyOther,
          special: monthlySpecial,
          gross: monthlyTotal,
          pf: pfDeduction,
          employerPf: employerPfAmount,
          pt: ptDeduction
        },
        lopDeduction,
        lateDeduction,
        totalDeductions,
        netPayableSalary
      };
    });
  }, [allEmployees, shifts, attendanceData, leaveRequests, holidays, summaryStartDate, summaryEndDate, payrollRules]);

  const filteredPayroll = useMemo(() => {
    if (!searchQuery.trim()) return processedPayroll;
    const query = searchQuery.toLowerCase();
    return processedPayroll.filter(emp => emp.employeeId.toLowerCase().includes(query) || emp.employeeName.toLowerCase().includes(query));
  }, [processedPayroll, searchQuery]);

  const totals = useMemo(() => {
    return filteredPayroll.reduce((acc, curr) => ({
      gross: acc.gross + curr.breakdown.gross,
      deductions: acc.deductions + curr.totalDeductions,
      net: acc.net + curr.netPayableSalary
    }), { gross: 0, deductions: 0, net: 0 });
  }, [filteredPayroll]);

  const formatCurrency = (val) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleExportAll = () => {
    const dataToExport = filteredPayroll.map(emp => ({
      "ID": emp.employeeId,
      "Name": emp.employeeName,
      "Total Days in Month": emp.totalDaysInMonth,
      "Worked Days": emp.workedDays,
      "Week Off Days (Paid)": emp.weekOffDays,
      "Holiday Days (Paid)": emp.holidayDays,
      "Per Day Salary": emp.perDaySalary.toFixed(2),
      "Calculated Salary": emp.calculatedSalary.toFixed(2),
      "Total Earnings": emp.breakdown.gross,
      "Full Days": emp.fullDays,
      "Half Days": emp.halfDays,
      "Leaves & Absent": emp.totalLeavesConsumed + emp.absentDays,
      "LOP Days": emp.lopDays,
      "Late Count": emp.lateDaysCount,
      "Late Penalty Days": emp.latePenaltyDays,
      "Employer PF": emp.breakdown.employerPf,
      "Employee PF": emp.breakdown.pf,
      "PT": emp.breakdown.pt,
      "LOP Deduction": emp.lopDeduction,
      "Late Deduction": emp.lateDeduction,
      "Total Deductions": emp.totalDeductions,
      "Net Payable": emp.netPayableSalary
    }));
    exportToExcel(dataToExport, `Payroll_Report_${summaryStartDate}_to_${summaryEndDate}`);
  };

  // ✅ UPDATED: Open release modal instead of direct save
  const handleOpenReleaseModal = () => {
    if (filteredPayroll.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No Data',
        text: 'There is no payroll data to release.',
        confirmButtonColor: '#3b82f6',
      });
      return;
    }
    setShowReleaseModal(true);
  };

  // ✅ Confirm release: selectedRecords = employees, templateUrl = chosen letterhead (or null)
  const handleConfirmRelease = async (selectedRecords, templateUrl) => {
    setShowReleaseModal(false);

    // SweetAlert2 confirmation
    const confirmResult = await Swal.fire({
      title: 'Release Payslips?',
      html: `
        <div style="text-align:left;font-size:14px;color:#374151;">
          <p style="margin-bottom:10px;">You are about to release payslips for:</p>
          <div style="background:#EEF2FF;border-radius:8px;padding:12px;margin-bottom:10px;">
            <strong style="font-size:22px;color:#4338CA;">${selectedRecords.length}</strong>
            <span style="color:#4338CA;font-weight:600;"> Employee${selectedRecords.length > 1 ? 's' : ''}</span>
          </div>
          ${templateUrl ? `<p style="color:#059669;font-size:12px;">🖨️ Template: <strong>${templateUrl.split('/').pop()}</strong></p>` : '<p style="color:#9CA3AF;font-size:12px;">No letterhead selected</p>'}
          <p style="color:#6B7280;font-size:12px;margin-top:6px;">Period: <strong>${summaryStartDate}</strong> → <strong>${summaryEndDate}</strong></p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4338CA',
      cancelButtonColor: '#9CA3AF',
      confirmButtonText: '✅ Yes, Release!',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
    });

    if (!confirmResult.isConfirmed) return;

    Swal.fire({
      title: 'Releasing Payslips...',
      html: `<p style="color:#6B7280;font-size:14px;">Saving records for <strong>${selectedRecords.length} employee${selectedRecords.length > 1 ? 's' : ''}</strong>. Please wait.</p>`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => { Swal.showLoading(); },
    });

    setSaving(true);
    try {
      const payload = {
        period: { start: summaryStartDate, end: summaryEndDate },
        records: selectedRecords,
        templateUrl: templateUrl || null,   // ✅ Persist chosen letterhead
      };

      await api.post('/api/payroll/save-batch', payload);

      Swal.fire({
        icon: 'success',
        title: '🎉 Payslips Released!',
        html: `
          <div style="text-align:center;">
            <p style="color:#374151;font-size:14px;margin-bottom:8px;">Successfully released payslips for</p>
            <strong style="font-size:20px;color:#059669;">${selectedRecords.length} employee${selectedRecords.length > 1 ? 's' : ''}</strong>
            <p style="color:#9CA3AF;font-size:12px;margin-top:8px;">Period: ${summaryStartDate} → ${summaryEndDate}</p>
          </div>
        `,
        confirmButtonColor: '#059669',
        confirmButtonText: 'Great!',
      });
    } catch (error) {
      console.error("Save Error:", error);
      Swal.fire({
        icon: 'error',
        title: 'Release Failed',
        text: 'Failed to save payroll records. Please try again.',
        confirmButtonColor: '#DC2626',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen bg-gray-50"><div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div></div>;

  return (
    <div className="min-h-screen p-6 font-sans">
      <div className="max-w-[1800px] mx-auto">

        {/* ✅ HEADER UI */}
        {/* ✅ MODERN DYNAMIC HEADER UI - REFINED */}
        <div className="mb-8 bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden transition-all duration-300">

          {/* Top Header Section with Gradient Accent */}
          <div className="relative px-6 pt-6 pb-4 bg-gradient-to-r from-gray-50 via-white to-gray-50/30 border-b border-gray-200/60">
            {/* Decorative accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600"></div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 rounded-xl shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Payroll Management
                  </h1>
                  <p className="text-sm text-gray-500 mt-0.5">Manage employee salaries & payroll rules</p>
                </div>
              </div>

              {/* Month and Date Range - Desktop */}
              <div className="hidden sm:flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/50 rounded-xl border border-blue-100">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">
                    {summaryStartDate} - {summaryEndDate}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar - All controls in one cohesive row */}
          <div className="px-6 py-4 bg-white flex flex-wrap items-center justify-between gap-4">

            {/* Left: Search & Filters */}
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[200px]">
              {/* Search Box */}
              <div className="relative group flex-1 min-w-[180px] sm:max-w-[260px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by ID or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 hover:bg-white hover:border-gray-300"
                />
              </div>

              {/* Month Selector */}
              <div className="relative">
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/80 hover:bg-gray-100 rounded-xl border border-gray-200 transition-all duration-200 cursor-pointer group-focus-within:ring-2 group-focus-within:ring-blue-500">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="bg-transparent border-none p-0 text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer appearance-none pr-6"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0 center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25rem' }}
                  >
                    {availableMonths.map(month => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mobile Date Range */}
              <div className="sm:hidden flex items-center gap-2 px-3 py-1.5 bg-blue-50/50 rounded-xl border border-blue-100">
                <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-medium text-gray-600">
                  {summaryStartDate} - {summaryEndDate}
                </span>
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Manage Rules Button */}
              <button
                onClick={() => setShowConfig(true)}
                className="group relative px-4 py-2 bg-white border border-gray-200 hover:border-blue-400 rounded-xl text-sm font-medium text-gray-700 hover:text-blue-700 transition-all duration-200 hover:shadow-md flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Manage Payroll Calculations</span>
              </button>

              {/* ✅ UPDATED: Release Payslip Button → opens employee selection modal */}
              <button
                onClick={handleOpenReleaseModal}
                disabled={saving}
                className={`group relative px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 shadow-sm ${saving
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 hover:shadow-lg active:scale-95 text-white'
                  }`}
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Releasing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span>Release Payslip</span>
                  </>
                )}
              </button>

              {/* Export Button */}
              <button
                onClick={handleExportAll}
                className="group relative px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl text-sm font-medium text-white transition-all duration-200 hover:shadow-lg active:scale-95 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-green-500">
            <p className="text-gray-400 text-xs font-bold uppercase">Total Earnings</p>
            <h3 className="text-2xl font-bold text-green-700">{formatCurrency(totals.gross)}</h3>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-red-500">
            <p className="text-gray-400 text-xs font-bold uppercase">Total Deductions</p>
            <h3 className="text-2xl font-bold text-red-600">-{formatCurrency(totals.deductions)}</h3>
          </div>
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-5 rounded-xl shadow-lg text-white">
            <p className="text-blue-100 text-xs font-bold uppercase">Net Payable</p>
            <h3 className="text-2xl font-extrabold">{formatCurrency(totals.net)}</h3>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4 text-right">Base Salary</th>
                  <th className="px-6 py-4 text-center">Leaves / Absent</th>
                  <th className="px-6 py-4 text-center">Worked Days</th>
                  <th className="px-6 py-4 text-center">Full / Half</th>
                  <th className="px-6 py-4 text-center">LOP / Late</th>
                  <th className="px-6 py-4 text-right bg-indigo-50 text-indigo-700">Net Pay</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPayroll.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-8 text-gray-500">No Full Time employees found</td></tr>
                ) : filteredPayroll.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-800">{emp.employeeName}</div>
                      <div className="text-xs text-gray-500">{emp.employeeId}</div>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-700 font-medium">
                      {formatCurrency(emp.monthlyBreakdown.total)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <div className="text-xs font-bold text-gray-700 mb-1">
                          Total: {emp.totalLeavesConsumed + emp.absentDays}
                        </div>
                        <div className="flex gap-2 text-[10px]">
                          <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            L: {emp.totalLeavesConsumed}
                          </span>
                          <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                            A: {emp.absentDays}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded font-bold text-xs">{emp.workedDays}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex gap-1 justify-center">
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-bold text-xs">{emp.fullDays}</span>
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-bold text-xs">{emp.halfDays}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-2 py-1 rounded font-bold text-xs ${emp.lopDays > 0 ? 'bg-orange-100 text-orange-800' : 'text-gray-400'}`}>
                          LOP: {emp.lopDays}
                        </span>
                        <span className={`px-2 py-1 rounded font-bold text-xs ${emp.lateDaysCount > 0 ? 'bg-red-100 text-red-800' : 'text-gray-400'}`}>
                          Late: {emp.lateDaysCount}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-indigo-700 bg-indigo-50">
                      {formatCurrency(emp.netPayableSalary)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => setSelectedEmployee(emp)} className="text-blue-600 hover:text-blue-800 font-semibold text-xs border border-blue-200 px-3 py-1.5 rounded hover:bg-blue-50">View Slip</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <PayrollConfigModal
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        currentRules={payrollRules}
        onSave={handleSaveRules}
      />

      {/* ✅ NEW: Employee-wise Release Payslip Modal */}
      <ReleasePayslipModal
        isOpen={showReleaseModal}
        onClose={() => setShowReleaseModal(false)}
        payrollData={processedPayroll}
        periodStart={summaryStartDate}
        periodEnd={summaryEndDate}
        onConfirmRelease={handleConfirmRelease}
      />

      {selectedEmployee && (
        <PayrollSlipModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          periodStart={summaryStartDate}
          periodEnd={summaryEndDate}
        />
      )}
    </div>
  );
};

export default PayrollManagement;