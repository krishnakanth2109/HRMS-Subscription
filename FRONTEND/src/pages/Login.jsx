// --- START OF FILE Login.jsx ---
import { useState, useContext, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
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
      const errorMessage = err.response?.data?.message || "";
      if (
        errorMessage.toLowerCase().includes("inactive") ||
        errorMessage.toLowerCase().includes("deactivate") ||
        errorMessage.toLowerCase().includes("disabled")
      ) {
        setError("Your account is Deactivated, please contact support team");
      } else {
        setError(errorMessage || "Invalid credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#1f1339] via-[#2b1650] to-[#4b1f88] flex relative overflow-hidden">

      {/* Subtle dotted background pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_#ffffff33_0,_transparent_55%)]" />

      {/* Top floating accent pill */}
      <motion.div
        initial={{ opacity: 0, y: -30, x: -40 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ duration: 0.8 }}
        className="hidden md:flex absolute top-8 left-12 items-center gap-3 bg-white/10 border border-white/20 rounded-full px-4 py-2 backdrop-blur-xl"
      >
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-xs font-semibold text-white">
          AI
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-white/90 tracking-wide">
            Arah Info Tech
          </span>
          <span className="text-[10px] text-purple-100">
            Human Resource Management Suite
          </span>
        </div>
      </motion.div>

      {/* Left branding section */}
      <div className="hidden lg:flex w-1/2 h-full items-center justify-center align-start pl-20 pr-8 relative" style={{ marginTop: "100px" }}>
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-xl text-white relative"
        >
          <h1 className="text-4xl xl:text-5xl font-semibold leading-tight">
            Smart HR.  
            <span className="text-purple-200"> Seamless Workforce.</span>
          </h1>
          <p className="mt-5 text-sm xl:text-base text-purple-100/90 max-w-md leading-relaxed">
            Arah Info Tech HRMS enables you to manage attendance, shifts, leave, payroll
            and performance from a single, secure platform built for growing teams.
          </p>

          {/* Stats / highlights row */}
          <div className="mt-8 flex flex-wrap gap-4">
            <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 backdrop-blur-xl">
              <p className="text-xs text-purple-100 uppercase tracking-wide mb-1">
                24/7 Access
              </p>
              <p className="text-lg font-semibold">Employee Self Service</p>
            </div>
            <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 backdrop-blur-xl">
              <p className="text-xs text-purple-100 uppercase tracking-wide mb-1">
                Secure
              </p>
              <p className="text-lg font-semibold">Role Based Login</p>
            </div>
          </div>

          {/* Decorative blob */}
          <motion.div
            className="absolute -right-16 bottom-[-60px] w-52 h-52 rounded-full bg-gradient-to-tr from-purple-500/60 to-indigo-400/30 blur-3xl opacity-70"
            animate={{ y: [0, -15, 0] }}
            transition={{ repeat: Infinity, duration: 10, ease: "easeInOut" }}
          />
        </motion.div>
      </div>

      {/* Right login section */}
      <div className="flex flex-1 items-center justify-center px-5 sm:px-8 lg:px-16 relative">
        {/* Background floating shapes on right */}
        <motion.div
          className="absolute -top-20 right-[-40px] h-56 w-56 rounded-full bg-gradient-to-br from-purple-500/40 to-indigo-300/10 blur-3xl opacity-80"
          animate={{ x: [0, -15, 5, 0], y: [0, 10, -5, 0] }}
          transition={{ repeat: Infinity, duration: 14, ease: "easeInOut" }}
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
          className="w-full max-w-md relative"
        >
          {/* Card shadow layer */}
          <div className="absolute -inset-0.5 bg-gradient-to-br from-purple-500/60 via-indigo-400/40 to-purple-700/60 rounded-3xl opacity-50 blur-2xl" />

          {/* Main card */}
          <div className="relative bg-white/95 rounded-3xl border border-purple-100/70 shadow-xl backdrop-blur-2xl px-8 sm:px-10 py-9">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-purple-500 uppercase">
                  HRMS Portal
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mt-1">
                  Sign in to continue
                </h2>
              </div>
              <div className="hidden sm:flex h-10 w-10 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-500 items-center justify-center text-white text-lg font-bold shadow-md">
                AI
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-500 mb-4">
              Use your corporate email and password to access the HRMS dashboard.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-300 text-red-600 text-xs sm:text-sm py-2 px-3 mb-4 rounded-lg font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Work Email
                </label>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-purple-500 focus-within:bg-white transition-all duration-150">
                  <FaEnvelope className="text-gray-400 mr-3 text-sm" />
                  <input
                    type="email"
                    className="w-full bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400"
                    placeholder="you@company.com"
                    value={email}
                    required
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-[11px] font-medium text-purple-600 hover:text-purple-800"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-purple-500 focus-within:bg-white transition-all duration-150">
                  <FaLock className="text-gray-400 mr-3 text-sm" />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400"
                    placeholder="••••••••"
                    value={password}
                    required
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <span
                    className="text-gray-400 cursor-pointer hover:text-purple-600 ml-2 text-sm"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div>
              </div>

              {/* Remember + Security hint */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <input
                    id="remember"
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <label
                    htmlFor="remember"
                    className="text-[11px] text-gray-600"
                  >
                    Remember this device
                  </label>
                </div>
                <p className="text-[10px] text-gray-400">
                  Encrypted & role-based access
                </p>
              </div>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.97 }}
                whileHover={{ scale: 1.01 }}
                className="w-full mt-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold shadow-md hover:from-purple-700 hover:to-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
              >
                {loading ? "Signing you in..." : "Sign in to Dashboard"}
              </motion.button>
            </form>

            {/* Footer small note */}
            <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-3">
              <p className="text-[10px] text-gray-400">
                Having trouble? Contact{" "}
                <span className="text-purple-600 font-medium">
                  support@arahinfotech.com
                </span>
              </p>
              <span className="text-[10px] text-gray-400">
                v1.0 • HRMS Suite
              </span>
            </div>
          </div>

          {/* Bottom copyright */}
          <div className="mt-5 text-center text-[10px] text-purple-100/80">
            © {new Date().getFullYear()} Arah Info Tech. All rights reserved.
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
// --- END OF FILE Login.jsx ---
