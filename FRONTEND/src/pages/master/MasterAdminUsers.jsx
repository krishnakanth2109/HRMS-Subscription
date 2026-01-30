import React, { useEffect, useState } from "react";
import { MoreVertical, Search, Filter, Loader2 } from "lucide-react";
// ✅ FIXED IMPORT PATH: Points to src/api.js
import { getAllAdminsForMaster } from "../../api"; 

const MasterAdminUsers = () => {
  const [admins, setAdmins] = useState([]);
  const [filteredAdmins, setFilteredAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const data = await getAllAdminsForMaster();
      setAdmins(data.admins);
      setFilteredAdmins(data.admins);
    } catch (error) {
      console.error("Failed to load admins");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    const filtered = admins.filter(
        admin => 
            (admin.name && admin.name.toLowerCase().includes(term)) || 
            (admin.email && admin.email.toLowerCase().includes(term)) ||
            (admin.department && admin.department.toLowerCase().includes(term))
    );
    setFilteredAdmins(filtered);
  };

  if (loading) {
    return (
        <div className="flex justify-center items-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header & Filter */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Registered Companies</h2>
          <p className="text-sm text-slate-500">Manage all tenant administrators</p>
        </div>
        <div className="flex gap-3">
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={handleSearch}
                    placeholder="Search name, email..." 
                    className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
                <Filter size={16} /> Filters
            </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Admin / Company</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Subscription</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAdmins.length === 0 ? (
                <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-slate-500">No admins found.</td>
                </tr>
            ) : (
                filteredAdmins.map((admin) => (
                <tr key={admin._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                            {admin.name ? admin.name.charAt(0).toUpperCase() : "U"}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800">{admin.name}</p>
                            <p className="text-xs text-slate-500">{admin.department || "Administration"}</p>
                        </div>
                    </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{admin.email}</td>
                    <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded border border-slate-200 text-xs font-medium text-slate-600">
                            {admin.plan}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        admin.subscriptionStatus === 'active' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                    }`}>
                        {admin.subscriptionStatus || "Inactive"}
                    </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                    <button className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded">
                        <MoreVertical size={16} />
                    </button>
                    </td>
                </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MasterAdminUsers;