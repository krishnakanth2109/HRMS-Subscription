import { useCallback, useEffect, useMemo, useState } from "react";
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
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [editAdminForm, setEditAdminForm] = useState({
    supportAdminId: "",
    name: "",
    email: "",
    phone: "",
    department: "",
    loginEnabled: true,
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);

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
        title: "Unable to load support admins",
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
      title: "Delete support admin?",
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
        text: "Support admin removed successfully.",
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
      Swal.fire({ icon: "warning", title: "Support Admin ID required", text: "Please enter a unique ID for this support admin." });
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
        name: newAdminForm.name,
        email: newAdminForm.email,
        password: newAdminForm.password,
        phone: profile?.phone || "",
        department: profile?.department || "Support Administration",
        adminId: profile?.adminId || profile?._id,
      });

      setIsCreateModalOpen(false);
      setNewAdminForm({ supportAdminId: "", name: "", email: "", password: "", confirmPassword: "" });
      await loadSupportAdmins();
      Swal.fire({
        icon: "success",
        title: "Support admin created",
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
      name: admin.name || "",
      email: admin.email || "",
      phone: admin.phone || "",
      department: admin.department || "Support Administration",
      loginEnabled: admin.loginEnabled !== false,
      password: "",
      confirmPassword: "",
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
      Swal.fire({ icon: "warning", title: "Support Admin ID required", text: "Please enter a unique ID for this support admin." });
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
        name: editAdminForm.name,
        email: editAdminForm.email,
        phone: editAdminForm.phone,
        department: editAdminForm.department,
        loginEnabled: editAdminForm.loginEnabled,
      };

      if (editAdminForm.password) {
        payload.password = editAdminForm.password;
      }

      await api.put(`/api/admin/support-admins/${editingAdmin._id}`, payload);
      closeEditModal();
      await loadSupportAdmins();
      Swal.fire({
        icon: "success",
        title: "Support admin updated",
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
            <FaPlus size={14} /> Create Support Admin
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-indigo-600">
                <FaUserShield /> Admin Team
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
                Support Admin Management
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">
                View support admin accounts and their access status.
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
              <FaShieldAlt className="text-indigo-500" /> Support Admins
            </h2>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="whitespace-nowrap px-6 py-4">ID</th>
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
                      {Array.from({ length: 8 }).map((__, cell) => (
                        <td key={cell} className="px-6 py-5">
                          <div className="h-4 rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : supportAdmins.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center text-sm font-bold text-slate-400">
                      No support admins found.
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
                      <td className="px-6 py-5">
                        <a href={`mailto:${admin.email}`} className="font-bold text-slate-700 hover:text-indigo-600">
                          {admin.email}
                        </a>
                      </td>
                      <td className="px-6 py-5 font-bold text-slate-600">{admin.phone || "--"}</td>
                      <td className="px-6 py-5 font-bold text-slate-600">{admin.department || "Support Administration"}</td>
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
                            title="Edit Support Admin"
                          >
                            <FaEdit />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(admin)}
                            disabled={deletingId === admin._id}
                            className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                            title="Delete Support Admin"
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
                No support admins found.
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
                          <p className="mt-1">{admin.department || "Support Administration"}</p>
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

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-8 shadow-2xl">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute right-6 top-6 text-gray-400 transition-colors hover:text-gray-600"
            >
              <FaTimes size={20} />
            </button>
            <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900">
              <FaUser className="text-purple-600" /> Create New Support Admin
            </h2>

            <form onSubmit={handleCreateSupportAdmin} className="space-y-4">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Support Admin ID</label>
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
                type="submit"
                disabled={createAdminLoading}
                className="flex w-full justify-center rounded-xl bg-purple-600 py-3 font-bold text-white shadow-lg shadow-purple-200 transition-all hover:bg-purple-700 disabled:opacity-70"
              >
                {createAdminLoading ? <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" /> : "Create Support Admin"}
              </button>
            </form>
          </div>
        </div>
      )}

      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white p-8 shadow-2xl">
            <button
              type="button"
              onClick={closeEditModal}
              className="absolute right-6 top-6 text-gray-400 transition-colors hover:text-gray-600"
            >
              <FaTimes size={20} />
            </button>
            <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900">
              <FaEdit className="text-blue-600" /> Edit Support Admin
            </h2>

            <form onSubmit={handleUpdateSupportAdmin} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Support Admin ID</label>
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
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editAdminForm.name}
                    onChange={(event) => setEditAdminForm({ ...editAdminForm, name: event.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 transition-colors focus:border-blue-600 focus:outline-none"
                  />
                </div>
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
                    placeholder="Support Administration"
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
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportAdminManagement;
