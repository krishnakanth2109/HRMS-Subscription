// --- START OF FILE AdminProfile.jsx ---

import { useContext, useState, useEffect } from "react";
// ✅ Step 1: Import AuthContext instead of AdminContext
import { AuthContext } from "../context/AuthContext";
// ✅ Step 2: Import the API function for updating the profile
import { updateUserProfile } from "../api";
import { FaUserCircle, FaPhone, FaBriefcase } from "react-icons/fa";

const TABS = [
  { key: "personal", label: "Personal Info", icon: <FaUserCircle /> },
  { key: "contact", label: "Contact Info", icon: <FaPhone /> },
  { key: "job", label: "Job Details", icon: <FaBriefcase /> },
];

const AdminProfile = () => {
  // ✅ Step 3: Use AuthContext to get the dynamic user and the updateUser function
  const { user, updateUser } = useContext(AuthContext);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ ...user });
  const [activeTab, setActiveTab] = useState("personal");

  // Syncs the form data if the user object changes (e.g., after login)
  useEffect(() => {
    setFormData({ ...user });
  }, [user]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    try {
      // ✅ Step 4: Call the API to save changes
      const { data } = await updateUserProfile(formData);
      // Update the global context and sessionStorage with the response from the server
      updateUser(data.user);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile:", error);
      alert("Could not save changes. Please try again.");
    }
  };

  const handleCancel = () => {
    setFormData(user); // Reset to original data from context
    setIsEditing(false);
  };

  // Show a loading state if the user data hasn't loaded yet
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
              <p><strong>ID:</strong> {user._id}</p> {/* ✅ Use dynamic data */}
              <p><strong>Name:</strong> {user.name}</p> {/* ✅ Use dynamic data */}
            </div>
          )}
          {activeTab === "contact" && (
            <div className="space-y-2">
              <p><strong>Email:</strong> {user.email}</p> {/* ✅ Use dynamic data */}
              <p><strong>Phone:</strong> {user.phone || 'N/A'}</p> {/* ✅ Use dynamic data */}
            </div>
          )}
          {activeTab === "job" && (
            <div className="space-y-2">
              <p><strong>Role:</strong> {user.role}</p> {/* ✅ Use dynamic data */}
              <p><strong>Department:</strong> {user.department}</p> {/* ✅ Use dynamic data */}
            </div>
          )}
          <button onClick={() => setIsEditing(true)} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 shadow">
            Edit Profile
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
            {/* The editing form JSX is correct and will work with the new state */}
            {activeTab === "personal" && <label>Name: <input name="name" value={formData.name} onChange={handleChange} /></label>}
            {activeTab === "contact" && (
                <>
                    <label>Email: <input name="email" value={formData.email} onChange={handleChange} /></label>
                    <label>Phone: <input name="phone" value={formData.phone} onChange={handleChange} /></label>
                </>
            )}
            {activeTab === "job" && (
                <>
                    <label>Role: <input name="role" value={formData.role} onChange={handleChange} /></label>
                    <label>Department: <input name="department" value={formData.department} onChange={handleChange} /></label>
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