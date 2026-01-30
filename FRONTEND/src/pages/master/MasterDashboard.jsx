import React, { useEffect, useState } from "react";
import { TrendingUp, Users, Building, DollarSign, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
// ✅ FIXED IMPORT PATH: Points to src/api.js
import { getAllAdminsForMaster } from "../../api"; 

const MasterDashboard = () => {
  const [stats, setStats] = useState({
    totalCompanies: 0,
    activeSubscriptions: 0,
    estimatedRevenue: 0
  });
  const [recentAdmins, setRecentAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getAllAdminsForMaster();
        setStats(data.stats);
        setRecentAdmins(data.admins.slice(0, 5)); // Take first 5 for recent
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Companies" 
          value={stats.totalCompanies} 
          trend="+5%" 
          icon={<Building className="w-6 h-6 text-white" />} 
          color="from-blue-500 to-blue-600"
        />
        <StatCard 
          title="Active Subs" 
          value={stats.activeSubscriptions} 
          trend="Live" 
          icon={<Users className="w-6 h-6 text-white" />} 
          color="from-purple-500 to-purple-600"
        />
        <StatCard 
          title="Est. Revenue" 
          value={`$${stats.estimatedRevenue}`} 
          trend="+18%" 
          icon={<DollarSign className="w-6 h-6 text-white" />} 
          color="from-emerald-500 to-emerald-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 2. Chart Placeholder (Static for now) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">Subscription Growth</h3>
            <span className="text-xs text-slate-500">Last 12 Months</span>
          </div>
          <div className="h-64 flex items-end justify-between gap-2 px-2">
            {[40, 65, 50, 80, 55, 90, 70, 85, 60, 95, 75, 100].map((h, i) => (
              <motion.div 
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="w-full bg-blue-100 hover:bg-blue-500 rounded-t-lg transition-colors duration-300 relative group"
              ></motion.div>
            ))}
          </div>
        </div>

        {/* 3. Recent Registrations (Real Data) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Onboarding</h3>
          <div className="space-y-4">
            {recentAdmins.length === 0 ? (
                <p className="text-sm text-slate-400">No companies found.</p>
            ) : (
                recentAdmins.map((admin, index) => (
                <div key={admin._id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                    {admin.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-800">{admin.name}</h4>
                    <p className="text-xs text-slate-500">{admin.department || "Admin"}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${admin.subscriptionStatus === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {admin.plan}
                    </span>
                </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, trend, icon, color }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden"
  >
    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${color} opacity-10 rounded-bl-full -mr-4 -mt-4`}></div>
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow-lg shadow-blue-500/20`}>
        {icon}
      </div>
    </div>
    <div className="flex items-center gap-2">
      <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1">
        <TrendingUp size={12} /> {trend}
      </span>
    </div>
  </motion.div>
);

export default MasterDashboard;