import React, { useState, useEffect, useContext } from "react";
import { useLocation } from "react-router-dom";
import api from "../api"; // Updated path based on your code
import { AuthContext } from "../context/AuthContext";
import {
  FaUser, FaEnvelope, FaPhone, FaBuilding,
  FaCrown, FaCalendarAlt, FaCheckCircle, FaTimesCircle,
  FaClock, FaCreditCard, FaEdit, FaSave, FaTimes
} from "react-icons/fa";

/* ─────────────────────────────────────────────────────────────────
   Helper: dynamically load Razorpay checkout script
   Returns a promise that resolves to true when ready.
───────────────────────────────────────────────────────────────── */
const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const AdminProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);

  const featureLabels = {
    "/admin/dashboard": "Dashboard",
    "/employees": "Employee Management",
    "/attendance": "Employees Attendance",
    "/admin/settings": "Shift Management",
    "/admin/shifttype": "Location Settings",
    "/admin/leave-summary": "Leave Summary",
    "/admin/holiday-calendar": "Holiday Calendar",
    "/admin/payroll": "Payroll",
    "/admin/notices": "Announcements",
    "/admin/admin-Leavemanage": "Leave Requests",
    "/admin/late-requests": "Attendance Adjustment",
    "/admin/admin-overtime": "Overtime Requests",
    "/admin/live-tracking": "Employee Idle Tracking",
    "/admin/induction": "Induction",
  };

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    department: ""
  });

  // Plans State
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [upgradingPlanId, setUpgradingPlanId] = useState(null);

  const fetchProfile = async () => {
    try {
      const res = await api.get("/api/admin/profile");
      setProfile(res.data);
      // Initialize form data with fetched values
      setFormData({
        name: res.data.name || "",
        phone: res.data.phone || "",
        department: res.data.department || ""
      });
    } catch (err) {
      console.error("Error fetching profile", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await api.get("/api/admin/all-plans");
      // Filter out 'owner' plan if necessary, similar to SubsHome
      setPlans(response.data.filter(p => p.planName?.toLowerCase() !== "owner"));
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setPlansLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchPlans();

    // Reset loading state when window gets focus (backup safety for edge cases)
    const handleFocus = () => setUpgradingPlanId((prev) => prev !== null ? null : prev);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdateLoading(true);
    try {
      await api.put("/api/admin/profile/update", formData);
      await fetchProfile(); // Refresh data
      setIsEditing(false);
      alert("Profile updated successfully!");
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
    } finally {
      setUpdateLoading(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────────
     RAZORPAY UPGRADE FLOW
  ───────────────────────────────────────────────────────────────── */
  const handleUpgrade = async (plan) => {
    if (plan.planName === profile?.plan) {
      alert("You are already on this plan!");
      return;
    }

    if (Number(plan.price) === 0) {
      alert("Please contact support to switch to a free plan.");
      return;
    }

    setUpgradingPlanId(plan._id);

    try {
      const sdkReady = await loadRazorpayScript();
      if (!sdkReady) {
        alert("Failed to load payment gateway. Please check your connection.");
        setUpgradingPlanId(null);
        return;
      }

      // 1. Create Razorpay order on backend
      const res = await api.post("/api/razorpay/create-order", {
        plan: plan,
        signupForm: {
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          department: profile.department,
          role: profile.role
        },
        isUpgrade: true
      });
      
      const orderData = res.data; // { orderId, amount, currency, keyId }

      // 2. Open Razorpay checkout popup
      const options = {
        key: orderData.keyId,
        amount: orderData.amount, // in paise
        currency: orderData.currency,
        name: "HRMS vwsync",
        description: `Upgrade to ${plan.planName} Plan`,
        order_id: orderData.orderId,
        prefill: {
          name: profile.name,
          email: profile.email,
          contact: profile.phone,
        },
        theme: { color: "#9333ea" }, // Matches the purple-600 theme of this page

        // 3. On payment success — verify on backend
        handler: async (paymentResponse) => {
          try {
            await api.post("/api/razorpay/verify-payment", {
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
              plan: plan,
              isUpgrade: true
            });

            alert("Plan upgraded successfully!");
            await fetchProfile(); // Refresh data to show new plan & dates
          } catch (verifyErr) {
            alert(
              verifyErr.response?.data?.message ||
              "Payment received but verification failed. Please contact support."
            );
          } finally {
            setUpgradingPlanId(null);
          }
        },

        modal: {
          // User closed the popup without paying
          ondismiss: () => {
            setUpgradingPlanId(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", (response) => {
        console.error("Razorpay payment failed:", response.error);
        alert(response.error?.description || "Payment failed. Please try again.");
        setUpgradingPlanId(null);
      });

      rzp.open();

    } catch (err) {
      alert(err.response?.data?.message || "Upgrade failed. Please try again.");
      setUpgradingPlanId(null);
    }
  };

  const location = useLocation();

  useEffect(() => {
    if (!loading && !plansLoading && location.hash === "#plans") {
      setTimeout(() => {
        const element = document.getElementById("plans");
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  }, [loading, plansLoading, location.hash]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit", month: "long", year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9ff]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* HEADER SECTION */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-4xl font-bold shadow-lg shrink-0">
            {profile?.name?.charAt(0)}
          </div>
          <div className="text-center md:text-left flex-1">
            {isEditing ? (
              <input
                className="text-3xl font-bold text-gray-900 border-b-2 border-purple-200 outline-none focus:border-purple-600 bg-transparent w-full md:w-auto"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            ) : (
              <h1 className="text-3xl font-bold text-gray-900">{profile?.name}</h1>
            )}
            <p className="text-gray-500 font-medium uppercase tracking-widest text-[10px] mt-1">
              {profile?.role} • {profile?.department}
            </p>
          </div>

          <div className="flex gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-purple-700 transition-all shadow-lg shadow-purple-200"
              >
                <FaEdit size={14} /> Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={handleUpdate}
                  disabled={updateLoading}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  <FaSave size={14} /> {updateLoading ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-2 bg-gray-100 text-gray-600 px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all"
                >
                  <FaTimes size={14} /> Cancel
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* BASIC INFORMATION CARD */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
              <h3 className="text-gray-900 font-bold mb-6 flex items-center gap-2">
                <FaUser className="text-purple-500 text-sm" /> Basic Information
              </h3>

              <div className="space-y-6">
                <InfoItem icon={<FaEnvelope />} label="Email Address (Locked)" value={profile?.email} />

                {/* Editable Phone */}
                <div className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                    <FaPhone />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Phone Number</p>
                    {isEditing ? (
                      <input
                        className="w-full font-bold text-gray-900 border-b border-purple-200 focus:border-purple-600 outline-none py-1"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    ) : (
                      <p className="text-gray-900 font-bold">{profile?.phone || "Not Provided"}</p>
                    )}
                  </div>
                </div>

                {/* Editable Department */}
                <div className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                    <FaBuilding />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Department</p>
                    {isEditing ? (
                      <input
                        className="w-full font-bold text-gray-900 border-b border-purple-200 focus:border-purple-600 outline-none py-1"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      />
                    ) : (
                      <p className="text-gray-900 font-bold">{profile?.department}</p>
                    )}
                  </div>
                </div>

                <InfoItem icon={<FaClock />} label="Member Since" value={formatDate(profile?.createdAt)} />
              </div>
            </div>
          </div>

          {/* SUBSCRIPTION DETAILS (Non-Editable) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 relative overflow-hidden h-full">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <FaCrown size={120} />
              </div>

              <h3 className="text-gray-900 font-bold mb-8 flex items-center gap-2">
                <FaCreditCard className="text-purple-500 text-sm" /> Subscription Overview
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Current Plan</p>
                  <h4 className="text-2xl font-black text-purple-600 capitalize">{profile?.plan}</h4>
                  <div className="mt-4 flex items-center gap-2 text-sm font-bold">
                    {profile?.isPaid ? (
                      <><FaCheckCircle className="text-emerald-500" /> <span className="text-emerald-600 uppercase">Active</span></>
                    ) : (
                      <><FaTimesCircle className="text-amber-500" /> <span className="text-amber-600 uppercase">Trial / Unpaid</span></>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Account Status</p>
                  <h4 className={`text-2xl font-black ${profile?.loginEnabled ? "text-emerald-600" : "text-red-600"}`}>
                    {profile?.loginEnabled ? "Fully Accessible" : "Access Blocked"}
                  </h4>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-dashed border-gray-200">
                <div className="flex items-start gap-4">
                  <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600"><FaCalendarAlt /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Activated On</p>
                    <p className="text-gray-900 font-bold">{formatDate(profile?.planActivatedAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-red-50 p-3 rounded-2xl text-red-600"><FaCalendarAlt /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Expires On</p>
                    <p className="text-gray-900 font-bold">{formatDate(profile?.planExpiresAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PLANS SECTION */}
        <div id="plans" className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-gray-900 font-bold flex items-center gap-2">
              <FaCrown className="text-purple-500 text-sm" /> Available Plans & Upgrade
            </h3>
            {plansLoading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isCurrentPlan = plan.planName === profile?.plan;
              return (
                <div
                  key={plan._id}
                  className={`relative p-6 rounded-3xl border-2 transition-all flex flex-col ${isCurrentPlan
                    ? "border-purple-500 bg-purple-50/50"
                    : "border-gray-100 bg-gray-50 hover:border-purple-200"
                    }`}
                >
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
                      Current Plan
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 capitalize">{plan.planName}</h4>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                        {plan.durationDays} Days
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-purple-600">
                        {Number(plan.price) === 0 ? "Free" : `₹${plan.price}`}
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-2 mb-6 flex-grow">
                    <li className="flex items-center gap-2 text-xs text-gray-600">
                      <FaCheckCircle className="text-emerald-500 shrink-0" size={12} />
                      <span>{plan.maxUsers === null ? "Unlimited Users" : `${plan.maxUsers} Users`}</span>
                    </li>
                    {plan.features?.slice(0, 3).map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                        <FaCheckCircle className="text-emerald-500 shrink-0" size={12} />
                        <span className="truncate">{featureLabels[feature] || feature.split('/').pop().replace(/-/g, ' ')}</span>
                      </li>
                    ))}
                    {plan.features?.length > 3 && (
                      <li className="text-[10px] text-gray-400 italic ml-5">+{plan.features.length - 3} more features</li>
                    )}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(plan)}
                    disabled={isCurrentPlan || upgradingPlanId === plan._id || (upgradingPlanId !== null && upgradingPlanId !== plan._id) ||
                      Number(plan.price) === 0}
                    className={`w-full py-3 rounded-2xl font-bold text-sm transition-all ${isCurrentPlan
                      ? "bg-emerald-100 text-emerald-600 cursor-default"
                      : Number(plan.price) === 0
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-100"
                      }`}
                  >
                    {isCurrentPlan
                      ? "Active Now"
                      : upgradingPlanId === plan._id
                        ? "Processing..."
                        : Number(plan.price) === 0
                          ? "Default Plan"
                          : "Upgrade Plan"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ icon, label, value }) => (
  <div className="flex items-center gap-4 group">
    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
      <p className="text-gray-900 font-bold truncate">{value}</p>
    </div>
  </div>
);

export default AdminProfile;