import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, CheckCircle2, AlertCircle, Loader2, FileText,
  User, Mail, Briefcase, Building2, Shield, Clock, X, Eye
} from 'lucide-react';
import api from '../api';

const API_URL = import.meta.env.VITE_API_URL_DEVELOPMENT || 'http://localhost:5000';

// ─── Document categories configuration ─────────────────────────────────────
const DOC_CATEGORIES = [
  {
    title: '1. Resume',
    icon: '📄',
    color: 'indigo',
    fields: [{ fieldKey: 'resume', label: 'Resume', required: true }],
  },
  {
    title: '2. Education Documents',
    icon: '🎓',
    color: 'blue',
    fields: [
      { fieldKey: 'cert_10th', label: '10th Certificate', required: false },
      { fieldKey: 'cert_intermediate', label: 'Intermediate Certificate', required: false },
      { fieldKey: 'cert_graduation', label: 'Graduation Certificate', required: false },
      { fieldKey: 'cert_post_graduation', label: 'Post Graduation Certificate', required: false },
    ],
  },
  {
    title: '3. ID Proof',
    icon: '🪪',
    color: 'emerald',
    fields: [
      { fieldKey: 'pan_card', label: 'PAN Card', required: true },
      { fieldKey: 'aadhaar_card', label: 'Aadhaar Card', required: true },
      { fieldKey: 'passport', label: 'Passport', required: false },
    ],
  },
  {
    title: '4. Passport Size Photograph',
    icon: '📸',
    color: 'amber',
    fields: [
      { fieldKey: 'passport_photo', label: 'Passport Size Photograph', required: true },
    ],
  },
  {
    title: '5. Experience Documents (If Any)',
    icon: '💼',
    color: 'purple',
    fields: [
      { fieldKey: 'exp_offer_letter', label: 'Offer Letter', required: false },
      { fieldKey: 'exp_hike_letter', label: 'Hike Letter', required: false },
      { fieldKey: 'exp_relieving_letter', label: 'Relieving Letter', required: false },
      { fieldKey: 'exp_resignation_acceptance', label: 'Resignation Acceptance Document', required: false },
      { fieldKey: 'exp_bank_statement', label: 'Bank Statement', required: false },
      { fieldKey: 'exp_experience_letter', label: 'Experience Letter', required: false },
    ],
  },
  {
    title: '6. Pass Book (Photo Attached)',
    icon: '🏦',
    color: 'rose',
    fields: [
      { fieldKey: 'passbook_photo', label: 'Pass Book Photo', required: false },
    ],
  },
];

const COLOR_MAP = {
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700', heading: 'bg-indigo-600' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', heading: 'bg-blue-600' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', heading: 'bg-emerald-600' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', heading: 'bg-amber-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700', heading: 'bg-purple-600' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700', heading: 'bg-rose-600' },
};

