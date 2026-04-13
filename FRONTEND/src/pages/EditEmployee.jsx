// --- START OF FILE src/pages/EditEmployee.jsx ---

import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  FaUser, FaEnvelope, FaBuilding, FaMoneyBill, FaCalendarAlt,
  FaCreditCard, FaIdBadge, FaBriefcase, FaPhone, FaMapMarkerAlt,
  FaFileContract, FaLock, FaEye, FaEyeSlash, FaShieldAlt
} from "react-icons/fa";
import { getEmployeeById, updateEmployeeById, changeEmployeePassword } from "../api.js";

const EditEmployee = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // ── Existing state ──────────────────────────────────────────────────────
  const [employee, setEmployee] = useState(null);
  const [formData, setFormData] = useState(null);
  const [snackbar, setSnackbar] = useState("");
  const [error, setError] = useState("");

  // ── Password change state ────────────────────────────────────────────────
  const [newPassword, setNewPassword]                 = useState("");
  const [confirmPassword, setConfirmPassword]         = useState("");
  const [showNewPassword, setShowNewPassword]         = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError]             = useState("");
  const [passwordLoading, setPasswordLoading]         = useState(false);

  // ── Fetch employee on mount ──────────────────────────────────────────────
  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const emp = await getEmployeeById(id);
        const currentExp =
          emp.experienceDetails?.find(exp => exp.lastWorkingDate === "Present") || {};

        setEmployee(emp);
        setFormData({
          employeeId:            emp.employeeId            || "",
          name:                  emp.name                  || "",
          email:                 emp.email                 || "",
          phone:                 emp.phone                 || "",
          address:               emp.address               || "",
          emergency:             emp.emergency             || "",
          personalDetails:       emp.personalDetails       || {},
          bankDetails:           emp.bankDetails           || {},
          experienceDetails:     emp.experienceDetails     || [],
          currentDepartment:     emp.currentDepartment     || currentExp.department     || "",
          currentRole:           emp.currentRole           || currentExp.role           || "",
          currentSalary:         emp.currentSalary         || currentExp.salary         || "",
          currentEmploymentType: currentExp.employmentType || "Full-Time",
          joiningDate:           emp.joiningDate           || currentExp.joiningDate    || "",
          experienceLetterUrl:   currentExp.experienceLetterUrl || "",
        });
      } catch (err) {
        console.error("Failed to fetch employee:", err);
        setError("Could not load employee data.");
      }
    };

    fetchEmployee();
  }, [id]);

  // ── Auto-hide snackbar ───────────────────────────────────────────────────
  useEffect(() => {
    if (snackbar) {
      const t = setTimeout(() => setSnackbar(""), 3000);
      return () => clearTimeout(t);
    }
  }, [snackbar]);

  // ── Existing: profile field change handler ───────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("bankDetails.")) {
      const key = name.split(".")[1];
      setFormData(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, [key]: value } }));
    } else if (name.startsWith("personalDetails.")) {
      const key = name.split(".")[1];
      setFormData(prev => ({ ...prev, personalDetails: { ...prev.personalDetails, [key]: value } }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // ── Existing: save profile ───────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...employee,
      ...formData,
      employeeId:        formData.employeeId,
      currentDepartment: formData.currentDepartment,
      currentRole:       formData.currentRole,
      currentSalary:     formData.currentSalary,
      joiningDate:       formData.joiningDate,
      experienceDetails: formData.experienceDetails.map(exp => {
        if (exp.lastWorkingDate === "Present") {
          return {
            ...exp,
            department:          formData.currentDepartment,
            role:                formData.currentRole,
            salary:              formData.currentSalary,
            joiningDate:         formData.joiningDate,
            employmentType:      formData.currentEmploymentType,
            experienceLetterUrl: formData.experienceLetterUrl,
          };
        }
        return exp;
      }),
    };

    try {
      await updateEmployeeById(id, payload);
      setSnackbar("✅ Employee updated successfully");
      setTimeout(() => navigate(-1), 1500);
    } catch (err) {
      console.error("Update failed:", err);
      setSnackbar("❌ Update failed");
    }
  };

  // ── NEW: change password handler ─────────────────────────────────────────
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (!newPassword || newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordLoading(true);
    try {
      await changeEmployeePassword(id, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setSnackbar("✅ Password changed successfully");
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to change password.";
      setPasswordError(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── Guards ───────────────────────────────────────────────────────────────
  if (error)
    return <div className="p-6 text-lg text-center text-red-500 font-bold mt-10">{error}</div>;
  if (!formData)
    return <div className="p-6 text-lg text-center mt-10 text-gray-500">Loading Employee Data...</div>;

  // ── Password strength helper ─────────────────────────────────────────────
  const pwStrength =
    newPassword.length === 0 ? null :
    newPassword.length < 6  ? "weak" :
    newPassword.length < 10 ? "fair" : "strong";

  const strengthColor = { weak: "bg-red-400", fair: "bg-yellow-400", strong: "bg-green-500" };
  const strengthLabel = { weak: "Too short", fair: "Fair", strong: "Strong" };
  const strengthText  = { weak: "text-red-500", fair: "text-yellow-600", strong: "text-green-600" };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-4xl border border-gray-100">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8 border-b pb-4">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-blue-600 font-semibold transition-colors flex items-center gap-1"
          >
            ← Back
          </button>
          <h2 className="text-3xl font-extrabold text-gray-800">Edit Employee</h2>
          <div className="w-16"></div>
        </div>

        {/* ════════════════════════════════════════════════
            SECTION 1 — PROFILE FORM  (all existing fields)
        ════════════════════════════════════════════════ */}
        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField
              icon={<FaIdBadge className="text-blue-500" />}
              name="employeeId"
              label="Employee ID"
              value={formData.employeeId}
              onChange={handleChange}
              readOnly
              className="bg-gray-100 cursor-not-allowed text-gray-500 font-mono"
            />
            <InputField
              icon={<FaUser className="text-blue-500" />}
              name="name"
              label="Full Name"
              value={formData.name}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField
              icon={<FaEnvelope className="text-blue-500" />}
              name="email"
              type="email"
              label="Email Address"
              value={formData.email}
              onChange={handleChange}
            />
            <InputField
              icon={<FaPhone className="text-blue-500" />}
              name="phone"
              label="Phone Number"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <hr className="border-dashed border-gray-200" />

          <h3 className="text-lg font-bold text-gray-700 mb-2">Professional Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField
              icon={<FaBriefcase className="text-purple-500" />}
              name="currentRole"
              label="Job Role"
              value={formData.currentRole}
              onChange={handleChange}
              placeholder="e.g. Senior Developer"
            />
            <InputField
              icon={<FaBuilding className="text-purple-500" />}
              name="currentDepartment"
              label="Department"
              value={formData.currentDepartment}
              onChange={handleChange}
              placeholder="e.g. Engineering"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField
              icon={<FaMoneyBill className="text-green-500" />}
              name="currentSalary"
              type="number"
              label="Salary"
              value={formData.currentSalary}
              onChange={handleChange}
            />

            {/* Employment Type Dropdown */}
            <div className="relative group">
              <div className="absolute left-3 top-[2.4rem] -translate-y-1/2 transition-colors group-focus-within:text-blue-600">
                <FaFileContract className="text-green-500" />
              </div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 ml-1">
                Employment Type
              </label>
              <select
                name="currentEmploymentType"
                value={formData.currentEmploymentType}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none transition-all shadow-sm text-gray-700 bg-white"
              >
                <option value="Full-Time">Full-Time</option>
                <option value="Contract">Contract</option>
                <option value="Intern">Intern</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField
              icon={<FaCalendarAlt className="text-orange-500" />}
              name="joiningDate"
              type="date"
              label="Joining Date"
              value={formData.joiningDate?.substring(0, 10)}
              onChange={handleChange}
            />
          </div>

          <hr className="border-dashed border-gray-200" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField
              icon={<FaCreditCard className="text-gray-500" />}
              name="bankDetails.accountNumber"
              label="Bank Account Number"
              value={formData.bankDetails.accountNumber || ""}
              onChange={handleChange}
            />
            <InputField
              icon={<FaMapMarkerAlt className="text-gray-500" />}
              name="address"
              label="Current Address"
              value={formData.address}
              onChange={handleChange}
            />
          </div>

          <div className="mt-8">
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg transform hover:-translate-y-0.5"
            >
              Save Changes
            </button>
          </div>
        </form>

        {/* ════════════════════════════════════════════════
            SECTION 2 — CHANGE PASSWORD  (new section)
            Completely separate <form> so it never
            accidentally fires the profile save.
        ════════════════════════════════════════════════ */}
        <div className="mt-10">
          {/* Section header */}
          <div className="flex items-center gap-3 mb-5 border-t pt-8">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-red-100 shrink-0">
              <FaShieldAlt className="text-red-500 text-base" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Change Employee Password</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Set a new login password for this employee. They will use it on their next login.
              </p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* New Password field */}
              <div className="relative group">
                <div className="absolute left-3 top-[2.4rem] -translate-y-1/2 text-red-400 group-focus-within:text-red-600 transition-colors">
                  <FaLock />
                </div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 ml-1">
                  New Password
                </label>
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setPasswordError(""); }}
                  placeholder="Min. 6 characters"
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2.5 focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none transition-all shadow-sm text-gray-700 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(p => !p)}
                  className="absolute right-3 top-[2.4rem] -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              {/* Confirm Password field */}
              <div className="relative group">
                <div className="absolute left-3 top-[2.4rem] -translate-y-1/2 text-red-400 group-focus-within:text-red-600 transition-colors">
                  <FaLock />
                </div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 ml-1">
                  Confirm New Password
                </label>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setPasswordError(""); }}
                  placeholder="Re-enter new password"
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2.5 focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none transition-all shadow-sm text-gray-700 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(p => !p)}
                  className="absolute right-3 top-[2.4rem] -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {/* Password strength bar */}
            {pwStrength && (
              <div className="flex items-center gap-2 ml-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={`h-1.5 w-10 rounded-full transition-all ${
                        (pwStrength === "weak"   && i <= 1) ||
                        (pwStrength === "fair"   && i <= 2) ||
                        (pwStrength === "strong" && i <= 4)
                          ? strengthColor[pwStrength]
                          : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <span className={`text-xs font-semibold ${strengthText[pwStrength]}`}>
                  {strengthLabel[pwStrength]}
                </span>
              </div>
            )}

            {/* Match indicator */}
            {confirmPassword.length > 0 && (
              <p className={`text-xs font-semibold ml-1 ${
                newPassword === confirmPassword ? "text-green-600" : "text-red-500"
              }`}>
                {newPassword === confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
              </p>
            )}

            {/* Error message */}
            {passwordError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-lg">
                <span>⚠</span> {passwordError}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={passwordLoading || !newPassword || !confirmPassword}
              className="w-full md:w-auto px-8 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-bold text-sm hover:from-red-600 hover:to-red-700 transition-all shadow-md transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
            >
              {passwordLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Updating...
                </>
              ) : (
                <>
                  <FaShieldAlt className="text-sm" />
                  Update Password
                </>
              )}
            </button>
          </form>
        </div>

        {/* Global snackbar toast */}
        {snackbar && (
          <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full text-white shadow-2xl font-semibold flex items-center gap-2 animate-bounce ${
            snackbar.includes("✅") ? "bg-green-600" : "bg-red-600"
          }`}>
            <span>{snackbar}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Reusable input component (unchanged) ────────────────────────────────────
const InputField = ({ icon, label, className = "bg-white", ...props }) => (
  <div className="relative group">
    <div className="absolute left-3 top-[2.4rem] -translate-y-1/2 transition-colors group-focus-within:text-blue-600">
      {icon}
    </div>
    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 ml-1">
      {label}
    </label>
    <input
      {...props}
      className={`w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none transition-all shadow-sm text-gray-700 ${className}`}
    />
  </div>
);

export default EditEmployee;