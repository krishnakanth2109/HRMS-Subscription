import React, { useState } from 'react';

// Helper to ensure URLs are always HTTPS
const getSecureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http:")) {
    return url.replace("http:", "https:");
  }
  return url;
};

const SupportAdminProfileView = ({ admin, onBack, allSidebarFeatures = [] }) => {
  const [activeTab, setActiveTab] = useState('personal');
  const [profileImage, setProfileImage] = useState(admin.profilePhotoUrl || null);

  const initials = admin.name?.split(' ').map(n => n[0]).join('').toUpperCase() || "A";
  const safe = (val, fallback = "N/A") => (val !== undefined && val !== null && val !== "") ? val : fallback;

  const currentExp = Array.isArray(admin.experienceDetails) && admin.experienceDetails.length > 0
    ? (admin.experienceDetails.find(exp => exp.lastWorkingDate === "Present" || !exp.lastWorkingDate) || admin.experienceDetails[admin.experienceDetails.length - 1])
    : null;

  const StatusBadge = ({ status }) => {
    const isActive = status === 'Active' || status === 'active' || status === true;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isActive ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
        {isActive ? 'Active' : 'Disabled'}
      </span>
    );
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
        className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none ${active ? 'border-blue-800 text-blue-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        onClick={onClick}
      >
        {label}
      </button>
    );
  }

  const renderTabContent = () => {
    if (activeTab === 'personal') {
      return (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard label="Full Name" value={safe(admin.name)} />
            <InfoCard label="Email Address" value={safe(admin.email)} />
            <InfoCard label="Phone Number" value={safe(admin.phone)} />
            <InfoCard label="Date of Birth" value={safe(admin.personalDetails?.dob)} />
            <InfoCard label="Gender" value={safe(admin.personalDetails?.gender)} />
            <InfoCard label="Marital Status" value={safe(admin.personalDetails?.maritalStatus)} />
            <InfoCard label="Nationality" value={safe(admin.personalDetails?.nationality)} />
            <InfoCard label="Bio" value={safe(admin.bio)} />
          </div>
        </div>
      );
    }

    if (activeTab === 'professional') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard label="Admin ID" value={safe(admin.supportAdminId)} />
            <InfoCard label="Role" value={safe(currentExp?.role || "Administration")} />
            <InfoCard label="Department" value={safe(currentExp?.department || "Administration")} />
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-500 mb-1">Account Status</div>
              <StatusBadge status={admin.loginEnabled !== false} />
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
            <h3 className="text-indigo-800 font-bold mb-4 flex items-center gap-2 uppercase text-xs tracking-widest">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Assigned Features
            </h3>
            <div className="flex flex-wrap gap-2">
              {admin.assignedFeatures && admin.assignedFeatures.length > 0 ? (
                admin.assignedFeatures.map((fId) => {
                  const feature = allSidebarFeatures.find(f => f.id === fId);
                  return feature ? (
                    <span key={fId} className="rounded-md bg-white px-3 py-1.5 text-sm font-bold text-slate-700 border border-slate-200 shadow-sm">
                      {feature.label}
                    </span>
                  ) : null;
                })
              ) : (
                <p className="text-sm font-medium text-slate-500">No features assigned</p>
              )}
            </div>
          </div>

          {(admin.socialLinks && typeof admin.socialLinks === 'object' && Object.values(admin.socialLinks).some(val => val)) && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-gray-800 font-bold mb-4 flex items-center gap-2 uppercase text-xs tracking-widest">
                Social Links
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {admin.socialLinks.linkedin && <InfoCard label="LinkedIn" value={<a href={admin.socialLinks.linkedin} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{admin.socialLinks.linkedin}</a>} />}
                {admin.socialLinks.github && <InfoCard label="GitHub" value={<a href={admin.socialLinks.github} target="_blank" rel="noreferrer" className="text-slate-800 hover:underline">{admin.socialLinks.github}</a>} />}
                {admin.socialLinks.instagram && <InfoCard label="Instagram" value={<a href={admin.socialLinks.instagram} target="_blank" rel="noreferrer" className="text-pink-600 hover:underline">{admin.socialLinks.instagram}</a>} />}
                {admin.socialLinks.website && <InfoCard label="Website" value={<a href={admin.socialLinks.website} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{admin.socialLinks.website}</a>} />}
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
            <InfoCard label="Account Number" value={safe(admin.bankDetails?.accountNumber)} />
            <InfoCard label="Bank Name" value={safe(admin.bankDetails?.bankName)} />
            <InfoCard label="IFSC Code" value={safe(admin.bankDetails?.ifsc)} />
            <InfoCard label="Branch" value={safe(admin.bankDetails?.branch)} />
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
                <InfoCard label="Role/Position" value={safe(currentExp.role)} />
                <InfoCard label="Department" value={safe(currentExp.department)} />
                <InfoCard label="Joining Date" value={currentExp.joiningDate ? safe(currentExp.joiningDate.split('T')[0]) : "N/A"} />
                <InfoCard label="Salary" value={currentExp.salary ? `₹${Number(currentExp.salary).toLocaleString()}` : "N/A"} />
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-6">Employment History</h3>
            {Array.isArray(admin.experienceDetails) && admin.experienceDetails.length > 0 ? (
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 before:to-transparent">
                {admin.experienceDetails.map((exp, idx) => (
                  <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-gray-100 group-hover:bg-blue-600 group-hover:text-white text-gray-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[45%] p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-gray-900">{safe(exp.role)}</h4>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{exp.joiningDate ? safe(exp.joiningDate.split('T')[0]) : "N/A"} - {safe(exp.lastWorkingDate || "Present")}</span>
                      </div>
                      <p className="text-sm text-gray-600 font-medium mb-3">{safe(exp.department)}</p>
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
      return (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Identity Documents
              </h3>
            </div>

            <div className="flex flex-wrap gap-4">
              {admin.personalDetails?.aadhaarFileUrl ? (
                <a href={getSecureUrl(admin.personalDetails.aadhaarFileUrl)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-white border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50 px-6 py-3 rounded-xl transition-all shadow-sm group w-full md:w-auto">
                  <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg group-hover:bg-emerald-200">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">Verified</p>
                    <p className="text-sm font-bold text-gray-800">Aadhaar Card</p>
                  </div>
                </a>
              ) : (
                <div className="px-6 py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm font-medium w-full md:w-auto">Aadhaar Not Uploaded</div>
              )}

              {admin.personalDetails?.panFileUrl ? (
                <a href={getSecureUrl(admin.personalDetails.panFileUrl)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-white border-2 border-indigo-100 hover:border-indigo-500 hover:bg-indigo-50 px-6 py-3 rounded-xl transition-all shadow-sm group w-full md:w-auto">
                  <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg group-hover:bg-indigo-200">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase">Verified</p>
                    <p className="text-sm font-bold text-gray-800">PAN Card</p>
                  </div>
                </a>
              ) : (
                <div className="px-6 py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm font-medium w-full md:w-auto">PAN Not Uploaded</div>
              )}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="bg-gray-50 p-4 sm:p-6 -mx-4 sm:-mx-8 -mt-6">
      <div className="max-w-6xl mx-auto">
        <button onClick={onBack} className="mb-6 flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors duration-200 group bg-white rounded-lg shadow-sm border border-gray-200">
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
                {profileImage ? (
                  <img src={getSecureUrl(profileImage)} alt={admin.name} className="w-full h-full object-cover" />
                ) : initials}
              </div>
              <div className="flex items-center gap-3 mb-3 justify-center">
                <h1 className="text-3xl sm:text-4xl font-bold text-white">{safe(admin.name)}</h1>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="px-4 py-1.5 rounded-full bg-blue-700/50 backdrop-blur-md text-white border border-blue-400/30 text-xs font-bold uppercase tracking-wider">
                  ID: {safe(admin.supportAdminId)}
                </span>
                <span className="px-4 py-1.5 rounded-full bg-emerald-600/50 backdrop-blur-md text-white border border-emerald-400/30 text-xs font-bold uppercase tracking-wider">
                  {currentExp?.department || "Administration"}
                </span>
                <span className="px-4 py-1.5 rounded-full bg-blue-700/50 backdrop-blur-md text-white border border-blue-400/30 text-xs font-bold uppercase tracking-wider">
                  {currentExp?.role || "Support Admin"}
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

export default SupportAdminProfileView;
