// components/WelcomeKitPopup.jsx
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  FaTimes,
  FaLaptop,
  FaMouse,
  FaKeyboard,
  FaPen,
  FaBook,
  FaCoffee,
  FaCalendarAlt,
  FaFolder,
  FaKey,
  FaTint,
  FaPlus,
  FaGift,
  FaCheckCircle,
  FaBan,
  FaCheck,
  FaArrowRight,
  FaBriefcase,
  FaBuilding,
  FaIdBadge,
  FaEnvelope,
} from "react-icons/fa";
import api from "../../api";
import Swal from "sweetalert2";

const KIT_ITEMS = [
  { key: "laptop", label: "Laptop", icon: <FaLaptop />, color: "blue" },
  { key: "mouse", label: "Mouse", icon: <FaMouse />, color: "purple" },
  { key: "keyboard", label: "Keyboard", icon: <FaKeyboard />, color: "indigo" },
  { key: "pen", label: "Pen", icon: <FaPen />, color: "green" },
  { key: "book", label: "Book / Notebook", icon: <FaBook />, color: "yellow" },
  { key: "cupMug", label: "Cup / Mug (Coffee)", icon: <FaCoffee />, color: "orange" },
  { key: "yearlyCalendar", label: "Yearly Calendar", icon: <FaCalendarAlt />, color: "red" },
  { key: "documentFolder", label: "Document Folder", icon: <FaFolder />, color: "teal" },
  { key: "keychain", label: "Keychain", icon: <FaKey />, color: "amber" },
  { key: "waterBottle", label: "Water Bottle", icon: <FaTint />, color: "cyan" },
  { key: "other", label: "Other", icon: <FaPlus />, color: "gray" },
];

const COLOR_MAP = {
  blue: { bg: "bg-blue-50", border: "border-blue-300", icon: "text-blue-500", check: "bg-blue-500", ring: "ring-blue-300", label: "text-blue-700" },
  purple: { bg: "bg-purple-50", border: "border-purple-300", icon: "text-purple-500", check: "bg-purple-500", ring: "ring-purple-300", label: "text-purple-700" },
  indigo: { bg: "bg-indigo-50", border: "border-indigo-300", icon: "text-indigo-500", check: "bg-indigo-500", ring: "ring-indigo-300", label: "text-indigo-700" },
  green: { bg: "bg-green-50", border: "border-green-300", icon: "text-green-500", check: "bg-green-500", ring: "ring-green-300", label: "text-green-700" },
  yellow: { bg: "bg-yellow-50", border: "border-yellow-300", icon: "text-yellow-600", check: "bg-yellow-500", ring: "ring-yellow-300", label: "text-yellow-700" },
  orange: { bg: "bg-orange-50", border: "border-orange-300", icon: "text-orange-500", check: "bg-orange-500", ring: "ring-orange-300", label: "text-orange-700" },
  red: { bg: "bg-red-50", border: "border-red-300", icon: "text-red-500", check: "bg-red-500", ring: "ring-red-300", label: "text-red-700" },
  teal: { bg: "bg-teal-50", border: "border-teal-300", icon: "text-teal-500", check: "bg-teal-500", ring: "ring-teal-300", label: "text-teal-700" },
  amber: { bg: "bg-amber-50", border: "border-amber-300", icon: "text-amber-500", check: "bg-amber-500", ring: "ring-amber-300", label: "text-amber-700" },
  cyan: { bg: "bg-cyan-50", border: "border-cyan-300", icon: "text-cyan-500", check: "bg-cyan-500", ring: "ring-cyan-300", label: "text-cyan-700" },
  gray: { bg: "bg-gray-50", border: "border-gray-300", icon: "text-gray-500", check: "bg-gray-500", ring: "ring-gray-300", label: "text-gray-700" },
};

