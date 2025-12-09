// --- START OF FILE RequestPunchOut.jsx ---

import React, { useState, useEffect, useContext } from "react";
import api from "../api"; 
import { FaClock, FaCalendarAlt, FaPaperPlane } from "react-icons/fa";
import { AuthContext } from "../context/AuthContext"; // 1. Import AuthContext

const RequestPunchOut = () => {
  // 2. Get user from Context (Preferred method)
  const { user: authUser } = useContext(AuthContext);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    time: "",
    reason: ""
  });
  const [loading, setLoading] = useState(false);
  
  // Local state to hold the effective user data
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // 3. Logic to reliably set the user
    if (authUser) {
      setCurrentUser(authUser);
    } else {
      // Fallback: Try localStorage if context is empty (e.g., on hard refresh)
      const storedUser = localStorage.getItem('user'); // Ensure key matches your login logic
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setCurrentUser(parsedUser);
        } catch (e) {
          console.error("Error parsing user from local storage", e);
        }
      }
    }
  }, [authUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 4. Validation: Check if user details exist before sending
    if (!currentUser || !currentUser.employeeId) {
      alert("User details not found. Please log in again.");
      console.error("User Object is missing:", currentUser);
      return;
    }

    if (!formData.time || !formData.reason) {
      alert("Please fill all fields");
      return;
    }
    
    // Combine Date and Time
    const combinedDateTime = new Date(`${formData.date}T${formData.time}`);

    setLoading(true);
    try {
      // 5. Construct Payload using currentUser
      const payload = {
        employeeId: currentUser.employeeId, // Ensure this matches your DB field
        employeeName: currentUser.name || currentUser.employeeName || "Unknown",
        originalDate: formData.date,
        requestedPunchOut: combinedDateTime.toISOString(),
        reason: formData.reason
      };

      console.log("Sending Payload:", payload); // Debugging

      await api.post('/api/punchoutreq/create', payload);
      
      alert("Request sent successfully!");
      setFormData({ ...formData, time: "", reason: "" });
    } catch (error) {
      console.error("API Error:", error);
      const errMsg = error.response?.data?.message || error.message;
      alert("Error sending request: " + errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <FaPaperPlane className="text-blue-600"/> Request Missed Punch Out
        </h2>
        
        {/* Optional: Show who is requesting */}
        {currentUser && (
          <div className="mb-4 text-sm text-gray-500 bg-gray-50 p-2 rounded">
            Requesting as: <span className="font-bold text-gray-700">{currentUser.name}</span> ({currentUser.employeeId})
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Select Shift Date</label>
            <div className="flex items-center border border-slate-300 rounded-lg px-3 py-2 bg-slate-50">
              <FaCalendarAlt className="text-slate-400 mr-2"/>
              <input 
                type="date" 
                value={formData.date}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="bg-transparent outline-none w-full text-slate-700"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Actual Punch Out Time</label>
            <div className="flex items-center border border-slate-300 rounded-lg px-3 py-2 bg-slate-50">
              <FaClock className="text-slate-400 mr-2"/>
              <input 
                type="time" 
                value={formData.time}
                onChange={(e) => setFormData({...formData, time: e.target.value})}
                className="bg-transparent outline-none w-full text-slate-700"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Reason</label>
            <textarea 
              value={formData.reason}
              onChange={(e) => setFormData({...formData, reason: e.target.value})}
              placeholder="Why didn't you punch out? (e.g. Forgot, Network Issue)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 h-24 resize-none"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || !currentUser}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50"
          >
            {loading ? "Sending Request..." : "Submit Request"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RequestPunchOut;