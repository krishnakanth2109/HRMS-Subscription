// --- START OF FILE Login.jsx ---

import { useState, useContext, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import logo from "../assets/logo.png";
import { loginUser } from "../api.js"; // Import the centralized API function

const Login = () => {
  // The login function from context will now likely call our API
  const { user, login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user?.role === "admin") navigate("/admin/dashboard");
    else if (user?.role === "employee") navigate("/employee/dashboard");
  }, [user, navigate]);

  // Auto clear error
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(""); // Clear previous errors

    try {
      // Use the login function from AuthContext, which should internally call your API.
      // This is a more robust pattern than calling the API directly in the component.
      // Your AuthContext's login function would look something like:
      // const login = async (email, password) => {
      //   const userData = await loginUser(email, password);
      //   setUser(userData);
      //   return userData.role;
      // };

      const result = await login(email, password); // Using the context login function

      if (result === "admin") {
        navigate("/admin/dashboard");
      } else if (result === "employee") {
        navigate("/employee/dashboard");
      }
    } catch (err) {
      // Handle login failure
      setError(err.response?.data?.message || "Invalid credentials. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate("/forgot-password");
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 1) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.15 },
    }),
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-200 via-blue-100 to-blue-400 px-4 relative overflow-hidden">
      {/* Background circles */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-40 h-40 bg-blue-300 rounded-full opacity-30 animate-pulse" />
        <div className="absolute bottom-20 right-20 w-56 h-56 bg-blue-500 rounded-full opacity-20 animate-ping" />
        <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-blue-400 rounded-full opacity-20 animate-pulse" />
      </div>

      {/* Loader Screen */}
      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center min-h-screen relative z-10"
        >
          {/* 3D rotating + floating logo */}
          <motion.div
            animate={{
              rotateX: [0, 360],
              rotateY: [0, 360],
              rotateZ: [0, 360],
              y: [0, -20, 0],
              scale: [1, 1.1, 1],
              boxShadow: [
                "0 0 20px rgba(59,130,246,0.4)",
                "0 0 40px rgba(59,130,246,0.9)",
                "0 0 20px rgba(59,130,246,0.4)",
              ],
            }}
            transition={{
              rotateX: { repeat: Infinity, duration: 3, ease: "linear" },
              rotateY: { repeat: Infinity, duration: 4, ease: "linear" },
              rotateZ: { repeat: Infinity, duration: 5, ease: "linear" },
              y: { repeat: Infinity, duration: 2, ease: "easeInOut" },
              scale: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
              boxShadow: { repeat: Infinity, duration: 2, ease: "easeInOut" },
            }}
            style={{
              transformStyle: "preserve-3d",
              borderRadius: "50%",
              padding: "20px",
              background:
                "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(147,51,234,0.2))",
            }}
          >
            <img
              src={logo}
              alt="Loading..."
              className="h-24 w-24 drop-shadow-2xl"
            />
          </motion.div>

          {/* Gradient shimmer text */}
          <motion.p
            className="mt-6 text-xl font-extrabold bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent"
            animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            Verifying credentials...
          </motion.p>
        </motion.div>
      ) : (
        // Login Form
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.2 } },
          }}
          className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10"
        >
          <motion.div
            variants={fadeIn}
            className="flex flex-col items-center mb-6"
          >
            {/* Animated logo on form */}
            <motion.img
              src={logo}
              alt="Company Logo"
              className="h-16 w-16 mb-2 drop-shadow-lg"
              initial={{ scale: 0, rotateX: -90 }}
              animate={{
                scale: 1,
                rotateX: 0,
                rotateY: [0, 10, -10, 0],
              }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 20,
                rotateY: { duration: 3, repeat: Infinity, ease: "easeInOut" },
              }}
            />
            <h2 className="text-3xl font-extrabold text-blue-700 mb-1 drop-shadow">
              Welcome to V-Sync
            </h2>
            <p className="text-sm text-gray-500">Please login to continue</p>
          </motion.div>

          {error && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-3 flex items-center justify-center gap-2 text-red-600 text-sm font-semibold bg-red-100 rounded-lg py-2 px-3 shadow"
            >
              <FaLock className="text-red-500" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <motion.div className="relative" variants={fadeIn} custom={1}>
              <FaEnvelope className="absolute left-3 top-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder=" "
                className="w-full pl-10 pr-4 pt-5 pb-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none peer bg-gray-50"
              />
              <label className="absolute left-10 top-2 text-sm text-gray-500 transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400">
                Email
              </label>
            </motion.div>

            {/* Password */}
            <motion.div className="relative" variants={fadeIn} custom={2}>
              <FaLock className="absolute left-3 top-4 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder=" "
                className="w-full pl-10 pr-10 pt-5 pb-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none peer bg-gray-50"
              />
              <label className="absolute left-10 top-2 text-sm text-gray-500 transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400">
                Password
              </label>
              <span
                className="absolute right-3 top-4 text-gray-500 cursor-pointer"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </motion.div>

            {/* Forgot Password */}
            <motion.div
              className="text-right text-sm"
              variants={fadeIn}
              custom={3}
            >
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-blue-600 hover:underline font-semibold"
              >
                Forgot Password?
              </button>
            </motion.div>

            {/* Submit */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              variants={fadeIn}
              custom={5}
              type="submit"
              disabled={loading}
              className={`w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 shadow ${
                loading ? "cursor-not-allowed opacity-70" : ""
              }`}
            >
              {loading ? "Logging in..." : "Login"}
            </motion.button>
          </form>
        </motion.div>
      )}
    </div>
  );
};

export default Login;