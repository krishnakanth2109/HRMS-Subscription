import { useCallback, useEffect, useMemo, useState } from "react";
import ModalWrapper from "../components/ModalWrapper";
import Swal from "sweetalert2";

import {
  FaEdit,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaIdBadge,
  FaPlus,
  FaRegClock,
  FaShieldAlt,
  FaTimes,
  FaTrash,
  FaUser,
  FaUserShield,
} from "react-icons/fa";
import api from "../api";

const ADMINISTRATION_LABEL = "Administration";
const ADMINISTRATION_USER_LABEL = "Administration User";

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "SA";

const ALL_SIDEBAR_FEATURES = [
  { id: "/employees", label: "Employee Management", category: "Main" },
  { id: "/attendance", label: "Employees Attendance", category: "Main" },
  { id: "/admin/settings", label: "Shift Management", category: "Management" },
  { id: "/admin/shifttype", label: "Location Settings", category: "Management" },
  { id: "/admin/leave-summary", label: "Leave Summary", category: "Management" },
  { id: "/admin/payroll", label: "Payroll", category: "Management" },
  { id: "/admin/admin-Leavemanage", label: "Leave Management", category: "Requests" },
  { id: "/admin/late-requests", label: "Attendance Requests", category: "Requests" },
  { id: "/admin/admin-overtime", label: "Overtime Requests", category: "Requests" },
  { id: "/admin/live-tracking", label: "Idle Tracking", category: "System" },
  { id: "/admin/payrollcandidates", label: "Payroll Candidates", category: "System" },
];

