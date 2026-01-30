import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
import { AuthContext } from "../context/AuthContext"; 
import api, { sendReplyWithImage, getEmployees, addNotice } from "../api"; 
import { 
  FaPaperPlane, FaTrash, FaComments, FaTimes, FaRobot, 
  FaPen, FaPaperclip, FaVideo, FaClock, FaPlus, FaBullhorn, 
  FaCheck, FaSearch, FaUserTag, FaChevronDown, FaUserFriends,
  FaLayerGroup, FaUsers, FaEye, FaChevronUp, FaCommentDots, FaPhone, FaEllipsisH, FaEllipsisV,
  FaCheckDouble
} from "react-icons/fa";

const NoticeList = () => {
  // --- EXISTING NOTICE STATES ---
  const [notices, setNotices] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [employees, setEmployees] = useState([]); 
  const [groups, setGroups] = useState([]); 
  
  const [previewGroup, setPreviewGroup] = useState(null); 
  const [expandedNoticeId, setExpandedNoticeId] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const { user } = useContext(AuthContext);
  const currentUserId = user?._id || user?.id;

  // --- POST/EDIT NOTICE STATES ---
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editNoticeId, setEditNoticeId] = useState(null);
  const [isSubmittingNotice, setIsSubmittingNotice] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const initialPostState = { title: "", description: "", recipients: [], sendTo: 'ALL', selectedGroupId: null };
  const [postData, setPostData] = useState(initialPostState);

  // --- EXISTING NOTICE CHAT STATES ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeNotice, setActiveNotice] = useState(null); 
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  
  // --- IMAGE & AI STATES ---
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(null);
  const lastUploadedImageRef = useRef(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const messagesEndRef = useRef(null);

  // Refs
  const newlyReadIdsRef = useRef(new Set());
  const alertedMeetingsRef = useRef(new Set());

  // --- OPTIMIZED FETCH LOGIC ---
  const fetchNotices = useCallback(async (silent = false) => {
    try {
      const { data } = await api.get("/api/notices");

      // Extract Config Notice
      const configNotice = data.find(n => n.title === "__SYSTEM_GROUPS_CONFIG__");
      if (configNotice) {
        try {
          const parsedGroups = JSON.parse(configNotice.description);
          if (Array.isArray(parsedGroups)) setGroups(parsedGroups);
        } catch (e) { console.error("Error parsing admin groups", e); }
      }

      // Filter Data
      const filteredData = data.filter(notice => 
        notice.title !== "__SYSTEM_READ_STATE__" && 
        notice.title !== "__SYSTEM_GROUPS_CONFIG__"
      );

      // Sort
      const sortedData = filteredData.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Process Read States
      const processedData = sortedData.map(notice => {
          if (newlyReadIdsRef.current.has(notice._id)) {
              return {
                  ...notice,
                  readBy: notice.readBy.filter(r => {
                      const rId = typeof r.employeeId === 'object' ? r.employeeId._id : r.employeeId;
                      return rId !== currentUserId;
                  })
              };
          }
          return notice;
      });

      setNotices(processedData);
      
      autoMarkAsRead(sortedData);
      
      // Update active notice if chat is open
      if (activeNotice) {
        const updatedActive = sortedData.find(n => n._id === activeNotice._id);
        if (!sendingReply && updatedActive) {
           // Only update if replies changed length to avoid jitter
           if(updatedActive.replies.length !== activeNotice.replies?.length) {
              setActiveNotice(updatedActive);
           }
        }
      }
    } catch (err) {
      console.error("Error fetching notices:", err);
    } 
  }, [activeNotice, currentUserId, sendingReply]);

  const fetchEmployeeList = async () => {
    try {
      const data = await getEmployees();
      setEmployees(data.filter(emp => emp.isActive !== false));
    } catch (err) { console.error(err); }
  };

  // ✅ OPTIMIZED BOOTSTRAP: Parallel Fetching
  useEffect(() => { 
    const bootstrap = async () => {
        if (user) {
            setIsInitialLoading(true);
            try {
                // Fetch ALL critical data in parallel
                // Removed chat fetching to improve speed
                await Promise.all([
                    fetchNotices(false),
                    fetchEmployeeList()
                ]);
            } catch (error) {
                console.error("Error loading initial data", error);
            } finally {
                setIsInitialLoading(false);
            }
        }
    };
    bootstrap();
  }, [user]); 

  // ✅ Polling Interval (Keep data fresh)
  useEffect(() => {
    const interval = setInterval(() => {
        fetchNotices(true); 
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchNotices]);

  useEffect(() => {
    const timer = setInterval(() => {
        setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isChatOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeNotice?.replies?.length, isChatOpen]);

  // ==========================================
  // --- EXISTING HELPER LOGIC ---
  // ==========================================

  useEffect(() => {
    if (!activeNotice) return;
    const replies = activeNotice.replies || [];
    const lastIncoming = [...replies].reverse().find(r => r.sentBy !== 'Employee'); 
    const incomingText = lastIncoming ? lastIncoming.message.toLowerCase() : "";

    let suggestions = ["Noted sir", "Alright sir", "Understood sir"];
    if (incomingText) {
        if (incomingText.includes("urgent") || incomingText.includes("asap")) {
            suggestions = ["On it sir", "Working on it sir"];
        } 
        else if (incomingText.includes("update") || incomingText.includes("status")) {
            suggestions = ["Almost done sir", "Sending update shortly sir"];
        } 
        else if (incomingText.includes("thanks") || incomingText.includes("thank you")) {
            suggestions = ["Thank you sir", "Noted sir"];
        }
    }
    setAiSuggestions([...new Set(suggestions)]);
  }, [activeNotice]); 

  useEffect(() => {
    notices.forEach(notice => {
        const detectedLink = notice.description ? (notice.description.match(/(https?:\/\/[^\s]+)/) || [])[0] : null;
        const isMeeting = detectedLink && (
             notice.title.toLowerCase().includes('meeting') || 
             notice.description.toLowerCase().includes('meeting')
        );

        if (isMeeting) {
            const components = getMeetingDateTimeComponents(notice.description);
            if (components) {
                const diff = calculateTimeLeft(components.date, components.time);
                if (diff !== null && diff <= 0 && diff > -5000 && !alertedMeetingsRef.current.has(notice._id)) {
                    try {
                        const utterance = new SpeechSynthesisUtterance("Please join the meeting");
                        window.speechSynthesis.speak(utterance);
                        alertedMeetingsRef.current.add(notice._id);
                    } catch (e) { console.error(e); }
                }
            }
        }
    });
  }, [currentTime, notices]);

  const autoMarkAsRead = async (fetchedNotices) => {
    if (!currentUserId) return;
    const unreadNotices = fetchedNotices.filter(notice => {
      const isRead = notice.readBy && notice.readBy.some(record => {
        const rId = typeof record.employeeId === 'object' ? record.employeeId._id : record.employeeId;
        return rId === currentUserId;
      });
      return !isRead && !newlyReadIdsRef.current.has(notice._id);
    });

    if (unreadNotices.length === 0) return;
    unreadNotices.forEach(n => newlyReadIdsRef.current.add(n._id));

    try {
      api.put(`/api/notices/${unreadNotices[0]._id}/read`).catch(e => console.error(e));
      setTimeout(() => {
        unreadNotices.forEach(n => newlyReadIdsRef.current.delete(n._id));
        fetchNotices(true); 
      }, 5000);
    } catch (error) { console.error(error); }
  };

  const handlePostNotice = async (e) => {
    e.preventDefault();
    setIsSubmittingNotice(true);
    try {
      const payload = {
        title: postData.title,
        description: postData.description,
        recipients: postData.sendTo === 'ALL' ? [] : postData.recipients
      };
      
      if (isEditing) {
        await api.put(`/api/notices/${editNoticeId}`, payload);
      } else {
        await addNotice(payload);
      }
      
      setIsPostModalOpen(false);
      setIsEditing(false);
      setEditNoticeId(null);
      setPostData(initialPostState);
      fetchNotices(true);
    } catch (err) { alert("Failed to save notice"); } 
    finally { setIsSubmittingNotice(false); }
  };

  const openEditNotice = (notice) => {
    setIsEditing(true);
    setEditNoticeId(notice._id);
    const recipients = Array.isArray(notice.recipients) ? notice.recipients : [];
    const recipientIds = recipients.map(r => r._id || r);
    setPostData({
        title: notice.title,
        description: notice.description,
        recipients: recipientIds,
        sendTo: recipientIds.length > 0 ? 'SPECIFIC' : 'ALL',
        selectedGroupId: null
    });
    setIsPostModalOpen(true);
  };

  const handleDeleteNotice = async (id) => {
    if (!window.confirm("Are you sure you want to delete this notice?")) return;
    try {
      await api.delete(`/api/notices/${id}`);
      fetchNotices(true);
    } catch (err) { alert("Failed to delete notice"); }
  };

  const toggleRecipient = (id) => {
    setPostData(prev => ({
      ...prev,
      recipients: prev.recipients.includes(id) 
        ? prev.recipients.filter(rid => rid !== id) 
        : [...prev.recipients, id]
    }));
  };

  const handleSendReply = async (customMessage = null) => {
    const messageToSend = (typeof customMessage === 'string' && customMessage) ? customMessage : replyText;
    if ((!messageToSend || !messageToSend.trim()) && !selectedFile) return;
    
    let tempImageUrl = null;
    if (selectedFile) {
        tempImageUrl = URL.createObjectURL(selectedFile);
        lastUploadedImageRef.current = { url: tempImageUrl, timestamp: Date.now() };
    }

    const optimisticReply = {
        _id: Date.now(),
        message: messageToSend,
        image: tempImageUrl, 
        sentBy: 'Employee',
        employeeId: { 
            _id: currentUserId, 
            name: user?.name, 
            employeeId: user?.employeeId || user?.empId 
        }, 
        repliedAt: new Date().toISOString(),
        isSending: true 
    };
    
    setReplyText("");
    setSelectedFile(null); 
    setActiveNotice(prev => ({ ...prev, replies: [...(prev.replies || []), optimisticReply] }));
    setSendingReply(true); 
    
    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append("message", messageToSend);
        formData.append("image", selectedFile);
        await sendReplyWithImage(activeNotice._id, formData);
      } else {
        await api.post(`/api/notices/${activeNotice._id}/reply`, { message: messageToSend });
      }
      await fetchNotices(true); 
    } catch (error) { alert("Failed to send reply"); } 
    finally { setSendingReply(false); }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.size <= 5 * 1024 * 1024) setSelectedFile(file);
    else if (file) alert("Max 5MB");
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteReply = async (noticeId, replyId) => {
    if(!window.confirm("Delete?")) return;
    try { 
        setActiveNotice(prev => ({ ...prev, replies: prev.replies.filter(r => r._id !== replyId) }));
        await api.delete(`/api/notices/${noticeId}/reply/${replyId}`); 
        fetchNotices(true);
    } catch(e) { alert("Error"); }
  };

  const openChatModal = (notice) => {
    setActiveNotice(notice);
    setIsChatOpen(true);
    setReplyText("");
    setSelectedFile(null);
  };

  const formatDateTime = (dateString) => {
    const d = new Date(dateString);
    return { date: d.toLocaleDateString(), time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
  };

  const getMeetingDateTimeComponents = (description) => {
    if (!description) return null;
    const match = description.match(/scheduled meeting\s+(.+?)\s+at\s+(.+?)\s+as per/i);
    return (match && match[1] && match[2]) ? { date: match[1], time: match[2] } : null;
  };

  const calculateTimeLeft = (dateStr, timeStr) => {
      if(!dateStr || !timeStr) return null;
      try {
          const target = new Date(`${dateStr}T${timeStr}`);
          return target - currentTime;
      } catch (e) { return null; }
  };

  if (isInitialLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold">Loading Notices...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] overflow-hidden relative font-sans">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply blur-3xl opacity-30 animate-blob"></div>
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-12">
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-md">
                <FaBullhorn className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Team Announcements</h1>
            </div>
            <p className="text-sm text-gray-600">
              Welcome, <span className="font-semibold text-blue-600">{user?.name || "Team Member"}</span>
            </p>
          </div>

          <div className="flex gap-3">
            <button 
                onClick={() => { setIsEditing(false); setPostData(initialPostState); setIsPostModalOpen(true); }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95"
            >
                <FaPlus /> Post Announcement
            </button>
          </div>
        </div>

        {/* --- EXISTING NOTICES LIST RENDERING --- */}
        <div className="space-y-5">
          {notices.map((notice) => {
            const { date, time } = formatDateTime(notice.date);
            const isRead = notice.readBy?.some(record => (record.employeeId?._id || record.employeeId) === currentUserId);
            const isOwner = (notice.createdBy?._id || notice.createdBy) === currentUserId;
            const replies = notice.replies || [];
            const hasAdminReply = replies[replies.length - 1]?.sentBy === 'Admin';
            
            const detectedLink = notice.description ? (notice.description.match(/(https?:\/\/[^\s]+)/) || [])[0] : null;
            const isMeeting = detectedLink && (notice.title.toLowerCase().includes('meeting') || notice.description.includes('meet.google'));
            const meetingComponents = isMeeting ? getMeetingDateTimeComponents(notice.description) : null;

            let countdownString = null;
            let isMeetingStarted = false;
            if (isMeeting && meetingComponents) {
                const diff = calculateTimeLeft(meetingComponents.date, meetingComponents.time);
                if (diff !== null) {
                    if (diff > 0) {
                        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
                        const m = Math.floor((diff / 1000 / 60) % 60);
                        const s = Math.floor((diff / 1000) % 60);
                        countdownString = `Starts in ${h}h ${m}m ${s}s`;
                    } else if (diff > -1200000) {
                        isMeetingStarted = true;
                        countdownString = "🔴 Join Meeting Now";
                    }
                }
            }

            const recipientsArr = Array.isArray(notice.recipients) ? notice.recipients : [];
            const recipientIds = recipientsArr.map(r => r._id || r);
            const isSpecific = recipientIds.length > 0;
            const matchedGroup = isSpecific ? groups.find(g => 
              g.members.length === recipientIds.length && 
              g.members.every(m => recipientIds.includes(String(m)))
            ) : null;

            return (
              <div key={notice._id} className={`group relative bg-white/90 backdrop-blur-md rounded-2xl p-6 transition-all hover:shadow-xl border ${isMeeting ? 'border-indigo-100 shadow-indigo-100/50' : 'border-slate-100'}`}>
                {isMeeting && <div className="absolute top-0 left-8 right-8 h-1 bg-indigo-500 rounded-b-md opacity-50"></div>}

                <div className="flex flex-col md:flex-row gap-5">
                  <div className="hidden md:flex flex-col items-center">
                    <div className={`p-3 rounded-2xl shadow-lg transition-colors duration-1000 ${isRead ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white animate-pulse' }`}>
                      {isMeeting ? <FaVideo className="w-6 h-6" /> : <FaBullhorn className="w-6 h-6" />}
                    </div>
                    <div className="h-full w-0.5 mt-4 rounded-full bg-slate-100"></div>
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-xl font-bold text-slate-800">{notice.title}</h3>
                                {isOwner && (
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                        <button onClick={() => openEditNotice(notice)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md transition-colors" title="Edit"><FaPen size={14} /></button>
                                        <button onClick={() => handleDeleteNotice(notice._id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete"><FaTrash size={14} /></button>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                {!isSpecific ? (
                                    <span className="text-[10px] font-bold bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded border border-cyan-100">📢 Everyone</span>
                                ) : matchedGroup ? (
                                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">👥 {matchedGroup.name}</span>
                                ) : (
                                    <button onClick={() => setExpandedNoticeId(expandedNoticeId === notice._id ? null : notice._id)} className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100 flex items-center gap-1 hover:bg-amber-100 transition-colors">
                                      🔒 Specific ({recipientIds.length}) {expandedNoticeId === notice._id ? <FaChevronUp /> : <FaChevronDown />}
                                    </button>
                                )}
                                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                                  {notice.createdBy?.name || "System"} ({notice.createdBy?.employeeId || "Admin"})
                                </span>
                                <span className="text-[10px] text-slate-400">{date}, {time}</span>
                            </div>

                            {expandedNoticeId === notice._id && isSpecific && !matchedGroup && (
                                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl animate-in slide-in-from-top-2 duration-200">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Selected Employees:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {recipientsArr.map((r, i) => {
                                          const name = typeof r === 'object' ? r.name : (employees.find(e => e._id === r)?.name || "User");
                                          return <span key={i} className="text-[10px] font-semibold bg-white text-slate-600 px-2 py-1 rounded shadow-sm border border-slate-100">{name}</span>
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            {isMeeting && countdownString && (
                                <div className={`text-[10px] font-bold px-2 py-1 rounded-md border ${isMeetingStarted ? 'bg-red-50 text-red-600 border-red-100 animate-pulse' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                    <FaClock className="inline mr-1" /> {countdownString}
                                </div>
                            )}
                            <button onClick={() => openChatModal(notice)} className="relative flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-xs font-bold hover:bg-blue-100 border border-blue-100">
                                <FaComments /> Chat
                                {hasAdminReply && (
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                    
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap mb-4">{notice.description}</p>
                    
                    {isMeeting && detectedLink && (
                         <a href={detectedLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all w-full sm:w-auto justify-center">
                            <FaVideo className="animate-pulse" /> Join Meeting Now
                         </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- POST/EDIT NOTICE MODAL --- */}
      {isPostModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-blue-700 to-blue-500 p-6 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                   {isEditing ? <FaPen className="text-xl" /> : <FaBullhorn className="text-xl" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{isEditing ? "Edit Announcement" : "Create New Announcement"}</h2>
                  <p className="text-blue-100 text-xs">Share updates with your team members</p>
                </div>
              </div>
              <button onClick={() => setIsPostModalOpen(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors"><FaTimes size={20} /></button>
            </div>

            <form onSubmit={handlePostNotice} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block ml-1">Notice Heading</label>
                <input required className="w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-800 font-semibold" placeholder="e.g. Project Update" value={postData.title} onChange={e => setPostData({...postData, title: e.target.value})} />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block ml-1">Detailed Message</label>
                <textarea required className="w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl h-44 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none text-gray-700" placeholder="Type the announcement details here..." value={postData.description} onChange={e => setPostData({...postData, description: e.target.value})} />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block ml-1">Who can see this?</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPostData({...postData, sendTo: 'ALL', selectedGroupId: null})} className={`flex-1 py-4 px-2 rounded-2xl border-2 font-bold transition-all flex flex-col items-center justify-center gap-1 ${postData.sendTo === 'ALL' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200'}`}>
                    <FaUserFriends /> Everyone
                  </button>
                  <button type="button" onClick={() => setPostData({...postData, sendTo: 'GROUP', recipients: []})} className={`flex-1 py-4 px-2 rounded-2xl border-2 font-bold transition-all flex flex-col items-center justify-center gap-1 ${postData.sendTo === 'GROUP' ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200'}`}>
                    <FaLayerGroup /> Group Sending
                  </button>
                  <button type="button" onClick={() => setPostData({...postData, sendTo: 'SPECIFIC', selectedGroupId: null})} className={`flex-1 py-4 px-2 rounded-2xl border-2 font-bold transition-all flex flex-col items-center justify-center gap-1 ${postData.sendTo === 'SPECIFIC' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200'}`}>
                    <FaUserTag /> Specific Employees
                  </button>
                </div>
              </div>

              {postData.sendTo === 'GROUP' && (
                <div className="space-y-3 animate-in slide-in-from-top-4">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block ml-1">Select Group</label>
                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                    {groups.length > 0 ? (
                      groups.map(group => (
                        <div 
                          key={group.id} 
                          onClick={() => setPostData({...postData, selectedGroupId: group.id, recipients: group.members})}
                          className={`p-4 rounded-xl border-2 cursor-pointer flex justify-between items-center transition-all ${postData.selectedGroupId === group.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-gray-100 hover:border-indigo-200'}`}
                        >
                          <div className="flex items-center gap-3">
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${postData.selectedGroupId === group.id ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                                {group.name.charAt(0)}
                             </div>
                             <div>
                                <p className={`text-sm font-bold ${postData.selectedGroupId === group.id ? 'text-indigo-800' : 'text-gray-700'}`}>{group.name}</p>
                                <p className="text-[10px] text-gray-500">{group.members.length} Members</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button 
                               type="button" 
                               onClick={(e) => { e.stopPropagation(); setPreviewGroup(group); }}
                               className="text-[10px] font-bold bg-white border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 flex items-center gap-1 transition-colors"
                            >
                                <FaEye /> View Employees
                            </button>
                            {postData.selectedGroupId === group.id && <FaCheck className="text-indigo-600" />}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center p-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm">
                        No groups available. Groups created by admin will appear here.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {postData.sendTo === 'SPECIFIC' && (
                <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                  <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl text-sm flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px]">{postData.recipients.length}</div>
                        <span className="font-bold text-gray-700">Recipients Selected</span>
                    </div>
                    <FaChevronDown className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                  
                  {isDropdownOpen && (
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-72">
                      <div className="p-3 border-b bg-gray-50 flex items-center gap-2">
                        <FaSearch className="text-gray-400 ml-2" />
                        <input type="text" placeholder="Search by name or employee ID..." className="w-full bg-transparent p-2 text-sm outline-none font-medium" onChange={e => setSearchTerm(e.target.value.toLowerCase())} />
                      </div>
                      <div className="overflow-y-auto p-2 custom-scrollbar">
                        {employees.filter(e => e.name.toLowerCase().includes(searchTerm) || e.employeeId.toLowerCase().includes(searchTerm)).map(emp => (
                          <div key={emp._id} onClick={() => toggleRecipient(emp._id)} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all mb-1 ${postData.recipients.includes(emp._id) ? 'bg-blue-50 border-blue-100' : 'hover:bg-gray-50'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${postData.recipients.includes(emp._id) ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                    {emp.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-800">{emp.name}</p>
                                    <p className="text-[10px] text-gray-500 font-medium">ID: {emp.employeeId}</p>
                                </div>
                            </div>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${postData.recipients.includes(emp._id) ? 'bg-blue-600 border-blue-600' : 'border-gray-200'}`}>
                              {postData.recipients.includes(emp._id) && <FaCheck className="text-white text-[10px]" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4">
                <button type="submit" disabled={isSubmittingNotice} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 rounded-2xl shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-3 disabled:opacity-70 transform active:scale-[0.98]">
                    {isSubmittingNotice ? (
                        <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <><FaPaperPlane /> {isEditing ? "Update Announcement" : "Publish Announcement"}</>
                    )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- GROUP MEMBER PREVIEW --- */}
      {previewGroup && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2"><FaUsers /> Members: {previewGroup.name}</h3>
                    <button onClick={() => setPreviewGroup(null)} className="p-1 hover:bg-white/20 rounded"><FaTimes /></button>
                </div>
                <div className="p-4 max-h-80 overflow-y-auto custom-scrollbar space-y-2">
                    {previewGroup.members.map(id => {
                        const emp = employees.find(e => e._id === String(id));
                        return (
                            <div key={id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                                    {emp?.name?.charAt(0) || "?"}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-700">{emp?.name || "Unknown"}</p>
                                    <p className="text-[10px] text-slate-400">{emp?.employeeId || "N/A"}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="p-3 bg-slate-50 border-t border-slate-100 text-right">
                    <button onClick={() => setPreviewGroup(null)} className="text-xs font-bold text-indigo-600 px-4 py-2 hover:bg-indigo-50 rounded-lg transition-colors">Close</button>
                </div>
            </div>
        </div>
      )}

      {/* --- NOTICE CHAT MODAL --- */}
      {isChatOpen && activeNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl h-[85vh] rounded-xl shadow-2xl flex flex-col relative overflow-hidden border border-gray-200">
                <div className="sticky top-0 bg-[#464775] text-white p-4 flex justify-between items-center z-20 shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                            <FaComments className="text-white" />
                        </div>
                        <div className="max-w-md">
                            <h3 className="font-bold text-sm truncate">Discussion: {activeNotice.title}</h3>
                            <p className="text-xs text-gray-300">{activeNotice.replies?.length || 0} messages</p>
                        </div>
                    </div>
                    <button onClick={() => setIsChatOpen(false)} className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors"><FaTimes /></button>
                </div>

                <div className="flex-1 flex flex-col bg-[#f3f2f1] overflow-hidden relative">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="p-4 space-y-3 min-h-full flex flex-col justify-end pb-4">
                            {(!activeNotice.replies || activeNotice.replies.length === 0) ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm italic py-20">
                                    <FaComments className="text-gray-400 text-2xl mb-2" />
                                    <p>No messages yet</p>
                                </div>
                            ) : (
                                activeNotice.replies.map((reply, i) => {
                                    const senderId = reply.employeeId?._id || reply.employeeId;
                                    const isMe = reply.sentBy === 'Employee' && currentUserId && (senderId === currentUserId);

                                    let imageSrc = reply.image;
                                    const isLastMessage = i === activeNotice.replies.length - 1;
                                    if (isMe && isLastMessage && !reply.isSending && lastUploadedImageRef.current) {
                                        if (Date.now() - lastUploadedImageRef.current.timestamp < 30000) imageSrc = lastUploadedImageRef.current.url;
                                    }

                                    let displayName = "Admin";
                                    if (isMe) {
                                        displayName = "You";
                                    } else if (reply.sentBy === 'Employee') {
                                        const empInfo = reply.employeeId;
                                        if (typeof empInfo === 'object' && empInfo !== null) {
                                            const name = empInfo.name || "Employee";
                                            const id = empInfo.employeeId || empInfo.empId || "";
                                            displayName = id ? `${name} (${id})` : name;
                                        } else {
                                            displayName = "Employee";
                                        }
                                    }

                                    return (
                                        <div key={reply._id || i} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] p-3 rounded-lg ${isMe ? 'rounded-br-none' : 'rounded-bl-none'}`}>
                                                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                    <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                                                        <span className={`text-xs font-semibold ${isMe ? 'text-blue-600' : 'text-gray-700'}`}>{displayName}</span>
                                                        <span className="text-[10px] text-gray-500">{formatDateTime(reply.repliedAt).time}</span>
                                                    </div>
                                                    <div className={`relative group ${isMe ? 'ml-auto' : ''}`}>
                                                        <div className={`p-3 rounded-lg shadow-sm ${isMe ? 'bg-[#6264a7] text-white' : 'bg-white text-gray-800 border border-gray-200'}`}>
                                                            {imageSrc && (
                                                              <div className="mb-2 relative cursor-pointer" onClick={() => !reply.isSending && setPreviewImage(imageSrc)}>
                                                                <img src={imageSrc} className={`rounded-lg max-w-full max-h-60 object-cover border border-black/10 ${reply.isSending ? 'opacity-70' : ''}`} alt="att" />
                                                                {reply.isSending && (
                                                                   <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                                                                       <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                                   </div>
                                                                )}
                                                              </div>
                                                            )}
                                                            {reply.message && <p className="text-sm leading-relaxed break-words">{reply.message}</p>}
                                                        </div>
                                                        {isMe && !reply.isSending && (
                                                            <button onClick={() => handleDeleteReply(activeNotice._id, reply._id)} className="absolute -right-2 -top-2 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center text-gray-500 hover:text-red-500 shadow-md opacity-0 group-hover:opacity-100 transition-all">
                                                                <FaTrash size={10} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    <div className="sticky bottom-0 bg-white border-t border-gray-200 z-30 shadow-lg">
                        {selectedFile && (
                          <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-3">
                             <img src={URL.createObjectURL(selectedFile)} className="w-10 h-10 border rounded object-cover" alt="prev" />
                             <div className="flex-1 overflow-hidden">
                                <p className="text-xs font-bold truncate">{selectedFile.name}</p>
                                <p className="text-[10px] text-gray-400">{(selectedFile.size/1024).toFixed(1)} KB</p>
                             </div>
                             <button onClick={clearSelectedFile} className="text-gray-400 hover:text-red-500"><FaTimes /></button>
                          </div>
                        )}

                        <div className="px-4 pt-3 pb-1 flex items-center gap-2 overflow-x-auto no-scrollbar">
                             <div className="flex items-center gap-1.5 text-[#6264a7] text-xs font-bold mr-2 shrink-0"><FaRobot /> AI:</div>
                             {aiSuggestions.map((sugg, idx) => (
                                <button key={idx} onClick={() => setReplyText(sugg)} className="bg-white border border-gray-200 hover:border-[#6264a7] rounded-full px-4 py-1 text-xs font-medium whitespace-nowrap shadow-sm transition-all">{sugg}</button>
                             ))}
                        </div>

                        <div className="p-4 pt-2">
                            <div className="flex items-center gap-3">
                                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                                <button onClick={() => fileInputRef.current.click()} className={`p-3 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 ${selectedFile ? 'text-[#6264a7] bg-blue-50 border-blue-200' : ''}`}><FaPaperclip /></button>
                                <input className="flex-1 bg-[#f3f2f1] p-3 rounded-lg text-sm outline-none" placeholder="Reply to notice..." value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendReply()} />
                                <button onClick={() => handleSendReply()} disabled={sendingReply || (!replyText.trim() && !selectedFile)} className={`p-3 rounded-lg flex items-center justify-center transition-all ${sendingReply || (!replyText.trim() && !selectedFile) ? 'bg-gray-200 text-gray-400' : 'bg-[#6264a7] text-white'}`}>
                                    {sendingReply ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FaPaperPlane />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {previewImage && (
        <div className="fixed inset-0 z-[250] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-4 right-4 text-white"><FaTimes size={24} /></button>
          <img src={previewImage} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl animate-in zoom-in-95" alt="prev" />
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default NoticeList;