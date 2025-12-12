import React, { useState, useEffect, useCallback, useRef } from "react";
import { getAllNoticesForAdmin, addNotice, getEmployees, deleteNoticeById, updateNotice } from "../api";
import api from "../api"; // Direct API import for chat
import Swal from 'sweetalert2'; 
import { 
  FaEdit, FaTrash, FaPlus, FaTimes, FaSearch, FaCheck, 
  FaChevronDown, FaChevronUp, FaUserTag, FaEye, FaReply, FaPaperPlane, 
  FaBullhorn,
  FaUserFriends,
  FaUsers,
  FaPen
} from 'react-icons/fa';

// ✅ Import the function to check employee working status
import { getAttendanceByDateRange } from "../api";

const AdminNotices = () => {
  // --- STATE ---
  const initialFormState = { title: "", description: "", recipients: [], sendTo: 'ALL' };
  const [noticeData, setNoticeData] = useState(initialFormState);
  const [notices, setNotices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // ✅ Employee working status state
  const [employeeWorkingStatus, setEmployeeWorkingStatus] = useState({});
  
  // UI States
  const [editingNoticeId, setEditingNoticeId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Toggle for "Specific" recipients list
  const [expandedRecipientNoticeId, setExpandedRecipientNoticeId] = useState(null);

  // ✅ POPUP STATES
  const [viewedByNotice, setViewedByNotice] = useState(null); 
  const [repliesNotice, setRepliesNotice] = useState(null);
  
  // ✅ CHAT STATES
  const [selectedChatEmployeeId, setSelectedChatEmployeeId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // ✅ QUICK REPLIES
  const quickReplies = ["Ok", "Come To My Cabin", "Do It Fast", "Call me","Update me when done" ,];

  // ✅ REF FOR SCROLLING
  const messagesEndRef = useRef(null);

  // ✅ LOCAL STORAGE STATE (Stores the LAST READ MESSAGE ID)
  const [localReadMap, setLocalReadMap] = useState(() => {
    try {
      const stored = localStorage.getItem("adminReadRepliesV3");
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });

  // --- API CALLS ---
  const fetchNotices = useCallback(async () => {
    try {
      const data = await getAllNoticesForAdmin();
      const sortedData = data.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setNotices(prevNotices => {
        if (JSON.stringify(prevNotices) !== JSON.stringify(sortedData)) {
          return sortedData;
        }
        return prevNotices;
      });

      if (repliesNotice) {
        const updatedNotice = sortedData.find(n => n._id === repliesNotice._id);
        if (updatedNotice && JSON.stringify(updatedNotice.replies) !== JSON.stringify(repliesNotice.replies)) {
           setRepliesNotice(updatedNotice);
        }
      }

      if (viewedByNotice) {
        const updatedView = sortedData.find(n => n._id === viewedByNotice._id);
        if (updatedView && JSON.stringify(updatedView.readBy) !== JSON.stringify(viewedByNotice.readBy)) {
            setViewedByNotice(updatedView);
        }
      }

    } catch (error) {
      console.error("Error fetching notices:", error);
    }
  }, [repliesNotice, viewedByNotice]);

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await getEmployees();
      setEmployees(data.filter(emp => emp.isActive !== false));
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  }, []);

  // ✅ Fetch employee working status
  const fetchEmployeeWorkingStatus = useCallback(async () => {
    try {
      const todayISO = new Date().toISOString().split("T")[0];
      const attendanceData = await getAttendanceByDateRange(todayISO, todayISO);
      
      const statusMap = {};
      employees.forEach(emp => {
        statusMap[emp.employeeId] = 'offline';
      });
      
      attendanceData.forEach(record => {
        if (record.punchIn && !record.punchOut) {
          statusMap[record.employeeId] = 'online';
        } else if (record.punchIn && record.punchOut) {
          statusMap[record.employeeId] = 'offline';
        }
      });
      
      setEmployeeWorkingStatus(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(statusMap)) {
          return statusMap;
        }
        return prev;
      });
      
    } catch (error) {
      console.error("Error fetching employee working status:", error);
    }
  }, [employees]);

  // ✅ HELPER: Check if employee is working
  const isEmployeeWorking = useCallback((employeeId) => {
    return employeeWorkingStatus[employeeId] === 'online';
  }, [employeeWorkingStatus]);

  useEffect(() => {
    fetchNotices();
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    if (employees.length > 0) {
      fetchEmployeeWorkingStatus();
    }
  }, [employees, fetchEmployeeWorkingStatus]);

  // ✅ GLOBAL AUTO-REFRESH (POLLING)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotices();
      if (employees.length > 0) {
        fetchEmployeeWorkingStatus();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchNotices, fetchEmployeeWorkingStatus, employees.length]);

  // ✅ AUTO SCROLL TO BOTTOM
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [repliesNotice, selectedChatEmployeeId]);

  // --- HANDLERS ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setNoticeData(prev => ({ ...prev, [name]: value }));
  };

  const toggleEmployeeSelection = (employeeId) => {
    setNoticeData(prev => {
      const isSelected = prev.recipients.includes(employeeId);
      if (isSelected) {
        return { ...prev, recipients: prev.recipients.filter(id => id !== employeeId) };
      } else {
        return { ...prev, recipients: [...prev.recipients, employeeId] };
      }
    });
  };

  const toggleRecipientList = (noticeId) => {
    setExpandedRecipientNoticeId(prev => prev === noticeId ? null : noticeId);
  };

  const openModal = (notice = null) => {
    if (notice) {
      setEditingNoticeId(notice._id);
      const isSpecific = Array.isArray(notice.recipients) && notice.recipients.length > 0;
      setNoticeData({
        title: notice.title,
        description: notice.description,
        recipients: isSpecific ? notice.recipients : [],
        sendTo: isSpecific ? 'SPECIFIC' : 'ALL',
      });
    } else {
      setEditingNoticeId(null);
      setNoticeData(initialFormState);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingNoticeId(null);
    setNoticeData(initialFormState);
    setIsDropdownOpen(false);
    setSearchTerm("");
  };

  const handleDelete = async (noticeId) => {
    const result = await Swal.fire({
      title: 'Delete Notice?',
      text: "This action cannot be undone.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Delete'
    });

    if (result.isConfirmed) {
      try {
        await deleteNoticeById(noticeId);
        Swal.fire('Deleted', 'Notice removed successfully.', 'success');
        fetchNotices();
      } catch (error) {
        Swal.fire('Error', 'Failed to delete.', 'error');
      }
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingNoticeId) {
        const updatePayload = {
          title: noticeData.title,
          description: noticeData.description,
          recipients: noticeData.sendTo === 'SPECIFIC' ? noticeData.recipients : 'ALL'
        };
        await updateNotice(editingNoticeId, updatePayload);
        Swal.fire('Updated', 'Notice updated successfully.', 'success');
      } else {
        const payload = {
          title: noticeData.title,
          description: noticeData.description,
          recipients: noticeData.sendTo === 'SPECIFIC' ? noticeData.recipients : [],
        };
        await addNotice(payload);
        Swal.fire('Posted', 'Notice sent successfully.', 'success');
      }
      closeModal();
      fetchNotices();
    } catch (error) {
      Swal.fire('Error', 'Something went wrong.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ ADMIN REPLY HANDLER
  const handleAdminReply = async (manualText = null) => {
    const textToSend = manualText || replyText;
    
    if (!textToSend.trim() || !repliesNotice || !selectedChatEmployeeId) return;
    
    setSendingReply(true);
    try {
      // ✅ GROUP CHAT LOGIC (Broadcast)
      if (selectedChatEmployeeId === 'ALL_EMPLOYEES') {
        const uniqueEmployeeIds = [...new Set(repliesNotice.replies.map(r => r.employeeId?._id || r.employeeId))];
        
        const replyPromises = uniqueEmployeeIds.map(empId => {
            if (!empId) return Promise.resolve();
            return api.post(`/api/notices/${repliesNotice._id}/admin-reply`, { 
                message: textToSend,
                targetEmployeeId: empId
            });
        });

        await Promise.all(replyPromises);
      } 
      // ✅ INDIVIDUAL CHAT LOGIC
      else {
        await api.post(`/api/notices/${repliesNotice._id}/admin-reply`, { 
            message: textToSend,
            targetEmployeeId: selectedChatEmployeeId
        });
      }
      
      setReplyText("");
      fetchNotices();
    } catch (error) {
        console.error(error);
        Swal.fire("Error", "Failed to send reply", "error");
    } finally {
        setSendingReply(false);
    }
  };

  // ✅ DELETE MESSAGE HANDLER (Bulk Delete for Broadcasts)
  const handleDeleteReply = async (noticeId, replyId, sentBy, messageContent, messageTime) => {
    if(!window.confirm("Delete this message?")) return;

    try {
        // IF GROUP CHAT & ADMIN MESSAGE -> BULK DELETE (Delete for ALL employees)
        if (selectedChatEmployeeId === 'ALL_EMPLOYEES' && sentBy === 'Admin') {
            const targetTime = new Date(messageTime).getTime();

            // Find all instances of this broadcast
            const matches = repliesNotice.replies.filter(r => 
                r.sentBy === 'Admin' &&
                r.message === messageContent &&
                Math.abs(new Date(r.repliedAt).getTime() - targetTime) < 2000 
            );

            if (matches.length > 0) {
                 await Promise.all(matches.map(m => api.delete(`/api/notices/${noticeId}/reply/${m._id}`)));
            } else {
                 await api.delete(`/api/notices/${noticeId}/reply/${replyId}`);
            }
        } else {
            // NORMAL SINGLE DELETE
            await api.delete(`/api/notices/${noticeId}/reply/${replyId}`);
        }

        fetchNotices();
    } catch (error) {
        console.error(error);
        Swal.fire("Error", "Failed to delete message", "error");
    }
  };

  // ✅ HELPER: Group replies by Employee
  const getGroupedReplies = (notice) => {
    if (!notice.replies) return {};
    
    const groups = notice.replies.reduce((acc, reply) => {
        const empId = reply.employeeId?._id || reply.employeeId; 
        const empName = reply.employeeId?.name || "Unknown";
        
        if (empId) {
            if (!acc[empId]) {
                acc[empId] = { 
                  name: empName, 
                  messages: [], 
                  hasUnread: false,
                  employeeId: empId 
                };
            }
            acc[empId].messages.push(reply);
        }
        return acc;
    }, {});

    Object.keys(groups).forEach(empId => {
        const group = groups[empId];
        const lastEmployeeMsg = [...group.messages].reverse().find(m => m.sentBy === 'Employee');

        if (lastEmployeeMsg) {
            const storageKey = `${notice._id}_${empId}`;
            const storedLastId = localReadMap[storageKey];

            if (lastEmployeeMsg._id === storedLastId) {
                group.hasUnread = false;
            } else {
                group.hasUnread = group.messages.some(m => m.sentBy === 'Employee' && !m.isRead);
            }
        }
    });

    return groups;
  };

  // ✅ HANDLER: Select Chat & Mark as Read
  const handleChatSelection = async (empId) => {
    setSelectedChatEmployeeId(empId);

    // ✅ GROUP CHAT LOGIC
    if (empId === 'ALL_EMPLOYEES') {
        if (!repliesNotice.replies) return;

        const uniqueEmployeeIds = [...new Set(repliesNotice.replies.map(r => r.employeeId?._id || r.employeeId))];

        const updatedReplies = repliesNotice.replies.map(r => ({ ...r, isRead: true }));
        setRepliesNotice({ ...repliesNotice, replies: updatedReplies });

        const newLocalMap = { ...localReadMap };
        uniqueEmployeeIds.forEach(uid => {
             const empMsgs = repliesNotice.replies.filter(r => (r.employeeId?._id || r.employeeId) === uid && r.sentBy === 'Employee');
             if (empMsgs.length > 0) {
                 const lastId = empMsgs[empMsgs.length - 1]._id;
                 newLocalMap[`${repliesNotice._id}_${uid}`] = lastId;
             }
        });
        setLocalReadMap(newLocalMap);
        localStorage.setItem("adminReadRepliesV3", JSON.stringify(newLocalMap));

        try {
            await Promise.all(uniqueEmployeeIds.map(uid => 
                 api.put(`/api/notices/${repliesNotice._id}/reply/read/${uid}`)
            ));
            fetchNotices();
        } catch (error) {
            console.error("Failed to mark group as read", error);
        }
        return;
    }

    // ✅ INDIVIDUAL CHAT LOGIC
    let latestMsgId = null;
    if (repliesNotice && repliesNotice.replies) {
        const empMsgs = repliesNotice.replies.filter(r => (r.employeeId?._id || r.employeeId) === empId && r.sentBy === 'Employee');
        if (empMsgs.length > 0) {
            latestMsgId = empMsgs[empMsgs.length - 1]._id;
        }
    }

    if (repliesNotice && latestMsgId) {
        const storageKey = `${repliesNotice._id}_${empId}`;
        const updatedLocalMap = { ...localReadMap, [storageKey]: latestMsgId };
        setLocalReadMap(updatedLocalMap);
        localStorage.setItem("adminReadRepliesV3", JSON.stringify(updatedLocalMap));
    }

    if (repliesNotice) {
        const updatedReplies = repliesNotice.replies.map(r => {
            const rEmpId = r.employeeId?._id || r.employeeId;
            if (rEmpId === empId && r.sentBy === 'Employee') {
                return { ...r, isRead: true };
            }
            return r;
        });
        setRepliesNotice({ ...repliesNotice, replies: updatedReplies });
    }

    try {
        await api.put(`/api/notices/${repliesNotice._id}/reply/read/${empId}`);
        fetchNotices();
    } catch (error) {
        console.error("Failed to mark messages as read", error);
    }
  };

  const formatDateTime = (dateString) => {
    const d = new Date(dateString);
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };
  };

  const getRecipientNamesList = (recipientIds) => {
    if (!recipientIds || recipientIds.length === 0) return [];
    return recipientIds.map(id => {
      const emp = employees.find(e => e._id === id);
      return emp ? emp.name : 'Unknown User';
    });
  };

  const findEmployeeByEmployeeId = (employeeIdString) => {
    return employees.find(emp => emp.employeeId === employeeIdString);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      
      {/* HEADER */}
      <div className="relative bg-gradient-to-br from-emerald-50/50 to-white border-b border-emerald-100 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-xl flex items-center justify-center shadow-sm shadow-emerald-100">
                <FaBullhorn className="text-white text-xl" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full border-2 border-emerald-500"></div>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                Team <span className="text-emerald-600">Announcements</span>
              </h1>
              <p className="text-sm text-gray-600 font-medium mt-1">
                Share important updates and keep everyone informed
              </p>
            </div>
          </div>
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:shadow transition-all duration-200 border border-emerald-600/20"
          >
            <FaPlus className="text-sm" />
            <span>Create Announcement</span>
          </button>
        </div>
      </div>

      {/* NOTICE FEED */}
      <div className="max-w-4xl mx-auto px-4 mt-8 space-y-6">
        
        {notices.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-300 mx-4">
            <div className="text-5xl mb-4 grayscale opacity-30">📯</div>
            <p className="text-slate-400 text-lg font-medium">No active notices.</p>
            <p className="text-slate-300 text-sm">Create one to notify your team.</p>
          </div>
        ) : (
          notices.map((notice, index) => {
            const { date, time } = formatDateTime(notice.date);
            const isSpecific = notice.recipients && notice.recipients.length > 0 && notice.recipients !== 'ALL';
            const recipientNames = isSpecific ? getRecipientNamesList(notice.recipients) : [];
            const isExpandedRecipients = expandedRecipientNoticeId === notice._id;
            
            const viewCount = notice.readBy ? notice.readBy.length : 0;
            const groupedChats = getGroupedReplies(notice);
            const activeChatCount = Object.keys(groupedChats).length;

            const hasAnyUnread = Object.values(groupedChats).some(group => group.hasUnread);

            return (
              <div 
                key={notice._id}
                className="group relative bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-visible"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${
                  isSpecific ? 'bg-gradient-to-b from-purple-500 to-pink-500' : 'bg-gradient-to-b from-blue-500 to-cyan-500'
                }`}></div>

                <div className="p-6 pl-8">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {isSpecific ? (
                          <>
                            <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-purple-100">
                              🔒 Specific
                            </span>
                            <button 
                               onClick={() => toggleRecipientList(notice._id)}
                               className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-purple-600 transition-colors bg-slate-50 px-3 py-1 rounded-full cursor-pointer hover:bg-purple-50"
                            >
                              {recipientNames.length} Cands 
                              {isExpandedRecipients ? <FaChevronUp /> : <FaChevronDown />}
                            </button>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-100">
                            📢 Everyone
                          </span>
                        )}

                        <button 
                           onClick={() => setViewedByNotice(notice)}
                           className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-green-600 transition-colors bg-green-50 px-3 py-1 rounded-full border border-green-100 cursor-pointer"
                        >
                          <FaEye /> {viewCount}
                        </button>

                        <button 
                            onClick={() => { setRepliesNotice(notice); setSelectedChatEmployeeId(null); }}
                            className={`relative flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border cursor-pointer ${
                                activeChatCount > 0 
                                ? 'bg-orange-100 text-orange-700 border-orange-200' 
                                : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-orange-50 hover:text-orange-500'
                            }`}
                        >
                            <FaReply /> {activeChatCount} Chats
                            {hasAnyUnread && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                            )}
                        </button>
                      </div>
                      
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out origin-top ${isExpandedRecipients ? 'max-h-60 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 shadow-inner">
                           <div className="flex flex-wrap gap-2">
                              {recipientNames.map((name, i) => (
                                <span key={i} className="flex items-center gap-1 bg-white text-slate-700 text-xs font-semibold px-2 py-1 rounded border border-slate-200 shadow-sm">
                                  <FaUserTag className="text-slate-300" /> {name}
                                </span>
                              ))}
                           </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 self-start whitespace-nowrap">
                       <span>{date}</span>
                       <span className="h-3 w-px bg-slate-300"></span>
                       <span>{time}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-blue-700 transition-colors">
                      {notice.title}
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                      {notice.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-50 flex justify-end gap-2 opacity-100 sm:opacity-0 sm:translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                    <button 
                      onClick={() => openModal(notice)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm"
                    >
                      <FaEdit /> Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(notice._id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm"
                    >
                      <FaTrash /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* VIEWED BY MODAL */}
      {viewedByNotice && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewedByNotice(null)}></div>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95">
                <div className="px-6 py-4 border-b border-green-100 flex justify-between items-center bg-green-50">
                    <h3 className="font-bold text-green-800 flex items-center gap-2"><FaEye /> Viewed By ({viewedByNotice.readBy ? viewedByNotice.readBy.length : 0})</h3>
                    <button onClick={() => setViewedByNotice(null)} className="text-green-800 hover:bg-green-100 p-1 rounded"><FaTimes /></button>
                </div>
                <div className="p-4 overflow-y-auto bg-slate-50 custom-scrollbar">
                    {viewedByNotice.readBy && viewedByNotice.readBy.length > 0 ? (
                        <div className="space-y-2">
                            {[...viewedByNotice.readBy].reverse().map((record, index) => (
                                <div key={index} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-xs font-bold text-green-700">
                                            {record.employeeId?.name?.charAt(0) || "U"}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{record.employeeId?.name || "Unknown"}</p>
                                            <p className="text-[10px] text-slate-400">{record.employeeId?.employeeId || "N/A"}</p>
                                        </div>
                                    </div>
                                    <div className="text-right text-[10px] text-slate-400">
                                        <p>{formatDateTime(record.readAt).date}</p>
                                        <p>{formatDateTime(record.readAt).time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400 italic">No one has viewed this yet.</div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* CHAT MODAL */}
      {repliesNotice && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setRepliesNotice(null)}></div>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl relative z-10 overflow-hidden flex flex-col h-[85vh] animate-in fade-in zoom-in-95">
                
                {/* MODAL HEADER */}
                <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center shadow-md z-20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-700 rounded-lg">
                           <FaReply className="text-orange-400" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Notice Discussion</p>
                            <h2 className="text-lg font-bold truncate max-w-md">{repliesNotice.title}</h2>
                        </div>
                    </div>
                    <button onClick={() => setRepliesNotice(null)} className="text-slate-400 hover:text-white hover:bg-slate-700 p-2 rounded-full transition-colors">
                        <FaTimes size={20} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* SIDEBAR */}
                    <div className="w-1/3 bg-slate-50 border-r border-slate-200 flex flex-col">
                        <div className="p-4 border-b border-slate-200 font-bold text-slate-700 bg-slate-100 flex items-center justify-between">
                            <span>Inbox</span>
                            <span className="text-xs font-normal bg-slate-200 px-2 py-0.5 rounded-full text-slate-600">
                                {Object.keys(getGroupedReplies(repliesNotice)).length}
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {/* GROUP CHAT ENTRY */}
                            <div 
                                onClick={() => handleChatSelection('ALL_EMPLOYEES')}
                                className={`p-4 cursor-pointer border-b border-slate-100 flex items-center gap-3 transition-all duration-200 relative ${
                                    selectedChatEmployeeId === 'ALL_EMPLOYEES'
                                    ? 'bg-blue-50 border-l-4 border-l-blue-600 shadow-md z-10' 
                                    : 'bg-indigo-50/50 hover:bg-white hover:shadow-sm'
                                }`}
                            >
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                    <FaUsers />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-sm font-extrabold text-indigo-900">Group Chat (All)</p>
                                    </div>
                                    <p className="text-xs text-indigo-500 truncate">
                                        View all replies & Broadcast
                                    </p>
                                </div>
                            </div>

                            {/* INDIVIDUAL EMPLOYEES LIST */}
                            {Object.keys(getGroupedReplies(repliesNotice)).length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                                    <FaReply className="mb-2 text-2xl opacity-20"/>
                                    <p className="text-xs">No replies yet.</p>
                                </div>
                            ) : (
                                Object.entries(getGroupedReplies(repliesNotice)).map(([empId, data]) => {
                                    const lastMsg = data.messages[data.messages.length - 1];
                                    const employee = findEmployeeByEmployeeId(empId) || employees.find(e => e._id === empId);
                                    const isWorking = employee ? isEmployeeWorking(employee.employeeId) : false;
                                    
                                    return (
                                        <div 
                                            key={empId}
                                            onClick={() => handleChatSelection(empId)}
                                            className={`p-4 cursor-pointer border-b border-slate-100 flex items-center gap-3 transition-all duration-200 relative ${
                                                selectedChatEmployeeId === empId 
                                                ? 'bg-white border-l-4 border-l-blue-600 shadow-md z-10' 
                                                : 'hover:bg-white hover:shadow-sm'
                                            }`}
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold relative shadow-sm ${
                                                data.hasUnread ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-600'
                                            }`}>
                                                {data.name.charAt(0)}
                                                {data.hasUnread && (
                                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className={`text-sm truncate ${data.hasUnread ? 'font-extrabold text-slate-800' : 'font-bold text-slate-600'}`}>{data.name}</p>
                                                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${isWorking ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                            {isWorking ? 'ONLINE' : 'OFFLINE'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400">{formatDateTime(lastMsg.repliedAt).time}</span>
                                                </div>
                                                <p className={`text-xs truncate ${data.hasUnread ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                                                    {lastMsg.sentBy === 'Admin' ? <span className="text-blue-500 mr-1">You:</span> : ''}
                                                    {lastMsg.message}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* CHAT AREA */}
                    <div className="w-2/3 flex flex-col bg-[#f3f2f1] relative"> 
                        
                        {selectedChatEmployeeId ? (() => {
                            let displayMessages = [];
                            let chatTitle = "";
                            let isOnline = false;

                            if (selectedChatEmployeeId === 'ALL_EMPLOYEES') {
                                // Combine ALL messages sorted by date
                                const allMessages = [...(repliesNotice.replies || [])].sort((a, b) => new Date(a.repliedAt) - new Date(b.repliedAt));
                                
                                // ✅ SMART FILTERING LOGIC
                                // 1. Identify distinct employees involved in chat
                                const participants = new Set(allMessages.map(r => r.employeeId?._id || r.employeeId));
                                const isMultiUserChat = participants.size > 1;

                                // 2. Cluster Admin messages
                                let currentAdminCluster = [];
                                
                                const processAdminCluster = (cluster) => {
                                    if (!isMultiUserChat) {
                                        // If only 1 employee, Group View == Individual View. Show everything.
                                        displayMessages.push(cluster[0]);
                                        return;
                                    }
                                    
                                    // If Cluster > 1 -> Broadcast -> Show 1 (Deduplicated)
                                    // If Cluster == 1 -> Individual DM -> Hide (Filtered)
                                    if (cluster.length > 1) {
                                        displayMessages.push(cluster[0]);
                                    }
                                };

                                allMessages.forEach(msg => {
                                    if (msg.sentBy === 'Employee') {
                                        if (currentAdminCluster.length > 0) {
                                            processAdminCluster(currentAdminCluster);
                                            currentAdminCluster = [];
                                        }
                                        displayMessages.push(msg); // Always show employee messages
                                    } else {
                                        if (currentAdminCluster.length === 0) {
                                            currentAdminCluster.push(msg);
                                        } else {
                                            const last = currentAdminCluster[currentAdminCluster.length - 1];
                                            const timeDiff = new Date(msg.repliedAt) - new Date(last.repliedAt);
                                            // Check if same content & sent nearby
                                            if (msg.message === last.message && timeDiff < 2000) {
                                                currentAdminCluster.push(msg);
                                            } else {
                                                processAdminCluster(currentAdminCluster);
                                                currentAdminCluster = [msg];
                                            }
                                        }
                                    }
                                });
                                if (currentAdminCluster.length > 0) {
                                    processAdminCluster(currentAdminCluster);
                                }
                                
                                chatTitle = "Group Chat - All Employees";
                                isOnline = true;
                            } else {
                                const groupData = getGroupedReplies(repliesNotice)[selectedChatEmployeeId];
                                const employee = findEmployeeByEmployeeId(selectedChatEmployeeId) || employees.find(e => e._id === selectedChatEmployeeId);
                                isOnline = employee ? isEmployeeWorking(employee.employeeId) : false;
                                
                                if (groupData) {
                                    displayMessages = groupData.messages;
                                    chatTitle = groupData.name;
                                }
                            }
                            
                            return (
                                <>
                                    {/* Chat Header */}
                                    <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-white z-10 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-[#6264a7] rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                                {selectedChatEmployeeId === 'ALL_EMPLOYEES' ? <FaUsers /> : chatTitle.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-sm">{chatTitle}</h3>
                                                {selectedChatEmployeeId !== 'ALL_EMPLOYEES' && (
                                                    <span className={`text-[10px] font-bold flex items-center gap-1 ${isOnline ? 'text-green-600' : 'text-gray-500'}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                                                        {isOnline ? 'Online' : 'Offline'}
                                                    </span>
                                                )}
                                                {selectedChatEmployeeId === 'ALL_EMPLOYEES' && (
                                                    <span className="text-[10px] text-gray-500">Messages from everyone</span>
                                                )}
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedChatEmployeeId(null)} className="md:hidden text-slate-500"><FaTimes /></button>
                                    </div>
                                    
                                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3 z-10">
                                        
                                        {/* NOTICE DESCRIPTION */}
                                        <div className="flex w-full justify-center mb-6">
                                            <div className="max-w-[85%] bg-yellow-50 border border-yellow-200 p-4 rounded-lg shadow-sm text-center">
                                                <p className="text-[10px] font-bold text-yellow-600 uppercase mb-1 tracking-wider">Announcement Context</p>
                                                <p className="text-sm text-slate-800 font-medium italic">"{repliesNotice.description}"</p>
                                            </div>
                                        </div>

                                        {displayMessages.map((reply, i) => {
                                            const isAdmin = reply.sentBy === 'Admin';
                                            const empName = reply.employeeId?.name || "Unknown";
                                            const employeeData = employees.find(e => e._id === (reply.employeeId?._id || reply.employeeId));
                                            const empCode = employeeData?.employeeId || "N/A";

                                            return (
                                                <div key={i} className={`flex w-full group ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[70%] p-3 rounded-md relative shadow-sm text-sm ${
                                                        isAdmin 
                                                        ? 'bg-[#6264a7] text-white' 
                                                        : 'bg-white text-slate-800 border border-slate-200'
                                                    }`}>
                                                        {/* Show Sender Name in Group Chat Mode */}
                                                        {selectedChatEmployeeId === 'ALL_EMPLOYEES' && !isAdmin && (
                                                            <div className="text-[10px] font-bold text-orange-600 mb-1 border-b border-slate-100 pb-1 flex justify-between">
                                                                <span>{empName}</span>
                                                                <span className="text-slate-400 font-normal">{empCode}</span>
                                                            </div>
                                                        )}

                                                        <div className="flex justify-between items-start gap-4">
                                                            <p className="leading-relaxed break-words">{reply.message}</p>
                                                            <button 
                                                                onClick={() => handleDeleteReply(repliesNotice._id, reply._id, reply.sentBy, reply.message, reply.repliedAt)} 
                                                                className={`opacity-0 group-hover:opacity-100 transition-all ${
                                                                    isAdmin ? 'text-indigo-200 hover:text-white' : 'text-gray-400 hover:text-red-500'
                                                                }`}
                                                                title="Delete Message"
                                                            >
                                                                <FaTrash />
                                                            </button>
                                                        </div>
                                                        <div className={`text-[10px] text-right mt-1 ${isAdmin ? 'text-indigo-100' : 'text-slate-400'}`}>
                                                            {formatDateTime(reply.repliedAt).time}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* RECOMMENDED CHATS */}
                                    <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex gap-2 overflow-x-auto custom-scrollbar">
                                        {quickReplies.map((msg, idx) => (
                                            <div 
                                                key={idx} 
                                                className="group relative flex items-center justify-center bg-white border border-slate-200 text-slate-600 text-xs font-medium px-4 py-1.5 rounded-full shadow-sm cursor-pointer hover:bg-slate-100 transition-all min-w-[80px]"
                                            >
                                                <span className="group-hover:opacity-0 transition-opacity">{msg}</span>
                                                
                                                <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => setReplyText(msg)} 
                                                        className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1 rounded-full"
                                                        title="Edit"
                                                    >
                                                        <FaPen size={10} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleAdminReply(msg)} 
                                                        className="text-green-500 hover:text-green-700 bg-green-50 p-1 rounded-full"
                                                        title="Send Directly"
                                                    >
                                                        <FaPaperPlane size={10} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* INPUT AREA */}
                                    <div className="p-3 bg-white z-10 border-t border-slate-200">
                                        <div className={`flex items-center gap-2 bg-[#f3f2f1] p-1.5 pr-2 rounded-lg border shadow-sm focus-within:ring-2 transition-all ${
                                            selectedChatEmployeeId === 'ALL_EMPLOYEES' ? 'border-orange-300 focus-within:ring-orange-200' : 'border-slate-300 focus-within:ring-[#6264a7]/20'
                                        }`}>
                                            <input 
                                                className="flex-1 text-sm outline-none px-4 py-2 bg-transparent text-slate-700 placeholder-slate-500"
                                                placeholder={selectedChatEmployeeId === 'ALL_EMPLOYEES' ? "Broadcast reply to EVERYONE in this chat..." : "Type a new message..."}
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                onKeyDown={(e) => { if(e.key === 'Enter') handleAdminReply(); }}
                                            />
                                            <button 
                                                onClick={() => handleAdminReply()} 
                                                disabled={sendingReply || !replyText.trim()} 
                                                className={`${selectedChatEmployeeId === 'ALL_EMPLOYEES' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#6264a7] hover:bg-[#585a96]'} text-white w-9 h-9 rounded flex items-center justify-center transition disabled:opacity-50 shadow-sm transform active:scale-95`}
                                                title={selectedChatEmployeeId === 'ALL_EMPLOYEES' ? "Send to All" : "Send"}
                                            >
                                                {sendingReply ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <FaPaperPlane className="ml-0.5 text-xs" />}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            );
                        })() : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 z-10">
                                <div className="w-20 h-20 bg-slate-200/50 rounded-full flex items-center justify-center mb-4">
                                    <FaReply className="text-4xl opacity-40 text-slate-500" />
                                </div>
                                <h3 className="font-bold text-slate-500">Notice Chat</h3>
                                <p className="text-sm">Select an employee or the Group Chat</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* NEW NOTICE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md relative animate-in zoom-in-95 duration-300 overflow-hidden border border-gray-200/80">
            
            <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-inner">
                    <FaBullhorn  className="text-white" size={32} />
                    </div>
                    <div>
                    <h2 className="text-lg font-bold">
                        {editingNoticeId ? 'Edit Announcement' : 'New Announcement'}
                    </h2>
                    <p className="text-sm text-blue-100/90 mt-0.5">
                        {editingNoticeId ? 'Update announcement details' : 'Share updates with your team'}
                    </p>
                    </div>
                </div>
                <button 
                    onClick={closeModal} 
                    className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all duration-200"
                >
                    <FaTimes size={18} />
                </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto bg-gradient-to-b from-gray-50/50 to-white">
                <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 shadow-sm"></div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Title
                    </label>
                </div>
                <input 
                    type="text"
                    name="title"
                    placeholder="Enter announcement title..."
                    value={noticeData.title}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 placeholder-gray-500 text-gray-900 transition-all duration-200 bg-white shadow-sm"
                    required
                    autoFocus
                />
                </div>

                <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-sm"></div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Description
                    </label>
                </div>
                <textarea 
                    name="description"
                    placeholder="Write your announcement details here..."
                    value={noticeData.description}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 placeholder-gray-500 text-gray-900 transition-all duration-200 bg-white shadow-sm"
                    required
                />
                </div>

                <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-500 to-violet-400 shadow-sm"></div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Audience
                    </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button 
                    type="button" 
                    onClick={() => setNoticeData(prev => ({ ...prev, sendTo: 'ALL' }))}
                    className={`p-3 rounded-lg border transition-all duration-200 text-left group ${
                        noticeData.sendTo === 'ALL' 
                        ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 shadow-sm' 
                        : 'bg-white border-gray-300 hover:border-blue-300 hover:shadow-sm'
                    }`}
                    >
                    <div className="flex items-center gap-2 mb-1">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${
                        noticeData.sendTo === 'ALL' 
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-sm' 
                            : 'bg-gray-200 group-hover:bg-gray-300'
                        }`}>
                        {noticeData.sendTo === 'ALL' && <FaCheck size={10} className="text-white" />}
                        </div>
                        <span className={`text-sm font-semibold ${
                        noticeData.sendTo === 'ALL' ? 'text-blue-700' : 'text-gray-700'
                        }`}>
                        All Employees
                        </span>
                    </div>
                    <p className="text-xs text-gray-600">Broadcast to everyone</p>
                    </button>
                    
                    <button 
                    type="button" 
                    onClick={() => setNoticeData(prev => ({ ...prev, sendTo: 'SPECIFIC' }))}
                    className={`p-3 rounded-lg border transition-all duration-200 text-left group ${
                        noticeData.sendTo === 'SPECIFIC' 
                        ? 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-300 shadow-sm' 
                        : 'bg-white border-gray-300 hover:border-purple-300 hover:shadow-sm'
                    }`}
                    >
                    <div className="flex items-center gap-2 mb-1">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${
                        noticeData.sendTo === 'SPECIFIC' 
                            ? 'bg-gradient-to-r from-purple-500 to-purple-600 shadow-sm' 
                            : 'bg-gray-200 group-hover:bg-gray-300'
                        }`}>
                        {noticeData.sendTo === 'SPECIFIC' && <FaCheck size={10} className="text-white" />}
                        </div>
                        <span className={`text-sm font-semibold ${
                        noticeData.sendTo === 'SPECIFIC' ? 'text-purple-700' : 'text-gray-700'
                        }`}>
                        Specific
                        </span>
                    </div>
                    <p className="text-xs text-gray-600">Select individuals</p>
                    </button>
                </div>
                </div>

                {noticeData.sendTo === 'SPECIFIC' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 shadow-sm"></div>
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Select Employees
                        </label>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 bg-gradient-to-r from-blue-50 to-blue-100 px-2.5 py-1 rounded-full border border-blue-200">
                        {noticeData.recipients.length} selected
                    </span>
                    </div>
                    
                    <div className="relative">
                    <div 
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg flex justify-between items-center cursor-pointer text-sm text-gray-700 hover:border-blue-400 transition-all duration-200 shadow-sm group"
                    >
                        <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-50 rounded-md group-hover:bg-blue-100 transition-colors">
                            <FaUserFriends className="text-blue-500 text-sm" />
                        </div>
                        <span className={noticeData.recipients.length === 0 ? "text-gray-500" : "text-gray-800 font-medium"}>
                            {noticeData.recipients.length === 0 
                            ? "Select team members..." 
                            : `${noticeData.recipients.length} employee${noticeData.recipients.length !== 1 ? 's' : ''} selected`
                            }
                        </span>
                        </div>
                        <FaChevronDown size={12} className={`text-gray-400 transition-all duration-300 ${isDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
                    </div>
                    
                    {isDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-30 max-h-56 overflow-y-auto animate-in fade-in slide-in-from-top-3 duration-200">
                        <div className="sticky top-0 bg-white p-2 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                            <div className="relative">
                            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs" />
                            <input 
                                type="text" 
                                placeholder="Search employees..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-xs outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all bg-white"
                                autoFocus
                            />
                            </div>
                        </div>
                        
                        <div className="p-1 max-h-44 overflow-y-auto">
                            {employees
                            .filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
                            .map(emp => (
                                <div 
                                key={emp._id} 
                                onClick={() => toggleEmployeeSelection(emp._id)} 
                                className="flex items-center gap-3 p-2 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 cursor-pointer rounded text-xs transition-all duration-150 group/item"
                                >
                                <div className={`w-4 h-4 border-2 rounded-md flex items-center justify-center transition-all duration-150 ${
                                    noticeData.recipients.includes(emp._id) 
                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-600 shadow-sm' 
                                    : 'border-gray-400 group-hover/item:border-blue-400'
                                }`}>
                                    {noticeData.recipients.includes(emp._id) && <FaCheck className="text-white text-[8px]" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className={`font-medium truncate ${
                                    noticeData.recipients.includes(emp._id) ? 'text-blue-700' : 'text-gray-800'
                                    }`}>
                                    {emp.name}
                                    </span>
                                    <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                        noticeData.recipients.includes(emp._id) 
                                        ? 'bg-blue-100 text-blue-600' 
                                        : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {emp.employeeId}
                                    </span>
                                    </div>
                                </div>
                                </div>
                            ))
                            }
                            
                            {employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                            <div className="text-center py-6 text-gray-400">
                                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                <FaSearch className="text-gray-300 text-lg" />
                                </div>
                                <p className="text-xs font-medium">No employees found</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">Try a different search term</p>
                            </div>
                            )}
                        </div>
                        </div>
                    )}
                    </div>
                    
                    {noticeData.recipients.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {noticeData.recipients.slice(0, 3).map(id => {
                        const emp = employees.find(e => e._id === id);
                        if (!emp) return null;
                        return (
                            <span 
                            key={id} 
                            className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 font-medium shadow-sm"
                            >
                            <FaUserTag className="text-blue-500 text-[10px]" />
                            {emp.name.split(' ')[0]}
                            </span>
                        );
                        })}
                        {noticeData.recipients.length > 3 && (
                        <span className="inline-flex items-center bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 font-medium shadow-sm">
                            +{noticeData.recipients.length - 3} more
                        </span>
                        )}
                    </div>
                    )}
                </div>
                )}

                <div className="flex gap-2 pt-4 mt-2 border-t border-gray-200">
                <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-lg transition-all duration-200 border border-gray-300 shadow-sm"
                >
                    Cancel
                </button>
                <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                    {isSubmitting ? (
                    <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{editingNoticeId ? 'Updating...' : 'Posting...'}</span>
                    </>
                    ) : (
                    <>
                        <div className="p-0.5 bg-white/20 rounded">
                        <FaPaperPlane className="text-xs" />
                        </div>
                        <span>{editingNoticeId ? 'Update Announcement' : 'Publish Announcement'}</span>
                    </>
                    )}
                </button>
                </div>
            </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotices;