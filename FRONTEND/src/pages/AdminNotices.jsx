// --- START OF FILE AdminNotices.jsx ---

import React, { useState, useEffect, useCallback, useRef } from "react";
import { getAllNoticesForAdmin, addNotice, getEmployees, deleteNoticeById, updateNotice, sendAdminReplyWithImage } from "../api"; 
import api from "../api"; 
import Swal from 'sweetalert2';
import {
  FaEdit, FaTrash, FaPlus, FaTimes, FaSearch, FaCheck,
  FaChevronDown, FaChevronUp, FaUserTag, FaEye, FaReply, FaPaperPlane,
  FaBullhorn,
  FaUserFriends,
  FaUsers,
  FaLayerGroup,
  FaUsersCog,
  FaSave,
  FaExclamationCircle,
  FaCommentDots,
  FaArrowLeft,
  FaRobot,
  FaPaperclip,
  FaVideo,
  FaCalendarAlt,
  FaClock,
  FaLink,
  FaExternalLinkAlt
} from 'react-icons/fa';

import { getAttendanceByDateRange } from "../api";

// Helper to ensure URLs are always HTTPS (From EmployeeProfile reference)
const getSecureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http:")) {
    return url.replace("http:", "https:");
  }
  return url;
};

const AdminNotices = () => {
  // --- STATE ---
  const initialFormState = { title: "", description: "", recipients: [], sendTo: 'ALL', selectedGroupId: null };
  const [noticeData, setNoticeData] = useState(initialFormState);
  const [notices, setNotices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [employeeWorkingStatus, setEmployeeWorkingStatus] = useState({});

  // UI States
  const [editingNoticeId, setEditingNoticeId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // ✅ MEETING STATE
  const DEFAULT_MEETING_LINK = "https://meet.google.com/tsn-vrih-zvx";
  const [isMeetingMode, setIsMeetingMode] = useState(false);
  const [meetingParams, setMeetingParams] = useState({ date: "", time: "" });
  
  // ✅ NEW: Meeting Link State
  const [meetingLink, setMeetingLink] = useState(DEFAULT_MEETING_LINK);
  const [isLinkEditable, setIsLinkEditable] = useState(false);

  // Toggle for "Specific" recipients list
  const [expandedRecipientNoticeId, setExpandedRecipientNoticeId] = useState(null);

  // ✅ POPUP STATES
  const [viewedByNotice, setViewedByNotice] = useState(null);
  const [repliesNotice, setRepliesNotice] = useState(null);

  // ✅ CHAT STATES
  const [selectedChatEmployeeId, setSelectedChatEmployeeId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  
  // ✅ Image Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const [previewImage, setPreviewImage] = useState(null);

  // ✅ NEW: Profile Images State for Sidebar
  const [employeeImages, setEmployeeImages] = useState({});

  // ✅ NEW: Ref to store local image URL to prevent "Flash" upon server sync
  const lastUploadedImageRef = useRef(null);

  // ✅ STATIC QUICK REPLIES
  const staticQuickReplies = ["Ok", "Come To My Cabin", "Do It Fast", "Call me", "Update me when done"];

  const messagesEndRef = useRef(null);

  // -------------------------------------------------------------------------
  // ✅ READ STATUS MANAGEMENT
  // -------------------------------------------------------------------------
  const [readState, setReadState] = useState({});
  const [readStateConfigId, setReadStateConfigId] = useState(null);

  const saveReadStateToBackend = async (updatedState) => {
    try {
      const payload = {
        title: "__SYSTEM_READ_STATE__",
        description: JSON.stringify(updatedState),
        recipients: []
      };
      if (readStateConfigId) {
        await updateNotice(readStateConfigId, payload);
      } else {
        await addNotice(payload);
      }
    } catch (error) {
      console.error("Failed to sync read state", error);
    }
  };

  // -------------------------------------------------------------------------
  // ✅ GROUP MANAGEMENT STATE
  // -------------------------------------------------------------------------
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groups, setGroups] = useState([]);
  const [groupConfigId, setGroupConfigId] = useState(null);

  const [groupForm, setGroupForm] = useState({ name: "", members: [] });
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [viewUnassigned, setViewUnassigned] = useState(false);

  const saveGroupsToBackend = async (updatedGroups) => {
    try {
      const payload = {
        title: "__SYSTEM_GROUPS_CONFIG__",
        description: JSON.stringify(updatedGroups),
        recipients: []
      };
      if (groupConfigId) {
        await updateNotice(groupConfigId, payload);
      } else {
        await addNotice(payload);
      }
      setGroups(updatedGroups);
    } catch (error) {
      console.error("Failed to save groups", error);
      Swal.fire("Error", "Could not save groups to server.", "error");
    }
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) return Swal.fire("Error", "Group name is required", "error");
    if (groupForm.members.length === 0) return Swal.fire("Error", "Select at least one employee", "error");

    let updatedGroups;
    if (editingGroupId) {
      updatedGroups = groups.map(g =>
        g.id === editingGroupId ? { ...g, name: groupForm.name, members: groupForm.members } : g
      );
      Swal.fire("Success", "Group updated", "success");
    } else {
      const newGroup = {
        id: Date.now().toString(),
        name: groupForm.name,
        members: groupForm.members
      };
      updatedGroups = [...groups, newGroup];
      Swal.fire("Success", "Group created", "success");
    }

    await saveGroupsToBackend(updatedGroups);
    resetGroupForm();
  };

  const handleEditGroup = (group) => {
    setEditingGroupId(group.id);
    setGroupForm({ name: group.name, members: group.members });
    setViewUnassigned(false);
  };

  const handleDeleteGroup = (groupId) => {
    if (window.confirm("Are you sure you want to delete this group?")) {
      const updatedGroups = groups.filter(g => g.id !== groupId);
      saveGroupsToBackend(updatedGroups);
      if (editingGroupId === groupId) resetGroupForm();
    }
  };

  const resetGroupForm = () => {
    setGroupForm({ name: "", members: [] });
    setEditingGroupId(null);
    setGroupSearchTerm("");
    setViewUnassigned(false);
  };

  const toggleGroupMemberSelection = (employeeId) => {
    setGroupForm(prev => {
      const isSelected = prev.members.includes(employeeId);
      if (isSelected) {
        return { ...prev, members: prev.members.filter(id => id !== employeeId) };
      } else {
        return { ...prev, members: [...prev.members, employeeId] };
      }
    });
  };

  const getUnassignedEmployees = () => {
    const assignedIds = new Set();
    if(Array.isArray(groups)) {
        groups.forEach(g => {
        if (Array.isArray(g.members)) {
            g.members.forEach(m => assignedIds.add(String(m)));
        }
        });
    }
    return employees.filter(e => !assignedIds.has(String(e._id)));
  };

  // --- API CALLS ---
  const fetchNotices = useCallback(async () => {
    try {
      const data = await getAllNoticesForAdmin();
      if (!Array.isArray(data)) return;

      try {
        const configNotice = data.find(n => n.title === "__SYSTEM_GROUPS_CONFIG__");
        if (configNotice) {
          setGroupConfigId(configNotice._id);
          const parsedGroups = JSON.parse(configNotice.description);
          if (Array.isArray(parsedGroups)) {
            setGroups(prev => JSON.stringify(prev) !== JSON.stringify(parsedGroups) ? parsedGroups : prev);
          }
        }
      } catch (e) { console.error("Error parsing group config", e); }

      try {
        const readConfig = data.find(n => n.title === "__SYSTEM_READ_STATE__");
        if (readConfig) {
          setReadStateConfigId(readConfig._id);
          const parsedState = JSON.parse(readConfig.description);
          setReadState(prev => JSON.stringify(prev) !== JSON.stringify(parsedState) ? parsedState : prev);
        }
      } catch (e) { console.error("Error parsing read state", e); }

      const realNotices = data.filter(n => n.title !== "__SYSTEM_GROUPS_CONFIG__" && n.title !== "__SYSTEM_READ_STATE__");
      const sortedData = realNotices.sort((a, b) => new Date(b.date) - new Date(a.date));

      setNotices(prevNotices => {
        if (JSON.stringify(prevNotices) !== JSON.stringify(sortedData)) {
          return sortedData;
        }
        return prevNotices;
      });

      if (repliesNotice) {
        const updatedNotice = sortedData.find(n => n._id === repliesNotice._id);
        // ✅ FIX: Do NOT update active notice if we are currently sending a reply.
        // This prevents the optimistic (local) image from disappearing during the backend sync.
        if (!sendingReply && updatedNotice && JSON.stringify(updatedNotice.replies) !== JSON.stringify(repliesNotice.replies)) {
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
  }, [repliesNotice, viewedByNotice, sendingReply]); // ✅ Added sendingReply to deps

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await getEmployees();
      if (Array.isArray(data)) {
        setEmployees(data.filter(emp => emp.isActive !== false));
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  }, []);

  const fetchEmployeeWorkingStatus = useCallback(async () => {
    try {
      const todayISO = new Date().toISOString().split("T")[0];
      const attendanceData = await getAttendanceByDateRange(todayISO, todayISO);

      const statusMap = {};
      employees.forEach(emp => {
        statusMap[emp.employeeId] = 'offline';
      });

      if (Array.isArray(attendanceData)) {
        attendanceData.forEach(record => {
          if (record.punchIn && !record.punchOut) {
            statusMap[record.employeeId] = 'online';
          } else if (record.punchIn && record.punchOut) {
            statusMap[record.employeeId] = 'offline';
          }
        });
      }
      setEmployeeWorkingStatus(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(statusMap)) { return statusMap; }
        return prev;
      });
    } catch (error) { console.error("Error fetching employee working status:", error); }
  }, [employees]);

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

  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotices();
      if (employees.length > 0) {
        fetchEmployeeWorkingStatus();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchNotices, fetchEmployeeWorkingStatus, employees.length]);

  // ✅ FETCH PROFILE PICTURES FOR SIDEBAR
  useEffect(() => {
    const loadSidebarImages = async () => {
      if (!repliesNotice || !repliesNotice.replies || employees.length === 0) return;

      // Identify unique employees involved in the chat
      const uniqueEmployeeIds = new Set();
      repliesNotice.replies.forEach(r => {
        if (r.sentBy === 'Employee') {
           const id = r.employeeId?._id || r.employeeId;
           if (id) uniqueEmployeeIds.add(id);
        }
      });

      // Iterate and fetch if not already loaded
      uniqueEmployeeIds.forEach(async (id) => {
        const empObj = employees.find(e => e._id === id);
        if (empObj && empObj.employeeId && !employeeImages[empObj.employeeId]) {
          try {
            // Using logic from EmployeeProfile to fetch specific profile
            const res = await api.get(`/api/profile/${empObj.employeeId}`);
            if (res?.data?.profilePhoto?.url) {
              setEmployeeImages(prev => ({
                ...prev,
                [empObj.employeeId]: getSecureUrl(res.data.profilePhoto.url)
              }));
            }
          } catch (err) {
            // Silent fail, just keep initials
            console.error(`Failed to load sidebar image for ${empObj.employeeId}`);
          }
        }
      });
    };

    loadSidebarImages();
  }, [repliesNotice, employees]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [repliesNotice, selectedChatEmployeeId]);

  useEffect(() => {
    if (repliesNotice && selectedChatEmployeeId) {
      let latestMsgId = null;
      if (selectedChatEmployeeId === 'ALL_EMPLOYEES') {
      } else {
        const empMsgs = repliesNotice.replies.filter(r => (r.employeeId?._id || r.employeeId) === selectedChatEmployeeId && r.sentBy === 'Employee');
        if (empMsgs.length > 0) {
          latestMsgId = empMsgs[empMsgs.length - 1]._id;
        }
      }

      if (latestMsgId) {
        const storageKey = `${repliesNotice._id}_${selectedChatEmployeeId}`;
        if (readState[storageKey] !== latestMsgId) {
          const newState = { ...readState, [storageKey]: latestMsgId };
          setReadState(newState);
          saveReadStateToBackend(newState); 
        }
      }
    }
  }, [repliesNotice, selectedChatEmployeeId, readState]);


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
    setIsMeetingMode(false); // Default to normal notice
    if (notice) {
      setEditingNoticeId(notice._id);
      
      // ✅ CHECK IF IT'S A MEETING TO ENABLE EDIT MODE CORRECTLY
      const detectedLink = notice.description ? (notice.description.match(/(https?:\/\/[^\s]+)/) || [])[0] : null;
      const dateMatch = notice.description.match(/scheduled meeting\s+(\d{4}-\d{2}-\d{2})/i);
      const timeMatch = notice.description.match(/at\s+(\d{2}:\d{2})/i);

      if (detectedLink && dateMatch && timeMatch) {
          setIsMeetingMode(true);
          setMeetingParams({
              date: dateMatch[1],
              time: timeMatch[1]
          });
          setMeetingLink(detectedLink);
          setIsLinkEditable(false);
      } else {
          setIsMeetingMode(false);
      }

      const isSpecific = Array.isArray(notice.recipients) && notice.recipients.length > 0;

      let identifiedGroup = null;
      if (isSpecific) {
        const recipientSet = new Set(notice.recipients);
        identifiedGroup = groups.find(g =>
          g.members.length === notice.recipients.length &&
          g.members.every(m => recipientSet.has(m))
        );
      }

      setNoticeData({
        title: notice.title,
        description: notice.description,
        recipients: isSpecific ? notice.recipients : [],
        sendTo: identifiedGroup ? 'GROUP' : (isSpecific ? 'SPECIFIC' : 'ALL'),
        selectedGroupId: identifiedGroup ? identifiedGroup.id : null
      });
    } else {
      setEditingNoticeId(null);
      setNoticeData(initialFormState);
    }
    setIsModalOpen(true);
  };

  const openMeetingModal = () => {
    setEditingNoticeId(null);
    setNoticeData({ ...initialFormState, title: "📅 Scheduled Meeting" });
    setMeetingParams({ date: "", time: "" });
    setMeetingLink(DEFAULT_MEETING_LINK);
    setIsLinkEditable(false);
    setIsMeetingMode(true);
    setIsModalOpen(true);
  };

  const updateMeetingDescription = (date, time, link) => {
    const desc = `Dear Candidate,

You are requested to join the scheduled meeting ${date || '{date}'} at ${time || '{time}'} as per the shared details. Please ensure you join on time and stay available for discussion.

Meeting Link: ${link || '{link}'}`;
    
    setNoticeData(prev => ({ ...prev, description: desc }));
  };

  const handleMeetingParamChange = (e) => {
    const { name, value } = e.target;
    const newParams = { ...meetingParams, [name]: value };
    setMeetingParams(newParams);
    updateMeetingDescription(newParams.date, newParams.time, meetingLink);
  };

  // ✅ HANDLE LINK CHANGE
  const handleLinkChange = (e) => {
      const newLink = e.target.value;
      setMeetingLink(newLink);
      updateMeetingDescription(meetingParams.date, meetingParams.time, newLink);
  }

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingNoticeId(null);
    setNoticeData(initialFormState);
    setIsDropdownOpen(false);
    setSearchTerm("");
    setIsMeetingMode(false);
  };

  const handleNoticeGroupSelect = (group) => {
    setNoticeData(prev => ({
      ...prev,
      selectedGroupId: group.id,
      recipients: group.members
    }));
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
    
    // Validate Meeting Params
    if (isMeetingMode) {
        if (!meetingParams.date || !meetingParams.time) {
            Swal.fire("Error", "Please select both date and time for the meeting.", "error");
            setIsSubmitting(false);
            return;
        }
        if (!meetingLink) {
            Swal.fire("Error", "Meeting link is required", "error");
            setIsSubmitting(false);
            return;
        }
    }

    try {
      let finalRecipients = [];
      if (noticeData.sendTo === 'ALL') {
        finalRecipients = 'ALL';
      } else if (noticeData.sendTo === 'SPECIFIC') {
        finalRecipients = noticeData.recipients;
      } else if (noticeData.sendTo === 'GROUP') {
        finalRecipients = noticeData.recipients;
      }

      // Ensure description is up to date for meetings
      let finalDescription = noticeData.description;
      if (isMeetingMode) {
          finalDescription = `Dear Candidate,

You are requested to join the scheduled meeting ${meetingParams.date} at ${meetingParams.time} as per the shared details. Please ensure you join on time and stay available for discussion.

Meeting Link: ${meetingLink}`;
      }

      if (editingNoticeId) {
        const updatePayload = {
          title: noticeData.title,
          description: finalDescription,
          recipients: finalRecipients
        };
        await updateNotice(editingNoticeId, updatePayload);
        Swal.fire('Updated', 'Notice updated successfully.', 'success');
      } else {
        const payload = {
          title: noticeData.title,
          description: finalDescription,
          recipients: finalRecipients === 'ALL' ? [] : finalRecipients,
        };
        await addNotice(payload);
        Swal.fire('Posted', isMeetingMode ? 'Meeting Scheduled successfully.' : 'Notice sent successfully.', 'success');
      }
      closeModal();
      fetchNotices();
    } catch (error) {
      Swal.fire('Error', 'Something went wrong.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ NEW: FILE HANDLERS
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) { Swal.fire("Error", "File too large. Max 5MB.", "error"); return; }
        setSelectedFile(file);
    }
  };
  
  const clearSelectedFile = () => {
    setSelectedFile(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  // ✅ UPDATED ADMIN REPLY TO SUPPORT IMAGES WITH OPTIMISTIC UI & NO FLASH
  const handleAdminReply = async (manualText = null) => {
    const textToSend = manualText || replyText;
    
    // Allow if either text OR file exists
    if ((!textToSend || !textToSend.trim()) && !selectedFile) return;
    if (!repliesNotice || !selectedChatEmployeeId) return;

    // 1. Create local preview URL for optimistic update
    let tempImageUrl = null;
    if (selectedFile) {
        tempImageUrl = URL.createObjectURL(selectedFile);
        // ✅ SAVE BLOB URL TO REF (To prevent flash later)
        lastUploadedImageRef.current = { url: tempImageUrl, timestamp: Date.now() };
    }

    // 2. Create Optimistic Message Object
    const optimisticReply = {
        _id: Date.now(),
        message: textToSend,
        image: tempImageUrl,
        sentBy: 'Admin',
        repliedAt: new Date().toISOString(),
        // For 'ALL_EMPLOYEES' optimistic view, we don't need a specific ID to render it in the stream
        // But for specific chat, we set it.
        employeeId: selectedChatEmployeeId === 'ALL_EMPLOYEES' ? null : selectedChatEmployeeId,
        isSending: true // ✅ Flag to show loading spinner
    };

    // 3. Update Local State Immediately
    setRepliesNotice(prev => ({
        ...prev,
        replies: [...(prev.replies || []), optimisticReply]
    }));

    setReplyText("");
    setSelectedFile(null); 
    if(fileInputRef.current) fileInputRef.current.value = "";

    setSendingReply(true); // ✅ Prevents fetchNotices from overwriting us
    
    try {
      if (selectedChatEmployeeId === 'ALL_EMPLOYEES') {
        const uniqueEmployeeIds = [...new Set(repliesNotice.replies.map(r => r.employeeId?._id || r.employeeId))];
        
        // Loop through all employees in chat
        const replyPromises = uniqueEmployeeIds.map(empId => {
          if (!empId) return Promise.resolve();

          if (selectedFile) {
             const formData = new FormData();
             formData.append("message", textToSend);
             formData.append("targetEmployeeId", empId);
             formData.append("image", selectedFile);
             // We can pass the file object directly, but for ALL loop we might need to recreate formData or pass same
             // Since formData can be reused in some browsers or recreated. 
             // To be safe in loop:
             const loopFormData = new FormData();
             loopFormData.append("message", textToSend);
             loopFormData.append("targetEmployeeId", empId);
             loopFormData.append("image", selectedFile); // selectedFile is defined in scope
             return sendAdminReplyWithImage(repliesNotice._id, loopFormData);
          } else {
             return api.post(`/api/notices/${repliesNotice._id}/admin-reply`, {
                message: textToSend,
                targetEmployeeId: empId
             });
          }
        });
        await Promise.all(replyPromises);
      } else {
        // Single Employee Chat
        if (selectedFile) {
             const formData = new FormData();
             formData.append("message", textToSend);
             formData.append("targetEmployeeId", selectedChatEmployeeId);
             formData.append("image", selectedFile);
             await sendAdminReplyWithImage(repliesNotice._id, formData);
        } else {
             await api.post(`/api/notices/${repliesNotice._id}/admin-reply`, {
                message: textToSend,
                targetEmployeeId: selectedChatEmployeeId
             });
        }
      }
      
      // ✅ Fetch new data AFTER upload completes
      await fetchNotices();

    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to send reply", "error");
    } finally {
      setSendingReply(false); // ✅ Allow fetchNotices to resume
    }
  };

  const handleDeleteReply = async (noticeId, replyId, sentBy, messageContent, messageTime) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      if (selectedChatEmployeeId === 'ALL_EMPLOYEES' && sentBy === 'Admin') {
        const targetTime = new Date(messageTime).getTime();
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
        await api.delete(`/api/notices/${noticeId}/reply/${replyId}`);
      }
      fetchNotices();
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to delete message", "error");
    }
  };

  const getGroupedReplies = (notice) => {
    if (!notice.replies) return {};
    const groups = notice.replies.reduce((acc, reply) => {
      const empId = reply.employeeId?._id || reply.employeeId;
      const empName = reply.employeeId?.name || "Unknown";
      if (empId) {
        if (!acc[empId]) {
          acc[empId] = { name: empName, messages: [], hasUnread: false, employeeId: empId };
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
        const storedLastId = readState[storageKey];

        if (selectedChatEmployeeId === empId) {
          group.hasUnread = false;
        } else {
          if (lastEmployeeMsg._id === storedLastId) {
            group.hasUnread = false;
          } else {
            group.hasUnread = group.messages.some(m => m.sentBy === 'Employee' && !m.isRead);
          }
        }
      }
    });
    return groups;
  };

  const handleChatSelection = async (empId) => {
    setSelectedChatEmployeeId(empId);

    if (empId === 'ALL_EMPLOYEES') {
      if (!repliesNotice.replies) return;
      const uniqueEmployeeIds = [...new Set(repliesNotice.replies.map(r => r.employeeId?._id || r.employeeId))];
      const updatedReplies = repliesNotice.replies.map(r => ({ ...r, isRead: true }));
      setRepliesNotice({ ...repliesNotice, replies: updatedReplies });

      const newReadMap = { ...readState };
      uniqueEmployeeIds.forEach(uid => {
        const empMsgs = repliesNotice.replies.filter(r => (r.employeeId?._id || r.employeeId) === uid && r.sentBy === 'Employee');
        if (empMsgs.length > 0) {
          const lastId = empMsgs[empMsgs.length - 1]._id;
          newReadMap[`${repliesNotice._id}_${uid}`] = lastId;
        }
      });
      setReadState(newReadMap);
      saveReadStateToBackend(newReadMap);

      try {
        await Promise.all(uniqueEmployeeIds.map(uid => api.put(`/api/notices/${repliesNotice._id}/reply/read/${uid}`)));
        fetchNotices();
      } catch (error) { console.error("Failed to mark group as read", error); }
      return;
    }

    let latestMsgId = null;
    if (repliesNotice && repliesNotice.replies) {
      const empMsgs = repliesNotice.replies.filter(r => (r.employeeId?._id || r.employeeId) === empId && r.sentBy === 'Employee');
      if (empMsgs.length > 0) latestMsgId = empMsgs[empMsgs.length - 1]._id;
    }

    if (repliesNotice && latestMsgId) {
      const storageKey = `${repliesNotice._id}_${empId}`;
      const newState = { ...readState, [storageKey]: latestMsgId };
      setReadState(newState);
      saveReadStateToBackend(newState);
    }

    if (repliesNotice) {
      const updatedReplies = repliesNotice.replies.map(r => {
        const rEmpId = r.employeeId?._id || r.employeeId;
        if (rEmpId === empId && r.sentBy === 'Employee') return { ...r, isRead: true };
        return r;
      });
      setRepliesNotice({ ...repliesNotice, replies: updatedReplies });
    }

    try {
      await api.put(`/api/notices/${repliesNotice._id}/reply/read/${empId}`);
      fetchNotices();
    } catch (error) { console.error("Failed to mark messages as read", error); }
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

  const findEmployeeByEmployeeId = (id) => {
    return employees.find(emp => emp._id === id || emp.employeeId === id);
  };

  const getGroupNameForNotice = (recipientIds) => {
    if (!recipientIds || recipientIds === 'ALL' || recipientIds.length === 0) return null;
    const recipientSet = new Set(recipientIds);
    const matchedGroup = groups.find(g =>
      g.members.length === recipientIds.length &&
      g.members.every(m => recipientSet.has(m))
    );
    return matchedGroup ? matchedGroup.name : null;
  };

  const getSmartReplies = (messages, empId) => {
    let contextReplies = [...staticQuickReplies];
    if (messages && messages.length > 0) {
      const lastEmpMsg = [...messages].reverse().find(m => m.sentBy === 'Employee');
      if (lastEmpMsg) {
        const txt = lastEmpMsg.message.toLowerCase();
        if (txt.includes('hi') || txt.includes('hello')) contextReplies = ["Hello!", "Hi there", ...contextReplies];
        if (txt.includes('thank')) contextReplies = ["You're welcome", "No problem", ...contextReplies];
        if (txt.includes('done') || txt.includes('completed')) contextReplies = ["Great work", "Thanks for the update", ...contextReplies];
        if (txt.includes('leave')) contextReplies = ["Get well soon", "Approved", ...contextReplies];
      }
    }
    return [...new Set(contextReplies)];
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      {/* HEADER */}
      <div className="relative bg-gradient-to-br from-emerald-50/50 to-white border-b border-emerald-100 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-xl flex items-center justify-center shadow-sm shadow-emerald-100">
                <FaBullhorn className="text-white text-xl" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full border-2 border-emerald-500"></div>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Team <span className="text-emerald-600">Announcements</span></h1>
              <p className="text-sm text-gray-600 font-medium mt-1">Share important updates and keep everyone informed</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsGroupModalOpen(true)} className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2.5 rounded-lg font-semibold shadow-sm transition-all duration-200 border border-indigo-200"><FaUsersCog className="text-lg" /> <span className="hidden sm:inline">Manage Groups</span></button>
            <button onClick={() => openMeetingModal()} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:shadow transition-all duration-200 border border-indigo-700/20"><FaVideo className="text-sm" /> <span className="hidden sm:inline">Create Meeting</span></button>
            <button onClick={() => openModal()} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:shadow transition-all duration-200 border border-emerald-600/20"><FaPlus className="text-sm" /> <span className="hidden sm:inline">Create Announcement</span></button>
          </div>
        </div>
      </div>

      {/* NOTICE FEED */}
      <div className="max-w-4xl mx-auto px-4 mt-8 space-y-6">
        {notices.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-300 mx-4"><div className="text-5xl mb-4 grayscale opacity-30">📯</div><p className="text-slate-400 text-lg font-medium">No active notices.</p><p className="text-slate-300 text-sm">Create one to notify your team.</p></div>
        ) : (
          notices.map((notice, index) => {
            const { date, time } = formatDateTime(notice.date);
            const isSpecific = notice.recipients && notice.recipients.length > 0 && notice.recipients !== 'ALL';
            const recipientNames = isSpecific ? getRecipientNamesList(notice.recipients) : [];
            const isExpandedRecipients = expandedRecipientNoticeId === notice._id;
            const groupName = isSpecific ? getGroupNameForNotice(notice.recipients) : null;
            const viewCount = notice.readBy ? notice.readBy.length : 0;
            const groupedChats = getGroupedReplies(notice);
            const activeChatCount = Object.keys(groupedChats).length;

            const unreadConversationsCount = Object.values(groupedChats).filter(group => group.hasUnread).length;

            // CHECK IF IT IS A MEETING
            const detectedLink = notice.description ? (notice.description.match(/(https?:\/\/[^\s]+)/) || [])[0] : null;
            const isMeeting = detectedLink && (notice.title.toLowerCase().includes('meeting') || notice.description.toLowerCase().includes('meeting') || notice.description.includes('meet.google'));

            let borderColor = 'border-slate-100';
            let sideBarColor = 'bg-gradient-to-b from-blue-500 to-cyan-500';

            if (isSpecific) {
              if (groupName) {
                sideBarColor = 'bg-gradient-to-b from-indigo-600 to-violet-600';
                borderColor = 'border-indigo-100';
              } else {
                sideBarColor = 'bg-gradient-to-b from-amber-500 to-orange-500';
                borderColor = 'border-orange-100';
              }
            }
            if (isMeeting) {
                 sideBarColor = 'bg-gradient-to-b from-rose-500 to-pink-500';
                 borderColor = 'border-rose-100';
            }

            return (
              <div key={notice._id} className={`group relative bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 border ${borderColor} overflow-visible`}>
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${sideBarColor}`}></div>
                <div className="p-6 pl-8">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {isMeeting && (
                            <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-rose-200"><FaVideo /> Meeting</span>
                        )}
                        {isSpecific ? (
                          groupName ? (
                            <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-indigo-200"><FaLayerGroup /> {groupName}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-amber-200">🔒 Specific</span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-cyan-50 text-cyan-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-cyan-200">📢 Everyone</span>
                        )}

                        {isSpecific && (<button onClick={() => toggleRecipientList(notice._id)} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 px-3 py-1 rounded-full cursor-pointer hover:bg-slate-100">{recipientNames.length} Cands {isExpandedRecipients ? <FaChevronUp /> : <FaChevronDown />}</button>)}
                        <button onClick={() => setViewedByNotice(notice)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-green-600 transition-colors bg-green-50 px-3 py-1 rounded-full border border-green-100 cursor-pointer"><FaEye /> {viewCount}</button>

                        {/* CHAT BUTTON - HIDDEN IF 0 */}
                        {activeChatCount > 0 && (
                          <button onClick={() => { setRepliesNotice(notice); setSelectedChatEmployeeId(null); }} className={`relative flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border cursor-pointer bg-white text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all`}>
                            <FaCommentDots className="text-indigo-500" /> {activeChatCount} Chats
                            {unreadConversationsCount > 0 && (
                              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] text-white font-bold border-2 border-white shadow-sm">
                                {unreadConversationsCount}
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out origin-top ${isExpandedRecipients ? 'max-h-60 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}><div className="bg-slate-50 rounded-lg p-3 border border-slate-200 shadow-inner"><div className="flex flex-wrap gap-2">{recipientNames.map((name, i) => (<span key={i} className="flex items-center gap-1 bg-white text-slate-700 text-xs font-semibold px-2 py-1 rounded border border-slate-200 shadow-sm"><FaUserTag className="text-slate-300" /> {name}</span>))}</div></div></div>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 self-start whitespace-nowrap"><span>{date}</span><span className="h-3 w-px bg-slate-300"></span><span>{time}</span></div>
                  </div>
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-blue-700 transition-colors">{notice.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{notice.description}</p>
                    
                    {/* ✅ SHOW JOIN BUTTON IF MEETING AND LINK EXISTS */}
                    {isMeeting && detectedLink && (
                        <div className="mt-4">
                            <a href={detectedLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-md hover:shadow-lg transition-all">
                                <FaVideo /> Join Now
                            </a>
                        </div>
                    )}
                  </div>
                  <div className="pt-4 border-t border-slate-50 flex justify-end gap-2 opacity-100 sm:opacity-0 sm:translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"><button onClick={() => openModal(notice)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm"><FaEdit /> Edit</button><button onClick={() => handleDelete(notice._id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm"><FaTrash /> Delete</button></div>
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
            <div className="px-6 py-4 border-b border-green-100 flex justify-between items-center bg-green-50"><h3 className="font-bold text-green-800 flex items-center gap-2"><FaEye /> Viewed By ({viewedByNotice.readBy ? viewedByNotice.readBy.length : 0})</h3><button onClick={() => setViewedByNotice(null)} className="text-green-800 hover:bg-green-100 p-1 rounded"><FaTimes /></button></div>
            <div className="p-4 overflow-y-auto bg-slate-50 custom-scrollbar">{viewedByNotice.readBy && viewedByNotice.readBy.length > 0 ? (<div className="space-y-2">{[...viewedByNotice.readBy].reverse().map((record, index) => (<div key={index} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-xs font-bold text-green-700">{record.employeeId?.name?.charAt(0) || "U"}</div><div><p className="text-sm font-bold text-slate-700">{record.employeeId?.name || "Unknown"}</p><p className="text-[10px] text-slate-400">{record.employeeId?.employeeId || "N/A"}</p></div></div><div className="text-right text-[10px] text-slate-400"><p>{formatDateTime(record.readAt).date}</p><p>{formatDateTime(record.readAt).time}</p></div></div>))}</div>) : (<div className="text-center py-8 text-slate-400 italic">No one has viewed this yet.</div>)}</div>
          </div>
        </div>
      )}

      {/* ✅ FULL SCREEN TEAMS-STYLE CHAT MODAL */}
      {repliesNotice && (
        <div className="fixed inset-0 z-[120] bg-white flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-200">
          {/* Header (Mobile Only) */}
          <div className="md:hidden bg-slate-800 text-white p-4 flex items-center justify-between shadow-md z-20">
            <div className="flex items-center gap-3"><button onClick={() => selectedChatEmployeeId ? setSelectedChatEmployeeId(null) : setRepliesNotice(null)} className="text-white"><FaArrowLeft /></button><span className="font-bold truncate">{selectedChatEmployeeId ? (selectedChatEmployeeId === 'ALL_EMPLOYEES' ? 'Group Chat' : 'Chat') : 'Messages'}</span></div>
          </div>

          {/* SIDEBAR */}
          <div className={`w-full md:w-[350px] bg-slate-100 border-r border-slate-200 flex flex-col h-full ${selectedChatEmployeeId ? 'hidden md:flex' : 'flex'}`}>
            {/* Desktop Header */}
            <div className="hidden md:flex bg-slate-800 text-white p-4 items-start gap-4 shadow-sm">
              <h2 className="font-bold flex items-center gap-2 whitespace-nowrap"><FaCommentDots /> Inbox</h2>
              <h2 className="flex-1 font-semibold text-base leading-snug break-words" title={repliesNotice?.title}>{repliesNotice?.title}</h2>
              <button onClick={() => setRepliesNotice(null)} className="hover:bg-slate-700 p-2 rounded-full self-start"><FaTimes /></button>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div onClick={() => handleChatSelection('ALL_EMPLOYEES')} className={`p-4 cursor-pointer border-b border-slate-200 flex items-center gap-3 hover:bg-white transition-colors ${selectedChatEmployeeId === 'ALL_EMPLOYEES' ? 'bg-white border-l-4 border-l-indigo-600' : ''}`}>
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-lg"><FaUsers /></div>
                <div><h4 className="font-bold text-slate-800">Team Chat</h4><p className="text-xs text-slate-500">All responses in one place</p></div>
              </div>
              {Object.keys(getGroupedReplies(repliesNotice)).length === 0 ? (
                <div className="text-center py-10 text-slate-400"><p>No private replies yet.</p></div>
              ) : (
                Object.entries(getGroupedReplies(repliesNotice)).map(([empId, data]) => {
                  const lastMsg = data.messages[data.messages.length - 1];
                  const employee = findEmployeeByEmployeeId(empId);
                  const isWorking = employee ? isEmployeeWorking(employee.employeeId) : false;
                  
                  // ✅ GET PROFILE PIC IF AVAILABLE
                  const profilePic = employee && employee.employeeId ? employeeImages[employee.employeeId] : null;

                  return (
                    <div key={empId} onClick={() => handleChatSelection(empId)} className={`p-4 cursor-pointer border-b border-slate-200 flex items-center gap-3 hover:bg-white transition-colors relative ${selectedChatEmployeeId === empId ? 'bg-white border-l-4 border-l-indigo-600 shadow-sm' : ''}`}>
                      <div className="relative">
                        {/* ✅ SIDEBAR AVATAR UPDATE */}
                        <div 
                           className="w-12 h-12 rounded-full bg-white border border-slate-300 flex items-center justify-center text-slate-600 font-bold text-lg shadow-sm overflow-hidden"
                           onClick={(e) => {
                             if (profilePic) {
                               e.stopPropagation();
                               setPreviewImage(profilePic);
                             }
                           }}
                        >
                            {profilePic ? (
                                <img src={profilePic} alt={data.name} className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-zoom-in" />
                            ) : (
                                data.name.charAt(0)
                            )}
                        </div>
                        
                        {data.hasUnread && selectedChatEmployeeId !== empId && <span className="absolute -top-1 -right-1 flex h-4 w-4 bg-red-500 rounded-full border-2 border-white"></span>}
                        {isWorking && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-center mb-1"><h4 className={`truncate ${data.hasUnread && selectedChatEmployeeId !== empId ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-700'}`}>{data.name}</h4><span className="text-[10px] text-slate-400">{formatDateTime(lastMsg.repliedAt).time}</span></div>
                        <p className={`text-xs truncate ${data.hasUnread && selectedChatEmployeeId !== empId ? 'font-bold text-slate-800' : 'text-slate-500'}`}>{lastMsg.sentBy === 'Admin' && 'You: '}{lastMsg.message || 'Image'}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* CHAT AREA */}
          <div className={`flex-1 bg-white flex flex-col h-full ${!selectedChatEmployeeId ? 'hidden md:flex' : 'flex'}`}>
            {selectedChatEmployeeId ? (() => {
              let displayMessages = [], chatTitle = "", isOnline = false, subText = "";
              const groupData = getGroupedReplies(repliesNotice)[selectedChatEmployeeId];

              if (selectedChatEmployeeId === 'ALL_EMPLOYEES') {
                chatTitle = "Team Chat (Broadcast)";
                const participants = new Set([...(repliesNotice.replies || []).map(r => r.employeeId?._id || r.employeeId)]);
                let onlineCount = 0;
                participants.forEach(pid => {
                  const emp = employees.find(e => e._id === pid || e.employeeId === pid);
                  if (emp && isEmployeeWorking(emp.employeeId)) onlineCount++;
                });
                const offlineCount = participants.size - onlineCount;
                subText = `${onlineCount} Online, ${offlineCount} Offline`;

                const allMessages = [...(repliesNotice.replies || [])].sort((a, b) => new Date(a.repliedAt) - new Date(b.repliedAt));
                // Add logic here to include the optimistic message if it doesn't have an ID (broadcast case)
                // For simplified display, we just push all. If optimistic message has null employeeId, it might appear detached in group chat logic
                // But generally "Team Chat" displays all.
                const isMultiUserChat = participants.size > 1;
                let currentAdminCluster = [];
                const processAdminCluster = (cluster) => { if (!isMultiUserChat) { displayMessages.push(cluster[0]); return; } if (cluster.length > 1) { displayMessages.push(cluster[0]); } };
                allMessages.forEach(msg => { if (msg.sentBy === 'Employee') { if (currentAdminCluster.length > 0) { processAdminCluster(currentAdminCluster); currentAdminCluster = []; } displayMessages.push(msg); } else { if (currentAdminCluster.length === 0) { currentAdminCluster.push(msg); } else { const last = currentAdminCluster[currentAdminCluster.length - 1]; const timeDiff = new Date(msg.repliedAt) - new Date(last.repliedAt); if (msg.message === last.message && timeDiff < 2000) { currentAdminCluster.push(msg); } else { processAdminCluster(currentAdminCluster); currentAdminCluster = [msg]; } } } });
                if (currentAdminCluster.length > 0) { processAdminCluster(currentAdminCluster); }
              } else {
                const employee = findEmployeeByEmployeeId(selectedChatEmployeeId);
                chatTitle = employee ? employee.name : "Unknown User";
                isOnline = employee ? isEmployeeWorking(employee.employeeId) : false;
                subText = isOnline ? '● Online' : '● Offline';
                if (groupData) displayMessages = groupData.messages;
              }

              const smartReplies = getSmartReplies(displayMessages, selectedChatEmployeeId);

              return (
                <>
                  {/* Chat Header */}
                  <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white shadow-sm z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">{selectedChatEmployeeId === 'ALL_EMPLOYEES' ? <FaUsers /> : chatTitle.charAt(0)}</div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-lg leading-tight">{chatTitle}</h3>
                        <span className={`text-xs flex items-center gap-1 font-medium ${subText.includes('Online') ? 'text-green-600' : 'text-slate-400'}`}>{subText}</span>
                      </div>
                    </div>
                    <button onClick={() => setRepliesNotice(null)} className="hidden md:block hover:bg-slate-100 p-2 rounded-full text-slate-500"><FaTimes size={20} /></button>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 bg-[#f5f5f5]">
                    <div className="flex justify-center mb-4"><div className="bg-indigo-50 text-indigo-800 px-4 py-2 rounded-lg text-sm max-w-lg text-center border border-indigo-100 shadow-sm"><strong className="block text-xs uppercase tracking-wider mb-1 text-indigo-400">Context</strong>"{repliesNotice.description}"</div></div>
                    {displayMessages.map((msg, i) => {
                      const isAdmin = msg.sentBy === 'Admin';
                      const msgEmp = findEmployeeByEmployeeId(msg.employeeId?._id || msg.employeeId);

                      // ✅ SMART IMAGE RENDERING to Prevent Flash
                      let imageSrc = msg.image;
                      // If this is the LAST message sent by Admin (Me), and we have a local blob stored recently,
                      // prefer the local blob to prevent the "download flash" from the server URL.
                      const isLastMessage = i === displayMessages.length - 1;
                      if (isAdmin && isLastMessage && !msg.isSending && lastUploadedImageRef.current) {
                          // Use Blob if timestamp is fresh (< 30 seconds)
                          if (Date.now() - lastUploadedImageRef.current.timestamp < 30000) {
                              imageSrc = lastUploadedImageRef.current.url;
                          }
                      }

                      return (
                        <div key={i} className={`flex w-full ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] md:max-w-[60%] p-4 rounded-2xl text-sm shadow-sm relative group ${isAdmin ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'}`}>
                            {!isAdmin && (
                              <div className="text-[10px] font-bold text-indigo-500 mb-1 border-b border-slate-100 pb-1 flex justify-between gap-4">
                                <span>{msgEmp ? msgEmp.name : "User"}</span>
                                <span className="text-slate-400 font-normal">{msgEmp ? msgEmp.employeeId : ""}</span>
                              </div>
                            )}

                             {/* ✅ DISPLAY IMAGE IF EXISTS + LOADING OVERLAY */}
                             {imageSrc && (
                              <div className="mb-2 relative cursor-pointer" onClick={() => !msg.isSending && setPreviewImage(imageSrc)}>
                                <img 
                                  src={imageSrc} 
                                  alt="attachment" 
                                  className={`rounded-lg max-w-full max-h-48 object-cover border border-black/10 transition-opacity ${msg.isSending ? 'opacity-70' : 'hover:opacity-90'}`}
                                />
                                
                                {/* ✅ SPINNER OVERLAY */}
                                {msg.isSending && (
                                   <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                                       <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                                   </div>
                                )}
                              </div>
                            )}

                            <p className="leading-relaxed">{msg.message}</p>
                            <div className={`text-[10px] mt-2 text-right ${isAdmin ? 'text-indigo-200' : 'text-slate-400'}`}>{formatDateTime(msg.repliedAt).time}</div>
                            {/* Hide delete button while sending */}
                            {!msg.isSending && (
                                <button onClick={() => handleDeleteReply(repliesNotice._id, msg._id, msg.sentBy, msg.message, msg.repliedAt)} className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/10 ${isAdmin ? 'text-white' : 'text-slate-500'}`}><FaTrash size={10} /></button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Quick Replies & Input */}
                  <div className="p-4 bg-white border-t border-slate-200">
                    
                     {/* ✅ FILE PREVIEW ABOVE INPUT */}
                     {selectedFile && (
                        <div className="mb-2 p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                 <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-10 h-10 object-cover rounded bg-white border" />
                                 <div>
                                     <p className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{selectedFile.name}</p>
                                     <p className="text-[10px] text-slate-500">{(selectedFile.size/1024).toFixed(1)} KB</p>
                                 </div>
                             </div>
                             <button onClick={clearSelectedFile} className="text-slate-400 hover:text-red-500"><FaTimes /></button>
                        </div>
                     )}

                    <div className="flex gap-2 overflow-x-auto pb-3 custom-scrollbar">
                      <div className="flex items-center gap-1 text-xs font-bold text-indigo-400 px-2 select-none"><FaRobot /> AI Suggestions:</div>
                      {smartReplies.map((reply, idx) => (
                        <button key={idx} onClick={() => setReplyText(reply)} className="whitespace-nowrap px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-slate-600 text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all">{reply}</button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                      {/* ✅ FILE ATTACH BUTTON */}
                      <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />
                      <button onClick={() => fileInputRef.current.click()} className={`p-2 rounded-full hover:bg-slate-200 transition-colors ${selectedFile ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}><FaPaperclip /></button>

                      <input className="flex-1 bg-transparent px-4 py-2 outline-none text-slate-700 placeholder-slate-400" placeholder="Type your message..." value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdminReply()} />
                      <button onClick={() => handleAdminReply()} disabled={(!replyText.trim() && !selectedFile) || sendingReply} className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all">{sendingReply ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FaPaperPlane />}</button>
                    </div>
                  </div>
                </>
              )
            })() : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50/50">
                <FaCommentDots className="text-6xl mb-4 text-slate-200" />
                <h3 className="text-xl font-bold text-slate-400">Select a conversation</h3>
                <p className="text-slate-400">Choose a chat from the sidebar to start messaging</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ✅ LIGHTBOX / FULL SCREEN IMAGE POPUP */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[130] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
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

      {/* MANAGE GROUPS MODAL */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col md:flex-row overflow-hidden">
            <div className="w-full md:w-1/3 bg-slate-50 border-r border-slate-200 flex flex-col">
              <div className="p-5 border-b border-slate-200 bg-white"><h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><FaLayerGroup className="text-indigo-600" /> My Groups</h3></div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {groups.length === 0 && (<div className="text-center py-10 text-slate-400"><p>No groups created yet.</p></div>)}
                {groups.map(group => (
                  <div
                    key={group.id}
                    onClick={() => handleEditGroup(group)}
                    className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center group cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all"
                  >
                    <div className="min-w-0 flex-1"><h4 className="font-bold text-slate-700 truncate">{group.name}</h4><p className="text-xs text-slate-500">{group.members.length} members</p></div>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><FaTrash /></button>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-slate-100 border-t border-slate-200"><div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">System</div><div onClick={() => { setViewUnassigned(true); resetGroupForm(); }} className={`bg-white p-3 rounded-lg border shadow-sm cursor-pointer transition-all ${viewUnassigned ? 'border-orange-400 ring-1 ring-orange-400' : 'border-slate-200 hover:border-orange-300'}`}><div className="flex justify-between items-center"><h4 className={`font-bold text-sm ${viewUnassigned ? 'text-orange-700' : 'text-slate-600'}`}>Unassigned Employees</h4><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${viewUnassigned ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-600'}`}>{getUnassignedEmployees().length}</span></div></div></div>
            </div>
            <div className="w-full md:w-2/3 flex flex-col bg-white">
              {viewUnassigned ? (
                <><div className="p-5 border-b border-slate-100 flex justify-between items-center bg-orange-50/50"><div><h3 className="font-bold text-xl text-orange-800 flex items-center gap-2"><FaExclamationCircle /> Unassigned Employees</h3></div><button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100"><FaTimes size={20} /></button></div><div className="p-6 flex-1 overflow-y-auto"><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{getUnassignedEmployees().length === 0 ? (<div className="col-span-2 text-center py-12 text-slate-400"><FaCheck className="mx-auto mb-2 text-green-400" size={24} /><p>All employees assigned!</p></div>) : (getUnassignedEmployees().map(emp => (<div key={emp._id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50"><div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">{emp.name.charAt(0)}</div><div className="min-w-0"><p className="text-sm font-bold text-slate-700 truncate">{emp.name}</p><p className="text-xs text-slate-500">{emp.employeeId}</p></div></div>)))}</div></div></>
              ) : (
                <><div className="p-5 border-b border-slate-100 flex justify-between items-center"><div><h3 className="font-bold text-xl text-slate-800">{editingGroupId ? 'Edit Group' : 'Create New Group'}</h3></div><button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100"><FaTimes size={20} /></button></div><div className="p-6 flex-1 overflow-y-auto"><div className="mb-6"><label className="block text-sm font-bold text-slate-700 mb-2">Group Name</label><input type="text" placeholder="e.g. Marketing Team" value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" /></div><div className="mb-3 flex justify-between items-end"><label className="block text-sm font-bold text-slate-700">Select Members ({groupForm.members.length})</label><input type="text" placeholder="Search..." value={groupSearchTerm} onChange={e => setGroupSearchTerm(e.target.value)} className="text-sm border border-slate-300 rounded-md px-3 py-1.5 focus:border-indigo-500 outline-none" /></div><div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto bg-slate-50/50">{employees.filter(e => e.name.toLowerCase().includes(groupSearchTerm.toLowerCase())).map(emp => { const isSelected = groupForm.members.includes(emp._id); return (<div key={emp._id} onClick={() => toggleGroupMemberSelection(emp._id)} className={`flex items-center gap-3 p-3 border-b border-slate-100 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-white'}`}><div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>{isSelected && <FaCheck className="text-white text-xs" />}</div><div><p className={`text-sm font-semibold ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{emp.name}</p><p className="text-xs text-slate-500">{emp.employeeId}</p></div></div>) })}</div></div><div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">{editingGroupId && (<button onClick={resetGroupForm} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg">Cancel Edit</button>)}<button onClick={handleSaveGroup} className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md flex items-center gap-2">{editingGroupId ? <FaSave /> : <FaPlus size={12} />} {editingGroupId ? 'Update' : 'Create'}</button></div></>
              )}
            </div>
          </div>
        </div>
      )}
      {/* (New Notice Modal) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md relative animate-in zoom-in-95 duration-300 overflow-hidden border border-gray-200/80">
            <div className={`px-6 py-4 bg-gradient-to-r text-white ${isMeetingMode ? 'from-indigo-600 to-indigo-700' : 'from-blue-500 to-blue-600'}`}>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-inner">
                            {isMeetingMode ? <FaVideo className="text-white" size={20} /> : <FaBullhorn className="text-white" size={32} />}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">{isMeetingMode ? 'Schedule Meeting' : (editingNoticeId ? 'Edit Announcement' : 'New Announcement')}</h2>
                            <p className="text-sm text-white/80 mt-0.5">{isMeetingMode ? 'Set up a new virtual meeting' : (editingNoticeId ? 'Update announcement details' : 'Share updates with your team')}</p>
                        </div>
                    </div>
                    <button onClick={closeModal} className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all duration-200"><FaTimes size={18} /></button>
                </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto bg-gradient-to-b from-gray-50/50 to-white">
              {/* Meeting Specific Inputs */}
              {isMeetingMode ? (
                <>
                  <div className="flex gap-4">
                      <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500"></div><label className="text-xs font-semibold text-gray-700 uppercase">Date</label></div>
                          <div className="relative">
                              <input type="date" name="date" value={meetingParams.date} onChange={handleMeetingParamChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" required />
                          </div>
                      </div>
                      <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500"></div><label className="text-xs font-semibold text-gray-700 uppercase">Time</label></div>
                          <div className="relative">
                              <input type="time" name="time" value={meetingParams.time} onChange={handleMeetingParamChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" required />
                          </div>
                      </div>
                  </div>

                  {/* ✅ MEETING LINK INPUT (With Change Option) */}
                  <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500"></div><label className="text-xs font-semibold text-gray-700 uppercase">Meeting Link</label></div>
                      </div>
                      <div className="flex gap-2">
                          <div className="relative flex-1">
                              <FaLink className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                              <input 
                                type="text" 
                                value={meetingLink} 
                                onChange={handleLinkChange} 
                                readOnly={!isLinkEditable}
                                className={`w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 ${!isLinkEditable ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`} 
                                required 
                              />
                          </div>
                          {!isLinkEditable && (
                              <button type="button" onClick={() => setIsLinkEditable(true)} className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold border border-indigo-200 hover:bg-indigo-100">
                                  Change
                              </button>
                          )}
                      </div>
                      {/* Create New Link */}
                      <div className="text-right">
                          <a href="https://meet.google.com/landing" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-indigo-600 hover:underline inline-flex items-center gap-1">
                              <FaExternalLinkAlt /> Create New Link
                          </a>
                      </div>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 shadow-sm"></div><label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Title</label></div>
                    <input type="text" name="title" placeholder="Enter announcement title..." value={noticeData.title} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 placeholder-gray-500 text-gray-900 transition-all duration-200 bg-white shadow-sm" required autoFocus />
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-sm"></div><label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Description</label></div>
                <textarea 
                    name="description" 
                    placeholder="Write your details here..." 
                    value={noticeData.description} 
                    onChange={handleChange} 
                
                    className={`w-full border border-gray-300 rounded-lg px-4 py-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 placeholder-gray-500 text-gray-900 transition-all duration-200 bg-white shadow-sm ${isMeetingMode ? 'bg-gray-100 text-gray-600' : ''}`} 
                    required 
                />
              </div>

              <div className="space-y-1.5"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-500 to-violet-400 shadow-sm"></div><label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Audience</label></div><div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => setNoticeData(prev => ({ ...prev, sendTo: 'ALL', selectedGroupId: null }))} className={`p-2 rounded-lg border transition-all duration-200 text-center flex flex-col items-center justify-center gap-1 h-20 group ${noticeData.sendTo === 'ALL' ? 'bg-blue-50 border-blue-300 shadow-sm' : 'bg-white border-gray-300 hover:border-blue-300'}`}><div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${noticeData.sendTo === 'ALL' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{noticeData.sendTo === 'ALL' ? <FaCheck size={10} /> : <FaUsers size={12} />}</div><span className={`text-[10px] font-bold ${noticeData.sendTo === 'ALL' ? 'text-blue-700' : 'text-gray-600'}`}>All Employees</span></button><button type="button" onClick={() => setNoticeData(prev => ({ ...prev, sendTo: 'GROUP', recipients: [] }))} className={`p-2 rounded-lg border transition-all duration-200 text-center flex flex-col items-center justify-center gap-1 h-20 group ${noticeData.sendTo === 'GROUP' ? 'bg-indigo-50 border-indigo-300 shadow-sm' : 'bg-white border-gray-300 hover:border-indigo-300'}`}><div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${noticeData.sendTo === 'GROUP' ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{noticeData.sendTo === 'GROUP' ? <FaCheck size={10} /> : <FaLayerGroup size={12} />}</div><span className={`text-[10px] font-bold ${noticeData.sendTo === 'GROUP' ? 'text-indigo-700' : 'text-gray-600'}`}>Group Sending</span></button><button type="button" onClick={() => setNoticeData(prev => ({ ...prev, sendTo: 'SPECIFIC', selectedGroupId: null }))} className={`p-2 rounded-lg border transition-all duration-200 text-center flex flex-col items-center justify-center gap-1 h-20 group ${noticeData.sendTo === 'SPECIFIC' ? 'bg-purple-50 border-purple-300 shadow-sm' : 'bg-white border-gray-300 hover:border-purple-300'}`}><div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${noticeData.sendTo === 'SPECIFIC' ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{noticeData.sendTo === 'SPECIFIC' ? <FaCheck size={10} /> : <FaUserTag size={12} />}</div><span className={`text-[10px] font-bold ${noticeData.sendTo === 'SPECIFIC' ? 'text-purple-700' : 'text-gray-600'}`}>Specific</span></button></div></div>
              {noticeData.sendTo === 'GROUP' && (<div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200"><label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">Select Group</label>{groups.length > 0 ? (<div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">{groups.map(group => (<div key={group.id} onClick={() => handleNoticeGroupSelect(group)} className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center transition-all ${noticeData.selectedGroupId === group.id ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-400' : 'bg-white border-gray-300 hover:border-indigo-300'}`}><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${noticeData.selectedGroupId === group.id ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>{group.name.charAt(0)}</div><div><p className={`text-sm font-bold ${noticeData.selectedGroupId === group.id ? 'text-indigo-800' : 'text-gray-700'}`}>{group.name}</p><p className="text-xs text-slate-500">{group.members.length} Members</p></div></div>{noticeData.selectedGroupId === group.id && <FaCheck className="text-indigo-600" />}</div>))}</div>) : (<div className="text-center p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300"><p className="text-sm text-gray-500">No groups found.</p><button type="button" onClick={() => { setIsModalOpen(false); setIsGroupModalOpen(true); }} className="text-xs font-bold text-indigo-600 hover:underline mt-1">Create a Group first</button></div>)}</div>)}
              {noticeData.sendTo === 'SPECIFIC' && (<div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200"><div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 shadow-sm"></div><label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Select Employees</label></div><span className="text-xs font-semibold text-blue-600 bg-gradient-to-r from-blue-50 to-blue-100 px-2.5 py-1 rounded-full border border-blue-200">{noticeData.recipients.length} selected</span></div><div className="relative"><div onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg flex justify-between items-center cursor-pointer text-sm text-gray-700 hover:border-blue-400 transition-all duration-200 shadow-sm group"><div className="flex items-center gap-2"><div className="p-1.5 bg-blue-50 rounded-md group-hover:bg-blue-100 transition-colors"><FaUserFriends className="text-blue-500 text-sm" /></div><span className={noticeData.recipients.length === 0 ? "text-gray-500" : "text-gray-800 font-medium"}>{noticeData.recipients.length === 0 ? "Select team members..." : `${noticeData.recipients.length} employee${noticeData.recipients.length !== 1 ? 's' : ''} selected`}</span></div><FaChevronDown size={12} className={`text-gray-400 transition-all duration-300 ${isDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} /></div>{isDropdownOpen && (<div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-30 max-h-56 overflow-y-auto animate-in fade-in slide-in-from-top-3 duration-200"><div className="sticky top-0 bg-white p-2 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white"><div className="relative"><FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs" /><input type="text" placeholder="Search employees..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-xs outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all bg-white" autoFocus /></div></div><div className="p-1 max-h-44 overflow-y-auto">{employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase())).map(emp => (<div key={emp._id} onClick={() => toggleEmployeeSelection(emp._id)} className="flex items-center gap-3 p-2 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 cursor-pointer rounded text-xs transition-all duration-150 group/item"><div className={`w-4 h-4 border-2 rounded-md flex items-center justify-center transition-all duration-150 ${noticeData.recipients.includes(emp._id) ? 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-600 shadow-sm' : 'border-gray-400 group-hover/item:border-blue-400'}`}>{noticeData.recipients.includes(emp._id) && <FaCheck className="text-white text-[8px]" />}</div><div className="flex-1 min-w-0"><span className={`font-medium truncate ${noticeData.recipients.includes(emp._id) ? 'text-blue-700' : 'text-gray-800'}`}>{emp.name}</span><div className="flex items-center gap-2"><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${noticeData.recipients.includes(emp._id) ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{emp.employeeId}</span></div></div></div>))}</div></div>)}</div></div>)}
              <div className="flex gap-2 pt-4 mt-2 border-t border-gray-200"><button type="button" onClick={closeModal} className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-lg transition-all duration-200 border border-gray-300 shadow-sm">Cancel</button><button type="submit" disabled={isSubmitting || (noticeData.sendTo === 'GROUP' && !noticeData.selectedGroupId)} className="flex-1 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">{isSubmitting ? (<><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>{editingNoticeId ? 'Updating...' : 'Posting...'}</span></>) : (<><div className="p-0.5 bg-white/20 rounded"><FaPaperPlane className="text-xs" /></div><span>{editingNoticeId ? 'Update' : (isMeetingMode ? 'Schedule Meeting' : 'Publish Announcement')}</span></>)}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotices;