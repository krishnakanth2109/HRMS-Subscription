// --- START OF FILE Login.jsx ---
import { useState, useContext, useEffect, useMemo } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaShieldAlt,
  FaUserTie,
  FaChartLine,
  FaFingerprint
} from "react-icons/fa";

const Login = () => {
  const { user, login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ---------------------------------------------------------------------------
      PREVENT INFINITE REDIRECT LOOP
  --------------------------------------------------------------------------- */
  useEffect(() => {
    if (!user) return;

    const currentPath = window.location.pathname;

    if (
      (user.role === "admin" || user.role === "manager") &&
      currentPath !== "/admin/dashboard"
    ) {
      navigate("/admin/dashboard", { replace: true });
    } else if (user.role === "employee" && currentPath !== "/employee/dashboard") {
      navigate("/employee/dashboard", { replace: true });
    }
  }, [user, navigate]);

  /* ---------------------------------------------------------------------------
      LOGIN SUBMIT HANDLER
  --------------------------------------------------------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.includes("@")) {
      return setError("Enter a valid email address.");
    }
    if (password.length < 4) {
      return setError("Password must be at least 4 characters.");
    }

    setLoading(true);
    try {
      const res = await login(email, password);

      // Save token
      if (res?.data?.token) {
        sessionStorage.setItem("hrms-token", res.data.token);
      }

      // Save user
      if (res?.data?.user) {
        sessionStorage.setItem("hrmsUser", JSON.stringify(res.data.user));
      }

      const role = res?.data?.user?.role;

      // Redirect based on role
      if (role === "admin" || role === "manager") {
        navigate("/admin/dashboard", { replace: true });
      } else {
        navigate("/employee/dashboard", { replace: true });
      }
    } catch (err) {
      console.error("Login Error Details:", err.response);
      const errorMessage = err.response?.data?.message || "";
      if (
        errorMessage.toLowerCase().includes("inactive") ||
        errorMessage.toLowerCase().includes("deactivate") ||
        errorMessage.toLowerCase().includes("disabled")
      ) {
        setError("Your account is Deactivated, please contact support team");
      } else {
        setError(errorMessage || "Server Error during login. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------------------------------------
      OPTIMIZED BACKGROUND (PREVENTS RE-RENDER LAG ON TYPING)
  --------------------------------------------------------------------------- */
  const animatedBackground = useMemo(() => (
    <div className="pointer-events-none absolute inset-0">
      {/* Main gradient mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
      
      {/* Animated gradient orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-[700px] h-[700px] rounded-full bg-gradient-to-r from-purple-600/20 via-pink-500/10 to-transparent blur-4xl"
        animate={{
          x: [0, 100, 0],
          y: [0, -50, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-l from-indigo-600/20 to-blue-500/10 blur-4xl"
        animate={{
          x: [0, -80, 0],
          y: [0, 60, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* New third bubble */}
      <motion.div
        className="absolute top-1/3 right-1/3 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-blue-600/15 to-purple-500/10 blur-4xl"
        animate={{
          x: [0, 60, 0],
          y: [0, 80, 0],
          scale: [1, 1.15, 1]
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Animated grid pattern */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `linear-gradient(to right, #8882 1px, transparent 1px),
                           linear-gradient(to bottom, #8882 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />
      
      {/* Floating particles - Optimized Count (15) */}
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-purple-300/40 rounded-full"
          initial={{
            x: Math.random() * 100 + 'vw',
            y: Math.random() * 100 + 'vh'
          }}
          animate={{
            y: [null, `-${Math.random() * 150}px`],
            x: [null, `${Math.random() * 80 - 40}px`]
          }}
          transition={{
            duration: Math.random() * 15 + 15,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut"
          }}
        />
      ))}
      
      {/* Additional small floating elements - Optimized Count (6) */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={`small-${i}`}
          className="absolute w-3 h-3 bg-gradient-to-r from-pink-400/20 to-purple-400/20 rounded-full blur-sm"
          initial={{
            x: Math.random() * 100 + 'vw',
            y: Math.random() * 100 + 'vh',
            scale: 0.5
          }}
          animate={{
            y: [null, `-${Math.random() * 200}px`, `-${Math.random() * 100}px`],
            x: [null, `${Math.random() * 100 - 50}px`, `${Math.random() * 100 - 50}px`],
            scale: [0.5, 1, 0.5]
          }}
          transition={{
            duration: Math.random() * 20 + 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  ), []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] flex relative overflow-hidden">

      {/* RENDER OPTIMIZED BACKGROUND */}
      {animatedBackground}

      {/* Left branding section - Enhanced */}
      <div className="hidden lg:flex w-1/2 h-full items-center justify-center align-start pl-24 pr-12 relative">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="max-w-xl text-white relative z-10"
        >
          <br />
          <br />
          <br />
          
          <h1 className="text-5xl xl:text-6xl font-bold leading-tight bg-gradient-to-r from-white via-purple-100 to-purple-200 bg-clip-text text-transparent">
            Elevate Your
            <span className="block mt-2">Work Experience</span>
          </h1>
          
          <p className="mt-6 text-lg text-purple-100/90 max-w-md leading-relaxed">
            Arah Info Tech HRMS delivers seamless workforce management with AI-powered insights, 
            real-time analytics, and secure role-based access control.
          </p>

          {/* Features grid */}
          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { icon: <FaChartLine />, title: "Real-time Analytics", desc: "Live dashboard" },
              { icon: <FaFingerprint />, title: "Biometric Auth", desc: "Multi-factor" },
              { icon: <FaShieldAlt />, title: "Bank-grade Security", desc: "256-bit encryption" },
              { icon: <FaUserTie />, title: "Role Control", desc: "Granular access" }
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ scale: 1.05, translateY: -5 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all duration-300 group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-indigo-500/30 flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{feature.title}</p>
                    <p className="text-xs text-purple-200/60">{feature.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Floating elements */}
          <motion.div
            className="absolute -right-24 top-20 w-80 h-80 rounded-full bg-gradient-to-tr from-purple-600/40 to-pink-500/20 blur-3xl"
            animate={{
              rotate: [0, 180, 360],
              scale: [1, 1.2, 1]
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        </motion.div>
      </div>

      {/* Right login section - Enhanced */}
      <div className="flex flex-1 items-center justify-center px-5 sm:px-8 lg:px-20 relative">
        {/* Background floating elements */}
        <motion.div
          className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-purple-600/30 to-pink-500/10 blur-4xl"
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
            rotate: [0, 90, 0]
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Additional background bubble */}
        <motion.div
          className="absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-indigo-600/20 to-blue-500/15 blur-3xl"
          animate={{
            x: [0, 40, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, type: "spring" }}
          className="w-full max-w-md relative"
        >
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-700 rounded-3xl opacity-50 blur-xl animate-pulse" style={{ animationDuration: '4s' }} />
          
          {/* Main card */}
          <div className="relative bg-gradient-to-br from-white/95 to-white/90 rounded-3xl border border-white/40 shadow-2xl backdrop-blur-3xl px-9 sm:px-11 py-10 overflow-hidden">
            {/* Card glow effect */}
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl" />
            
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center justify-between mb-8"
            >
              <div>
                <motion.div
                  className="flex items-center gap-2 mb-2"
                  whileHover={{ x: 5 }}
                >
                  <div className="h-2 w-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 animate-pulse" />
                  <p className="text-xs font-bold tracking-[0.2em] text-purple-600 uppercase">
                    Secure Portal
                  </p>
                </motion.div>
                <h2 className="text-3xl sm:text-3xl font-bold text-gray-900 mt-1">
                  Welcome Back
                </h2>
              </div>
              <motion.div
                className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-500 to-purple-700 flex items-center justify-center text-white text-lg font-bold shadow-lg"
                whileHover={{ 
                  scale: 1.1,
                  rotate: 360 
                }}
                transition={{ duration: 0.6 }}
              >
                AI
              </motion.div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-sm text-gray-600 mb-6 leading-relaxed"
            >
             
            </motion.p>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 text-red-700 text-sm py-3 px-4 mb-5 rounded-xl font-medium shadow-inner"
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  {error}
                </div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <label className="block text-xs font-bold text-gray-700 mb-2 tracking-wide">
                  WORK EMAIL
                </label>
                <div className="flex items-center bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl px-4 py-3.5 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-200 focus-within:bg-white transition-all duration-300 shadow-sm hover:shadow-md">
                  <FaEnvelope className="text-gray-400 mr-3 text-sm" />
                  <input
                    type="email"
                    className="w-full bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400 font-medium"
                    placeholder="employee@arahinfotech.com"
                    value={email}
                    required
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </motion.div>

              {/* Password */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-700 tracking-wide">
                    PASSWORD
                  </label>
                  <motion.button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-xs font-medium text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    whileHover={{ x: 3 }}
                  >
                    Forgot Password?
                    <span className="text-[10px]">→</span>
                  </motion.button>
                </div>
                <div className="flex items-center bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl px-4 py-3.5 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-200 focus-within:bg-white transition-all duration-300 shadow-sm hover:shadow-md">
                  <FaLock className="text-gray-400 mr-3 text-sm" />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400 font-medium tracking-wider"
                    placeholder="••••••••••"
                    value={password}
                    required
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <motion.span
                    className="text-gray-400 cursor-pointer hover:text-purple-600 ml-2 text-sm"
                    onClick={() => setShowPassword(!showPassword)}
                    whileTap={{ scale: 0.9 }}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </motion.span>
                </div>
              </motion.div>

              {/* Remember me */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center justify-between pt-2"
              >
                <div className="flex items-center gap-2">
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className="relative"
                  >
                    <input
                      id="remember"
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                  </motion.div>
                  <label
                    htmlFor="remember"
                    className="text-xs text-gray-600 cursor-pointer"
                  >
                    Remember this device
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-[10px] text-gray-400 font-medium">
                    Session Encrypted
                  </p>
                </div>
              </motion.div>

              {/* Submit button */}
              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.97 }}
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 10px 25px -5px rgba(139, 92, 246, 0.5)"
                }}
                className="w-full mt-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white py-3.5 rounded-xl text-sm font-bold shadow-lg hover:shadow-purple-500/30 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-300 relative overflow-hidden group"
              >
                {/* Button shine effect */}
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                
                <span className="relative flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                      />
                      Authenticating...
                    </>
                  ) : (
                    "Access Dashboard"
                  )}
                </span>
              </motion.button>
            </form>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-8 pt-6 border-t border-gray-100"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Need help?{" "}
                  <span className="text-purple-600 font-semibold hover:text-purple-800 cursor-pointer transition-colors">
                    support@arahinfotech.com
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-[10px] text-gray-400 font-mono">
                    v2.1 • HRMS
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Bottom copyright */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-center text-xs text-purple-100/70"
          >
            © {new Date().getFullYear()} Arah Info Tech. All rights reserved. 
            <span className="block text-[10px] mt-1 text-purple-100/50">
              PCI DSS Compliant • GDPR Ready • ISO 27001 Certified
            </span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
// --- END OF FILE Login.jsx ---