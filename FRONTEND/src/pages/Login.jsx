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

  useEffect(() => {
    if (user?.role === "admin") navigate("/admin/dashboard");
    if (user?.role === "employee") navigate("/employee/dashboard");
  }, [user]);

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
      const role = await login(email, password);

      if (role === "admin") navigate("/admin/dashboard");
      else navigate("/employee/dashboard");
    } catch (err) {
      // ✅ UPDATED: Specific check for Deactivated Account
      const errorMessage = err.response?.data?.message || "";
      
      // If the backend returns a message containing "Inactive" or "Deactivate"
      if (
        errorMessage.toLowerCase().includes("inactive") || 
        errorMessage.toLowerCase().includes("deactivate") ||
        errorMessage.toLowerCase().includes("disabled")
      ) {
        setError("Your account is Deactivate please contact supprt team");
      } else {
        setError(errorMessage || "Invalid credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-white">
      
      {/* Animated Background Gradient Blobs */}
      <motion.div
        className="absolute top-[-120px] left-[-120px] w-96 h-96 bg-purple-300 rounded-full opacity-30 blur-3xl"
        animate={{ x: [0, 30, -20, 0], y: [0, 20, -15, 0] }}
        transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-140px] right-[-140px] w-[420px] h-[420px] bg-purple-400 rounded-full opacity-20 blur-3xl"
        animate={{ x: [0, -40, 20, 0], y: [0, -25, 15, 0] }}
        transition={{ repeat: Infinity, duration: 14, ease: "easeInOut" }}
      />

      {/* Main Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 35 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-md bg-white rounded-3xl shadow-xl p-10 border border-purple-100 backdrop-blur-lg"
      >
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-purple-700 tracking-tight">
            Welcome Back
          </h1>
          <p className="text-gray-500 mt-1">
            Login to your workspace
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-600 text-sm py-2 px-3 mb-4 rounded-lg font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label className="text-gray-700 text-sm font-medium">Email</label>
            <div className="group flex items-center bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 mt-1 transition focus-within:border-purple-500 focus-within:shadow-[0_0_0_3px_rgba(168,85,247,0.25)]">
              <FaEnvelope className="text-gray-400 mr-3 group-focus-within:text-purple-600 transition" />
              <input
                type="email"
                className="w-full bg-transparent outline-none text-gray-900 placeholder-gray-400"
                placeholder="yourname@company.com"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-gray-700 text-sm font-medium">Password</label>
            <div className="group flex items-center bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 mt-1 transition focus-within:border-purple-500 focus-within:shadow-[0_0_0_3px_rgba(168,85,247,0.25)]">
              <FaLock className="text-gray-400 mr-3 group-focus-within:text-purple-600 transition" />
              <input
                type={showPassword ? "text" : "password"}
                className="w-full bg-transparent outline-none text-gray-900 placeholder-gray-400"
                placeholder="••••••••"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
              />
              <span
                className="text-gray-400 cursor-pointer hover:text-purple-600 transition"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>
          </div>

          {/* Forgot Password */}
          <div className="text-right">
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="text-purple-600 text-sm hover:text-purple-800 transition font-medium"
            >
              Forgot Password?
            </button>
          </div>

          {/* Login Button */}
          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.02 }}
            className="relative w-full bg-purple-600 text-white py-3 rounded-xl font-semibold shadow-md hover:bg-purple-700 transition overflow-hidden"
          >
            {/* Loading shimmer */}
            {loading && (
              <motion.div
                className="absolute inset-0 bg-white/20"
                animate={{ x: ["-150%", "150%"] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            )}

            {loading ? "Signing In…" : "Sign In"}
          </motion.button>
        </form>

        <div className="mt-6 text-center text-gray-400 text-xs">
          © {new Date().getFullYear()} Arah Info Tech. All rights reserved.
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
// --- END OF FILE Login.jsx ---