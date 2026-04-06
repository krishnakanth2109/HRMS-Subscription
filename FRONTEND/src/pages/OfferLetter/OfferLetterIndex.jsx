import { useState, useEffect, useMemo } from 'react';
import AddEmployeeModal from './AddEmployeeModal';
import LetterModal from './LetterModal';
import BulkSendModal from './BulkSendModal';
import ManageTemplatesModal from './ManageTemplatesModal';
import { generateOfferLetterPdf } from '../../utils/offerLetterPdfGenerator';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '../../api';
import '../OfferLetterStyles.css';
import {
  Users, CheckCircle, XCircle, Clock, Search, LayoutGrid, List, Plus, Download,
  Upload, Eye, Pencil, Trash2, FileText, Send, Calendar
} from 'lucide-react';

function OfferLetterIndex() {
  const [employees, setEmployees] = useState([]);
  const [loadingOffer, setLoadingOffer] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState(null);
  const [isEmployeeViewOnly, setIsEmployeeViewOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");

  const fetchEmployees = async () => {
    setLoadingOffer(true);
    try {
      const data = await api.getOfferLetterEmployees();
      setEmployees(data || []);
    } catch { }
    setLoadingOffer(false);
  };

  useEffect(() => {
    fetchEmployees();
    const interval = setInterval(() => fetchEmployees(), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveEmployee = async (data) => {
    const isEdit = !!selectedEmployeeForEdit;
    try {
      if (isEdit) {
        await api.updateOfferLetterEmployee(selectedEmployeeForEdit._id || selectedEmployeeForEdit.id, data);
      } else {
        await api.createOfferLetterEmployee(data);
      }
      setIsModalOpen(false);
      setSelectedEmployeeForEdit(null);
      fetchEmployees();
    } catch (e) { alert(`Failed: ${e.response?.data?.message || e.message}`); }
  };

  const handleEditEmployee = (emp) => { setSelectedEmployeeForEdit(emp); setIsEmployeeViewOnly(false); setIsModalOpen(true); };
  const handleViewEmployee = (emp) => { setSelectedEmployeeForEdit(emp); setIsEmployeeViewOnly(true); setIsModalOpen(true); };
  
  const handleDeleteEmployee = async (id) => {
    if (!confirm("Delete selection?")) return;
    try {
      await api.deleteOfferLetterEmployee(id);
      fetchEmployees();
    } catch { }
  };

  const toggleAllSelection = () => {
    const visibleIds = filteredEmployees.map(e => e._id || e.id);
    const allSelected = visibleIds.every(id => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) visibleIds.forEach(id => next.delete(id));
    else visibleIds.forEach(id => next.add(id));
    setSelectedIds(next);
  };

  const handleBulkSendOffer = async (template, company, type) => {
    setShowBulkModal(false);
    setIsBulkSending(true);
    const idsArray = Array.from(selectedIds);
    let count = 0;
    for (const curId of idsArray) {
      const emp = employees.find(e => (e._id || e.id) === curId);
      if (!emp) continue;
      setBulkProgress(`Processing ${++count}/${idsArray.length}: ${emp.name}`);
      try {
        const genData = await api.generateOfferLetter({ employeeId: curId, letterType: type, companyName: company });
        const htmlContent = genData.content || genData;
        const contentWithoutHeader = htmlContent.replace(/<div style="text-align: center; border-bottom: 2px solid #0056b3;[\s\S]*?<\/div>/i, '');
        const pdfDataUri = await generateOfferLetterPdf(contentWithoutHeader, template);
        
        await api.sendOfferLetterEmail({
          employeeId: curId,
          pdfBase64: pdfDataUri,
          emailBody: `Dear ${emp.name},\n\We are pleased to offer you the position at ${company}.\n\nPlease find the detailed offer letter attached.\n\nBest Regards,\nHR Team`,
          companyName: company
        });
      } catch (err) { console.error(err); }
    }
    setIsBulkSending(false);
    setBulkProgress("");
    setSelectedIds(new Set());
    fetchEmployees();
    alert("Bulk sending process completed! Check individual statuses.");
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const id = emp._id || emp.id;
      const s = searchTerm.toLowerCase();
      const matchNameOrDesig = (emp.name || "").toLowerCase().includes(s) || (emp.designation || "").toLowerCase().includes(s);
      
      const statusMap = emp.status || "Pending";
      const matchStatus = filterStatus === 'All' || statusMap === filterStatus;

      let matchDate = true;
      if (fromDate || toDate) {
        const dateVal = emp.createdAt || emp.joining_date;
        const d = dateVal ? new Date(dateVal) : null;
        if (d && !isNaN(d.getTime())) {
          if (fromDate) {
            const start = new Date(fromDate);
            start.setHours(0, 0, 0, 0);
            if (d < start) matchDate = false;
          }
          if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            if (d > end) matchDate = false;
          }
        } else {
          matchDate = false;
        }
      }
      return matchNameOrDesig && matchStatus && matchDate;
    });
  }, [employees, searchTerm, filterStatus, fromDate, toDate]);

  const offerStats = useMemo(() => ({
    total: employees.length,
    sent: employees.filter(e => e.status === 'Offer Sent').length,
    accepted: employees.filter(e => e.status === 'Accepted').length,
    rejected: employees.filter(e => e.status === 'Rejected').length,
    pending: employees.filter(e => e.status === 'Pending' || !e.status).length
  }), [employees]);

  const selectedBg = 'var(--accent-soft)';

  return (
    <div className="offer-letter-wrapper ol-container">
      <header style={{ marginBottom: '2rem', textAlign: 'center', paddingTop: '1rem' }}>
        <h1 style={{ fontWeight: 800, color: 'var(--accent-color)', marginBottom: '0.25rem', letterSpacing: '-0.025em' }}>Offer Letter Management</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Professional Document Automation</p>
      </header>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="ol-stats-grid" style={{ marginBottom: '1.5rem' }}>
          {[
            { label: 'Total', val: offerStats.total, color: 'var(--accent-color)', icon: <Users size={16} /> },
            { label: 'Sent', val: offerStats.sent, color: 'var(--accent-color)', icon: <Send size={16} /> },
            { label: 'Accepted', val: offerStats.accepted, color: 'var(--success-text)', icon: <CheckCircle size={16} /> },
            { label: 'Rejected', val: offerStats.rejected, color: 'var(--error-text)', icon: <XCircle size={16} /> },
            { label: 'Pending', val: offerStats.pending, color: 'var(--pending-text)', icon: <Clock size={16} /> }
          ].map((s, i) => (
            <div key={i} style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
              <div style={{ color: s.color, marginBottom: '0.25rem' }}>{s.icon}</div>
              <h3 style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.label}</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{s.val}</p>
            </div>
          ))}
        </div>

        <div className="ol-toolbar-container" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2rem', padding: '0.4rem 0.6rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflowX: 'auto', scrollbarWidth: 'thin', whiteSpace: 'nowrap' }}>
          <div className="ol-toolbar-group" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '10px' }}>
              {['All', 'Pending', 'Offer Sent', 'Accepted', 'Rejected'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: filterStatus === s ? 'var(--card-bg)' : 'transparent', color: filterStatus === s ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>{s}</button>
              ))}
            </div>
            <div className="ol-hide-mobile" style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 8px' }} />
            <div className="ol-hide-mobile" style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '10px' }}>
              <button onClick={() => setViewMode('grid')} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: viewMode === 'grid' ? 'var(--card-bg)' : 'transparent', color: viewMode === 'grid' ? 'var(--accent-color)' : 'var(--text-muted)', cursor: 'pointer' }}><LayoutGrid size={18} /></button>
              <button onClick={() => setViewMode('list')} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: viewMode === 'list' ? 'var(--card-bg)' : 'transparent', color: viewMode === 'list' ? 'var(--accent-color)' : 'var(--text-muted)', cursor: 'pointer' }}><List size={18} /></button>
            </div>
          </div>

          <div className="ol-toolbar-group" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
              <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '6px 8px 6px 28px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', outline: 'none', width: '100px', fontSize: '0.75rem' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-tertiary)', padding: '4px 6px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: '0.7rem', color: 'var(--text-primary)', outline: 'none', width: '90px' }} title="From Date" />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>-</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: '0.7rem', color: 'var(--text-primary)', outline: 'none', width: '90px' }} title="To Date" />
              {(fromDate || toDate) && <button onClick={() => { setFromDate(''); setToDate(''); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--error-text)', padding: '0' }}><XCircle size={12} /></button>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-tertiary)', padding: '4px 6px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={toggleAllSelection}>
              <input
                type="checkbox"
                checked={filteredEmployees.length > 0 && filteredEmployees.every(e => selectedIds.has(e._id || e.id))}
                onChange={() => { }}
                style={{ width: '14px', height: '14px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>Select</span>
            </div>

            {selectedIds.size > 0 && (
              <button
                onClick={() => setShowBulkModal(true)}
                style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)' }}
              >
                <Send size={14} /> Bulk Send ({selectedIds.size})
              </button>
            )}

            <button onClick={() => { setSelectedEmployeeForEdit(null); setIsEmployeeViewOnly(false); setIsModalOpen(true); }} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}><Plus size={14} /> New</button>
            <button onClick={() => setShowTemplateManager(true)} style={{ background: 'var(--success-text)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}><FileText size={14} /> Templates</button>
            
            <button onClick={() => api.downloadOfferLetterExcelTemplate()} style={{ border: '1px solid var(--success-text)', background: 'transparent', color: 'var(--success-text)', padding: '6px 12px', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Download Excel Template">
                <Download size={14} />
            </button>
            
            <button onClick={() => document.getElementById('olImportFile').click()} style={{ background: 'var(--success-text)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Upload size={14} /> Import
            </button>
            
            <input type="file" accept=".xlsx, .xls, .csv" id="olImportFile" style={{ display: 'none' }} onChange={async e => {
                const file = e.target.files[0];
                if (!file) return;
                const fd = new FormData(); 
                fd.append('file', file);
                try {
                    await api.uploadOfferLetterExcel(fd);
                    fetchEmployees();
                    alert("Bulk import successful!");
                } catch (err) {
                    alert("Upload failed: " + (err.response?.data?.message || err.message));
                }
                e.target.value = null; // reset
            }} />
          </div>
        </div>

        {filteredEmployees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-tertiary)', borderRadius: '24px', border: '2px dashed var(--border-color)', color: 'var(--text-muted)' }}>
            No employees found.
          </div>
        ) : viewMode === 'grid' ? (
          <div className="ol-responsive-grid">
            {filteredEmployees.map(emp => {
                const uniqueId = emp._id || emp.id;
              return (<div key={uniqueId} style={{
                background: selectedIds.has(uniqueId) ? selectedBg : 'var(--card-bg)',
                padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)',
                boxShadow: 'var(--card-shadow)', position: 'relative', display: 'flex', flexDirection: 'column',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                minHeight: '160px'
              }} onClick={(e) => {
                if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'svg' && e.target.tagName !== 'path' && e.target.tagName !== 'INPUT') {
                  const s = new Set(selectedIds); s.has(uniqueId) ? s.delete(uniqueId) : s.add(uniqueId); setSelectedIds(s);
                }
              }}>
                <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '4px' }}>
                  <button onClick={(e) => { e.stopPropagation(); handleViewEmployee(emp); }} style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }} title="View"><Eye size={16} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleEditEmployee(emp); }} style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }} title="Edit"><Pencil size={16} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(uniqueId); }} style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--error-text)' }} title="Delete"><Trash2 size={16} /></button>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '1.25rem' }}>
                  <input type="checkbox" checked={selectedIds.has(uniqueId)} onChange={() => {
                    const s = new Set(selectedIds); s.has(uniqueId) ? s.delete(uniqueId) : s.add(uniqueId); setSelectedIds(s);
                  }} style={{ cursor: 'pointer', marginTop: '4px' }} onClick={e => e.stopPropagation()} />
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '60px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25 }}>{emp.name || "Unnamed"}</h3>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={14} /> {(emp.createdAt || emp.joining_date) ? new Date(emp.createdAt || emp.joining_date).toLocaleDateString() : 'N/A'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {emp.status && (
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', padding: '4px 8px', borderRadius: '6px',
                          background: emp.status === 'Accepted' ? 'var(--success-bg)' : emp.status === 'Rejected' ? 'var(--error-bg)' : 'var(--pending-bg)',
                          color: emp.status === 'Accepted' ? 'var(--success-text)' : emp.status === 'Rejected' ? 'var(--error-text)' : 'var(--pending-text)'
                        }}>
                          {emp.status}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedEmployee(emp); }}
                        style={{
                          background: emp.status === 'Accepted' ? 'var(--success-text)' : 'var(--accent-color)',
                          color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px',
                          fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem',
                          boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)'
                        }}
                      >
                        {emp.status?.includes('Sent') ? 'VIEW' : 'MANAGE'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>);
            })}
          </div>
        ) : (
          <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                <thead style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                  <tr>
                    <th style={{ padding: '1rem', width: '48px', textAlign: 'center' }}>
                      <input type="checkbox" checked={filteredEmployees.length > 0 && filteredEmployees.every(e => selectedIds.has(e._id || e.id))} onChange={toggleAllSelection} style={{ cursor: 'pointer' }} />
                    </th>
                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Name</th>
                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Designation</th>
                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Date</th>
                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Status</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => {
                      const uniqueId = emp._id || emp.id;
                    return (<tr key={uniqueId} style={{ borderBottom: '1px solid var(--border-color)', background: selectedIds.has(uniqueId) ? selectedBg : 'transparent', transition: 'background 0.2s' }}>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedIds.has(uniqueId)} onChange={() => { const s = new Set(selectedIds); s.has(uniqueId) ? s.delete(uniqueId) : s.add(uniqueId); setSelectedIds(s); }} style={{ cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '1rem' }}><div style={{ fontWeight: 750 }}>{emp.name || "Unnamed"}</div></td>
                      <td style={{ padding: '1rem' }}>{emp.designation || "N/A"}</td>
                      <td style={{ padding: '1rem' }}>{(emp.createdAt || emp.joining_date) ? new Date(emp.createdAt || emp.joining_date).toLocaleDateString() : 'N/A'}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 800, padding: '4px 10px', borderRadius: '6px',
                          background: emp.status === 'Accepted' ? 'var(--success-bg)' : emp.status === 'Rejected' ? 'var(--error-bg)' : 'var(--pending-bg)',
                          color: emp.status === 'Accepted' ? 'var(--success-text)' : emp.status === 'Rejected' ? 'var(--error-text)' : 'var(--pending-text)'
                        }}>
                          {emp.status || 'Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button onClick={() => setSelectedEmployee(emp)} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>MANAGE</button>
                          <button onClick={() => handleViewEmployee(emp)} style={{ padding: '6px', background: 'transparent', border:'none', cursor: 'pointer', color: 'var(--text-muted)' }}><Eye size={16} /></button>
                          <button onClick={() => handleEditEmployee(emp)} style={{ padding: '6px', background: 'transparent', border:'none', cursor: 'pointer', color: 'var(--text-muted)' }}><Pencil size={16} /></button>
                        </div>
                      </td>
                    </tr>)
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {isModalOpen && <AddEmployeeModal onClose={() => setIsModalOpen(false)} onSave={handleSaveEmployee} initialData={selectedEmployeeForEdit} isViewOnly={isEmployeeViewOnly} />}
        {selectedEmployee && <LetterModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} onSuccess={() => { setSelectedEmployee(null); fetchEmployees(); }} />}
        {showBulkModal && <BulkSendModal selectedCount={selectedIds.size} onClose={() => setShowBulkModal(false)} onStart={handleBulkSendOffer} />}
        {showTemplateManager && <ManageTemplatesModal onClose={() => setShowTemplateManager(false)} />}

        {isBulkSending && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}
          >
            <div className="ol-spinner" style={{ marginBottom: '2rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>🚀 Dispatched In Progress</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', fontWeight: 600 }}>{bulkProgress}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default OfferLetterIndex;
