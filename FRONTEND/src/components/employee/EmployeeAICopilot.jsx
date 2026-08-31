import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Bot,
  User,
  Send,
  X,
  RotateCcw,
  Calendar,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Clock,
  Home,
  LogOut,
  Ban,
  Receipt,
  FileText,
  Bell,
  HelpCircle,
  DollarSign,
  Edit3,
  Save,
  Undo2,
  History,
  Plus,
  Trash2,
  MessageSquare,
  ArrowLeft,
} from "lucide-react";
import {
  sendCopilotMessage,
  executeCopilotAction,
  updateCopilotDraftAction,
} from "../../api";

const QUICK_SUGGESTIONS = [
  "Show my dashboard",
  "What is my leave balance?",
  "Apply for casual leave tomorrow",
];

/* =========================================================================
   📝 MARKDOWN RENDERER COMPONENT
========================================================================= */
const FormattedMarkdownText = ({ content }) => {
  if (!content) return null;

  const lines = content.split("\n");
  const elements = [];

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<div key={lineIdx} className="h-1" />);
      return;
    }

    const isBullet = /^[*-]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed);
    const cleanLine = isBullet
      ? trimmed.replace(/^[*-]\s+/, "").replace(/^\d+\.\s+/, "")
      : trimmed;

    const cleanHtmlLine = cleanLine
      .replace(/<\/?(?:strong|b)>/gi, "**")
      .replace(/<\/?(?:em|i)>/gi, "*");

    const parseInline = (str) => {
      const parts = str.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
      return parts.map((part, pIdx) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong
              key={pIdx}
              className="font-bold text-slate-900 dark:text-slate-100"
            >
              {part.slice(2, -2)}
            </strong>
          );
        } else if (
          part.startsWith("*") &&
          part.endsWith("*") &&
          part.length > 2
        ) {
          return (
            <em key={pIdx} className="italic">
              {part.slice(1, -1)}
            </em>
          );
        } else if (
          part.startsWith("`") &&
          part.endsWith("`") &&
          part.length > 2
        ) {
          return (
            <code
              key={pIdx}
              className="px-1 py-0.5 bg-slate-200/70 dark:bg-slate-700/70 rounded font-mono text-[10px]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      });
    };

    if (isBullet) {
      elements.push(
        <div key={lineIdx} className="flex items-start gap-1.5 my-0.5 pl-1">
          <span className="text-indigo-500 font-bold leading-tight text-xs shrink-0">
            •
          </span>
          <span className="flex-1">{parseInline(cleanHtmlLine)}</span>
        </div>
      );
    } else {
      elements.push(
        <p key={lineIdx} className="my-0.5">
          {parseInline(cleanHtmlLine)}
        </p>
      );
    }
  });

  return <div className="space-y-0.5">{elements}</div>;
};

