import React, { useState, useEffect } from 'react';
import {
  Users, CheckCircle2, Clock, Building2, AlertCircle, 
  Search, ChevronRight, XCircle, Printer, FileCheck2, UserCircle2
} from 'lucide-react';
import api, { getAllCompanies } from '../api'; // Adjust import path if needed

// ─── Reusing Document Categories for Checklist Generation ────────────────
const DOC_CATEGORIES = [
  {
    title: 'Resume',
    icon: '📄',
    fields: [{ fieldKey: 'resume', label: 'Resume' }],
  },
  {
    title: 'Education Documents',
    icon: '🎓',
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
    fields: [
      { fieldKey: 'pan_card', label: 'PAN Card' },
      { fieldKey: 'aadhaar_card', label: 'Aadhaar Card' },
      { fieldKey: 'passport', label: 'Passport' },
    ],
  },
  {
    title: 'Passport Size Photograph',
    icon: '📸',
    fields: [{ fieldKey: 'passport_photo', label: 'Passport Size Photograph' }],
  },
  {
    title: 'Experience Documents',
    icon: '💼',
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
    title: 'Bank Pass Book',
    icon: '🏦',
    fields: [{ fieldKey: 'passbook_photo', label: 'Pass Book Photo' }],
  },
];

const totalRequiredDocs = DOC_CATEGORIES.reduce((acc, cat) => acc + cat.fields.length, 0);

// Helper to determine document status
const getDocStatus = (fieldKey, uploadedDocs = []) => {
  const doc = uploadedDocs.find(d => d.fieldKey === fieldKey);
  if (!doc || !doc.fileUrl) return 'missing';
  if (doc.adminVerified) return 'verified';
  return 'pending';
};

const StatusBadge = ({ status }) => {
  switch (status) {
    case 'verified':
      return <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200"><CheckCircle2 size={14} /> Verified</span>;
    case 'pending':
      return <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-200"><Clock size={14} /> Pending Review</span>;
    default:
      return <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-200"><XCircle size={14} /> Missing</span>;
  }
};

