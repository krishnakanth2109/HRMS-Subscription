import React, { useState, useEffect, useRef, useContext } from "react";
import { sendMessage, getGroupMessages } from "../api";
import { AuthContext } from "../context/AuthContext";
import { FaPaperPlane, FaTimes } from "react-icons/fa";

const GroupMessaging = ({ group, isOpen, onClose }) => {
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  // Get all group members (excluding current user)
  const getGroupMembers = () => {
    const members = group?.members?.map(m => ({
      id: m.employee?._id || m.employee,
      name: `${m.employee?.firstName || "Unknown"} ${m.employee?.lastName || ""}`,
      role: m.role,
    })) || [];

    // Add group leader if not current user
    if (group?.groupLeader) {
      const leaderId = group.groupLeader._id || group.groupLeader;
      if (leaderId.toString() !== user?.employeeId?.toString()) {
        const leaderName = group.groupLeader.firstName || "Group Leader";
        members.unshift({
          id: leaderId,
          name: leaderName,
          role: "leader",
        });
      }
    }

    return members.filter(m => m.id.toString() !== user?.employeeId?.toString());
  };

  // Load group messages
  useEffect(() => {
    if (isOpen && group?._id) {
      loadMessages();
      const interval = setInterval(loadMessages, 3000); // Poll every 3 seconds
      return () => clearInterval(interval);
    }
  }, [isOpen, group, selectedMember]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await getGroupMessages(group._id);
      
      // Filter messages for selected member if one is selected
      let filteredMessages = data;
      if (selectedMember) {
        filteredMessages = data.filter(
          m =>
            (m.sender._id === user?.employeeId && m.receiver._id === selectedMember) ||
            (m.sender._id === selectedMember && m.receiver._id === user?.employeeId)
        );
      }
      
      setMessages(filteredMessages);
      setError("");
    } catch (err) {
      console.error("Load messages error:", err);
      setError("Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedMember) {
      setError("Please select a member and type a message");
      return;
    }

    try {
      setLoading(true);
      await sendMessage(selectedMember, messageText.trim(), group._id);
      setMessageText("");
      await loadMessages();
      setError("");
    } catch (err) {
      console.error("Send message error:", err);
      setError("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const members = getGroupMembers();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between rounded-t-lg">
          <div>
            <h2 className="text-xl font-bold">{group?.groupName || "Group Messages"}</h2>
            <p className="text-sm text-blue-100">
              {selectedMember
                ? `Chat with ${members.find(m => m.id.toString() === selectedMember.toString())?.name || "Member"}`
                : "Select a member to chat"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 p-2 rounded transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Members Sidebar */}
          <div className="w-1/4 border-r bg-gray-50 overflow-y-auto">
            <div className="p-4 space-y-2">
              <h3 className="font-bold text-gray-700 mb-4">Members</h3>
              {members.length === 0 ? (
                <p className="text-gray-500 text-sm">No other members</p>
              ) : (
                members.map(member => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMember(member.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      selectedMember?.toString() === member.id.toString()
                        ? "bg-blue-500 text-white shadow-md"
                        : "bg-white hover:bg-gray-100 text-gray-800"
                    }`}
                  >
                    <div className="font-semibold text-sm">{member.name}</div>
                    <div className={`text-xs ${selectedMember?.toString() === member.id.toString() ? "text-blue-100" : "text-gray-500"}`}>
                      {member.role}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 flex flex-col">
            {selectedMember ? (
              <>
                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex ${
                          msg.sender._id === user?.employeeId ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 rounded-lg ${
                            msg.sender._id === user?.employeeId
                              ? "bg-blue-500 text-white rounded-br-none"
                              : "bg-gray-300 text-gray-800 rounded-bl-none"
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <p className={`text-xs mt-1 ${msg.sender._id === user?.employeeId ? "text-blue-100" : "text-gray-600"}`}>
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="p-4 border-t bg-white">
                  {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-2 text-sm">
                      {error}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type your message..."
                      disabled={loading}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                    <button
                      type="submit"
                      disabled={loading || !messageText.trim()}
                      className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                    >
                      <FaPaperPlane size={16} />
                      Send
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 text-lg">Select a member to start messaging</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupMessaging;
