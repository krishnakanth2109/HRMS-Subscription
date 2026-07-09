import React, { useState, useEffect } from "react";
import api from "../../api";
import {
  FaUser, FaEnvelope, FaPhone, FaBuilding,
  FaCalendarAlt, FaEdit, FaSave, FaTimes, FaClock,
  FaGlobe, FaGithub, FaLinkedin, FaInstagram, FaImage, FaInfoCircle,
  FaFileUpload, FaSpinner, FaCheck, FaTrash, FaPlus, FaLink
} from "react-icons/fa";
import { QrCode, Link as LinkIcon } from "lucide-react";
import EmployeeQRCodeModal from "../../components/employee/EmployeeQRCodeModal";
import { motion } from "framer-motion";

const SupportAdminProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [uploading, setUploading] = useState({ profile: false, portfolioBg: false });

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
    }
  });

  const fetchProfile = async () => {
    try {
      const res = await api.get("/api/admin/profile");
      setProfile(res.data);
      // Initialize form data with fetched values
      setFormData({
        name: res.data.name || "",
        phone: res.data.phone || "",
        department: res.data.department || "",
        bio: res.data.bio || "",
        profileImageUrl: res.data.profileImageUrl || "",
        portfolioBackgroundImageUrl: res.data.portfolioBackgroundImageUrl || "",
        customPortfolioFields: res.data.customPortfolioFields || [],
        socialLinks: {
          linkedin: res.data.socialLinks?.linkedin || "",
          github: res.data.socialLinks?.github || "",
          instagram: res.data.socialLinks?.instagram || "",
          website: res.data.socialLinks?.website || ""
        }
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

  const handleFileUpload = async (e, type) => {
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
      customPortfolioFields: [...prev.customPortfolioFields, { label: "", value: "" }]
    }));
  };

  const removeCustomField = (index) => {
    setFormData(prev => {
      const list = [...prev.customPortfolioFields];
      list.splice(index, 1);
      return { ...prev, customPortfolioFields: list };
    });
  };

  const updateCustomField = (index, key, val) => {
    setFormData(prev => {
      const list = [...prev.customPortfolioFields];
      list[index] = { ...list[index], [key]: val };
      return { ...prev, customPortfolioFields: list };
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
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
                  onClick={() => setIsEditing(false)}
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
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, linkedin: e.target.value }})}
            />
            <EditableItem 
              isEditing={isEditing} icon={<FaGithub />} label="GitHub URL" 
              value={formData.socialLinks.github} displayValue={profile?.socialLinks?.github || "Not Provided"}
              onChange={(e) => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, github: e.target.value }})}
            />
            <EditableItem 
              isEditing={isEditing} icon={<FaInstagram />} label="Instagram URL" 
              value={formData.socialLinks.instagram} displayValue={profile?.socialLinks?.instagram || "Not Provided"}
              onChange={(e) => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, instagram: e.target.value }})}
            />
            <EditableItem 
              isEditing={isEditing} icon={<FaGlobe />} label="Website URL" 
              value={formData.socialLinks.website} displayValue={profile?.socialLinks?.website || "Not Provided"}
              onChange={(e) => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, website: e.target.value }})}
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
              {formData.customPortfolioFields.map((field, i) => (
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
              {!(formData.customPortfolioFields?.length) && !isEditing && (
                <p className="text-gray-400 italic text-sm">No custom fields added.</p>
              )}
            </div>
          </div>
        </div>

      </div>

      <EmployeeQRCodeModal 
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        qrCodeUrl={profile?.qrCodeUrl}
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

const EditableItem = ({ isEditing, icon, label, value, displayValue, onChange }) => (
  <div className="flex items-center gap-4 group min-w-0">
    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      {isEditing ? (
        <input
          className="w-full font-bold text-gray-900 border-b border-purple-200 focus:border-purple-600 outline-none py-1"
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
