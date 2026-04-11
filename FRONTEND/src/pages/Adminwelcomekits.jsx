// pages/Admin/AdminWelcomeKits.jsx
import { useState, useEffect } from "react";
import {
  FaGift,
  FaSearch,
  FaLaptop,
  FaMouse,
  FaKeyboard,
  FaPen,
  FaBook,
  FaCoffee,
  FaCalendarAlt,
  FaFolder,
  FaKey,
  FaTint,
  FaPlus,
  FaBan,
  FaFilter,
  FaDownload,
  FaEye,
  FaTimes,
  FaUserCircle,
  FaCheckCircle,
} from "react-icons/fa";
import api from ".././api"; // adjust path
import Swal from "sweetalert2";

// ─── Item metadata ───
const KIT_ITEMS = [
  { key: "laptop", label: "Laptop", icon: <FaLaptop /> },
  { key: "mouse", label: "Mouse", icon: <FaMouse /> },
  { key: "keyboard", label: "Keyboard", icon: <FaKeyboard /> },
  { key: "pen", label: "Pen", icon: <FaPen /> },
  { key: "book", label: "Book", icon: <FaBook /> },
  { key: "cupMug", label: "Cup/Mug", icon: <FaCoffee /> },
  { key: "yearlyCalendar", label: "Calendar", icon: <FaCalendarAlt /> },
  { key: "documentFolder", label: "Doc Folder", icon: <FaFolder /> },
  { key: "keychain", label: "Keychain", icon: <FaKey /> },
  { key: "waterBottle", label: "Water Bottle", icon: <FaTint /> },
  { key: "other", label: "Other", icon: <FaPlus /> },
];

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

// ─── Detail Modal ───
const KitDetailModal = ({ kit, onClose }) => {
  if (!kit) return null;

  const items = kit.itemsReceived || {};
  const receivedItems = KIT_ITEMS.filter((i) => items[i.key]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaGift className="text-yellow-300 text-xl" />
            <div>
              <h2 className="text-white font-black text-lg">Welcome Kit Details</h2>
              <p className="text-blue-200 text-xs">Submitted on {formatDate(kit.submittedAt)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white p-1.5 bg-white/10 rounded-full transition">
            <FaTimes size={14} />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {/* Employee Card */}
          <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4 border border-gray-100 mb-5">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-black shadow">
              {(kit.employeeName || "E")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-gray-800 text-base">{kit.employeeName}</p>
              <p className="text-xs text-gray-500">{kit.role || "—"} &bull; {kit.department || "—"}</p>
              <p className="text-xs text-gray-400 mt-0.5">{kit.email || "—"}</p>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100 px-2 py-1 rounded-full">
              {kit.employeeCode || "—"}
            </span>
          </div>

          {/* Items received */}
          {kit.notTakenAnything ? (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-4">
              <FaBan className="text-red-400 text-xl shrink-0" />
              <div>
                <p className="font-bold text-red-600 text-sm">Did not take any items</p>
                <p className="text-xs text-red-400 mt-0.5">Employee indicated they did not receive any kit items.</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Items Received</p>
              {receivedItems.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No items selected.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {receivedItems.map((item) => (
                    <div key={item.key} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                      <span className="text-green-500">{item.icon}</span>
                      <span className="text-xs font-bold text-green-700">
                        {item.label}
                        {item.key === "other" && items.otherDescription
                          ? ` (${items.otherDescription})`
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Admin Page ───
const AdminWelcomeKits = () => {
  const [kits, setKits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all"); // "all" | "taken" | "not_taken"
  const [selectedKit, setSelectedKit] = useState(null);

  useEffect(() => {
    fetchKits();
  }, []);

  const fetchKits = async () => {
    setLoading(true);
    try {
      // ✅ FIX: Added /api/ prefix
      const res = await api.get("/api/welcome-kit/all");
      console.log("Fetched kits:", res.data); // Debug log
      setKits(res.data.data || []);
    } catch (err) {
      console.error("Fetch error:", err);
      Swal.fire({ 
        icon: "error", 
        title: "Failed to load", 
        text: err?.response?.data?.message || "Could not fetch welcome kit data." 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Delete this entry?",
      text: "This will allow the employee to re-submit their welcome kit.",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, Delete",
    });
    if (!confirm.isConfirmed) return;

    try {
      // ✅ FIX: Added /api/ prefix
      await api.delete(`/api/welcome-kit/${id}`);
      setKits((prev) => prev.filter((k) => k._id !== id));
      Swal.fire({ icon: "success", title: "Deleted", timer: 1500, showConfirmButton: false });
    } catch (err) {
      console.error("Delete error:", err);
      Swal.fire({ icon: "error", title: "Delete failed", text: err?.response?.data?.message });
    }
  };

  // ─── Filtering ───
  const filtered = kits.filter((kit) => {
    const matchSearch =
      kit.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
      kit.employeeCode?.toLowerCase().includes(search.toLowerCase()) ||
      kit.department?.toLowerCase().includes(search.toLowerCase()) ||
      kit.email?.toLowerCase().includes(search.toLowerCase());

    const matchFilter =
      filterType === "all" ||
      (filterType === "taken" && !kit.notTakenAnything) ||
      (filterType === "not_taken" && kit.notTakenAnything);

    return matchSearch && matchFilter;
  });

  // ─── Stats ───
  const totalTaken = kits.filter((k) => !k.notTakenAnything).length;
  const totalNotTaken = kits.filter((k) => k.notTakenAnything).length;

  // ─── Item count summary ───
  const getItemCount = (key) => kits.filter((k) => k.itemsReceived?.[key]).length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      {/* Detail Modal */}
      {selectedKit && (
        <KitDetailModal kit={selectedKit} onClose={() => setSelectedKit(null)} />
      )}

      {/* ─── Header ─── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow">
            <FaGift className="text-white text-lg" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">Welcome Kit Submissions</h1>
            <p className="text-sm text-gray-400">Track which employees have submitted their welcome kit acknowledgment</p>
          </div>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Submitted", value: kits.length, color: "blue", icon: <FaCheckCircle /> },
          { label: "Items Taken", value: totalTaken, color: "green", icon: <FaGift /> },
          { label: "Not Taken", value: totalNotTaken, color: "red", icon: <FaBan /> },
          { label: "Departments", value: [...new Set(kits.map((k) => k.department).filter(Boolean))].length, color: "purple", icon: <FaUserCircle /> },
        ].map((s) => (
          <div key={s.label} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow bg-${s.color}-500`}>
              {s.icon}
            </div>
            <div>
              <p className="text-2xl font-black text-gray-800">{s.value}</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Item Distribution ─── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Item Distribution</p>
        <div className="flex flex-wrap gap-2">
          {KIT_ITEMS.map((item) => {
            const count = getItemCount(item.key);
            if (count === 0) return null;
            return (
              <div key={item.key} className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5 text-xs font-bold text-blue-700">
                <span className="text-blue-400">{item.icon}</span>
                {item.label}
                <span className="bg-blue-500 text-white rounded-full px-1.5 ml-1 font-black">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Filters & Search ─── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex-1 shadow-sm">
          <FaSearch className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by name, ID, department, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="outline-none text-sm font-medium w-full text-gray-700 placeholder-gray-400"
          />
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
          <FaFilter className="text-gray-400 shrink-0 text-sm" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="outline-none text-sm font-medium text-gray-700 bg-transparent cursor-pointer"
          >
            <option value="all">All Submissions</option>
            <option value="taken">Items Taken</option>
            <option value="not_taken">Not Taken</option>
          </select>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-sm text-gray-400 font-semibold">Loading submissions...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FaGift className="text-gray-200 text-5xl" />
            <p className="text-gray-400 font-bold text-sm">No submissions found</p>
            {search && <p className="text-xs text-gray-300">Try clearing your search</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-gray-400">#</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-gray-400">Employee</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hidden sm:table-cell">Department</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-gray-400">Items</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hidden md:table-cell">Submitted</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((kit, idx) => {
                  const receivedCount = KIT_ITEMS.filter((i) => kit.itemsReceived?.[i.key]).length;
                  return (
                    <tr key={kit._id} className="hover:bg-gray-50/70 transition group">
                      <td className="px-5 py-3.5 text-gray-400 font-bold">{idx + 1}</td>

                      {/* Employee */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm">
                            {(kit.employeeName || "E")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">{kit.employeeName}</p>
                            <p className="text-[10px] text-gray-400 font-semibold">
                              {kit.employeeCode && <span className="text-blue-500">{kit.employeeCode} &bull; </span>}
                              {kit.role || ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span className="text-xs font-bold text-gray-600 bg-gray-100 rounded-full px-2 py-1">
                          {kit.department || "—"}
                        </span>
                      </td>

                      {/* Items */}
                      <td className="px-5 py-3.5">
                        {kit.notTakenAnything ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
                            <FaBan className="text-[10px]" /> Not Taken
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
                            <FaGift className="text-[10px]" />
                            {receivedCount} item{receivedCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </td>

                      {/* Submitted date */}
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <span className="text-xs text-gray-500 font-semibold">{formatDate(kit.submittedAt)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => setSelectedKit(kit)}
                            className="w-8 h-8 flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-500 rounded-lg transition border border-blue-100"
                            title="View details"
                          >
                            <FaEye size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(kit._id)}
                            className="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-400 rounded-lg transition border border-red-100"
                            title="Delete (allows re-submission)"
                          >
                            <FaTimes size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Footer count */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
              <p className="text-xs text-gray-400 font-semibold">
                Showing <span className="text-gray-600 font-black">{filtered.length}</span> of{" "}
                <span className="text-gray-600 font-black">{kits.length}</span> submissions
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminWelcomeKits;