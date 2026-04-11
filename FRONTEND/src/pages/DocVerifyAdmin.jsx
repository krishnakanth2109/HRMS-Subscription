import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Users, CheckCircle2, Clock, Eye, Building2,
  RefreshCw, FileText, X, AlertCircle, Search, ChevronRight,
  Download, StickyNote, Trash2, CheckSquare, Square
} from 'lucide-react';
import { getAllCompanies } from '../api';
import api from '../api';

const API_URL = import.meta.env.VITE_API_URL_DEVELOPMENT || 'http://localhost:5000';

// ─── Document category layout (same structure as the form) ─────────────────
const DOC_CATEGORIES = [
  {
    title: 'Resume',
    icon: '📄',
    color: 'indigo',
    fields: [{ fieldKey: 'resume', label: 'Resume' }],
  },
  {
    title: 'Education Documents',
    icon: '🎓',
    color: 'blue',
    fields: [
      { fieldKey: 'cert_10th', label: '10th Certificate' },
      { fieldKey: 'cert_intermediate', label: 'Intermediate Certificate' },
      { fieldKey: 'cert_graduation', label: 'Graduation Certificate' },
      { fieldKey: 'cert_post_graduation', label: 'Post Graduation Certificate' },
    ],
  },
  {
    title: 'ID Proof',
    icon: '🪪',
    color: 'emerald',
    fields: [
      { fieldKey: 'pan_card', label: 'PAN Card' },
      { fieldKey: 'aadhaar_card', label: 'Aadhaar Card' },
      { fieldKey: 'passport', label: 'Passport' },
    ],
  },
  {
    title: 'Passport Size Photograph',
    icon: '📸',
    color: 'amber',
    fields: [{ fieldKey: 'passport_photo', label: 'Passport Size Photograph' }],
  },
  {
    title: 'Experience Documents',
    icon: '💼',
    color: 'purple',
    fields: [
      { fieldKey: 'exp_offer_letter', label: 'Offer Letter' },
      { fieldKey: 'exp_hike_letter', label: 'Hike Letter' },
      { fieldKey: 'exp_relieving_letter', label: 'Relieving Letter' },
      { fieldKey: 'exp_resignation_acceptance', label: 'Resignation Acceptance Document' },
      { fieldKey: 'exp_bank_statement', label: 'Bank Statement' },
      { fieldKey: 'exp_experience_letter', label: 'Experience Letter' },
    ],
  },
  {
    title: 'Pass Book',
    icon: '🏦',
    color: 'rose',
    fields: [{ fieldKey: 'passbook_photo', label: 'Pass Book Photo' }],
  },
];

const COLOR_MAP = {
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  amber: 'bg-amber-50 border-amber-200 text-amber-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  rose: 'bg-rose-50 border-rose-200 text-rose-700',
};

const statusBadge = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  submitted: 'bg-blue-100 text-blue-700 border-blue-200',
  verified: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

// ─── Document Row in viewer ─────────────────────────────────────────────────
const DocRow = ({ doc, onToggleVerify, onView }) => {
  const hasFile = !!doc.fileUrl;
  return (
    <div className={`flex items-center justify-between gap-3 p-4 rounded-2xl border-2 transition-all ${hasFile ? doc.adminVerified ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50/50 opacity-60'}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Admin verify checkbox */}
        <button
          onClick={() => hasFile && onToggleVerify(doc.fieldKey, !doc.adminVerified)}
          disabled={!hasFile}
          className={`flex-shrink-0 transition-all ${hasFile ? 'cursor-pointer' : 'cursor-not-allowed'}`}
          title={hasFile ? (doc.adminVerified ? 'Mark as unverified' : 'Mark as verified') : 'No document uploaded'}
        >
          {doc.adminVerified
            ? <CheckSquare size={22} className="text-emerald-600" />
            : <Square size={22} className={hasFile ? 'text-slate-400 hover:text-emerald-500' : 'text-slate-200'} />
          }
        </button>
        <div className="min-w-0">
          <p className={`font-semibold text-sm ${hasFile ? 'text-slate-800' : 'text-slate-400'}`}>{doc.label}</p>
          {doc.uploadedAt && <p className="text-[10px] text-slate-400">Uploaded: {new Date(doc.uploadedAt).toLocaleDateString('en-IN')}</p>}
          {!hasFile && <p className="text-[10px] text-slate-400 italic">Not uploaded by candidate</p>}
        </div>
      </div>
      {hasFile && (
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => onView(doc.fileUrl)} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 flex items-center gap-1 transition-all">
            <Eye size={12} /> View
          </button>
          <a href={doc.fileUrl.includes('/upload/') ? doc.fileUrl.replace('/upload/', '/upload/fl_attachment/') : doc.fileUrl} download target="_blank" rel="noopener noreferrer"
            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 flex items-center gap-1 transition-all">
            <Download size={12} /> Download
          </a>
          {doc.adminVerified && (
            <span className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-1">
              <CheckCircle2 size={12} /> Verified
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Admin Viewer ──────────────────────────────────────────────────────
const DocVerifyAdmin = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => { fetchCompanies(); }, []);
  useEffect(() => { if (selectedCompany) fetchRecords(selectedCompany); else setRecords([]); }, [selectedCompany]);
  useEffect(() => { if (selectedRecord) setNotes(selectedRecord.adminNotes || ''); }, [selectedRecord]);

  const fetchCompanies = async () => {
    try {
      const res = await getAllCompanies();
      const data = Array.isArray(res.data) ? res.data : res;
      setCompanies(data);
      if (data.length === 1) setSelectedCompany(data[0]._id);
    } catch (e) { console.error(e); }
  };

  const fetchRecords = async (companyId) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/doc-verification/company/${companyId}`);
      const data = res.data.data || [];
      setRecords(data);
      if (data.length > 0 && !selectedRecord) setSelectedRecord(data[0]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleToggleVerify = async (fieldKey, verified) => {
    if (!selectedRecord) return;
    try {
      const res = await api.patch(`/api/doc-verification/verify-doc/${selectedRecord._id}`, { fieldKey, verified });
      const updated = res.data.data;
      setSelectedRecord(updated);
      setRecords(prev => prev.map(r => r._id === updated._id ? updated : r));
    } catch (e) {
      alert('Failed to update verification status');
    }
  };

  const handleVerifyAll = async () => {
    if (!selectedRecord) return;
    try {
      const res = await api.patch(`/api/doc-verification/verify-all/${selectedRecord._id}`);
      const updated = res.data.data;
      setSelectedRecord(updated);
      setRecords(prev => prev.map(r => r._id === updated._id ? updated : r));
      alert('All uploaded documents have been verified!');
    } catch (e) {
      alert('Failed to verify all documents');
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedRecord) return;
    setSavingNotes(true);
    try {
      const res = await api.patch(`/api/doc-verification/notes/${selectedRecord._id}`, { notes });
      const updated = res.data.data;
      setSelectedRecord(updated);
      setRecords(prev => prev.map(r => r._id === updated._id ? updated : r));
    } catch (e) {
      alert('Failed to save notes');
    } finally { setSavingNotes(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this verification record permanently?')) return;
    try {
      await api.delete(`/api/doc-verification/${id}`);
      setRecords(prev => prev.filter(r => r._id !== id));
      if (selectedRecord?._id === id) setSelectedRecord(records.find(r => r._id !== id) || null);
    } catch { alert('Delete failed'); }
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = !search || r.name?.toLowerCase().includes(search.toLowerCase()) || r.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: records.length,
    submitted: records.filter(r => r.status === 'submitted').length,
    verified: records.filter(r => r.status === 'verified').length,
    pending: records.filter(r => r.status === 'pending').length,
  };

  // Build doc map for selected record
  const docMap = {};
  (selectedRecord?.documents || []).forEach(d => { docMap[d.fieldKey] = d; });

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="bg-white rounded-2xl overflow-hidden max-w-5xl w-full max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b bg-slate-50">
              <span className="font-bold text-slate-700">Document Preview</span>
              <div className="flex gap-2">
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700">Open in New Tab</a>
                <button onClick={() => setPreviewUrl(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-all"><X size={20} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-50 flex items-center justify-center">
              <img src={previewUrl} alt="Document Preview" className="max-w-full mx-auto rounded-xl shadow-lg border border-slate-200" />
            </div>
          </div>
        </div>
      )}

      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-violet-600 text-white rounded-2xl shadow-lg">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Document Verification Portal</h1>
              <p className="text-sm text-slate-500 font-medium">Review and verify candidate submitted documents</p>
            </div>
          </div>
          <select
            value={selectedCompany}
            onChange={e => setSelectedCompany(e.target.value)}
            className="p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none font-bold text-slate-700 min-w-[220px]"
          >
            <option value="">-- Select Company --</option>
            {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>

        {/* Stats */}
        {selectedCompany && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Invited', value: stats.total, icon: <Users size={20} />, color: 'bg-slate-100 text-slate-700' },
              { label: 'Pending', value: stats.pending, icon: <Clock size={20} />, color: 'bg-amber-100 text-amber-700' },
              { label: 'Submitted', value: stats.submitted, icon: <FileText size={20} />, color: 'bg-blue-100 text-blue-700' },
              { label: 'Verified', value: stats.verified, icon: <CheckCircle2 size={20} />, color: 'bg-emerald-100 text-emerald-700' },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4 shadow-sm">
                <div className={`p-3 rounded-xl ${s.color}`}>{s.icon}</div>
                <div>
                  <p className="text-2xl font-black text-slate-800">{s.value}</p>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Main 2-column layout */}
        {selectedCompany && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* ── Sidebar: Candidate List ── */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 230px)' }}>
              <div className="p-4 border-b border-slate-100">
                <div className="relative mb-3">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search candidates..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                  />
                </div>
                <div className="flex gap-1">
                  {['all', 'pending', 'submitted', 'verified'].map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                      className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wide rounded-lg transition-all ${filterStatus === s ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <RefreshCw className="animate-spin text-violet-400" size={32} />
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <AlertCircle className="mx-auto mb-2" size={32} />
                    <p className="text-sm font-medium">No records found</p>
                  </div>
                ) : filteredRecords.map(rec => {
                  const uploaded = rec.documents?.filter(d => d.fileUrl).length || 0;
                  const total = rec.documents?.length || 0;
                  const isSelected = selectedRecord?._id === rec._id;
                  return (
                    <button
                      key={rec._id}
                      onClick={() => setSelectedRecord(rec)}
                      className={`w-full text-left p-4 border-b border-slate-100 hover:bg-violet-50/50 transition-all flex items-center gap-3 ${isSelected ? 'bg-violet-50 border-l-4 border-l-violet-600' : ''}`}
                    >
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0 ${isSelected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {(rec.name || rec.email || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm truncate ${isSelected ? 'text-violet-900' : 'text-slate-800'}`}>{rec.name || rec.email}</p>
                        <p className="text-xs text-slate-500 truncate">{rec.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${statusBadge[rec.status]}`}>{rec.status}</span>
                          <span className="text-[10px] text-slate-400">{uploaded}/{total} docs</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className={`flex-shrink-0 ${isSelected ? 'text-violet-600' : 'text-slate-300'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Main: Document Viewer ── */}
            <div className="lg:col-span-8">
              {!selectedRecord ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center" style={{ height: 'calc(100vh - 230px)' }}>
                  <div className="text-center text-slate-400">
                    <ShieldCheck className="mx-auto mb-4" size={64} />
                    <p className="font-bold text-lg">Select a candidate to view documents</p>
                    <p className="text-sm mt-2">Click any name from the left panel</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Candidate Header Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-violet-100 text-violet-700 rounded-2xl flex items-center justify-center text-2xl font-black">
                          {(selectedRecord.name || selectedRecord.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-slate-900">{selectedRecord.fullName || selectedRecord.name}</h2>
                          <p className="text-slate-500 text-sm">{selectedRecord.email}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedRecord.role && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold">{selectedRecord.role}</span>}
                            {selectedRecord.department && <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">{selectedRecord.department}</span>}
                            {selectedRecord.employmentType && <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold">{selectedRecord.employmentType}</span>}
                            <span className={`px-3 py-1 rounded-full text-xs font-black border ${statusBadge[selectedRecord.status]}`}>{selectedRecord.status.toUpperCase()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {(() => {
                          const uploaded = selectedRecord.documents?.filter(d => d.fileUrl) || [];
                          const allVerified = uploaded.length > 0 && uploaded.every(d => d.adminVerified);
                          if (uploaded.length > 0 && !allVerified) {
                            return (
                              <button onClick={handleVerifyAll} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all shadow-md flex items-center gap-2">
                                <CheckCircle2 size={16} /> Verify All
                              </button>
                            );
                          }
                          return null;
                        })()}
                        <button onClick={() => handleDelete(selectedRecord._id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                          <Trash2 size={24} />
                        </button>
                      </div>
                    </div>
                    {/* Verification progress bar */}
                    {(() => {
                      const uploaded = selectedRecord.documents?.filter(d => d.fileUrl) || [];
                      const verified = uploaded.filter(d => d.adminVerified).length;
                      return (
                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-xs font-bold text-slate-500 mb-1">Documents Uploaded</p>
                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-1">
                              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${uploaded.length > 0 ? (uploaded.length / (selectedRecord.documents?.length || 1)) * 100 : 0}%` }} />
                            </div>
                            <p className="text-xs text-slate-500">{uploaded.length} of {selectedRecord.documents?.length || 0}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-xs font-bold text-slate-500 mb-1">Admin Verified</p>
                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-1">
                              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${uploaded.length > 0 ? (verified / uploaded.length) * 100 : 0}%` }} />
                            </div>
                            <p className="text-xs text-slate-500">{verified} of {uploaded.length} uploaded docs</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Documents by category */}
                  <div className="space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 500px)' }}>
                    {DOC_CATEGORIES.map(cat => {
                      const catDocs = cat.fields.map(f => {
                        const existing = docMap[f.fieldKey];
                        return existing || { fieldKey: f.fieldKey, label: f.label, fileUrl: null, adminVerified: false };
                      });
                      const uploaded = catDocs.filter(d => d.fileUrl).length;
                      if (uploaded === 0) return null; // Don't render if no docs in this category

                      return (
                        <div key={cat.title} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-b border-slate-200">
                            <h3 className="font-black text-slate-700 text-sm flex items-center gap-2">
                              <span>{cat.icon}</span> {cat.title}
                            </h3>
                            <span className="text-xs text-slate-400 font-semibold">{uploaded} uploaded</span>
                          </div>
                          <div className="p-4 space-y-3">
                            {catDocs.map(doc => (
                              <DocRow key={doc.fieldKey} doc={doc} onToggleVerify={handleToggleVerify} onView={setPreviewUrl} />
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Show all empty categories too if nothing was uploaded */}
                    {selectedRecord.documents?.filter(d => d.fileUrl).length === 0 && (
                      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                        <AlertCircle className="mx-auto mb-3 text-slate-300" size={48} />
                        <p className="font-bold text-slate-400 text-lg">No documents uploaded yet</p>
                        <p className="text-slate-400 text-sm mt-1">The candidate has not uploaded any documents yet</p>
                      </div>
                    )}
                  </div>


                </div>
              )}
            </div>
          </div>
        )}

        {!selectedCompany && (
          <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center shadow-sm">
            <Building2 className="mx-auto mb-4 text-slate-300" size={64} />
            <p className="text-xl font-black text-slate-400">Select a company to view verification records</p>
            <p className="text-sm text-slate-400 mt-2 font-medium">Use the dropdown at the top right to get started</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocVerifyAdmin;
