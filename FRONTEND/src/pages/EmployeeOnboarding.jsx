import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import {
  FaUser, FaEnvelope, FaBuilding, FaPhone, FaMapMarkerAlt,
  FaCalendarAlt, FaBriefcase, FaMoneyBill, FaBirthdayCake, FaFlag,
  FaHeartbeat, FaUniversity, FaCreditCard, FaCodeBranch,
  FaEye, FaEyeSlash, FaLock, FaTimes, FaCheckCircle, FaSearch, FaIdCard,
  FaFileDownload, FaFileUpload, FaArrowRight, FaRocket, FaInfoCircle, FaVenusMars, FaRing
} from "react-icons/fa";
import {
  ShieldCheck, UserCheck, Clock, Upload, CheckCircle2, AlertCircle, FileText,
  Briefcase, X, Loader2, Sparkles, Mail, Headphones
} from 'lucide-react';

// Import API functions
import api from "../api";

const EmployeeOnboarding = () => {
  // Stage Management: 'onboarding' -> 'compliance' -> 'completed'
  const [stage, setStage] = useState('onboarding');

  // State for Lists
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Email Verification State
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedCompany, setVerifiedCompany] = useState(null);
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [assignedDocs, setAssignedDocs] = useState([]);
  const [verifiedEmployeeDocs, setVerifiedEmployeeDocs] = useState([]);
  const [verifiedDocsLoading, setVerifiedDocsLoading] = useState(false);

  // File State
  const [docFiles, setDocFiles] = useState({
    aadhaar: null,
    pan: null,
    filledDocs: {} // { docId: FileObject }
  });

  // Form State
  const [formData, setFormData] = useState({
    company: "",
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    emergency: "",
    emergencyPhone: "",
    joiningDate: "",
    currentDepartment: "",
    currentRole: "",
    currentSalary: 0,
    employmentType: "",
    bankDetails: { accountNumber: "", bankName: "", ifsc: "", branch: "" },
    personalDetails: {
      dob: "",
      gender: "Male",
      maritalStatus: "Single",
      nationality: "",
      panNumber: "",
      aadhaarNumber: ""
    },
  });

  // --- DOWNLOAD HANDLER ---
  const handleDownload = async (fileUrl, fileName) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'Company-Document');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      window.open(fileUrl, '_blank');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("bankDetails.")) {
      const field = name.split(".")[1];
      setFormData(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, [field]: value } }));
    } else if (name.startsWith("personalDetails.")) {
      const field = name.split(".")[1];
      setFormData(prev => ({ ...prev, personalDetails: { ...prev.personalDetails, [field]: value } }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e, type, docId = null) => {
    const file = e.target.files[0];
    if (!file) return;
    if (type === 'filledDocs') {
      setDocFiles(prev => ({ ...prev, filledDocs: { ...prev.filledDocs, [docId]: file } }));
    } else {
      setDocFiles(prev => ({ ...prev, [type]: file }));
    }
  };

  // --- EMAIL VERIFICATION ---
/* --- Update in EmployeeOnboarding.jsx (handleVerifyEmail function) --- */

const handleVerifyEmail = async () => {
    const email = formData.email.trim();
    if (!email || !email.includes('@')) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid Email',
        text: 'Please enter a valid work email address to proceed.',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    setEmailCheckLoading(true);
    try {
      const response = await api.post('/api/invited-employees/verify-email', { email });

      // Handle users who finished everything
      if (response.data.alreadyOnboarded) {
        Swal.fire({
          icon: 'info',
          title: 'Already Onboarded',
          html: `<p>This email is already onboarded for <b>${response.data.name}</b> at <b>${response.data.companyName}</b>.Please contact your HR department.</p>`,
          confirmButtonText: 'Go to Login',
          confirmButtonColor: '#4f46e5',
        }).then(() => { window.location.href = '/'; });
        return;
      }

      if (response.data.success) {
        const empData = response.data.data;
        
        // Update Local State with fetched data
        setEmailVerified(true);
        setVerifiedCompany(empData.company);
        setAssignedDocs(empData.requiredDocuments || []);
        setFormData(prev => ({
          ...prev,
          email: empData.email, // Ensure email is set
          company: empData.company._id,
          name: empData.name || "",
          currentRole: empData.role || "",
          currentDepartment: empData.department || "",
          employmentType: empData.employmentType || "FULL TIME",
          currentSalary: empData.salary || 0
        }));

      // Immediately load any admin-verified documents for this employee
      fetchVerifiedEmployeeDocuments(empData.email);

        Swal.fire({
          icon: 'success',
          title: `Verification Successful!`,
          html: `Welcome <b>${empData.name}</b>!<br/>Invitation verified for <b>${empData.company.name}</b>.`,
          timer: 4000,
          showConfirmButton: false,
          position: 'top-end',
          toast: true
        });
      }
    }
    catch (error) {
      setEmailVerified(false);
      const status = error.response?.status;
      const errorMsg = error.response?.data?.error || "";

      if (status === 409 || errorMsg.toLowerCase().includes("already onboarded")) {
        Swal.fire({
          icon: 'info',
          title: 'Already Onboarded',
          html: `<p>This email is already registered.</p>`,
          confirmButtonText: 'Go to Login',
          confirmButtonColor: '#4f46e5',
        }).then(() => { window.location.href = '/login'; });
      } else {
        Swal.fire({
          icon: "warning",
          title: "Verification Failed",
          text: errorMsg || "We couldn't find an active invitation.",
          confirmButtonColor: '#ef4444'
        });
      }
    } finally {
      setEmailCheckLoading(false);
    }
};

  const fetchVerifiedEmployeeDocuments = async (email) => {
    if (!email) return;
    setVerifiedDocsLoading(true);
    try {
      const { data } = await api.get('/api/doc-verification/employee', { params: { email: email.toLowerCase().trim() } });
      if (data.success) {
        setVerifiedEmployeeDocs(data.data.verifiedDocs || []);
      } else {
        setVerifiedEmployeeDocs([]);
      }
    } catch (error) {
      console.error('Failed to fetch verified employee documents:', error);
      setVerifiedEmployeeDocs([]);
    } finally {
      setVerifiedDocsLoading(false);
    }
  };

  useEffect(() => {
    if (emailVerified && formData.email) {
      fetchVerifiedEmployeeDocuments(formData.email);
    }
  }, [emailVerified, formData.email]);

  const validateForm = () => {
    if (!formData.company) return "Please verify your email/invitation first.";
    if (!formData.name || !formData.email || !formData.password) return "Please fill in all required profile fields.";
    if (formData.password.length < 8) return "Password must be at least 8 characters long.";
    if (formData.phone.length !== 10) return "Phone number must be exactly 10 digits.";
    if (!docFiles.aadhaar || !docFiles.pan) return "Identity documents (Aadhaar & PAN) are required.";
    const unuploaded = assignedDocs.filter(doc => !docFiles.filledDocs[doc._id]);
    if (unuploaded.length > 0) return `Please upload all ${unuploaded.length} assigned company documents.`;
    return null;
  };

  const handleInitialSubmit = async (e) => {
    e.preventDefault();
    const error = validateForm();
    if (error) return Swal.fire({ icon: "warning", title: "Missing Information", text: error, confirmButtonColor: '#f59e0b' });

    setLoading(true);

    const finalData = new FormData();
    const payload = {
      ...formData,
      experienceDetails: [{
        role: formData.currentRole,
        department: formData.currentDepartment,
        joiningDate: formData.joiningDate,
        lastWorkingDate: "Present",
        salary: Number(formData.currentSalary),
        employmentType: formData.employmentType,
      }]
    };

    finalData.append("jsonData", JSON.stringify(payload));

    if (docFiles.aadhaar) finalData.append("aadhaarCard", docFiles.aadhaar);
    if (docFiles.pan) finalData.append("panCard", docFiles.pan);

    if (Object.keys(docFiles.filledDocs).length > 0) {
      Object.keys(docFiles.filledDocs).forEach((id) => {
        finalData.append("companyDocuments", docFiles.filledDocs[id]);
      });
    }

    try {
      // Direct submission to DB
      await api.post('/api/employees/onboard', finalData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      await api.post('/api/invited-employees/mark-onboarded', { email: formData.email });

      setLoading(false);
      setStage('compliance'); // Direct transition to Policy Compliance
    } catch (err) {
      setLoading(false);
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: err.response?.data?.error || "An error occurred during onboarding. Please check your details.",
        confirmButtonColor: '#ef4444'
      });
    }
  };

  if (stage === 'compliance') return <ComplianceModule userEmail={formData.email} userName={formData.name} companyName={verifiedCompany?.name} onComplete={() => setStage('completed')} />;
  if (stage === 'completed') return <CompletionScreen userName={formData.name} companyName={verifiedCompany?.name} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-12 px-4 font-sans">
      <div className="max-w-4xl mx-auto bg-white/80 backdrop-blur-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-white">
        <div className="bg-indigo-600 p-10 text-center text-white relative">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none overflow-hidden">
            <FaRocket className="absolute -bottom-10 -right-10 text-[15rem] rotate-12" />
          </div>
          <h1 className="text-4xl font-black mb-3">Welcome to Onboarding!</h1>
          <p className="text-indigo-100 text-lg opacity-90">Securely set up your official employee profile</p>
        </div>

        <div className="p-8 md:p-12">
          <form onSubmit={handleInitialSubmit}>
            <Section title="1. Identity Verification" color="blue">
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row items-end gap-4">
                  <div className="flex-1 w-full">
                    <Input icon={<FaEnvelope />} name="email" label="Professional Email Address *" type="email" value={formData.email} onChange={handleChange} required readOnly={emailVerified} placeholder="Enter your invited email address" />
                  </div>
                  {!emailVerified && (
                    <button type="button" onClick={handleVerifyEmail} disabled={emailCheckLoading} className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 group">
                      {emailCheckLoading ? <Loader2 className="animate-spin" /> : <FaSearch className="group-hover:scale-110 transition" />}
                      Verify Invitation
                    </button>
                  )}
                </div>
                {emailVerified && verifiedCompany && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center space-x-4 animate-in slide-in-from-top-2">
                    <div className="bg-emerald-500 p-2 rounded-full text-white"><FaCheckCircle size={20} /></div>
                    <div>
                      <p className="text-emerald-900 font-bold leading-tight">Identity Confirmed</p>
                      <p className="text-emerald-700 text-sm">Welcome to <span className="font-bold">{verifiedCompany.name}</span></p>
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {emailVerified && (
              <div className="animate-in fade-in duration-700">
                <Section title="2. Personal Profile" color="indigo">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input icon={<FaUser />} name="name" label="Full Name (as per ID)" value={formData.name} readOnly={true} />
                    <div className="relative group">
                      <label className="text-[10px] font-black uppercase tracking-wider text-indigo-500 absolute left-10 top-2 z-10">Create Account Password *</label>
                      <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} placeholder="Min. 8 characters" className="w-full pl-10 pr-10 pt-7 pb-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium" required />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-indigo-600 transition" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}</div>
                    </div>
                    <Input icon={<FaPhone />} name="phone" label="Primary Phone *" value={formData.phone} onChange={handleChange} required maxLength={10} placeholder="10-digit mobile number" />
                    <Input icon={<FaMapMarkerAlt />} name="address" label="Residential Address" value={formData.address} onChange={handleChange} placeholder="Street, City, Zip Code" />
                    <Input icon={<FaBirthdayCake />} name="personalDetails.dob" type="date" label="Date of Birth" value={formData.personalDetails.dob} onChange={handleChange} />
                    <Input icon={<FaFlag />} name="personalDetails.nationality" label="Nationality" value={formData.personalDetails.nationality} onChange={handleChange} />

                    <div className="relative group">
                      <FaVenusMars className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 absolute left-10 top-2 z-10">Gender</label>
                      <select name="personalDetails.gender" value={formData.personalDetails.gender} onChange={handleChange} className="w-full pl-10 pr-4 pt-7 pb-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium bg-white">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>

                    <div className="relative group">
                      <FaRing className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 absolute left-10 top-2 z-10">Marital Status</label>
                      <select name="personalDetails.maritalStatus" value={formData.personalDetails.maritalStatus} onChange={handleChange} className="w-full pl-10 pr-4 pt-7 pb-3 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium bg-white">
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>

                    <Input icon={<FaUser />} name="emergency" label="Emergency Contact Name" value={formData.emergency} onChange={handleChange} placeholder="Full Name" />
                    <Input icon={<FaPhone />} name="emergencyPhone" label="Emergency Phone" value={formData.emergencyPhone} onChange={handleChange} placeholder="Emergency Contact Number" />
                  </div>
                </Section>

                <Section title="3. Role Information" color="emerald">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <BadgeBox icon={<FaBriefcase />} label="Designation" value={formData.currentRole} color="blue" />
                    <BadgeBox icon={<FaBuilding />} label="Department" value={formData.currentDepartment} color="indigo" />
                    <BadgeBox icon={<FaIdCard />} label="Job Type" value={formData.employmentType} color="emerald" />
                    <div className="md:col-span-1">
                      <Input icon={<FaCalendarAlt />} name="joiningDate" type="date" label="Joining Date" value={formData.joiningDate} onChange={handleChange} required />
                    </div>
                  </div>
                </Section>

                <Section title="4. Compliance & Documentation" color="orange">
                  <div className="mb-6 bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-4 items-start">
                    <div className="bg-amber-100 p-2 rounded-xl text-amber-600"><FaInfoCircle /></div>
                    <p className="text-sm text-amber-800 leading-relaxed font-medium">
                      Download the attached document, complete it manually or in Word, re-upload it with accurate details, and provide your ID numbers along with high-quality scanned copies of your identity documents.

                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <Input icon={<FaIdCard />} name="personalDetails.aadhaarNumber" label="Aadhaar Number *" value={formData.personalDetails.aadhaarNumber} onChange={handleChange} placeholder="12-digit Aadhaar Number" required />
                    <Input icon={<FaCreditCard />} name="personalDetails.panNumber" label="PAN Number *" value={formData.personalDetails.panNumber} onChange={handleChange} placeholder="10-digit PAN Number" required />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <FileUploadCard label="Aadhaar Card" required file={docFiles.aadhaar} onChange={(e) => handleFileChange(e, 'aadhaar')} />
                    <FileUploadCard label="PAN Card" required file={docFiles.pan} onChange={(e) => handleFileChange(e, 'pan')} />
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest px-1">Assigned Company Policies</h4>
                    {assignedDocs.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {assignedDocs.map((doc) => (
                          <div key={doc._id} className="group flex flex-col sm:flex-row items-center justify-between p-5 bg-white border-2 border-slate-50 hover:border-indigo-100 hover:shadow-md rounded-2xl transition-all">
                            <div className="flex items-center gap-4 mb-4 sm:mb-0">
                              <div className="p-3 bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-xl transition-colors">
                                <FileText size={24} />
                              </div>
                              <div>
                                <span className="block text-slate-800 font-bold group-hover:text-indigo-700">{doc.fileName}</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter italic">Official Document</span>
                              </div>
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                              <button type="button" onClick={() => handleDownload(doc.fileUrl, doc.fileName)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 transition">
                                <FaFileDownload /> Download File
                              </button>
                              <label className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition shadow-sm ${docFiles.filledDocs[doc._id] ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'}`}>
                                <input type="file" className="hidden" onChange={(e) => handleFileChange(e, 'filledDocs', doc._id)} />
                                {docFiles.filledDocs[doc._id] ? <><FaCheckCircle /> Uploaded</> : <><FaFileUpload /> Upload Signed</>}
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <p className="text-slate-400 font-medium">No additional documents assigned.</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 mt-8">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest px-1">Your Verified Employee Documents</h4>
                      {verifiedDocsLoading && <span className="text-xs text-slate-500">Checking verified documents...</span>}
                    </div>

                    {verifiedDocsLoading ? (
                      <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500">Loading verified documents...</div>
                    ) : verifiedEmployeeDocs.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {verifiedEmployeeDocs.map((doc) => (
                          <div key={doc.fieldKey} className="group flex flex-col sm:flex-row items-center justify-between p-5 bg-white border-2 border-slate-50 hover:border-emerald-100 hover:shadow-md rounded-2xl transition-all">
                            <div className="flex items-center gap-4 mb-4 sm:mb-0">
                              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl transition-colors">
                                <FileText size={24} />
                              </div>
                              <div>
                                <span className="block text-slate-800 font-bold">{doc.label}</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter italic">Admin verified on {doc.adminVerifiedAt ? new Date(doc.adminVerifiedAt).toLocaleDateString('en-IN') : 'Unknown date'}</span>
                              </div>
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                              <button type="button" onClick={() => window.open(doc.fileUrl, '_blank', 'noopener,noreferrer')} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition">
                                <FaEye /> View Verified File
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <p className="text-slate-400 font-medium">No admin-verified documents found for this email.</p>
                      </div>
                    )}
                  </div>
                </Section>

                {Number(formData.currentSalary) > 0 && (
                  <Section title="5. Payroll & Bank Details" color="purple">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input icon={<FaUniversity />} name="bankDetails.bankName" label="Bank Name" value={formData.bankDetails.bankName} onChange={handleChange} placeholder="e.g. HDFC Bank" />
                      <Input icon={<FaCreditCard />} name="bankDetails.accountNumber" label="Account Number" value={formData.bankDetails.accountNumber} onChange={handleChange} placeholder="12-16 digit number" />
                      <Input icon={<FaCodeBranch />} name="bankDetails.ifsc" label="IFSC Code" value={formData.bankDetails.ifsc} onChange={handleChange} placeholder="SBIN0001234" />
                      <Input icon={<FaMapMarkerAlt />} name="bankDetails.branch" label="Branch Name" value={formData.bankDetails.branch} onChange={handleChange} placeholder="City/Area Name" />
                    </div>
                  </Section>
                )}

                <div className="pt-8">
                  <button type="submit" disabled={loading} className="w-full py-5 rounded-[1.5rem] text-white font-black text-xl bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3">
                    {loading ? <Loader2 className="animate-spin" /> : <FaCheckCircle />}
                    {loading ? "Processing Information..." : "Confirm Details"}
                  </button>
                  <p className="text-center mt-4 text-slate-400 text-sm font-medium">By clicking submit, you verify all provided information is accurate.</p>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

// --- COMPLIANCE MODULE ---
const ComplianceModule = ({ userEmail, userName, companyName, onComplete }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [agreedPage1, setAgreedPage1] = useState(false);
  const [agreedPage2, setAgreedPage2] = useState(false);
  const [timer, setTimer] = useState(5);
  const [isLocked, setIsLocked] = useState(true);
  const [signatureFile, setSignatureFile] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setTimer(5); setIsLocked(true); }, [currentPage]);
  useEffect(() => {
    if (timer > 0) {
      const countdown = setInterval(() => setTimer(prev => prev - 1), 1000);
      return () => clearInterval(countdown);
    } else setIsLocked(false);
  }, [timer]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSignatureFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setSignaturePreview(reader.result);
      reader.readAsDataURL(file);
      setError("");
    }
  };

  const handleFinalSubmit = async () => {
    if (!agreedPage1 || !agreedPage2 || !signatureFile) {
      setError("Please accept all policies and provide your signature to complete onboarding.");
      return;
    }
    setIsSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append('email', userEmail);
      formData.append('signature', signatureFile);

      const response = await api.post('/api/invited-employees/complete-onboarding', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Onboarding Successfully Completed!',
          text: `Welcome to the team at ${companyName}!`,
          showConfirmButton: false,
          timer: 3000
        });
        onComplete();
      } else {
        setError(response.data.error || "Submission failed. Please check your network.");
      }
    } catch (err) {
      setError("Critical submission error. Please contact HR support.");
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-indigo-600 text-white shadow-xl shadow-indigo-100 rounded-[1.25rem]"><ShieldCheck size={32} /></div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-800">Policy Compliance</h1>
              <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">{companyName} Official Agreement</p>
            </div>
          </div>
          <div className="flex items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
            <TabItem active={currentPage === 1} done={agreedPage1} label="Conduct" />
            <div className="w-8 h-[2px] bg-slate-100 mx-2" />
            <TabItem active={currentPage === 2} done={agreedPage2} label="Security" />
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden relative">
          <div className="h-2 w-full bg-slate-50">
            <div className="h-full bg-indigo-600 transition-all duration-1000 ease-linear" style={{ width: isLocked ? `${(5 - timer) * 20}%` : '100%' }} />
          </div>

          <div className="p-8 md:p-14">
            {currentPage === 1 ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-10">
                  <h2 className="text-3xl font-black flex items-center gap-3 mb-2 text-slate-800">Workplace Conduct</h2>
                  <p className="text-slate-500">Please review our professional behavioral expectations.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                  <PolicyCard index={1} title="Professional Conduct" text="Employees must maintain professional, respectful, and ethical behavior at all times with colleagues, clients, and management." />
                  <PolicyCard index={2} title="Attendance & Punctuality" text="Regular attendance and punctuality are mandatory, and repeated late logins, early logouts, or unapproved absences may lead to salary deductions or disciplinary action." />
                  <PolicyCard index={3} title="Leave Policy" text="All leave requests must be submitted and approved in advance, and unauthorized leave will be treated as Loss of Pay (LOP)." />
                  <PolicyCard index={4} title="Workplace Behavior" text="Harassment, discrimination, abusive language, threats, or any form of workplace violence is strictly prohibited and may result in disciplinary action." />
                  <PolicyCard index={5} title="Substance Prohibition" text="Consumption or possession of alcohol, drugs, or any intoxicating substances during work hours or on office premises is strictly prohibited." />
                  <PolicyCard index={6} title="Company Property Responsibility" text="Employees are responsible for safeguarding company property such as laptops, ID cards, and systems provided to them." />
                </div>
                <label className={`flex items-start gap-4 p-8 rounded-[2rem] border-2 cursor-pointer transition-all ${agreedPage1 ? 'border-indigo-600 bg-indigo-50/50 shadow-inner' : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'}`}>
                  <input type="checkbox" disabled={isLocked} checked={agreedPage1} onChange={(e) => setAgreedPage1(e.target.checked)} className="w-7 h-7 mt-1 accent-indigo-600" />
                  <div>
                    <span className="text-xl font-black block text-slate-800">I have read and agree to Workplace Conduct</span>
                    <span className="text-slate-500 font-medium">By checking this, you commit to adhering to all company behavioral standards. {isLocked && <span className="text-indigo-600 ml-1">(Reading... {timer}s)</span>}</span>
                  </div>
                </label>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-10">
                  <h2 className="text-3xl font-black flex items-center gap-3 mb-2 text-slate-800">Security & Confidentiality</h2>
                  <p className="text-slate-500">Protecting company data and privacy is our top priority.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                  <PolicyCard index={1} title="Authorized System Usage" text="Company systems, computers, email accounts, and network resources must be used only for authorized and official work purposes." />
                  <PolicyCard index={2} title="Confidentiality" text="Confidential company, employee, and client information must not be disclosed, shared, or discussed with unauthorized persons inside or outside the organization." />
                  <PolicyCard index={3} title="Account Security" text="Sharing passwords, login credentials, or access details is strictly prohibited, and employees are personally responsible for securing their accounts." />
                  <PolicyCard index={4} title="Data Protection" text="Copying, transferring, downloading, or storing company data without proper authorization is considered a serious policy violation." />
                  <PolicyCard index={5} title="Internet & Network Usage" text="Company internet and network access must not be used for illegal, harmful, offensive, or non-work-related activities that could impact security." />
                  <PolicyCard index={6} title="Security Incident Reporting" text="Any suspected data breach, phishing attempt, system vulnerability, or unusual system activity must be reported immediately to the IT or administration team." />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                  <label className={`lg:col-span-2 flex items-start gap-4 p-8 rounded-[2rem] border-2 cursor-pointer transition-all ${agreedPage2 ? 'border-indigo-600 bg-indigo-50/50 shadow-inner' : 'border-slate-100 bg-slate-50/30'}`}>
                    <input type="checkbox" disabled={isLocked} checked={agreedPage2} onChange={(e) => setAgreedPage2(e.target.checked)} className="w-7 h-7 mt-1 accent-indigo-600" />
                    <div>
                      <span className="text-xl font-black block text-slate-800">I agree to Security & Privacy Terms</span>
                      <span className="text-slate-500 font-medium italic text-sm">Mandatory for internal system access. {isLocked && `(${timer}s)`}</span>
                    </div>
                  </label>
                  <div className="relative">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Digital Signature</p>
                    <div className="bg-slate-900 rounded-[2rem] p-6 text-white text-center h-40 flex flex-col justify-center border-4 border-slate-800 relative overflow-hidden group">
                      {signaturePreview ? (
                        <div className="bg-white rounded-xl p-3 h-full flex justify-center relative animate-in zoom-in">
                          <img src={signaturePreview} alt="Signature" className="max-h-full object-contain" />
                          <button onClick={() => { setSignaturePreview(null); setSignatureFile(null); }} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1.5 shadow-lg"><X size={16} /></button>
                        </div>
                      ) : (
                        <label className="cursor-pointer h-full flex flex-col items-center justify-center group-hover:bg-slate-800 transition-colors">
                          <Upload className="mb-2 text-indigo-400" size={30} />
                          <p className="text-[10px] font-black uppercase tracking-tighter">Upload Signature Image</p>
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {error && <div className="mt-8 p-5 bg-red-50 border border-red-100 text-red-600 rounded-[1.5rem] text-sm font-bold flex gap-3 animate-bounce"><AlertCircle size={20} /> {error}</div>}
          </div>

          <div className="px-8 md:px-14 py-8 bg-slate-50 border-t flex items-center justify-between">
            <button onClick={() => setCurrentPage(1)} className={`font-black text-slate-400 hover:text-slate-600 transition flex items-center gap-2 ${currentPage === 1 ? 'invisible' : ''}`}>
              Go Back
            </button>
            {currentPage === 1 ? (
              <button onClick={() => setCurrentPage(2)} disabled={!agreedPage1} className="px-12 py-4 rounded-2xl font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3">
                Continue to Next Step <FaArrowRight />
              </button>
            ) : (
              <button onClick={handleFinalSubmit} disabled={isSubmitting} className="px-12 py-4 rounded-2xl font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all active:scale-95 flex items-center gap-3">
                {isSubmitting ? <><Loader2 className="animate-spin" /> Completing Process...</> : <><CheckCircle2 /> Finalize Onboarding</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CompletionScreen = ({ userName, companyName }) => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
    <div className="max-w-3xl w-full bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-700">
      <div className="bg-emerald-500 h-4 w-full"></div>
      <div className="p-10 md:p-16 text-center">
        <div className="w-32 h-32 bg-emerald-50 text-emerald-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner animate-pulse">
          <CheckCircle2 size={70} />
        </div>
        <h2 className="text-5xl font-black text-slate-800 mb-4 leading-tight">Onboarding Completed!</h2>
        <p className="text-xl text-slate-600 mb-12">
          Welcome to the family, <span className="font-bold text-indigo-600">{userName}</span>! <br />
          Your profile has been successfully integrated into <b>{companyName}</b>.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mb-12">
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4"><Clock size={20} /></div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">Status</h4>
            <p className="text-xs text-slate-500">Profile awaiting HR verification</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4"><Sparkles size={20} /></div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">Credentials</h4>
            <p className="text-xs text-slate-500">Check your email for login instructions</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4"><Headphones size={20} /></div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">Support</h4>
            <p className="text-xs text-slate-500">Contact HR if you need help logging in</p>
          </div>
        </div>
        <button onClick={() => window.location.href = '/'} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3">
          Access Employee Dashboard <FaArrowRight />
        </button>
      </div>
    </div>
  </div>
);

const TabItem = ({ active, done, label }) => (
  <div className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all ${active ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border-2 transition-colors ${done ? 'bg-emerald-500 border-emerald-500 text-white' : active ? 'border-white' : 'border-slate-200'}`}>
      {done ? <CheckCircle2 size={14} /> : active ? "•" : ""}
    </div>
    <span className="text-xs font-black uppercase tracking-widest">{label}</span>
  </div>
);

const PolicyCard = ({ index, title, text }) => (
  <div className="flex gap-5 p-6 bg-white border border-slate-100 rounded-[2rem] hover:shadow-lg hover:shadow-slate-100 transition-all group">
    <span className="shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">{index}</span>
    <div>
      <h4 className="font-black text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors">{title}</h4>
      <p className="text-slate-500 text-sm leading-relaxed">{text}</p>
    </div>
  </div>
);

const Section = ({ title, children, color }) => {
  const colorMap = {
    blue: "border-blue-100 bg-blue-50/20 text-blue-800",
    indigo: "border-indigo-100 bg-indigo-50/20 text-indigo-800",
    emerald: "border-emerald-100 bg-emerald-50/20 text-emerald-800",
    orange: "border-orange-100 bg-orange-50/20 text-orange-800",
    purple: "border-purple-100 bg-purple-50/20 text-purple-800",
  };
  return (
    <div className={`border-2 rounded-[2rem] p-8 mb-10 transition-all ${colorMap[color] || 'border-slate-100 bg-slate-50/20'}`}>
      <h3 className="text-2xl font-black mb-8 flex items-center gap-3 uppercase tracking-tight">{title}</h3>
      {children}
    </div>
  );
};

const Input = ({ icon, label, readOnly, ...props }) => (
  <div className="relative group">
    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">{icon}</div>
    <label className="absolute left-10 top-2 text-[10px] font-black uppercase tracking-wider text-slate-400 group-focus-within:text-indigo-500 transition-colors">{label}</label>
    <input
      {...props}
      readOnly={readOnly}
      className={`w-full pl-10 pr-4 pt-7 pb-3 border-2 border-slate-100 rounded-2xl outline-none transition-all font-medium ${readOnly ? 'bg-slate-100/50 cursor-not-allowed text-slate-500' : 'bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`}
    />
  </div>
);

const BadgeBox = ({ icon, label, value, color }) => (
  <div className="flex flex-col bg-white border-2 border-slate-50 p-4 rounded-2xl shadow-sm">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
      {icon} {label}
    </span>
    <span className="text-sm font-bold text-slate-800 truncate">{value || 'N/A'}</span>
  </div>
);

const FileUploadCard = ({ label, required, file, onChange }) => (
  <div className="relative group">
    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
      {label} {required && <span className="text-red-500">*</span>}
    </p>
    <label className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-[2rem] cursor-pointer transition-all ${file ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30'}`}>
      <input type="file" onChange={onChange} accept=".pdf,.png,.jpg,.jpeg" className="hidden" />
      {file ? (
        <>
          <CheckCircle2 className="text-emerald-500 mb-2" size={32} />
          <span className="text-xs font-bold text-emerald-700 truncate max-w-full px-4">{file.name}</span>
        </>
      ) : (
        <>
          <Upload className="text-slate-300 group-hover:text-indigo-500 mb-2 transition-colors" size={32} />
          <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600 transition-colors text-center">Choose File</span>
        </>
      )}
    </label>
  </div>
);

export default EmployeeOnboarding;