const WelcomeKitPopup = ({ employee, onClose, onSubmitSuccess }) => {
  const [step, setStep] = useState(1); // 1 = greeting, 2 = kit items
  const [checked, setChecked] = useState({});
  const [otherText, setOtherText] = useState("");
  const [notTaken, setNotTaken] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const toggleItem = (key) => {
    if (notTaken) return;
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNotTaken = () => {
    const newVal = !notTaken;
    setNotTaken(newVal);
    if (newVal) {
      setChecked({});
      setOtherText("");
    }
  };

  // ── Exact same extraction logic as EmployeeDashboard.jsx lines 503-505 ──
  const latestExp = employee?.experienceDetails?.[employee.experienceDetails.length - 1];
  const extractedRole = latestExp?.role || employee?.currentRole || employee?.role || "";
  const extractedDepartment = latestExp?.department || employee?.currentDepartment || employee?.department || "";
  const joiningDate = latestExp?.joiningDate || "";
  const employmentType = latestExp?.employmentType || "";

  const handleSubmit = async () => {
    const anyChecked = Object.values(checked).some(Boolean);
    if (!notTaken && !anyChecked) {
      Swal.fire({
        icon: "warning",
        title: "No selection made",
        text: 'Please tick the items you received, or select "I have not taken anything from above".',
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    if (checked.other && !otherText.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Describe the other item",
        text: "You selected 'Other'. Please describe what you received.",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    setSubmitting(true);
    try {
      const employeeId = employee._id || employee.id || employee.employeeId;

      if (!employeeId) {
        throw new Error("Employee ID not found. Please refresh and try again.");
      }

      const department = extractedDepartment;
      const role = extractedRole;

      console.log("Extracted department:", department);
      console.log("Extracted role:", role);
      console.log("Full employee object:", employee);

      const itemsReceivedData = {};
      KIT_ITEMS.forEach(({ key }) => {
        itemsReceivedData[key] = !!checked[key];
      });

      if (checked.other && otherText.trim()) {
        itemsReceivedData.otherDescription = otherText.trim();
      }

      const requestData = {
        employeeId: employeeId,
        employeeCode: employee.employeeId || employee.employeeCode || employee.code || "",
        employeeName: employee.name || employee.employeeName || "",
        department: department,
        role: role,
        email: employee.email || "",
        itemsReceived: itemsReceivedData,
        notTakenAnything: notTaken || false,
      };

      console.log("Submitting data:", requestData);

      const response = await api.post("/api/welcome-kit/submit", requestData);

      console.log("Response:", response.data);

      Swal.fire({
        icon: "success",
        title: "Welcome Kit Submitted!",
        text: "Your welcome kit details have been saved successfully.",
        confirmButtonColor: "#3b82f6",
        timer: 2500,
        showConfirmButton: false,
      });

      onSubmitSuccess && onSubmitSuccess();
      onClose();
    } catch (err) {
      console.error("Submission error:", err);
      console.error("Error response data:", err.response?.data);

      Swal.fire({
        icon: "error",
        title: "Submission Failed",
        text: err?.response?.data?.message || err.message || "Something went wrong. Please try again.",
        confirmButtonColor: "#ef4444",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const displayRole = extractedRole;
  const displayDepartment = extractedDepartment;

  const portalRoot = typeof document !== "undefined" ? document.body : null;

  // ─── Step 1: Welcome Greeting ───────────────────────────────────────────────
  const stepOneContent = (
    <div
      className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      style={{ maxHeight: "92vh" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Banner */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 px-6 pt-8 pb-16 text-white overflow-hidden">
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full" />
        <div className="absolute top-8 -right-10 w-20 h-20 bg-white/10 rounded-full" />
        <div className="absolute -bottom-8 -left-6 w-28 h-28 bg-white/10 rounded-full" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition z-10"
        >
          <FaTimes size={14} />
        </button>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-200">
              🎉 Welcome Aboard!
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black leading-tight">
            {getGreeting()}, {employee?.name || "Employee"}!<br />
            <span className="text-yellow-300">welcome to {employee?.companyName || employee?.company || "your company"}!</span>
          </h1>
          <p className="text-blue-100 text-sm mt-1.5">
            We're thrilled to have you with us. Let's get you set up!
          </p>

        </div>
      </div>



      {/* Body: Job Details */}
      <div className="overflow-y-auto flex-1 px-5 py-5">
        {/* Welcome message */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
          <span className="text-2xl">🎉</span>
    <div className="text-sm text-blue-700 font-semibold leading-relaxed space-y-3">
  
   <h2 className="text-md md:text-2xl font-bold text-blue-900">
    We are absolutely thrilled to welcome you to the team!
  </h2>

  <p>
    You are joining us as a valued and important member, and we truly believe 
    your skills, ideas, and enthusiasm will make a meaningful impact.
  </p>

  <p>
    From day one, you are part of a collaborative and supportive environment 
    where your contributions matter and your growth is encouraged.
  </p>

  <p>
    We’re excited to see the amazing things you’ll accomplish, the innovative 
    ideas you’ll bring, and the positive energy you’ll add to the team.
  </p>

  <p>
    We look forward to working together, achieving great milestones, and 
    celebrating many successes along the way.
  </p>

  <p className="font-bold text-blue-800">
    🚀 Once again, welcome aboard—we’re really glad to have you with us!
  </p>

</div>
        </div>

        {/* Job Details Grid */}
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Your Job Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">

          {displayRole && (
            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
              <FaBriefcase className="text-indigo-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Role</p>
                <p className="text-sm font-bold text-indigo-700">{displayRole}</p>
              </div>
            </div>
          )}

          {displayDepartment && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <FaBuilding className="text-blue-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Department</p>
                <p className="text-sm font-bold text-blue-700">{displayDepartment}</p>
              </div>
            </div>
          )}

          {employmentType && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
              <FaIdBadge className="text-green-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Employment Type</p>
                <p className="text-sm font-bold text-green-700">{employmentType}</p>
              </div>
            </div>
          )}

          {joiningDate && (
            <div className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
              <FaCalendarAlt className="text-orange-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Joining Date</p>
                <p className="text-sm font-bold text-orange-700">
                  {new Date(joiningDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
            </div>
          )}

          {employee?.email && (
            <div className="flex items-center gap-3 bg-cyan-50 border border-cyan-100 rounded-xl px-4 py-3 sm:col-span-2">
              <FaEnvelope className="text-cyan-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Work Email</p>
                <p className="text-sm font-bold text-cyan-700">{employee.email}</p>
              </div>
            </div>
          )}
        </div>

        {/* Motivational note */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl px-4 py-3">
          <p className="text-xs text-indigo-600 font-semibold leading-relaxed text-center">
            🚀 Your journey with us starts today. On the next step, please confirm the Welcome Kit items you've received.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50/80">
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-100 transition active:scale-95"
        >
          Cancel
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-2 bg-blue-500 rounded-full" />
          <div className="w-2 h-2 bg-gray-200 rounded-full" />
        </div>

        <button
          onClick={() => setStep(2)}
          className="flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg transition active:scale-95"
        >
          Next
          <FaArrowRight />
        </button>
      </div>
    </div>
  );

  // ─── Step 2: Welcome Kit Items ──────────────────────────────────────────────
  const stepTwoContent = (
    <div
      className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      style={{ maxHeight: "92vh" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Banner */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 px-6 pt-8 pb-16 text-white overflow-hidden">
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full" />
        <div className="absolute top-8 -right-10 w-20 h-20 bg-white/10 rounded-full" />
        <div className="absolute -bottom-8 -left-6 w-28 h-28 bg-white/10 rounded-full" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition z-10"
        >
          <FaTimes size={14} />
        </button>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-200">
              🎁 Welcome Kit
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black leading-tight">
            Hi {employee?.name || "Employee"},<br />
            <span className="text-yellow-300">confirm your Welcome Kit!</span>
          </h1>
          <p className="text-blue-100 text-sm mt-1.5">
            Tick the items you've received from the organization.
          </p>
       
        </div>
      </div>



      {/* Body: Kit Items */}
      <div className="overflow-y-auto flex-1 px-5 py-5">
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
          <FaGift className="text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700 font-semibold leading-relaxed">
            Please tick all the items you have received from the organization as part of your Welcome Kit. This helps us keep an accurate record.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          {KIT_ITEMS.map(({ key, label, icon, color }) => {
            const c = COLOR_MAP[color];
            const isChecked = !!checked[key];
            return (
              <div
                key={key}
                onClick={() => toggleItem(key)}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 cursor-pointer transition-all duration-200 select-none
                  ${notTaken ? "opacity-40 cursor-not-allowed" : "hover:shadow-md active:scale-95"}
                  ${isChecked
                    ? `${c.bg} ${c.border} ring-2 ${c.ring}`
                    : "bg-white border-gray-200 hover:border-gray-300"
                  }`}
              >
                {isChecked && (
                  <span className={`absolute top-2 right-2 w-5 h-5 ${c.check} rounded-full flex items-center justify-center shadow`}>
                    <FaCheck className="text-white text-[9px]" />
                  </span>
                )}
                <span className={`text-2xl ${isChecked ? c.icon : "text-gray-400"} transition-colors`}>
                  {icon}
                </span>
                <span className={`text-[11px] font-bold text-center leading-tight ${isChecked ? c.label : "text-gray-600"} transition-colors`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {checked.other && !notTaken && (
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Describe the "Other" item
            </label>
            <input
              type="text"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="e.g. USB Hub, Headphones, etc."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
            />
          </div>
        )}

        <div className="border-t border-dashed border-gray-200 my-4" />

        <div
          onClick={handleNotTaken}
          className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 cursor-pointer transition-all duration-200 select-none
            ${notTaken
              ? "bg-red-50 border-red-400 ring-2 ring-red-200"
              : "bg-white border-gray-200 hover:border-red-300 hover:bg-red-50/50"
            }`}
        >
          <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0
            ${notTaken ? "bg-red-500 border-red-500" : "border-gray-300"}`}>
            {notTaken && <FaCheck className="text-white text-[9px]" />}
          </div>
          <div className="flex items-center gap-2 flex-1">
            <FaBan className={`${notTaken ? "text-red-500" : "text-gray-400"} text-sm shrink-0`} />
            <p className={`text-sm font-bold ${notTaken ? "text-red-600" : "text-gray-600"}`}>
              I have not taken anything from the above list
            </p>
          </div>
          {notTaken && (
            <span className="text-xs font-bold text-red-400 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">
              Selected
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50/80">
        <button
          onClick={() => setStep(1)}
          className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-100 transition active:scale-95"
        >
          Back
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-gray-200 rounded-full" />
          <div className="w-6 h-2 bg-blue-500 rounded-full" />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition active:scale-95"
        >
          {submitting ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Submitting...
            </>
          ) : (
            <>
              <FaCheckCircle />
              Submit Welcome Kit
            </>
          )}
        </button>
      </div>
    </div>
  );

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6">
      {step === 1 ? stepOneContent : stepTwoContent}
    </div>
  );

  return portalRoot ? createPortal(modalContent, portalRoot) : null;
};

export default WelcomeKitPopup;