// ─── Single upload card ─────────────────────────────────────────────────────
const UploadCard = ({ fieldKey, label, required, uploadedUrl, uploading, onUpload, onView }) => {
  const inputRef = useRef(null);
  const isUploaded = !!uploadedUrl;

  return (
    <div className={`relative rounded-2xl border-2 p-4 transition-all duration-300 ${isUploaded ? 'border-emerald-400 bg-emerald-50/60' : 'border-dashed border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`p-2 rounded-xl flex-shrink-0 ${isUploaded ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {isUploaded ? <CheckCircle2 size={20} /> : <FileText size={20} />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </p>
            {isUploaded
              ? <p className="text-xs text-emerald-600 font-medium">✓ Uploaded</p>
              : <p className="text-xs text-slate-400">JPG, PNG (max 5MB)</p>
            }
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {isUploaded && (
            <button onClick={() => onView(uploadedUrl)} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 flex items-center gap-1 transition-all">
              <Eye size={12} /> View
            </button>
          )}
          <label className="cursor-pointer">
            <input ref={inputRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp"
              onChange={e => e.target.files[0] && onUpload(fieldKey, e.target.files[0])}
              disabled={uploading === fieldKey}
            />
            <div className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${uploading === fieldKey ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : isUploaded ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200'}`}>
              {uploading === fieldKey ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {uploading === fieldKey ? 'Uploading...' : isUploaded ? 'Replace' : 'Upload'}
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};

// ─── Main Form ──────────────────────────────────────────────────────────────
const DocumentVerificationForm = () => {
  const [token, setToken] = useState('');
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(null); // fieldKey being uploaded
  const [uploadedMap, setUploadedMap] = useState({}); // { fieldKey: url }
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (!t) {
      setError('Invalid link. No token found in URL.');
      setLoading(false);
      return;
    }
    setToken(t);
    fetchRecord(t);
  }, []);

  const fetchRecord = async (t) => {
    try {
      const res = await api.get(`/api/doc-verification/by-token/${t}`);
      const rec = res.data.data;
      setRecord(rec);
      // Pre-populate already uploaded docs
      const map = {};
      (rec.documents || []).forEach(d => { if (d.fileUrl) map[d.fieldKey] = d.fileUrl; });
      setUploadedMap(map);
      if (rec.status === 'submitted' || rec.status === 'verified') setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired verification link.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (fieldKey, file) => {
    setUploading(fieldKey);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fieldKey', fieldKey);
      const res = await api.post(`/api/doc-verification/upload-doc/${token}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setUploadedMap(prev => ({ ...prev, [fieldKey]: res.data.fileUrl }));
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async () => {
    // Check required fields
    const requiredFields = DOC_CATEGORIES.flatMap(c => c.fields.filter(f => f.required));
    const missingRequired = requiredFields.filter(f => !uploadedMap[f.fieldKey]);
    if (missingRequired.length > 0) {
      alert(`Please upload the following required documents:\n${missingRequired.map(f => '• ' + f.label).join('\n')}`);
      return;
    }
    if (!window.confirm('Are you sure you want to submit? You cannot edit after submission.')) return;

    setSubmitting(true);
    try {
      await api.post(`/api/doc-verification/submit/${token}`);
      setSubmitted(true);
    } catch (err) {
      alert(err.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalUploaded = Object.keys(uploadedMap).length;
  const totalFields = DOC_CATEGORIES.reduce((sum, c) => sum + c.fields.length, 0);
  const progress = Math.round((totalUploaded / totalFields) * 100);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-indigo-600 mx-auto mb-4" size={48} />
          <p className="text-slate-600 font-semibold text-lg">Loading your verification form...</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center">
          <div className="w-20 h-20 bg-red-100 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-3">Link Invalid</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <p className="text-sm text-slate-400">Please contact your HR team if you believe this is an error.</p>
        </div>
      </div>
    );
  }

  // ── Already submitted ────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-emerald-500 p-8 text-center text-white">
            <CheckCircle2 size={64} className="mx-auto mb-4" />
            <h2 className="text-3xl font-black mb-2">Documents Submitted!</h2>
            <p className="text-emerald-100">Your documents have been submitted successfully</p>
          </div>
          <div className="p-8 text-center">
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { icon: <Clock size={24} />, label: 'Under Review', text: 'HR team is reviewing your documents', color: 'bg-blue-100 text-blue-600' },
                { icon: <Shield size={24} />, label: 'Secure & Safe', text: 'Your documents are safely stored', color: 'bg-purple-100 text-purple-600' },
                { icon: <Mail size={24} />, label: 'You\'ll Be Notified', text: 'HR will contact you if needed', color: 'bg-amber-100 text-amber-600' },
              ].map((item, i) => (
                <div key={i} className="bg-slate-50 rounded-2xl p-4">
                  <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center mx-auto mb-2`}>{item.icon}</div>
                  <p className="text-xs font-bold text-slate-700 mb-1">{item.label}</p>
                  <p className="text-[10px] text-slate-500">{item.text}</p>
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-sm">You may now close this window. Thank you, <strong>{record?.name || record?.email}</strong>!</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Form ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50/30 font-sans py-10 px-4">
      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="bg-white rounded-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-bold text-slate-700">Document Preview</span>
              <div className="flex gap-2">
                <a href={previewUrl.includes('/upload/') ? previewUrl.replace('/upload/', '/upload/fl_attachment/') : previewUrl} download target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-indigo-100 text-indigo-700 font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-indigo-200">
                  <Upload size={16} className="rotate-180" /> Download Orig.
                </a>
                <button onClick={() => setPreviewUrl(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-50 flex items-center justify-center">
              <img src={previewUrl} alt="Document Preview" className="max-w-full shadow-lg mx-auto rounded-xl border border-slate-200" />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 rounded-[2rem] p-8 mb-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-white rounded-full" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white rounded-full" />
          </div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <Shield size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-black">Document Verification</h1>
                <p className="text-indigo-100 text-sm">{record?.company?.name}</p>
              </div>
            </div>
            {/* Candidate Info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
              {[
                { icon: <User size={14} />, label: 'Name', value: record?.fullName || record?.name },
                { icon: <Mail size={14} />, label: 'Email', value: record?.email },
                { icon: <Briefcase size={14} />, label: 'Role', value: record?.role },
                { icon: <Building2 size={14} />, label: 'Department', value: record?.department },
                { icon: <Shield size={14} />, label: 'Type', value: record?.employmentType },
                { icon: <Clock size={14} />, label: 'Status', value: 'Pending Submission' },
              ].map((item, i) => (
                <div key={i} className="bg-white/10 rounded-xl p-3">
                  <div className="flex items-center gap-1 mb-1 text-indigo-200 text-[10px] font-bold uppercase tracking-wider">
                    {item.icon} {item.label}
                  </div>
                  <p className="text-white font-semibold text-sm truncate">{item.value || 'N/A'}</p>
                </div>
              ))}
            </div>
            {/* Progress */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-indigo-100 mb-1">
                <span>{totalUploaded} of {totalFields} documents uploaded</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8 flex gap-3">
          <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-bold text-amber-800 text-sm mb-1">Upload Instructions</p>
            <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
              <li>Accepted formats: JPG, JPEG, PNG (max 5MB each)</li>
              <li>Ensure documents are clear, readable, and not blurry</li>
              <li>Fields marked with <span className="text-red-500 font-bold">*</span> are mandatory</li>
              <li>Once submitted you cannot make changes – review carefully</li>
            </ul>
          </div>
        </div>

        {/* Document Categories */}
        <div className="space-y-6">
          {DOC_CATEGORIES.map((cat) => {
            const colors = COLOR_MAP[cat.color];
            const uploaded = cat.fields.filter(f => uploadedMap[f.fieldKey]).length;
            return (
              <div key={cat.title} className={`rounded-2xl border-2 ${colors.border} overflow-hidden`}>
                <div className={`${colors.heading} px-6 py-4 flex items-center justify-between`}>
                  <h2 className="text-white font-black text-base flex items-center gap-2">
                    <span>{cat.icon}</span> {cat.title}
                  </h2>
                  <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {uploaded}/{cat.fields.length} uploaded
                  </span>
                </div>
                <div className={`p-4 ${colors.bg} space-y-3`}>
                  {cat.fields.map(field => (
                    <UploadCard
                      key={field.fieldKey}
                      fieldKey={field.fieldKey}
                      label={field.label}
                      required={field.required}
                      uploadedUrl={uploadedMap[field.fieldKey]}
                      uploading={uploading}
                      onUpload={handleUpload}
                      onView={setPreviewUrl}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit Button */}
        <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-black text-slate-800">Ready to Submit?</h3>
              <p className="text-sm text-slate-500">{totalUploaded} documents uploaded. Submission is final and cannot be undone.</p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-black text-indigo-600">{progress}%</span>
              <p className="text-xs text-slate-400">Complete</p>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || totalUploaded === 0}
            className="w-full py-5 rounded-2xl text-white font-black text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-xl shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
          >
            {submitting ? <><Loader2 className="animate-spin" /> Submitting...</> : <><CheckCircle2 /> Submit All Documents</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentVerificationForm;
