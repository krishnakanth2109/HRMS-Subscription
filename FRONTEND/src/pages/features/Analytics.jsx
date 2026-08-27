import React from 'react';
import { Link } from 'react-router-dom';
import { FaChartBar, FaArrowLeft, FaChartLine, FaChartPie, FaUsers } from 'react-icons/fa';

const Analytics = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0618] via-[#1a0b2e] to-[#0c1a2e] text-white p-6 sm:p-12 font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/30 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-900/30 rounded-full blur-[120px] animate-pulse delay-1000"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        <Link to="/login" className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors mb-12">
          <FaArrowLeft /> Back to Login
        </Link>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-fadeIn">
            <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-white/10 shadow-lg shadow-purple-500/20">
              <FaChartBar className="text-4xl text-purple-400" />
            </div>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
              Real-Time <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Workforce Analytics</span>
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed">
              Transform your HR data into actionable insights. Monitor employee performance, attendance trends, and organizational health in real-time with our advanced analytics dashboard.
            </p>
            <div className="space-y-4 pt-4">
              {[
                { icon: <FaChartLine />, title: 'Predictive Trends', desc: 'Forecast staffing needs using AI.' },
                { icon: <FaChartPie />, title: 'Custom Reports', desc: 'Export tailored data for executives.' },
                { icon: <FaUsers />, title: 'Engagement Metrics', desc: 'Track overall team satisfaction.' }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="p-3 bg-white/5 rounded-lg text-purple-400">{item.icon}</div>
                  <div>
                    <h3 className="font-bold text-white">{item.title}</h3>
                    <p className="text-sm text-gray-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative animate-slideUp">
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 rounded-[2rem] transform rotate-3 scale-105 blur-sm"></div>
            <div className="relative bg-[#0f0a1e] border border-white/10 p-8 rounded-[2rem] shadow-2xl backdrop-blur-xl">
              <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                <h3 className="text-xl font-bold">Live Dashboard</h3>
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="h-32 bg-gradient-to-r from-purple-900/40 to-indigo-900/40 rounded-xl border border-white/5 relative overflow-hidden">
                  <svg className="absolute bottom-0 w-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                    <path d="M0,20 L0,10 Q25,0 50,15 T100,5 L100,20 Z" fill="rgba(167, 139, 250, 0.2)" />
                    <path d="M0,20 L0,15 Q25,5 50,10 T100,0 L100,20 Z" fill="rgba(129, 140, 248, 0.2)" />
                  </svg>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <p className="text-sm text-gray-400 mb-1">Active Staff</p>
                    <p className="text-3xl font-bold text-white">1,248</p>
                    <p className="text-xs text-green-400 mt-2">↑ 12% vs last week</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <p className="text-sm text-gray-400 mb-1">Productivity</p>
                    <p className="text-3xl font-bold text-white">94%</p>
                    <p className="text-xs text-green-400 mt-2">↑ 3% vs last week</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Analytics;
