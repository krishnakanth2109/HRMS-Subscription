import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Send } from 'lucide-react';
import * as api from '../../api';

// Removed hardcoded COMPANY_NAMES. Following dynamic state pattern.

const BulkSendModal = ({ selectedCount, onClose, onStart }) => {
    const [letterType, setLetterType] = useState('Offer Letter');
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [companies, setCompanies] = useState([]);
    const [availableTemplates, setAvailableTemplates] = useState([]);

    useEffect(() => {
        const load = async () => {
            try {
                const [compList, tempList] = await Promise.all([
                    api.getOfferLetterCompanies(),
                    api.getOfferLetterTemplates()
                ]);
                setCompanies(compList || []);
                setAvailableTemplates(tempList || []);
                if (compList?.length > 0) setCompanyName(compList[0].company_name || compList[0].name);
                if (tempList?.length > 0) setSelectedTemplate(tempList[0].templateUrl || tempList[0].url);
            } catch { }
        };
        load();
    }, []);

    // Sync template when company name changes (Auto-select template)
    useEffect(() => {
        if (!companyName || availableTemplates.length === 0) return;
        const matched = availableTemplates.find(t => 
            t.companyName?.toLowerCase() === companyName.toLowerCase() ||
            t.name?.toLowerCase().includes(companyName.toLowerCase())
        );
        if (matched) setSelectedTemplate(matched.templateUrl || matched.url);
    }, [companyName, availableTemplates]);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--modal-overlay)',
            backdropFilter: 'blur(5px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 3000
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    background: 'var(--card-bg)',
                    padding: '2.5rem',
                    borderRadius: '24px',
                    width: '500px',
                    maxWidth: '90vw',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--card-shadow)'
                }}
            >
                <h2 style={{ marginTop: 0, fontSize: '1.8rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Sparkles style={{ color: 'var(--accent-color)' }} /> Bulk Output Setup
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    You are generating letters for <strong>{selectedCount}</strong> candidate(s). Choose your preferred background templates.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85em', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Letter Header Template</label>
                        <select
                            value={selectedTemplate}
                            onChange={(e) => setSelectedTemplate(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none' }}
                        >
                            {availableTemplates.length === 0 ? <option value="">No Templates</option> :
                                availableTemplates.map(t => <option key={t._id || t.id} value={t.templateUrl || t.url}>{t.name || t.filename || 'Template'}</option>)}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85em', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Company Name</label>
                        <select
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none' }}
                        >
                            {companies.map(c => <option key={c.id || c._id} value={c.company_name || c.name}>{c.company_name || c.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85em', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Letter Type</label>
                        <select
                            value={letterType}
                            onChange={(e) => setLetterType(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none' }}
                        >
                            <option>Offer Letter</option>
                            <option>Internship Letter</option>
                            <option>Appraisal Letter</option>
                            <option>Experience Letter</option>
                            <option>Relieving Letter</option>
                            <option>Others</option>
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'transparent', border: '2px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Cancel
                    </button>
                    <button onClick={() => onStart(selectedTemplate, companyName, letterType)} style={{ flex: 2, padding: '12px', background: 'var(--accent-color)', border: 'none', color: 'white', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)' }}>
                        Start Generating →
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default BulkSendModal;
