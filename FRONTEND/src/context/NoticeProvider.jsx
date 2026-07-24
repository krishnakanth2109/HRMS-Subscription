import React, { useState } from "react";
import { NoticeContext } from "./NoticeContext";

const initialNotices = [
  {
    id: 1,
    title: "Project Alpha Launch Date",
    message:
      "The launch date for Project Alpha has been moved to September 15th. All teams must finalize their deliverables by EOD September 10th.",
    author: "Admin",
    date: "2025-08-11",
  },
  {
    id: 2,
    title: "Employee Wellness Program",
    message:
      "A new wellness program is being introduced starting October. Details will be shared in a company-wide email next week.",
    author: "Admin",
    date: "2025-08-08",
  },
];

export const NoticeProvider = ({ children }) => {
  const [notices, setNotices] = useState(initialNotices);

  // Add a new notice
  const addNotice = (title, message, author = "Admin") => {
    const newNotice = {
      id: notices.length > 0 ? Math.max(...notices.map(n => n.id)) + 1 : 1,
      title,
      message,
      author,
      date: new Date().toISOString().split("T")[0],
    };
    setNotices([newNotice, ...notices]);
  };

  // Update an existing notice
  const updateNotice = (id, newTitle, newMessage) => {
    setNotices(
      notices.map(notice =>
        notice.id === id ? { ...notice, title: newTitle, message: newMessage } : notice
      )
    );
  };

  // Delete a notice
  const deleteNotice = (id) => {
    setNotices(notices.filter(notice => notice.id !== id));
  };

  return (
    <NoticeContext.Provider value={{ notices, addNotice, updateNotice, deleteNotice }}>
      {children}
    </NoticeContext.Provider>
  );
};
