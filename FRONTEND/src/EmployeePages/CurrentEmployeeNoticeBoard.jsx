import React, { useEffect, useState } from "react";
import { getNotices } from "../api"; // Import the centralized API function

const NoticeList = () => {
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        // Use the imported getNotices function
        const data = await getNotices();
        setNotices(data);
      } catch (err) {
        console.error("Error fetching notices:", err);
      }
    };
    fetchNotices();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center">
      <h2 className="text-3xl font-bold text-blue-600 mb-6">📢 Latest Notices</h2>

      {notices.length === 0 ? (
        <p className="text-gray-600">No notices available yet.</p>
      ) : (
        <div className="grid gap-4 w-full max-w-3xl">
          {notices.map((notice) => (
            <div
              key={notice._id}
              className="bg-white p-5 rounded-xl shadow-md border-l-4 border-blue-600"
            >
              <h3 className="text-xl font-semibold text-gray-800">
                {notice.title}
              </h3>
              <p className="text-gray-600 mt-2">{notice.description}</p>
              <p className="text-sm text-gray-500 mt-2">
                📅 {new Date(notice.date).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NoticeList;