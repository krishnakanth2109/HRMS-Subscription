import React, { useState, useEffect, useMemo } from 'react';
import GeneralLetterModal from './GeneralLetterModal';
import ManageTemplatesModal from './ManageTemplatesModal';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '../../api';
import '../OfferLetterStyles.css';
import { Search, Send, FileText, LayoutGrid, List } from 'lucide-react';

const GeneralLettersIndex = () => {
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('All');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [empData, compData] = await Promise.all([
        api.getEmployees(),
        api.getAllCompanies()
      ]);
      setEmployees(empData || []);
      setCompanies(compData?.data || compData || []);
    } catch (e) {
      console.error("Failed to fetch data:", e);
    }
    setLoading(false);
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const empCompanyId = emp.company?._id || emp.company;
      if (selectedCompanyId !== 'All' && String(empCompanyId) !== String(selectedCompanyId)) {
        return false;
      }
      const s = searchTerm.toLowerCase();
      const matchName = (emp.name || emp.employeeName || "").toLowerCase().includes(s);
      const matchEmail = (emp.email || emp.employeeEmail || "").toLowerCase().includes(s);
      const matchDesig = (emp.designation || "").toLowerCase().includes(s);
      return matchName || matchEmail || matchDesig;
    });
  }, [employees, searchTerm, selectedCompanyId]);

  return (
    <div className="offer-letter-wrapper ol-container">
      <header style={{ marginBottom: '2rem', textAlign: 'center', paddingTop: '1rem' }}>
        <h1 style={{ fontWeight: 1000, color: 'var(--accent-color)', marginBottom: '0.25rem', letterSpacing: '-0.025em' }}>General Letters Management</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Professional Document Automation</p>
      </header>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="ol-toolbar-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <select
              value={selectedCompanyId}
              onChange={e => setSelectedCompanyId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                minWidth: '150px'
              }}
            >
              <option value="All">All Companies</option>
              {companies.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
              <input type="text" placeholder="Search employees..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', outline: 'none', width: '250px', fontSize: '0.9rem' }} />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setViewMode('grid')} style={{ padding: '8px', borderRadius: '8px', border: 'none', background: viewMode === 'grid' ? 'var(--card-bg)' : 'transparent', color: viewMode === 'grid' ? 'var(--accent-color)' : 'var(--text-muted)', cursor: 'pointer' }}><LayoutGrid size={18} /></button>
            <button onClick={() => setViewMode('list')} style={{ padding: '8px', borderRadius: '8px', border: 'none', background: viewMode === 'list' ? 'var(--card-bg)' : 'transparent', color: viewMode === 'list' ? 'var(--accent-color)' : 'var(--text-muted)', cursor: 'pointer' }}><List size={18} /></button>
            <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 8px' }} />
            <button onClick={() => setShowTemplateManager(true)} style={{ background: 'var(--success-text)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><FileText size={16} /> Manage Templates</button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Loading employees...</div>
        ) : filteredEmployees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-tertiary)', borderRadius: '24px', border: '2px dashed var(--border-color)', color: 'var(--text-muted)' }}>
            No employees found.
          </div>
        ) : viewMode === 'grid' ? (
          <div className="ol-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {filteredEmployees.map(emp => {
              const uniqueId = emp._id || emp.id;
              const name = emp.name || emp.employeeName || "Unnamed";
              return (
                <div key={uniqueId} style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--card-shadow)' }}>
                  <div style={{ padding: '1.5rem', flex: 1 }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{name}</h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{emp.designation || "No Designation"}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{emp.email || emp.employeeEmail}</div>
                  </div>
                  <div style={{ padding: '1rem 1.5rem', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => setSelectedEmployee(emp)} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Send size={14} /> SEND LETTER</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
              <thead style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                <tr>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Employee Name</th>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Designation</th>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Email</th>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => {
                  const uniqueId = emp._id || emp.id;
                  const name = emp.name || emp.employeeName || "Unnamed";
                  return (
                    <tr key={uniqueId} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '1rem', fontWeight: 700 }}>{name}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{emp.designation || "N/A"}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{emp.email || emp.employeeEmail}</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <button onClick={() => setSelectedEmployee(emp)} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Send size={14} /> SEND LETTER</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {selectedEmployee && <GeneralLetterModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} onSuccess={() => setSelectedEmployee(null)} />}
        {showTemplateManager && <ManageTemplatesModal onClose={() => setShowTemplateManager(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default GeneralLettersIndex;
