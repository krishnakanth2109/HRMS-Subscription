import React, { useState, useEffect, useRef } from "react";
import {
  ShieldAlert,
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
  Users,
  Building2,
  TrendingUp,
  UserPlus,
  CheckSquare,
  XCircle,
  MapPin,
  Shield,
} from "lucide-react";
import {
  sendAdminCopilotMessage,
  executeAdminCopilotAction,
  updateAdminCopilotDraftAction,
} from "../../api";

const ADMIN_QUICK_SUGGESTIONS = [
  "Show organization overview",
  "Who is absent today?",
  "Show pending approvals",
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
          <span className="text-violet-500 font-bold leading-tight text-xs shrink-0">
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

export default function AdminAICopilot({ admin }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const storageKey = `vsync_admin_copilot_sessions_${admin?._id || admin?.id || "admin_default"}`;

  const createWelcomeMsg = () => ({
    id: `welcome-${Date.now()}`,
    role: "assistant",
    text: `Hello Administrator ${admin?.name || admin?.firstName || ""}! 🛡️ I am your **VSync Admin AI Copilot**. You can ask for **Live Attendance Overview**, **Absent Lists**, **Pending Approvals**, or execute actions like **Approve Leave**, **Review Expenses**, **Add Employees**, and **Post Notices**!`,
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
      console.warn("Could not read saved admin copilot sessions:", e);
    }
    const initId = `session-${Date.now()}`;
    return [
      {
        id: initId,
        title: "Admin Workspace",
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: "welcome-init",
            role: "assistant",
            text: `Hello Administrator ${admin?.name || admin?.firstName || ""}! 🛡️ I am your **VSync Admin AI Copilot**. You can ask for **Live Attendance Overview**, **Absent Lists**, **Pending Approvals**, or execute actions like **Approve Leave**, **Review Expenses**, **Add Employees**, and **Post Notices**!`,
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
          if (firstUserMsg && (s.title === "Admin Workspace" || !s.title)) {
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
      console.warn("Failed to persist admin copilot sessions:", e);
    }
  }, [sessions, storageKey]);

  const handleNewChat = () => {
    const newId = `session-${Date.now()}`;
    const newSession = {
      id: newId,
      title: "New Admin Session",
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
          title: "Admin Workspace",
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

      const res = await sendAdminCopilotMessage(queryText, chatHistory);

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: res.reply || "I have processed your administrative request.",
        sources: res.sources || [],
        actionCard: res.actionCard || null,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error("Admin Copilot Chat Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: `⚠️ Error: ${error?.response?.data?.reply || error?.response?.data?.error || error.message || "Failed to reach Admin Copilot server."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (msgId, actionToken, actionType) => {
    setExecutingActionId(msgId);
    try {
      const result = await executeAdminCopilotAction(actionToken, {});

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === msgId) {
            return {
              ...msg,
              actionCard: {
                ...msg.actionCard,
                executed: true,
                resultMessage: result.message || "Action successfully executed!",
              },
            };
          }
          return msg;
        })
      );

      // Trigger global event listeners so admin dashboard tables update live
      window.dispatchEvent(new Event("hrmsLeavesUpdated"));
      window.dispatchEvent(new Event("hrmsExpensesUpdated"));
      window.dispatchEvent(new Event("hrmsAttendanceUpdated"));
      window.dispatchEvent(new Event("hrmsEmployeeAdded"));
      window.dispatchEvent(new Event("hrmsEmployeeUpdated"));
      window.dispatchEvent(new Event("adminProfileUpdated"));
      window.dispatchEvent(new Event("hrmsNoticesUpdated"));
      window.dispatchEvent(new Event("hrmsShiftUpdated"));
    } catch (error) {
      console.error("Admin Action Execution Error:", error);
      alert(`Failed to execute admin action: ${error?.response?.data?.error || error.message}`);
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
      const res = await updateAdminCopilotDraftAction(actionType, editFormData);
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
      console.error("Failed to update draft admin action:", error);
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
        text: `Admin chat reset. How can I assist you with organization operations?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <>
      {/* 🚀 FLOATING ADMIN COPILOT BUTTON */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 select-none">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center justify-center p-3.5 bg-gradient-to-r from-violet-700 via-indigo-700 to-purple-800 text-white rounded-full shadow-2xl hover:shadow-violet-500/50 hover:scale-105 active:scale-95 transition-all duration-300 border border-white/20"
            title="Ask VSync Admin AI Copilot"
          >
            <span className="absolute -inset-1 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 rounded-full blur opacity-70 group-hover:opacity-100 transition duration-500 animate-pulse"></span>

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
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[95vw] sm:w-[440px] h-[600px] max-h-[85vh] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-violet-200 dark:border-violet-900/50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-violet-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div>
                <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  AI Copilot
                  <span className="text-[10px] bg-emerald-400/30 text-emerald-100 px-1.5 py-0.2 rounded-full font-normal">
                    Live
                  </span>
                </h3>
                <p className="text-[11px] text-violet-100 opacity-90">
                  Operations & Executive Control
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowHistory((prev) => !prev)}
                className={`p-1.5 rounded-lg transition text-violet-100 hover:text-white cursor-pointer ${
                  showHistory ? "bg-white/30 text-white font-semibold shadow-2xs" : "hover:bg-white/20"
                }`}
                title="Past Conversations"
              >
                <History className="w-4 h-4" />
              </button>
              <button
                onClick={handleNewChat}
                className="p-1.5 hover:bg-white/20 rounded-lg transition text-violet-100 hover:text-white cursor-pointer"
                title="New Session"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={handleClearChat}
                className="p-1.5 hover:bg-white/20 rounded-lg transition text-violet-100 hover:text-white cursor-pointer"
                title="Reset Chat"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition text-violet-100 hover:text-white cursor-pointer"
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
                  <History className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Past Admin Sessions</span>
                  <span className="text-[10px] bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 font-semibold px-2 py-0.5 rounded-full">
                    {sessions.length}
                  </span>
                </div>
                <button
                  onClick={handleNewChat}
                  className="px-2.5 py-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold rounded-lg text-[11px] transition flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Session
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
                          ? "bg-violet-50/90 dark:bg-violet-950/40 border-violet-300 dark:border-violet-700/80 shadow-2xs"
                          : "bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/70 hover:border-violet-200 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? "text-violet-600 dark:text-violet-400" : "text-slate-400"}`} />
                          <h4 className={`text-xs font-semibold truncate ${isActive ? "text-violet-900 dark:text-violet-200" : "text-slate-700 dark:text-slate-200"}`}>
                            {sess.title || firstUserMsg || "Admin Workspace"}
                          </h4>
                        </div>
                        <button
                          onClick={(e) => handleDeleteSession(sess.id, e)}
                          title="Delete Session"
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
                  className="text-xs text-violet-600 dark:text-violet-400 hover:underline font-semibold flex items-center justify-center gap-1 w-full py-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Active Copilot
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
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-gradient-to-r from-violet-700 to-indigo-700 text-white rounded-tr-none"
                          : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-none"
                      }`}
                    >
                      <FormattedMarkdownText content={msg.text} />

                      {/* 📊 DYNAMIC ADMIN WIDGETS & ACTION CARDS */}
                      {msg.actionCard && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-700/70 space-y-2">
                          {/* 1. Admin Dashboard Widget */}
                          {msg.actionCard.type === "admin_dashboard_widget" && (
                            <div className="bg-violet-50/70 dark:bg-violet-950/40 p-2.5 rounded-xl border border-violet-100 dark:border-violet-900/50 space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-bold text-violet-950 dark:text-violet-200">
                                <span className="flex items-center gap-1">
                                  <Building2 className="w-3.5 h-3.5 text-violet-600" />
                                  {msg.actionCard.title}
                                </span>
                                <span>{msg.actionCard.data?.totalEmployees} Total Staff</span>
                              </div>

                              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                                <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-violet-100 dark:border-slate-700">
                                  <span className="text-slate-500 block text-[9px]">Present</span>
                                  <strong className="text-emerald-600 text-xs">{msg.actionCard.data?.presentCount}</strong>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-violet-100 dark:border-slate-700">
                                  <span className="text-slate-500 block text-[9px]">On Break</span>
                                  <strong className="text-amber-600 text-xs">{msg.actionCard.data?.onBreakCount}</strong>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-violet-100 dark:border-slate-700">
                                  <span className="text-slate-500 block text-[9px]">Late Arrivals</span>
                                  <strong className="text-rose-600 text-xs">{msg.actionCard.data?.lateCount}</strong>
                                </div>
                              </div>

                              <div className="bg-white/90 dark:bg-slate-800/90 p-2 rounded-lg border border-violet-100 dark:border-slate-700 text-[10px] space-y-1">
                                <span className="font-semibold text-slate-700 dark:text-slate-300 block">Pending Approvals:</span>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-slate-600 dark:text-slate-400">
                                  <div>• Leaves: <strong>{msg.actionCard.data?.pendingApprovals?.leaves}</strong></div>
                                  <div>• Expenses: <strong>{msg.actionCard.data?.pendingApprovals?.expenses}</strong></div>
                                  <div>• WFH: <strong>{msg.actionCard.data?.pendingApprovals?.wfh}</strong></div>
                                  <div>• Overtime: <strong>{msg.actionCard.data?.pendingApprovals?.overtime}</strong></div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 2. Admin Live Attendance List Widget */}
                          {msg.actionCard.type === "admin_attendance_list_widget" && (
                            <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-bold text-indigo-950 dark:text-indigo-200">
                                <span>{msg.actionCard.title}</span>
                                <span>{msg.actionCard.data?.totalPresent} Clocked In</span>
                              </div>
                              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                {msg.actionCard.data?.records?.slice(0, 8).map((rec, i) => (
                                  <div key={i} className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-indigo-100 dark:border-slate-700 flex items-center justify-between text-[10px]">
                                    <div>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">{rec.name}</span>
                                      <span className="text-[9px] text-slate-400">{rec.department} • In: {rec.punchIn}</span>
                                    </div>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${rec.status === "ON BREAK" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                      {rec.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 3. Absent Employees List Widget */}
                          {msg.actionCard.type === "admin_absent_list_widget" && (
                            <div className="bg-rose-50/70 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/50 space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-bold text-rose-950 dark:text-rose-200">
                                <span>{msg.actionCard.title}</span>
                                <span className="text-rose-600">{msg.actionCard.data?.count} Absent</span>
                              </div>
                              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                {msg.actionCard.data?.absentList?.slice(0, 8).map((emp, i) => (
                                  <div key={i} className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-rose-100 dark:border-slate-700 flex justify-between items-center text-[10px]">
                                    <div>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">{emp.name} ({emp.employeeId})</span>
                                      <span className="text-[9px] text-slate-400">{emp.department || "General"}</span>
                                    </div>
                                    <span className="text-[9px] text-rose-500 font-semibold">Not Clocked In</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 4. Pending Approvals Hub Widget */}
                          {msg.actionCard.type === "admin_pending_approvals_widget" && (
                            <div className="bg-amber-50/70 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/50 space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-bold text-amber-950 dark:text-amber-200">
                                <span>{msg.actionCard.title}</span>
                                <span className="text-amber-700">{msg.actionCard.data?.total} Pending</span>
                              </div>
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {msg.actionCard.data?.leaves?.map((l, i) => (
                                  <div key={`l-${i}`} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-amber-100 dark:border-slate-700 flex justify-between items-center text-[10px] gap-2">
                                    <div className="flex-1 min-w-0">
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">Leave: {l.employee}</span>
                                      <span className="text-[9px] text-slate-400 block truncate">{l.type} • {l.dates}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => handleSend(`approve leave for ${l.employee}`)}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleSend(`reject leave for ${l.employee}`)}
                                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                ))}

                                {msg.actionCard.data?.attendanceRequests?.map((a, i) => (
                                  <div key={`a-${i}`} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-amber-100 dark:border-slate-700 flex justify-between items-center text-[10px] gap-2">
                                    <div className="flex-1 min-w-0">
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">Attendance: {a.employee}</span>
                                      <span className="text-[9px] text-slate-400 block truncate">{a.date} • Req: {a.requested} ({a.reason})</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => handleSend(`approve attendance request for ${a.employee}`)}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleSend(`reject attendance request for ${a.employee}`)}
                                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                ))}

                                {msg.actionCard.data?.expenses?.map((e, i) => (
                                  <div key={`e-${i}`} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-amber-100 dark:border-slate-700 flex justify-between items-center text-[10px] gap-2">
                                    <div className="flex-1 min-w-0">
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">Expense: {e.employee}</span>
                                      <span className="text-[9px] text-slate-400 block truncate">{e.category} • ₹{e.amount}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => handleSend(`approve expense for ${e.employee}`)}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleSend(`reject expense for ${e.employee}`)}
                                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                ))}

                                {msg.actionCard.data?.wfh?.map((w, i) => (
                                  <div key={`w-${i}`} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-amber-100 dark:border-slate-700 flex justify-between items-center text-[10px] gap-2">
                                    <div className="flex-1 min-w-0">
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">WFH: {w.employee}</span>
                                      <span className="text-[9px] text-slate-400 block truncate">{w.mode} • {w.reason}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => handleSend(`approve wfh for ${w.employee}`)}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleSend(`reject wfh for ${w.employee}`)}
                                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                ))}

                                {msg.actionCard.data?.overtime?.map((o, i) => (
                                  <div key={`o-${i}`} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-amber-100 dark:border-slate-700 flex justify-between items-center text-[10px] gap-2">
                                    <div className="flex-1 min-w-0">
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">Overtime: {o.employee}</span>
                                      <span className="text-[9px] text-slate-400 block truncate">{o.hours}h • {o.reason}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => handleSend(`approve overtime for ${o.employee}`)}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleSend(`reject overtime for ${o.employee}`)}
                                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                ))}

                                {msg.actionCard.data?.punchOuts?.map((p, i) => (
                                  <div key={`p-${i}`} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-amber-100 dark:border-slate-700 flex justify-between items-center text-[10px] gap-2">
                                    <div className="flex-1 min-w-0">
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">Punch-Out: {p.employee}</span>
                                      <span className="text-[9px] text-slate-400 block truncate">{p.date} • {p.reason}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => handleSend(`approve punch out for ${p.employee}`)}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleSend(`reject punch out for ${p.employee}`)}
                                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                {msg.actionCard.data?.resignations?.map((r, i) => (
                                  <div key={`r-${i}`} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-amber-100 dark:border-slate-700 flex justify-between items-center text-[10px] gap-2">
                                    <div className="flex-1 min-w-0">
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">Resignation: {r.employee}</span>
                                      <span className="text-[9px] text-slate-400 block truncate">{r.reason}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => handleSend(`approve resignation for ${r.employee}`)}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleSend(`reject resignation for ${r.employee}`)}
                                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 4B. Leave Requests Overview Widget */}
                          {msg.actionCard.type === "admin_leave_list_widget" && (
                            <div className="bg-purple-50/70 dark:bg-purple-950/40 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/50 space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-bold text-purple-950 dark:text-purple-200">
                                <span>{msg.actionCard.title}</span>
                                <span className="text-purple-700">{msg.actionCard.data?.total} Request(s)</span>
                              </div>
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {msg.actionCard.data?.leaves?.length === 0 ? (
                                  <div className="text-[10px] text-slate-500 py-2 text-center bg-white dark:bg-slate-800 rounded-lg">No leave requests found for this period.</div>
                                ) : (
                                  msg.actionCard.data?.leaves?.map((l, i) => (
                                    <div key={`lv-${i}`} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-purple-100 dark:border-slate-700 flex justify-between items-center text-[10px] gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{l.employee}</span>
                                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold ${l.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : l.status === 'Rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                                            {l.status}
                                          </span>
                                        </div>
                                        <span className="text-[9px] text-slate-400 block truncate">{l.type} • {l.dates}</span>
                                      </div>
                                      {l.status === "Pending" && (
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            onClick={() => handleSend(`approve leave for ${l.employee}`)}
                                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                          >
                                            Approve
                                          </button>
                                          <button
                                            onClick={() => handleSend(`reject leave for ${l.employee}`)}
                                            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}

                          {/* 4C. Notices & Announcements List Widget */}
                          {msg.actionCard.type === "admin_notices_widget" && (
                            <div className="bg-sky-50/70 dark:bg-sky-950/40 p-2.5 rounded-xl border border-sky-100 dark:border-sky-900/50 space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-bold text-sky-950 dark:text-sky-200">
                                <span>{msg.actionCard.title}</span>
                                <span className="text-sky-700">{msg.actionCard.data?.total} Broadcast(s)</span>
                              </div>
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {msg.actionCard.data?.notices?.length === 0 ? (
                                  <div className="text-[10px] text-slate-500 py-2 text-center bg-white dark:bg-slate-800 rounded-lg">No announcements found.</div>
                                ) : (
                                  msg.actionCard.data?.notices?.map((n, i) => (
                                    <div key={`not-${i}`} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-sky-100 dark:border-slate-700 text-[10px]">
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{n.title}</span>
                                        <span className="text-[8px] text-slate-400">{n.date}</span>
                                      </div>
                                      <p className="text-[9px] text-slate-500 line-clamp-2 mt-0.5">{n.description}</p>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}

                          {/* 4D. Live Activity & Idle Tracking Widget */}
                          {msg.actionCard.type === "admin_idle_tracking_widget" && (
                            <div className="bg-amber-50/70 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/50 space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-bold text-amber-950 dark:text-amber-200">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  {msg.actionCard.title}
                                </span>
                                <span className="text-amber-700">{msg.actionCard.data?.totalEmployees} Staff</span>
                              </div>

                              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                                <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-amber-100 dark:border-slate-700">
                                  <span className="text-slate-500 block text-[9px]">Idle Now</span>
                                  <strong className="text-amber-600 text-xs">{msg.actionCard.data?.idleCount}</strong>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-amber-100 dark:border-slate-700">
                                  <span className="text-slate-500 block text-[9px]">Active</span>
                                  <strong className="text-emerald-600 text-xs">{msg.actionCard.data?.workingCount}</strong>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-amber-100 dark:border-slate-700">
                                  <span className="text-slate-500 block text-[9px]">Offline</span>
                                  <strong className="text-slate-500 text-xs">{msg.actionCard.data?.offlineCount}</strong>
                                </div>
                              </div>

                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {msg.actionCard.data?.records?.map((r, i) => (
                                  <div key={`idle-${i}`} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-amber-100 dark:border-slate-700 flex justify-between items-center text-[10px] gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{r.name}</span>
                                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold ${r.status === 'IDLE' ? 'bg-amber-100 text-amber-800 animate-pulse' : r.status === 'WORKING' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                          {r.status}
                                        </span>
                                      </div>
                                      <span className="text-[9px] text-slate-400 block truncate">
                                        Idle: {r.idleTimeFormatted} • Work: {r.workHoursFormatted} • Win: {r.activeWindow}
                                      </span>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="text-[8px] text-slate-400 block">{r.lastPing}</span>
                                      {r.screenshotUrl && (
                                        <a href={r.screenshotUrl} target="_blank" rel="noopener noreferrer" className="text-[8px] text-violet-600 hover:underline font-bold">
                                          View Screen
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 4E. Office Location & Geofencing Settings Widget */}
                          {msg.actionCard.type === "admin_office_settings_widget" && (
                            <div className="bg-teal-50/70 dark:bg-teal-950/40 p-2.5 rounded-xl border border-teal-100 dark:border-teal-900/50 space-y-2">
                              <div className="text-[11px] font-bold text-teal-950 dark:text-teal-200 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-teal-600" />
                                  {msg.actionCard.title}
                                </span>
                                <span className="px-1.5 py-0.5 bg-teal-100 text-teal-800 rounded text-[9px] font-bold">
                                  Mode: {msg.actionCard.data?.globalWorkMode}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-1">
                                <div className="bg-white dark:bg-slate-800 p-1.5 rounded border border-teal-100 dark:border-slate-700">
                                  <span className="text-slate-500">Allowed Radius:</span> <strong>{msg.actionCard.data?.allowedRadius}m</strong>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-1.5 rounded border border-teal-100 dark:border-slate-700">
                                  <span className="text-slate-500">Tracker Interval:</span> <strong>{msg.actionCard.data?.screenshotIntervalMinutes} mins</strong>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-1.5 rounded border border-teal-100 dark:border-slate-700 col-span-2">
                                  <span className="text-slate-500">GPS Coordinates:</span> <code className="text-[9px] bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded">{msg.actionCard.data?.latitude}, {msg.actionCard.data?.longitude}</code>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 4F. Performance & Work Reports Widget */}
                          {msg.actionCard.type === "admin_performance_widget" && (
                            <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/50 space-y-2">
                              <div className="text-[11px] font-bold text-emerald-950 dark:text-emerald-200 flex items-center justify-between">
                                <span>{msg.actionCard.title}</span>
                                <span className="text-emerald-700">{msg.actionCard.data?.totalSubmitted} Submitted</span>
                              </div>
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {msg.actionCard.data?.records?.length === 0 ? (
                                  <div className="text-[10px] text-slate-500 py-2 text-center bg-white dark:bg-slate-800 rounded-lg">No work reports submitted for today.</div>
                                ) : (
                                  msg.actionCard.data?.records?.map((r, i) => (
                                    <div key={`perf-${i}`} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-emerald-100 dark:border-slate-700 flex justify-between items-center text-[10px] gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{r.employeeName}</span>
                                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold ${r.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : r.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                                            {r.status === 'approved' ? `${r.approvedPercentage}%` : r.status}
                                          </span>
                                        </div>
                                        <span className="text-[9px] text-slate-400 block truncate">{r.morningTitle}</span>
                                      </div>
                                      {r.status === "pending" ? (
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            onClick={() => handleSend(`approve work report for ${r.employeeName}`)}
                                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                          >
                                            Approve
                                          </button>
                                          <button
                                            onClick={() => handleSend(`reject work report for ${r.employeeName}`)}
                                            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold transition shadow-2xs cursor-pointer"
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-[9px] text-slate-400 capitalize">{r.status}</span>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}

                          {/* 4G. Support Admin Management Widget */}
                          {msg.actionCard.type === "admin_support_admins_widget" && (
                            <div className="bg-purple-50/70 dark:bg-purple-950/40 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/50 space-y-2">
                              <div className="text-[11px] font-bold text-purple-950 dark:text-purple-200 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <Shield className="w-3.5 h-3.5 text-purple-600" />
                                  {msg.actionCard.title}
                                </span>
                                <span className="text-purple-700">{msg.actionCard.data?.total} Sub-Admin(s)</span>
                              </div>
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {msg.actionCard.data?.admins?.map((s, i) => (
                                  <div key={`sa-${i}`} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-purple-100 dark:border-slate-700 flex justify-between items-center text-[10px] gap-2">
                                    <div className="flex-1 min-w-0">
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">{s.name}</span>
                                      <span className="text-[9px] text-slate-400 block truncate">{s.role} • {s.department}</span>
                                    </div>
                                    <span className="text-[9px] text-slate-400">{s.email}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 4H. Company Rules & Policies Widget */}
                          {msg.actionCard.type === "admin_rules_widget" && (
                            <div className="bg-rose-50/70 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/50 space-y-2">
                              <div className="text-[11px] font-bold text-rose-950 dark:text-rose-200 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <FileText className="w-3.5 h-3.5 text-rose-600" />
                                  {msg.actionCard.title}
                                </span>
                                <span className="text-rose-700">{msg.actionCard.data?.total} Policy / Rule(s)</span>
                              </div>
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {msg.actionCard.data?.rules?.length === 0 ? (
                                  <div className="text-[10px] text-slate-500 py-2 text-center bg-white dark:bg-slate-800 rounded-lg">No company rules published yet.</div>
                                ) : (
                                  msg.actionCard.data?.rules?.map((r, i) => (
                                    <div key={`rl-${i}`} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-rose-100 dark:border-slate-700 text-[10px]">
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{r.title}</span>
                                        <span className="text-[8px] text-slate-400">{r.date}</span>
                                      </div>
                                      <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-2">{r.description}</p>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}

                          {/* 5. Employee Profile Widget */}
                          {msg.actionCard.type === "admin_employee_profile_widget" && (
                            <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                              <div className="text-[11px] font-bold text-indigo-950 dark:text-indigo-200 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                                  {msg.actionCard.title}
                                </span>
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold">
                                  {msg.actionCard.data?.employee?.status || "Active"}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-1">
                                <div className="bg-white dark:bg-slate-800 p-1.5 rounded border border-indigo-100 dark:border-slate-700">
                                  <span className="text-slate-500">Department:</span> <strong>{msg.actionCard.data?.employee?.department || "N/A"}</strong>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-1.5 rounded border border-indigo-100 dark:border-slate-700">
                                  <span className="text-slate-500">Designation:</span> <strong>{msg.actionCard.data?.employee?.designation || "N/A"}</strong>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-1.5 rounded border border-indigo-100 dark:border-slate-700">
                                  <span className="text-slate-500">Salary:</span> <strong>₹{(msg.actionCard.data?.employee?.salary || 0).toLocaleString()}</strong>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-1.5 rounded border border-indigo-100 dark:border-slate-700">
                                  <span className="text-slate-500">Leaves Taken:</span> <strong>{msg.actionCard.data?.approvedLeavesCount || 0} days</strong>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 🔒 INTERACTIVE ADMIN CONFIRMATION CARDS */}
                          {msg.actionCard.actionToken && (
                            <div className="bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-xl p-3 space-y-2 text-[11px] animate-in fade-in duration-200">
                              <div className="flex items-center justify-between">
                                <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                  <span>{msg.actionCard.title}</span>
                                </div>
                        <span className="text-[9px] bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full font-semibold">
                                  Admin Action
                                </span>
                              </div>

                              {/* ── EDITABLE INLINE FORM MODE ── */}
                              {editingCardId === msg.id ? (
                                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-amber-200 dark:border-slate-700 text-[10px] space-y-2">
                                  {Object.entries(editFormData).map(([k, v]) => {
                                    if (k.endsWith("Id") || k === "actionType" || k === "adminId") return null;
                                    return (
                                      <div key={k} className="space-y-1">
                                        <label className="text-slate-500 font-semibold block text-[9px] capitalize">
                                          {k.replace(/([A-Z])/g, " $1")}
                                        </label>
                                        {k === "description" || k === "content" || k === "reason" ? (
                                          <textarea
                                            rows={2}
                                            value={v || ""}
                                            onChange={(e) => setEditFormData({ ...editFormData, [k]: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-violet-500"
                                          />
                                        ) : (
                                          <input
                                            type="text"
                                            value={v || ""}
                                            onChange={(e) => setEditFormData({ ...editFormData, [k]: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-violet-500"
                                          />
                                        )}
                                      </div>
                                    );
                                  })}

                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      onClick={() => handleSaveEdit(msg.id, msg.actionCard.type)}
                                      disabled={updatingTokenId === msg.id}
                                      className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold py-1.5 px-2.5 rounded-lg text-[10px] shadow transition flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
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
                                /* Form Details */
                                <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-lg border border-amber-200/50 dark:border-amber-900/40 space-y-1 text-slate-700 dark:text-slate-300">
                                  {Object.entries(msg.actionCard.data || {}).map(([k, v], idx) => {
                                    if (k === "leaveId" || k === "expenseId" || k === "requestId" || k === "attendanceId" || k === "overtimeId") return null;
                                    return (
                                      <div key={idx} className="flex justify-between items-center text-[10px]">
                                        <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, " $1")}:</span>
                                        <strong className="text-slate-800 dark:text-slate-200 text-right">{String(v || "N/A")}</strong>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Result or Buttons */}
                              {msg.actionCard.executed ? (
                                <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>{msg.actionCard.resultMessage}</span>
                                </div>
                              ) : (
                                editingCardId !== msg.id && (
                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      onClick={() => handleStartEdit(msg)}
                                      className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 font-semibold rounded-lg text-[11px] transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                                      title="Edit details before confirming"
                                    >
                                      <Edit3 className="w-3.5 h-3.5 text-violet-600" />
                                      Edit Details
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleConfirmAction(
                                          msg.id,
                                          msg.actionCard.actionToken,
                                          msg.actionCard.type
                                        )
                                      }
                                      disabled={executingActionId === msg.id}
                                      className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-1.5 px-3 rounded-lg text-[11px] shadow-xs transition flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                                    >
                                      {executingActionId === msg.id ? (
                                        "Executing..."
                                      ) : (
                                        <>
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          Confirm & Apply
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
                    </div>

                    {msg.role === "user" && (
                      <div className="w-7 h-7 rounded-xl bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
                    <div className="w-6 h-6 rounded-lg bg-violet-600/10 text-violet-600 flex items-center justify-center">
                      <Bot className="w-3.5 h-3.5 animate-spin" />
                    </div>
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* QUICK SUGGESTION PILLS */}
              <div className="px-3 py-2 bg-slate-50/80 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5 shrink-0">
                {ADMIN_QUICK_SUGGESTIONS.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(sug)}
                    disabled={loading}
                    className="text-[10px] font-medium bg-white dark:bg-slate-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-slate-700 px-2.5 py-1 rounded-full border border-violet-100/90 dark:border-slate-700/90 shadow-2xs transition flex items-center gap-1 cursor-pointer"
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
                    placeholder="Approve leave, check absent staff, post notice..."
                    disabled={loading}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 text-xs px-3.5 py-2.5 rounded-xl border border-transparent focus:border-violet-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition"
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="p-2.5 bg-gradient-to-r from-violet-700 to-indigo-700 hover:from-violet-800 hover:to-indigo-800 text-white rounded-xl shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
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
