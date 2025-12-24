import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
import { AuthContext } from "../context/AuthContext"; 
import api, { sendReplyWithImage } from "../api"; 
import { FaPaperPlane, FaTrash, FaComments, FaTimes, FaRobot, FaPen, FaPaperclip, FaVideo, FaClock } from "react-icons/fa";

const NoticeList = () => {
  const [notices, setNotices] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // ✅ REAL-TIME CLOCK STATE FOR COUNTDOWN
  const [currentTime, setCurrentTime] = useState(new Date());

  const { user } = useContext(AuthContext);
  const currentUserId = user?._id || user?.id;

  // Chat Modal State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeNotice, setActiveNotice] = useState(null); 
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  
  // ✅ Image Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // ✅ NEW: Image Lightbox State
  const [previewImage, setPreviewImage] = useState(null);

  // ✅ NEW: Ref to store local image URL to prevent "Flash" upon server sync
  const lastUploadedImageRef = useRef(null);
  
  // AI Suggestions State
  const [aiSuggestions, setAiSuggestions] = useState([]);

  // Auto-scroll to bottom of chat
  const messagesEndRef = useRef(null);

  // ✅ REF TO TRACK NEWLY READ NOTICES
  const newlyReadIdsRef = useRef(new Set());

  // ✅ REF TO TRACK MEETINGS ALREADY ALERTED (Audio)
  const alertedMeetingsRef = useRef(new Set());

  // ✅ STABLE FETCH FUNCTION
  const fetchNotices = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsInitialLoading(true);
      
      const { data } = await api.get("/api/notices");
      const sortedData = data.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // ✅ INTERCEPT DATA: Keep notices colored if they are in the 5s grace period
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

      setNotices(prev => {
        if (JSON.stringify(prev) === JSON.stringify(processedData)) return prev;
        return processedData;
      });
      
      autoMarkAsRead(sortedData);
      
      // Update Active Chat Window Silently
      if (activeNotice) {
        const updatedActive = sortedData.find(n => n._id === activeNotice._id);
        
        // ✅ FIX: Do NOT update active notice if we are currently sending a reply.
        // This keeps the optimistic "loading" image visible until upload finishes.
        if (!sendingReply && updatedActive && JSON.stringify(updatedActive.replies) !== JSON.stringify(activeNotice.replies)) {
           setActiveNotice(updatedActive);
        }
      }
    } catch (err) {
      console.error("Error fetching notices:", err);
    } finally {
      if (!silent) setIsInitialLoading(false);
    }
  }, [activeNotice, currentUserId, sendingReply]); 

  // Initial Load Only
  useEffect(() => { 
    if (user) {
        fetchNotices(false); 
    }
  }, [user]); 

  // Polling: Check for messages every 3s
  useEffect(() => {
    const interval = setInterval(() => {
        fetchNotices(true); 
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchNotices]);

  // ✅ TIMER INTERVAL: Update 'currentTime' every second
  useEffect(() => {
    const timer = setInterval(() => {
        setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (isChatOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeNotice?.replies?.length, isChatOpen]);

  // ✅ AI SUGGESTION LOGIC
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


  // ✅ AUDIO ALERT LOGIC (Checks every second via currentTime)
  useEffect(() => {
    notices.forEach(notice => {
        // Detect Meeting
        const detectedLink = notice.description ? (notice.description.match(/(https?:\/\/[^\s]+)/) || [])[0] : null;
        const isMeeting = detectedLink && (
             notice.title.toLowerCase().includes('meeting') || 
             notice.description.toLowerCase().includes('meeting') ||
             notice.description.includes('meet.google') ||
             notice.description.includes('zoom.us')
        );

        if (isMeeting) {
            const components = getMeetingDateTimeComponents(notice.description);
            if (components) {
                const diff = calculateTimeLeft(components.date, components.time);
                // Trigger if time is up (diff <= 0) and we haven't alerted yet.
                // We check diff > -5000 to ensure we don't alert for old meetings on page load.
                if (diff !== null && diff <= 0 && diff > -5000 && !alertedMeetingsRef.current.has(notice._id)) {
                    // 🔊 PLAY SOUND / SPEAK
                    try {
                        const utterance = new SpeechSynthesisUtterance("Please join the meeting");
                        window.speechSynthesis.speak(utterance);
                        alertedMeetingsRef.current.add(notice._id);
                    } catch (e) {
                        console.error("Audio playback failed", e);
                    }
                }
            }
        }
    });
  }, [currentTime, notices]);


  // ✅ AUTO MARK LOGIC
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
      Promise.all(unreadNotices.map(n => api.put(`/api/notices/${n._id}/read`))).catch(e => console.error(e));
      setTimeout(() => {
        let changed = false;
        unreadNotices.forEach(n => {
            if (newlyReadIdsRef.current.has(n._id)) {
                newlyReadIdsRef.current.delete(n._id);
                changed = true;
            }
        });
        if(changed) fetchNotices(true);
      }, 5000);
    } catch (error) { 
      console.error("Error auto-marking notices:", error); 
    }
  };

  // ✅ UPDATED SEND REPLY HANDLER
  const handleSendReply = async (customMessage = null) => {
    const messageToSend = (typeof customMessage === 'string' && customMessage) ? customMessage : replyText;

    if ((!messageToSend || !messageToSend.trim()) && !selectedFile) return;
    
    // Create local preview URL for optimistic update
    let tempImageUrl = null;
    if (selectedFile) {
        tempImageUrl = URL.createObjectURL(selectedFile);
        // ✅ SAVE BLOB URL TO REF (To prevent flash later)
        lastUploadedImageRef.current = { url: tempImageUrl, timestamp: Date.now() };
    }

    // Optimistic Update
    const tempId = Date.now();
    const optimisticReply = {
        _id: tempId,
        message: messageToSend,
        image: tempImageUrl, 
        sentBy: 'Employee',
        repliedAt: new Date().toISOString(),
        isSending: true // ✅ Flag to show loading spinner
    };
    
    setReplyText("");
    setSelectedFile(null); 
    if(fileInputRef.current) fileInputRef.current.value = "";
    
    // Update local state immediately
    setActiveNotice(prev => ({
        ...prev,
        replies: [...(prev.replies || []), optimisticReply]
    }));

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

    } catch (error) { 
        alert("Failed to send reply"); 
    } finally { 
        setSendingReply(false); 
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) { 
            alert("File too large. Max 5MB.");
            return;
        }
        setSelectedFile(file);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteReply = async (noticeId, replyId) => {
    if(!window.confirm("Delete this message?")) return;
    try { 
        setActiveNotice(prev => ({
            ...prev,
            replies: prev.replies.filter(r => r._id !== replyId)
        }));

        await api.delete(`/api/notices/${noticeId}/reply/${replyId}`); 
        fetchNotices(true);
    } catch(e) { alert("Error deleting"); }
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

  // ✅ HELPER: Extract raw components for countdown logic
  const getMeetingDateTimeComponents = (description) => {
    if (!description) return null;
    const match = description.match(/scheduled meeting\s+(.+?)\s+at\s+(.+?)\s+as per/i);
    if (match && match[1] && match[2]) {
        return { date: match[1], time: match[2] };
    }
    return null;
  };

  // ✅ HELPER: Calculate time difference
  const calculateTimeLeft = (dateStr, timeStr) => {
      if(!dateStr || !timeStr) return null;
      try {
          const target = new Date(`${dateStr}T${timeStr}`);
          const diff = target - currentTime;
          return diff;
      } catch (e) { return null; }
  };

  if (isInitialLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] overflow-hidden relative font-sans">
      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply blur-3xl opacity-30 animate-blob"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-md">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 2a6 6 0 110 12 6 6 0 010-12zm0 4a1 1 0 011 1v4a1 1 0 11-2 0V9a1 1 0 011-1zm0 6a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Company Announcements</h1>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-gray-600">
            <p className="text-sm font-medium">
              Important updates and communications for <span className="font-semibold text-blue-600">{user?.name || "Team Member"}</span>
            </p>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <span className="font-medium">{notices.length} active announcement{notices.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* Notices List */}
        <div className="space-y-5">
          {notices.map((notice, index) => {
            const { date, time } = formatDateTime(notice.date); // Standard notice time
            const isRead = notice.readBy && notice.readBy.some(record => {
              const rId = typeof record.employeeId === 'object' ? record.employeeId._id : record.employeeId;
              return rId === currentUserId;
            });
            const replies = notice.replies || [];
            const lastReply = replies.length > 0 ? replies[replies.length - 1] : null;
            const hasAdminReply = lastReply && lastReply.sentBy === 'Admin';
            
            // ✅ DETECT IF MEETING NOTICE (DYNAMIC LINK CHECK)
            const detectedLink = notice.description ? (notice.description.match(/(https?:\/\/[^\s]+)/) || [])[0] : null;
            const isMeeting = detectedLink && (
                 notice.title.toLowerCase().includes('meeting') || 
                 notice.description.toLowerCase().includes('meeting') ||
                 notice.description.includes('meet.google') ||
                 notice.description.includes('zoom.us')
            );

            // ✅ EXTRACT ACTUAL MEETING TIME COMPONENTS
            const meetingComponents = isMeeting ? getMeetingDateTimeComponents(notice.description) : null;
            const displayMeetingTime = meetingComponents ? `${meetingComponents.date} at ${meetingComponents.time}` : `${date}, ${time}`;

            // ✅ CALCULATE COUNTDOWN AND VISIBILITY
            let countdownString = null;
            let isMeetingStarted = false;

            if (isMeeting && meetingComponents) {
                const diff = calculateTimeLeft(meetingComponents.date, meetingComponents.time);
                if (diff !== null) {
                    if (diff > 0) {
                        // FUTURE: Show Countdown
                        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
                        const minutes = Math.floor((diff / 1000 / 60) % 60);
                        const seconds = Math.floor((diff / 1000) % 60);
                        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                        
                        if (days > 0) {
                            countdownString = `Starts in ${days}d ${hours}h ${minutes}m`;
                        } else {
                            countdownString = `Starts in ${hours}h ${minutes}m ${seconds}s`;
                        }
                    } else {
                        // PAST: Check if it's within 20 mins of starting
                        const twentyMinsInMs = 20 * 60 * 1000;
                        if (diff > -twentyMinsInMs) {
                            isMeetingStarted = true;
                            countdownString = "🔴 Join the Meeting";
                        } else {
                            // Older than 20 mins - Hide the Timer
                            countdownString = null; 
                        }
                    }
                }
            }

            return (
              <div key={notice._id} className={`group relative bg-white/90 backdrop-blur-md rounded-2xl p-6 transition-all hover:shadow-xl border ${isMeeting ? 'border-indigo-100 shadow-indigo-100/50' : 'border-slate-100'}`}>
                {/* Meeting Indicator Stripe */}
                {isMeeting && <div className="absolute top-0 left-8 right-8 h-1 bg-indigo-500 rounded-b-md opacity-50"></div>}

                <div className="flex flex-col md:flex-row gap-5">
                  <div className="hidden md:flex flex-col items-center">
                    <div 
                      className={`p-3 rounded-2xl shadow-lg transition-colors duration-1000 ${
                        isRead 
                        ? (isMeeting ? 'bg-indigo-50 text-indigo-400 border border-indigo-200' : 'bg-slate-100 text-slate-400 border border-slate-200') 
                        : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white animate-pulse' 
                      }`}
                    >
                      {isMeeting ? <FaVideo className="w-6 h-6" /> : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                      )}
                    </div>
                    <div className={`h-full w-0.5 mt-4 rounded-full ${isMeeting ? 'bg-indigo-100' : 'bg-slate-100'}`}></div>
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                {notice.title}
                            </h3>
                            
                            {/* 1. Posted Time (Standard) */}
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 mb-2">
                                <span>{date}, {time}</span>
                            </div>

                            {/* 2. Highlighted Meeting Time & Date */}
                            {isMeeting && (
                                <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg inline-flex border border-indigo-100 mb-2">
                                    <FaVideo />
                                    <span className="text-indigo-400">| Meeting Timings</span>
                                    <span>{displayMeetingTime}</span>
                                </div>
                            )}
                        </div>

                        {/* RIGHT SIDE: CHAT BUTTON + COUNTDOWN */}
                        <div className="flex flex-col items-end gap-2">
                            {/* ✅ COUNTDOWN TIMER (Disappears after 20 mins) */}
                            {isMeeting && countdownString && (
                                <div className={`text-[10px] font-bold px-2 py-1 rounded-md shadow-sm border animate-in slide-in-from-right-2 ${isMeetingStarted ? 'bg-red-50 text-red-600 border-red-100 animate-pulse' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                    <span className="flex items-center gap-1">
                                        <FaClock className="text-[9px]" /> {countdownString}
                                    </span>
                                </div>
                            )}

                            <button 
                                onClick={() => openChatModal(notice)}
                                className="relative flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100"
                            >
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
                    
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{notice.description}</p>
                    
                    {/* ✅ JOIN MEETING BUTTON (Uses Dynamic Link) */}
                    {isMeeting && detectedLink && (
                         <div className="mt-5">
                             <a 
                                href={detectedLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 w-full sm:w-auto justify-center"
                             >
                                <FaVideo className="animate-pulse" /> Join Meeting Now
                             </a>
                         </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHAT POPUP */}
      {isChatOpen && activeNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl h-[85vh] rounded-xl shadow-2xl flex flex-col relative overflow-hidden border border-gray-200">
                {/* HEADER */}
                <div className="sticky top-0 bg-[#464775] text-white p-4 flex justify-between items-center z-20 shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                            <FaComments className="text-white" />
                        </div>
                        <div className="max-w-md">
                            <h3 className="font-bold text-sm">Discussion: {activeNotice.title}</h3>
                            <p className="text-xs text-gray-300 truncate">
                                {activeNotice.replies?.length || 0} messages • Announcement chat
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsChatOpen(false)} 
                            className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors"
                        >
                            <FaTimes />
                        </button>
                    </div>
                </div>

                {/* MESSAGES */}
                <div className="flex-1 flex flex-col bg-[#f3f2f1] overflow-hidden relative">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="p-4 space-y-3 min-h-full flex flex-col justify-end pb-4">
                            {(!activeNotice.replies || activeNotice.replies.length === 0) ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm italic py-20">
                                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                                        <FaComments className="text-gray-400 text-2xl" />
                                    </div>
                                    <p>No messages yet</p>
                                    <p className="text-xs mt-1">Start a conversation with Admin</p>
                                </div>
                            ) : (
                                activeNotice.replies.map((reply, i) => {
                                    const isMe = reply.sentBy === 'Employee';
                                    
                                    // ✅ SMART IMAGE RENDERING to Prevent Flash
                                    let imageSrc = reply.image;
                                    const isLastMessage = i === activeNotice.replies.length - 1;
                                    if (isMe && isLastMessage && !reply.isSending && lastUploadedImageRef.current) {
                                        if (Date.now() - lastUploadedImageRef.current.timestamp < 30000) {
                                            imageSrc = lastUploadedImageRef.current.url;
                                        }
                                    }

                                    return (
                                        <div key={reply._id || i} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] p-3 rounded-lg ${isMe ? 'rounded-br-none' : 'rounded-bl-none'}`}>
                                                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                    <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                                                        <span className="text-xs font-semibold text-gray-700">
                                                            {isMe ? 'You' : 'Admin'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500">
                                                            {formatDateTime(reply.repliedAt).time}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className={`relative group ${isMe ? 'ml-auto' : ''}`}>
                                                        <div className={`p-3 rounded-lg shadow-sm ${isMe 
                                                            ? 'bg-[#6264a7] text-white' 
                                                            : 'bg-white text-gray-800 border border-gray-200'
                                                        }`}>
                                                            {/* ✅ DISPLAY IMAGE (With Loading & Flash Prevention) */}
                                                            {imageSrc && (
                                                              <div className="mb-2 relative cursor-pointer" onClick={() => !reply.isSending && setPreviewImage(imageSrc)}>
                                                                <img 
                                                                  src={imageSrc} 
                                                                  alt="attachment" 
                                                                  className={`rounded-lg max-w-full max-h-60 object-cover border border-black/10 ${reply.isSending ? 'opacity-70' : ''}`}
                                                                />
                                                                
                                                                {/* ✅ SPINNER OVERLAY FOR UPLOADING IMAGE */}
                                                                {reply.isSending && (
                                                                   <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                                                                       <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                                   </div>
                                                                )}
                                                              </div>
                                                            )}
                                                            {reply.message && <p className="text-sm leading-relaxed break-words">{reply.message}</p>}
                                                        </div>
                                                        {isMe && !reply.isSending && (
                                                            <button 
                                                                onClick={() => handleDeleteReply(activeNotice._id, reply._id)} 
                                                                className="absolute -right-2 -top-2 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center text-gray-500 hover:text-red-500 hover:border-red-300 shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200"
                                                                title="Delete message"
                                                            >
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

                    {/* ✅ FOOTER WITH STICKY SUGGESTIONS & INPUT */}
                    <div className="sticky bottom-0 bg-white border-t border-gray-200 z-30 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                        
                        {/* 🔹 IMAGE PREVIEW AREA */}
                        {selectedFile && (
                          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                             <div className="relative w-12 h-12 border border-gray-300 rounded-lg overflow-hidden bg-white">
                                <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-full h-full object-cover" />
                             </div>
                             <div className="flex-1 overflow-hidden">
                                <p className="text-xs font-semibold text-gray-700 truncate">{selectedFile.name}</p>
                                <p className="text-[10px] text-gray-500">{(selectedFile.size/1024).toFixed(1)} KB</p>
                             </div>
                             <button onClick={clearSelectedFile} className="text-gray-400 hover:text-red-500">
                                <FaTimes />
                             </button>
                          </div>
                        )}

                        {/* 🔹 AI SUGGESTIONS ROW */}
                        <div className="px-4 pt-3 pb-1 flex items-center gap-2 overflow-x-auto no-scrollbar">
                             <div className="flex items-center gap-1.5 text-[#6264a7] text-xs font-bold mr-2 shrink-0">
                                <FaRobot /> AI Suggestions:
                             </div>
                             
                             {aiSuggestions.map((sugg, idx) => (
                                <div key={idx} className="group relative shrink-0">
                                    <div className="bg-white border border-[#e0e0e0] hover:border-[#6264a7] rounded-full px-4 py-1.5 text-xs text-gray-600 font-medium shadow-sm transition-all cursor-pointer group-hover:opacity-0">
                                        {sugg}
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-between gap-1 bg-[#6264a7] rounded-full px-2 opacity-0 group-hover:opacity-100 transition-all shadow-md">
                                        <button 
                                            onClick={() => setReplyText(sugg)}
                                            className="flex-1 text-white text-[10px] font-bold flex items-center justify-center hover:bg-white/20 rounded py-1 px-2"
                                        >
                                           <FaPen />
                                        </button>
                                        <div className="w-px h-3 bg-white/30"></div>
                                        <button 
                                            onClick={() => handleSendReply(sugg)}
                                            className="flex-1 text-white text-[10px] font-bold flex items-center justify-center hover:bg-white/20 rounded py-1 px-2"
                                        >
                                           <FaPaperPlane />
                                        </button>
                                    </div>
                                </div>
                             ))}
                        </div>

                        {/* 🔹 INPUT AREA */}
                        <div className="p-4 pt-2">
                            <div className="flex items-center gap-3">
                                {/* IMAGE UPLOAD BUTTON */}
                                <input 
                                  type="file" 
                                  ref={fileInputRef} 
                                  onChange={handleFileSelect} 
                                  accept="image/*" 
                                  className="hidden" 
                                />
                                <button 
                                  onClick={() => fileInputRef.current.click()}
                                  className={`p-3 rounded-lg border border-gray-300 text-gray-500 hover:text-[#6264a7] hover:bg-gray-50 transition-colors ${selectedFile ? 'text-[#6264a7] bg-blue-50 border-blue-200' : ''}`}
                                  title="Attach Image"
                                >
                                  <FaPaperclip />
                                </button>

                                <div className="flex-1 bg-[#f3f2f1] border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#6264a7]/30 focus-within:border-[#6264a7] transition-all">
                                    <input 
                                        className="w-full p-3 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-500"
                                        placeholder="Type a new message..."
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                                    />
                                </div>
                                <button 
                                    onClick={() => handleSendReply()} 
                                    disabled={sendingReply || (!replyText.trim() && !selectedFile)}
                                    className={`p-3 rounded-lg flex items-center justify-center transition-all duration-200 min-w-[44px] ${
                                        sendingReply || (!replyText.trim() && !selectedFile)
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-[#6264a7] hover:bg-[#585a96] text-white shadow-sm hover:shadow'
                                    }`}
                                >
                                    {sendingReply ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <FaPaperPlane className="text-sm" />
                                    )}
                                </button>
                            </div>
                            <div className="flex justify-between items-center mt-2 px-1">
                                <span className="text-xs text-gray-500">
                                    {activeNotice.replies?.length || 0} {activeNotice.replies?.length === 1 ? 'message' : 'messages'}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                    Press Enter to send
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* ✅ LIGHTBOX / FULL SCREEN IMAGE POPUP */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[150] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 rounded-full bg-white/10 backdrop-blur-sm">
             <FaTimes size={24} />
          </button>
          <img 
            src={previewImage} 
            alt="Full Preview" 
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default NoticeList;