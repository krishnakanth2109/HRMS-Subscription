import React, { useState, useEffect, useContext } from "react";
import api from "../api"; // Updated path based on your code
import { AuthContext } from "../context/AuthContext";
import { 
  FaUser, FaEnvelope, FaPhone, FaBuilding, 
  FaCrown, FaCalendarAlt, FaCheckCircle, FaTimesCircle,
  FaClock, FaCreditCard, FaEdit, FaSave, FaTimes
} from "react-icons/fa";

const AdminProfile = () => {
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
    <div className="min-h-screen bg-[#f3f4f9] p-4 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* HEADER SECTION */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-4xl font-bold shadow-lg shrink-0">
            {profile?.name?.charAt(0)}
          </div>
          <div className="text-center md:text-left flex-1">
            {isEditing ? (
              <input 
                className="text-3xl font-bold text-gray-900 border-b-2 border-purple-200 outline-none focus:border-purple-600 bg-transparent w-full md:w-auto"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            ) : (
              <h1 className="text-3xl font-bold text-gray-900">{profile?.name}</h1>
            )}
            <p className="text-gray-500 font-medium uppercase tracking-widest text-[10px] mt-1">
              {profile?.role} • {profile?.department}
            </p>
          </div>

          <div className="flex gap-2">
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-purple-700 transition-all shadow-lg shadow-purple-200"
              >
                <FaEdit size={14}/> Edit Profile
              </button>
            ) : (
              <>
                <button 
                  onClick={handleUpdate}
                  disabled={updateLoading}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  <FaSave size={14}/> {updateLoading ? "Saving..." : "Save Changes"}
                </button>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-2 bg-gray-100 text-gray-600 px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all"
                >
                  <FaTimes size={14}/> Cancel
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* BASIC INFORMATION CARD */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
              <h3 className="text-gray-900 font-bold mb-6 flex items-center gap-2">
                <FaUser className="text-purple-500 text-sm" /> Basic Information
              </h3>
              
              <div className="space-y-6">
                <InfoItem icon={<FaEnvelope />} label="Email Address (Locked)" value={profile?.email} />
                
                {/* Editable Phone */}
                <div className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                    <FaPhone />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Phone Number</p>
                    {isEditing ? (
                      <input 
                        className="w-full font-bold text-gray-900 border-b border-purple-200 focus:border-purple-600 outline-none py-1"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      />
                    ) : (
                      <p className="text-gray-900 font-bold">{profile?.phone || "Not Provided"}</p>
                    )}
                  </div>
                </div>

                {/* Editable Department */}
                <div className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                    <FaBuilding />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Department</p>
                    {isEditing ? (
                      <input 
                        className="w-full font-bold text-gray-900 border-b border-purple-200 focus:border-purple-600 outline-none py-1"
                        value={formData.department}
                        onChange={(e) => setFormData({...formData, department: e.target.value})}
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

          {/* SUBSCRIPTION DETAILS (Non-Editable) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 relative overflow-hidden h-full">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <FaCrown size={120} />
              </div>

              <h3 className="text-gray-900 font-bold mb-8 flex items-center gap-2">
                <FaCreditCard className="text-purple-500 text-sm" /> Subscription Overview
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Current Plan</p>
                  <h4 className="text-2xl font-black text-purple-600 capitalize">{profile?.plan}</h4>
                  <div className="mt-4 flex items-center gap-2 text-sm font-bold">
                    {profile?.isPaid ? (
                      <><FaCheckCircle className="text-emerald-500" /> <span className="text-emerald-600 uppercase">Active</span></>
                    ) : (
                      <><FaTimesCircle className="text-amber-500" /> <span className="text-amber-600 uppercase">Trial / Unpaid</span></>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Account Status</p>
                  <h4 className={`text-2xl font-black ${profile?.loginEnabled ? "text-emerald-600" : "text-red-600"}`}>
                    {profile?.loginEnabled ? "Fully Accessible" : "Access Blocked"}
                  </h4>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-dashed border-gray-200">
                <div className="flex items-start gap-4">
                  <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600"><FaCalendarAlt /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Activated On</p>
                    <p className="text-gray-900 font-bold">{formatDate(profile?.planActivatedAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-red-50 p-3 rounded-2xl text-red-600"><FaCalendarAlt /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Expires On</p>
                    <p className="text-gray-900 font-bold">{formatDate(profile?.planExpiresAt)}</p>
                  </div>
                </div>
              </div>
            </div>
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

export default AdminProfile;