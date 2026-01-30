import React, { useState, useEffect, useContext, useRef, useCallback, useMemo } from "react";
import { AuthContext } from "../context/AuthContext";
import api, { getEmployees } from "../api";
import { motion } from "framer-motion";
import EmojiPicker from 'emoji-picker-react';
import toast, { Toaster } from 'react-hot-toast';
import { 
  FaSearch, FaCircle, FaUsers, FaPaperPlane, FaSmile, FaSpinner, 
  FaEllipsisV, FaRegEdit, FaRegTrashAlt, FaTimes, FaComments,
  FaPhone, FaVideo, FaEllipsisH, FaCheckDouble, FaCheck, FaEye,
  FaUserFriends, FaCommentDots, FaTrash, FaPen, FaChevronDown, FaChevronUp
} from "react-icons/fa";

const ConnectWithEmployee = () => {
  const { user } = useContext(AuthContext);
  const currentUserId = user?._id || user?.id;

  // States
  const [employees, setEmployees] = useState([]);
  const [chatList, setChatList] = useState([]);
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [directMessages, setDirectMessages] = useState([]);
  const [directMsgText, setDirectMsgText] = useState("");
  const [directSearchTerm, setDirectSearchTerm] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Message states
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isListLoading, setIsListLoading] = useState(true);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isSwitchingUser, setIsSwitchingUser] = useState(false);

  // Unread counts
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  // Refs
  const directChatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const sidebarContainerRef = useRef(null);
  const pollRef = useRef(null);

  // ✅ FIX SCROLL: Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (!isChatLoading && !isSwitchingUser && directChatEndRef.current) {
      setTimeout(() => {
        directChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [directMessages, isChatLoading, isSwitchingUser]);

  // ✅ Handle user switching
  const handleUserSwitch = useCallback(async (emp) => {
    if (selectedChatUser?._id === emp._id || isSwitchingUser) return;
    
    setIsSwitchingUser(true);
    setSelectedChatUser(emp);
    setDirectSearchTerm("");
    setEditingMessageId(null);
    setDirectMsgText("");
    setOpenMenuId(null);
    
    // Clear current messages while loading new ones
    setDirectMessages([]);
    
    // Mark messages as read when opening chat
    await markMessagesAsRead(emp._id);
    
    // Fetch messages for the selected user
    await fetchDirectMessages(emp, false);
    
    // Optimistically add to chat list if not present
    setChatList(prev => {
      if (prev.find(u => u._id === emp._id)) return prev;
      return [emp, ...prev];
    });
    
    setIsSwitchingUser(false);
  }, [selectedChatUser, isSwitchingUser]);

  // ✅ DATE GROUPING LOGIC
  const formatMessageDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const groupedMessages = useMemo(() => {
    const groups = {};
    directMessages.forEach((msg) => {
      const dateKey = formatMessageDate(msg.createdAt);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(msg);
    });
    return groups;
  }, [directMessages]);

  // ✅ SEARCH & SORT LOGIC
  const displayList = useMemo(() => {
    const term = directSearchTerm.toLowerCase();
    let list = directSearchTerm 
      ? employees.filter(e => 
          e._id !== currentUserId && 
          (e.name?.toLowerCase().includes(term) || e.employeeId?.toLowerCase().includes(term))
        )
      : chatList;
    
    return [...list].sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));
  }, [directSearchTerm, chatList, employees, currentUserId]);

  // ✅ FETCH CHAT LIST WITH UNREAD COUNTS
  const fetchChatList = useCallback(async () => {
    try {
      const { data } = await api.get("/api/chat/users");
      setChatList(data || []);
      
      // Calculate total unread
      const total = data.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0);
      setTotalUnreadCount(total);
    } catch (err) {
      console.error("Failed to fetch chat list:", err);
    } finally { 
      setIsListLoading(false); 
    }
  }, []);

  // ✅ FETCH EMPLOYEES
  const fetchEmployees = useCallback(async () => {
    try {
      const data = await getEmployees();
      setEmployees(data.filter(e => e.isActive !== false && e._id !== currentUserId));
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    }
  }, [currentUserId]);

  // ✅ FETCH DIRECT MESSAGES
  const fetchDirectMessages = useCallback(async (userToFetch, isSilent = true) => {
    if (!userToFetch || document.visibilityState === 'hidden') return;
    
    if (!isSilent) {
      setIsChatLoading(true);
      setDirectMessages([]);
    }
    
    try {
      const { data } = await api.get(`/api/chat/history/${userToFetch._id}`);
      if (selectedChatUser?._id === userToFetch._id) {
        setDirectMessages(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      toast.error("Failed to load messages");
    } finally {
      setIsChatLoading(false);
    }
  }, [selectedChatUser]);

  // ✅ MARK MESSAGES AS READ
  const markMessagesAsRead = useCallback(async (senderId) => {
    if (!senderId || !currentUserId) return;
    
    try {
      await api.put(`/api/chat/read/${senderId}`);
      
      setChatList(prev => prev.map(u => 
        u._id === senderId ? { ...u, unreadCount: 0 } : u
      ));
      
      setTotalUnreadCount(prev => {
        const user = chatList.find(u => u._id === senderId);
        return user ? Math.max(0, prev - (user.unreadCount || 0)) : prev;
      });
    } catch (err) {
      console.error("Failed to mark messages as read:", err);
    }
  }, [chatList, currentUserId]);

  // ✅ INITIAL DATA LOADING
  useEffect(() => {
    const loadData = async () => {
      await fetchEmployees();
      await fetchChatList();
    };
    
    loadData();
    
    pollRef.current = setInterval(() => {
      fetchChatList();
      if (selectedChatUser && !isSwitchingUser) {
        fetchDirectMessages(selectedChatUser, true);
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchEmployees, fetchChatList, fetchDirectMessages, selectedChatUser, isSwitchingUser]);

  // ✅ SEND MESSAGE
  const handleSendMessage = useCallback(async () => {
    if (!directMsgText.trim() || !selectedChatUser || sendingMessage) return;

    const messageToSend = directMsgText.trim();
    setDirectMsgText("");
    setShowEmojiPicker(false);
    setSendingMessage(true);

    // Optimistic update
    const tempId = Date.now().toString();
    const optimisticMsg = {
      _id: tempId,
      message: messageToSend,
      sender: { _id: currentUserId, name: user?.name },
      receiver: selectedChatUser._id,
      createdAt: new Date().toISOString(),
      isPending: true,
      isRead: false,
      isSending: true
    };

    setDirectMessages(prev => [...prev, optimisticMsg]);

    // Move user to top of list
    setChatList(prev => {
      const filtered = prev.filter(u => u._id !== selectedChatUser._id);
      return [{...selectedChatUser, lastMessage: messageToSend, lastMessageTime: new Date()}, ...filtered];
    });

    try {
      if (editingMessageId) {
        await api.put(`/api/chat/${editingMessageId}`, { message: messageToSend });
        setEditingMessageId(null);
        setDirectMessages(prev => prev.filter(m => m._id !== tempId));
        fetchDirectMessages(selectedChatUser);
      } else {
        await api.post('/api/chat/send', {
          receiverId: selectedChatUser._id,
          message: messageToSend
        });
        
        setDirectMessages(prev => 
          prev.map(msg => 
            msg._id === tempId ? { ...msg, isSending: false } : msg
          )
        );
        
        fetchDirectMessages(selectedChatUser, true);
      }
      
      toast.success(editingMessageId ? "Message updated" : "Message sent");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
      setDirectMessages(prev => prev.filter(m => m._id !== tempId));
    } finally {
      setSendingMessage(false);
    }
  }, [directMsgText, selectedChatUser, sendingMessage, editingMessageId, currentUserId, user, fetchDirectMessages]);

  // ✅ START EDITING MESSAGE
  const startEditing = useCallback((msg) => {
    setEditingMessageId(msg._id);
    setDirectMsgText(msg.message);
    setOpenMenuId(null);
  }, []);

  // ✅ DELETE MESSAGE
  const handleDeleteMessage = useCallback(async (msgId) => {
    if (!window.confirm("Delete this message?")) return;
    
    setDirectMessages(prev => prev.filter(m => m._id !== msgId));
    setOpenMenuId(null);

    try {
      await api.delete(`/api/chat/${msgId}`);
      toast.success("Message deleted");
    } catch (error) {
      console.error("Failed to delete message:", error);
      toast.error("Failed to delete message");
    }
  }, []);

  // ✅ EMOJI PICKER
  const handleEmojiClick = (emojiData) => {
    setDirectMsgText(prev => prev + emojiData.emoji);
  };

  // ✅ KEYBOARD SHORTCUTS
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    if (e.key === 'Escape') {
      if (editingMessageId) {
        setEditingMessageId(null);
        setDirectMsgText("");
      }
      if (showEmojiPicker) {
        setShowEmojiPicker(false);
      }
    }
  }, [handleSendMessage, editingMessageId, showEmojiPicker]);

  // ✅ CLOSE MENUS WHEN CLICKING ELSEWHERE
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openMenuId]);

  return (
    <div className="flex w-full h-screen bg-white font-sans">
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: '#363636',
            color: '#fff',
            fontSize: '12px',
            padding: '8px 16px',
          },
        }}
      />

      {/* ✅ SIDEBAR WITH FIXED HEADER */}
      <div className="w-80 flex flex-col border-r border-gray-200 bg-white h-full">
        {/* FIXED Sidebar Header - Always Visible */}
        <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <FaCommentDots className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Employee Connect</h2>
                <p className="text-blue-100 text-xs opacity-80">Chat with colleagues</p>
              </div>
            </div>
            {totalUnreadCount > 0 && (
              <span className="bg-green-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full animate-pulse">
                {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
              </span>
            )}
          </div>
          
          <div className="relative group">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-200 group-focus-within:text-white transition-colors" size={14}/>
            <input 
              className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm outline-none placeholder:text-blue-100 text-white focus:bg-white/15 focus:border-white/30 transition-all"
              placeholder="Search colleagues..."
              value={directSearchTerm}
              onChange={(e) => setDirectSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Scrollable Contacts List */}
        <div 
          ref={sidebarContainerRef}
          className="flex-1 overflow-y-auto"
          style={{ minHeight: 0 }}
        >
          <div className="px-3 py-2">
            {isListLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 py-8">
                <FaSpinner className="animate-spin" size={20} />
                <span className="text-xs font-semibold uppercase tracking-widest">Loading contacts...</span>
              </div>
            ) : displayList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4 text-center py-8">
                <FaUsers className="text-gray-300 mb-2" size={32} />
                <p className="text-sm font-semibold text-gray-500">No contacts found</p>
                <p className="text-xs text-gray-400 mt-1">Try searching for a colleague</p>
              </div>
            ) : (
              displayList.map((emp) => {
                const isActive = selectedChatUser?._id === emp._id;
                const unreadCount = emp.unreadCount || 0;
                
                return (
                  <div 
                    key={emp._id} 
                    onClick={() => handleUserSwitch(emp)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-2xl cursor-pointer mb-1.5 transition-all duration-200 ${
                      isActive 
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200" 
                        : "hover:bg-gray-50 hover:shadow-md"
                    } ${isSwitchingUser ? "pointer-events-none opacity-70" : ""}`}
                  >
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0 ${
                        isActive 
                          ? "bg-white/20 border-2 border-white/30" 
                          : "bg-gradient-to-tr from-blue-500 to-indigo-500 text-white border-2 border-white"
                      }`}>
                        {emp.name?.charAt(0)}
                      </div>
                      {/* <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                        emp.isOnline ? 'bg-green-500' : 'bg-gray-400'
                      }`}></div> */}
                    </div>
                    
                    <div className="flex-1 overflow-hidden min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <p className={`text-sm font-bold truncate ${isActive ? "text-white" : "text-gray-800"}`}>
                          {emp.name}
                        </p>
                        <span className={`text-xs font-medium ${isActive ? "text-blue-100" : "text-gray-500"}`}>
                          {emp.lastMessageTime ? new Date(emp.lastMessageTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ""}
                        </span>
                      </div>
                      <p className={`text-xs truncate font-medium ${isActive ? "text-blue-100 opacity-90" : "text-gray-500"}`}>
                        {emp.lastMessage || emp.employeeId || emp.role || "No messages yet"}
                      </p>
                    </div>
                    
                    {unreadCount > 0 && !isActive && (
                      <span className="bg-green-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ✅ CHAT AREA WITH PROPER LAYOUT */}
      <div className="flex-1 flex flex-col h-full bg-gray-50 relative">
        {selectedChatUser ? (
          <>
            {/* FIXED Chat Header - Always Visible */}
            <header className="h-16 flex items-center justify-between px-6 border-b border-gray-200 bg-white shadow-sm z-30 flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center justify-center rounded-full font-bold text-lg shadow-md">
                    {selectedChatUser.name?.charAt(0)}
                  </div>
                  {/* <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div> */}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">{selectedChatUser.name}</h3>
                  <div className="flex items-center gap-2">
                    {/* <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> */}
                    {/* <span className="text-xs font-medium text-gray-500">
                      {selectedChatUser.isOnline ? "Online • Active now" : "Last seen recently"}
                    </span> */}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Voice call">
                  <FaPhone size={16} />
                </button>
                <button className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Video call">
                  <FaVideo size={16} />
                </button>
                <button className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
                  <FaEllipsisH size={16} />
                </button>
              </div>
            </header>

            {/* SCROLLABLE MESSAGES AREA - Between Header and Input */}
            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto bg-gray-50"
              style={{ minHeight: 0 }}
            >
              {isSwitchingUser || isChatLoading ? (
                <div className="flex flex-col items-center justify-center h-full bg-white/80 backdrop-blur-sm">
                  <FaSpinner className="text-blue-600 animate-spin mb-3" size={30} />
                  <p className="text-sm font-semibold text-gray-700">
                    {isSwitchingUser ? "Switching conversation..." : "Loading messages..."}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Please wait while we fetch your conversation
                  </p>
                </div>
              ) : directMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <FaComments className="text-gray-300" size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-600">Start a conversation</h3>
                  <p className="text-sm text-gray-500 mt-1">Send a message to {selectedChatUser.name}</p>
                </div>
              ) : (
                <div className="p-6">
                  {Object.entries(groupedMessages).map(([date, msgs]) => (
                    <div key={date} className="mb-6">
                      <div className="flex justify-center my-6">
                        <span className="bg-gray-200 text-gray-600 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                          {date}
                        </span>
                      </div>
                      
                      {msgs.map((msg, index) => {
                        const isMe = msg.sender?._id === currentUserId || msg.sender === currentUserId;
                        const isMenuOpen = openMenuId === msg._id;
                        const isPending = msg.isPending || msg.isSending;
                        
                        return (
                          <div 
                            key={msg._id || index} 
                            className={`flex w-full mb-4 ${isMe ? "justify-end" : "justify-start"}`}
                          >
                            <div className={`max-w-[70%] group relative ${isMe ? "ml-auto" : ""}`}>
                              <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                {/* Sender name */}
                                {!isMe && (
                                  <span className="text-xs font-semibold text-gray-600 mb-1 px-2">
                                    {msg.sender?.name || selectedChatUser.name}
                                  </span>
                                )}
                                
                                {/* Message bubble */}
                                <div className="relative">
                                  <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                                    isMe 
                                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-br-md" 
                                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-md"
                                  } ${isPending ? "opacity-80" : ""}`}>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                      {msg.message}
                                    </p>
                                    
                                    {/* Message time and status */}
                                    <div className={`flex items-center justify-end gap-2 mt-2 ${
                                      isMe ? "text-blue-100" : "text-gray-500"
                                    }`}>
                                      <span className="text-xs">
                                        {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      </span>
                                      
                                      {/* Message status indicators */}
                                      {isMe && (
                                        <>
                                          {isPending ? (
                                            <span className="text-xs opacity-70">Sending...</span>
                                          ) : (
                                            <FaCheckDouble 
                                              className={`text-xs ${msg.isRead ? "text-green-300" : "opacity-60"}`} 
                                              title={msg.isRead ? "Read" : "Delivered"}
                                            />
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Edit/Delete menu (only for sender's messages) */}
                                  {isMe && !isPending && (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOpenMenuId(isMenuOpen ? null : msg._id);
                                        }}
                                        className={`absolute -top-2 ${isMe ? "-left-2" : "-right-2"} w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50 hover:text-blue-600 z-10`}
                                      >
                                        <FaEllipsisV size={10} />
                                      </button>
                                      
                                      {/* Dropdown menu */}
                                      {isMenuOpen && (
                                        <div className={`absolute ${isMe ? "left-0" : "right-0"} top-6 bg-white border border-gray-100 shadow-xl rounded-lg py-1.5 z-50 w-32 overflow-hidden animate-in fade-in zoom-in duration-200`}>
                                          <button
                                            onClick={() => startEditing(msg)}
                                            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                          >
                                            <FaPen size={10} /> Edit
                                          </button>
                                          <button
                                            onClick={() => handleDeleteMessage(msg._id)}
                                            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                                          >
                                            <FaTrash size={10} /> Delete
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div ref={directChatEndRef} />
                </div>
              )}
            </div>

            {/* FIXED MESSAGE INPUT AREA - Always at Bottom */}
            <footer className="p-4 bg-white border-t border-gray-200 shadow-lg flex-shrink-0">
              {editingMessageId && (
                <div className="max-w-4xl mx-auto mb-3 flex items-center justify-between bg-blue-50 px-4 py-2.5 rounded-xl border border-blue-100 animate-in slide-in-from-top duration-300">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-1.5 rounded-lg text-white">
                      <FaRegEdit size={12} />
                    </div>
                    <span className="text-xs font-bold text-blue-800 tracking-tight">
                      Editing message...
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setEditingMessageId(null);
                      setDirectMsgText("");
                    }}
                    className="bg-white p-1 rounded-full shadow-sm text-blue-400 hover:text-blue-600 transition-colors"
                  >
                    <FaTimes size={12} />
                  </button>
                </div>
              )}
              
              <div className="max-w-4xl mx-auto flex items-end gap-3 bg-gray-100 border border-transparent rounded-2xl p-3 focus-within:bg-white focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all duration-300">
                {/* Emoji picker */}
                <div className="relative">
                  {showEmojiPicker && (
                    <div className="absolute bottom-16 left-0 z-50 shadow-2xl rounded-2xl overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-200">
                      <EmojiPicker 
                        onEmojiClick={handleEmojiClick} 
                        width={300} 
                        height={400} 
                        searchDisabled={false}
                        skinTonesDisabled
                        previewConfig={{showPreview: false}}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`p-3 rounded-xl transition-colors ${
                      showEmojiPicker 
                        ? "bg-blue-100 text-blue-600" 
                        : "text-gray-500 hover:text-blue-500 hover:bg-white"
                    }`}
                  >
                    <FaSmile size={20} />
                  </button>
                </div>
                
                {/* Text input */}
                <textarea
                  className="flex-1 bg-transparent outline-none resize-none text-sm py-2.5 px-3 text-gray-800 font-medium placeholder:text-gray-400 min-h-[44px] max-h-32"
                  rows={1}
                  placeholder="Type your message here..."
                  value={directMsgText}
                  onChange={(e) => setDirectMsgText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sendingMessage || isSwitchingUser || isChatLoading}
                />
                
                {/* Send button */}
                <button
                  onClick={handleSendMessage}
                  disabled={!directMsgText.trim() || sendingMessage || isSwitchingUser || isChatLoading}
                  className={`p-3.5 rounded-xl transition-all shadow-md flex items-center justify-center ${
                    directMsgText.trim() && !sendingMessage && !isSwitchingUser && !isChatLoading
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-200 hover:from-blue-700 hover:to-indigo-700 active:scale-95"
                      : "bg-gray-200 text-gray-400 shadow-none cursor-not-allowed"
                  }`}
                >
                  {sendingMessage ? (
                    <FaSpinner className="animate-spin" size={16} />
                  ) : editingMessageId ? (
                    <FaCheck size={16} />
                  ) : (
                    <FaPaperPlane size={16} />
                  )}
                </button>
              </div>
            </footer>
          </>
        ) : (
          // Empty state when no user selected
          <div className="flex flex-1 flex-col items-center justify-center text-gray-400">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center max-w-md text-center p-8"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500/10 to-indigo-600/10 rounded-3xl shadow-xl flex items-center justify-center mb-6 border border-blue-100">
                <FaUsers className="text-blue-500 opacity-60" size={48} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Connect with your team</h3>
              <p className="text-sm text-gray-600 mb-6">
                Select a colleague from the sidebar to start a secure, real-time conversation.
                Chat privately, share updates, and collaborate seamlessly.
              </p>
              
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                    <FaCheck className="text-green-600" size={10} />
                  </div>
                  <span>Real-time messaging</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                    <FaCheck className="text-green-600" size={10} />
                  </div>
                  <span>Read receipts</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                    <FaCheck className="text-green-600" size={10} />
                  </div>
                  <span>Edit & delete messages</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                    <FaCheck className="text-green-600" size={10} />
                  </div>
                  <span>Unread message counts</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* CUSTOM STYLES */}
      <style>{`
        /* Custom scrollbar styling */
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }
        
        .overflow-y-auto::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 10px;
        }
        
        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        
        /* Ensure proper scrolling in flex containers */
        .flex-1 {
          min-height: 0;
        }
        
        /* Animation classes */
        .animate-in {
          animation: animateIn 0.2s ease-out;
        }
        
        @keyframes animateIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .fade-in {
          animation: fadeIn 0.2s ease-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .zoom-in {
          animation: zoomIn 0.2s ease-out;
        }
        
        @keyframes zoomIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .slide-in-from-top {
          animation: slideInFromTop 0.3s ease-out;
        }
        
        @keyframes slideInFromTop {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default ConnectWithEmployee;