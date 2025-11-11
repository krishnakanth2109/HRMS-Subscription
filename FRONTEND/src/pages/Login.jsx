import { useState, useContext, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaEnvelope, FaLock } from "react-icons/fa";
import logo from "../assets/logo.png";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const Login = () => {
  const { user, login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user?.role === "admin") navigate("/admin/dashboard");
    else if (user?.role === "employee") navigate("/employee/dashboard");
  }, [user, navigate]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = login(email, password);

    if (result === "admin") navigate("/admin/dashboard");
    else if (result === "employee") navigate("/employee/dashboard");
    else setError("Invalid credentials. Try again.");
  };

  const handleForgotPassword = () => {
    navigate("/forgot-password");
  };

  // Animation Variants
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 1) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.15,
      },
    }),
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-200 via-blue-100 to-blue-400 px-4 relative overflow-hidden">
      {/* Animated background circles */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-40 h-40 bg-blue-300 rounded-full opacity-30 animate-pulse" />
        <div className="absolute bottom-20 right-20 w-56 h-56 bg-blue-500 rounded-full opacity-20 animate-ping" />
        <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-blue-400 rounded-full opacity-20 animate-pulse" />
      </div>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: {
              staggerChildren: 0.2,
            },
          },
        }}
        className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10"
      >
        <motion.div
          variants={fadeIn}
          className="flex flex-col items-center mb-6"
        >
          <motion.img
            src={logo}
            alt="Company Logo"
            className="h-16 w-16 mb-2 drop-shadow-lg"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          />
          <h2 className="text-3xl font-extrabold text-blue-700 mb-1 drop-shadow">Welcome to V-Sync</h2>
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
          {/* ...existing code... (no social login buttons) */}
          {/* Submit Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            variants={fadeIn}
            custom={5}
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 shadow"
          >
            Login
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;