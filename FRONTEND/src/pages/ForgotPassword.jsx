import React, { useState } from "react";
import { motion } from "framer-motion";
import { FaEnvelope, FaKey } from "react-icons/fa";

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1: email, 2: OTP, 3: reset
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [userOtp, setUserOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const sendOtp = async () => {
    if (!email) return setError("Please enter your email.");
    setError("");
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setOtp(generatedOtp);

    // TODO: Send OTP to email using backend
    console.log(`Simulated OTP sent to ${email}:`, generatedOtp);

    setStep(2);
  };

  const verifyOtp = () => {
    if (userOtp === otp) {
      setError("");
      setStep(3);
    } else {
      setError("Invalid OTP.");
    }
  };

  const resetPassword = () => {
    if (newPassword !== confirmPassword) {
      return setError("Passwords do not match.");
    }

    // TODO: Send request to backend to update password
    console.log("Password reset for:", email, "New Password:", newPassword);

    alert("Password reset successful! You can now log in.");
    // Optionally redirect to login page
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-100 to-purple-200">
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md"
      >
        <h2 className="text-2xl font-bold mb-4 text-center text-blue-700">
          Forgot Password
        </h2>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-500 text-sm mb-3 text-center"
          >
            {error}
          </motion.p>
        )}

        {step === 1 && (
          <>
            <div className="relative mb-4">
              <FaEnvelope className="absolute top-3 left-3 text-gray-400" />
              <input
                type="email"
                placeholder="Enter your email"
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button
              onClick={sendOtp}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Send OTP
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="relative mb-4">
              <FaKey className="absolute top-3 left-3 text-gray-400" />
              <input
                type="text"
                placeholder="Enter the OTP"
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full"
                value={userOtp}
                onChange={(e) => setUserOtp(e.target.value)}
              />
            </div>
            <button
              onClick={verifyOtp}
              className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition"
            >
              Verify OTP
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <div className="relative mb-4">
              <input
                type="password"
                placeholder="New Password"
                className="pl-4 pr-4 py-2 border border-gray-300 rounded-lg w-full"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="relative mb-4">
              <input
                type="password"
                placeholder="Confirm Password"
                className="pl-4 pr-4 py-2 border border-gray-300 rounded-lg w-full"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button
              onClick={resetPassword}
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
            >
              Reset Password
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default ForgotPassword;