import React from 'react';
import { Link } from 'react-router-dom';
import { FaShieldAlt, FaArrowLeft, FaServer, FaLock, FaGlobe } from 'react-icons/fa';

const Security = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0618] via-[#1a0b2e] to-[#0c1a2e] text-white p-6 sm:p-12 font-sans relative overflow-hidden">
      <div className="absolute top-[10%] left-[-10%] w-[500px] h-[500px] bg-blue-900/30 rounded-full blur-[120px] animate-pulse"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        <Link to="/login" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors mb-12">
          <FaArrowLeft /> Back to Login
        </Link>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-fadeIn">
            <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-sky-500/20 border border-white/10 shadow-lg shadow-blue-500/20">
              <FaShieldAlt className="text-4xl text-blue-400" />
            </div>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
              Enterprise-Level <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-sky-400">Data Security</span>
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed">
              Your sensitive HR data is protected by military-grade AES-256 encryption. We comply with GDPR, SOC2, and ISO 27001 standards.
            </p>
            <div className="space-y-4 pt-4">
              {[
                { icon: <FaLock />, title: 'End-to-End Encryption', desc: 'Data is encrypted at rest and in transit.' },
                { icon: <FaServer />, title: 'Automated Backups', desc: 'Daily snapshots replicated across multiple zones.' },
                { icon: <FaGlobe />, title: 'Global Compliance', desc: 'Adheres strictly to international privacy laws.' }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="p-3 bg-white/5 rounded-lg text-blue-400">{item.icon}</div>
                  <div>
                    <h3 className="font-bold text-white">{item.title}</h3>
                    <p className="text-sm text-gray-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative animate-slideUp">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-sky-500/20 rounded-[2rem] transform rotate-3 scale-105 blur-sm"></div>
            <div className="relative bg-[#0f0a1e] border border-white/10 p-8 rounded-[2rem] shadow-2xl backdrop-blur-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Security Status</h3>
                <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">
                  ALL SYSTEMS SECURE
                </span>
              </div>
              
              <div className="space-y-4">
                {['Database Encryption', 'Network Firewall', 'Threat Detection', 'Identity Provider'].map((item, idx) => (
                  <div key={idx} className="bg-white/5 p-4 rounded-xl border border-white/5 flex justify-between items-center">
                    <span className="font-semibold text-gray-300">{item}</span>
                    <span className="text-blue-400"><FaShieldAlt /></span>
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
export default Security;
