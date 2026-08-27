import React from 'react';
import { Link } from 'react-router-dom';
import { FaFingerprint, FaArrowLeft, FaMobileAlt, FaKey, FaShieldAlt } from 'react-icons/fa';

const Mfa = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0618] via-[#1a0b2e] to-[#0c1a2e] text-white p-6 sm:p-12 font-sans relative overflow-hidden">
      <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] bg-emerald-900/30 rounded-full blur-[120px] animate-pulse"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        <Link to="/login" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors mb-12">
          <FaArrowLeft /> Back to Login
        </Link>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-fadeIn">
            <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-white/10 shadow-lg shadow-emerald-500/20">
              <FaFingerprint className="text-4xl text-emerald-400" />
            </div>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
              Multi-Factor <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Authentication</span>
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed">
              Protect your workforce with advanced identity verification. Our platform supports biometrics, authenticator apps, and SMS OTPs to ensure 100% secure access.
            </p>
            <div className="space-y-4 pt-4">
              {[
                { icon: <FaFingerprint />, title: 'Biometric Login', desc: 'Face ID & Fingerprint support for seamless access.' },
                { icon: <FaMobileAlt />, title: 'Authenticator App', desc: 'Integrate with Google Authenticator or Authy.' },
                { icon: <FaKey />, title: 'Hardware Security', desc: 'FIDO2 & YubiKey support for enterprise-grade security.' }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="p-3 bg-white/5 rounded-lg text-emerald-400">{item.icon}</div>
                  <div>
                    <h3 className="font-bold text-white">{item.title}</h3>
                    <p className="text-sm text-gray-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative animate-slideUp">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 rounded-[2rem] transform -rotate-3 scale-105 blur-sm"></div>
            <div className="relative bg-[#0f0a1e] border border-white/10 p-12 rounded-[2rem] shadow-2xl backdrop-blur-xl text-center">
              <FaShieldAlt className="text-6xl text-emerald-500 mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-2">Verification Required</h3>
              <p className="text-gray-400 mb-8">Please enter the 6-digit code sent to your device.</p>
              
              <div className="flex justify-center gap-3 mb-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="w-12 h-14 bg-white/5 border border-emerald-500/50 rounded-lg flex items-center justify-center text-2xl font-bold text-white">
                    {i === 1 ? '7' : i === 2 ? '4' : i === 3 ? '9' : ''}
                  </div>
                ))}
              </div>
              
              <button className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-xl font-bold shadow-lg opacity-80 cursor-default">
                Verify Identity
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Mfa;
