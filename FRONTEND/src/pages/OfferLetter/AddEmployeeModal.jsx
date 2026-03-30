import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    User, Briefcase, IndianRupee, ArrowRight,
    Download, ChevronDown
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
                } catch(e){}
            }

            return {
                ...initialData,
                employment_type: isIntern ? 'Internship' : 'Full Time',
                joining_date: joiningFormatted || initialData.joining_date || '',
                ctc: initialData.ctc || comp.ctc || '',
                basic_salary: initialData.basic_salary || comp.basic_salary || (comp.ctc ? (comp.ctc * 0.5) : ''),
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

    const handleChange = (e) => {
        let { name, value } = e.target;
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

    const handleSubmit = (e) => {
        e.preventDefault();

        if (errors.name || errors.designation || errors.department) {
            alert("Please remove numbers from Name, Designation, and Department.");
            return;
        }

        const isIntern = formData.employment_type === 'Internship';
        const payload = {
            ...formData,
            compensation: {
                ...(formData.compensation || {}),
                basic_salary: isIntern ? 0 : (formData.basic_salary ? parseFloat(formData.basic_salary) : 0),
                ctc: isIntern ? 0 : (formData.ctc ? parseFloat(formData.ctc) : 0),
                pt: formData.pt !== '' && formData.pt !== undefined && formData.pt !== null ? parseFloat(formData.pt) : 0,
                pf: formData.pf !== '' && formData.pf !== undefined && formData.pf !== null ? parseFloat(formData.pf) : 0
            }
        };
        onSave(payload);
    };



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

                    {/* Sections with subtle backgrounds */}
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
                            <div className="form-grid-2">
                                <InputGroup label="Annual CTC (₹)" name="ctc" type="number" value={formData.ctc} onChange={handleChange} required disabled={isViewOnly} />
                                <InputGroup label="Basic Salary (Monthly) (₹)" name="basic_salary" type="number" value={formData.basic_salary} onChange={handleChange} required disabled={isViewOnly} />
                            </div>
                            <div className="form-grid-2" style={{ marginTop: '1.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 1' }}>
                                    <label style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', color: 'var(--text-muted)' }}>
                                        PT (Monthly) (₹) <span style={{ color: '#ef4444' }}>*</span>
                                        {formData.ctc && parseFloat(formData.ctc) > 0 && (() => {
                                            const ctc = parseFloat(formData.ctc) || 0;
                                            const grossM = ctc / 12;
                                            const suggested = grossM <= 15000 ? 0 : grossM <= 20000 ? 150 : 200;
                                            return <span style={{ color: '#f59e0b', fontWeight: '500', textTransform: 'none', letterSpacing: '0' }}> — Sug: ₹{suggested}</span>;
                                        })()}
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
                                        {formData.ctc && parseFloat(formData.ctc) > 0 && (() => {
                                            const ctc = parseFloat(formData.ctc) || 0;
                                            const basic = ctc * 0.40;
                                            const suggested = Math.round((basic * 0.12) / 12);
                                            return <span style={{ color: '#f59e0b', fontWeight: '500', textTransform: 'none', letterSpacing: '0' }}> — Sug: ₹{suggested}</span>;
                                        })()}
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
                            <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                💡 Leave PT and PF empty or enter 0 if the company doesn't have these deductions.
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
