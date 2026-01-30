// --- START OF FILE CurrentEmployeeProfile.jsx ---

import React, { useEffect, useState } from "react";
// 1. Swap axios for your centralized api instance
import api from "../api"; 
import { 
  FaUser, FaEnvelope, FaPhone, FaBuilding, FaMoneyBill, FaCalendarAlt, 
  FaCreditCard, FaAddressCard, FaFileUpload, FaCheck, FaSpinner, FaIdCard, FaEdit, FaSave, FaTrash
} from "react-icons/fa";

const INDIAN_BANKS = [
  "State Bank of India (SBI)",
  "HDFC Bank",
  "ICICI Bank",
  "Punjab National Bank (PNB)",
  "Bank of Baroda",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "IndusInd Bank",
  "Union Bank of India",
  "Canara Bank"
];

const getSecureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http:")) {
    return url.replace("http:", "https:");
  }
  return url;
};

const CurrentEmployeeProfile = () => {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState({ pan: false, aadhaar: false, exp: false });

  // Load Employee from sessionStorage
useEffect(() => {
  const saved = sessionStorage.getItem("hrmsUser");

  if (!saved || saved === "undefined") {
    setLoading(false);
    return;
  }

  try {
    const parsed = JSON.parse(saved);

    // ✅ ALWAYS normalize user shape
    const empData = {
      ...parsed,
      employeeId: String(parsed.employeeId),
      experienceDetails:
        parsed.experienceDetails?.length > 0
          ? parsed.experienceDetails
          : [
              {
                company: "Current Company",
                role: "",
                department: "",
                joiningDate: "",
                salary: 0,
              },
            ],
    };

    setEmployee(empData);
  } catch (e) {
    console.error("Error parsing hrmsUser:", e);
    setEmployee(null);
  } finally {
    setLoading(false);
  }
}, []);

  if (loading) return <div className="p-10 text-center text-blue-600 font-bold"><FaSpinner className="animate-spin inline mr-2"/>Loading profile...</div>;

  if (!employee)
    return (
      <div className="p-10 text-red-600 text-center font-bold border-2 border-red-200 rounded-lg m-10 bg-red-50">
        Employee not found. Please log in again.
      </div>
    );

  // ---------------- STATE UPDATERS ----------------

  const handleBasicChange = (field, value) => {
    if (field === "name" || field === "emergency") {
      if (!/^[A-Za-z\s]*$/.test(value)) return;
    }
    if (field === "phone" || field === "emergencyPhone") {
      if (!/^\d{0,10}$/.test(value)) return;
    }
    setEmployee((p) => ({ ...p, [field]: value }));
  };

  // ✅ IMPROVED VALIDATION LOGIC
  const handleNestedChange = (section, field, value) => {
    
    // 1. Account Number (Digits Only)
    if (field === "accountNumber") {
       if (!/^\d*$/.test(value)) return;
    }

    // 2. Aadhaar Validation (12 Digits + Formatting)
    if (field === "aadhaarNumber") {
      const raw = value.replace(/\D/g, "");
      const clean = raw.slice(0, 12);
      let formatted = clean;
      if (clean.length > 4) {
        formatted = clean.slice(0, 4) + "-" + clean.slice(4);
      }
      if (clean.length > 8) {
        formatted = formatted.slice(0, 9) + "-" + formatted.slice(9);
      }
      value = formatted;
    }

    // 3. PAN Validation (10 Chars + Uppercase + AlphaNumeric)
    if (field === "panNumber") {
      let val = value.toUpperCase();
      val = val.replace(/[^A-Z0-9]/g, "");
      value = val.slice(0, 10);
    }

    setEmployee((p) => ({
      ...p,
      [section]: { ...(p[section] || {}), [field]: value },
    }));
  };

  const handleCurrentJobChange = (field, value) => {
    setEmployee((p) => {
      const list = [...(p.experienceDetails || [])];
      const lastIndex = list.length - 1;
      if (lastIndex >= 0) {
        list[lastIndex] = { ...list[lastIndex], [field]: value };
      }
      return { ...p, experienceDetails: list };
    });
  };

  const updateExp = (i, field, value) => {
    setEmployee((p) => {
      const list = [...(p.experienceDetails || [])];
      list[i] = { ...list[i], [field]: value };
      return { ...p, experienceDetails: list };
    });
  };

  const addExperience = () => {
    setEmployee((p) => ({
      ...p,
      experienceDetails: [
        ...(p.experienceDetails || []),
        { company: "", role: "", department: "", years: "", joiningDate: "", lastWorkingDate: "", salary: "", reason: "", experienceLetterUrl: "" },
      ],
    }));
  };

  const removeExperience = (i) => {
    if(!window.confirm("Delete this experience record?")) return;
    setEmployee((p) => {
      const list = [...(p.experienceDetails || [])];
      list.splice(i, 1);
      return { ...p, experienceDetails: list };
    });
  };

  // ---------------- FILE UPLOAD (UPDATED) ----------------

  const handleFileUpload = async (e, type, index = null) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append("file", file);

    setUploading(prev => ({ ...prev, [type]: true }));

    try {
      // UPDATED: Use api instance instead of axios. 
      // api.js handles the Base URL (Production/Local) and Authorization Token.
      const res = await api.post(`/api/employees/upload-doc`, uploadData, {
        headers: { 
            "Content-Type": "multipart/form-data"
        }
      });

      let url = res.data.url;
      if (url && url.startsWith("http:")) url = url.replace("http:", "https:");

      if (type === "pan") {
        handleNestedChange("personalDetails", "panFileUrl", url);
      } else if (type === "aadhaar") {
        handleNestedChange("personalDetails", "aadhaarFileUrl", url);
      } else if (type === "exp" && index !== null) {
        updateExp(index, "experienceLetterUrl", url);
      }
    } catch (err) {
      console.error("Upload Error:", err);
      alert("File upload failed: " + (err.response?.data?.message || err.message));
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  // ---------------- SAVE TO BACKEND (UPDATED) ----------------

  const saveChanges = async () => {
    // 1. Phone Validation
    if (employee.phone?.length !== 10) return alert("Phone number must be 10 digits");
    
    // 2. Aadhaar Validation
    const cleanAadhaar = employee.personalDetails?.aadhaarNumber?.replace(/\D/g, "") || "";
    if (cleanAadhaar.length > 0 && cleanAadhaar.length !== 12) {
       return alert("Aadhaar Number must be exactly 12 digits");
    }

    // 3. PAN Validation
    const pan = employee.personalDetails?.panNumber || "";
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (pan.length > 0 && !panRegex.test(pan)) {
       return alert("Invalid PAN Format. Example: ABCDE1234F");
    }

    const empId = String(employee.employeeId);
    const updatedEmployee = { ...employee, employeeId: empId };

    setSaving(true);

    try {
      // UPDATED: Use api instance. No need to pass token manually.
      const { data } = await api.put(
        `/api/employees/${empId}`, 
        updatedEmployee
      );
      
      data.employeeId = String(data.employeeId);
      
      const currentStorage = JSON.parse(sessionStorage.getItem("hrmsUser") || "{}");
      const newData = { ...currentStorage, ...data }; 
      if(currentStorage.token && !newData.token) newData.token = currentStorage.token;

      sessionStorage.setItem("hrmsUser", JSON.stringify(newData));
      setEmployee(data);

      alert("✅ Profile updated successfully!");
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || err.response?.data?.error || err.message;
      alert("❌ Failed to update: " + msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleEdit = () => {
    if (isEditing) saveChanges();
    else setIsEditing(true);
  };

  const {
    employeeId, name, email, phone, address, emergency, emergencyPhone,
    personalDetails = {}, bankDetails = {}, experienceDetails = [],
  } = employee;

  const currentJob = experienceDetails.length > 0 
    ? experienceDetails[experienceDetails.length - 1] 
    : {};

  return (
    <div className="p-6 md:p-10 bg-slate-50 min-h-screen flex justify-center">
      <div className="w-full max-w-6xl bg-white rounded-xl shadow-xl overflow-hidden">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <FaUser className="text-blue-200" /> My Profile
            </h2>
            <p className="text-blue-200 mt-1 ml-1">Manage your personal and work information</p>
          </div>
          
          <div className="flex gap-3">
            {isEditing && (
              <button
                onClick={() => {
                  const saved = sessionStorage.getItem("hrmsUser");
                  if (saved) {
                    const parsed = JSON.parse(saved);
                    setEmployee(parsed.data || parsed);
                  }
                  setIsEditing(false);
                }}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
              >
                Cancel
              </button>
            )}
            <button
              onClick={toggleEdit}
              disabled={saving}
              className={`px-6 py-2 rounded-lg font-bold shadow-md flex items-center gap-2 transition ${
                isEditing 
                  ? "bg-green-500 hover:bg-green-600 text-white" 
                  : "bg-white text-blue-800 hover:bg-blue-50"
              }`}
            >
              {saving ? <FaSpinner className="animate-spin"/> : isEditing ? <FaSave/> : <FaEdit/>}
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Edit Profile"}
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <Section title="Basic Information">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StaticField label="Employee ID" value={employeeId} />
                <StaticField label="Email" value={email} />
                <Input label="Full Name" value={name} onChange={(v) => handleBasicChange("name", v)} editable={isEditing} icon={<FaUser/>} />
                <Input label="Phone (10 Digits)" value={phone} onChange={(v) => handleBasicChange("phone", v)} editable={isEditing} icon={<FaPhone/>} />
                <div className="md:col-span-2">
                   <Input label="Address" value={address} onChange={(v) => handleBasicChange("address", v)} editable={isEditing} icon={<FaAddressCard/>} />
                </div>
             </div>
          </Section>

          <Section title="Emergency Contact">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Contact Name" value={emergency} onChange={(v) => handleBasicChange("emergency", v)} editable={isEditing} icon={<FaUser/>} />
              <Input label="Contact Phone" value={emergencyPhone} onChange={(v) => handleBasicChange("emergencyPhone", v)} editable={isEditing} icon={<FaPhone/>} />
            </div>
          </Section>

          <Section title="Identity & Personal Details">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Gender</label>
                 {isEditing ? (
                   <select 
                     value={personalDetails.gender || "Prefer not to say"}
                     onChange={(e) => handleNestedChange("personalDetails", "gender", e.target.value)}
                     className="w-full border border-slate-300 rounded-lg px-4 py-2.5 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                   >
                     <option>Male</option>
                     <option>Female</option>
                     <option>Prefer not to say</option>
                   </select>
                 ) : <p className="p-2 border-b border-slate-200 text-slate-800">{personalDetails.gender || "N/A"}</p>}
               </div>

               <Input label="Date of Birth" type="date" value={personalDetails.dob?.split("T")[0]} onChange={(v) => handleNestedChange("personalDetails", "dob", v)} editable={isEditing} />
               <Input label="Nationality" value={personalDetails.nationality} onChange={(v) => handleNestedChange("personalDetails", "nationality", v)} editable={isEditing} />
               
               <Input label="Aadhaar (xxxx-xxxx-xxxx)" value={personalDetails.aadhaarNumber} onChange={(v) => handleNestedChange("personalDetails", "aadhaarNumber", v)} editable={isEditing} icon={<FaIdCard/>} />
               <Input label="PAN Number" value={personalDetails.panNumber} onChange={(v) => handleNestedChange("personalDetails", "panNumber", v)} editable={isEditing} className="uppercase" icon={<FaCreditCard/>} />
            </div>

            {isEditing && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                 <FileUpload label="Upload Aadhaar" onChange={(e)=>handleFileUpload(e, 'aadhaar')} uploading={uploading.aadhaar} fileUrl={personalDetails.aadhaarFileUrl} />
                 <FileUpload label="Upload PAN" onChange={(e)=>handleFileUpload(e, 'pan')} uploading={uploading.pan} fileUrl={personalDetails.panFileUrl} />
               </div>
            )}
            
            <div className="flex gap-4 mt-4">
               {personalDetails.aadhaarFileUrl && (
                 <a href={getSecureUrl(personalDetails.aadhaarFileUrl)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm font-semibold flex items-center gap-1">
                   <FaCheck className="text-green-500"/> View Aadhaar Document
                 </a>
               )}
               {personalDetails.panFileUrl && (
                 <a href={getSecureUrl(personalDetails.panFileUrl)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm font-semibold flex items-center gap-1">
                   <FaCheck className="text-green-500"/> View PAN Document
                 </a>
               )}
            </div>
          </Section>

          <Section title="Current Job Details">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               <Input label="Department" value={currentJob.department} onChange={(v) => handleCurrentJobChange("department", v)} editable={isEditing} icon={<FaBuilding/>} />
               <Input label="Role" value={currentJob.role} onChange={(v) => handleCurrentJobChange("role", v)} editable={isEditing} />
               <Input label="Joining Date" type="date" value={currentJob.joiningDate?.split("T")[0]} onChange={(v) => handleCurrentJobChange("joiningDate", v)} editable={isEditing} icon={<FaCalendarAlt/>} />
               <Input label="Salary (CTC)" type="number" value={currentJob.salary} onChange={(v) => handleCurrentJobChange("salary", v)} editable={isEditing} icon={<FaMoneyBill/>} />
             </div>
          </Section>

          <Section title="Bank Information">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Bank Name</label>
                 {isEditing ? (
                   <select 
                     value={bankDetails.bankName || INDIAN_BANKS[0]}
                     onChange={(e) => handleNestedChange("bankDetails", "bankName", e.target.value)}
                     className="w-full border border-slate-300 rounded-lg px-4 py-2.5 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                   >
                     {INDIAN_BANKS.map(bank => <option key={bank} value={bank}>{bank}</option>)}
                   </select>
                 ) : <p className="p-2 border-b border-slate-200 text-slate-800">{bankDetails.bankName || "N/A"}</p>}
               </div>
               <Input label="Account Number" value={bankDetails.accountNumber} onChange={(v) => handleNestedChange("bankDetails", "accountNumber", v)} editable={isEditing} icon={<FaCreditCard/>} />
               <Input label="IFSC Code" value={bankDetails.ifsc} onChange={(v) => handleNestedChange("bankDetails", "ifsc", v)} editable={isEditing} className="uppercase" />
               <Input label="Branch" value={bankDetails.branch} onChange={(v) => handleNestedChange("bankDetails", "branch", v)} editable={isEditing} />
             </div>
          </Section>

          <Section title="Previous Experience History">
             {isEditing && <button onClick={addExperience} className="mb-4 px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-bold">+ Add Previous Job</button>}
             
             {experienceDetails.slice(0, -1).map((exp, i) => (
               <div key={i} className="border border-slate-200 p-4 rounded-lg mb-4 bg-slate-50/50">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Input label="Company" value={exp.company} onChange={(v)=>updateExp(i, "company", v)} editable={isEditing} />
                    <Input label="Role" value={exp.role} onChange={(v)=>updateExp(i, "role", v)} editable={isEditing} />
                    <Input label="From Date" type="date" value={exp.joiningDate?.split("T")[0]} onChange={(v)=>updateExp(i, "joiningDate", v)} editable={isEditing} />
                    <Input label="To Date" type="date" value={exp.lastWorkingDate?.split("T")[0]} onChange={(v)=>updateExp(i, "lastWorkingDate", v)} editable={isEditing} />
                 </div>
                 <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Input label="Reason for Leaving" value={exp.reason} onChange={(v)=>updateExp(i, "reason", v)} editable={isEditing} />
                    </div>
                    {isEditing && (
                       <div className="md:col-span-2">
                          <FileUpload label="Upload Experience Letter" onChange={(e)=>handleFileUpload(e, 'exp', i)} uploading={uploading.exp} fileUrl={exp.experienceLetterUrl} />
                       </div>
                    )}
                    {exp.experienceLetterUrl && (
                       <a href={getSecureUrl(exp.experienceLetterUrl)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm md:col-span-2 flex items-center gap-1">
                          <FaCheck className="text-green-500"/> View Document
                        </a>
                    )}
                 </div>
                 {isEditing && <button onClick={()=>removeExperience(i)} className="mt-3 text-red-500 text-sm hover:underline flex items-center gap-1"><FaTrash/> Remove Entry</button>}
               </div>
             ))}
             {experienceDetails.length <= 1 && <p className="text-slate-400 italic">No previous experience recorded.</p>}
          </Section>

        </div>
      </div>
    </div>
  );
};

export default CurrentEmployeeProfile;

// ---------------- REUSABLE COMPONENTS ----------------

const Section = ({ title, children }) => (
  <div className="bg-white rounded-lg">
    <h3 className="text-lg font-bold text-slate-700 border-b border-slate-100 pb-2 mb-4 uppercase tracking-wide flex items-center gap-2">
      <span className="w-1 h-5 bg-blue-500 rounded-full"></span> {title}
    </h3>
    {children}
  </div>
);

const StaticField = ({ label, value }) => (
  <div>
    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{label}</label>
    <p className="text-slate-800 font-medium border-b border-slate-100 pb-1">{value || "N/A"}</p>
  </div>
);

const Input = ({ label, value, editable, onChange, type = "text", icon, className = "" }) => (
  <div>
    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">{label}</label>
    {editable ? (
      <div className="relative">
        {icon && <div className="absolute left-3 top-3 text-slate-400">{icon}</div>}
        <input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border border-slate-300 rounded-lg py-2.5 ${icon ? "pl-10" : "pl-4"} pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white ${className}`}
        />
      </div>
    ) : (
      <p className="p-2 border-b border-slate-100 text-slate-800">{value || "N/A"}</p>
    )}
  </div>
);

const FileUpload = ({ label, onChange, uploading, fileUrl }) => (
  <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 bg-slate-50 hover:bg-slate-100 transition">
    <p className="text-sm font-semibold text-slate-600 mb-2 flex justify-between items-center">
      {label}
      {fileUrl && <span className="text-green-600 text-xs font-bold flex items-center gap-1"><FaCheck/> Uploaded</span>}
    </p>
    <div className="flex items-center gap-3">
       <label className={`cursor-pointer flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-md hover:shadow-md transition ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
         {uploading ? <FaSpinner className="animate-spin text-blue-600"/> : <FaFileUpload className="text-blue-600"/>}
         <span className="text-sm text-slate-700">{uploading ? "Uploading..." : "Choose File"}</span>
         <input type="file" className="hidden" accept="image/*,.pdf" onChange={onChange} disabled={uploading} />
       </label>
       {fileUrl && (
         <a href={getSecureUrl(fileUrl)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">
           View
         </a>
       )}
    </div>
  </div>
);