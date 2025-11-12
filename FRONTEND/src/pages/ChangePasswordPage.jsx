// --- START OF FILE ChangePasswordPage.jsx ---

import React, { useState } from "react";
// ✅ Correctly imports the centralized API function
import { changeUserPassword } from "../api";
import { FaEye, FaEyeSlash, FaCheckCircle, FaLock } from "react-icons/fa";

// Helper function to determine password strength
const getPasswordStrength = (password) => {
  if (!password) return "";
  if (password.length < 6) return "Weak";
  if (password.match(/[A-Z]/) && password.match(/[0-9]/) && password.length >= 8)
    return "Strong";
  return "Medium";
};

// Helper component to render the strength bar
const strengthBar = (strength) => {
  if (strength === "Strong")
    return <div className="h-2 rounded bg-green-500 w-full transition-all"></div>;
  if (strength === "Medium")
    return <div className="h-2 rounded bg-yellow-400 w-2/3 transition-all"></div>;
  if (strength === "Weak")
    return <div className="h-2 rounded bg-red-500 w-1/3 transition-all"></div>;
  return <div className="h-2 rounded bg-gray-200 w-full"></div>;
};

const ChangePasswordPage = () => {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [show, setShow] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordStrength = getPasswordStrength(form.newPassword);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  const handleShow = (field) => {
    setShow((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  // The handleSubmit function is correctly asynchronous and handles the API call
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      return setError("All fields are required.");
    }
    if (form.newPassword.length < 6) {
      return setError("New password must be at least 6 characters.");
    }
    if (form.newPassword !== form.confirmPassword) {
      return setError("New password and confirm password do not match.");
    }

    setLoading(true);
    
    try {
      // It correctly calls the API function from api.js
      await changeUserPassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      setSuccess("Password changed successfully!");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      // It correctly displays the error message from the backend
      setError(err.response?.data?.message || "Failed to change password. Please check your current password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-blue-100"
        autoComplete="off"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="bg-blue-100 rounded-full p-3 mb-2">
            <FaLock className="text-blue-600 text-3xl" />
          </div>
          <h2 className="text-2xl font-bold text-blue-700 mb-1">
            Change Password
          </h2>
          <p className="text-gray-500 text-sm">
            Update your account password below
          </p>
        </div>

        {error && (
          <div className="mb-4 text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200 transition-all">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded border border-green-200 animate-fade-in transition-all">
            <FaCheckCircle className="text-green-500" /> {success}
          </div>
        )}

        <div className="mb-5 relative">
          <label className="block mb-1 font-medium text-gray-700">Current Password</label>
          <input type={show.current ? "text" : "password"} name="currentPassword" value={form.currentPassword} onChange={handleChange} className="w-full border px-3 py-2 rounded focus:outline-blue-400 pr-10 transition" autoComplete="current-password" required />
          <button type="button" tabIndex={-1} className="absolute right-3 top-9 text-gray-400 hover:text-blue-600" onClick={() => handleShow("current")} aria-label={show.current ? "Hide password" : "Show password"}>
            {/* ✅ Minor Syntax Correction */}
            {show.current ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>

        <div className="mb-5 relative">
          <label className="block mb-1 font-medium text-gray-700">New Password</label>
          <input type={show.new ? "text" : "password"} name="newPassword" value={form.newPassword} onChange={handleChange} className="w-full border px-3 py-2 rounded focus:outline-blue-400 pr-10 transition" autoComplete="new-password" required />
          <button type="button" tabIndex={-1} className="absolute right-3 top-9 text-gray-400 hover:text-blue-600" onClick={() => handleShow("new")} aria-label={show.new ? "Hide password" : "Show password"}>
            {/* ✅ Minor Syntax Correction */}
            {show.new ? <FaEyeSlash /> : <FaEye />}
          </button>
          {form.newPassword && (
            <div className="mt-2">
              {strengthBar(passwordStrength)}
              <span className={`block mt-1 text-xs font-semibold ${passwordStrength === "Strong" ? "text-green-600" : passwordStrength === "Medium" ? "text-yellow-600" : "text-red-600"}`}>
                Password strength: {passwordStrength}
              </span>
            </div>
          )}
        </div>

        <div className="mb-8 relative">
          <label className="block mb-1 font-medium text-gray-700">Confirm New Password</label>
          <input type={show.confirm ? "text" : "password"} name="confirmPassword" value={form.confirmPassword} onChange={handleChange} className="w-full border px-3 py-2 rounded focus:outline-blue-400 pr-10 transition" autoComplete="new-password" required />
          <button type="button" tabIndex={-1} className="absolute right-3 top-9 text-gray-400 hover:text-blue-600" onClick={() => handleShow("confirm")} aria-label={show.confirm ? "Hide password" : "Show password"}>
            {/* ✅ Minor Syntax Correction */}
            {show.confirm ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition flex items-center justify-center ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
          ) : null}
          {loading ? "Changing..." : "Change Password"}
        </button>
      </form>
    </div>
  );
};

export default ChangePasswordPage;