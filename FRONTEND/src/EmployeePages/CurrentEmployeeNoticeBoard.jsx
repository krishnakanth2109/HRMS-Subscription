import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
import { AuthContext } from "../context/AuthContext"; 
import api from "../api"; 
import { FaPaperPlane, FaTrash, FaComments, FaTimes } from "react-icons/fa";

const NoticeList = () => {
  const [notices, setNotices] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  const { user } = useContext(AuthContext);
  const currentUserId = user?._id || user?.id;

  // Chat Modal State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeNotice, setActiveNotice] = useState(null); 
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  
  // Auto-scroll to bottom of chat
  const messagesEndRef = useRef(null);

  // ✅ REF TO TRACK NEWLY READ NOTICES
  // This holds IDs of notices that are "unread" in the UI for the 5-second grace period
  const newlyReadIdsRef = useRef(new Set());

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
                  // Manually filter out current user from readBy so UI thinks it's unread
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
      
      // Trigger auto-read logic (Pass ORIGINAL sortedData to check real DB state)
      autoMarkAsRead(sortedData);
      
      // Update Active Chat Window Silently
      if (activeNotice) {
        const updatedActive = sortedData.find(n => n._id === activeNotice._id);
        if (updatedActive && JSON.stringify(updatedActive.replies) !== JSON.stringify(activeNotice.replies)) {
           setActiveNotice(updatedActive);
        }
      }
    } catch (err) {
      console.error("Error fetching notices:", err);
    } finally {
      if (!silent) setIsInitialLoading(false);
    }
  }, [activeNotice, currentUserId]); 

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

  // Auto-scroll
  useEffect(() => {
    if (isChatOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeNotice?.replies?.length, isChatOpen]);

  // ✅ UPDATED AUTO MARK LOGIC (Immediate API + Delayed UI)
  const autoMarkAsRead = async (fetchedNotices) => {
    if (!currentUserId) return;

    const unreadNotices = fetchedNotices.filter(notice => {
      const isRead = notice.readBy && notice.readBy.some(record => {
        const rId = typeof record.employeeId === 'object' ? record.employeeId._id : record.employeeId;
        return rId === currentUserId;
      });
      // Only process if unread AND not already in our grace period tracker
      return !isRead && !newlyReadIdsRef.current.has(notice._id);
    });

    if (unreadNotices.length === 0) return;

    // 1. Add to Ref to keep them colored in UI immediately
    unreadNotices.forEach(n => newlyReadIdsRef.current.add(n._id));

    try {
      // 2. API call fire-and-forget (Updates DB Instantly)
      Promise.all(unreadNotices.map(n => api.put(`/api/notices/${n._id}/read`))).catch(e => console.error(e));

      // 3. Remove from Ref after 5 seconds to turn UI Gray
      setTimeout(() => {
        let changed = false;
        unreadNotices.forEach(n => {
            if (newlyReadIdsRef.current.has(n._id)) {
                newlyReadIdsRef.current.delete(n._id);
                changed = true;
            }
        });
        // Trigger a silent update to reflect the change to Gray
        if(changed) fetchNotices(true);
      }, 5000);

    } catch (error) { 
      console.error("Error auto-marking notices:", error); 
    }
  };

  const handleSendReply = async () => {
    if (!replyText || !replyText.trim()) return;
    
    // Optimistic Update
    const tempId = Date.now();
    const optimisticReply = {
        _id: tempId,
        message: replyText,
        sentBy: 'Employee',
        repliedAt: new Date().toISOString()
    };
    
    setReplyText("");
    
    setActiveNotice(prev => ({
        ...prev,
        replies: [...(prev.replies || []), optimisticReply]
    }));

    setSendingReply(true);
    
    try {
      await api.post(`/api/notices/${activeNotice._id}/reply`, { message: replyText });
      fetchNotices(true); 
    } catch (error) { 
        alert("Failed to send reply"); 
    } finally { 
        setSendingReply(false); 
    }
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
  };

  const formatDateTime = (dateString) => {
    const d = new Date(dateString);
    return { date: d.toLocaleDateString(), time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
  };

  if (isInitialLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] overflow-hidden relative font-sans">
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

        <div className="space-y-5">
          {notices.map((notice, index) => {
            const { date, time } = formatDateTime(notice.date);
            
            // Check read status (This uses the processed data from fetchNotices)
            // So if it's in grace period, the user ID is filtered out, making isRead = false
            const isRead = notice.readBy && notice.readBy.some(record => {
              const rId = typeof record.employeeId === 'object' ? record.employeeId._id : record.employeeId;
              return rId === currentUserId;
            });

            // Check if last reply was from Admin
            const replies = notice.replies || [];
            const lastReply = replies.length > 0 ? replies[replies.length - 1] : null;
            const hasAdminReply = lastReply && lastReply.sentBy === 'Admin';

            return (
              <div key={notice._id} className="group relative bg-white/90 backdrop-blur-md rounded-2xl p-6 transition-all hover:shadow-xl border border-slate-100">
                <div className="flex flex-col md:flex-row gap-5">
                  
                  {/* --- Left Icon Column --- */}
                  <div className="hidden md:flex flex-col items-center">
                    <div 
                      className={`p-3 rounded-2xl shadow-lg transition-colors duration-1000 ${
                        isRead 
                        ? 'bg-slate-100 text-slate-400 border border-slate-200' // Read: Gray
                        : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white animate-pulse' // Unread: Colored
                      }`}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                    </div>
                    <div className="h-full w-0.5 bg-slate-100 mt-4 rounded-full"></div>
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">{notice.title}</h3>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 mb-3"><span>{date}, {time}</span></div>
                        </div>
                        
                        <button 
                            onClick={() => openChatModal(notice)}
                            className="relative flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100"
                        >
                            <FaComments /> Chat with Admin
                            {hasAdminReply && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                                </span>
                            )}
                        </button>
                    </div>
                    
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{notice.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHAT POPUP */}
         {/* CHAT POPUP - TEAMS THEME (PROPER CHRONOLOGICAL ORDER) */}
      {isChatOpen && activeNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl h-[85vh] rounded-xl shadow-2xl flex flex-col relative overflow-hidden border border-gray-200">
                {/* TEAMS-STYLE HEADER - STICKY */}
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

                {/* SCROLLABLE MESSAGE AREA - PROPER CHRONOLOGICAL ORDER */}
                <div className="flex-1 flex flex-col bg-[#f3f2f1] overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="p-4 space-y-3 min-h-full flex flex-col justify-end">
                            {(!activeNotice.replies || activeNotice.replies.length === 0) ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm italic py-20">
                                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                                        <FaComments className="text-gray-400 text-2xl" />
                                    </div>
                                    <p>No messages yet</p>
                                    <p className="text-xs mt-1">Start a conversation with Admin</p>
                                </div>
                            ) : (
                                // Display messages in chronological order (oldest to newest)
                                activeNotice.replies.map((reply, i) => {
                                    const isMe = reply.sentBy === 'Employee';
                                    
                                    return (
                                        <div key={reply._id || i} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] p-3 rounded-lg ${isMe ? 'rounded-br-none' : 'rounded-bl-none'}`}>
                                                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                    {/* SENDER AND TIME */}
                                                    <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                                                        <span className="text-xs font-semibold text-gray-700">
                                                            {isMe ? 'You' : 'Admin'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500">
                                                            {formatDateTime(reply.repliedAt).time}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* MESSAGE BUBBLE */}
                                                    <div className={`relative group ${isMe ? 'ml-auto' : ''}`}>
                                                        <div className={`p-3 rounded-lg shadow-sm ${isMe 
                                                            ? 'bg-[#6264a7] text-white' 
                                                            : 'bg-white text-gray-800 border border-gray-200'
                                                        }`}>
                                                            <p className="text-sm leading-relaxed break-words">{reply.message}</p>
                                                        </div>
                                                        
                                                        {/* DELETE BUTTON (only for own messages) */}
                                                        {isMe && (
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

                    {/* MESSAGE INPUT - TEAMS STYLE */}
                    <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 z-10">
                        <div className="flex items-center gap-3">
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
                                onClick={handleSendReply} 
                                disabled={sendingReply || !replyText.trim()}
                                className={`p-3 rounded-lg flex items-center justify-center transition-all duration-200 min-w-[44px] ${
                                    sendingReply || !replyText.trim()
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
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default NoticeList;