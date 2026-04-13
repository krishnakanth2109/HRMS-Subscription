import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    User, Briefcase, IndianRupee, ArrowRight,
    Download, ChevronDown, Info
} from 'lucide-react';
import * as api from '../../api';

const InputGroup = ({ label, name, type = "text", placeholder, value, onChange, disabled, required = false, options = null, error = false }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: '700',
            color: 'var(--text-muted)'
        }}>
            {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
        {options ? (
            <div style={{ position: 'relative' }}>
                <select
                    name={name}
                    value={value}
                    onChange={onChange}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        color: 'var(--text-primary)',
                        fontSize: '1rem',
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                        transition: 'all 0.2s'
                    }}
                >
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', display: 'flex' }}>
                    <ChevronDown size={18} />
                </div>
            </div>
        ) : (
            <input
                type={type === 'number' ? 'text' : type}
                inputMode={type === 'number' ? 'numeric' : undefined}
                name={name}
                placeholder={placeholder}
                value={value}
                onChange={(e) => {
                    if (type === 'number') {
                        const val = e.target.value;
                        if (val === '' || val === '-' || /^-?\d*\.?\d*$/.test(val)) {
                            onChange(e);
                        }
                    } else {
                        onChange(e);
                    }
                }}
                disabled={disabled}
                required={required}
                autoComplete="off"
                style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: disabled ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                    border: error ? '2px solid #ef4444' : '1px solid var(--border-color)',
                    borderRadius: '12px',
                    color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'all 0.2s',
                    cursor: disabled ? 'not-allowed' : 'text',
                    MozAppearance: 'textfield'
                }}
                onFocus={(e) => { if (!disabled && !error) { e.target.style.borderColor = 'var(--accent-color)'; e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)' } }}
                onBlur={(e) => { if (!error) e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none' }}
                onWheel={(e) => e.target.blur()}
            />
        )}
    </div>
);

const AddEmployeeModal = ({ onClose, onSave, initialData, isViewOnly }) => {
    // ── Payroll Rules State ────────────────────────────────────
    const [payrollRules, setPayrollRules] = useState(null);
    const [rulesLoading, setRulesLoading] = useState(true);

    // ── Verified Candidates State ──────────────────────────────
    const [verifiedCandidates, setVerifiedCandidates] = useState([]);
    const [selectedCandidateId, setSelectedCandidateId] = useState('');

    useEffect(() => {
        api.getAllVerifiedDocCandidates()
            .then(data => setVerifiedCandidates(data || []))
            .catch(err => console.error("Could not load verified candidates", err));
    }, []);

    // Fetch payroll rules on mount
    useEffect(() => {
        const fetchRules = async () => {
            try {
                const response = await api.getPayrollRules();
                const rules = response?.data || response;
                setPayrollRules(rules);
                console.log("📋 Payroll Rules loaded for offer letter:", rules);
            } catch (err) {
                console.warn("⚠️ Could not load payroll rules, using defaults:", err.message);
                // Fallback defaults
                setPayrollRules({
                    basicPercentage: 40, hraPercentage: 40,
                    conveyance: 1600, medical: 1250,
                    travellingAllowance: 800, otherAllowance: 1000,
                    pfCalculationMethod: 'percentage', pfPercentage: 12,
                    employerPfPercentage: 12,
                    pfFixedAmountEmployee: 0, pfFixedAmountEmployer: 0,
                    ptSlab1Limit: 15000, ptSlab2Limit: 20000,
                    ptSlab1Amount: 150, ptSlab2Amount: 200
                });
            } finally {
                setRulesLoading(false);
            }
        };
        fetchRules();
    }, []);

    // ── Calculate salary breakdown using payroll rules ──────────
    const calculateFromRules = useCallback((ctcAnnual, rules) => {
        if (!rules || !ctcAnnual || ctcAnnual <= 0) return {};

        const basicAnnual = Math.round(ctcAnnual * (rules.basicPercentage || 40) / 100);
        const basicMonthly = Math.round(basicAnnual / 12);
        const hraMonthly = Math.round(basicMonthly * (rules.hraPercentage || 40) / 100);
        const conveyance = rules.conveyance || 1600;
        const medical = rules.medical || 1250;
        const travellingAllowance = rules.travellingAllowance || 800;
        const otherAllowance = rules.otherAllowance || 1000;

        const grossMonthly = basicMonthly + hraMonthly + conveyance + medical + travellingAllowance + otherAllowance;

        // PF Calculation
        let pfMonthly = 0;
        if (rules.pfCalculationMethod === 'fixed') {
            pfMonthly = rules.pfFixedAmountEmployee || 0;
        } else {
            pfMonthly = Math.round(basicMonthly * (rules.pfPercentage || 12) / 100);
        }

        // PT Calculation based on slabs
        let ptMonthly = 0;
        const ptSlab1Limit = rules.ptSlab1Limit || 15000;
        const ptSlab2Limit = rules.ptSlab2Limit || 20000;
        if (grossMonthly > ptSlab2Limit) {
            ptMonthly = rules.ptSlab2Amount || 200;
        } else if (grossMonthly > ptSlab1Limit) {
            ptMonthly = rules.ptSlab1Amount || 150;
        }

        return {
            basic_salary: basicMonthly,
            hra: hraMonthly,
            conveyance,
            medical,
            travellingAllowance,
            otherAllowance,
            gross: grossMonthly,
            pf: pfMonthly,
            pt: ptMonthly,
            net: grossMonthly - pfMonthly - ptMonthly
        };
    }, []);

    const [formData, setFormData] = useState(() => {
        if (initialData) {
            const typeLower = (initialData.employment_type || '').toLowerCase();
            const roleLower = (initialData.designation || '').toLowerCase();
            const isIntern = typeLower.includes('intern') || roleLower.includes('intern');
            const comp = initialData.compensation || {};

            let joiningFormatted = '';
            if (initialData.joining_date) {
                try {
                    joiningFormatted = new Date(initialData.joining_date).toISOString().split('T')[0];
                } catch (e) { }
            }

            return {
                ...initialData,
                employment_type: isIntern ? 'Internship' : 'Full Time',
                joining_date: joiningFormatted || initialData.joining_date || '',
                ctc: initialData.ctc || comp.ctc || '',
                basic_salary: initialData.basic_salary || comp.basic_salary || '',
                pt: initialData.pt !== undefined ? initialData.pt : (comp.pt !== undefined ? comp.pt : ''),
                pf: initialData.pf !== undefined ? initialData.pf : (comp.pf !== undefined ? comp.pf : '')
            };
        }
        return {
            name: '',
            email: '',
            employment_type: 'Full Time',
            designation: '',
            department: '',
            joining_date: '',
            ctc: '',
            basic_salary: '',
            pt: '',
            pf: ''
        };
    });

    const [errors, setErrors] = useState({});
    const [ctcModified, setCtcModified] = useState(false);

    // ── Auto-calculate when CTC changes AND payroll rules are loaded ──
    useEffect(() => {
        if (!payrollRules || !formData.ctc || formData.employment_type === 'Internship') return;

        // SKIP calculation for existing employees so we don't accidentally overwrite their FROZEN saved values.
        // It should only auto-recalculate if the user explicitly modifies the CTC value.
        if (initialData && !ctcModified) return;

        const ctc = parseFloat(formData.ctc);
        if (isNaN(ctc) || ctc <= 0) return;

        const calc = calculateFromRules(ctc, payrollRules);
        if (calc.basic_salary) {
            setFormData(prev => ({
                ...prev,
                basic_salary: calc.basic_salary,
                pt: calc.pt,
                pf: calc.pf
            }));
        }
    }, [formData.ctc, payrollRules, formData.employment_type, calculateFromRules, initialData, ctcModified]);

    const handleChange = (e) => {
        let { name, value } = e.target;
        if (name === 'ctc') setCtcModified(true);
        if (name === 'joining_date' && value.length > 10) value = '';

        if (['name', 'designation', 'department'].includes(name)) {
            const hasNumber = /\d/.test(value);
            setErrors(prev => ({ ...prev, [name]: hasNumber }));
        }

        if (name === 'email') {
            const lowerVal = value.toLowerCase();
            const dotComIndex = lowerVal.indexOf('.com');
            if (dotComIndex !== -1 && value.length > dotComIndex + 4) {
                value = value.substring(0, dotComIndex + 4);
            }
        }

        setFormData({ ...formData, [name]: value });
    };

    const handleCandidateAutofill = (e) => {
        const id = e.target.value;
        setSelectedCandidateId(id);
        if (!id) return;

        const candidate = verifiedCandidates.find(c => c._id === id);
        if (candidate) {
            let mappedType = candidate.employmentType || formData.employment_type;
            const typeLower = mappedType.toLowerCase();
            if (typeLower.includes('intern')) mappedType = 'Internship';
            else mappedType = 'Full Time';

            setFormData(prev => ({
                ...prev,
                name: candidate.fullName || candidate.name || prev.name,
                email: candidate.email || prev.email,
                designation: candidate.role || prev.designation,
                department: candidate.department || prev.department,
                employment_type: mappedType
            }));
            // Trigger recalculations if needed by pretending ctc was modified
            setCtcModified(true);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (errors.name || errors.designation || errors.department) {
            alert("Please remove numbers from Name, Designation, and Department.");
            return;
        }

        const isIntern = formData.employment_type === 'Internship';
        const ctcVal = isIntern ? 0 : (formData.ctc ? parseFloat(formData.ctc) : 0);
        const basicVal = isIntern ? 0 : (formData.basic_salary ? parseFloat(formData.basic_salary) : 0);
        const ptVal = formData.pt !== '' && formData.pt !== undefined && formData.pt !== null ? parseFloat(formData.pt) : 0;
        const pfVal = formData.pf !== '' && formData.pf !== undefined && formData.pf !== null ? parseFloat(formData.pf) : 0;

        // Calculate and FREEZE the full breakdown using current payroll rules
        // This ensures that even if rules change later, this employee's offer stays the same
        const frozenBreakdown = (!isIntern && payrollRules && ctcVal > 0)
            ? calculateFromRules(ctcVal, payrollRules)
            : {};

        const payload = {
            ...formData,
            compensation: {
                ...(formData.compensation || {}),
                ctc: ctcVal,
                basic_salary: basicVal,
                pt: ptVal,
                pf: pfVal,
                // Freeze all breakdown components from current payroll rules
                hra: frozenBreakdown.hra || 0,
                conveyance: frozenBreakdown.conveyance || 0,
                medical_allowance: frozenBreakdown.medical || 0,
                travelling_allowance: frozenBreakdown.travellingAllowance || 0,
                other_allowance: frozenBreakdown.otherAllowance || 0,
                special_allowance: (() => {
                    if (!frozenBreakdown.basic_salary) return 0;
                    const total = (basicVal * 12) + (frozenBreakdown.hra || 0) * 12
                        + (frozenBreakdown.conveyance || 0) * 12 + (frozenBreakdown.medical || 0) * 12
                        + (frozenBreakdown.travellingAllowance || 0) * 12 + (frozenBreakdown.otherAllowance || 0) * 12;
                    const remaining = ctcVal - total;
                    return remaining > 0 ? Math.round(remaining / 12) : 0;
                })(),
                gross_salary: frozenBreakdown.gross || 0,
                net_salary: frozenBreakdown.net || 0,
                // Store which rules were used (for audit/reference)
                _rules_snapshot: payrollRules ? {
                    basicPercentage: payrollRules.basicPercentage,
                    hraPercentage: payrollRules.hraPercentage,
                    pfMethod: payrollRules.pfCalculationMethod,
                    pfPercentage: payrollRules.pfPercentage,
                    frozenAt: new Date().toISOString()
                } : null
            }
        };
        onSave(payload);
    };

    // ── Calculated breakdown preview ───────────────────────────
    const ctcNum = parseFloat(formData.ctc) || 0;

    let breakdown = null;
    const hasFrozenBreakdown = initialData && initialData.compensation && initialData.compensation.gross_salary > 0;

    if (formData.employment_type === 'Full Time') {
        // If we have frozen values and CTC wasn't modified, display the frozen breakdown
        if (initialData && !ctcModified && hasFrozenBreakdown) {
            const comp = initialData.compensation;
            breakdown = {
                basic_salary: comp.basic_salary,
                hra: comp.hra || 0,
                conveyance: comp.conveyance || 0,
                medical: comp.medical_allowance || 0,
                travellingAllowance: comp.travelling_allowance || 0,
                otherAllowance: comp.other_allowance || 0,
                gross: comp.gross_salary || 0,
                pf: comp.pf || 0,
                pt: comp.pt || 0,
                net: comp.net_salary || 0,
            };
        }
        // Otherwise, if we have dynamic rules and >0 CTC, display the real-time preview
        else if (payrollRules && ctcNum > 0) {
            breakdown = calculateFromRules(ctcNum, payrollRules);
        }
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--modal-overlay)',
            backdropFilter: 'blur(10px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 2000
        }}>
            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="modal-content"
                style={{
                    background: 'var(--card-bg)',
                    width: '1000px',
                    maxWidth: '95vw',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--card-shadow)',
                    padding: '3rem',
                    borderRadius: '32px'
                }}
            >
                {/* Header */}
                <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: '2.2rem',
                        fontWeight: '800',
                        color: 'var(--text-primary)',
                        marginBottom: '0.5rem'
                    }}>
                        {isViewOnly ? 'View Employee Profile' : initialData ? 'Update Employee Profile' : 'New Employee Onboarding'}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1rem', fontWeight: '500' }}>
                        {isViewOnly ? 'Review details below.' : initialData ? 'Refine details for high-performance offer letters.' : 'Empower your team with a new enterprise member.'}
                    </p>
                </div>

                {!isViewOnly && (
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <button
                            type="button"
                            onClick={async () => { await api.downloadOfferLetterExcelTemplate(); }}
                            style={{
                                background: 'transparent', border: '1px dashed var(--accent-color)', color: 'var(--accent-color)',
                                padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
                                display: 'inline-flex', alignItems: 'center', gap: '8px'
                            }}
                        >
                            <Download size={16} /> Download Bulk Import Template
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '2.5rem' }}>

                    {/* Auto-fill from Document Verification */}
                    {!isViewOnly && !initialData && verifiedCandidates.length > 0 && (
                        <div style={{ background: 'var(--accent-soft)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--accent-color)', boxShadow: '0 4px 12px rgba(99,102,241,0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                <div style={{ background: 'var(--accent-color)', color: 'white', padding: '6px', borderRadius: '8px' }}>
                                    <User size={18} />
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--accent-color)', fontWeight: 800 }}>Smart Autofill</h4>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quickly import verified candidate details seamlessly from the Document Verification Portal.</p>
                                </div>
                            </div>
                            <select
                                value={selectedCandidateId}
                                onChange={handleCandidateAutofill}
                                style={{
                                    width: '100%', padding: '12px 16px', background: 'white',
                                    border: '1px solid var(--border-color)', borderRadius: '12px',
                                    color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600,
                                    outline: 'none', cursor: 'pointer'
                                }}
                            >
                                <option value="">-- Select a Verified Candidate --</option>
                                {verifiedCandidates.map(c => (
                                    <option key={c._id} value={c._id}>
                                        {c.fullName || c.name} ({c.email}) - {c.role}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Personal Information */}
                    <div style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <User size={20} style={{ color: 'var(--accent-color)' }} />
                            <span style={{ borderBottom: '2px solid var(--accent-color)', paddingBottom: '4px', fontWeight: 'bold' }}>Personal Information</span>
                        </h3>
                        <div className="form-grid-12">
                            <div style={{ gridColumn: 'span 12' }}>
                                <InputGroup label="Full Name" name="name" placeholder="e.g. Sarah Connor" value={formData.name} onChange={handleChange} error={errors.name} required disabled={isViewOnly} />
                            </div>
                            <div style={{ gridColumn: 'span 8' }}>
                                <InputGroup label="Email Address" name="email" type="email" placeholder="sarah@corp.com" value={formData.email} onChange={handleChange} required disabled={isViewOnly} />
                            </div>
                            <div style={{ gridColumn: 'span 4' }}>
                                <InputGroup label="Joining Date" name="joining_date" type="date" value={formData.joining_date} onChange={handleChange} required disabled={isViewOnly} />
                            </div>
                        </div>
                    </div>

                    {/* Professional Details */}
                    <div style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Briefcase size={20} style={{ color: 'var(--accent-color)' }} />
                            <span style={{ borderBottom: '2px solid var(--accent-color)', paddingBottom: '4px', fontWeight: 'bold' }}>Professional Details</span>
                        </h3>
                        <div className="form-grid-12">
                            <div style={{ gridColumn: 'span 6' }}>
                                <InputGroup label="Designation" name="designation" placeholder="e.g. Senior Principal" value={formData.designation} onChange={handleChange} error={errors.designation} required disabled={isViewOnly} />
                            </div>
                            <div style={{ gridColumn: 'span 6' }}>
                                <InputGroup label="Department" name="department" placeholder="e.g. Cloud Operations" value={formData.department} onChange={handleChange} error={errors.department} required disabled={isViewOnly} />
                            </div>
                            <div style={{ gridColumn: 'span 12' }}>
                                <InputGroup label="Employment Type" name="employment_type" value={formData.employment_type} onChange={handleChange} options={['Full Time', 'Internship']} disabled={isViewOnly} />
                            </div>
                        </div>
                    </div>

                    {/* Compensation Structure - Full Time Only */}
                    {formData.employment_type === 'Full Time' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}
                        >
                            <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <IndianRupee size={20} style={{ color: 'var(--accent-color)' }} />
                                <span style={{ borderBottom: '2px solid var(--accent-color)', paddingBottom: '4px', fontWeight: 'bold' }}>Compensation Structure</span>
                            </h3>

                            {/* Rules Info Badge */}
                            {(payrollRules || hasFrozenBreakdown) && !rulesLoading && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    background: (initialData && !ctcModified && hasFrozenBreakdown) ? 'rgba(245, 158, 11, 0.08)' : 'rgba(99, 102, 241, 0.08)',
                                    border: `1px solid ${(initialData && !ctcModified && hasFrozenBreakdown) ? 'rgba(245, 158, 11, 0.2)' : 'rgba(99, 102, 241, 0.2)'}`,
                                    borderRadius: '10px', padding: '10px 14px', marginBottom: '1.5rem',
                                    fontSize: '0.78rem', color: (initialData && !ctcModified && hasFrozenBreakdown) ? '#d97706' : 'var(--accent-color)', fontWeight: 600
                                }}>
                                    <Info size={14} />
                                    <span>
                                        {(initialData && !ctcModified && hasFrozenBreakdown)
                                            ? `Showing saved/frozen salary breakdown from offer creation time. Modifying the CTC will recalculate using the newest payroll rules.`
                                            : `Auto-calculated from current Payroll Rules: Basic ${payrollRules?.basicPercentage}% | HRA ${payrollRules?.hraPercentage}% of Basic | PF ${payrollRules?.pfCalculationMethod === 'fixed' ? `₹${payrollRules?.pfFixedAmountEmployee} fixed` : `${payrollRules?.pfPercentage}% of Basic`}`
                                        }
                                    </span>
                                </div>
                            )}

                            <div className="form-grid-2">
             <InputGroup
  label="Annual CTC (₹)"
  name="ctc"
  type="number"
  min="0"
  value={formData.ctc}
  onChange={handleChange}
  required
  disabled={isViewOnly}
/>

<InputGroup
  label="Basic Salary (Monthly) (₹)"
  name="basic_salary"
  type="number"
  min="0"
  value={formData.basic_salary}
  onChange={handleChange}
  required
  disabled={isViewOnly}
/>
                            </div>

                            <div className="form-grid-2" style={{ marginTop: '1.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 1' }}>
                                    <label style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', color: 'var(--text-muted)' }}>
                                        PT (Monthly) (₹) <span style={{ color: '#ef4444' }}>*</span>
                                        {breakdown && (
                                            <span style={{ color: '#10b981', fontWeight: '500', textTransform: 'none', letterSpacing: '0' }}>
                                                {' '}— Auto: ₹{breakdown.pt}
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        name="pt"
                                        placeholder="Enter PT amount"
                                        value={formData.pt}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || val === '-' || /^-?\d*\.?\d*$/.test(val)) handleChange(e);
                                        }}
                                        required
                                        autoComplete="off"
                                        style={{
                                            width: '100%', padding: '12px 16px', background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-color)', borderRadius: '12px',
                                            color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', transition: 'all 0.2s'
                                        }}
                                        onFocus={(e) => { e.target.style.borderColor = 'var(--accent-color)'; e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)' }}
                                        onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 1' }}>
                                    <label style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', color: 'var(--text-muted)' }}>
                                        PF (Monthly) (₹) <span style={{ color: '#ef4444' }}>*</span>
                                        {breakdown && (
                                            <span style={{ color: '#10b981', fontWeight: '500', textTransform: 'none', letterSpacing: '0' }}>
                                                {' '}— Auto: ₹{breakdown.pf}
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        name="pf"
                                        placeholder="Enter PF amount"
                                        value={formData.pf}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || val === '-' || /^-?\d*\.?\d*$/.test(val)) handleChange(e);
                                        }}
                                        required
                                        autoComplete="off"
                                        style={{
                                            width: '100%', padding: '12px 16px', background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-color)', borderRadius: '12px',
                                            color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', transition: 'all 0.2s'
                                        }}
                                        onFocus={(e) => { e.target.style.borderColor = 'var(--accent-color)'; e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)' }}
                                        onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none' }}
                                    />
                                </div>
                            </div>

                            {/* Live Salary Breakdown Preview */}
                            {breakdown && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    style={{
                                        marginTop: '1.5rem',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: '16px',
                                        padding: '1.25rem',
                                        border: '1px solid var(--border-color)'
                                    }}
                                >
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        💰 Salary Breakdown Preview (Monthly)
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                                        {[
                                            { label: 'Basic', val: breakdown.basic_salary },
                                            { label: 'HRA', val: breakdown.hra },
                                            { label: 'Conveyance', val: breakdown.conveyance },
                                            { label: 'Medical', val: breakdown.medical },
                                            { label: 'Travel Allow.', val: breakdown.travellingAllowance },
                                            { label: 'Other Allow.', val: breakdown.otherAllowance },
                                            { label: 'Gross', val: breakdown.gross, bold: true },
                                            { label: 'PF Deduction', val: breakdown.pf, neg: true },
                                            { label: 'PT Deduction', val: breakdown.pt, neg: true },
                                            { label: 'Net Pay', val: breakdown.net, bold: true, highlight: true },
                                        ].map((item, i) => (
                                            <div key={i} style={{
                                                padding: '8px 10px', borderRadius: '8px',
                                                background: item.highlight ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-primary)',
                                                border: `1px solid ${item.highlight ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
                                            }}>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>{item.label}</div>
                                                <div style={{
                                                    fontSize: '0.95rem',
                                                    fontWeight: item.bold ? 800 : 600,
                                                    color: item.neg ? '#ef4444' : item.highlight ? '#10b981' : 'var(--text-primary)'
                                                }}>
                                                    {item.neg ? '-' : ''}₹{(item.val || 0).toLocaleString('en-IN')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                💡 Values are auto-calculated from Payroll Rules. You can override PT & PF manually if needed.
                            </p>
                        </motion.div>
                    )}

                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', paddingTop: '2rem', borderTop: '2px solid var(--border-color)' }}>
                        <button type="button" onClick={onClose} style={{
                            flex: 1,
                            padding: '16px',
                            background: isViewOnly ? 'var(--accent-color)' : 'transparent',
                            border: isViewOnly ? 'none' : '2px solid var(--border-color)',
                            color: isViewOnly ? 'white' : 'var(--text-primary)',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: isViewOnly ? '0 8px 20px -5px rgba(99, 102, 241, 0.4)' : 'none'
                        }}
                            onMouseOver={(e) => { if (!isViewOnly) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                            onMouseOut={(e) => { if (!isViewOnly) e.currentTarget.style.background = 'transparent'; }}
                        >
                            {isViewOnly ? 'Close' : 'Cancel'}
                        </button>
                        {!isViewOnly && (
                            <button type="submit" style={{
                                flex: 2,
                                padding: '16px',
                                background: 'var(--accent-color)',
                                border: 'none',
                                color: 'white',
                                fontSize: '1.1rem',
                                fontWeight: '800',
                                borderRadius: '16px',
                                cursor: 'pointer',
                                boxShadow: '0 8px 20px -5px rgba(99, 102, 241, 0.4)',
                                transition: 'transform 0.1s, background 0.2s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                            }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'var(--accent-color)'}
                                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                {initialData ? 'Apply Updates' : 'Onboard Employee'}
                                <ArrowRight size={20} />
                            </button>
                        )}
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default AddEmployeeModal;
