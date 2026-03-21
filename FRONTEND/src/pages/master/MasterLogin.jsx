import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Lock, 
  ShieldCheck, 
  ArrowRight, 
  Loader2, 
  Users, 
  CreditCard, 
  Building2,
  Mail,
  Eye,
  EyeOff
} from "lucide-react";
// ✅ Pointing to your exact API path
import { loginMaster } from "../../api"; 

const MasterLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);

  // 🔒 BACKEND LOGIC REMAINS EXACTLY THE SAME
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // API Call
      const data = await loginMaster(email, password);
      
      // Save Token to Session Storage
      sessionStorage.setItem("masterToken", data.token);
      
      // Navigate
      navigate("/master/dashboard");
    } catch (err) {
      setError(err || "Invalid Master Credentials");
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2, delayChildren: 0.3 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="min-h-screen flex w-full bg-[#f8fafc] font-sans overflow-hidden">
      
      {/* ================= LEFT SIDE: DYNAMIC CONTENT ================= */}
      {/* Added z-20 and a soft, deep shadow to blend the edge into the right side */}
      <div className="hidden lg:flex w-1/2 bg-[#0a0f25] relative flex-col justify-center px-16 xl:px-24 z-20 shadow-[30px_0_80px_-15px_rgba(0,0,0,0.15)]">
        
        {/* Glowing edge transition (The "Foam" blend effect) */}
        <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-blue-500/20 to-transparent shadow-[0_0_20px_5px_rgba(59,130,246,0.15)] pointer-events-none"></div>

        {/* Animated Background Blobs */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-600 rounded-full mix-blend-screen filter blur-[100px] opacity-30 animate-pulse"></div>
          <div className="absolute top-1/2 -right-20 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-[100px] opacity-20" style={{ animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
        </div>

        {/* Content */}
        <motion.div 
          className="z-10 text-white max-w-xl"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="mb-8">
            <div className="inline-flex items-center justify-center p-3 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 mb-6 shadow-2xl">
              <ShieldCheck className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
              Master Admin <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                Control Center
              </span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              Securely oversee your entire HR vwsync ecosystem. Manage subscribers, configure global billing plans, and monitor system health from a single unified dashboard.
            </p>
          </motion.div>

          <div className="space-y-6 mt-12">
            <motion.div variants={itemVariants} className="flex items-center gap-4 group">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                <Building2 className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">Tenant Management</h3>
                <p className="text-slate-400 text-sm">Onboard and manage HRMS subscriber organizations.</p>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="flex items-center gap-4 group">
              <div className="flex-shrink-0 w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20 group-hover:bg-purple-500/20 transition-colors">
                <CreditCard className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">Plans & Billing</h3>
                <p className="text-slate-400 text-sm">Configure subscription tiers and track revenue limits.</p>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="flex items-center gap-4 group">
              <div className="flex-shrink-0 w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors">
                <Users className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">Global Users</h3>
                <p className="text-slate-400 text-sm">Monitor activity and manage master access controls.</p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* ================= RIGHT SIDE: UPGRADED LOGIN FORM ================= */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative overflow-hidden bg-slate-50/50 z-10">
        
        {/* Soft Grid Pattern */}
        <div className="absolute inset-0 z-0 opacity-[0.3]" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

        {/* Animated Background Ambient Orbs for Right Side */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-300 rounded-full mix-blend-multiply filter blur-[120px] pointer-events-none"
        />
        <motion.div 
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-300 rounded-full mix-blend-multiply filter blur-[120px] pointer-events-none"
        />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          // Added frosted glass effect (bg-white/80 and backdrop-blur)
          className="w-full max-w-md bg-white/80 backdrop-blur-2xl p-8 sm:p-10 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-white z-10 relative overflow-hidden ring-1 ring-slate-900/5"
        >
          {/* Decorative top gradient border */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500"></div>

          <div className="text-center mb-10 mt-2">
            <span className="inline-block py-1 px-3 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-bold tracking-wider uppercase mb-4 shadow-sm shadow-blue-500/10">
              Master Portal
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Welcome Back</h2>
            <p className="text-slate-500 text-sm">Enter your master credentials to securely access.</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 bg-red-50/80 border border-red-200 rounded-2xl text-red-600 text-sm font-medium flex items-center gap-3"
            >
              <div className="p-1 bg-red-100 rounded-full">
                <div className="w-2 h-2 rounded-full bg-red-600"></div>
              </div>
              {error}
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Master ID</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                  placeholder="Enter your master email"
                  required
                />
              </div>
            </div>
            
            {/* Password Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Secure Key</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-purple-500 transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-12 py-3.5 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-medium"
                  placeholder="••••••••"
                  required
                />
                {/* 👁️ Eye Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Gradient Submit Button */}
            <button 
              type="submit"
              disabled={loading}
              className="w-full relative overflow-hidden bg-slate-900 text-white font-semibold py-4 rounded-2xl shadow-[0_8px_20px_-6px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_25px_-6px_rgba(59,130,246,0.4)] transform transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:hover:transform-none disabled:cursor-not-allowed mt-6 group"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 opacity-90 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="relative z-10 flex items-center justify-center gap-3">
                {loading ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <>
                    Authorize Access 
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform duration-300" />
                  </>
                )}
              </div>
            </button>
          </form>

          <div className="mt-8 text-center border-t border-slate-100 pt-6">
            <p className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> 
              End-to-end 256-bit encrypted connection
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MasterLogin;