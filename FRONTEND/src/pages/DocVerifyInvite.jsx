import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Plus, X, RefreshCw, Mail, Building2, UserPlus, History,
  CheckCircle, Clock, ShieldCheck, Trash2, FileCheck, Download, Upload,
  User, Briefcase, ChevronDown, Edit, Grid, List
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getAllCompanies, baseURL } from '../api';
import api from '../api';
import Swal from 'sweetalert2';

const BASE_URL = baseURL;
const FORM_BASE = window.location.origin;

const DEFAULT_SUBJECT = 'Document Verification Required – [Company Name]';
const DEFAULT_MESSAGE = `<div>Dear [NAME],</div>
<div><br></div>
<div>We are pleased to inform you that you have been selected as part of the onboarding process at <strong>[COMPANY]</strong>.</div>
<div><br></div>
<div>As part of our documentation requirements, we kindly request you to upload your necessary documents using the secure link below.</div>
<div><br></div>
<div><a href="[FORM_LINK]" style="color: #7c3aed; font-weight: bold; text-decoration: underline;">[FORM_LINK]</a></div>
<div><br></div>
<div>Please ensure you upload clear, readable copies of all required documents.</div>
<div><br></div>
<div>You have been invited as <strong>[ROLE]</strong> (<strong>[EMPLOYMENT_TYPE]</strong>) in the <strong>[DEPT]</strong> department.</div>
<div><br></div>
<div>If you face any issues, please reach out to the HR team immediately.</div>
<div><br></div>
<div>Warm regards,</div>
<div><strong>HR Team</strong></div>
<div><strong>[COMPANY]</strong></div>`;

