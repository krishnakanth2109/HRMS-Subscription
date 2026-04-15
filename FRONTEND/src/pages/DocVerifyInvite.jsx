import React, { useState, useEffect } from 'react';
import {
  Send, Plus, X, RefreshCw, Mail, Building2, UserPlus, History,
  CheckCircle, Clock, ShieldCheck, Trash2, FileCheck
} from 'lucide-react';
import { getAllCompanies } from '../api';
import api from '../api';

const BASE_URL = import.meta.env.VITE_API_URL_DEVELOPMENT || 'http://localhost:5000';
const FORM_BASE = window.location.origin;

const DEFAULT_SUBJECT = 'Document Verification Required – [Company Name]';
const DEFAULT_MESSAGE = `Dear [NAME],

We are pleased to inform you that you have been selected as part of the onboarding process at [COMPANY].

As part of our documentation requirements, we kindly request you to upload your necessary documents using the secure link below.

[FORM_LINK]

Please ensure you upload clear, readable copies of all required documents. 

You have been invited as [ROLE] ([EMPLOYMENT_TYPE]) in the [DEPT] department.

If you face any issues, please reach out to the HR team immediately.

Warm regards,
HR Team
[COMPANY]`;

const DocVerifyInvite = () => {
  const [activeTab, setActiveTab] = useState('single');
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [sending, setSending] = useState(false);

  const [emailSubject, setEmailSubject] = useState(DEFAULT_SUBJECT);
  const [emailMessage, setEmailMessage] = useState(DEFAULT_MESSAGE);

  const [singleData, setSingleData] = useState({
    email: '', name: '', fullName: '', role: '', department: 'IT', employmentType: ''
  });

  const [existingEmployees, setExistingEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  const [bulkRows, setBulkRows] = useState([{
    email: '', name: '', fullName: '', role: '', department: 'IT', employmentType: ''
  }]);

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchCompanies();
    fetchExistingEmployees();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      fetchHistory(selectedCompany);
    } else {
      setHistory([]);
    }
    setSelectedEmployeeId('');
    setSingleData({ email: '', name: '', fullName: '', role: '', department: 'IT', employmentType: '' });
  }, [selectedCompany]);

  const fetchCompanies = async () => {
    try {
      const res = await getAllCompanies();
      const data = Array.isArray(res.data) ? res.data : res;
      setCompanies(data);
      if (data.length === 1) setSelectedCompany(data[0]._id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const fetchHistory = async (companyId) => {
    setLoadingHistory(true);
    try {
      const res = await api.get(`/api/doc-verification/company/${companyId}`);
      setHistory(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchExistingEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const res = await api.get('/api/employees');
      const data = Array.isArray(res.data) ? res.data : [];
      setExistingEmployees(data);
    } catch (e) {
      console.error('Error fetching existing employees:', e);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const getCurrentRole = (employee) => {
    return employee?.currentRole || employee?.designation || employee?.role || employee?.experienceDetails?.[employee.experienceDetails.length - 1]?.role || '';
  };

  const getCurrentDepartment = (employee) => {
    return employee?.currentDepartment || employee?.department || employee?.experienceDetails?.[employee.experienceDetails.length - 1]?.department || '';
  };

  const getCurrentEmploymentType = (employee) => {
    return employee?.employmentType || employee?.employment_type || employee?.employeeType || '';
  };

  const handleExistingEmployeeChange = async (employeeId) => {
    setSelectedEmployeeId(employeeId);
    if (!employeeId) {
      setSingleData({ email: '', name: '', fullName: '', role: '', department: 'IT', employmentType: '' });
      return;
    }

    try {
      const res = await api.get(`/api/employees/${employeeId}`);
      const emp = res.data;
      setSingleData({
        email: emp.email || '',
        name: emp.name || '',
        fullName: emp.name || '',
        role: getCurrentRole(emp),
        department: getCurrentDepartment(emp) || 'IT',
        employmentType: getCurrentEmploymentType(emp) || ''
      });
    } catch (e) {
      console.error('Error fetching employee details:', e);
    }
  };

  const getCompanyName = () => {
    const c = companies.find(c => c._id === selectedCompany);
    return c ? c.name : '[COMPANY NAME]';
  };

  const parseSubject = () => emailSubject.replace('[Company Name]', getCompanyName());

  const handleSendSingle = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return alert('Please select a company first');
    setSending(true);
    try {
      // Backend saves to DB, fires email in background (fire-and-forget — same as offerLetterRoutes)
      // No separate mail call needed — responds instantly
      await api.post('/api/doc-verification/invite', {
        ...singleData,
        companyId: selectedCompany,
        formBaseUrl: FORM_BASE,
        emailSubject: parseSubject(),
        emailMessage, // raw template — backend replaces [NAME],[ROLE],[FORM_LINK] etc.
      });

      setSingleData({ email: '', name: '', fullName: '', role: '', department: 'IT', employmentType: '' });
      fetchHistory(selectedCompany);
      alert('Document verification invitation sent successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const handleSendBulk = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return alert('Please select a company first');
    const validRows = bulkRows.filter(r => r.email && r.email.includes('@'));
    if (!validRows.length) return alert('Add at least one valid email');
    setSending(true);
    try {
      // Backend saves all invites to DB and fires all emails in background (fire-and-forget)
      // No separate mail loop needed — responds instantly
      await api.post('/api/doc-verification/bulk-invite', {
        employees: validRows,
        companyId: selectedCompany,
        formBaseUrl: FORM_BASE,
        emailSubject: parseSubject(),
        emailMessage, // raw template — backend replaces placeholders per-employee with their unique formLink
      });

      setBulkRows([{ email: '', name: '', fullName: '', role: '', department: 'IT', employmentType: '' }]);
      fetchHistory(selectedCompany);
      alert(`${validRows.length} invitation(s) sent successfully!`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send bulk invitations');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Delete this record permanently?')) return;
    try {
      await api.delete(`/api/doc-verification/${id}`);
      setHistory(prev => prev.filter(r => r._id !== id));
    } catch {
      alert('Failed to delete');
    }
  };

  const addBulkRow = () => setBulkRows([...bulkRows, { email: '', name: '', fullName: '', role: '', department: 'IT', employmentType: '' }]);
  const updateBulkRow = (idx, field, value) => {
    const updated = [...bulkRows];
    updated[idx][field] = value;
    setBulkRows(updated);
  };

  const statusColor = (status) => {
    if (status === 'verified') return 'bg-emerald-100 text-emerald-700';
    if (status === 'submitted') return 'bg-blue-100 text-blue-700';
    return 'bg-amber-100 text-amber-700';
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans antialiased text-slate-800">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-8 space-y-6">

          <div className="flex items-center gap-3">
            <div className="p-3 bg-violet-600 text-white rounded-2xl shadow-lg">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Document Verification</h1>
              <p className="text-sm text-slate-500 font-medium">Invite candidates to upload their documents securely</p>
            </div>
          </div>

          {/* EMAIL TEMPLATE */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4 text-violet-600 font-bold uppercase text-xs tracking-widest">
              <Mail size={16} /> Email Template
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 ml-1 block mb-1">Subject Line</label>
                <input
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 ml-1 block mb-1">Message Template</label>
                <textarea
                  rows={10}
                  value={emailMessage}
                  onChange={e => setEmailMessage(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none font-mono text-xs leading-relaxed"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 Placeholders: [NAME], [ROLE], [DEPT], [EMPLOYMENT_TYPE], [COMPANY], [FORM_LINK]
                </p>
              </div>
            </div>
          </div>

          {/* COMPANY SELECT */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
              <Building2 size={14} className="text-violet-500" /> Select Company
            </label>
            {loadingCompanies ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <RefreshCw className="animate-spin" size={16} /> Loading companies...
              </div>
            ) : (
              <select
                value={selectedCompany}
                onChange={e => setSelectedCompany(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none font-bold text-slate-700"
              >
                <option value="">-- Select Company --</option>
                {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            )}

            {selectedCompany && (
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                  <UserPlus size={14} className="text-violet-500" /> Select Existing Employee
                </label>
                {loadingEmployees ? (
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <RefreshCw className="animate-spin" size={16} /> Loading employees...
                  </div>
                ) : (
                  <select
                    value={selectedEmployeeId}
                    onChange={e => handleExistingEmployeeChange(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none font-medium text-slate-700"
                  >
                    <option value="">-- Select Existing Employee --</option>
                    {existingEmployees
                      .filter(emp => String(emp.company) === String(selectedCompany))
                      .map(emp => (
                        <option key={emp.employeeId} value={emp.employeeId}>
                          {emp.name} • {emp.employeeId} • {emp.email}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* INVITE FORMS */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex gap-2 mb-6 border-b border-slate-200">
              {['single', 'bulk'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 font-bold text-sm capitalize transition-all ${activeTab === tab ? 'text-violet-600 border-b-2 border-violet-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {tab === 'single' ? 'Single Invite' : 'Bulk Invite'}
                </button>
              ))}
            </div>

            {/* SINGLE INVITE */}
            {activeTab === 'single' && (
              <form onSubmit={handleSendSingle} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Email Address *</label>
                    <input required type="email" placeholder="candidate@email.com"
                      className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                      value={singleData.email}
                      onChange={e => setSingleData({ ...singleData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">First Name *</label>
                    <input required placeholder="John"
                      className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                      value={singleData.name}
                      onChange={e => setSingleData({ ...singleData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Full Name *</label>
                    <input required placeholder="John Michael Doe"
                      className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                      value={singleData.fullName}
                      onChange={e => setSingleData({ ...singleData, fullName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Role *</label>
                    <input required placeholder="Software Engineer"
                      className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none"
                      value={singleData.role}
                      onChange={e => setSingleData({ ...singleData, role: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Department *</label>
                    <select required className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-violet-500 outline-none"
                      value={singleData.department}
                      onChange={e => setSingleData({ ...singleData, department: e.target.value })}
                    >
                      <option value="IT">IT</option>
                      <option value="NON-IT">NON-IT</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Employment Type *</label>
                    <select required className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-violet-500 outline-none"
                      value={singleData.employmentType}
                      onChange={e => setSingleData({ ...singleData, employmentType: e.target.value })}
                    >
                      <option value="">Select Type</option>
                      <option value="Full-Time">Full-Time</option>
                      <option value="Intern">Intern</option>
                      <option value="Contract">Contract</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={sending || !selectedCompany}
                  className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold hover:from-violet-700 hover:to-purple-700 transition-all shadow-xl disabled:from-slate-300 disabled:to-slate-300 flex items-center justify-center gap-2"
                >
                  {sending ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                  {sending ? 'Sending...' : 'Send Document Verification Invitation'}
                </button>
              </form>
            )}

            {/* BULK INVITE */}
            {activeTab === 'bulk' && (
              <div className="space-y-4">
                {bulkRows.map((row, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <div className="flex-1 min-w-[180px]">
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Email</label>
                        <input placeholder="email@company.com" className="w-full p-2 text-sm border rounded-lg outline-none focus:ring-1 ring-violet-500" value={row.email} onChange={e => updateBulkRow(idx, 'email', e.target.value)} />
                      </div>
                      <div className="flex-1 min-w-[100px]">
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Name</label>
                        <input placeholder="Name" className="w-full p-2 text-sm border rounded-lg outline-none" value={row.name} onChange={e => updateBulkRow(idx, 'name', e.target.value)} />
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Full Name</label>
                        <input placeholder="Full Name" className="w-full p-2 text-sm border rounded-lg outline-none" value={row.fullName} onChange={e => updateBulkRow(idx, 'fullName', e.target.value)} />
                      </div>
                      <div className="flex-1 min-w-[100px]">
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Role</label>
                        <input placeholder="Role" className="w-full p-2 text-sm border rounded-lg outline-none" value={row.role} onChange={e => updateBulkRow(idx, 'role', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Dept</label>
                        <select className="p-2 text-sm border rounded-lg bg-white outline-none" value={row.department} onChange={e => updateBulkRow(idx, 'department', e.target.value)}>
                          <option value="IT">IT</option>
                          <option value="NON-IT">NON-IT</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Type</label>
                        <select className="p-2 text-sm border rounded-lg bg-white outline-none" value={row.employmentType} onChange={e => updateBulkRow(idx, 'employmentType', e.target.value)}>
                          <option value="">Type</option>
                          <option value="Full-Time">FT</option>
                          <option value="Intern">INT</option>
                          <option value="Contract">CON</option>
                        </select>
                      </div>
                      <button onClick={() => setBulkRows(bulkRows.filter((_, i) => i !== idx))} className="self-end p-2 text-slate-300 hover:text-red-500 transition-colors">
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-3">
                  <button onClick={addBulkRow} className="flex-1 py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:border-violet-300 hover:text-violet-600 transition-all flex items-center justify-center gap-2">
                    <Plus size={18} /> Add Row
                  </button>
                  <button onClick={handleSendBulk} disabled={sending || !selectedCompany} className="flex-[2] py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-xl disabled:bg-slate-300 flex items-center justify-center gap-2">
                    {sending ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
                    {sending ? 'Sending...' : `Send ${bulkRows.length} Invitation(s)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: HISTORY ── */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[calc(100vh-100px)] sticky top-8">
            <div className="p-6 bg-violet-900 text-white flex items-center justify-between">
              <div>
                <h2 className="font-black text-xl flex items-center gap-2"><History size={20} /> Verification Logs</h2>
                <p className="text-[10px] text-violet-300 uppercase tracking-widest font-bold mt-1">Document Submission Status</p>
              </div>
              <button onClick={() => selectedCompany && fetchHistory(selectedCompany)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all">
                <RefreshCw size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {!selectedCompany && (
                <div className="text-center py-20 text-slate-400">
                  <Building2 className="mx-auto mb-3" size={40} />
                  <p className="font-medium text-sm">Select a company to view logs</p>
                </div>
              )}
              {selectedCompany && loadingHistory && (
                <div className="text-center py-10">
                  <RefreshCw className="animate-spin mx-auto text-violet-400" size={24} />
                </div>
              )}
              {selectedCompany && !loadingHistory && history.length === 0 && (
                <div className="text-center py-20 text-slate-400">
                  <FileCheck className="mx-auto mb-3" size={40} />
                  <p className="font-medium text-sm">No invitations sent yet</p>
                </div>
              )}
              {history.map(item => (
                <div key={item._id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{item.name || item.email}</p>
                      <p className="text-xs text-slate-500">{item.email}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    {item.role && <p>🧑‍💼 {item.role} • {item.department}</p>}
                    {item.employmentType && <p>📋 {item.employmentType}</p>}
                    <p>📅 Invited: {new Date(item.invitedAt).toLocaleDateString('en-IN')}</p>
                    {item.submittedAt && <p>✅ Submitted: {new Date(item.submittedAt).toLocaleDateString('en-IN')}</p>}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <span className="text-[10px] text-slate-400">
                      {item.documents?.filter(d => d.fileUrl).length || 0}/{item.documents?.length || 0} docs uploaded
                    </span>
                    <button onClick={() => handleDeleteRecord(item._id)} className="ml-auto p-1 text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DocVerifyInvite;