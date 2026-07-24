import React, { useEffect, useState } from "react";
import {
  getGroups,
  getGroupById,
  createGroupApi,
  updateGroupApi,
  changeGroupLeaderApi,
  addGroupMemberApi,
  removeGroupMemberApi,
  deleteGroupApi,
  getEmployees,
} from "../api";
import GroupMessaging from "../components/GroupMessaging";
import { FaComments } from "react-icons/fa";

const AdminGroupPage = () => {
  // ================= STATE =================
  const [groups, setGroups] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newGroup, setNewGroup] = useState({
    groupName: "",
    groupCode: "",
    description: "",
    groupLeader: "",

  });

  const [memberData, setMemberData] = useState({
    employeeId: "",
    role: "member",
  });

  // ================= API CALLS =================
  const fetchGroups = async () => {
    try {
      const list = await getGroups();
      setGroups(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
      setGroups([]);
    }
  };

  const fetchEmployees = async () => {
    try {
      const list = await getEmployees();
      setEmployees(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
      setEmployees([]);
    }
  };

  const fetchGroup = async (id) => {
    try {
      const data = await getGroupById(id);
      setSelectedGroup(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load group details");
    }
  };

  const createGroup = async () => {
    try {
      await createGroupApi(newGroup);
      setShowCreate(false);
      setNewGroup({
        groupName: "",
        groupCode: "",
        description: "",
        groupLeader: "",

      });
      fetchGroups();
    } catch (err) {
      console.error(err);
      alert("Group creation failed");
    }
  };



  const changeLeader = async (leaderId) => {
    if (!selectedGroup) return;
    await changeGroupLeaderApi(selectedGroup._id, leaderId);
    fetchGroup(selectedGroup._id);
  };

  const addMember = async () => {
    if (!selectedGroup || !memberData.employeeId) return;
    await addGroupMemberApi(selectedGroup._id, memberData);
    setMemberData({ employeeId: "", role: "member" });
    fetchGroup(selectedGroup._id);
  };

  const removeMember = async (employeeId) => {
    if (!selectedGroup) return;
    if (!window.confirm("Remove this member?")) return;
    await removeGroupMemberApi(selectedGroup._id, employeeId);
    fetchGroup(selectedGroup._id);
  };

  const deactivateGroup = async () => {
    if (!selectedGroup) return;
    if (!window.confirm("Deactivate this group?")) return;
    await deleteGroupApi(selectedGroup._id);
    setSelectedGroup(null);
    fetchGroups();
  };

  // ================= EFFECT =================
  useEffect(() => {
    const init = async () => {
      try {
        await fetchGroups();
        await fetchEmployees();
      } catch (err) {
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const filteredGroups = Array.isArray(groups)
    ? groups.filter(
        (g) =>
          g.groupName?.toLowerCase().includes(search.toLowerCase()) ||
          g.groupCode?.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  // ================= UI =================
  if (loading) {
    return <div className="p-6 text-slate-500">Loading groups...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">{error}</div>;
  }

  return (
    <div className="p-6 text-slate-800">
      <h1 className="text-2xl font-bold mb-4">Group Management</h1>

      <div className="grid grid-cols-12 gap-6">
        {/* LEFT: Existing Groups List */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl shadow-sm p-6 flex flex-col h-[500px] lg:h-[calc(100vh-200px)] border border-slate-100">
          <div className="flex gap-2 mb-4">
            <input
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              placeholder="Search groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95"
              onClick={() => setShowCreate(true)}
            >
              + Create
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {filteredGroups.length > 0 ? (
              filteredGroups.map((g) => (
                <button
                  key={g._id}
                  onClick={() => fetchGroup(g._id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    selectedGroup?._id === g._id
                      ? "bg-indigo-50 border-indigo-400 shadow-sm"
                      : "border-slate-100 hover:bg-slate-50 hover:border-slate-200"
                  }`}
                >
                  <div className="font-bold text-slate-800">{g.groupName}</div>
                  <div className="text-xs text-slate-500 mt-0.5 font-medium tracking-wide">Code: {g.groupCode}</div>
                </button>
              ))
            ) : (
              <div className="text-center py-10 text-slate-400 text-sm italic">
                No groups found
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Group Details */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl shadow-sm p-6 min-h-[500px] border border-slate-100">
          {!selectedGroup ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
              <div className="p-4 bg-slate-50 rounded-full">
                <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              </div>
              <p className="font-medium text-sm">Select a group from the list to view details</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                  {selectedGroup.groupName}
                </h2>
                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">
                  {selectedGroup.groupCode}
                </span>
              </div>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed max-w-2xl">
                {selectedGroup.description || "No description provided for this group."}
              </p>

              {/* LEADER */}
              <div className="mb-8">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Group Leader</label>
                <div className="relative">
                  <select
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                    value={selectedGroup.groupLeader?._id || ""}
                    onChange={(e) => changeLeader(e.target.value)}
                  >
                    <option value="">Select leader</option>
                    {employees.map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              {/* MEMBERS */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3 px-1">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Members ({selectedGroup.members?.length || 0})</label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                  {selectedGroup.members?.map((m) => (
                    <div
                      key={m.employee?._id}
                      className="flex items-center justify-between border border-slate-100 px-4 py-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-all group"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-700 truncate">{m.employee?.name}</div>
                        <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">{m.role}</div>
                      </div>
                      <button
                        onClick={() => removeMember(m.employee?._id)}
                        className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                        title="Remove Member"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 mb-3 ml-1 uppercase tracking-tight">Add New Member</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      className="flex-1 bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={memberData.employeeId}
                      onChange={(e) =>
                        setMemberData({
                          ...memberData,
                          employeeId: e.target.value,
                        })
                      }
                    >
                      <option value="">Select employee</option>
                      {employees.map((e) => (
                        <option key={e._id} value={e._id}>
                          {e.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-auto"
                      value={memberData.role}
                      onChange={(e) =>
                        setMemberData({ ...memberData, role: e.target.value })
                      }
                    >
                      <option value="member">Member</option>
                      <option value="senior">Senior</option>
                      <option value="intern">Intern</option>
                    </select>

                    <button
                      onClick={addMember}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-50">
                <button
                  onClick={deactivateGroup}
                  className="flex items-center gap-2 text-slate-400 hover:text-red-500 text-xs font-bold uppercase tracking-wider transition-colors py-2 px-4 rounded-lg hover:bg-red-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  Deactivate Group
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 mb-6">Create New Group</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Group Name</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  placeholder="e.g. Design Team"
                  onChange={(e) =>
                    setNewGroup({ ...newGroup, groupName: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Group Code</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  placeholder="e.g. DESIGN-01"
                  onChange={(e) =>
                    setNewGroup({ ...newGroup, groupCode: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Description</label>
                <textarea
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none min-h-[100px] resize-none"
                  placeholder="What is this group about?"
                  onChange={(e) =>
                    setNewGroup({ ...newGroup, description: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Assign Leader</label>
                <div className="relative">
                  <select
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                    onChange={(e) =>
                      setNewGroup({ ...newGroup, groupLeader: e.target.value })
                    }
                  >
                    <option value="">Select Leader</option>
                    {employees.map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setShowCreate(false)}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={createGroup}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all active:scale-95"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminGroupPage;
