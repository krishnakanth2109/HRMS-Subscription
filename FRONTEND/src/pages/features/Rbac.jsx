import React from 'react';
import { Link } from 'react-router-dom';
import { FaUserShield, FaArrowLeft, FaUserCog, FaKey, FaClipboardCheck } from 'react-icons/fa';

const Rbac = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0618] via-[#1a0b2e] to-[#0c1a2e] text-white p-6 sm:p-12 font-sans relative overflow-hidden">
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-orange-900/30 rounded-full blur-[120px] animate-pulse"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        <Link to="/login" className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors mb-12">
          <FaArrowLeft /> Back to Login
        </Link>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-fadeIn">
            <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-white/10 shadow-lg shadow-orange-500/20">
              <FaUserShield className="text-4xl text-orange-400" />
            </div>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
              Role-Based <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">Access Control</span>
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed">
              Maintain full control over who sees what. Granular permissions allow you to define custom roles, restrict modules, and secure your organizational hierarchy.
            </p>
            <div className="space-y-4 pt-4">
              {[
                { icon: <FaUserCog />, title: 'Custom Roles', desc: 'Create unlimited custom user archetypes.' },
                { icon: <FaKey />, title: 'Granular Permissions', desc: 'Toggle read/write access per module.' },
                { icon: <FaClipboardCheck />, title: 'Audit Logs', desc: 'Track every configuration change.' }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="p-3 bg-white/5 rounded-lg text-orange-400">{item.icon}</div>
                  <div>
                    <h3 className="font-bold text-white">{item.title}</h3>
                    <p className="text-sm text-gray-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative animate-slideUp">
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/20 to-red-500/20 rounded-[2rem] transform -rotate-3 scale-105 blur-sm"></div>
            <div className="relative bg-[#0f0a1e] border border-white/10 p-8 rounded-[2rem] shadow-2xl backdrop-blur-xl">
              <h3 className="text-xl font-bold mb-6">Permission Matrix</h3>
              
              <div className="space-y-3">
                {['Master Admin', 'HR Manager', 'Team Lead', 'Employee'].map((role, idx) => (
                  <div key={idx} className="bg-white/5 p-4 rounded-xl border border-white/5 flex justify-between items-center">
                    <span className="font-semibold text-gray-200">{role}</span>
                    <div className="flex gap-2">
                      <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-[10px] font-bold">READ</span>
                      {idx < 2 && <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-[10px] font-bold">WRITE</span>}
                      {idx === 0 && <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-[10px] font-bold">DELETE</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Rbac;
