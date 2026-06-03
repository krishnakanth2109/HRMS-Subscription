import React, { useState, useEffect } from "react";
import api from "../../api";
import {
  FaUser, FaEnvelope, FaPhone, FaBuilding,
  FaCalendarAlt, FaEdit, FaSave, FaTimes, FaClock
} from "react-icons/fa";

const SupportAdminProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    department: ""
  });

  const fetchProfile = async () => {
    try {
      const res = await api.get("/api/admin/profile");
      setProfile(res.data);
      // Initialize form data with fetched values
      setFormData({
        name: res.data.name || "",
        phone: res.data.phone || "",
        department: res.data.department || ""
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
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-4xl font-bold shadow-lg shrink-0">
            {profile?.name?.charAt(0)}
          </div>
          <div className="text-center md:text-left flex-1 min-w-0">
            {isEditing ? (
              <input
                className="text-2xl sm:text-3xl font-bold text-gray-900 border-b-2 border-purple-200 outline-none focus:border-purple-600 bg-transparent w-full max-w-full"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            ) : (
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{profile?.name}</h1>
            )}
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

      </div>
    </div>
  );
};

const InfoItem = ({ icon, label, value }) => (
  <div className="flex items-center gap-4 group">
    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
      <p className="text-gray-900 font-bold truncate">{value}</p>
    </div>
  </div>
);

export default SupportAdminProfile;
