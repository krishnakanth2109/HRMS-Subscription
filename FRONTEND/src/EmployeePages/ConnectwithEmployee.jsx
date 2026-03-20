import React, { useState, useEffect, useContext, useRef, useCallback, useMemo } from "react";
import { AuthContext } from "../context/AuthContext";
import api, { getEmployees } from "../api";
import { motion } from "framer-motion";
import EmojiPicker from 'emoji-picker-react';
import toast, { Toaster } from 'react-hot-toast';
import { io } from 'socket.io-client';
import {
  FaSearch, FaUsers, FaPaperPlane, FaSmile, FaSpinner,
  FaEllipsisV, FaRegEdit, FaTimes, FaComments,
  FaEllipsisH, FaCheckDouble, FaCheck,
  FaCommentDots, FaPen, FaTrash,
} from "react-icons/fa";

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ✅ Safe string comparison for MongoDB ObjectIds
// Fixes: strict === failing when one side is ObjectId object, other is plain string
const sameId = (a, b) => a?.toString() === b?.toString();

const ConnectWithEmployee = () => {
  const { user } = useContext(AuthContext);
  const currentUserId = user?._id || user?.id;

  // ── State ──────────────────────────────────────────────────────────────────
  const [employees, setEmployees]               = useState([]);
  const [chatList, setChatList]                 = useState([]);
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [directMessages, setDirectMessages]     = useState([]);
  const [directMsgText, setDirectMsgText]       = useState("");
  const [directSearchTerm, setDirectSearchTerm] = useState("");
  const [showEmojiPicker, setShowEmojiPicker]   = useState(false);
  const [typingUsers, setTypingUsers]           = useState(new Set());
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [openMenuId, setOpenMenuId]             = useState(null);
  const [isListLoading, setIsListLoading]       = useState(true);
  const [isChatLoading, setIsChatLoading]       = useState(false);
  const [sendingMessage, setSendingMessage]     = useState(false);
  const [isSwitchingUser, setIsSwitchingUser]   = useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [socketConnected, setSocketConnected]   = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const directChatEndRef    = useRef(null);
  const chatContainerRef    = useRef(null);
  const sidebarContainerRef = useRef(null);
  const socketRef           = useRef(null);
  const typingTimeoutRef    = useRef(null);

  // ✅ Live refs — socket listeners read these so they never close over stale state
  const selectedChatUserRef = useRef(null);
  const currentUserIdRef    = useRef(null);

  useEffect(() => { selectedChatUserRef.current = selectedChatUser; }, [selectedChatUser]);
  useEffect(() => { currentUserIdRef.current    = currentUserId;    }, [currentUserId]);

  // ─────────────────────────────────────────────────────────────────────────
  // SOCKET INIT
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;

    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("token") || "";

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      auth: { token },
    });

    socketRef.current = socket;

    // ── Connection lifecycle ────────────────────────────────────────────────
    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      setSocketConnected(true);
      // ✅ Always re-authenticate after (re)connect so the room is always joined
      socket.emit('authenticate', currentUserIdRef.current);
    });

    socket.on('authenticated', (data) => {
      console.log('🔐 Socket authenticated, room joined:', `user_${data.userId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      setSocketConnected(false);
    });

    socket.on('connect_error', (e) => {
      console.error('❌ Socket connect error:', e.message);
      setSocketConnected(false);
    });

    // ── RECEIVE MESSAGE ─────────────────────────────────────────────────────
    // ✅ FIX: was using === to compare IDs — ObjectId vs string always fails.
    //         Now using sameId() which calls .toString() on both sides.
    socket.on('receive_message', (msg) => {
      console.log('📨 receive_message event fired:', msg);

      // Normalize sender id — works whether msg.sender is populated obj or raw id
      const senderId   = msg.sender?._id ?? msg.sender;
      const activePeer = selectedChatUserRef.current;

      console.log('  senderId:', senderId?.toString(), '| activePeer:', activePeer?._id?.toString());

      if (activePeer && sameId(senderId, activePeer._id)) {
        // ✅ This chat is open — append message instantly, no refresh needed
        setDirectMessages(prev => {
          // Avoid duplicate if optimistic message already exists for same content
          const alreadyExists = prev.some(m => sameId(m._id, msg._id));
          if (alreadyExists) return prev;
          return [...prev, msg];
        });
        // Mark as read since the window is open
        api.put(`/api/chat/read/${senderId.toString()}`).catch(console.error);
      } else {
        // Different chat — just bump the unread badge
        setChatList(prev => prev.map(u =>
          sameId(u._id, senderId)
            ? { ...u, unreadCount: (u.unreadCount || 0) + 1, lastMessage: msg.message, lastMessageTime: msg.createdAt }
            : u
        ));
        setTotalUnreadCount(c => c + 1);
        playNotificationSound();
      }

      // Always move the sender to the top of the sidebar list
      setChatList(prev => {
        const senderIdStr = senderId?.toString();
        const filtered    = prev.filter(u => u._id?.toString() !== senderIdStr);
        const existing    = prev.find(u => u._id?.toString() === senderIdStr)
          || { _id: senderIdStr, name: msg.sender?.name || "Unknown" };
        return [{
          ...existing,
          lastMessage:     msg.message,
          lastMessageTime: msg.createdAt,
        }, ...filtered];
      });
    });

    // ── Read receipts ───────────────────────────────────────────────────────
    socket.on('messages_read', () => {
      // ✅ Mark all our sent messages in the current chat as read
      setDirectMessages(prev => prev.map(m => {
        const sid = m.sender?._id ?? m.sender;
        return sameId(sid, currentUserIdRef.current) ? { ...m, isRead: true } : m;
      }));
    });

    // ── Edit ────────────────────────────────────────────────────────────────
    socket.on('message_edited', ({ messageId, newMessage }) => {
      setDirectMessages(prev => prev.map(m =>
        sameId(m._id, messageId) ? { ...m, message: newMessage, isEdited: true } : m
      ));
    });

    // ── Delete ──────────────────────────────────────────────────────────────
    socket.on('message_deleted', ({ messageId }) => {
      setDirectMessages(prev => prev.filter(m => !sameId(m._id, messageId)));
    });

    // ── Typing ──────────────────────────────────────────────────────────────
    socket.on('user_typing', ({ userId }) => {
      const activePeer = selectedChatUserRef.current;
      // ✅ FIX: was === , now sameId()
      if (activePeer && sameId(userId, activePeer._id))
        setTypingUsers(prev => new Set([...prev, userId?.toString()]));
    });

    socket.on('user_stopped_typing', ({ userId }) => {
      setTypingUsers(prev => {
        const s = new Set(prev);
        s.delete(userId?.toString());
        return s;
      });
    });

    return () => {
      console.log('🔌 Disconnecting socket');
      socket.disconnect();
    };
  }, [currentUserId]); // ← only re-run if the logged-in user changes

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isChatLoading && !isSwitchingUser && directChatEndRef.current) {
      setTimeout(() => directChatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [directMessages, isChatLoading, isSwitchingUser]);

  // ── Notification sound ───────────────────────────────────────────────────
  const playNotificationSound = () => {
    try {
      const a = new Audio('/notification.mp3');
      a.volume = 0.5;
      a.play().catch(() => {});
    } catch (_) {}
  };

  // ── Typing handler ───────────────────────────────────────────────────────
  const handleTyping = useCallback((text) => {
    setDirectMsgText(text);
    if (!selectedChatUser || !socketRef.current) return;
    if (text.trim()) {
      socketRef.current.emit('typing_start', {
        receiverId: selectedChatUser._id,
        senderId:   currentUserId,
        senderName: user?.name,
      });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit('typing_stop', {
          receiverId: selectedChatUser._id,
          senderId:   currentUserId,
        });
      }, 3000);
    } else {
      clearTimeout(typingTimeoutRef.current);
      socketRef.current.emit('typing_stop', {
        receiverId: selectedChatUser._id,
        senderId:   currentUserId,
      });
    }
  }, [selectedChatUser, currentUserId, user]);

  // ── User switch ──────────────────────────────────────────────────────────
  const handleUserSwitch = useCallback(async (emp) => {
    if (sameId(selectedChatUserRef.current?._id, emp._id) || isSwitchingUser) return;
    setIsSwitchingUser(true);
    setSelectedChatUser(emp);
    setDirectSearchTerm("");
    setEditingMessageId(null);
    setDirectMsgText("");
    setOpenMenuId(null);
    setTypingUsers(new Set());
    setDirectMessages([]);

    await markMessagesAsRead(emp._id);
    await fetchDirectMessages(emp, false);

    setChatList(prev => {
      if (prev.find(u => sameId(u._id, emp._id))) return prev;
      return [emp, ...prev];
    });
    setIsSwitchingUser(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSwitchingUser]);

  // ── Date grouping ────────────────────────────────────────────────────────
  const formatMessageDate = (d) => {
    const date      = new Date(d);
    const today     = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString())     return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const groupedMessages = useMemo(() => {
    const g = {};
    directMessages.forEach(m => {
      const k = formatMessageDate(m.createdAt);
      if (!g[k]) g[k] = [];
      g[k].push(m);
    });
    return g;
  }, [directMessages]);

  // ── Display list ─────────────────────────────────────────────────────────
  const displayList = useMemo(() => {
    const term = directSearchTerm.toLowerCase();
    const base = term
      ? employees.filter(e =>
          !sameId(e._id, currentUserId) &&
          (e.name?.toLowerCase().includes(term) || e.employeeId?.toLowerCase().includes(term))
        )
      : chatList;
    return [...base].sort((a, b) =>
      new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0)
    );
  }, [directSearchTerm, chatList, employees, currentUserId]);

  // ── Data fetchers ────────────────────────────────────────────────────────
  const fetchChatList = useCallback(async () => {
    try {
      const { data } = await api.get("/api/chat/users");
      setChatList(data || []);
      setTotalUnreadCount(data.reduce((a, c) => a + (c.unreadCount || 0), 0));
    } catch (err) {
      console.error("fetchChatList:", err);
    } finally {
      setIsListLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await getEmployees();
      setEmployees(data.filter(e => e.isActive !== false && !sameId(e._id, currentUserId)));
    } catch (err) {
      console.error("fetchEmployees:", err);
    }
  }, [currentUserId]);

  const fetchDirectMessages = useCallback(async (peer, silent = true) => {
    if (!peer) return;
    if (!silent) { setIsChatLoading(true); setDirectMessages([]); }
    try {
      const { data } = await api.get(`/api/chat/history/${peer._id}`);
      // Only set if this peer is still the selected one
      if (sameId(selectedChatUserRef.current?._id, peer._id))
        setDirectMessages(data || []);
    } catch (err) {
      console.error("fetchDirectMessages:", err);
      toast.error("Failed to load messages");
    } finally {
      setIsChatLoading(false);
    }
  }, []);

  const markMessagesAsRead = useCallback(async (senderId) => {
    if (!senderId) return;
    try {
      await api.put(`/api/chat/read/${senderId}`);
      setChatList(prev => prev.map(u => sameId(u._id, senderId) ? { ...u, unreadCount: 0 } : u));
      setTotalUnreadCount(prev => {
        const u = chatList.find(x => sameId(x._id, senderId));
        return u ? Math.max(0, prev - (u.unreadCount || 0)) : prev;
      });
    } catch (err) {
      console.error("markMessagesAsRead:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatList]);

  useEffect(() => {
    fetchEmployees();
    fetchChatList();
  }, [fetchEmployees, fetchChatList]);

  // ── Send message ─────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async () => {
    if (!directMsgText.trim() || !selectedChatUser || sendingMessage) return;

    const messageToSend = directMsgText.trim();
    setDirectMsgText("");
    setShowEmojiPicker(false);
    setSendingMessage(true);

    socketRef.current?.emit('typing_stop', {
      receiverId: selectedChatUser._id,
      senderId:   currentUserId,
    });

    // Optimistic bubble
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      _id:       tempId,
      message:   messageToSend,
      sender:    { _id: currentUserId, name: user?.name },
      receiver:  selectedChatUser._id,
      createdAt: new Date().toISOString(),
      isPending: true,
      isSending: true,
      isRead:    false,
    };
    setDirectMessages(prev => [...prev, optimisticMsg]);

    setChatList(prev => {
      const filtered = prev.filter(u => !sameId(u._id, selectedChatUser._id));
      return [{ ...selectedChatUser, lastMessage: messageToSend, lastMessageTime: new Date().toISOString() }, ...filtered];
    });

    try {
      if (editingMessageId) {
        await api.put(`/api/chat/${editingMessageId}`, { message: messageToSend });
        setEditingMessageId(null);
        setDirectMessages(prev => prev.filter(m => m._id !== tempId));
        fetchDirectMessages(selectedChatUser, true);
      } else {
        const { data } = await api.post('/api/chat/send', {
          receiverId: selectedChatUser._id,
          message:    messageToSend,
        });
        // Replace optimistic bubble with real server response
        setDirectMessages(prev =>
          prev.map(m => m._id === tempId
            ? { ...data, isSending: false, isPending: false }
            : m
          )
        );
      }
    } catch (err) {
      console.error("handleSendMessage:", err);
      if (err.response?.status === 401) {
        toast.error("Session expired — please log in again.");
      } else {
        toast.error("Failed to send message");
      }
      setDirectMessages(prev => prev.filter(m => m._id !== tempId));
    } finally {
      setSendingMessage(false);
    }
  }, [directMsgText, selectedChatUser, sendingMessage, editingMessageId, currentUserId, user, fetchDirectMessages]);

  // ── Edit / Delete ────────────────────────────────────────────────────────
  const startEditing = useCallback((msg) => {
    setEditingMessageId(msg._id);
    setDirectMsgText(msg.message);
    setOpenMenuId(null);
  }, []);

  const handleDeleteMessage = useCallback(async (msgId) => {
    if (!window.confirm("Delete this message?")) return;
    setDirectMessages(prev => prev.filter(m => m._id !== msgId));
    setOpenMenuId(null);
    try {
      await api.delete(`/api/chat/${msgId}`);
      toast.success("Message deleted");
    } catch {
      toast.error("Failed to delete message");
    }
  }, []);

  const handleEmojiClick = (emojiData) =>
    setDirectMsgText(prev => prev + emojiData.emoji);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
    if (e.key === 'Escape') {
      setEditingMessageId(null);
      setDirectMsgText("");
      setShowEmojiPicker(false);
    }
  }, [handleSendMessage]);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    if (openMenuId) document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex w-full h-[calc(100vh-4rem)] bg-white font-sans mt-0">
      <Toaster
        position="top-right"
        toastOptions={{ style: { background: '#363636', color: '#fff', fontSize: '12px', padding: '8px 16px' } }}
      />

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <div className="w-80 flex flex-col border-r border-gray-200 bg-white h-full">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <FaCommentDots className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Employee Connect</h2>
                {/* ✅ Small socket status indicator so you can see if real-time is live */}
                <p className="text-blue-100 text-xs opacity-80 flex items-center gap-1">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                  {socketConnected ? 'Connected' : 'Reconnecting…'}
                </p>
              </div>
            </div>
            {totalUnreadCount > 0 && (
              <span className="bg-green-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full animate-pulse">
                {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
              </span>
            )}
          </div>

          <div className="relative group">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-200 group-focus-within:text-white transition-colors" size={14} />
            <input
              className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm outline-none placeholder:text-blue-100 text-white focus:bg-white/15 focus:border-white/30 transition-all"
              placeholder="Search colleagues..."
              value={directSearchTerm}
              onChange={e => setDirectSearchTerm(e.target.value)}
            />
            {directSearchTerm && (
              <button onClick={() => setDirectSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200 hover:text-white">
                <FaTimes size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Contact list */}
        <div ref={sidebarContainerRef} className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          <div className="px-3 py-2">
            {isListLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 py-8">
                <FaSpinner className="animate-spin" size={20} />
                <span className="text-xs font-semibold uppercase tracking-widest">Loading contacts...</span>
              </div>
            ) : displayList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4 text-center py-8">
                <FaUsers className="text-gray-300 mb-2" size={32} />
                <p className="text-sm font-semibold text-gray-500">
                  {directSearchTerm ? "No employees found" : "No conversations yet"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {directSearchTerm ? "Try a different name" : "Search for a colleague to start chatting"}
                </p>
              </div>
            ) : (
              displayList.map(emp => {
                const isActive    = sameId(selectedChatUser?._id, emp._id);
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
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0 ${
                      isActive
                        ? "bg-white/20 border-2 border-white/30"
                        : "bg-gradient-to-tr from-blue-500 to-indigo-500 text-white border-2 border-white"
                    }`}>
                      {emp.name?.charAt(0)?.toUpperCase()}
                    </div>

                    <div className="flex-1 overflow-hidden min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <p className={`text-sm font-bold truncate ${isActive ? "text-white" : "text-gray-800"}`}>
                          {emp.name}
                        </p>
                        <span className={`text-xs font-medium flex-shrink-0 ml-1 ${isActive ? "text-blue-100" : "text-gray-500"}`}>
                          {emp.lastMessageTime
                            ? new Date(emp.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : ""}
                        </span>
                      </div>
                      <p className={`text-xs truncate font-medium ${isActive ? "text-blue-100 opacity-90" : "text-gray-500"}`}>
                        {emp.lastMessage || emp.employeeId || "No messages yet"}
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

      {/* ── CHAT AREA ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full bg-gray-50 relative">
        {selectedChatUser ? (
          <>
            {/* Chat header */}
            <header className="h-16 flex items-center justify-between px-6 border-b border-gray-200 bg-white shadow-sm z-40 flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center justify-center rounded-full font-bold text-lg shadow-md">
                  {selectedChatUser.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">{selectedChatUser.name}</h3>
                  <div className="flex items-center gap-2">
                    {typingUsers.has(selectedChatUser._id?.toString()) ? (
                      <span className="text-xs text-blue-600 font-medium animate-pulse">typing...</span>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {selectedChatUser.employeeId || selectedChatUser.department || "Employee"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
                <FaEllipsisH size={16} />
              </button>
            </header>

            {/* Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto bg-gray-50" style={{ minHeight: 0 }}>
              {isSwitchingUser || isChatLoading ? (
                <div className="flex flex-col items-center justify-center h-full bg-white/80 backdrop-blur-sm">
                  <FaSpinner className="text-blue-600 animate-spin mb-3" size={30} />
                  <p className="text-sm font-semibold text-gray-700">
                    {isSwitchingUser ? "Switching conversation..." : "Loading messages..."}
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
                    <div key={date}>
                      <div className="flex justify-center my-6">
                        <span className="bg-gray-200 text-gray-600 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                          {date}
                        </span>
                      </div>

                      {msgs.map((msg, index) => {
                        // ✅ FIX: use sameId() not === for sender check
                        const isMe       = sameId(msg.sender?._id ?? msg.sender, currentUserId);
                        const isMenuOpen = openMenuId === msg._id;
                        const isPending  = msg.isPending || msg.isSending;

                        return (
                          <div key={msg._id || index} className={`flex w-full mb-4 ${isMe ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[70%] group relative ${isMe ? "ml-auto" : ""}`}>
                              <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                {!isMe && (
                                  <span className="text-xs font-semibold text-gray-600 mb-1 px-2">
                                    {msg.sender?.name || selectedChatUser.name}
                                  </span>
                                )}

                                <div className="relative">
                                  <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                                    isMe
                                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-br-md"
                                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-md"
                                  } ${isPending ? "opacity-75" : ""}`}>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                      {msg.message}
                                    </p>
                                    {msg.isEdited && (
                                      <span className={`text-xs ${isMe ? "text-blue-200" : "text-gray-400"}`}> · edited</span>
                                    )}

                                    <div className={`flex items-center justify-end gap-2 mt-2 ${isMe ? "text-blue-100" : "text-gray-500"}`}>
                                      <span className="text-xs">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      {isMe && (
                                        isPending
                                          ? <FaSpinner className="animate-spin opacity-60" size={10} />
                                          : <FaCheckDouble
                                              className={`text-xs ${msg.isRead ? "text-green-300" : "opacity-60"}`}
                                              title={msg.isRead ? "Read" : "Delivered"}
                                            />
                                      )}
                                    </div>
                                  </div>

                                  {/* Edit / Delete menu — own messages only */}
                                  {isMe && !isPending && (
                                    <>
                                      <button
                                        onClick={e => {
                                          e.stopPropagation();
                                          setOpenMenuId(isMenuOpen ? null : msg._id);
                                        }}
                                        className="absolute -top-2 -left-2 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50 hover:text-blue-600 z-10"
                                      >
                                        <FaEllipsisV size={10} />
                                      </button>

                                      {isMenuOpen && (
                                        <div
                                          className="absolute left-0 top-6 bg-white border border-gray-100 shadow-xl rounded-lg py-1.5 z-50 w-32 overflow-hidden"
                                          onClick={e => e.stopPropagation()}
                                        >
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

            {/* Input */}
            <footer className="p-4 bg-white border-t border-gray-200 shadow-lg flex-shrink-0">
              {editingMessageId && (
                <div className="max-w-4xl mx-auto mb-3 flex items-center justify-between bg-blue-50 px-4 py-2.5 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-1.5 rounded-lg text-white">
                      <FaRegEdit size={12} />
                    </div>
                    <span className="text-xs font-bold text-blue-800 tracking-tight">Editing message...</span>
                  </div>
                  <button
                    onClick={() => { setEditingMessageId(null); setDirectMsgText(""); }}
                    className="bg-white p-1 rounded-full shadow-sm text-blue-400 hover:text-blue-600 transition-colors"
                  >
                    <FaTimes size={12} />
                  </button>
                </div>
              )}

              <div className="max-w-4xl mx-auto flex items-end gap-3 bg-gray-100 border border-transparent rounded-2xl p-3 focus-within:bg-white focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all duration-300">
                <div className="relative">
                  {showEmojiPicker && (
                    <div className="absolute bottom-16 left-0 z-50 shadow-2xl rounded-2xl overflow-hidden border border-gray-200">
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width={300}
                        height={400}
                        searchDisabled={false}
                        skinTonesDisabled
                        previewConfig={{ showPreview: false }}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => setShowEmojiPicker(v => !v)}
                    className={`p-3 rounded-xl transition-colors ${showEmojiPicker ? "bg-blue-100 text-blue-600" : "text-gray-500 hover:text-blue-500 hover:bg-white"}`}
                  >
                    <FaSmile size={20} />
                  </button>
                </div>

                <textarea
                  className="flex-1 bg-transparent outline-none resize-none text-sm py-2.5 px-3 text-gray-800 font-medium placeholder:text-gray-400 min-h-[44px] max-h-32"
                  rows={1}
                  placeholder="Type your message here..."
                  value={directMsgText}
                  onChange={e => handleTyping(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sendingMessage || isSwitchingUser || isChatLoading}
                />

                <button
                  onClick={handleSendMessage}
                  disabled={!directMsgText.trim() || sendingMessage || isSwitchingUser || isChatLoading}
                  className={`p-3.5 rounded-xl transition-all shadow-md flex items-center justify-center ${
                    directMsgText.trim() && !sendingMessage && !isSwitchingUser && !isChatLoading
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-200 hover:from-blue-700 hover:to-indigo-700 active:scale-95"
                      : "bg-gray-200 text-gray-400 shadow-none cursor-not-allowed"
                  }`}
                >
                  {sendingMessage
                    ? <FaSpinner className="animate-spin" size={16} />
                    : editingMessageId
                      ? <FaCheck size={16} />
                      : <FaPaperPlane size={16} />
                  }
                </button>
              </div>
            </footer>
          </>
        ) : (
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
              </p>
              <div className="grid grid-cols-2 gap-3 text-left">
                {["Real-time messaging", "Typing indicators", "Read receipts", "Edit & delete"].map(feat => (
                  <div key={feat} className="flex items-center gap-2 text-xs text-gray-600">
                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                      <FaCheck className="text-green-600" size={10} />
                    </div>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </div>

      <style>{`
        .overflow-y-auto::-webkit-scrollbar { width: 6px; }
        .overflow-y-auto::-webkit-scrollbar-track { background: transparent; border-radius: 10px; }
        .overflow-y-auto::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .flex-1 { min-height: 0; }
      `}</style>
    </div>
  );
};

export default ConnectWithEmployee;