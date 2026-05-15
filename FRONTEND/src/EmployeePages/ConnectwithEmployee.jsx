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
  FaCommentDots, FaPen, FaTrash, FaArrowLeft,
} from "react-icons/fa";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

const POLL_INTERVAL = 3000; // silent background refresh every 3 seconds

const sameId = (a, b) => !!a && !!b && a.toString() === b.toString();

const ConnectWithEmployee = () => {
  const { user } = useContext(AuthContext);
  const currentUserId = user?._id || user?.id;

  const [employees, setEmployees] = useState([]);
  const [chatList, setChatList] = useState([]);
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [directMessages, setDirectMessages] = useState([]);
  const [directMsgText, setDirectMsgText] = useState("");
  const [directSearchTerm, setDirectSearchTerm] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isListLoading, setIsListLoading] = useState(true);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isSwitchingUser, setIsSwitchingUser] = useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);

  const directChatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const sidebarContainerRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const selectedChatUserRef = useRef(null);
  const currentUserIdRef = useRef(null);
  // Refs used by silent polling to avoid stale closures
  const directMessagesRef = useRef([]);
  const chatListRef = useRef([]);
  const pollTimerRef = useRef(null);
  const isSendingRef = useRef(false);

  useEffect(() => { selectedChatUserRef.current = selectedChatUser; }, [selectedChatUser]);
  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);
  useEffect(() => { directMessagesRef.current = directMessages; }, [directMessages]);
  useEffect(() => { chatListRef.current = chatList; }, [chatList]);
  useEffect(() => { isSendingRef.current = sendingMessage; }, [sendingMessage]);

  // ─────────────────────────────────────────────────────────────────────────
  // SILENT BACKGROUND POLL
  // Merges new data into state without touching loading flags so the UI
  // never blinks, flashes, or shows a spinner.
  // ─────────────────────────────────────────────────────────────────────────
  const silentPollMessages = useCallback(async () => {
    const peer = selectedChatUserRef.current;
    if (!peer || isSendingRef.current) return;

    try {
      const { data: fresh } = await api.get(`/api/chat/history/${peer._id}`);
      if (!fresh || !Array.isArray(fresh)) return;

      // Only update state if there are genuinely new messages
      const current = directMessagesRef.current;
      const currentIds = new Set(current.map(m => m._id));
      const newMsgs = fresh.filter(m => !currentIds.has(m._id) && !m._id?.toString().startsWith("temp_"));

      if (newMsgs.length > 0) {
        // Merge: keep optimistic temp messages at end, insert real ones before them
        setDirectMessages(prev => {
          const temps = prev.filter(m => m._id?.toString().startsWith("temp_"));
          const nonTemp = prev.filter(m => !m._id?.toString().startsWith("temp_"));
          const existingIds = new Set(nonTemp.map(m => m._id));
          const toAdd = fresh.filter(m => !existingIds.has(m._id) && !m._id?.toString().startsWith("temp_"));
          return [...nonTemp, ...toAdd, ...temps];
        });
        playNotificationSound();
      }
    } catch (_) {
      // Silently ignore poll errors — don't show any UI feedback
    }
  }, []);

  const silentPollChatList = useCallback(async () => {
    try {
      const { data } = await api.get("/api/chat/users");
      if (!data || !Array.isArray(data)) return;

      // Only update sidebar if counts or last messages changed
      const current = chatListRef.current;
      const hasChanges = data.some(d => {
        const existing = current.find(c => sameId(c._id, d._id));
        return !existing ||
          existing.lastMessage !== d.lastMessage ||
          existing.unreadCount !== d.unreadCount;
      });

      if (hasChanges) {
        setChatList(prev => {
          // Merge: preserve local unread=0 overrides for the open chat
          const activePeer = selectedChatUserRef.current;
          return data.map(d => {
            const local = prev.find(p => sameId(p._id, d._id));
            // If this is the open chat, keep unread at 0
            if (activePeer && sameId(d._id, activePeer._id)) {
              return { ...d, unreadCount: 0 };
            }
            return d;
          });
        });
        const total = data.reduce((a, c) => {
          const activePeer = selectedChatUserRef.current;
          if (activePeer && sameId(c._id, activePeer._id)) return a;
          return a + (c.unreadCount || 0);
        }, 0);
        setTotalUnreadCount(total);
      }
    } catch (_) {
      // Silently ignore
    }
  }, []);

  // Start / stop the poll timer
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      await silentPollMessages();
      await silentPollChatList();
    }, POLL_INTERVAL);
  }, [silentPollMessages, silentPollChatList]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Always poll — socket is a bonus if it works
  useEffect(() => {
    if (!currentUserId) return;
    startPolling();
    return () => stopPolling();
  }, [currentUserId, startPolling, stopPolling]);

  // Restart poll when user switches chat so new messages load quickly
  useEffect(() => {
    if (!currentUserId || !selectedChatUser) return;
    stopPolling();
    startPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatUser?._id]);

  // ─────────────────────────────────────────────────────────────────────────
  // SOCKET INIT (still used when available; polling is the reliable fallback)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;

    const token =
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("authToken") ||
      sessionStorage.getItem("token") || "";

    const socket = io(SOCKET_URL, {
      transports: ["polling", "websocket"],
      upgrade: true,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("authenticate", currentUserIdRef.current);
    });

    socket.on("authenticated", () => { });

    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("connect_error", () => setSocketConnected(false));

    // Socket delivers message instantly — polling catches it anyway at next tick
    socket.on("receive_message", (msg) => {
      const senderId = msg.sender?._id ?? msg.sender;
      const activePeer = selectedChatUserRef.current;

      if (activePeer && sameId(senderId, activePeer._id)) {
        setDirectMessages(prev => {
          if (prev.some(m => sameId(m._id, msg._id))) return prev;
          return [...prev, msg];
        });
        api.put(`/api/chat/read/${senderId.toString()}`).catch(() => { });
      } else {
        setChatList(prev => prev.map(u =>
          sameId(u._id, senderId)
            ? { ...u, unreadCount: (u.unreadCount || 0) + 1, lastMessage: msg.message, lastMessageTime: msg.createdAt }
            : u
        ));
        setTotalUnreadCount(c => c + 1);
        playNotificationSound();
      }

      setChatList(prev => {
        const sid = senderId?.toString();
        const filtered = prev.filter(u => u._id?.toString() !== sid);
        const existing = prev.find(u => u._id?.toString() === sid)
          || { _id: sid, name: msg.sender?.name || "Unknown" };
        return [{ ...existing, lastMessage: msg.message, lastMessageTime: msg.createdAt }, ...filtered];
      });
    });

    socket.on("messages_read", () => {
      setDirectMessages(prev => prev.map(m => {
        const sid = m.sender?._id ?? m.sender;
        return sameId(sid, currentUserIdRef.current) ? { ...m, isRead: true } : m;
      }));
    });

    socket.on("message_edited", ({ messageId, newMessage }) => {
      setDirectMessages(prev => prev.map(m =>
        sameId(m._id, messageId) ? { ...m, message: newMessage, isEdited: true } : m
      ));
    });

    socket.on("message_deleted", ({ messageId }) => {
      setDirectMessages(prev => prev.filter(m => !sameId(m._id, messageId)));
    });

    socket.on("user_typing", ({ userId }) => {
      const peer = selectedChatUserRef.current;
      if (peer && sameId(userId, peer._id))
        setTypingUsers(prev => new Set([...prev, userId?.toString()]));
    });

    socket.on("user_stopped_typing", ({ userId }) => {
      setTypingUsers(prev => { const s = new Set(prev); s.delete(userId?.toString()); return s; });
    });

    return () => { socket.disconnect(); };
  }, [currentUserId]);

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isChatLoading && !isSwitchingUser && directChatEndRef.current) {
      setTimeout(() => directChatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [directMessages, isChatLoading, isSwitchingUser]);

  const playNotificationSound = () => {
    try { const a = new Audio("/notification.mp3"); a.volume = 0.5; a.play().catch(() => { }); } catch (_) { }
  };

  const handleTyping = useCallback((text) => {
    setDirectMsgText(text);
    if (!selectedChatUser || !socketRef.current) return;
    if (text.trim()) {
      socketRef.current.emit("typing_start", { receiverId: selectedChatUser._id, senderId: currentUserId, senderName: user?.name });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit("typing_stop", { receiverId: selectedChatUser._id, senderId: currentUserId });
      }, 3000);
    } else {
      clearTimeout(typingTimeoutRef.current);
      socketRef.current.emit("typing_stop", { receiverId: selectedChatUser._id, senderId: currentUserId });
    }
  }, [selectedChatUser, currentUserId, user]);

  const handleUserSwitch = useCallback(async (emp) => {
    // On mobile, if we select someone, close the sidebar immediately
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }

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

  const formatMessageDate = (d) => {
    const date = new Date(d), today = new Date(), yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  const groupedMessages = useMemo(() => {
    const g = {};
    directMessages.forEach(m => { const k = formatMessageDate(m.createdAt); if (!g[k]) g[k] = []; g[k].push(m); });
    return g;
  }, [directMessages]);

  const displayList = useMemo(() => {
    const term = directSearchTerm.toLowerCase();
    const base = term
      ? employees.filter(e => !sameId(e._id, currentUserId) &&
        (e.name?.toLowerCase().includes(term) || e.employeeId?.toLowerCase().includes(term)))
      : chatList;
    return [...base].sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));
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
    } catch (err) { console.error("fetchEmployees:", err); }
  }, [currentUserId]);

  const fetchDirectMessages = useCallback(async (peer, silent = true) => {
    if (!peer) return;
    if (!silent) { setIsChatLoading(true); setDirectMessages([]); }
    try {
      const { data } = await api.get(`/api/chat/history/${peer._id}`);
      if (sameId(selectedChatUserRef.current?._id, peer._id))
        setDirectMessages(data || []);
    } catch (err) {
      console.error("fetchDirectMessages:", err);
      if (!silent) toast.error("Failed to load messages");
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
        const u = chatListRef.current.find(x => sameId(x._id, senderId));
        return u ? Math.max(0, prev - (u.unreadCount || 0)) : prev;
      });
    } catch (err) { console.error("markMessagesAsRead:", err); }
  }, []);

  useEffect(() => { fetchEmployees(); fetchChatList(); }, [fetchEmployees, fetchChatList]);

  // ── Send message ─────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async () => {
    if (!directMsgText.trim() || !selectedChatUser || sendingMessage) return;

    const messageToSend = directMsgText.trim();
    setDirectMsgText("");
    setShowEmojiPicker(false);
    setSendingMessage(true);

    socketRef.current?.emit("typing_stop", { receiverId: selectedChatUser._id, senderId: currentUserId });

    const tempId = `temp_${Date.now()}`;
    setDirectMessages(prev => [...prev, {
      _id: tempId, message: messageToSend,
      sender: { _id: currentUserId, name: user?.name },
      receiver: selectedChatUser._id,
      createdAt: new Date().toISOString(),
      isPending: true, isSending: true, isRead: false,
    }]);

    setChatList(prev => {
      const filtered = prev.filter(u => !sameId(u._id, selectedChatUser._id));
      return [{ ...selectedChatUser, lastMessage: messageToSend, lastMessageTime: new Date().toISOString() }, ...filtered];
    });

    try {
      if (editingMessageId) {
        await api.put(`/api/chat/${editingMessageId}`, { message: messageToSend });
        setEditingMessageId(null);
        setDirectMessages(prev => prev.filter(m => m._id !== tempId));
        await fetchDirectMessages(selectedChatUser, true);
      } else {
        const { data } = await api.post("/api/chat/send", {
          receiverId: selectedChatUser._id,
          message: messageToSend,
        });
        setDirectMessages(prev =>
          prev.map(m => m._id === tempId ? { ...data, isSending: false, isPending: false } : m)
        );
      }
    } catch (err) {
      console.error("handleSendMessage:", err);
      toast.error(err.response?.status === 401 ? "Session expired — please log in again." : "Failed to send message");
      setDirectMessages(prev => prev.filter(m => m._id !== tempId));
    } finally {
      setSendingMessage(false);
    }
  }, [directMsgText, selectedChatUser, sendingMessage, editingMessageId, currentUserId, user, fetchDirectMessages]);

  const startEditing = useCallback((msg) => { setEditingMessageId(msg._id); setDirectMsgText(msg.message); setOpenMenuId(null); }, []);

  const handleDeleteMessage = useCallback(async (msgId) => {
    if (!window.confirm("Delete this message?")) return;
    setDirectMessages(prev => prev.filter(m => m._id !== msgId));
    setOpenMenuId(null);
    try { await api.delete(`/api/chat/${msgId}`); toast.success("Deleted"); }
    catch { toast.error("Failed to delete"); }
  }, []);

  const handleEmojiClick = (emojiData) => setDirectMsgText(prev => prev + emojiData.emoji);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
    if (e.key === "Escape") { setEditingMessageId(null); setDirectMsgText(""); setShowEmojiPicker(false); }
  }, [handleSendMessage]);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    if (openMenuId) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Force sidebar visibility logic on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex w-full h-[calc(100vh-4rem)] bg-white font-sans mt-0 overflow-hidden relative z-20">
      <Toaster position="top-right" toastOptions={{ style: { background: "#363636", color: "#fff", fontSize: "12px", padding: "8px 16px" } }} />

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <div className={`${isSidebarOpen ? "w-full md:w-80 flex" : "hidden md:flex md:w-80"} flex-col border-r border-gray-200 bg-white h-full z-50 transition-all duration-300 overflow-hidden`}>
        <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-sm">
                <FaComments className="text-white" size={18} />
              </div>
              <div>
                <h2 className="font-black text-lg tracking-tight">Connect</h2>
                <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest flex items-center gap-1.5">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${socketConnected ? "bg-green-400 animate-pulse" : "bg-slate-400"}`} />
                  {socketConnected ? "Live" : "Active"}
                </p>
              </div>
            </div>
            {totalUnreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full shadow-lg border border-white/20">
                {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
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

        <div ref={sidebarContainerRef} className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          <div className="px-3 py-2">
            {isListLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 py-8">
                <FaSpinner className="animate-spin" size={20} />
                <span className="text-xs font-semibold uppercase tracking-widest">Loading contacts...</span>
              </div>
            ) : displayList.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-gray-400 p-4 text-center py-8">
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
                const isActive = sameId(selectedChatUser?._id, emp._id);
                return (
                  <div
                    key={emp._id}
                    onClick={() => handleUserSwitch(emp)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-2xl cursor-pointer mb-1.5 transition-all duration-200 ${isActive ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200" : "hover:bg-gray-50 hover:shadow-md"
                      } ${isSwitchingUser ? "pointer-events-none opacity-70" : ""}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0 ${isActive ? "bg-white/20 border-2 border-white/30" : "bg-gradient-to-tr from-blue-500 to-indigo-500 text-white border-2 border-white"
                      }`}>
                      {emp.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 overflow-hidden min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <p className={`text-sm font-bold truncate ${isActive ? "text-white" : "text-gray-800"}`}>{emp.name}</p>
                        <span className={`text-xs font-medium flex-shrink-0 ml-1 ${isActive ? "text-blue-100" : "text-gray-500"}`}>
                          {emp.lastMessageTime ? new Date(emp.lastMessageTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                      <p className={`text-xs truncate font-medium ${isActive ? "text-blue-100 opacity-90" : "text-gray-500"}`}>
                        {emp.lastMessage || emp.employeeId || "No messages yet"}
                      </p>
                    </div>
                    {(emp.unreadCount || 0) > 0 && !isActive && (
                      <span className="bg-green-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0">
                        {emp.unreadCount > 9 ? "9+" : emp.unreadCount}
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
      <div className={`${!isSidebarOpen ? "flex w-full" : "hidden md:flex flex-1"} flex-col h-full bg-slate-50 relative overflow-hidden`}>
        {selectedChatUser ? (
          <>
            <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-slate-200 bg-white/80 backdrop-blur-md shadow-sm z-40 flex-shrink-0">
              <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                {/* Back button for mobile */}
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <FaArrowLeft size={18} />
                </button>

                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center rounded-2xl font-black text-base md:text-lg shadow-lg shadow-blue-100 flex-shrink-0">
                  {selectedChatUser.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm md:text-base font-black text-slate-800 truncate leading-tight mb-0.5">{selectedChatUser.name}</h3>
                  <div className="flex items-center gap-2">
                    {typingUsers.has(selectedChatUser._id?.toString()) ? (
                      <span className="text-[10px] text-blue-600 font-black uppercase tracking-widest animate-pulse">typing...</span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate">
                        {selectedChatUser.employeeId || selectedChatUser.department || "Employee"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                <FaEllipsisH size={16} />
              </button>
            </header>

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto bg-slate-50/50 custom-scrollbar" style={{ minHeight: 0 }}>
              {isSwitchingUser || isChatLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{isSwitchingUser ? "Switching..." : "Syncing History"}</p>
                </div>
              ) : directMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 p-8 text-center">
                  <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                    <FaComments className="text-slate-200" size={24} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 mb-2">New Conversation</h3>
                  <p className="text-xs font-medium text-slate-400 max-w-[200px]">Send your first message to {selectedChatUser.name.split(' ')[0]} to start connecting.</p>
                </div>
              ) : (
                <div className="p-4 md:p-8 space-y-2">
                  {Object.entries(groupedMessages).map(([date, msgs]) => (
                    <div key={date} className="space-y-4">
                      <div className="flex justify-center py-6">
                        <span className="bg-white/80 backdrop-blur-sm text-slate-500 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm border border-slate-100">{date}</span>
                      </div>
                      {msgs.map((msg, index) => {
                        const isMe = sameId(msg.sender?._id ?? msg.sender, currentUserId);
                        const isMenuOpen = openMenuId === msg._id;
                        const isPending = msg.isPending || msg.isSending;
                        return (
                          <div key={msg._id || index} className={`flex w-full ${isMe ? "justify-end" : "justify-start animate-fade-in-left"}`}>
                            <div className={`max-w-[90%] md:max-w-[70%] group relative ${isMe ? "ml-auto" : ""}`}>
                              <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                {!isMe && (
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                                    {msg.sender?.name?.split(' ')[0] || selectedChatUser.name?.split(' ')[0]}
                                  </span>
                                )}
                                <div className="relative group/bubble">
                                  <div className={`px-4 py-3 rounded-2xl shadow-sm transition-all ${isMe
                                    ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-none shadow-blue-100/50"
                                    : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                                    } ${isPending ? "opacity-75" : ""}`}>
                                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>

                                    <div className={`flex items-center justify-end gap-1.5 mt-2 ${isMe ? "text-blue-100" : "text-slate-400"}`}>
                                      {msg.isEdited && <span className="text-[9px] font-bold uppercase tracking-tighter opacity-70">Edited ·</span>}
                                      <span className="text-[9px] font-bold tracking-tighter">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                      {isMe && (
                                        isPending
                                          ? <div className="w-2 h-2 border border-blue-200 border-t-white rounded-full animate-spin" />
                                          : <FaCheckDouble className={`text-[10px] ${msg.isRead ? "text-emerald-300" : "opacity-40"}`} />
                                      )}
                                    </div>
                                  </div>

                                  {isMe && !isPending && (
                                    <div className="absolute top-1/2 -left-10 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 transition-all flex flex-col gap-1">
                                      <button
                                        onClick={e => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : msg._id); }}
                                        className="w-8 h-8 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-blue-600 hover:border-blue-200 transition-all"
                                      >
                                        <FaEllipsisV size={10} />
                                      </button>
                                      {isMenuOpen && (
                                        <div className="absolute left-10 top-0 bg-white border border-slate-100 shadow-2xl rounded-2xl py-2 z-50 w-32 animate-fade-in" onClick={e => e.stopPropagation()}>
                                          <button onClick={() => startEditing(msg)} className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors uppercase tracking-widest">
                                            <FaPen size={10} /> Edit
                                          </button>
                                          <button onClick={() => handleDeleteMessage(msg._id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black text-red-500 hover:bg-red-50 transition-colors uppercase tracking-widest">
                                            <FaTrash size={10} /> Delete
                                          </button>
                                        </div>
                                      )}
                                    </div>
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

            <footer className="p-4 md:p-6 bg-white border-t border-slate-100 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] flex-shrink-0">
              {editingMessageId && (
                <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between bg-blue-50/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-blue-100 animate-slide-up">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-100"><FaPen size={10} /></div>
                    <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Editing Mode</span>
                  </div>
                  <button onClick={() => { setEditingMessageId(null); setDirectMsgText(""); }} className="p-1.5 rounded-full hover:bg-white text-blue-400 transition-colors">
                    <FaTimes size={14} />
                  </button>
                </div>
              )}
              <div className="max-w-4xl mx-auto flex items-end gap-2 md:gap-3 bg-slate-100 rounded-3xl px-2 py-2 md:px-3 md:py-1 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-600/5 border border-transparent focus-within:border-blue-200 transition-all duration-300">
                <div className="relative">
                  {showEmojiPicker && (
                    <div className="absolute bottom-16 left-0 z-50 shadow-2xl rounded-[2rem] overflow-hidden border border-slate-100 animate-fade-in">
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width={window.innerWidth < 768 ? 280 : 350}
                        height={400}
                        searchDisabled={false}
                        skinTonesDisabled
                        previewConfig={{ showPreview: false }}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => setShowEmojiPicker(v => !v)}
                    className={`p-3 md:p-3.5 rounded-2xl transition-all ${showEmojiPicker ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-400 hover:text-blue-600 hover:bg-white"}`}
                  >
                    <FaSmile size={20} />
                  </button>
                </div>
                <textarea
                  className="flex-1 bg-transparent outline-none resize-none text-sm py-3 px-2 md:px-4 text-slate-700 font-medium placeholder:text-slate-400 min-h-[48px] max-h-32"
                  rows={1}
                  placeholder="Share something..."
                  value={directMsgText}
                  onChange={e => handleTyping(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sendingMessage || isSwitchingUser || isChatLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!directMsgText.trim() || sendingMessage || isSwitchingUser || isChatLoading}
                  className={`p-3 md:p-4 rounded-2xl transition-all shadow-xl flex items-center justify-center flex-shrink-0 ${directMsgText.trim() && !sendingMessage && !isSwitchingUser && !isChatLoading
                    ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-blue-200 hover:shadow-blue-300 active:scale-95"
                    : "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed"
                    }`}
                >
                  {sendingMessage ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : editingMessageId ? <FaCheck size={18} /> : <FaPaperPlane size={18} />}
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className={`${!isSidebarOpen ? "flex" : "hidden md:flex"} flex-1 flex-col items-center justify-center bg-white h-full`}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center max-w-sm text-center p-8">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] shadow-2xl shadow-blue-200 flex items-center justify-center mb-10 border-4 border-white">
                <FaUsers className="text-white" size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">Team Connect</h3>
              <p className="text-sm font-medium text-slate-400 mb-10 leading-relaxed italic">"Great things in business are never done by one person. They're done by a team of people."</p>
              <div className="grid grid-cols-1 gap-3 w-full">
                {["End-to-end encrypted", "Real-time sync"].map(feat => (
                  <div key={feat} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-md"><FaCheck size={10} /></div>
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.1em]">{feat}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden mt-8 w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all"
              >
                Select Colleague
              </button>
            </motion.div>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        
        @keyframes fade-in-left {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in-left { animation: fade-in-left 0.3s ease-out forwards; }
        
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default ConnectWithEmployee;