const DocVerifyInvite = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('bulk');
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [sending, setSending] = useState(false);

  const [templates, setTemplates] = useState(() => {
    const list = sessionStorage.getItem('doc_verify_templates_list');
    if (list) {
      try {
        return JSON.parse(list);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      { id: 'default', name: 'Default Template', subject: DEFAULT_SUBJECT, message: DEFAULT_MESSAGE }
    ];
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState(() => {
    return sessionStorage.getItem('doc_verify_selected_template_id') || 'default';
  });

  const [emailSubject, setEmailSubject] = useState(() => {
    return sessionStorage.getItem('doc_verify_email_subject') || DEFAULT_SUBJECT;
  });
  const [emailMessage, setEmailMessage] = useState(() => {
    return sessionStorage.getItem('doc_verify_email_message') || DEFAULT_MESSAGE;
  });

  const handleSelectTemplate = (id) => {
    const tpl = templates.find(t => t.id === id);
    if (tpl) {
      setSelectedTemplateId(tpl.id);
      sessionStorage.setItem('doc_verify_selected_template_id', tpl.id);
      setEmailSubject(tpl.subject);
      setEmailMessage(tpl.message);
      sessionStorage.setItem('doc_verify_email_subject', tpl.subject);
      sessionStorage.setItem('doc_verify_email_message', tpl.message);
    }
  };

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
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const handleOpenHistory = () => {
    if (!selectedCompany) {
      Swal.fire({
        icon: 'warning',
        title: 'Select Company',
        text: 'Please select a company first to view history logs.',
        confirmButtonColor: '#7c3aed'
      });
      return;
    }
    fetchHistory(selectedCompany);
    setShowHistoryModal(true);
  };

  useEffect(() => {
    fetchCompanies();
    fetchExistingEmployees();
    
    // Load custom templates list
    const list = sessionStorage.getItem('doc_verify_templates_list');
    let loadedTemplates = [
      { id: 'default', name: 'Default Template', subject: DEFAULT_SUBJECT, message: DEFAULT_MESSAGE }
    ];
    if (list) {
      try {
        loadedTemplates = JSON.parse(list);
        setTemplates(loadedTemplates);
      } catch (e) {
        console.error(e);
      }
    }

    const activeId = sessionStorage.getItem('doc_verify_selected_template_id') || 'default';
    setSelectedTemplateId(activeId);

    const activeTpl = loadedTemplates.find(t => t.id === activeId) || loadedTemplates[0];
    setEmailSubject(activeTpl.subject);
    setEmailMessage(activeTpl.message);
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

  const normalizeDepartment = (dept) => {
    if (!dept) return 'IT';
    const upper = dept.toString().toUpperCase().trim();
    if (upper === 'IT') return 'IT';
    if (upper.includes('NON')) return 'NON-IT';
    return 'IT';
  };

  const normalizeEmploymentType = (type) => {
    if (!type) return '';
    const clean = type.toString().toLowerCase().trim();
    if (clean.includes('full')) return 'Full-Time';
    if (clean.includes('intern')) return 'Intern';
    if (clean.includes('contract')) return 'Contract';
    return '';
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
        department: normalizeDepartment(getCurrentDepartment(emp)),
        employmentType: normalizeEmploymentType(getCurrentEmploymentType(emp))
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

  // Function to check if email already sent
  const checkEmailAlreadySent = async (email) => {
    try {
      const res = await api.get(`/api/doc-verification/company/${selectedCompany}/check/${encodeURIComponent(email)}`);
      return res.data.alreadySent || false;
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    }
  };

  const handleSendSingle = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return alert('Please select a company first');

    // Check if email already sent
    const alreadySent = await checkEmailAlreadySent(singleData.email);
    if (alreadySent) {
      Swal.fire({
        icon: 'warning',
        title: 'Already Sent!',
        html: `Document verification email has already been sent to <strong>${singleData.email}</strong> with PRF message.`,
        confirmButtonColor: '#7c3aed',
        confirmButtonText: 'OK'
      });
      return;
    }

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

      Swal.fire({
        icon: 'success',
        title: 'Sent Successfully!',
        text: 'Document verification invitation sent successfully!',
        confirmButtonColor: '#7c3aed'
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Failed!',
        text: err.response?.data?.error || 'Failed to send invitation',
        confirmButtonColor: '#7c3aed'
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendBulk = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return alert('Please select a company first');
    const validRows = bulkRows.filter(r => r.email && r.email.includes('@'));
    if (!validRows.length) return alert('Add at least one valid email');

    // Check for already sent emails in bulk
    const emailsToCheck = validRows.map(row => row.email);
    const alreadySentEmails = [];

    for (const email of emailsToCheck) {
      const alreadySent = await checkEmailAlreadySent(email);
      if (alreadySent) {
        alreadySentEmails.push(email);
      }
    }

    if (alreadySentEmails.length > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Some Emails Already Sent!',
        html: `The following emails have already received document verification with PRF message:<br/><br/>
               <strong>${alreadySentEmails.join('<br/>')}</strong><br/><br/>
               Do you want to continue sending to remaining emails?`,
        showCancelButton: true,
        confirmButtonColor: '#7c3aed',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, send remaining',
        cancelButtonText: 'Cancel'
      }).then(async (result) => {
        if (result.isConfirmed) {
          // Filter out already sent emails
          const remainingRows = validRows.filter(row => !alreadySentEmails.includes(row.email));
          await sendBulkInvites(remainingRows);
        }
      });
      return;
    }

    await sendBulkInvites(validRows);
  };

  const sendBulkInvites = async (rowsToSend) => {
    if (rowsToSend.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'No Emails to Send',
        text: 'All selected emails have already received invitations.',
        confirmButtonColor: '#7c3aed'
      });
      return;
    }

    setSending(true);
    try {
      // Backend saves all invites to DB and fires all emails in background (fire-and-forget)
      // No separate mail loop needed — responds instantly
      await api.post('/api/doc-verification/bulk-invite', {
        employees: rowsToSend,
        companyId: selectedCompany,
        formBaseUrl: FORM_BASE,
        emailSubject: parseSubject(),
        emailMessage, // raw template — backend replaces placeholders per-employee with their unique formLink
      });

      setBulkRows([{ email: '', name: '', fullName: '', role: '', department: 'IT', employmentType: '' }]);
      fetchHistory(selectedCompany);

      Swal.fire({
        icon: 'success',
        title: 'Sent Successfully!',
        text: `${rowsToSend.length} invitation(s) sent successfully!`,
        confirmButtonColor: '#7c3aed'
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Failed!',
        text: err.response?.data?.error || 'Failed to send bulk invitations',
        confirmButtonColor: '#7c3aed'
      });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteRecord = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#7c3aed',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/api/doc-verification/${id}`);
        setHistory(prev => prev.filter(r => r._id !== id));
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Record has been deleted.',
          confirmButtonColor: '#7c3aed'
        });
      } catch {
        Swal.fire({
          icon: 'error',
          title: 'Failed!',
          text: 'Failed to delete record',
          confirmButtonColor: '#7c3aed'
        });
      }
    }
  };

  const addBulkRow = () => setBulkRows([{ email: '', name: '', fullName: '', role: '', department: 'IT', employmentType: '' }, ...bulkRows]);
  const updateBulkRow = (idx, field, value) => {
    const updated = [...bulkRows];
    updated[idx][field] = value;
    setBulkRows(updated);
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        "Full Name": "John Doe",
        "Email": "johndoe@example.com",
        "Role": "Software Engineer",
        "Department": "IT",
        "Employment Type": "Full-Time"
      },
      {
        "Full Name": "Jane Smith",
        "Email": "janesmith@example.com",
        "Role": "HR Specialist",
        "Department": "NON-IT",
        "Employment Type": "Intern"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "document_verification_template.xlsx");
  };

  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          Swal.fire({
            icon: 'error',
            title: 'Empty File',
            text: 'The selected sheet contains no rows.',
            confirmButtonColor: '#7c3aed'
          });
          return;
        }

        const mappedRows = data.map(row => {
          const getVal = (fields) => {
            const foundKey = Object.keys(row).find(k => fields.includes(k.toLowerCase().trim()));
            return foundKey ? String(row[foundKey]).trim() : '';
          };

          const email = getVal(['email', 'email address', 'mail']);
          const fullName = getVal(['fullname', 'full name', 'name', 'employee name', 'candidate name']);
          const name = fullName.split(' ')[0] || '';
          const role = getVal(['role', 'designation', 'job title', 'position']);
          const department = normalizeDepartment(getVal(['department', 'dept']));
          const employmentType = normalizeEmploymentType(getVal(['employmenttype', 'employment type', 'type']));

          return { email, name, fullName, role, department, employmentType };
        });

        const validRows = mappedRows.filter(r => r.email || r.fullName);

        if (validRows.length === 0) {
          Swal.fire({
            icon: 'error',
            title: 'No Valid Data',
            text: 'Could not find columns for Email or Full Name in the Excel file.',
            confirmButtonColor: '#7c3aed'
          });
          return;
        }

        setBulkRows(validRows);
        Swal.fire({
          icon: 'success',
          title: 'Import Successful',
          text: `Loaded ${validRows.length} rows from Excel.`,
          confirmButtonColor: '#7c3aed'
        });
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Import Failed',
          text: err.message,
          confirmButtonColor: '#7c3aed'
        });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // reset
  };

  const statusColor = (status) => {
    if (status === 'verified') return 'bg-emerald-100 text-emerald-700';
    if (status === 'submitted') return 'bg-blue-100 text-blue-700';
    return 'bg-amber-100 text-amber-700';
  };

  const getFormattedMessagePreview = (msg) => {
    if (!msg) return '';
    // If the template is plain text (no HTML tags), convert newlines to <br> tags
    if (!/<\/?[a-z][\s\S]*>/i.test(msg)) {
      return msg.replace(/\n/g, '<br>');
    }
    return msg;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans antialiased text-slate-800">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── HEADER ── */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-violet-600 text-white rounded-2xl shadow-lg">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Document Verification</h1>
            <p className="text-sm text-slate-500 font-medium">Invite candidates to upload their documents securely</p>
          </div>
        </div>

        {/* ── EMAIL TEMPLATE ── */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-violet-600 font-bold uppercase text-xs tracking-widest">
              <Mail size={16} /> Email Template
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={selectedTemplateId}
                onChange={e => handleSelectTemplate(e.target.value)}
                className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none font-bold text-slate-700 text-xs cursor-pointer shadow-sm min-w-[200px]"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                onClick={() => navigate('/admin/edit-email-template')}
                type="button"
                className="px-3 py-1.5 border border-slate-200 hover:border-violet-300 text-slate-650 hover:bg-violet-50 hover:text-violet-600 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Edit size={12} /> Edit Rich Template
              </button>
            </div>
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
              <label className="text-xs font-semibold text-slate-500 ml-1 block mb-1">Message Template Preview</label>
              <div 
                dangerouslySetInnerHTML={{ __html: getFormattedMessagePreview(emailMessage) }}
                className="w-full min-h-[180px] max-h-[300px] overflow-y-auto p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm leading-relaxed font-medium font-sans prose prose-slate max-w-none"
              />
              <p className="text-[10px] text-slate-400 mt-2">
                💡 Placeholders: [NAME], [ROLE], [DEPT], [EMPLOYMENT_TYPE], [COMPANY], [FORM_LINK]
              </p>
            </div>
          </div>
        </div>

        {/* ── COMPANY SELECT ── */}
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
        </div>

        {/* ── BULK INVITE FORM ── */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-wrap items-center justify-between mb-6 border-b border-slate-200 gap-4">
            <button
              className="px-6 py-3 font-bold text-sm capitalize transition-all text-violet-600 border-b-2 border-violet-600"
            >
              Bulk Invite
            </button>
            <div className="flex items-center gap-2 mb-2">
              {/* View Selector Button Group */}
              <div className="flex items-center bg-slate-100 border border-slate-200 p-0.5 rounded-xl mr-1.5">
                <button
                  onClick={() => setViewMode('list')}
                  type="button"
                  className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${viewMode === 'list' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  title="List View"
                >
                  <List size={13} />
                  <span className="hidden sm:inline">List</span>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  type="button"
                  className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${viewMode === 'grid' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  title="Grid View"
                >
                  <Grid size={13} />
                  <span className="hidden sm:inline">Grid</span>
                </button>
              </div>

              <button
                onClick={handleOpenHistory}
                type="button"
                className="px-4 py-2 border border-slate-200 hover:border-violet-300 text-slate-600 hover:bg-violet-50 hover:text-violet-600 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <History size={14} /> Verification Logs
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Excel Import Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <UserPlus size={16} className="text-violet-600" />
                <span>BULK INVITE TOOLKIT</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadTemplate}
                  type="button"
                  className="px-4 py-2 border border-emerald-500 text-emerald-600 hover:bg-emerald-50 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Download size={14} /> Download Template
                </button>
                <button
                  onClick={() => document.getElementById('excelBulkImport').click()}
                  type="button"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Upload size={14} /> Import Excel
                </button>
                <input
                  id="excelBulkImport"
                  type="file"
                  accept=".xlsx, .xls"
                  style={{ display: 'none' }}
                  onChange={handleExcelImport}
                />
              </div>
            </div>

            <div className="flex gap-3 pb-4 border-b border-slate-100">
              <button onClick={addBulkRow} className="flex-1 py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:border-violet-300 hover:text-violet-600 transition-all flex items-center justify-center gap-2 cursor-pointer">
                <Plus size={18} /> Add Invite
              </button>
              <button onClick={handleSendBulk} disabled={sending || !selectedCompany} className="flex-[2] py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-xl disabled:bg-slate-300 flex items-center justify-center gap-2 cursor-pointer">
                {sending ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
                {sending ? 'Sending...' : `Send ${bulkRows.length} Invitation(s)`}
              </button>
            </div>

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {bulkRows.map((row, idx) => (
                  <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 relative group flex flex-col justify-between space-y-3">

                    <div>
                      {/* Header of the Row Card */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg">
                            Candidate #{bulkRows.length - idx}
                          </span>
                        </div>
                        <button
                          onClick={() => setBulkRows(bulkRows.filter((_, i) => i !== idx))}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
                          title="Remove candidate"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Fields stacked in one column */}
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 ml-0.5">Email Address</label>
                          <div className="relative flex items-center">
                            <Mail className="absolute left-3 text-slate-400" size={16} />
                            <input
                              type="email"
                              placeholder="candidate@email.com"
                              className="w-full pl-10 pr-4 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all duration-200 outline-none text-sm font-medium"
                              value={row.email}
                              onChange={e => updateBulkRow(idx, 'email', e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 ml-0.5">Full Name</label>
                          <div className="relative flex items-center">
                            <User className="absolute left-3 text-slate-400" size={16} />
                            <input
                              type="text"
                              placeholder="John Doe"
                              className="w-full pl-10 pr-4 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all duration-200 outline-none text-sm font-medium"
                              value={row.fullName}
                              onChange={e => updateBulkRow(idx, 'fullName', e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 ml-0.5">Role / Designation</label>
                          <div className="relative flex items-center">
                            <Briefcase className="absolute left-3 text-slate-400" size={16} />
                            <input
                              type="text"
                              placeholder="Software Engineer"
                              className="w-full pl-10 pr-4 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all duration-200 outline-none text-sm font-medium"
                              value={row.role}
                              onChange={e => updateBulkRow(idx, 'role', e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 ml-0.5">Department</label>
                          <div className="relative flex items-center">
                            <select
                              className="w-full pl-4 pr-10 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all duration-200 outline-none text-sm font-medium appearance-none cursor-pointer"
                              value={row.department}
                              onChange={e => updateBulkRow(idx, 'department', e.target.value)}
                            >
                              <option value="IT">IT</option>
                              <option value="NON-IT">NON-IT</option>
                            </select>
                            <ChevronDown className="absolute right-3 text-slate-400 pointer-events-none" size={16} />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 ml-0.5">Employment Type</label>
                          <div className="relative flex items-center">
                            <select
                              className="w-full pl-4 pr-10 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all duration-200 outline-none text-sm font-medium appearance-none cursor-pointer"
                              value={row.employmentType}
                              onChange={e => updateBulkRow(idx, 'employmentType', e.target.value)}
                            >
                              <option value="">Select Type</option>
                              <option value="Full-Time">Full-Time</option>
                              <option value="Intern">Intern</option>
                              <option value="Contract">Contract</option>
                            </select>
                            <ChevronDown className="absolute right-3 text-slate-400 pointer-events-none" size={16} />
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4 font-black">Candidate</th>
                      <th className="py-3 px-4 font-black">Full Name</th>
                      <th className="py-3 px-4 font-black">Email Address</th>
                      <th className="py-3 px-4 font-black">Role / Designation</th>
                      <th className="py-3 px-4 font-black">Department</th>
                      <th className="py-3 px-4 font-black">Employment Type</th>
                      <th className="py-3 px-4 text-center font-black w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bulkRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/20 transition-colors">
                        <td className="py-2.5 px-4">
                          <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg">
                            #{bulkRows.length - idx}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="relative flex items-center min-w-[150px]">
                            <User className="absolute left-3 text-slate-400" size={14} />
                            <input
                              type="text"
                              placeholder="John Doe"
                              className="w-full pl-9 pr-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:border-violet-500 outline-none text-xs font-semibold"
                              value={row.fullName}
                              onChange={e => updateBulkRow(idx, 'fullName', e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="relative flex items-center min-w-[200px]">
                            <Mail className="absolute left-3 text-slate-400" size={14} />
                            <input
                              type="email"
                              placeholder="candidate@email.com"
                              className="w-full pl-9 pr-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:border-violet-500 outline-none text-xs font-semibold"
                              value={row.email}
                              onChange={e => updateBulkRow(idx, 'email', e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="relative flex items-center min-w-[160px]">
                            <Briefcase className="absolute left-3 text-slate-400" size={14} />
                            <input
                              type="text"
                              placeholder="Software Engineer"
                              className="w-full pl-9 pr-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:border-violet-500 outline-none text-xs font-semibold"
                              value={row.role}
                              onChange={e => updateBulkRow(idx, 'role', e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="relative flex items-center min-w-[100px]">
                            <select
                              className="w-full pl-3 pr-8 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:border-violet-500 outline-none text-xs font-semibold appearance-none cursor-pointer"
                              value={row.department}
                              onChange={e => updateBulkRow(idx, 'department', e.target.value)}
                            >
                              <option value="IT">IT</option>
                              <option value="NON-IT">NON-IT</option>
                            </select>
                            <ChevronDown className="absolute right-2 text-slate-400 pointer-events-none" size={14} />
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="relative flex items-center min-w-[125px]">
                            <select
                              className="w-full pl-3 pr-8 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:border-violet-500 outline-none text-xs font-semibold appearance-none cursor-pointer"
                              value={row.employmentType}
                              onChange={e => updateBulkRow(idx, 'employmentType', e.target.value)}
                            >
                              <option value="">Select Type</option>
                              <option value="Full-Time">Full-Time</option>
                              <option value="Intern">Intern</option>
                              <option value="Contract">Contract</option>
                            </select>
                            <ChevronDown className="absolute right-2 text-slate-400 pointer-events-none" size={14} />
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() => setBulkRows(bulkRows.filter((_, i) => i !== idx))}
                            type="button"
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 cursor-pointer"
                            title="Remove candidate"
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── HISTORY LOGS MODAL OVERLAY ── */}
        {showHistoryModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowHistoryModal(false)}>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col w-full max-w-5xl max-h-[85vh] animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="p-6 bg-violet-900 text-white flex items-center justify-between">
                <div>
                  <h2 className="font-black text-xl flex items-center gap-2"><History size={20} /> Verification Logs</h2>
                  <p className="text-[10px] text-violet-300 uppercase tracking-widest font-bold mt-1">Document Submission Status</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => selectedCompany && fetchHistory(selectedCompany)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all cursor-pointer" title="Refresh logs">
                    <RefreshCw size={16} className={loadingHistory ? "animate-spin" : ""} />
                  </button>
                  <button onClick={() => setShowHistoryModal(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all cursor-pointer" title="Close">
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar">
                {loadingHistory ? (
                  <div className="text-center py-10">
                    <RefreshCw className="animate-spin mx-auto text-violet-400" size={24} />
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-20 text-slate-400">
                    <FileCheck className="mx-auto mb-3" size={40} />
                    <p className="font-medium text-sm">No invitations sent yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {history.map(item => (
                      <div key={item._id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between mb-2">
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-slate-800 text-sm truncate">{item.name || item.email}</p>
                              <p className="text-xs text-slate-500 truncate">{item.email}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${statusColor(item.status)}`}>
                              {item.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 space-y-1 mt-3">
                            {item.role && <p>🧑‍💼 {item.role} • {item.department}</p>}
                            {item.employmentType && <p>📋 {item.employmentType}</p>}
                            <p>📅 Invited: {new Date(item.invitedAt).toLocaleDateString('en-IN')}</p>
                            {item.submittedAt && <p>✅ Submitted: {new Date(item.submittedAt).toLocaleDateString('en-IN')}</p>}
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            📂 {item.documents?.filter(d => d.fileUrl).length || 0}/{item.documents?.length || 0} docs uploaded
                          </span>
                          <button onClick={() => handleDeleteRecord(item._id)} className="p-1.5 text-red-400 hover:text-red-650 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" title="Delete record">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DocVerifyInvite;