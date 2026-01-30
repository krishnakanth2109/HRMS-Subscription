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

      <div className="grid grid-cols-12 gap-4">
        {/* LEFT */}
        <div className="col-span-4 bg-white rounded-lg shadow p-4">
          <div className="flex gap-2 mb-3">
            <input
              className="flex-1 px-3 py-2 rounded border text-sm"
              placeholder="Search groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className="bg-indigo-600 text-white px-3 py-2 rounded text-sm"
              onClick={() => setShowCreate(true)}
            >
              + Create
            </button>
          </div>

          <div className="space-y-2">
            {filteredGroups.map((g) => (
              <button
                key={g._id}
                onClick={() => fetchGroup(g._id)}
                className={`w-full text-left px-3 py-2 rounded border ${
                  selectedGroup?._id === g._id
                    ? "bg-indigo-100 border-indigo-400"
                    : "hover:bg-slate-100"
                }`}
              >
                <div className="font-semibold">{g.groupName}</div>
                <div className="text-xs text-slate-500">{g.groupCode}</div>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div className="col-span-8 bg-white rounded-lg shadow p-5">
          {!selectedGroup ? (
            <div className="text-center text-slate-400 mt-20">
              Select a group to view details
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold">
                {selectedGroup.groupName}
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                {selectedGroup.description}
              </p>

              {/* LEADER */}
              <div className="mb-4">
                <label className="block text-sm mb-1">Group Leader</label>
                <select
                  className="w-full border px-3 py-2 rounded"
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
              </div>


              {/* MEMBERS */}
              <div>
                <label className="block text-sm mb-1">Members</label>
                <div className="space-y-2 mb-3">
                  {selectedGroup.members?.map((m) => (
                    <div
                      key={m.employee?._id}
                      className="flex justify-between border px-3 py-2 rounded"
                    >
                      <span>
                        {m.employee?.name} ({m.role})
                      </span>
                      <button
                        onClick={() => removeMember(m.employee?._id)}
                        className="text-red-500 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <select
                    className="flex-1 border px-3 py-2 rounded"
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
                    className="border px-3 py-2 rounded"
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
                    className="bg-green-600 text-white px-4 rounded"
                  >
                    Add
                  </button>
                </div>
              </div>

              <hr className="my-4" />

              <button
                onClick={deactivateGroup}
                className="text-red-600 text-sm"
              >
                Deactivate Group
              </button>
            </>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-5 rounded w-96">
            <h3 className="font-bold mb-3">Create Group</h3>

            <input
              className="w-full mb-2 border px-3 py-2 rounded"
              placeholder="Group Name"
              onChange={(e) =>
                setNewGroup({ ...newGroup, groupName: e.target.value })
              }
            />
            <input
              className="w-full mb-2 border px-3 py-2 rounded"
              placeholder="Group Code"
              onChange={(e) =>
                setNewGroup({ ...newGroup, groupCode: e.target.value })
              }
            />
            <textarea
              className="w-full mb-2 border px-3 py-2 rounded"
              placeholder="Description"
              onChange={(e) =>
                setNewGroup({ ...newGroup, description: e.target.value })
              }
            />
            <select
              className="w-full mb-3 border px-3 py-2 rounded"
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

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-1 bg-slate-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={createGroup}
                className="px-4 py-1 bg-indigo-600 text-white rounded"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminGroupPage;
