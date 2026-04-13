import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Plus, X, Trash2, RefreshCw, Briefcase, Mail, Building2, UserPlus, History, Banknote,
  CheckCircle, Clock, FileText, Upload, Download, File, Paperclip, Eye, ExternalLink
} from 'lucide-react';
import { getAllCompanies } from '../api';
import api from '../api';

const SendOnboardingForm = () => {
  const [activeTab, setActiveTab] = useState('single');
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // Document Management States
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState([]); // For single invite
  const [bulkSelectedDocuments, setBulkSelectedDocuments] = useState({}); // For bulk invite

  // Configuration States
  const [emailSubject, setEmailSubject] = useState('Welcome to [Company Name] – Complete Your Onboarding Process');
  const [formLink, setFormLink] = useState(`https://vwsync.com/employee-onboarding`);
  const [emailMessage, setEmailMessage] = useState(`Dear [NAME],

We are pleased to welcome you to [COMPANY].

Congratulations on your appointment as [ROLE] ([EMPLOYMENT_TYPE]) in the [DEPT] department. We are excited to have you join our team and look forward to your contributions.

As part of the onboarding process, please complete your employee profile using the link below:

[ONBOARDING_LINK]

The information provided will help us set up your official records, system access, and other employment formalities.

Kindly complete the form at your earliest convenience. If you have any questions or need assistance, please contact the HR team.

We look forward to working with you.

Warm regards,  
HR Team  
[COMPANY]`);

  const [singleData, setSingleData] = useState({ email: '', name: '', role: '', department: 'IT', employmentType: '', salary: '' });
  const [bulkRows, setBulkRows] = useState([{ email: '', name: '', role: '', department: 'IT', employmentType: '', salary: '' }]);
  const [sending, setSending] = useState(false);
  const [sentHistory, setSentHistory] = useState([]);
  const [acceptedCandidates, setAcceptedCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  useEffect(() => {
    const init = async () => {
      const loadedCompanies = await fetchCompanies();
      fetchAcceptedCandidates();
    };
    init();
  }, []);

useEffect(() => {
  if (selectedCompany) {
    fetchCompanyDocuments();
    fetchHistory(selectedCompany, companies);
  } else {
    setDocuments([]);
    setSentHistory([]); // ❌ clear logs if no company selected
  }
}, [selectedCompany]);

  const fetchCompanies = async () => {
    try {
      const response = await getAllCompanies();
      const data = Array.isArray(response.data) ? response.data : response;
      setCompanies(data);
      if (data.length === 1) {
        setSelectedCompany(data[0]._id);
      }
      return data;
    } catch (error) {
      console.error('Error fetching companies:', error);
      return [];
    } finally {
      setLoadingCompanies(false);
    }
  };

  // ✅ FIXED: Strictly enforce filtering on the frontend to avoid DB bleeding issues
  const fetchHistory = async (companyId = null, currentCompanies = companies) => {
    try {
      const url = companyId
        ? `/api/invited-employees/history?companyId=${companyId}`
        : `/api/invited-employees/history`;
      const response = await api.get(url);

      let historyData = response.data.data || [];

      // ✅ FILTER 1: ALWAYS keep only history records for companies present in the admin's company dropdown
      if (currentCompanies && currentCompanies.length > 0) {
        const validIds = currentCompanies.map(c => c._id?.toString());
        historyData = historyData.filter(item => {
          const cId = item.company?._id?.toString() || item.company?.toString();
          return validIds.includes(cId);
        });
      }

      // ✅ FILTER 2: If a specific company is selected, strictly filter to show ONLY that company
      if (companyId) {
        historyData = historyData.filter(item => {
          const cId = item.company?._id?.toString() || item.company?.toString();
          return cId === companyId.toString();
        });
      }

      setSentHistory(historyData);
    } catch (error) {
      console.error("History fetch error", error);
    }
  };

  const fetchAcceptedCandidates = async () => {
    try {
      setLoadingCandidates(true);
      const res = await api.get('/api/offer-letters/employees');
      const all = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
      // Filter for only 'Accepted' candidates
      const accepted = all.filter(c => c.status === 'Accepted');
      setAcceptedCandidates(accepted);
    } catch (err) {
      console.error("Error fetching accepted candidates:", err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleAutofillCandidate = (candidateId) => {
    const cand = acceptedCandidates.find(c => c._id === candidateId);
    if (!cand) return;

    setSingleData({
      email: cand.email || '',
      name: cand.name || '',
      role: cand.designation || '',
      department: (cand.department === 'IT' || cand.department === 'NON-IT') ? cand.department : 'IT',
      employmentType: cand.employment_type || '',
      salary: cand.compensation?.gross_salary || ''
    });

    // Optionally set the company if matched
    if (cand.companyId) {
      setSelectedCompany(cand.companyId);
    }
  };

  const fetchCompanyDocuments = async () => {
    try {
      console.log('Fetching documents for company:', selectedCompany);
      const response = await api.get(`/api/invited-employees/documents/company/${selectedCompany}`);
      console.log('Documents response:', response.data);

      if (response.data.success) {
        setDocuments(response.data.data || []);
        console.log('Documents set:', response.data.data.length);
      } else {
        setDocuments([]);
        console.log('No documents found');
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      console.error("Error details:", error.response?.data);
      setDocuments([]);
    }
  };

  const handleDocumentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log('Uploading file:', file.name);

    if (!selectedCompany) {
      alert('Please select a company first');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('companyId', selectedCompany);
    formData.append('description', '');

    setUploadingDocument(true);
    try {
      const response = await api.post('/api/invited-employees/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      console.log('Upload response:', response.data);
      alert('Document uploaded successfully!');
      fetchCompanyDocuments(); // Refresh the documents list
      setShowDocumentUpload(false); // Close upload section
    } catch (error) {
      console.error('Upload error:', error);
      console.error('Upload error details:', error.response?.data);
      alert(error.response?.data?.error || 'Failed to upload document');
    } finally {
      setUploadingDocument(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      await api.delete(`/api/invited-employees/documents/${documentId}`);
      alert('Document deleted successfully');
      fetchCompanyDocuments();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete document');
    }
  };

  const handleViewDocument = (fileUrl) => {
    if (!fileUrl) return;
    const win = window.open(fileUrl, '_blank');
    if (win) win.focus();
  };

  const handleDownloadDocument = (fileUrl, fileName) => {
    if (!fileUrl) return;

    let downloadUrl = fileUrl;
    if (fileUrl.includes('/upload/')) {
      downloadUrl = fileUrl.replace('/upload/', '/upload/fl_attachment/');
    }

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', fileName || 'document.pdf');
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const toggleDocumentSelection = (docId) => {
    setSelectedDocuments(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const toggleBulkDocumentSelection = (rowIndex, docId) => {
    setBulkSelectedDocuments(prev => {
      const current = prev[rowIndex] || [];
      const updated = current.includes(docId)
        ? current.filter(id => id !== docId)
        : [...current, docId];
      return { ...prev, [rowIndex]: updated };
    });
  };

  const getSelectedCompanyName = () => {
    const comp = companies.find(c => c._id === selectedCompany);
    return comp ? comp.name : "[COMPANY NAME]";
  };

  const parseMessage = (msg, user) => {
    return msg
      .replace(/\[NAME\]/g, user.name || 'Employee')
      .replace(/\[ROLE\]/g, user.role || 'Team Member')
      .replace(/\[DEPT\]/g, user.department || 'General')
      .replace(/\[EMPLOYMENT_TYPE\]/g, user.employmentType || 'Full Time')
      .replace(/\[COMPANY\]/g, getSelectedCompanyName())
      .replace(/\[ONBOARDING_LINK\]/g, formLink);
  };

  const parseSubject = () => {
    return emailSubject.replace(/\[Company Name\]/g, getSelectedCompanyName());
  };

  const handleSendSingle = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return alert('Please select a company first');
    setSending(true);
    try {
      await api.post('/api/invited-employees/invite', {
        ...singleData,
        companyId: selectedCompany,
        requiredDocuments: selectedDocuments
      });

      await api.post('/api/mail/send-onboarding', {
        recipientEmail: singleData.email,
        emailSubject: parseSubject(),
        emailMessage: parseMessage(emailMessage, singleData),
        formLink: formLink
      });

      setSingleData({ email: '', name: '', role: '', department: 'IT', employmentType: '', salary: '' });
      setSelectedDocuments([]);
      fetchHistory(selectedCompany || null, companies); // ✅ Refresh scoped to current view
      alert("Invitation sent successfully!");
    } catch (error) {
      alert(error.response?.data?.error || "Error");
    } finally {
      setSending(false);
    }
  };

  const handleSendBulk = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return alert('Select Company');
    const validRows = bulkRows.filter(r => r.email && r.email.includes('@'));
    setSending(true);
    try {
      const employeesWithDocs = validRows.map((emp, index) => ({
        ...emp,
        requiredDocuments: bulkSelectedDocuments[index] || []
      }));

      await api.post('/api/invited-employees/invite-bulk', {
        employees: employeesWithDocs,
        companyId: selectedCompany
      });

      for (let emp of validRows) {
        await api.post('/api/mail/send-onboarding', {
          recipientEmail: emp.email,
          emailSubject: parseSubject(),
          emailMessage: parseMessage(emailMessage, emp),
          formLink: formLink
        });
      }
      setBulkRows([{ email: '', name: '', role: '', department: 'IT', employmentType: '', salary: '' }]);
      setBulkSelectedDocuments({});
      fetchHistory(selectedCompany || null, companies); // ✅ Refresh scoped to current view
      alert("Bulk emails sent!");
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure? This will permanently delete the invitation record from the database.")) return;
    try {
      await api.delete(`/api/invited-employees/${id}`);
      setSentHistory(prev => prev.filter(item => item._id !== id));
    } catch (error) {
      alert("Delete failed");
    }
  };

  const addBulkRow = () => setBulkRows([...bulkRows, { email: '', name: '', role: '', department: 'IT', employmentType: '', salary: '' }]);
  const updateBulkRow = (index, field, value) => {
    const updated = [...bulkRows];
    updated[index][field] = value;
    setBulkRows(updated);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans antialiased text-slate-800">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT COLUMN: SETUP & FORM */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <UserPlus className="text-blue-600" size={32} /> Invite Employee to Onboarding Process
            </h1>
          </div>

          {/* 1. CONFIGURATION CARD */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4 text-blue-600 font-bold uppercase text-xs tracking-widest">
              <Mail size={16} /> Email Customization
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 ml-1">Subject Line</label>
                <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 ml-1">Onboarding Link</label>
                <input value={formLink} onChange={e => setFormLink(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 ml-1">Message Template</label>
              <textarea rows={10} value={emailMessage} onChange={e => setEmailMessage(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xs leading-relaxed" />
              <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap gap-x-4">
                <span>💡 Use:[NAME], [ROLE], [DEPT], [EMPLOYMENT_TYPE], [COMPANY],[ONBOARDING_LINK]</span>
              </div>
            </div>
          </div>

          {/* 2. COMPANY SELECTION */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-500" /> Autofill from Accepted Offers
            </label>
            <select
              onChange={(e) => handleAutofillCandidate(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 transition-all appearance-none cursor-pointer"
            >
              <option value="">-- Select an Accepted Candidate --</option>
              {acceptedCandidates.map(c => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.designation})
                </option>
              ))}
              {acceptedCandidates.length === 0 && !loadingCandidates && (
                <option disabled>No accepted candidates available</option>
              )}
            </select>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Building2 size={14} className="text-blue-500" /> Select Company
            </label>
            {loadingCompanies ? (
              <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-lg">
                <RefreshCw className="animate-spin text-blue-500" size={18} />
                <span className="text-slate-500 text-sm">Loading companies...</span>
              </div>
            ) : (
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 transition-all appearance-none cursor-pointer"
              >
                <option value="">-- Select Company --</option>
                {companies.map((company) => (
                  <option key={company._id} value={company._id}>
                    {company.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2.5 DOCUMENT MANAGEMENT SECTION */}
          {selectedCompany && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-blue-600 font-bold uppercase text-xs tracking-widest">
                  <Paperclip size={16} /> Document Management
                </div>
                <button
                  onClick={() => setShowDocumentUpload(!showDocumentUpload)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-2"
                >
                  <Upload size={14} /> Upload Document
                </button>
              </div>

              {showDocumentUpload && (
                <div className="mb-4 p-4 bg-blue-50 rounded-xl border-2 border-dashed border-blue-200">
                  <label className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="text-blue-600" size={32} />
                    <span className="text-sm font-semibold text-blue-700">Click to upload document</span>
                    <span className="text-xs text-slate-500">PDF, DOCX, JPG, PNG (Max 10MB)</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={handleDocumentUpload}
                      className="hidden"
                      disabled={uploadingDocument}
                    />
                  </label>
                  {uploadingDocument && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-blue-600">
                      <RefreshCw className="animate-spin" size={16} />
                      <span className="text-sm">Uploading...</span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase">Available Documents ({documents.length})</h4>
                {documents.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl">
                    <File className="mx-auto text-slate-300" size={40} />
                    <p className="text-sm text-slate-400 mt-2">No documents uploaded yet</p>
                    <p className="text-xs text-slate-400 mt-1">Upload documents to make them available for employees</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {documents.map(doc => (
                      <div key={doc._id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 transition-all">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <File className="text-blue-600 flex-shrink-0" size={16} />
                              <h5 className="text-sm font-bold text-slate-900 truncate">{doc.fileName}</h5>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {doc.fileType?.toUpperCase()} • {(doc.fileSize / 1024).toFixed(1)} KB
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">

                          <button
                            onClick={() => handleDownloadDocument(doc.fileUrl, doc.fileName)}
                            className="flex-1 px-3 py-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-all text-xs font-semibold flex items-center justify-center gap-1"
                            title="Download"
                          >
                            <Download size={14} />
                            Download
                          </button>
                          <button
                            onClick={() => handleDeleteDocument(doc._id)}
                            className="px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. INVITE FORMS */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex gap-2 mb-6 border-b border-slate-200">
              <button onClick={() => setActiveTab('single')} className={`px-6 py-3 font-bold text-sm transition-all ${activeTab === 'single' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                Single Invite
              </button>
              <button onClick={() => setActiveTab('bulk')} className={`px-6 py-3 font-bold text-sm transition-all ${activeTab === 'bulk' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                Bulk Invite
              </button>
            </div>

            {activeTab === 'single' && (
              <form onSubmit={handleSendSingle} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 ml-1 block mb-1">Email Address*</label>
                    <input
                      required
                      type="email"
                      placeholder="Email address"
                      className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={singleData.email}
                      onChange={(e) => {
                        let value = e.target.value;

                        // Stop typing after .com
                        const index = value.indexOf(".com");
                        if (index !== -1) {
                          value = value.substring(0, index + 4);
                        }

                        setSingleData({ ...singleData, email: value });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 ml-1 block mb-1">
                      Full Name*
                    </label>
                    <input
                      required
                      placeholder="John Doe"
                      pattern="[A-Za-z\s]+"
                      title="Only alphabets and spaces are allowed"
                      onKeyPress={(e) => {
                        if (!/[A-Za-z\s]/.test(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={singleData.name}
                      onChange={e =>
                        setSingleData({ ...singleData, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 ml-1 block mb-1">
                      Role*
                    </label>
                    <input
                      required
                      placeholder="Software Engineer"
                      pattern="[A-Za-z\s]+"
                      title="Only alphabets and spaces are allowed"
                      onKeyPress={(e) => {
                        if (!/[A-Za-z\s]/.test(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={singleData.role}
                      onChange={e =>
                        setSingleData({ ...singleData, role: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 ml-1 block mb-1">Department*</label>
                    <select required className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={singleData.department} onChange={e => setSingleData({ ...singleData, department: e.target.value })}>
                      <option value="IT">IT</option>
                      <option value="NON-IT">NON-IT</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 ml-1 block mb-1">Employment Type*</label>
                    <select required className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={singleData.employmentType} onChange={e => setSingleData({ ...singleData, employmentType: e.target.value })}>
                      <option value="">Select Type</option>
                      <option value="Full-Time">Full-Time</option>
                      <option value="Intern">Intern</option>
                      <option value="Contract">Contract</option>
                    </select>
                  </div>
                  {singleData.employmentType && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 ml-1 block mb-1">Salary (Optional)</label>
                      <input
                        type="number"
                        placeholder="50000"
                        min="0"
                        value={singleData.salary}
                        onChange={(e) => setSingleData({ ...singleData, salary: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === '-' || e.key === 'e') {
                            e.preventDefault();
                          }
                        }}
                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Required Documents Selection */}
                {documents.length > 0 && (
                  <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <h4 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
                      <Paperclip size={16} /> Select Required Documents for this Employee
                    </h4>
                    <div className="space-y-2">
                      {documents.map(doc => (
                        <label key={doc._id} className="flex items-center gap-3 p-2 hover:bg-amber-100 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedDocuments.includes(doc._id)}
                            onChange={() => toggleDocumentSelection(doc._id)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <File className="text-blue-600" size={14} />
                          <span className="text-sm font-medium text-slate-700">{doc.fileName}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-amber-700 mt-3">
                      Selected documents ({selectedDocuments.length}) will be required for this employee during onboarding
                    </p>
                  </div>
                )}

                <button type="submit" disabled={sending || !selectedCompany} className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 transition-all shadow-xl disabled:from-slate-300 disabled:to-slate-300">
                  {sending ? "Sending..." : "Send Invitation"}
                </button>
              </form>
            )}

            {activeTab === 'bulk' && (
              <div className="space-y-4">
                <div className="space-y-3">
                  {bulkRows.map((row, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex flex-wrap gap-3 mb-3">
                        <div className="flex-1 min-w-[200px]">
                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Email</label>
                          <input placeholder="email@company.com" className="w-full p-2 text-sm border rounded-lg focus:ring-1 ring-blue-500 outline-none" value={row.email} onChange={e => updateBulkRow(idx, 'email', e.target.value)} />
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Name</label>
                          <input placeholder="Name" className="w-full p-2 text-sm border rounded-lg focus:ring-1 ring-blue-500 outline-none" value={row.name} onChange={e => updateBulkRow(idx, 'name', e.target.value)} />
                        </div>
                        <div className="flex-1 min-w-[100px]">
                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Role</label>
                          <input placeholder="Role" className="w-full p-2 text-sm border rounded-lg focus:ring-1 ring-blue-500 outline-none" value={row.role} onChange={e => updateBulkRow(idx, 'role', e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Dept</label>
                          <select className="p-2 text-sm border rounded-lg bg-white outline-none" value={row.department} onChange={e => updateBulkRow(idx, 'department', e.target.value)}>
                            <option value="IT">IT</option>
                            <option value="NON-IT">NON-IT</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Type</label>
                          <select className="p-2 text-sm border rounded-lg bg-white outline-none" value={row.employmentType} onChange={e => updateBulkRow(idx, 'employmentType', e.target.value)}>
                            <option value="">Type</option>
                            <option value="Full-time">FT</option>
                            <option value="Intern">INT</option>
                            <option value="Contract">CON</option>
                          </select>
                        </div>
                        {row.employmentType && (
                          <div className="w-20">
                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Sal</label>
                            <input
                              type="number"
                              placeholder="Amt"
                              min="0"
                              value={row.salary}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value >= 0) {
                                  updateBulkRow(idx, 'salary', value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === '-' || e.key === 'e') {
                                  e.preventDefault();
                                }
                              }}
                              className="w-full p-2 text-sm border rounded-lg focus:ring-1 ring-blue-500 outline-none"
                            />
                          </div>
                        )}
                        <button onClick={() => setBulkRows(bulkRows.filter((_, i) => i !== idx))} className="mb-1 p-2 text-slate-300 hover:text-red-500 transition-colors">
                          <X size={18} />
                        </button>
                      </div>

                      {/* Document Selection for Each Employee */}
                      {documents.length > 0 && (
                        <div className="mt-2 p-3 bg-white rounded-lg border border-amber-200">
                          <h5 className="text-xs font-bold text-slate-600 mb-2">Required Documents:</h5>
                          <div className="flex flex-wrap gap-2">
                            {documents.map(doc => (
                              <label key={doc._id} className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-md hover:bg-blue-50 cursor-pointer text-xs">
                                <input
                                  type="checkbox"
                                  checked={(bulkSelectedDocuments[idx] || []).includes(doc._id)}
                                  onChange={() => toggleBulkDocumentSelection(idx, doc._id)}
                                  className="w-3 h-3 text-blue-600 rounded"
                                />
                                <span className="text-slate-700">{doc.fileName}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={addBulkRow} className="flex-1 py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 transition-all flex items-center justify-center gap-2">
                    <Plus size={18} /> Add Employee Row
                  </button>
                  <button onClick={handleSendBulk} disabled={sending || !selectedCompany} className="flex-[2] py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-xl disabled:bg-slate-300">
                    {sending ? "Blasting Emails..." : `Confirm & Send ${bulkRows.length} Invitations`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: REAL-TIME HISTORY */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[calc(100vh-100px)] sticky top-8">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h2 className="font-black text-xl flex items-center gap-2 italic tracking-tighter"><History size={20} />Onboarding Logs</h2>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Employees Onboarding Status</p>
              </div>
              <button onClick={() => fetchHistory(selectedCompany || null, companies)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all">
                <RefreshCw size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50">
              {sentHistory.length === 0 && (
                <div className="text-center py-20">
                  <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><History size={32} /></div>
                  <p className="text-slate-400 text-sm font-medium">Select your company to View Respective onboarding logs</p>
                </div>
              )}
              {sentHistory.map((item) => (
                <div key={item._id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 truncate">{item.name || 'Unnamed Employee'}</h4>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                        <Mail size={10} /> {item.email}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${item.status === 'onboarded' ? 'bg-green-100 text-green-700' :
                      item.status === 'revoked' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-2.5 space-y-1 mb-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                      <Building2 size={12} className="text-blue-500" />
                      {item.company?.name || 'Unknown Company'}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                      <Briefcase size={12} /> {item.role} • <span className="text-blue-600">{item.department}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                      <span>{item.employmentType || 'FT'}</span>
                      {item.salary && (
                        <span className="text-green-600 ml-2 flex items-center gap-1">
                          <Banknote size={10} /> {item.salary}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-bold mt-2 pt-2 border-t border-slate-200">
                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] ${item.policyStatus === 'accepted' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                        {item.policyStatus === 'accepted' ? <CheckCircle size={8} /> : <FileText size={8} />}
                        Policy: {item.policyStatus || 'not accepted'}
                      </span>
                      {item.onboardedAt && (
                        <span className="text-slate-500 flex items-center gap-1">
                          <CheckCircle size={8} />
                          Onboarded: {new Date(item.onboardedAt).toLocaleDateString()}
                        </span>
                      )}
                      {item.policyAcceptedAt && (
                        <span className="text-slate-500 flex items-center gap-1">
                          <Clock size={8} />
                          Policy: {new Date(item.policyAcceptedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                      Invited: {new Date(item.invitedAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => handleDelete(item._id)}
                      className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete Permanently"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white border-t border-slate-100 text-[10px] text-center font-bold text-slate-400 uppercase tracking-widest">
              Total Invitations: {sentHistory.length}
            </div>
          </div>
        </div>

      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default SendOnboardingForm;