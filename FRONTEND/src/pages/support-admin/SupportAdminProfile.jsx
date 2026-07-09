import React, { useState, useEffect } from "react";
import api from "../../api";
import {
  FaUser, FaEnvelope, FaPhone, FaBuilding,
  FaCalendarAlt, FaEdit, FaSave, FaTimes, FaClock,
  FaGlobe, FaGithub, FaLinkedin, FaInstagram, FaImage, FaInfoCircle,
  FaFileUpload, FaSpinner, FaCheck, FaTrash, FaPlus, FaLink,
  FaCreditCard, FaAddressCard, FaIdCard
} from "react-icons/fa";
import { QrCode, Link as LinkIcon } from "lucide-react";
import EmployeeQRCodeModal from "../../components/employee/EmployeeQRCodeModal";
import { motion } from "framer-motion";

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

const SupportAdminProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [uploading, setUploading] = useState({ profile: false, portfolioBg: false, aadhaar: false, pan: false, exp: false });

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    department: "",
    bio: "",
    profileImageUrl: "",
    portfolioBackgroundImageUrl: "",
    customPortfolioFields: [],
    socialLinks: {
      linkedin: "",
      github: "",
      instagram: "",
      website: ""
    },
    emergency: "",
    emergencyPhone: "",
    personalDetails: {
      gender: "Prefer not to say",
      dob: "",
      nationality: "",
      aadhaarNumber: "",
      panNumber: "",
      aadhaarFileUrl: "",
      panFileUrl: ""
    },
    bankDetails: {
      bankName: "",
      accountNumber: "",
      ifsc: "",
      branch: ""
    },
    experienceDetails: []
  });

  const fetchProfile = async () => {
    try {
      const res = await api.get("/api/admin/profile");

      const cleanCustomFields = (res.data.customPortfolioFields || []).filter(
        field => field.label !== "__extra_profile_data__"
      );

      setProfile({
        ...res.data,
        customPortfolioFields: cleanCustomFields
      });

      // Initialize form data with fetched values
      setFormData({
        name: res.data.name || "",
        phone: res.data.phone || "",
        department: res.data.department || "",
        bio: res.data.bio || "",
        profileImageUrl: res.data.profileImageUrl || "",
        portfolioBackgroundImageUrl: res.data.portfolioBackgroundImageUrl || "",
        customPortfolioFields: cleanCustomFields,
        socialLinks: {
          linkedin: res.data.socialLinks?.linkedin || "",
          github: res.data.socialLinks?.github || "",
          instagram: res.data.socialLinks?.instagram || "",
          website: res.data.socialLinks?.website || ""
        },
        emergency: res.data.emergency || "",
        emergencyPhone: res.data.emergencyPhone || "",
        personalDetails: {
          gender: res.data.personalDetails?.gender || "Prefer not to say",
          dob: res.data.personalDetails?.dob ? res.data.personalDetails.dob.split("T")[0] : "",
          nationality: res.data.personalDetails?.nationality || "",
          aadhaarNumber: res.data.personalDetails?.aadhaarNumber || "",
          panNumber: res.data.personalDetails?.panNumber || "",
          aadhaarFileUrl: res.data.personalDetails?.aadhaarFileUrl || "",
          panFileUrl: res.data.personalDetails?.panFileUrl || ""
        },
        bankDetails: {
          bankName: res.data.bankDetails?.bankName || "",
          accountNumber: res.data.bankDetails?.accountNumber || "",
          ifsc: res.data.bankDetails?.ifsc || "",
          branch: res.data.bankDetails?.branch || ""
        },
        experienceDetails:
          res.data.experienceDetails?.length > 0
            ? res.data.experienceDetails
            : [
              {
                company: "Current Company",
                role: "",
                department: res.data.department || "",
                joiningDate: "",
                salary: "",
              },
            ]
      });
    } catch (err) {
      console.error("Error fetching profile", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleFileUpload = async (e, type, index = null) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append("file", file);

    setUploading(prev => ({ ...prev, [type]: true }));

    try {
      const res = await api.post(`/api/employees/upload-doc`, uploadData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      let url = res.data.url;
      if (url && url.startsWith("http:")) url = url.replace("http:", "https:");

      if (type === "profile") {
        setFormData(prev => ({ ...prev, profileImageUrl: url }));
      } else if (type === "portfolioBg") {
        setFormData(prev => ({ ...prev, portfolioBackgroundImageUrl: url }));
      } else if (type === "aadhaar") {
        setFormData(prev => ({
          ...prev,
          personalDetails: { ...prev.personalDetails, aadhaarFileUrl: url }
        }));
      } else if (type === "pan") {
        setFormData(prev => ({
          ...prev,
          personalDetails: { ...prev.personalDetails, panFileUrl: url }
        }));
      } else if (type === "exp" && index !== null) {
        setFormData(prev => {
          const list = [...prev.experienceDetails];
          list[index] = { ...list[index], experienceLetterUrl: url };
          return { ...prev, experienceDetails: list };
        });
      }
    } catch (err) {
      console.error("Upload Error:", err);
      alert("File upload failed: " + (err.response?.data?.message || err.message));
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const addCustomField = () => {
    setFormData(prev => ({
      ...prev,
      customPortfolioFields: [...(prev.customPortfolioFields || []), { label: "", value: "" }]
    }));
  };

  const removeCustomField = (index) => {
    setFormData(prev => {
      const list = [...(prev.customPortfolioFields || [])];
      list.splice(index, 1);
      return { ...prev, customPortfolioFields: list };
    });
  };

  const updateCustomField = (index, key, val) => {
    setFormData(prev => {
      const list = [...(prev.customPortfolioFields || [])];
      list[index] = { ...list[index], [key]: val };
      return { ...prev, customPortfolioFields: list };
    });
  };

  const addExperience = () => {
    setFormData(prev => {
      const list = [...(prev.experienceDetails || [])];
      const currentJob = list.pop() || { company: "Current Company", role: "", department: "", joiningDate: "", salary: "" };
      const newPrevious = { company: "", role: "", department: "", joiningDate: "", lastWorkingDate: "", salary: "", reason: "", experienceLetterUrl: "" };
      return {
        ...prev,
        experienceDetails: [...list, newPrevious, currentJob]
      };
    });
  };

  const removeExperience = (index) => {
    if (!window.confirm("Delete this experience record?")) return;
    setFormData(prev => {
      const list = [...prev.experienceDetails];
      list.splice(index, 1);
      return { ...prev, experienceDetails: list };
    });
  };

  const updateExperience = (index, field, value) => {
    setFormData(prev => {
      const list = [...prev.experienceDetails];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, experienceDetails: list };
    });
  };

  const handleCurrentJobChange = (field, value) => {
    setFormData(prev => {
      const list = [...(prev.experienceDetails || [])];
      const lastIndex = list.length - 1;
      if (lastIndex >= 0) {
        list[lastIndex] = { ...list[lastIndex], [field]: value };
      } else {
        list.push({ company: "Current Company", [field]: value });
      }
      return { ...prev, experienceDetails: list };
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    const phoneRegex = /^\d{10}$/;

    if (formData.phone && !phoneRegex.test(formData.phone)) {
      return alert("Phone number must be exactly 10 digits");
    }

    if (formData.emergencyPhone && !phoneRegex.test(formData.emergencyPhone)) {
      return alert("Emergency Phone number must be exactly 10 digits");
    }
    const cleanAadhaar = formData.personalDetails?.aadhaarNumber?.replace(/\D/g, "") || "";
    if (cleanAadhaar.length > 0 && cleanAadhaar.length !== 12) {
      return alert("Aadhaar Number must be exactly 12 digits");
    }
    const pan = formData.personalDetails?.panNumber || "";
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (pan.length > 0 && !panRegex.test(pan)) {
      return alert("Invalid PAN Format. Example: ABCDE1234F");
    }

    setUpdateLoading(true);
    try {
      await api.put("/api/admin/profile/update", formData);
      await fetchProfile(); // Refresh data
      setIsEditing(false);
      alert("Profile updated successfully!");
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
    } finally {
      setUpdateLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit", month: "long", year: "numeric",
    });
  };

  const currentJob = formData.experienceDetails?.length > 0
    ? formData.experienceDetails[formData.experienceDetails.length - 1]
    : {};

  const currentJobProfile = profile?.experienceDetails?.length > 0
    ? profile.experienceDetails[profile.experienceDetails.length - 1]
    : {};

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9ff]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* HEADER SECTION */}
        <div className="bg-white rounded-[2rem] p-5 sm:p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row md:flex-wrap items-center gap-6 relative overflow-hidden">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-4xl font-bold shadow-lg shrink-0 overflow-hidden border-2 border-white">
            {profile?.profileImageUrl ? (
              <img src={profile.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              profile?.name?.charAt(0)
            )}
          </div>
          <div className="text-center md:text-left flex-1 min-w-0">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              {isEditing ? (
                <input
                  className="text-2xl sm:text-3xl font-bold text-gray-900 border-b-2 border-purple-200 outline-none focus:border-purple-600 bg-transparent w-full max-w-full"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              ) : (
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{profile?.name}</h1>
              )}
              {!isEditing && (
                <button
                  onClick={() => setIsQrModalOpen(true)}
                  className="p-1.5 bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-full transition-colors cursor-pointer"
                  title="Show QR Code"
                >
                  <QrCode size={18} />
                </button>
              )}
            </div>
            <p className="text-gray-500 font-medium uppercase tracking-widest text-[10px] mt-1">
              {profile?.role === "support-admin" ? "Support Admin" : profile?.role} • {profile?.department}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row md:ml-auto">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex w-full items-center justify-center gap-2 whitespace-nowrap bg-purple-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 sm:w-auto"
              >
                <FaEdit size={14} /> Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={handleUpdate}
                  disabled={updateLoading}
                  className="flex w-full items-center justify-center gap-2 whitespace-nowrap bg-emerald-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-60 sm:w-auto"
                >
                  <FaSave size={14} /> {updateLoading ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => {
                    fetchProfile();
                    setIsEditing(false);
                  }}
                  className="flex w-full items-center justify-center gap-2 whitespace-nowrap bg-gray-100 text-gray-600 px-5 py-2.5 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all sm:w-auto"
                >
                  <FaTimes size={14} /> Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* BASIC INFORMATION CARD */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
          <h3 className="text-gray-900 font-bold mb-8 flex items-center gap-2 border-b pb-4">
            <FaUser className="text-purple-500 text-sm" /> Basic Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <InfoItem icon={<FaEnvelope />} label="Email Address (Locked)" value={profile?.email} />

            {/* Editable Phone */}
            <div className="flex items-center gap-4 group min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                <FaPhone />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Phone Number</p>
                {isEditing ? (
                  <input
                    className="w-full font-bold text-gray-900 border-b border-purple-200 focus:border-purple-600 outline-none py-1"
                    value={formData.phone}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^\d{0,10}$/.test(val)) {
                        setFormData({ ...formData, phone: val });
                      }
                    }}
                  />
                ) : (
                  <p className="text-gray-900 font-bold">{profile?.phone || "Not Provided"}</p>
                )}
              </div>
            </div>

            {/* Editable Department */}
            <div className="flex items-center gap-4 group min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                <FaBuilding />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Department</p>
                {isEditing ? (
                  <input
                    className="w-full font-bold text-gray-900 border-b border-purple-200 focus:border-purple-600 outline-none py-1"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                ) : (
                  <p className="text-gray-900 font-bold">{profile?.department}</p>
                )}
              </div>
            </div>

            <InfoItem icon={<FaClock />} label="Member Since" value={formatDate(profile?.createdAt)} />
          </div>
        </div>

        {/* EMERGENCY CONTACT CARD */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
          <h3 className="text-gray-900 font-bold mb-8 flex items-center gap-2 border-b pb-4">
            <FaPhone className="text-purple-500 text-sm" /> Emergency Contact
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <EditableItem
              isEditing={isEditing} icon={<FaUser />} label="Contact Name"
              value={formData.emergency} displayValue={profile?.emergency || "Not Provided"}
              onChange={(e) => {
                const val = e.target.value;
                if (/^[A-Za-z\s]*$/.test(val)) {
                  setFormData({ ...formData, emergency: val });
                }
              }}
            />
            <EditableItem
              isEditing={isEditing} icon={<FaPhone />} label="Contact Phone"
              value={formData.emergencyPhone} displayValue={profile?.emergencyPhone || "Not Provided"}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d{0,10}$/.test(val)) {
                  setFormData({ ...formData, emergencyPhone: val });
                }
              }}
            />
          </div>
        </div>

        {/* IDENTITY & PERSONAL DETAILS CARD */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
          <h3 className="text-gray-900 font-bold mb-8 flex items-center gap-2 border-b pb-4">
            <FaIdCard className="text-purple-500 text-sm" /> Identity & Personal Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Gender Selection */}
            <div className="flex items-center gap-4 group min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
                <FaUser />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Gender</p>
                {isEditing ? (
                  <select
                    className="w-full font-bold text-gray-900 border-b border-purple-200 focus:border-purple-600 outline-none py-1 bg-transparent"
                    value={formData.personalDetails?.gender || "Prefer not to say"}
                    onChange={(e) => setFormData({
                      ...formData,
                      personalDetails: { ...formData.personalDetails, gender: e.target.value }
                    })}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                ) : (
                  <p className="text-gray-900 font-bold truncate">{profile?.personalDetails?.gender || "Prefer not to say"}</p>
                )}
              </div>
            </div>

            <EditableItem
              isEditing={isEditing} icon={<FaCalendarAlt />} label="Date of Birth"
              type="date"
              value={formData.personalDetails?.dob || ""}
              displayValue={profile?.personalDetails?.dob ? formatDate(profile.personalDetails.dob) : "Not Provided"}
              onChange={(e) => setFormData({
                ...formData,
                personalDetails: { ...formData.personalDetails, dob: e.target.value }
              })}
            />

            <EditableItem
              isEditing={isEditing} icon={<FaGlobe />} label="Nationality"
              value={formData.personalDetails?.nationality || ""}
              displayValue={profile?.personalDetails?.nationality || "Not Provided"}
              onChange={(e) => setFormData({
                ...formData,
                personalDetails: { ...formData.personalDetails, nationality: e.target.value }
              })}
            />

            <EditableItem
              isEditing={isEditing} icon={<FaIdCard />} label="Aadhaar (xxxx-xxxx-xxxx)"
              value={formData.personalDetails?.aadhaarNumber || ""}
              displayValue={profile?.personalDetails?.aadhaarNumber || "Not Provided"}
              onChange={(e) => {
                const value = e.target.value;
                const raw = value.replace(/\D/g, "");
                const clean = raw.slice(0, 12);
                let formatted = clean;
                if (clean.length > 4) {
                  formatted = clean.slice(0, 4) + "-" + clean.slice(4);
                }
                if (clean.length > 8) {
                  formatted = formatted.slice(0, 9) + "-" + formatted.slice(9);
                }
                setFormData({
                  ...formData,
                  personalDetails: { ...formData.personalDetails, aadhaarNumber: formatted }
                });
              }}
            />

            <EditableItem
              isEditing={isEditing} icon={<FaCreditCard />} label="PAN Number"
              className="uppercase"
              value={formData.personalDetails?.panNumber || ""}
              displayValue={profile?.personalDetails?.panNumber || "Not Provided"}
              onChange={(e) => {
                let val = e.target.value.toUpperCase();
                val = val.replace(/[^A-Z0-9]/g, "");
                setFormData({
                  ...formData,
                  personalDetails: { ...formData.personalDetails, panNumber: val.slice(0, 10) }
                });
              }}
            />
          </div>

          {/* Documents Upload Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 pt-8 border-t border-gray-100">
            <FileUpload
              label="Aadhaar Document"
              uploading={uploading.aadhaar}
              fileUrl={formData.personalDetails?.aadhaarFileUrl || profile?.personalDetails?.aadhaarFileUrl}
              isEditing={isEditing}
              onChange={(e) => handleFileUpload(e, 'aadhaar')}
            />
            <FileUpload
              label="PAN Document"
              uploading={uploading.pan}
              fileUrl={formData.personalDetails?.panFileUrl || profile?.personalDetails?.panFileUrl}
              isEditing={isEditing}
              onChange={(e) => handleFileUpload(e, 'pan')}
            />
          </div>
        </div>

        {/* CURRENT JOB DETAILS CARD */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
          <h3 className="text-gray-900 font-bold mb-8 flex items-center gap-2 border-b pb-4">
            <FaBuilding className="text-purple-500 text-sm" /> Current Job Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <EditableItem
              isEditing={isEditing} icon={<FaBuilding />} label="Department"
              value={currentJob.department || ""}
              displayValue={currentJobProfile.department || "Not Provided"}
              onChange={(e) => handleCurrentJobChange("department", e.target.value)}
            />
            <EditableItem
              isEditing={isEditing} icon={<FaUser />} label="Role"
              value={currentJob.role || ""}
              displayValue={currentJobProfile.role || "Not Provided"}
              onChange={(e) => handleCurrentJobChange("role", e.target.value)}
            />
            <EditableItem
              isEditing={isEditing} icon={<FaCalendarAlt />} label="Joining Date"
              type="date"
              value={currentJob.joiningDate ? currentJob.joiningDate.split("T")[0] : ""}
              displayValue={currentJobProfile.joiningDate ? formatDate(currentJobProfile.joiningDate) : "Not Provided"}
              onChange={(e) => handleCurrentJobChange("joiningDate", e.target.value)}
            />
            <EditableItem
              isEditing={isEditing} icon={<FaClock />} label="Salary (CTC)"
              type="number"
              value={currentJob.salary || ""}
              displayValue={currentJobProfile.salary || "Not Provided"}
              onChange={(e) => handleCurrentJobChange("salary", e.target.value)}
            />
          </div>
        </div>

        {/* BANK INFORMATION CARD */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
          <h3 className="text-gray-900 font-bold mb-8 flex items-center gap-2 border-b pb-4">
            <FaCreditCard className="text-purple-500 text-sm" /> Bank Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Bank Name Select */}
            <div className="flex items-center gap-4 group min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
                <FaCreditCard />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Bank Name</p>
                {isEditing ? (
                  <select
                    className="w-full font-bold text-gray-900 border-b border-purple-200 focus:border-purple-600 outline-none py-1 bg-transparent"
                    value={formData.bankDetails?.bankName || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      bankDetails: { ...formData.bankDetails, bankName: e.target.value }
                    })}
                  >
                    <option value="">Select Bank</option>
                    {INDIAN_BANKS.map(bank => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-gray-900 font-bold truncate">{profile?.bankDetails?.bankName || "Not Provided"}</p>
                )}
              </div>
            </div>

            <EditableItem
              isEditing={isEditing} icon={<FaCreditCard />} label="Account Number"
              value={formData.bankDetails?.accountNumber || ""}
              displayValue={profile?.bankDetails?.accountNumber || "Not Provided"}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d*$/.test(val)) {
                  setFormData({
                    ...formData,
                    bankDetails: { ...formData.bankDetails, accountNumber: val }
                  });
                }
              }}
            />

            <EditableItem
              isEditing={isEditing} icon={<FaBuilding />} label="IFSC Code"
              className="uppercase"
              value={formData.bankDetails?.ifsc || ""}
              displayValue={profile?.bankDetails?.ifsc || "Not Provided"}
              onChange={(e) => setFormData({
                ...formData,
                bankDetails: { ...formData.bankDetails, ifsc: e.target.value.toUpperCase() }
              })}
            />

            <EditableItem
              isEditing={isEditing} icon={<FaBuilding />} label="Branch"
              value={formData.bankDetails?.branch || ""}
              displayValue={profile?.bankDetails?.branch || "Not Provided"}
              onChange={(e) => setFormData({
                ...formData,
                bankDetails: { ...formData.bankDetails, branch: e.target.value }
              })}
            />
          </div>
        </div>

        {/* PREVIOUS EXPERIENCE HISTORY CARD */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <h3 className="text-gray-900 font-bold flex items-center gap-2">
              <FaCalendarAlt className="text-purple-500 text-sm" /> Previous Experience History
            </h3>
            {isEditing && (
              <button
                type="button"
                onClick={addExperience}
                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors"
              >
                <FaPlus /> Add Previous Job
              </button>
            )}
          </div>

          <div className="space-y-6">
            {(formData.experienceDetails || []).slice(0, -1).map((exp, i) => (
              <div key={i} className="border border-purple-100 p-6 rounded-2xl bg-purple-50/20 relative group">
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => removeExperience(i)}
                    className="absolute top-4 right-4 text-red-500 hover:text-red-700 p-2 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    title="Remove experience"
                  >
                    <FaTrash size={12} />
                  </button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <EditableItem
                    isEditing={isEditing} icon={<FaBuilding />} label="Company"
                    value={exp.company} displayValue={exp.company || "Not Provided"}
                    onChange={(e) => updateExperience(i, "company", e.target.value)}
                  />
                  <EditableItem
                    isEditing={isEditing} icon={<FaUser />} label="Role"
                    value={exp.role} displayValue={exp.role || "Not Provided"}
                    onChange={(e) => updateExperience(i, "role", e.target.value)}
                  />
                  <EditableItem
                    isEditing={isEditing} icon={<FaCalendarAlt />} label="From Date"
                    type="date"
                    value={exp.joiningDate ? exp.joiningDate.split("T")[0] : ""}
                    displayValue={exp.joiningDate ? formatDate(exp.joiningDate) : "Not Provided"}
                    onChange={(e) => updateExperience(i, "joiningDate", e.target.value)}
                  />
                  <EditableItem
                    isEditing={isEditing} icon={<FaCalendarAlt />} label="To Date"
                    type="date"
                    value={exp.lastWorkingDate ? exp.lastWorkingDate.split("T")[0] : ""}
                    displayValue={exp.lastWorkingDate ? formatDate(exp.lastWorkingDate) : "Not Provided"}
                    onChange={(e) => updateExperience(i, "lastWorkingDate", e.target.value)}
                  />
                  <EditableItem
                    isEditing={isEditing} icon={<FaBuilding />} label="Department"
                    value={exp.department} displayValue={exp.department || "Not Provided"}
                    onChange={(e) => updateExperience(i, "department", e.target.value)}
                  />
                  <EditableItem
                    isEditing={isEditing} icon={<FaClock />} label="Salary / CTC"
                    value={exp.salary} displayValue={exp.salary || "Not Provided"}
                    onChange={(e) => updateExperience(i, "salary", e.target.value)}
                  />
                  <div className="col-span-1 md:col-span-2">
                    <EditableItem
                      isEditing={isEditing} icon={<FaInfoCircle />} label="Reason for Leaving"
                      value={exp.reason} displayValue={exp.reason || "Not Provided"}
                      onChange={(e) => updateExperience(i, "reason", e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-purple-100/50">
                  <FileUpload
                    label="Experience Letter"
                    uploading={uploading.exp}
                    fileUrl={exp.experienceLetterUrl}
                    isEditing={isEditing}
                    onChange={(e) => handleFileUpload(e, 'exp', i)}
                  />
                </div>
              </div>
            ))}

            {!(formData.experienceDetails?.length) && (
              <p className="text-gray-400 italic text-sm">No previous experience history recorded.</p>
            )}
          </div>
        </div>

        {/* PORTFOLIO INFORMATION CARD */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
          <h3 className="text-gray-900 font-bold mb-8 flex items-center gap-2 border-b pb-4">
            <FaGlobe className="text-purple-500 text-sm" /> Portfolio Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <EditableItem
              isEditing={isEditing} icon={<FaInfoCircle />} label="Bio"
              value={formData.bio} displayValue={profile?.bio || "Not Provided"}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            />
            <FileUpload
              label="Profile Image"
              uploading={uploading.profile}
              fileUrl={formData.profileImageUrl || profile?.profileImageUrl}
              isEditing={isEditing}
              onChange={(e) => handleFileUpload(e, 'profile')}
            />
            <FileUpload
              label="Background Image"
              uploading={uploading.portfolioBg}
              fileUrl={formData.portfolioBackgroundImageUrl || profile?.portfolioBackgroundImageUrl}
              isEditing={isEditing}
              onChange={(e) => handleFileUpload(e, 'portfolioBg')}
            />
            <EditableItem
              isEditing={isEditing} icon={<FaLinkedin />} label="LinkedIn URL"
              value={formData.socialLinks.linkedin} displayValue={profile?.socialLinks?.linkedin || "Not Provided"}
              onChange={(e) => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, linkedin: e.target.value } })}
            />
            <EditableItem
              isEditing={isEditing} icon={<FaGithub />} label="GitHub URL"
              value={formData.socialLinks.github} displayValue={profile?.socialLinks?.github || "Not Provided"}
              onChange={(e) => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, github: e.target.value } })}
            />
            <EditableItem
              isEditing={isEditing} icon={<FaInstagram />} label="Instagram URL"
              value={formData.socialLinks.instagram} displayValue={profile?.socialLinks?.instagram || "Not Provided"}
              onChange={(e) => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, instagram: e.target.value } })}
            />
            <EditableItem
              isEditing={isEditing} icon={<FaGlobe />} label="Website URL"
              value={formData.socialLinks.website} displayValue={profile?.socialLinks?.website || "Not Provided"}
              onChange={(e) => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, website: e.target.value } })}
            />
          </div>

          {/* CUSTOM FIELDS */}
          <div className="mt-8 pt-8 border-t border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-gray-900 font-bold flex items-center gap-2">
                Custom Fields
              </h4>
              {isEditing && (
                <button
                  type="button"
                  onClick={addCustomField}
                  className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <FaPlus /> Add Field
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {(formData.customPortfolioFields || []).map((field, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Label</p>
                    {isEditing ? (
                      <input className="w-full font-bold text-gray-900 border-b border-purple-200 focus:border-purple-600 outline-none py-1" value={field.label} onChange={(e) => updateCustomField(i, "label", e.target.value)} placeholder="e.g. Languages" />
                    ) : (
                      <p className="text-gray-900 font-bold truncate">{field.label}</p>
                    )}
                  </div>
                  <div className="flex-[2]">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Value</p>
                    {isEditing ? (
                      <input className="w-full font-bold text-gray-900 border-b border-purple-200 focus:border-purple-600 outline-none py-1" value={field.value} onChange={(e) => updateCustomField(i, "value", e.target.value)} />
                    ) : (
                      field.value?.startsWith('http') ? (
                        <motion.a
                          key={`custom-link-${i}`}
                          whileHover={{ y: -3 }}
                          whileTap={{ scale: 0.95 }}
                          href={field.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={field.label}
                          className="w-[38px] h-[38px] bg-[#0B1320] rounded flex items-center justify-center text-white hover:bg-[#1A2640] transition-colors shadow-md relative group"
                        >
                          <LinkIcon className="w-[18px] h-[18px]" />
                        </motion.a>
                      ) : (
                        <p className="text-gray-900 font-bold truncate">{field.value}</p>
                      )
                    )}
                  </div>
                  {isEditing && (
                    <button onClick={() => removeCustomField(i)} className="mt-5 text-red-500 hover:text-red-700 p-2 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                      <FaTrash size={12} />
                    </button>
                  )}
                </div>
              ))}
              {!(formData.customPortfolioFields || []).length && !isEditing && (
                <p className="text-gray-400 italic text-sm">No custom fields added.</p>
              )}
            </div>
          </div>
        </div>

      </div>

      <EmployeeQRCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        qrCodeUrl={
          profile?.qrCodeUrl && typeof profile.qrCodeUrl === "string" && profile.qrCodeUrl.startsWith("http")
            ? profile.qrCodeUrl
            : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://vwsync.com/portfolio/${profile?.supportAdminId || profile?._id}`)}`
        }
        portfolioUrl={`https://vwsync.com/portfolio/${profile?.supportAdminId || profile?._id}`}
        employeeName={profile?.name}
      />
    </div>
  );
};

const InfoItem = ({ icon, label, value }) => (
  <div className="flex items-center gap-4 group">
    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
      <p className="text-gray-900 font-bold truncate">{value}</p>
    </div>
  </div>
);

const EditableItem = ({ isEditing, icon, label, value, displayValue, onChange, type = "text", className = "" }) => (
  <div className="flex items-center gap-4 group min-w-0">
    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      {isEditing ? (
        <input
          type={type}
          className={`w-full font-bold text-gray-900 border-b border-purple-200 focus:border-purple-600 outline-none py-1 ${className}`}
          value={value}
          onChange={onChange}
        />
      ) : (
        <p className="text-gray-900 font-bold truncate">{displayValue}</p>
      )}
    </div>
  </div>
);

const FileUpload = ({ label, onChange, uploading, fileUrl, isEditing }) => {
  if (!isEditing && !fileUrl) {
    return (
      <div className="flex items-center gap-4 group min-w-0">
        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
          <FaImage />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
          <p className="text-gray-900 font-bold truncate">Not Provided</p>
        </div>
      </div>
    );
  }

  if (!isEditing && fileUrl) {
    return (
      <div className="flex items-center gap-4 group min-w-0">
        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
          <FaImage />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
          <a href={fileUrl} target="_blank" rel="noreferrer" className="text-purple-600 font-bold hover:underline text-sm truncate">
            View Image
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-1 md:col-span-2 border-2 border-dashed border-purple-200 rounded-xl p-4 bg-purple-50/50 hover:bg-purple-50 transition w-full">
      <p className="text-xs font-semibold text-purple-900 mb-2 flex justify-between items-center">
        {label}
        {fileUrl && <span className="text-green-600 text-[10px] font-bold flex items-center gap-1"><FaCheck /> Uploaded</span>}
      </p>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <label className={`cursor-pointer flex items-center gap-2 bg-white border border-purple-200 px-4 py-2 rounded-lg hover:shadow-sm transition ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? <FaSpinner className="animate-spin text-purple-600" /> : <FaFileUpload className="text-purple-600" />}
          <span className="text-xs font-bold text-purple-700">{uploading ? "Uploading..." : "Choose Image"}</span>
          <input type="file" className="hidden" accept="image/*" onChange={onChange} disabled={uploading} />
        </label>
        {fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline text-xs font-bold">
            Preview
          </a>
        )}
      </div>
    </div>
  );
};

export default SupportAdminProfile;
