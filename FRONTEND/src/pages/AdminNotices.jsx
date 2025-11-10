// --- START OF FILE AdminNotices.jsx ---

import React, { useState, useEffect, useCallback } from "react";
// Import the centralized API functions
import { getNotices, addNotice } from "../api.js";

const NoticeForm = () => {
  const [noticeData, setNoticeData] = useState({
    title: "",
    description: "",
    date: "",
  });
  const [message, setMessage] = useState("");
  const [notices, setNotices] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all notices using the centralized API
  const fetchNotices = useCallback(async () => {
    try {
      const data = await getNotices();
      setNotices(data);
    } catch (error) {
      console.error("Error fetching notices:", error);
      setMessage("❌ Failed to load notices.");
    }
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  // Handle input changes
  const handleChange = (e) => {
    setNoticeData({ ...noticeData, [e.target.name]: e.target.value });
  };

  // Handle form submission using the centralized API
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addNotice(noticeData);
      setMessage("✅ Notice posted successfully!");
      setNoticeData({ title: "", description: "", date: "" });
      fetchNotices(); // Refresh notices after posting
    } catch (error) {
      console.error(error);
      setMessage("❌ Failed to post notice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dynamic color based on message type
  const getMessageColor = () => {
    if (message.includes("✅")) return "text-green-600 bg-green-50 border-green-200";
    if (message.includes("❌")) return "text-red-600 bg-red-50 border-red-200";
    return "text-blue-600 bg-blue-50 border-blue-200";
  };

  // Dynamic border colors for notice cards
  const getNoticeBorderColor = (index) => {
    const colors = [
      "border-blue-500", "border-green-500", "border-purple-500", 
      "border-orange-500", "border-pink-500", "border-indigo-500"
    ];
    return colors[index % colors.length];
  };

  // Dynamic background for notice cards
  const getNoticeBackground = (index) => {
    const backgrounds = [
      "bg-gradient-to-br from-blue-50 to-white",
      "bg-gradient-to-br from-green-50 to-white", 
      "bg-gradient-to-br from-purple-50 to-white",
      "bg-gradient-to-br from-orange-50 to-white",
      "bg-gradient-to-br from-pink-50 to-white"
    ];
    return backgrounds[index % backgrounds.length];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-10 px-4 flex flex-col items-center">
      {/* Form Section */}
      <div className="bg-white shadow-2xl rounded-3xl p-8 w-full max-w-lg mb-12 transform hover:scale-[1.01] transition-all duration-300 border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📢</span>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Post a New Notice
          </h2>
          <p className="text-gray-500 mt-2">Share important updates with your community</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block font-semibold text-gray-700 mb-2 flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              Notice Title
            </label>
            <input
              type="text"
              name="title"
              value={noticeData.title}
              onChange={handleChange}
              required
              placeholder="Enter a compelling title..."
              className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all duration-300 bg-gray-50 hover:bg-white"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-semibold text-gray-700 mb-2 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Description
            </label>
            <textarea
              name="description"
              value={noticeData.description}
              onChange={handleChange}
              required
              rows="4"
              placeholder="Provide detailed information..."
              className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-100 outline-none transition-all duration-300 resize-none bg-gray-50 hover:bg-white"
            ></textarea>
          </div>

          <div className="space-y-2">
            <label className="block font-semibold text-gray-700 mb-2 flex items-center">
              <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
              Date
            </label>
            <input
              type="date"
              name="date"
              value={noticeData.date}
              onChange={handleChange}
              required
              className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all duration-300 bg-gray-50 hover:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 rounded-xl font-semibold text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] ${
              isSubmitting 
                ? "bg-gray-400 cursor-not-allowed" 
                : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl"
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <div className="w-5 h-5 border-t-2 border-white border-solid rounded-full animate-spin mr-2"></div>
                Posting...
              </span>
            ) : (
              "📝 Post Notice"
            )}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-4 rounded-xl border-2 text-center font-medium transition-all duration-300 animate-pulse ${getMessageColor()}`}>
            {message}
          </div>
        )}
      </div>

      {/* Notice Display Section */}
      <div className="w-full max-w-6xl">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📄</span>
          </div>
          <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            All Posted Notices
          </h3>
          <p className="text-gray-500 mt-2">Stay updated with recent announcements</p>
        </div>

        {notices.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl shadow-lg border-2 border-dashed border-gray-300">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📋</span>
            </div>
            <p className="text-gray-500 text-lg">No notices posted yet.</p>
            <p className="text-gray-400 mt-1">Be the first to share an update!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {notices.map((notice, index) => (
              <div
                key={notice._id}
                className={`${getNoticeBackground(index)} p-6 rounded-2xl shadow-lg border-t-4 ${getNoticeBorderColor(index)} transform hover:scale-[1.02] hover:shadow-xl transition-all duration-300 group`}
              >
                <div className="flex items-start justify-between mb-4">
                  <h4 className="text-xl font-bold text-gray-800 group-hover:text-gray-900 transition-colors line-clamp-2">
                    {notice.title}
                  </h4>
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                    <span className="text-sm">📌</span>
                  </div>
                </div>
                
                <p className="text-gray-600 mb-4 line-clamp-3 group-hover:text-gray-700 transition-colors">
                  {notice.description}
                </p>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-500 flex items-center">
                    <span className="w-2 h-2 bg-current rounded-full mr-2"></span>
                    📅 {new Date(notice.date).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NoticeForm;