export default function EmployeeAICopilot({ employee }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const storageKey = `vsync_copilot_sessions_${employee?._id || employee?.employeeId || "emp_default"}`;

  const createWelcomeMsg = () => ({
    id: `welcome-${Date.now()}`,
    role: "assistant",
    text: `Hello ${employee?.firstName || employee?.name || "there"}! 👋 I am your **VSync HR Copilot**. You can ask policy questions, check balances, or run actions like **Apply Leave**, **Cancel Leave**, **Apply WFH**, and **Punch In/Out**!`,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  });

  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Could not read saved copilot sessions:", e);
    }
    const initId = `session-${Date.now()}`;
    return [
      {
        id: initId,
        title: "New Conversation",
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: "welcome-init",
            role: "assistant",
            text: `Hello ${employee?.firstName || employee?.name || "there"}! 👋 I am your **VSync HR Copilot**. You can ask policy questions, check balances, or run actions like **Apply Leave**, **Cancel Leave**, **Apply WFH**, and **Punch In/Out**!`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ],
      },
    ];
  });

  const [currentSessionId, setCurrentSessionId] = useState(() => {
    return sessions[0]?.id || `session-${Date.now()}`;
  });

  const activeSession = sessions.find((s) => s.id === currentSessionId) || sessions[0];
  const messages = activeSession?.messages || [createWelcomeMsg()];

  const setMessages = (updater) => {
    setSessions((prevSessions) => {
      return prevSessions.map((s) => {
        if (s.id === currentSessionId) {
          const newMessages = typeof updater === "function" ? updater(s.messages || []) : updater;
          let title = s.title;
          const firstUserMsg = newMessages.find((m) => m.role === "user");
          if (firstUserMsg && (s.title === "New Conversation" || !s.title)) {
            title = firstUserMsg.text.slice(0, 32) + (firstUserMsg.text.length > 32 ? "..." : "");
          }
          return {
            ...s,
            title,
            messages: newMessages,
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });
    });
  };

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(sessions));
    } catch (e) {
      console.warn("Failed to persist copilot sessions:", e);
    }
  }, [sessions, storageKey]);

  const handleNewChat = () => {
    const newId = `session-${Date.now()}`;
    const newSession = {
      id: newId,
      title: "New Conversation",
      updatedAt: new Date().toISOString(),
      messages: [createWelcomeMsg()],
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setShowHistory(false);
  };

  const handleSelectSession = (sessionId) => {
    setCurrentSessionId(sessionId);
    setShowHistory(false);
  };

  const handleDeleteSession = (sessionId, e) => {
    e.stopPropagation();
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (filtered.length === 0) {
        const freshId = `session-${Date.now()}`;
        const freshSession = {
          id: freshId,
          title: "New Conversation",
          updatedAt: new Date().toISOString(),
          messages: [createWelcomeMsg()],
        };
        setCurrentSessionId(freshId);
        return [freshSession];
      }
      if (currentSessionId === sessionId) {
        setCurrentSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const [executingActionId, setExecutingActionId] = useState(null);
  const [editingCardId, setEditingCardId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [updatingTokenId, setUpdatingTokenId] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, loading]);

  const handleSend = async (textToSend) => {
    const queryText = (textToSend || input).trim();
    if (!queryText || loading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: "user",
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      const chatHistory = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await sendCopilotMessage(queryText, chatHistory);

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: res.reply || "I have processed your request.",
        sources: res.sources || [],
        actionCard: res.actionCard || null,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error("Copilot Chat Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: `⚠️ Error: ${error?.response?.data?.reply || error?.response?.data?.error || error.message || "Failed to reach AI Copilot server."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getDeviceLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error("Geolocation is not supported by your browser"));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (err) => {
          if (err.code !== 1) {
            navigator.geolocation.getCurrentPosition(
              (pos2) => {
                resolve({
                  latitude: pos2.coords.latitude,
                  longitude: pos2.coords.longitude,
                });
              },
              (err2) => reject(err2),
              { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
            );
          } else {
            reject(err);
          }
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
      );
    });
  };

  const handleConfirmAction = async (msgId, actionToken, cardType = "") => {
    if (!actionToken) return;
    setExecutingActionId(msgId);
    try {
      let locationPayload = {};
      if (cardType === "confirm_punch_in" || cardType === "confirm_punch_out" || cardType === "confirm_start_field_work") {
        try {
          const loc = await getDeviceLocation();
          locationPayload = loc;
        } catch (geoErr) {
          let errorMsg = "📍 Location access is required to record attendance. Please enable location permissions in your browser.";
          if (geoErr.code === 1) {
            errorMsg = "❌ Location permission denied. You must allow location access in your browser to punch in or punch out.";
          }
          alert(errorMsg);
          setExecutingActionId(null);
          return;
        }
      }

      const result = await executeCopilotAction(actionToken, locationPayload);

      // ⚡ Live UI Synchronization for Profile Updates
      if (result?.data) {
        try {
          const saved = sessionStorage.getItem("hrmsUser");
          if (saved) {
            const parsed = JSON.parse(saved);
            const updatedUser = {
              ...parsed,
              ...result.data,
              personalDetails: {
                ...(parsed.personalDetails || {}),
                ...(result.data.personalDetails || {}),
              },
            };
            sessionStorage.setItem("hrmsUser", JSON.stringify(updatedUser));
            window.dispatchEvent(new Event("hrmsUserUpdated"));
            window.dispatchEvent(new Event("storage"));
          }
        } catch (e) {
          console.error("Failed to sync local session profile:", e);
        }
      }

      // ⚡ Live UI Synchronization for Attendance & Leaves
      window.dispatchEvent(new Event("hrmsAttendanceUpdated"));
      window.dispatchEvent(new Event("hrmsLeavesUpdated"));
      window.dispatchEvent(new Event("hrmsWorkUpdated"));

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === msgId && msg.actionCard) {
            return {
              ...msg,
              actionCard: {
                ...msg.actionCard,
                executed: true,
                resultMessage: result.message || "Action successfully completed!",
              },
            };
          }
          return msg;
        })
      );
    } catch (error) {
      console.error("Action Execution Error:", error);
      alert(`Failed to execute action: ${error?.response?.data?.error || error.message}`);
    } finally {
      setExecutingActionId(null);
    }
  };

  const handleStartEdit = (msg) => {
    setEditingCardId(msg.id);
    setEditFormData({ ...(msg.actionCard?.data || {}) });
  };

  const handleCancelEdit = () => {
    setEditingCardId(null);
    setEditFormData({});
  };

  const handleSaveEdit = async (msgId, actionType) => {
    setUpdatingTokenId(msgId);
    try {
      const res = await updateCopilotDraftAction(actionType, editFormData);
      if (res.actionCard) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === msgId) {
              return {
                ...msg,
                actionCard: res.actionCard,
              };
            }
            return msg;
          })
        );
      }
      setEditingCardId(null);
      setEditFormData({});
    } catch (error) {
      console.error("Failed to update draft action:", error);
      alert(`Failed to update details: ${error?.response?.data?.error || error.message}`);
    } finally {
      setUpdatingTokenId(null);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: "assistant",
        text: `Chat cleared. How can I assist you with your HR actions or policy queries?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <>
      {/* 🚀 FLOATING COPILOT BUTTON */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 select-none">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center justify-center p-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-full shadow-2xl hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all duration-300 border border-white/20"
            title="Ask VSync AI Copilot"
          >
            <span className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full blur opacity-70 group-hover:opacity-100 transition duration-500 animate-pulse"></span>

            <div className="relative flex items-center gap-2 px-2 py-0.5">
              <span className="font-semibold text-sm tracking-wide">
                Ai copilot
              </span>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </span>
            </div>
          </button>
        )}
      </div>

      {/* 💬 COPILOT SLIDE-OVER WINDOW */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[95vw] sm:w-[420px] h-[580px] max-h-[85vh] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-100 dark:border-indigo-900/50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div>
                <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  AI Copilot
                  <span className="text-[10px] bg-emerald-400/30 text-emerald-100 px-1.5 py-0.2 rounded-full font-normal">
                    Online
                  </span>
                </h3>
                <p className="text-[11px] text-indigo-100 opacity-90">
                  HR Policies & Actions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowHistory((prev) => !prev)}
                className={`p-1.5 rounded-lg transition text-indigo-100 hover:text-white cursor-pointer ${
                  showHistory ? "bg-white/30 text-white font-semibold shadow-2xs" : "hover:bg-white/20"
                }`}
                title="Past Conversations"
              >
                <History className="w-4 h-4" />
              </button>
              <button
                onClick={handleNewChat}
                className="p-1.5 hover:bg-white/20 rounded-lg transition text-indigo-100 hover:text-white cursor-pointer"
                title="New Chat"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={handleClearChat}
                className="p-1.5 hover:bg-white/20 rounded-lg transition text-indigo-100 hover:text-white cursor-pointer"
                title="Reset Session"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition text-indigo-100 hover:text-white cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showHistory ? (
            /* 📜 PAST CONVERSATIONS OVERLAY PANEL */
            <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden animate-in fade-in duration-150">
              <div className="p-3 bg-white dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Past Conversations</span>
                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold px-2 py-0.5 rounded-full">
                    {sessions.length}
                  </span>
                </div>
                <button
                  onClick={handleNewChat}
                  className="px-2.5 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg text-[11px] transition flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Chat
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {sessions.map((sess) => {
                  const isActive = sess.id === currentSessionId;
                  const firstUserMsg = (sess.messages || []).find((m) => m.role === "user")?.text;
                  const lastMsg = (sess.messages || [])[sess.messages?.length - 1]?.text?.replace(/[*#`_]/g, "");
                  const timeFormatted = new Date(sess.updatedAt || Date.now()).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={sess.id}
                      onClick={() => handleSelectSession(sess.id)}
                      className={`group relative p-3 rounded-xl border transition cursor-pointer ${
                        isActive
                          ? "bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700/80 shadow-2xs"
                          : "bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/70 hover:border-indigo-200 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
                          <h4 className={`text-xs font-semibold truncate ${isActive ? "text-indigo-900 dark:text-indigo-200" : "text-slate-700 dark:text-slate-200"}`}>
                            {sess.title || firstUserMsg || "New Conversation"}
                          </h4>
                        </div>
                        <button
                          onClick={(e) => handleDeleteSession(sess.id, e)}
                          title="Delete Chat"
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-500 rounded transition shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {lastMsg && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-1 pl-6">
                          {lastMsg}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 mt-2 pl-6">
                        <span>{timeFormatted}</span>
                        <span className="font-mono">{(sess.messages || []).length} msgs</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700/80 text-center">
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center justify-center gap-1 w-full py-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Active Chat
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50 dark:bg-slate-950/50 scroll-smooth">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-none"
                      : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-none"
                  }`}
                >
                  <FormattedMarkdownText content={msg.text} />

                  {/* Dynamic Interactive Widgets & Confirmation Cards */}
                  {msg.actionCard && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-700/70 space-y-2">
                      {/* Read-Only Balance Widget */}
                      {msg.actionCard.type === "leave_balance_widget" && (
                        <div className="bg-indigo-50/60 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900 dark:text-indigo-300">
                            <span className="flex items-center gap-1">
                              <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                              {msg.actionCard.title}
                            </span>
                            <span>{msg.actionCard.data?.totalApprovedDaysTaken || 0}d Taken</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            {msg.actionCard.data?.balances?.map((b, i) => (
                              <div
                                key={i}
                                className="bg-white/80 dark:bg-slate-800/80 p-1.5 rounded-lg border border-indigo-50 dark:border-slate-700 flex justify-between items-center text-[10px]"
                              >
                                <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                                  {b.leaveType}
                                </span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                  {b.remaining}d left
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Read-Only Holidays Widget */}
                      {msg.actionCard.type === "upcoming_holidays_widget" && (
                        <div className="bg-emerald-50/60 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/50 space-y-1.5">
                          <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                            {msg.actionCard.title}
                          </div>
                          <div className="space-y-1 pt-1">
                            {msg.actionCard.data?.map((h, i) => (
                              <div
                                key={i}
                                className="bg-white/80 dark:bg-slate-800/80 p-1.5 rounded-lg border border-emerald-50 dark:border-slate-700 flex justify-between items-center text-[10px]"
                              >
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {h.name}
                                </span>
                                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                  {h.date} ({h.day})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Read-Only Expense Claims Widget */}
                      {msg.actionCard.type === "expense_widget" && (
                        <div className="bg-emerald-50/60 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/50 space-y-1.5">
                          <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                              {msg.actionCard.title}
                            </span>
                            <span className="text-[10px]">Total: ₹{msg.actionCard.data?.totalClaimedAmount?.toLocaleString()}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[10px] pt-1">
                            <div className="bg-white dark:bg-slate-800 p-1.5 rounded border border-emerald-100 dark:border-slate-700">
                              <span className="text-slate-500">Approved:</span> <strong className="text-emerald-600">₹{msg.actionCard.data?.approvedAmount?.toLocaleString()}</strong>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-1.5 rounded border border-emerald-100 dark:border-slate-700">
                              <span className="text-slate-500">Pending:</span> <strong className="text-amber-600">₹{msg.actionCard.data?.pendingAmount?.toLocaleString()}</strong>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Read-Only Overtime (OT) Summary Widget */}
                      {msg.actionCard.type === "overtime_widget" && (
                        <div className="bg-purple-50/60 dark:bg-purple-950/40 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/50 space-y-1.5">
                          <div className="text-[11px] font-bold text-purple-900 dark:text-purple-300 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-purple-600" />
                              {msg.actionCard.title}
                            </span>
                            <span className="text-[10px]">{msg.actionCard.data?.approvedHours}h Approved</span>
                          </div>
                          <div className="text-[10px] text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-800/80 p-1.5 rounded-lg border border-purple-100 dark:border-slate-700 flex justify-between">
                            <span>Total Claimed: <strong>{msg.actionCard.data?.totalHours} hours</strong></span>
                            <span>Pending: <strong>{msg.actionCard.data?.pendingHours} hours</strong></span>
                          </div>
                        </div>
                      )}

                      {/* Read-Only Payslip Widget */}
                      {msg.actionCard.type === "payslip_widget" && (
                        <div className="bg-teal-50/60 dark:bg-teal-950/40 p-2.5 rounded-xl border border-teal-100 dark:border-teal-900/50 space-y-1.5">
                          <div className="text-[11px] font-bold text-teal-900 dark:text-teal-300 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5 text-teal-600" />
                              {msg.actionCard.title}
                            </span>
                            <span className="text-[10px] font-mono">{msg.actionCard.data?.month}</span>
                          </div>
                          <div className="bg-white/90 dark:bg-slate-800/90 p-2 rounded-lg border border-teal-100 dark:border-slate-700 text-[10px] space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Gross Earnings:</span>
                              <span className="font-semibold">₹{msg.actionCard.data?.grossSalary?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Total Deductions:</span>
                              <span className="font-semibold text-rose-500">- ₹{msg.actionCard.data?.totalDeductions?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 text-teal-700 dark:text-teal-400 font-bold">
                              <span>Net Payable:</span>
                              <span>₹{msg.actionCard.data?.netPayable?.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Read-Only Notices & Announcements Widget */}
                      {msg.actionCard.type === "notices_widget" && (
                        <div className="bg-sky-50/60 dark:bg-sky-950/40 p-2.5 rounded-xl border border-sky-100 dark:border-sky-900/50 space-y-1.5">
                          <div className="text-[11px] font-bold text-sky-900 dark:text-sky-300 flex items-center gap-1">
                            <Bell className="w-3.5 h-3.5 text-sky-600" />
                            {msg.actionCard.title} ({msg.actionCard.data?.totalNotices || 0})
                          </div>
                          <div className="space-y-1 max-h-32 overflow-y-auto pt-1">
                            {msg.actionCard.data?.notices?.map((n, i) => (
                              <div key={i} className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-sky-100 dark:border-slate-700 text-[10px]">
                                <div className="font-semibold text-slate-800 dark:text-slate-200">{n.title}</div>
                                <div className="text-slate-500 text-[9px] truncate">{n.description}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Read-Only Support Tickets / Issues Widget */}
                      {msg.actionCard.type === "issues_widget" && (
                        <div className="bg-rose-50/60 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/50 space-y-1.5">
                          <div className="text-[11px] font-bold text-rose-900 dark:text-rose-300 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <HelpCircle className="w-3.5 h-3.5 text-rose-600" />
                              {msg.actionCard.title}
                            </span>
                            <span className="text-[10px]">{msg.actionCard.data?.totalIssues} Total</span>
                          </div>
                          <div className="space-y-1 max-h-32 overflow-y-auto pt-1">
                            {msg.actionCard.data?.issues?.map((iss, i) => (
                              <div key={i} className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-rose-100 dark:border-slate-700 text-[10px] flex justify-between items-center">
                                <span className="font-medium truncate max-w-[160px]">{iss.subject}</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">{iss.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Read-Only Resignation Status Widget */}
                      {msg.actionCard.type === "resignation_widget" && (
                        <div className="bg-red-50/60 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-100 dark:border-red-900/50 space-y-1.5">
                          <div className="text-[11px] font-bold text-red-900 dark:text-red-300 flex items-center gap-1">
                            <LogOut className="w-3.5 h-3.5 text-red-600" />
                            {msg.actionCard.title}
                          </div>
                          <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 text-[10px] space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Status:</span>
                              <span className="font-bold text-rose-600">{msg.actionCard.data?.status}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Notice End Date:</span>
                              <span className="font-mono">{msg.actionCard.data?.noticePeriodEndDate}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 📊 Dashboard Summary Widget */}
                      {msg.actionCard.type === "dashboard_summary_widget" && (
                        <div className="bg-gradient-to-br from-indigo-50/80 to-blue-50/80 dark:from-slate-900 dark:to-indigo-950/40 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/50 space-y-2">
                          <div className="text-[11px] font-bold text-indigo-950 dark:text-indigo-300 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Briefcase className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              Today's Overview ({msg.actionCard.data?.date})
                            </span>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                              {msg.actionCard.data?.punchStatus}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                            <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 space-y-0.5">
                              <span className="text-slate-400 font-medium block">Leave Balances</span>
                              <div className="font-bold text-slate-700 dark:text-slate-200">
                                CL: {msg.actionCard.data?.leaveBalances?.casual} • SL: {msg.actionCard.data?.leaveBalances?.sick} • PL: {msg.actionCard.data?.leaveBalances?.paid}
                              </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 space-y-0.5">
                              <span className="text-slate-400 font-medium block">Pending Requests</span>
                              <div className="font-bold text-amber-600 dark:text-amber-400">
                                {msg.actionCard.data?.pendingCounts?.total} Total Pending
                              </div>
                            </div>
                          </div>

                          <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 text-[10px] space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Next Holiday:</span>
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">{msg.actionCard.data?.nextHoliday}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Break Status:</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">{msg.actionCard.data?.breakStatus}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 📍 Field Work History Widget */}
                      {msg.actionCard.type === "field_work_widget" && (
                        <div className="bg-cyan-50/70 dark:bg-cyan-950/40 p-2.5 rounded-xl border border-cyan-200 dark:border-cyan-800/50 space-y-2">
                          <div className="text-[11px] font-bold text-cyan-950 dark:text-cyan-300 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-cyan-600" />
                              Field Work Activity
                            </span>
                            {msg.actionCard.data?.activeTrip && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 animate-pulse">
                                🟢 Trip In Progress
                              </span>
                            )}
                          </div>

                          <div className="space-y-1 max-h-36 overflow-y-auto">
                            {msg.actionCard.data?.trips?.length === 0 ? (
                              <div className="text-[10px] text-slate-500 italic p-2 bg-white dark:bg-slate-800 rounded-lg text-center">
                                No field trips recorded yet. Say "start field trip" to begin.
                              </div>
                            ) : (
                              msg.actionCard.data?.trips?.map((trip, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 text-[10px] flex justify-between items-center">
                                  <div>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                      {new Date(trip.startedAt).toLocaleDateString()}
                                    </span>
                                    <span className="text-slate-400 text-[9px]">
                                      {new Date(trip.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                      {trip.endedAt ? ` - ${new Date(trip.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : " (Running)"}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-cyan-700 dark:text-cyan-400 block">
                                      {(trip.distanceKm || 0).toFixed(1)} km
                                    </span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${trip.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                      {trip.status}
                                    </span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {/* 📋 SELECTABLE OPTIONS CARDS (e.g., Multiple Leaves to Cancel) */}
                      {(msg.actionCard.type === "select_leave_to_cancel" || msg.actionCard.options?.length > 0) && (
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-900 dark:to-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-indigo-900 dark:text-indigo-300 text-[11px] flex items-center gap-1">
                              <Ban className="w-3.5 h-3.5 text-rose-500" />
                              {msg.actionCard.title || "Select Option"}
                            </span>
                            <span className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                              {msg.actionCard.options?.length} Available
                            </span>
                          </div>

                          {msg.actionCard.executed ? (
                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-lg text-[10px] font-semibold">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              <span>{msg.actionCard.resultMessage || "Action completed successfully!"}</span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {msg.actionCard.options?.map((opt, idx) => (
                                <div
                                  key={opt.id || idx}
                                  className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-indigo-100 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-700 transition shadow-2xs space-y-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                                      {opt.leaveType || "Leave Request"}
                                    </span>
                                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                                      {opt.status || "Pending"}
                                    </span>
                                  </div>

                                  <div className="text-[10px] text-slate-600 dark:text-slate-300 space-y-0.5">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                                      <span className="font-medium">
                                        {opt.from} to {opt.to}
                                      </span>
                                      <span className="text-slate-400">({opt.totalDays} day(s))</span>
                                    </div>
                                    {opt.reason && (
                                      <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate">
                                        <strong>Reason:</strong> {opt.reason}
                                      </div>
                                    )}
                                  </div>

                                  <div className="pt-1 border-t border-slate-100 dark:border-slate-700/60 flex justify-end">
                                    <button
                                      onClick={() => handleConfirmAction(msg.id, opt.actionToken)}
                                      disabled={executingActionId === msg.id}
                                      className="w-full bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-semibold py-1.5 px-3 rounded-lg text-[10px] shadow transition flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                                    >
                                      {executingActionId === msg.id ? (
                                        "Cancelling..."
                                      ) : (
                                        <>
                                          <Ban className="w-3 h-3" />
                                          Cancel This Leave
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Write Action Cards */}
                      {msg.actionCard.type.startsWith("confirm_") && (
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-900 dark:to-amber-950/40 border border-amber-200 dark:border-amber-700/50 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-900 dark:text-amber-300 text-[11px] flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                              {msg.actionCard.title}
                            </span>
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full">
                              Signed Action
                            </span>
                          </div>

                          {/* ── EDITABLE INLINE FORM MODE ── */}
                          {editingCardId === msg.id ? (
                            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-amber-200 dark:border-slate-700 text-[10px] space-y-2">
                              {msg.actionCard.type === "confirm_leave_application" && (
                                <div className="space-y-1.5">
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <div>
                                      <label className="text-slate-500 font-semibold block text-[9px]">Leave Type</label>
                                      <select
                                        value={editFormData.leaveType || "Casual Leave"}
                                        onChange={(e) => setEditFormData({ ...editFormData, leaveType: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                      >
                                        <option value="Casual Leave">Casual Leave</option>
                                        <option value="Sick Leave">Sick Leave</option>
                                        <option value="Paid Leave">Paid Leave</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-slate-500 font-semibold block text-[9px]">Day Type</label>
                                      <select
                                        value={editFormData.leaveDayType || "Full Day"}
                                        onChange={(e) => setEditFormData({ ...editFormData, leaveDayType: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                      >
                                        <option value="Full Day">Full Day</option>
                                        <option value="Half Day">Half Day</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <div>
                                      <label className="text-slate-500 font-semibold block text-[9px]">From Date</label>
                                      <input
                                        type="date"
                                        value={editFormData.from || ""}
                                        onChange={(e) => setEditFormData({ ...editFormData, from: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-slate-500 font-semibold block text-[9px]">To Date</label>
                                      <input
                                        type="date"
                                        value={editFormData.to || ""}
                                        onChange={(e) => setEditFormData({ ...editFormData, to: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-slate-500 font-semibold block text-[9px]">Reason</label>
                                    <input
                                      type="text"
                                      value={editFormData.reason || ""}
                                      onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                      placeholder="Reason for leave"
                                    />
                                  </div>
                                </div>
                              )}

                              {msg.actionCard.type === "confirm_expense_request" && (
                                <div className="space-y-1.5">
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <div>
                                      <label className="text-slate-500 font-semibold block text-[9px]">Amount (₹)</label>
                                      <input
                                        type="number"
                                        value={editFormData.amount || ""}
                                        onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-slate-500 font-semibold block text-[9px]">Category</label>
                                      <select
                                        value={editFormData.category || "General"}
                                        onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                      >
                                        <option value="Travel">Travel</option>
                                        <option value="Food">Food</option>
                                        <option value="Internet">Internet</option>
                                        <option value="Equipment">Equipment</option>
                                        <option value="Stationery">Stationery</option>
                                        <option value="General">General</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-slate-500 font-semibold block text-[9px]">Date</label>
                                    <input
                                      type="date"
                                      value={editFormData.date || ""}
                                      onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-slate-500 font-semibold block text-[9px]">Description</label>
                                    <input
                                      type="text"
                                      value={editFormData.description || ""}
                                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                    />
                                  </div>
                                </div>
                              )}

                              {msg.actionCard.type === "confirm_overtime_request" && (
                                <div className="space-y-1.5">
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <div>
                                      <label className="text-slate-500 font-semibold block text-[9px]">Hours</label>
                                      <input
                                        type="number"
                                        step="0.5"
                                        value={editFormData.hours || ""}
                                        onChange={(e) => setEditFormData({ ...editFormData, hours: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-slate-500 font-semibold block text-[9px]">Date</label>
                                      <input
                                        type="date"
                                        value={editFormData.date || ""}
                                        onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                      />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <div>
                                      <label className="text-slate-500 font-semibold block text-[9px]">From Time</label>
                                      <input
                                        type="time"
                                        value={editFormData.fromTime || "18:00"}
                                        onChange={(e) => setEditFormData({ ...editFormData, fromTime: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-slate-500 font-semibold block text-[9px]">To Time</label>
                                      <input
                                        type="time"
                                        value={editFormData.toTime || "20:00"}
                                        onChange={(e) => setEditFormData({ ...editFormData, toTime: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-slate-500 font-semibold block text-[9px]">Task/Reason</label>
                                    <input
                                      type="text"
                                      value={editFormData.reason || ""}
                                      onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                    />
                                  </div>
                                </div>
                              )}

                              {msg.actionCard.type === "confirm_wfh_request" && (
                                <div className="space-y-1.5">
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <div>
                                      <label className="text-slate-500 font-semibold block text-[9px]">From Date</label>
                                      <input
                                        type="date"
                                        value={editFormData.fromDate || ""}
                                        onChange={(e) => setEditFormData({ ...editFormData, fromDate: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-slate-500 font-semibold block text-[9px]">To Date</label>
                                      <input
                                        type="date"
                                        value={editFormData.toDate || ""}
                                        onChange={(e) => setEditFormData({ ...editFormData, toDate: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-slate-500 font-semibold block text-[9px]">Reason</label>
                                    <input
                                      type="text"
                                      value={editFormData.reason || ""}
                                      onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                    />
                                  </div>
                                </div>
                              )}

                              {msg.actionCard.type === "confirm_punch_out_request" && (
                                <div className="space-y-1.5">
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <div>
                                      <label className="text-slate-500 font-semibold block text-[9px]">Date</label>
                                      <input
                                        type="date"
                                        value={editFormData.originalDate || ""}
                                        onChange={(e) => setEditFormData({ ...editFormData, originalDate: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-slate-500 font-semibold block text-[9px]">Punch Time</label>
                                      <input
                                        type="time"
                                        value={editFormData.time || "18:30"}
                                        onChange={(e) => setEditFormData({ ...editFormData, time: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-slate-500 font-semibold block text-[9px]">Reason</label>
                                    <input
                                      type="text"
                                      value={editFormData.reason || ""}
                                      onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                    />
                                  </div>
                                </div>
                              )}

                              {msg.actionCard.type === "confirm_issue_request" && (
                                <div className="space-y-1.5">
                                  <div>
                                    <label className="text-slate-500 font-semibold block text-[9px]">Subject</label>
                                    <input
                                      type="text"
                                      value={editFormData.subject || ""}
                                      onChange={(e) => setEditFormData({ ...editFormData, subject: e.target.value })}
                                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-slate-500 font-semibold block text-[9px]">Details</label>
                                    <textarea
                                      rows={2}
                                      value={editFormData.message || ""}
                                      onChange={(e) => setEditFormData({ ...editFormData, message: e.target.value })}
                                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                    />
                                  </div>
                                </div>
                              )}

                              {msg.actionCard.type === "confirm_resignation_request" && (
                                <div className="space-y-1.5">
                                  <div>
                                    <label className="text-slate-500 font-semibold block text-[9px]">Reason for Resignation</label>
                                    <input
                                      type="text"
                                      value={editFormData.reason || ""}
                                      onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                    />
                                  </div>
                                </div>
                              )}

                               {msg.actionCard.type === "confirm_work_update" && (
                                 <div className="space-y-1.5">
                                   <div>
                                     <label className="text-slate-500 font-semibold block text-[9px]">Task Title</label>
                                     <input
                                       type="text"
                                       value={editFormData.title || ""}
                                       onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                                       className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                     />
                                   </div>
                                   <div>
                                     <label className="text-slate-500 font-semibold block text-[9px]">Work Description / Tasks</label>
                                     <textarea
                                       rows={2}
                                       value={editFormData.description || ""}
                                       onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                       className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                     />
                                   </div>
                                   <div className="grid grid-cols-2 gap-2">
                                     <div>
                                       <label className="text-slate-500 font-semibold block text-[9px]">Completion (%)</label>
                                       <input
                                         type="number"
                                         min="0"
                                         max="100"
                                         value={editFormData.percentage !== undefined ? editFormData.percentage : 100}
                                         onChange={(e) => setEditFormData({ ...editFormData, percentage: e.target.value })}
                                         className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                       />
                                     </div>
                                     <div>
                                       <label className="text-slate-500 font-semibold block text-[9px]">Date</label>
                                       <input
                                         type="date"
                                         value={editFormData.date || ""}
                                         onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                                         className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                       />
                                     </div>
                                   </div>
                                 </div>
                               )}

                               {msg.actionCard.type === "confirm_late_correction" && (
                                 <div className="space-y-1.5">
                                   <div>
                                     <label className="text-slate-500 font-semibold block text-[9px]">Date</label>
                                     <input
                                       type="date"
                                       value={editFormData.date || ""}
                                       onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                                       className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                     />
                                   </div>
                                   <div>
                                     <label className="text-slate-500 font-semibold block text-[9px]">Reason for Late Arrival</label>
                                     <textarea
                                       rows={2}
                                       value={editFormData.reason || ""}
                                       onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                                       className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                     />
                                   </div>
                                 </div>
                               )}

                               {msg.actionCard.type === "confirm_update_wfh" && (
                                 <div className="space-y-1.5">
                                   <div className="grid grid-cols-2 gap-2">
                                     <div>
                                       <label className="text-slate-500 font-semibold block text-[9px]">From Date</label>
                                       <input
                                         type="date"
                                         value={editFormData.fromDate || ""}
                                         onChange={(e) => setEditFormData({ ...editFormData, fromDate: e.target.value })}
                                         className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                       />
                                     </div>
                                     <div>
                                       <label className="text-slate-500 font-semibold block text-[9px]">To Date</label>
                                       <input
                                         type="date"
                                         value={editFormData.toDate || ""}
                                         onChange={(e) => setEditFormData({ ...editFormData, toDate: e.target.value })}
                                         className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                       />
                                     </div>
                                   </div>
                                   <div>
                                     <label className="text-slate-500 font-semibold block text-[9px]">Reason</label>
                                     <input
                                       type="text"
                                       value={editFormData.reason || ""}
                                       onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                                       className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                     />
                                   </div>
                                 </div>
                               )}

                               {msg.actionCard.type === "confirm_notice_reply" && (
                                 <div className="space-y-1.5">
                                   <div>
                                     <label className="text-slate-500 font-semibold block text-[9px]">Reply Message</label>
                                     <textarea
                                       rows={2}
                                       value={editFormData.message || ""}
                                       onChange={(e) => setEditFormData({ ...editFormData, message: e.target.value })}
                                       className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                     />
                                   </div>
                                 </div>
                               )}

                                {msg.actionCard.type === "confirm_punch_break" && (
                                  <div className="space-y-1.5">
                                    <div>
                                      <label className="text-slate-500 font-semibold block text-[9px]">Break Type</label>
                                      <select
                                        value={editFormData.breakType || "Lunch Break"}
                                        onChange={(e) => setEditFormData({ ...editFormData, breakType: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                      >
                                        <option value="Lunch Break">Lunch Break</option>
                                        <option value="Tea Break">Tea Break</option>
                                        <option value="Coffee Break">Coffee Break</option>
                                        <option value="Short Break">Short Break</option>
                                        <option value="Snack Break">Snack Break</option>
                                        <option value="Rest Break">Rest Break</option>
                                      </select>
                                    </div>
                                  </div>
                                )}

                                {![
                                  "confirm_leave_application",
                                  "confirm_expense_request",
                                  "confirm_overtime_request",
                                  "confirm_wfh_request",
                                  "confirm_punch_out_request",
                                  "confirm_issue_request",
                                  "confirm_resignation_request",
                                  "confirm_work_update",
                                  "confirm_late_correction",
                                  "confirm_update_wfh",
                                  "confirm_notice_reply",
                                  "confirm_punch_break",
                                ].includes(msg.actionCard.type) && (
                                  <div className="space-y-1.5">
                                    {Object.entries(editFormData || {}).map(([k, v]) => {
                                      if (k.endsWith("Id") || k === "actionType" || k === "sub" || k === "status" || k === "isOnBreak") return null;
                                      return (
                                        <div key={k}>
                                          <label className="text-slate-500 font-semibold block text-[9px] capitalize">
                                            {k.replace(/([A-Z])/g, " $1")}
                                          </label>
                                          <input
                                            type="text"
                                            value={v !== undefined ? v : ""}
                                            onChange={(e) => setEditFormData({ ...editFormData, [k]: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-[10px]"
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                              {/* Edit Action Buttons */}
                              <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
                                <button
                                  onClick={() => handleSaveEdit(msg.id, msg.actionCard.type)}
                                  disabled={updatingTokenId === msg.id}
                                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-1.5 px-2.5 rounded-lg text-[10px] shadow transition flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                                >
                                  <Save className="w-3 h-3" />
                                  {updatingTokenId === msg.id ? "Regenerating..." : "Save & Update Token"}
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] transition font-medium cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* ── READ-ONLY CARD SUMMARY ── */
                            <div className="text-[10px] space-y-1 bg-white/80 dark:bg-slate-800/80 p-2 rounded-lg border border-amber-100 dark:border-slate-700">
                              {msg.actionCard.type === "confirm_leave_application" && (
                                <>
                                  <div><strong className="text-slate-500">Leave Type:</strong> {msg.actionCard.data.leaveType} ({msg.actionCard.data.leaveDayType || "Full Day"})</div>
                                  <div><strong className="text-slate-500">Duration:</strong> {msg.actionCard.data.from} to {msg.actionCard.data.to} ({msg.actionCard.data.totalDays} day(s))</div>
                                  <div><strong className="text-slate-500">Reason:</strong> {msg.actionCard.data.reason}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_cancel_leave" && (
                                <>
                                  <div><strong className="text-slate-500">Leave Type:</strong> {msg.actionCard.data.leaveType}</div>
                                  <div><strong className="text-slate-500">Dates:</strong> {msg.actionCard.data.from} to {msg.actionCard.data.to}</div>
                                  <div><strong className="text-slate-500">Action:</strong> Cancel Leave Request</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_wfh_request" && (
                                <>
                                  <div><strong className="text-slate-500">Mode:</strong> {msg.actionCard.data.requestedMode}</div>
                                  <div><strong className="text-slate-500">Dates:</strong> {msg.actionCard.data.fromDate} to {msg.actionCard.data.toDate}</div>
                                  <div><strong className="text-slate-500">Reason:</strong> {msg.actionCard.data.reason}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_punch_in" && (
                                <>
                                  <div><strong className="text-slate-500">Action:</strong> Punch In Attendance</div>
                                  <div><strong className="text-slate-500">Date & Time:</strong> {msg.actionCard.data.date} at {msg.actionCard.data.time}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_punch_out" && (
                                <>
                                  <div><strong className="text-slate-500">Action:</strong> Punch Out Attendance</div>
                                  <div><strong className="text-slate-500">Date & Time:</strong> {msg.actionCard.data.date} at {msg.actionCard.data.time}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_punch_break" && (
                                <>
                                  <div><strong className="text-slate-500">Action:</strong> {msg.actionCard.data.breakType || "Break"}</div>
                                  <div><strong className="text-slate-500">Time:</strong> {msg.actionCard.data.time}</div>
                                  <div><strong className="text-slate-500">Employee:</strong> {msg.actionCard.data.employeeName}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_late_correction" && (
                                <>
                                  <div><strong className="text-slate-500">Action:</strong> Late Arrival Justification</div>
                                  <div><strong className="text-slate-500">Date:</strong> {msg.actionCard.data.date}</div>
                                  <div><strong className="text-slate-500">Reason:</strong> {msg.actionCard.data.reason}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_request_ontime_login" && (
                                <>
                                  <div><strong className="text-slate-500">Action:</strong> Request On-Time Login</div>
                                  <div><strong className="text-slate-500">Date:</strong> {msg.actionCard.data.date}</div>
                                  <div><strong className="text-slate-500">Requested Punch-In:</strong> {msg.actionCard.data.requestedPunchIn || msg.actionCard.data.requestedTime || "09:30"}</div>
                                  <div><strong className="text-slate-500">Reason:</strong> {msg.actionCard.data.reason}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_update_wfh" && (
                                <>
                                  <div><strong className="text-slate-500">Action:</strong> Update WFH Request</div>
                                  <div><strong className="text-slate-500">Dates:</strong> {msg.actionCard.data.fromDate} to {msg.actionCard.data.toDate}</div>
                                  <div><strong className="text-slate-500">Reason:</strong> {msg.actionCard.data.reason}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_cancel_wfh" && (
                                <>
                                  <div><strong className="text-slate-500">Action:</strong> Cancel Work From Home (WFH)</div>
                                  <div><strong className="text-slate-500">Dates:</strong> {msg.actionCard.data.fromDate} to {msg.actionCard.data.toDate}</div>
                                  <div><strong className="text-slate-500">Mode:</strong> {msg.actionCard.data.mode}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_cancel_expense" && (
                                <>
                                  <div><strong className="text-slate-500">Action:</strong> Cancel Expense Claim</div>
                                  <div><strong className="text-slate-500">Claim Amount:</strong> ₹{msg.actionCard.data.amount?.toLocaleString()}</div>
                                  <div><strong className="text-slate-500">Category:</strong> {msg.actionCard.data.category}</div>
                                  <div><strong className="text-slate-500">Description:</strong> {msg.actionCard.data.description}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_cancel_overtime" && (
                                <>
                                  <div><strong className="text-slate-500">Action:</strong> Cancel Overtime Claim</div>
                                  <div><strong className="text-slate-500">Hours:</strong> {msg.actionCard.data.hours} hours</div>
                                  <div><strong className="text-slate-500">Date:</strong> {msg.actionCard.data.date}</div>
                                  <div><strong className="text-slate-500">Reason:</strong> {msg.actionCard.data.reason}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_notice_reply" && (
                                <>
                                  <div><strong className="text-slate-500">Announcement:</strong> {msg.actionCard.data.noticeTitle}</div>
                                  <div><strong className="text-slate-500">Your Reply:</strong> {msg.actionCard.data.message}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_expense_request" && (
                                <>
                                  <div><strong className="text-slate-500">Claim Amount:</strong> ₹{msg.actionCard.data.amount?.toLocaleString()}</div>
                                  <div><strong className="text-slate-500">Category:</strong> {msg.actionCard.data.category}</div>
                                  <div><strong className="text-slate-500">Date:</strong> {msg.actionCard.data.date}</div>
                                  <div><strong className="text-slate-500">Description:</strong> {msg.actionCard.data.description}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_overtime_request" && (
                                <>
                                  <div><strong className="text-slate-500">Overtime:</strong> {msg.actionCard.data.hours} hours</div>
                                  <div><strong className="text-slate-500">Date & Timing:</strong> {msg.actionCard.data.date} ({msg.actionCard.data.fromTime} - {msg.actionCard.data.toTime})</div>
                                  <div><strong className="text-slate-500">Task/Reason:</strong> {msg.actionCard.data.reason}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_punch_out_request" && (
                                <>
                                  <div><strong className="text-slate-500">Missing Punch Date:</strong> {msg.actionCard.data.originalDate} at {msg.actionCard.data.time}</div>
                                  <div><strong className="text-slate-500">Reason:</strong> {msg.actionCard.data.reason}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_issue_request" && (
                                <>
                                  <div><strong className="text-slate-500">Subject:</strong> {msg.actionCard.data.subject}</div>
                                  <div><strong className="text-slate-500">Details:</strong> {msg.actionCard.data.message}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_resignation_request" && (
                                <>
                                  <div><strong className="text-slate-500">Employee:</strong> {msg.actionCard.data.employeeName} ({msg.actionCard.data.department})</div>
                                  <div><strong className="text-slate-500">Reason:</strong> {msg.actionCard.data.reason}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_work_update" && (
                                <>
                                  <div><strong className="text-slate-500">Task Title:</strong> {msg.actionCard.data.title}</div>
                                  <div><strong className="text-slate-500">Summary:</strong> {msg.actionCard.data.description}</div>
                                  <div><strong className="text-slate-500">Completion:</strong> {msg.actionCard.data.percentage || 100}% on {msg.actionCard.data.date}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_update_profile" && (() => {
                                const fieldLabels = {
                                  email: "Email Address", bloodGroup: "Blood Group", qualification: "Qualification",
                                  name: "Full Name", gender: "Gender", phone: "Phone Number", mobile: "Mobile",
                                  address: "Address", aadhaarNumber: "Aadhaar Number", panNumber: "PAN Number",
                                  accountNumber: "Bank Account Number", bankName: "Bank Name", ifsc: "IFSC Code",
                                  branch: "Bank Branch", emergency: "Emergency Contact", nationality: "Nationality",
                                  bio: "Bio / About Me", dob: "Date of Birth", maritalStatus: "Marital Status",
                                  linkedin: "LinkedIn Profile", github: "GitHub Profile", instagram: "Instagram",
                                  website: "Portfolio Website",
                                };
                                const label = fieldLabels[msg.actionCard.data.field] || msg.actionCard.data.field;
                                return (
                                  <>
                                    <div><strong className="text-slate-500">Update:</strong> {label}</div>
                                    <div><strong className="text-slate-500">Current Value:</strong> {msg.actionCard.data.oldValue}</div>
                                    <div><strong className="text-slate-500">New Value:</strong> {msg.actionCard.data.value}</div>
                                  </>
                                );
                              })()}

                              {msg.actionCard.type === "confirm_start_field_work" && (
                                <>
                                  <div><strong className="text-slate-500">Action:</strong> Start Field Trip</div>
                                  <div><strong className="text-slate-500">Start Time:</strong> {msg.actionCard.data.time} ({msg.actionCard.data.date})</div>
                                  <div><strong className="text-slate-500">Employee:</strong> {msg.actionCard.data.employeeName}</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_end_field_work" && (
                                <>
                                  <div><strong className="text-slate-500">Action:</strong> End Field Trip</div>
                                  <div><strong className="text-slate-500">Started At:</strong> {msg.actionCard.data.startTimeFormatted}</div>
                                  <div><strong className="text-slate-500">Distance:</strong> {(msg.actionCard.data.distanceKm || 0).toFixed(1)} km</div>
                                </>
                              )}

                              {msg.actionCard.type === "confirm_send_message" && (
                                <>
                                  <div><strong className="text-slate-500">Recipient:</strong> {msg.actionCard.data.receiverName} ({msg.actionCard.data.receiverDepartment})</div>
                                  <div><strong className="text-slate-500">Message:</strong> "{msg.actionCard.data.messageText}"</div>
                                </>
                              )}
                            </div>
                          )}

                          {/* ── CARD BOTTOM ACTIONS ── */}
                          {msg.actionCard.executed ? (
                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 p-2 rounded-lg text-[10px] font-semibold">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              <span>{msg.actionCard.resultMessage}</span>
                            </div>
                          ) : (
                            editingCardId !== msg.id && (
                              <div className="flex items-center gap-2 pt-1">
                                {msg.actionCard.type !== "confirm_punch_in" && msg.actionCard.type !== "confirm_punch_out" && msg.actionCard.type !== "confirm_cancel_leave" && (
                                  <button
                                    onClick={() => handleStartEdit(msg)}
                                    className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 font-semibold rounded-lg text-[11px] transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                    title="Edit details before confirming"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                                    Edit Details
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    handleConfirmAction(
                                      msg.id,
                                      msg.actionCard.actionToken,
                                      msg.actionCard.type
                                    )
                                  }
                                  disabled={executingActionId === msg.id}
                                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-1.5 px-3 rounded-lg text-[11px] shadow transition flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                                >
                                  {executingActionId === msg.id ? (
                                    "Executing..."
                                  ) : (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Confirm & Submit
                                    </>
                                  )}
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-[9px] text-right mt-1 opacity-60 font-mono">
                    {msg.timestamp}
                  </div>
                </div>

                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
                <div className="w-6 h-6 rounded-lg bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* QUICK SUGGESTION PILLS */}
          <div className="px-3 py-2 bg-slate-50/80 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5 shrink-0 max-h-24 overflow-y-auto [&&::-webkit-scrollbar]:hidden [&&]:[scrollbar-width:none]">
            {QUICK_SUGGESTIONS.map((sug, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(sug)}
                disabled={loading}
                className="text-[10px] font-medium bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700 px-2.5 py-1 rounded-full border border-indigo-100/90 dark:border-slate-700/90 shadow-2xs transition flex items-center gap-1 cursor-pointer"
              >
                <span>{sug}</span>
                <ChevronRight className="w-2.5 h-2.5 opacity-60 shrink-0" />
              </button>
            ))}
          </div>

          {/* INPUT AREA */}
          <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Apply leave, cancel leave, WFH, punch in..."
                disabled={loading}
                className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 text-xs px-3.5 py-2.5 rounded-xl border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )}
</>
);
}