const HRChecklist = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchCompanies(); }, []);
  useEffect(() => { if (selectedCompany) fetchRecords(selectedCompany); else setRecords([]); }, [selectedCompany]);

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
      if (data.length > 0) setSelectedRecord(data[0]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filteredRecords = records.filter(r => 
    !search || (r.name?.toLowerCase().includes(search.toLowerCase()) || r.email?.toLowerCase().includes(search.toLowerCase()))
  );

  const handlePrint = () => {
    window.print();
  };

  // Calculate stats for selected record
  const getRecordStats = (record) => {
    if (!record) return { verified: 0, pending: 0, missing: totalRequiredDocs };
    let verified = 0, pending = 0, missing = 0;
    
    DOC_CATEGORIES.forEach(cat => {
      cat.fields.forEach(f => {
        const status = getDocStatus(f.fieldKey, record.documents);
        if (status === 'verified') verified++;
        else if (status === 'pending') pending++;
        else missing++;
      });
    });
    return { verified, pending, missing };
  };

  const stats = getRecordStats(selectedRecord);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans print:bg-white print:min-h-0">
      
      {/* ─── Top Navbar (Hidden on Print) ─── */}
      <div className="p-6 max-w-[1400px] mx-auto print:hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
              <FileCheck2 size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">HR Onboarding Checklist</h1>
              <p className="text-sm text-slate-500 font-medium">Track and print final document verifications</p>
            </div>
          </div>
          <select
            value={selectedCompany}
            onChange={e => setSelectedCompany(e.target.value)}
            className="p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 min-w-[220px]"
          >
            <option value="">-- Select Company --</option>
            {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>

        {/* Main Layout Grid */}
        {selectedCompany ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* ── Sidebar: Candidate List ── */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-180px)] print:hidden">
              <div className="p-4 border-b border-slate-100">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search employees..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-20 text-indigo-400"><Clock className="animate-spin" size={32} /></div>
                ) : filteredRecords.length === 0 ? (
                  <div className="text-center py-16 text-slate-400"><AlertCircle className="mx-auto mb-2" size={32} /><p>No employees found</p></div>
                ) : (
                  filteredRecords.map(rec => {
                    const recStats = getRecordStats(rec);
                    const isSelected = selectedRecord?._id === rec._id;
                    const progress = Math.round((recStats.verified / totalRequiredDocs) * 100);
                    
                    return (
                      <button
                        key={rec._id}
                        onClick={() => setSelectedRecord(rec)}
                        className={`w-full text-left p-4 border-b border-slate-100 hover:bg-indigo-50/50 transition-all flex items-center gap-3 ${isSelected ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''}`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {(rec.name || rec.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold text-sm truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>{rec.fullName || rec.name || rec.email}</p>
                          <p className="text-xs text-slate-500 truncate">{rec.role || 'No Role'}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progress}%` }}></div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500">{recStats.verified}/{totalRequiredDocs}</span>
                          </div>
                        </div>
                        <ChevronRight size={16} className={`flex-shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── Main Panel: Checklist View ── */}
            <div className="lg:col-span-8 print:col-span-12 print:block">
              {!selectedRecord ? (
                <div className="bg-white rounded-2xl border border-slate-200 flex items-center justify-center h-[calc(100vh-180px)] print:hidden">
                  <div className="text-center text-slate-400">
                    <UserCircle2 className="mx-auto mb-4" size={64} />
                    <p className="font-bold text-lg">Select an employee to view checklist</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
                  
                  {/* Action Bar */}
                  <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center print:hidden">
                    <h2 className="font-bold text-slate-700">Checklist Summary</h2>
                    <button onClick={handlePrint} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition-all">
                      <Printer size={16} /> Print Checklist
                    </button>
                  </div>

                  <div className="p-8 print:p-0">
                    {/* Employee Identity Header */}
                    <div className="flex items-start justify-between mb-8 border-b border-slate-200 pb-8 print:border-black">
                      <div>
                        <h2 className="text-3xl font-black text-slate-900">{selectedRecord.fullName || selectedRecord.name}</h2>
                        <p className="text-slate-500 mt-1">{selectedRecord.email}</p>
                        <div className="flex flex-wrap gap-3 mt-4">
                          <div className="bg-slate-100 px-3 py-1.5 rounded-lg">
                            <span className="text-xs text-slate-400 font-bold block uppercase">Role</span>
                            <span className="font-semibold text-slate-800 text-sm">{selectedRecord.role || 'N/A'}</span>
                          </div>
                          <div className="bg-slate-100 px-3 py-1.5 rounded-lg">
                            <span className="text-xs text-slate-400 font-bold block uppercase">Department</span>
                            <span className="font-semibold text-slate-800 text-sm">{selectedRecord.department || 'N/A'}</span>
                          </div>
                          <div className="bg-slate-100 px-3 py-1.5 rounded-lg">
                            <span className="text-xs text-slate-400 font-bold block uppercase">Checklist Date</span>
                            <span className="font-semibold text-slate-800 text-sm">{new Date().toLocaleDateString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Overall Progress Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-8 print:gap-2">
                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center print:border-emerald-500">
                        <p className="text-3xl font-black text-emerald-600">{stats.verified}</p>
                        <p className="text-xs font-bold text-emerald-800 uppercase mt-1">Verified Docs</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-center print:border-amber-500">
                        <p className="text-3xl font-black text-amber-600">{stats.pending}</p>
                        <p className="text-xs font-bold text-amber-800 uppercase mt-1">Pending Review</p>
                      </div>
                      <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center print:border-red-500">
                        <p className="text-3xl font-black text-red-600">{stats.missing}</p>
                        <p className="text-xs font-bold text-red-800 uppercase mt-1">Missing Docs</p>
                      </div>
                    </div>

                    {/* Detailed Checklist */}
                    <div className="space-y-6">
                      {DOC_CATEGORIES.map(category => (
                        <div key={category.title} className="border border-slate-200 rounded-xl overflow-hidden print:border-black">
                          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center gap-2 print:bg-slate-100 print:border-black">
                            <span>{category.icon}</span>
                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">{category.title}</h3>
                          </div>
                          <div className="divide-y divide-slate-100 print:divide-black">
                            {category.fields.map(field => {
                              const status = getDocStatus(field.fieldKey, selectedRecord.documents);
                              return (
                                <div key={field.fieldKey} className="flex justify-between items-center p-3 px-5 print:p-2 print:px-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded flex items-center justify-center border-2 print:border-black ${status === 'verified' ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300'}`}>
                                      {status === 'verified' && <CheckCircle2 size={14} className="print:hidden" />}
                                      {/* On print, if verified, just show a simple checkmark character to ensure printer handles it well */}
                                      {status === 'verified' && <span className="hidden print:inline text-black text-xs font-bold">✓</span>}
                                    </div>
                                    <span className="text-sm font-semibold text-slate-700 print:text-black">{field.label}</span>
                                  </div>
                                  <StatusBadge status={status} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* HR Sign Off Space for Printing */}
                    <div className="hidden print:block mt-16 pt-8 border-t-2 border-black">
                      <div className="flex justify-between items-end">
                        <div className="w-1/2">
                          <p className="font-bold text-sm mb-8">Verified By (HR Name & Signature):</p>
                          <div className="border-b border-black w-64"></div>
                        </div>
                        <div className="w-1/2 text-right">
                          <p className="font-bold text-sm mb-8">Date of Final Verification:</p>
                          <div className="border-b border-black w-48 inline-block"></div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center shadow-sm print:hidden">
            <Building2 className="mx-auto mb-4 text-slate-300" size={64} />
            <p className="text-xl font-black text-slate-400">Select a company to view the checklist</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HRChecklist;