const SupportAdminManagement = () => {
  const [supportAdmins, setSupportAdmins] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [createAdminLoading, setCreateAdminLoading] = useState(false);
  const [editAdminLoading, setEditAdminLoading] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({
    supportAdminId: "",
    positionName: "",
    name: "",
    email: "",
    phone: "",
    department: "",
    password: "",
    confirmPassword: "",
    assignedFeatures: ALL_SIDEBAR_FEATURES.map((f) => f.id),
  });
  const [editAdminForm, setEditAdminForm] = useState({
    supportAdminId: "",
    positionName: "",
    name: "",
    email: "",
    phone: "",
    department: "",
    loginEnabled: true,
    password: "",
    confirmPassword: "",
    assignedFeatures: [],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);

  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [featureModalMode, setFeatureModalMode] = useState("create"); // "create" or "edit"

  const handleToggleFeature = (featureId) => {
    if (featureModalMode === "create") {
      setNewAdminForm((prev) => {
        const current = prev.assignedFeatures || [];
        const updated = current.includes(featureId)
          ? current.filter((id) => id !== featureId)
          : [...current, featureId];
        return { ...prev, assignedFeatures: updated };
      });
    } else {
      setEditAdminForm((prev) => {
        const current = prev.assignedFeatures || [];
        const updated = current.includes(featureId)
          ? current.filter((id) => id !== featureId)
          : [...current, featureId];
        return { ...prev, assignedFeatures: updated };
      });
    }
  };

  const handleSelectAllFeatures = () => {
    const allIds = ALL_SIDEBAR_FEATURES.map((f) => f.id);
    if (featureModalMode === "create") {
      setNewAdminForm((prev) => ({ ...prev, assignedFeatures: allIds }));
    } else {
      setEditAdminForm((prev) => ({ ...prev, assignedFeatures: allIds }));
    }
  };

  const handleClearAllFeatures = () => {
    if (featureModalMode === "create") {
      setNewAdminForm((prev) => ({ ...prev, assignedFeatures: [] }));
    } else {
      setEditAdminForm((prev) => ({ ...prev, assignedFeatures: [] }));
    }
  };

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/profile");
      setProfile(data);
    } catch (error) {
      console.error("Failed to fetch admin profile:", error);
    }
  }, []);

  const loadSupportAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/admin/support-admins");
      setSupportAdmins(Array.isArray(data) ? data : data?.data || []);
    } catch (error) {
      console.error("Failed to fetch support admins:", error);
      Swal.fire({
        icon: "error",
        title: `Unable to load ${ADMINISTRATION_LABEL.toLowerCase()} users`,
        text: error.response?.data?.message || "Please try again.",
      });
      setSupportAdmins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSupportAdmins();
    loadProfile();
  }, [loadSupportAdmins, loadProfile]);

  const activeCount = useMemo(
    () => supportAdmins.filter((admin) => admin.loginEnabled !== false).length,
    [supportAdmins]
  );

  const handleDelete = async (admin) => {
    const result = await Swal.fire({
      icon: "warning",
      title: `Delete ${ADMINISTRATION_USER_LABEL.toLowerCase()}?`,
      text: `${admin.name} will no longer be able to access the admin panel.`,
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#dc2626",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    setDeletingId(admin._id);
    try {
      await api.delete(`/api/admin/support-admins/${admin._id}`);
      setSupportAdmins((current) => current.filter((item) => item._id !== admin._id));
      Swal.fire({
        icon: "success",
        title: "Deleted",
        text: `${ADMINISTRATION_USER_LABEL} removed successfully.`,
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Delete failed",
        text: error.response?.data?.message || "Please try again.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateSupportAdmin = async (event) => {
    event.preventDefault();

    if (!newAdminForm.supportAdminId.trim()) {
      Swal.fire({ icon: "warning", title: `${ADMINISTRATION_LABEL} ID required`, text: `Please enter a unique ID for this ${ADMINISTRATION_USER_LABEL.toLowerCase()}.` });
      return;
    }

    if (newAdminForm.password.length < 8) {
      Swal.fire({ icon: "warning", title: "Password too short", text: "Password must be at least 8 characters." });
      return;
    }

    if (newAdminForm.password !== newAdminForm.confirmPassword) {
      Swal.fire({ icon: "warning", title: "Passwords do not match", text: "Please re-enter the same password." });
      return;
    }

    setCreateAdminLoading(true);
    try {
      await api.post("/api/admin/support-admins", {
        supportAdminId: newAdminForm.supportAdminId.trim(),
        positionName: newAdminForm.positionName || ADMINISTRATION_LABEL,
        name: newAdminForm.name,
        email: newAdminForm.email,
        password: newAdminForm.password,
        phone: newAdminForm.phone || "",
        department: newAdminForm.department || ADMINISTRATION_LABEL,
        adminId: profile?.adminId || profile?._id,
        assignedFeatures: newAdminForm.assignedFeatures,
      });

      setIsCreateModalOpen(false);
      setNewAdminForm({
        supportAdminId: "",
        positionName: "",
        name: "",
        email: "",
        phone: "",
        department: "",
        password: "",
        confirmPassword: "",
        assignedFeatures: ALL_SIDEBAR_FEATURES.map((f) => f.id),
      });
      await loadSupportAdmins();
      Swal.fire({
        icon: "success",
        title: `${ADMINISTRATION_USER_LABEL} created`,
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Create failed",
        text: error.response?.data?.message || "Please try again.",
      });
    } finally {
      setCreateAdminLoading(false);
    }
  };

  const openEditModal = (admin) => {
    setEditingAdmin(admin);
    setEditAdminForm({
      supportAdminId: admin.supportAdminId || "",
      positionName: admin.positionName || ADMINISTRATION_LABEL,
      name: admin.name || "",
      email: admin.email || "",
      phone: admin.phone || "",
      department: admin.department || ADMINISTRATION_LABEL,
      loginEnabled: admin.loginEnabled !== false,
      password: "",
      confirmPassword: "",
      assignedFeatures: admin.assignedFeatures || ALL_SIDEBAR_FEATURES.map((f) => f.id),
    });
  };

  const closeEditModal = () => {
    setEditingAdmin(null);
    setShowEditPassword(false);
    setShowEditConfirmPassword(false);
  };

  const handleUpdateSupportAdmin = async (event) => {
    event.preventDefault();
    if (!editingAdmin) return;

    if (!editAdminForm.supportAdminId.trim()) {
      Swal.fire({ icon: "warning", title: `${ADMINISTRATION_LABEL} ID required`, text: `Please enter a unique ID for this ${ADMINISTRATION_USER_LABEL.toLowerCase()}.` });
      return;
    }

    if (editAdminForm.password || editAdminForm.confirmPassword) {
      if (editAdminForm.password.length < 8) {
        Swal.fire({ icon: "warning", title: "Password too short", text: "Password must be at least 8 characters." });
        return;
      }
      if (editAdminForm.password !== editAdminForm.confirmPassword) {
        Swal.fire({ icon: "warning", title: "Passwords do not match", text: "Please re-enter the same password." });
        return;
      }
    }

    setEditAdminLoading(true);
    try {
      const payload = {
        supportAdminId: editAdminForm.supportAdminId.trim(),
        positionName: editAdminForm.positionName || ADMINISTRATION_LABEL,
        name: editAdminForm.name,
        email: editAdminForm.email,
        phone: editAdminForm.phone,
        department: editAdminForm.department,
        loginEnabled: editAdminForm.loginEnabled,
        assignedFeatures: editAdminForm.assignedFeatures,
      };

      if (editAdminForm.password) {
        payload.password = editAdminForm.password;
      }

      await api.put(`/api/admin/support-admins/${editingAdmin._id}`, payload);
      closeEditModal();
      await loadSupportAdmins();
      Swal.fire({
        icon: "success",
        title: `${ADMINISTRATION_USER_LABEL} updated`,
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Update failed",
        text: error.response?.data?.message || "Please try again.",
      });
    } finally {
      setEditAdminLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-purple-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-200 transition-all hover:bg-purple-700"
          >
            <FaPlus size={14} /> Create {ADMINISTRATION_LABEL}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-indigo-600">
                <FaUserShield /> Admin Team
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
                {ADMINISTRATION_LABEL} Management
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">
                View administration accounts, positions, and their access status.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{supportAdmins.length}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Active</p>
                <p className="mt-2 text-3xl font-black text-emerald-700">{activeCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-500">
              <FaShieldAlt className="text-indigo-500" /> {ADMINISTRATION_LABEL}
            </h2>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="whitespace-nowrap px-6 py-4">ID</th>
                  <th className="px-6 py-4">Position</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      {Array.from({ length: 9 }).map((__, cell) => (
                        <td key={cell} className="px-6 py-5">
                          <div className="h-4 rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : supportAdmins.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-16 text-center text-sm font-bold text-slate-400">
                      No administration users found.
                    </td>
                  </tr>
                ) : (
                  supportAdmins.map((admin) => (
                    <tr key={admin._id} className="transition-colors hover:bg-indigo-50/30">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-sm font-black text-indigo-700">
                            {getInitials(admin.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-900">{admin.name}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-slate-400">
                              {/* <FaIdBadge /> {admin.role || "support-admin"} */}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 font-black text-slate-700">{admin.supportAdminId || "--"}</td>
                      <td className="px-6 py-5 font-bold text-slate-600">{admin.positionName || ADMINISTRATION_LABEL}</td>
                      <td className="px-6 py-5">
                        <a href={`mailto:${admin.email}`} className="font-bold text-slate-700 hover:text-indigo-600">
                          {admin.email}
                        </a>
                      </td>
                      <td className="px-6 py-5 font-bold text-slate-600">{admin.phone || "--"}</td>
                      <td className="px-6 py-5 font-bold text-slate-600">{admin.department || ADMINISTRATION_LABEL}</td>
                      <td className="px-6 py-5 font-bold text-slate-600">{formatDate(admin.createdAt)}</td>
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${admin.loginEnabled === false ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                          {admin.loginEnabled === false ? "Disabled" : "Active"}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-center gap-2">
                          {/* <button
                            type="button"
                            onClick={() => navigate(`/support-admin/attendance/profile/${admin._id}`)}
                            className="rounded-xl border border-indigo-100 bg-indigo-50 p-2 text-indigo-600 transition hover:bg-indigo-100"
                            title="View Attendance"
                          >
                            <FaEye />
                          </button> */}
                          <button
                            type="button"
                            onClick={() => openEditModal(admin)}
                            className="rounded-xl border border-blue-100 bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100"
                            title={`Edit ${ADMINISTRATION_USER_LABEL}`}
                          >
                            <FaEdit />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(admin)}
                            disabled={deletingId === admin._id}
                            className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                            title={`Delete ${ADMINISTRATION_USER_LABEL}`}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 p-4 lg:hidden">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
              ))
            ) : supportAdmins.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm font-bold text-slate-400">
                No administration users found.
              </div>
            ) : (
              supportAdmins.map((admin) => (
                <div key={admin._id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-sm font-black text-indigo-700">
                      {getInitials(admin.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black text-slate-900">{admin.name}</h3>
                          <p className="mt-1 flex items-center gap-1 whitespace-nowrap text-xs font-black text-indigo-600">
                            <FaIdBadge /> {admin.supportAdminId || "--"}
                          </p>
                          <p className="mt-1 text-xs font-black uppercase tracking-widest text-blue-600">
                            {admin.positionName || ADMINISTRATION_LABEL}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-xs font-bold text-slate-500">
                            <FaEnvelope /> {admin.email}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${admin.loginEnabled === false ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                          {admin.loginEnabled === false ? "Disabled" : "Active"}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-bold text-slate-600">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[9px] uppercase tracking-widest text-slate-400">Department</p>
                          <p className="mt-1">{admin.department || ADMINISTRATION_LABEL}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[9px] uppercase tracking-widest text-slate-400">Created</p>
                          <p className="mt-1 flex items-center gap-1"><FaRegClock /> {formatDate(admin.createdAt)}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        {/* <button
                          type="button"
                          onClick={() => navigate(`/support-admin/attendance/profile/${admin._id}`)}
                          className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white"
                        >
                          Attendance
                        </button> */}
                        <button
                          type="button"
                          onClick={() => openEditModal(admin)}
                          className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(admin)}
                          disabled={deletingId === admin._id}
                          className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-600 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <ModalWrapper isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} containerClass="relative max-h-[90vh] w-full max-w-md overflow-hidden rounded-[2rem] bg-white p-8 shadow-2xl flex flex-col">
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(false)}
          className="absolute right-6 top-6 text-gray-400 transition-colors hover:text-gray-600"
        >
          <FaTimes size={20} />
        </button>
        <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <FaUser className="text-purple-600" /> Create New {ADMINISTRATION_USER_LABEL}
        </h2>

        <form onSubmit={handleCreateSupportAdmin} className="support-admin-form-scrollbar max-h-[calc(90vh-9rem)] space-y-4 overflow-y-auto rounded-2xl bg-purple-50/30 p-4 pr-3">
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">{ADMINISTRATION_LABEL} ID</label>
            <input
              type="text"
              required
              value={newAdminForm.supportAdminId}
              onChange={(event) => setNewAdminForm({ ...newAdminForm, supportAdminId: event.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-purple-600 focus:outline-none"
              placeholder="SA-001"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Position</label>
            <input
              type="text"
              required
              value={newAdminForm.positionName}
              onChange={(event) => setNewAdminForm({ ...newAdminForm, positionName: event.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-purple-600 focus:outline-none"
              placeholder="Admin, Manager"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Full Name</label>
            <input
              type="text"
              required
              value={newAdminForm.name}
              onChange={(event) => setNewAdminForm({ ...newAdminForm, name: event.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-purple-600 focus:outline-none"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Username (Email)</label>
            <input
              type="email"
              required
              value={newAdminForm.email}
              onChange={(event) => setNewAdminForm({ ...newAdminForm, email: event.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-purple-600 focus:outline-none"
              placeholder="john@example.com"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Phone</label>
              <input
                type="text"
                value={newAdminForm.phone}
                onChange={(event) => setNewAdminForm({ ...newAdminForm, phone: event.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-purple-600 focus:outline-none"
                placeholder="Phone number"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Department</label>
              <input
                type="text"
                value={newAdminForm.department}
                onChange={(event) => setNewAdminForm({ ...newAdminForm, department: event.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-purple-600 focus:outline-none"
                placeholder={ADMINISTRATION_LABEL}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={newAdminForm.password}
                onChange={(event) => setNewAdminForm({ ...newAdminForm, password: event.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-purple-600 focus:outline-none"
                placeholder="Min. 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={8}
                value={newAdminForm.confirmPassword}
                onChange={(event) => setNewAdminForm({ ...newAdminForm, confirmPassword: event.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-purple-600 focus:outline-none"
                placeholder="Confirm Password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setFeatureModalMode("create");
              setIsFeatureModalOpen(true);
            }}
            className="flex w-full justify-center items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 py-3 font-bold text-purple-700 transition hover:bg-purple-100"
          >
            <FaShieldAlt size={14} /> Plan Features
          </button>

          <button
            type="submit"
            disabled={createAdminLoading}
            className="flex w-full justify-center rounded-xl bg-purple-600 py-3 font-bold text-white shadow-lg shadow-purple-200 transition-all hover:bg-purple-700 disabled:opacity-70"
          >
            {createAdminLoading ? <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" /> : `Create ${ADMINISTRATION_LABEL}`}
          </button>
        </form>
      </ModalWrapper>

      <ModalWrapper isOpen={!!editingAdmin} onClose={closeEditModal} containerClass="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white p-8 shadow-2xl flex flex-col">
        <button
          type="button"
          onClick={closeEditModal}
          className="absolute right-6 top-6 text-gray-400 transition-colors hover:text-gray-600"
        >
          <FaTimes size={20} />
        </button>
        <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <FaEdit className="text-blue-600" /> Edit {ADMINISTRATION_USER_LABEL}
        </h2>

        <form onSubmit={handleUpdateSupportAdmin} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">{ADMINISTRATION_LABEL} ID</label>
              <input
                type="text"
                required
                value={editAdminForm.supportAdminId}
                onChange={(event) => setEditAdminForm({ ...editAdminForm, supportAdminId: event.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-blue-600 focus:outline-none"
                placeholder="SA-001"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Position</label>
              <input
                type="text"
                required
                value={editAdminForm.positionName}
                onChange={(event) => setEditAdminForm({ ...editAdminForm, positionName: event.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-blue-600 focus:outline-none"
                placeholder="Admin, Manager"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Full Name</label>
            <input
              type="text"
              required
              value={editAdminForm.name}
              onChange={(event) => setEditAdminForm({ ...editAdminForm, name: event.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Username (Email)</label>
            <input
              type="email"
              required
              value={editAdminForm.email}
              onChange={(event) => setEditAdminForm({ ...editAdminForm, email: event.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Phone</label>
              <input
                type="text"
                value={editAdminForm.phone}
                onChange={(event) => setEditAdminForm({ ...editAdminForm, phone: event.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-blue-600 focus:outline-none"
                placeholder="Phone number"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Department</label>
              <input
                type="text"
                value={editAdminForm.department}
                onChange={(event) => setEditAdminForm({ ...editAdminForm, department: event.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-blue-600 focus:outline-none"
                placeholder={ADMINISTRATION_LABEL}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <span className="text-sm font-black text-gray-700">Login Enabled</span>
            <input
              type="checkbox"
              checked={editAdminForm.loginEnabled}
              onChange={(event) => setEditAdminForm({ ...editAdminForm, loginEnabled: event.target.checked })}
              className="h-5 w-5 accent-blue-600"
            />
          </label>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-blue-600">Change Password</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">Leave password fields empty to keep the current password.</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">New Password</label>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    minLength={8}
                    value={editAdminForm.password}
                    onChange={(event) => setEditAdminForm({ ...editAdminForm, password: event.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-blue-600 focus:outline-none"
                    placeholder="Optional"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showEditPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showEditConfirmPassword ? "text" : "password"}
                    minLength={8}
                    value={editAdminForm.confirmPassword}
                    onChange={(event) => setEditAdminForm({ ...editAdminForm, confirmPassword: event.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-blue-600 focus:outline-none"
                    placeholder="Optional"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditConfirmPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showEditConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setFeatureModalMode("edit");
              setIsFeatureModalOpen(true);
            }}
            className="flex w-full justify-center items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-3 font-bold text-blue-700 transition hover:bg-blue-100 mb-4"
          >
            <FaShieldAlt size={14} /> Plan Features
          </button>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={closeEditModal}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-3 font-bold text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editAdminLoading}
              className="flex flex-1 justify-center rounded-xl bg-blue-600 py-3 font-bold text-white shadow-lg shadow-blue-100 transition-all hover:bg-blue-700 disabled:opacity-70"
            >
              {editAdminLoading ? <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" /> : "Save Changes"}
            </button>
          </div>
        </form>
      </ModalWrapper>

      <ModalWrapper isOpen={isFeatureModalOpen} onClose={() => setIsFeatureModalOpen(false)} containerClass="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white p-8 shadow-2xl flex flex-col">
        <button
          type="button"
          onClick={() => setIsFeatureModalOpen(false)}
          className="absolute right-6 top-6 text-gray-400 transition-colors hover:text-gray-600"
        >
          <FaTimes size={20} />
        </button>
        <h2 className="mb-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <FaShieldAlt className={featureModalMode === "create" ? "text-purple-600" : "text-blue-600"} /> Plan Features
        </h2>
        <p className="mb-6 text-xs font-semibold text-slate-500">
          Configure which sidebar pages this administration user can access.
        </p>

        <div className="mb-6 flex gap-3">
          <button
            type="button"
            onClick={handleSelectAllFeatures}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={handleClearAllFeatures}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            Clear All
          </button>
        </div>

        <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2">
          {Object.entries(
            ALL_SIDEBAR_FEATURES.reduce((acc, feature) => {
              if (!acc[feature.category]) acc[feature.category] = [];
              acc[feature.category].push(feature);
              return acc;
            }, {})
          ).map(([category, features]) => (
            <div key={category} className="space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-1">
                {category}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {features.map((feature) => {
                  const isChecked = featureModalMode === "create"
                    ? (newAdminForm.assignedFeatures || []).includes(feature.id)
                    : (editAdminForm.assignedFeatures || []).includes(feature.id);
                  return (
                    <label
                      key={feature.id}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 transition hover:bg-slate-50"
                    >
                      <span className="text-sm font-bold text-slate-700">{feature.label}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleFeature(feature.id)}
                        className={`h-5 w-5 rounded-lg ${featureModalMode === "create" ? "accent-purple-600" : "accent-blue-600"}`}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={() => setIsFeatureModalOpen(false)}
            className={`w-full rounded-xl py-3 font-bold text-white shadow-lg transition-all ${featureModalMode === "create"
                ? "bg-purple-600 shadow-purple-200 hover:bg-purple-700"
                : "bg-blue-600 shadow-blue-200 hover:bg-blue-700"
              }`}
          >
            Done
          </button>
        </div>
      </ModalWrapper>
    </div>
  );
};

export default SupportAdminManagement;
