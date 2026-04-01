import React, { useContext, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EmployeeContext } from '../context/EmployeeContext';
import api from '../api';

// Helper to ensure URLs are always HTTPS
const getSecureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http:")) {
    return url.replace("http:", "https:");
  }
  return url;
};

const EmployeeProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { employees } = useContext(EmployeeContext);
  
  const [activeTab, setActiveTab] = React.useState('personal');
  const [profileImage, setProfileImage] = useState(null);
  const [loadingImage, setLoadingImage] = useState(true);
  
  // NEW STATES FOR ONBOARDING & COMPANY DETAILS
  const [onboardingData, setOnboardingData] = useState(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  
  const employee = employees.find((emp) => String(emp.employeeId) === String(id));

  // --- EFFECT 1: LOAD PROFILE PICTURE ---
  useEffect(() => {
    const loadProfilePic = async () => {
      if (!employee || !employee.employeeId) return;
      
      if (employee.profilePhoto?.url) {
        setProfileImage(employee.profilePhoto.url);
        setLoadingImage(false);
        return;
      }
      
      setLoadingImage(true);
      try {
        const res = await api.get(`/api/profile/${employee.employeeId}`);
        if (res?.data?.profilePhoto?.url) {
          setProfileImage(res.data.profilePhoto.url);
        }
      } catch (err) {
        console.error("Failed to load profile picture:", err);
      } finally {
        setLoadingImage(false);
      }
    };

    loadProfilePic();
  }, [employee]);

  // --- EFFECT 2: FETCH ONBOARDING DETAILS (Company, Policy, Signature, Onboard Date) ---
  useEffect(() => {
    const fetchOnboardingDetails = async () => {
      if (!employee || !employee.email) return;

      setFetchingDetails(true);
      try {
        // ✅ FIXED: Use dedicated GET route that always returns full compliance data
        // regardless of onboarding status (avoids verify-email logic blocking fully-onboarded users)
        const response = await api.get('/api/invited-employees/profile-by-email', {
          params: { email: employee.email }
        });

        if (response.data.success && response.data.data) {
          setOnboardingData(response.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch onboarding details:", error);
      } finally {
        setFetchingDetails(false);
      }
    };

    fetchOnboardingDetails();
  }, [employee]);

  if (!employee) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md w-full border">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Employee Not Found</h2>
        <p className="text-gray-600 mb-6">The employee you're looking for doesn't exist or has been removed.</p>
        <button onClick={() => navigate(-1)} className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 font-medium">
          Go Back
        </button>
      </div>
    </div>
  );

  const initials = employee.name?.split(' ').map(n => n[0]).join('').toUpperCase();
  const safe = (val, fallback = "N/A") => (val !== undefined && val !== null && val !== "") ? val : fallback;
  
  const currentExp = Array.isArray(employee.experienceDetails) && employee.experienceDetails.length > 0
    ? (employee.experienceDetails.find(exp => exp.lastWorkingDate === "Present" || !exp.lastWorkingDate) || employee.experienceDetails[employee.experienceDetails.length - 1])
    : null;

  const StatusBadge = ({ status }) => {
    const isActive = status === 'Active' || status === 'active';
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isActive ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
        {safe(status)}
      </span>
    );
  };

  const renderTabContent = () => {
    if (activeTab === 'personal') {
      return (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard label="Full Name" value={safe(employee.name)} />
            <InfoCard label="Email Address" value={safe(employee.email)} />
            <InfoCard label="Phone Number" value={safe(employee.phone)} />
            <InfoCard label="Date of Birth" value={safe(employee.personalDetails?.dob)} />
            <InfoCard label="Gender" value={safe(employee.personalDetails?.gender)} />
            <InfoCard label="Marital Status" value={safe(employee.personalDetails?.maritalStatus)} />
            <InfoCard label="Nationality" value={safe(employee.personalDetails?.nationality)} />
            <InfoCard label="PAN Number" value={safe(employee.personalDetails?.panNumber)} />
            <InfoCard label="Aadhaar Number" value={safe(employee.personalDetails?.aadhaarNumber)} />
            <InfoCard label="Emergency Contact Name" value={safe(employee.emergency)} />
            <InfoCard label="Emergency Phone" value={safe(employee.emergencyPhone)} />
            <InfoCard label="Residential Address" value={safe(employee.address)} />
          </div>

          <div className="mt-6 border-t pt-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Identity Documents</h3>
            <div className="flex flex-wrap gap-4">
               {employee.personalDetails?.aadhaarFileUrl ? (
                 <a href={getSecureUrl(employee.personalDetails.aadhaarFileUrl)} target="_blank" rel="noopener noreferrer" 
                    className="flex items-center gap-3 bg-white border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50 px-6 py-3 rounded-xl transition-all shadow-sm group">
                    <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg group-hover:bg-emerald-200">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase">Verified</p>
                        <p className="text-sm font-bold text-gray-800">Aadhaar Card</p>
                    </div>
                 </a>
               ) : (
                 <div className="px-6 py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm font-medium">Aadhaar Not Uploaded</div>
               )}

               {employee.personalDetails?.panFileUrl ? (
                 <a href={getSecureUrl(employee.personalDetails.panFileUrl)} target="_blank" rel="noopener noreferrer" 
                    className="flex items-center gap-3 bg-white border-2 border-indigo-100 hover:border-indigo-500 hover:bg-indigo-50 px-6 py-3 rounded-xl transition-all shadow-sm group">
                    <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg group-hover:bg-indigo-200">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-bold text-indigo-600 uppercase">Verified</p>
                        <p className="text-sm font-bold text-gray-800">PAN Card</p>
                    </div>
                 </a>
               ) : (
                 <div className="px-6 py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm font-medium">PAN Not Uploaded</div>
               )}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'professional') {
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoCard label="Employee ID" value={safe(employee.employeeId)} />
              <InfoCard label="Company" value={onboardingData?.company?.name || employee.companyName || "N/A"} />
              <InfoCard label="Role" value={safe(employee.role)} />
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-500 mb-1">Account Status</div>
                <StatusBadge status={employee.status} />
              </div>
              <InfoCard label="Member Since" value={new Date(employee.createdAt).toLocaleDateString()} />
              <InfoCard label="Is Admin" value={employee.isAdmin ? "Yes" : "No"} />
            </div>

            {/* NEW: ONBOARDING & POLICY COMPLIANCE INFO */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
                <h3 className="text-indigo-800 font-bold mb-4 flex items-center gap-2 uppercase text-xs tracking-widest">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  Onboarding Compliance
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InfoCard label="Onboarded At" value={onboardingData?.onboardedAt ? new Date(onboardingData.onboardedAt).toLocaleString() : "N/A"} />
                  <InfoCard label="Policy Status" value={onboardingData?.policyStatus === 'accepted' ? "ACCEPTED" : "PENDING"} />
                  <InfoCard label="Policies Accepted At" value={onboardingData?.policyAcceptedAt ? new Date(onboardingData.policyAcceptedAt).toLocaleString() : "N/A"} />
                </div>
            </div>

            {(employee.deactivationDate || employee.deactivationReason) && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <h3 className="text-red-800 font-bold mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  Deactivation Record
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoCard label="Date of Deactivation" value={safe(employee.deactivationDate)} />
                  <InfoCard label="Reason" value={safe(employee.deactivationReason)} />
                </div>
              </div>
            )}
          </div>
        );
      }
    
    if (activeTab === 'bank') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard label="Account Number" value={safe(employee.bankDetails?.accountNumber)} />
            <InfoCard label="Bank Name" value={safe(employee.bankDetails?.bankName)} />
            <InfoCard label="IFSC Code" value={safe(employee.bankDetails?.ifsc)} />
            <InfoCard label="Branch" value={safe(employee.bankDetails?.branch)} />
          </div>
        </div>
      );
    }

    if (activeTab === 'experience') {
      return (
        <div className="space-y-6">
          {currentExp && (
            <div className="bg-white border border-blue-200 rounded-lg p-6 shadow-sm mb-4">
              <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                Current Employment
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             <InfoCard label="Company" value={onboardingData?.company?.name || employee.companyName || "N/A"} />
                <InfoCard label="Department" value={safe(currentExp.department)} />
                <InfoCard label="Role/Position" value={safe(currentExp.role)} />
                <InfoCard label="Salary" value={currentExp.salary ? `₹${Number(currentExp.salary).toLocaleString()}` : "N/A"} />
                <InfoCard label="Joining Date" value={safe(currentExp.joiningDate)} />
                <InfoCard label="Employment Type" value={safe(currentExp.employmentType)} />
              </div>
            </div>
          )}
          
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-6">Employment History</h3>
            {Array.isArray(employee.experienceDetails) && employee.experienceDetails.length > 0 ? (
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 before:to-transparent">
                {employee.experienceDetails.map((exp, idx) => (
                  <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-gray-100 group-hover:bg-blue-600 group-hover:text-white text-gray-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[45%] p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">

                        <h4 className="font-bold text-gray-900">{onboardingData?.company?.name || employee.companyName || "N/A"}</h4>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{safe(exp.joiningDate)} - {safe(exp.lastWorkingDate || "Present")}</span>
                      </div>
                      <p className="text-sm text-gray-600 font-medium mb-3">{safe(exp.role)} • {safe(exp.department)}</p>
                      {exp.experienceLetterUrl && (
                        <a href={getSecureUrl(exp.experienceLetterUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          Experience Letter
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-center py-4">No experience records found.</div>
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'documents') {
        const requiredCount = onboardingData?.requiredDocuments?.length || 0;
        const submittedCount = employee.companyDocuments?.length || 0;

        return (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Company Document Compliance
                  </h3>
                  {/* DOCUMENT COUNT SUMMARY */}
                  <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 flex items-center gap-3">
                    <span className="text-xs font-bold text-blue-600 uppercase">Submission Status:</span>
                    <span className={`text-sm font-black ${submittedCount >= requiredCount ? 'text-green-600' : 'text-orange-600'}`}>
                      {submittedCount} / {requiredCount} Documents
                    </span>
                  </div>
                </div>

                {employee.companyDocuments && employee.companyDocuments.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {employee.companyDocuments.map((doc, index) => (
                            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl hover:shadow-md transition-all">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-bold text-gray-800 truncate" title={doc.fileName}>{doc.fileName}</p>
                                        {/* FETCHED TIME AND DATE */}
                                        <p className="text-[10px] text-gray-500 font-bold uppercase">
                                          Submitted: {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                                <a href={getSecureUrl(doc.fileUrl)} target="_blank" rel="noopener noreferrer" 
                                   className="ml-4 p-2 bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-600 hover:text-white transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                </a>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <p className="text-gray-400 font-medium">No company documents have been submitted yet.</p>
                    </div>
                )}
            </div>

            {/* SIGNATURE FETCHING */}
            {(onboardingData?.signatureUrl || employee.signatureUrl) && (
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                   <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Onboarding E-Signature</h3>
                   <div className="inline-block p-4 border border-dashed border-gray-300 rounded-lg bg-white shadow-inner">
                      <img src={getSecureUrl(onboardingData?.signatureUrl || employee.signatureUrl)} alt="Employee Signature" className="h-20 object-contain mix-blend-multiply" />
                      <div className="mt-2 text-center text-[10px] text-gray-400 font-bold border-t pt-1">
                        DIGITALLY VERIFIED {onboardingData?.policyAcceptedAt ? `ON ${new Date(onboardingData.policyAcceptedAt).toLocaleDateString()}` : ''}
                      </div>
                   </div>
                </div>
            )}
          </div>
        );
    }
  };

  const InfoCard = ({ label, value }) => (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="text-sm font-medium text-gray-500 mb-1">{label}</div>
      <div className="text-base font-semibold text-gray-900 break-words">{value}</div>
    </div>
  );

  function TabButton({ active, onClick, label }) {
    return (
      <button
        className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none ${
          active ? 'border-blue-800 text-blue-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
        onClick={onClick}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors duration-200 group">
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Back to Employee List</span>
        </button>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
          <div className="bg-blue-800 px-8 py-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-blue-700 rounded-full opacity-20"></div>
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-blue-900 rounded-full opacity-30"></div>
            
            <div className="relative flex flex-col items-center text-center">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-blue-600 flex items-center justify-center text-3xl sm:text-4xl text-white font-bold mb-6 shadow-xl overflow-hidden border-4 border-white">
                {loadingImage ? (
                  <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full"></div>
                ) : profileImage ? (
                  <img src={getSecureUrl(profileImage)} alt={employee.name} className="w-full h-full object-cover" />
                ) : initials }
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">{safe(employee.name)}</h1>
              
              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="px-4 py-1.5 rounded-full bg-blue-700/50 backdrop-blur-md text-white border border-blue-400/30 text-xs font-bold uppercase tracking-wider">ID: {safe(employee.employeeId)}</span>
                {/* DEPARTMENT DISPLAY */}
                <span className="px-4 py-1.5 rounded-full bg-emerald-600/50 backdrop-blur-md text-white border border-emerald-400/30 text-xs font-bold uppercase tracking-wider">
                    {onboardingData?.department || currentExp?.department || "No Department"}
                </span>
                <span className="px-4 py-1.5 rounded-full bg-blue-700/50 backdrop-blur-md text-white border border-blue-400/30 text-xs font-bold uppercase tracking-wider">
                    {onboardingData?.role || currentExp?.role || safe(employee.role)}
                </span>
              </div>
            </div>
          </div>

          <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
            <nav className="flex justify-center overflow-x-auto scrollbar-hide">
              <div className="flex space-x-8 px-6">
                <TabButton active={activeTab === 'personal'} onClick={() => setActiveTab('personal')} label="Personal" />
                <TabButton active={activeTab === 'professional'} onClick={() => setActiveTab('professional')} label="Professional" />
                <TabButton active={activeTab === 'bank'} onClick={() => setActiveTab('bank')} label="Banking" />
                <TabButton active={activeTab === 'experience'} onClick={() => setActiveTab('experience')} label="Experience" />
                <TabButton active={activeTab === 'documents'} onClick={() => setActiveTab('documents')} label="Documents" />
              </div>
            </nav>
          </div>

          <div className="p-8 bg-gray-50 min-h-[500px]">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfile;