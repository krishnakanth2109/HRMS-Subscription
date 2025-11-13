// --- START OF FILE AdminProfile.jsx ---

import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { updateUserProfile } from "../api";
import { FaUserCircle, FaPhone, FaBriefcase } from "react-icons/fa";

const TABS = [
  { key: "personal", label: "Personal Info", icon: <FaUserCircle /> },
  { key: "contact", label: "Contact Info", icon: <FaPhone /> },
  { key: "job", label: "Job Details", icon: <FaBriefcase /> },
];

const AdminProfile = () => {
  const { user, updateUser } = useContext(AuthContext);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ ...user });
  const [activeTab, setActiveTab] = useState("personal");

  // Syncs the form data if the user object from context changes
  useEffect(() => {
    setFormData({ ...user });
  }, [user]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    try {
      const { data } = await updateUserProfile(formData);
      // Update the global context and sessionStorage with the fresh data from the server
      updateUser(data.user);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile:", error);
      alert("Could not save changes. Please try again.");
    }
  };

  const handleCancel = () => {
    setFormData(user); // Reset to original data from the context
    setIsEditing(false);
  };

  if (!user) return <div className="p-6 text-center">Loading profile...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-2xl shadow-xl">
      <div className="flex flex-col items-center mb-6">
        <FaUserCircle className="text-6xl text-blue-600 mb-2 drop-shadow" />
        <h2 className="text-3xl font-bold text-blue-700 mb-2">Admin Profile</h2>
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`flex items-center gap-1 px-4 py-2 rounded-lg font-semibold transition-all duration-150 focus:outline-none text-base shadow-sm border-b-2 ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white border-blue-700"
                  : "bg-gray-100 text-gray-700 border-transparent hover:bg-blue-50"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {!isEditing ? (
        <div className="space-y-4 text-gray-800">
          {activeTab === "personal" && (
            <div className="space-y-2">
              <p><strong>ID:</strong> {user._id}</p>
              <p><strong>Name:</strong> {user.name}</p>
            </div>
          )}
          {activeTab === "contact" && (
            <div className="space-y-2">
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Phone:</strong> {user.phone || 'N/A'}</p>
            </div>
          )}
          {activeTab === "job" && (
            <div className="space-y-2">
              <p><strong>Role:</strong> {user.role}</p>
              <p><strong>Department:</strong> {user.department}</p>
            </div>
          )}
          <button onClick={() => setIsEditing(true)} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 shadow">
            Edit Profile
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
            {activeTab === "personal" && (
              <label className="flex flex-col font-semibold">
                Name:
                <input name="name" value={formData.name || ''} onChange={handleChange} className="w-full border px-3 py-2 rounded mt-1 font-normal" />
              </label>
            )}
            {activeTab === "contact" && (
              <>
                <label className="flex flex-col font-semibold">
                  Email:
                  <input name="email" value={formData.email || ''} onChange={handleChange} className="w-full border px-3 py-2 rounded mt-1 font-normal" />
                </label>
                <label className="flex flex-col font-semibold">
                  Phone:
                  <input name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full border px-3 py-2 rounded mt-1 font-normal" />
                </label>
              </>
            )}
            {activeTab === "job" && (
              <>
                <label className="flex flex-col font-semibold">
                  Role:
                  <input name="role" value={formData.role || ''} onChange={handleChange} className="w-full border px-3 py-2 rounded mt-1 font-normal" />
                </label>
                <label className="flex flex-col font-semibold">
                  Department:
                  <input name="department" value={formData.department || ''} onChange={handleChange} className="w-full border px-3 py-2 rounded mt-1 font-normal" />
                </label>
              </>
            )}
          </div>
          <div className="flex gap-4 mt-2">
            <button onClick={handleSave} className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 shadow">Save</button>
            <button onClick={handleCancel} className="bg-gray-300 px-4 py-2 rounded-lg font-semibold hover:bg-gray-400 shadow">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProfile;