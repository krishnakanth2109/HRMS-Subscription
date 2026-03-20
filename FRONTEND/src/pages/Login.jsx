import { useState, useContext, useEffect, useMemo } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import API from "../api";
import {
  FaEye,
  FaEyeSlash,
  FaTimes,
  FaFingerprint,
  FaShieldAlt,
  FaUserShield,
  FaChartBar,
  FaExclamationTriangle,
  FaCalendarTimes,
  FaCrown,
  FaCheckCircle,
} from "react-icons/fa";
import { MdEmail, MdLock } from "react-icons/md";

const Login = () => {
  const { user, login, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  /* ==================== LOGIN STATE ==================== */

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ==================== SIGNUP & DYNAMIC PLANS STATE ==================== */
  const [showSignup, setShowSignup] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [fetchedPlans, setFetchedPlans] = useState([]); // Dynamic Plans from DB

  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "admin",
    department: "",
  });

  /* ==================== LOGIN STOPPED STATE ==================== */
  const [loginStoppedData, setLoginStoppedData] = useState(null);

  /* ==================== EXPIRED PLAN STATE ==================== */
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [expiredAdminDetails, setExpiredAdminDetails] = useState(null);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  // Only paid plans shown in upgrade modal - no free trial
  const paidPlans = fetchedPlans.filter((p) => Number(p.price) > 0);

  /* ==================== FETCH DYNAMIC PLANS ==================== */
  useEffect(() => {
    const getPlans = async () => {
      try {
        const res = await API.get("/api/admin/all-plans");
        setFetchedPlans(res.data);
      } catch (err) {
        console.error("Error fetching plans:", err);
      }
    };
    getPlans();
  }, []);

  /* ==================== 
    ON MOUNT: If user came back from Stripe (cancelled or back button),
    clear stale session so they must re-login and hit the expiry check again.
  ==================== */
  useEffect(() => {
    const paymentPending = sessionStorage.getItem("hrms_payment_pending");
    if (paymentPending) {
      // They left for Stripe and came back — wipe session, force fresh login
      sessionStorage.removeItem("hrms_payment_pending");
      sessionStorage.removeItem("hrmsUser");
      sessionStorage.removeItem("hrms-token");
      sessionStorage.removeItem("token");
      // Call logout to clear user state in context too
      logout();
    }
  }, []);

  /* ==================== REDIRECT LOGGED USER ==================== */
  useEffect(() => {
    if (!user) return;
    const userRole = user.role?.toLowerCase();
    if (userRole === "admin" || userRole === "manager") {
      navigate("/admin/dashboard", { replace: true });
    } else if (userRole === "employee") {
      navigate("/employee/dashboard", { replace: true });
    } else {
      setError("Unauthorized role. Contact admin.");
    }
  }, [user, navigate]);

  /* ==================== LOGIN ==================== */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(email, password);
      const userData = res?.data?.user || res?.user;
      const token = res?.data?.token || res?.token;
      
      if (token) sessionStorage.setItem("hrms-token", token);
      if (userData) sessionStorage.setItem("hrmsUser", JSON.stringify(userData));
      
    } catch (err) {
      // ✅ 403 with loginStopped flag → show login stopped modal
      if (err.response?.status === 403 && err.response?.data?.loginStopped) {
        setLoginStoppedData(err.response.data);
        setLoading(false);
        return;
      }
      // ✅ 403 with expired flag → clear any stale session + show full-page expired modal
      if (err.response?.status === 403 && err.response?.data?.expired) {
        // Wipe any leftover session so stale data can never auto-login them
        sessionStorage.removeItem("hrmsUser");
        sessionStorage.removeItem("hrms-token");
        sessionStorage.removeItem("token");
        logout();
        setExpiredAdminDetails(err.response.data.adminDetails);
        setShowExpiredModal(true);
        setLoading(false);
        return;
      }
      setError(err.response?.data?.message || "Login failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  /* ==================== UPGRADE / RENEW PLAN (DIRECT PAYMENT, NO FREE) ==================== */
  const handleUpgradePlan = async () => {
    if (!selectedUpgradePlan) return;
    setUpgradeLoading(true);
    try {
      // ✅ Set flag BEFORE redirecting to Stripe.
      // If they cancel or go back, this flag tells the page to clear the session on next load.
      sessionStorage.setItem("hrms_payment_pending", "true");

      const res = await API.post("/api/stripe/create-checkout-session", {
        plan: selectedUpgradePlan,
        signupForm: {
          email: expiredAdminDetails?.email,
          name: expiredAdminDetails?.name,
        },
        isRenewal: true,
      });
      window.location.href = res.data.url;
    } catch (err) {
      // If the API call itself fails, remove the flag so they aren't stuck
      sessionStorage.removeItem("hrms_payment_pending");
      console.error("Upgrade failed:", err);
      setUpgradeLoading(false);
    }
  };

  /* ==================== ADMIN REGISTER (DYNAMIC PRICE CHECK) ==================== */
  const handleAdminRegister = async (e) => {
    e.preventDefault();
    setSignupError("");
    if (!selectedPlan) return setSignupError("Please select a plan");
    setSignupLoading(true);

    try {
      // --- If Price is 0, register as Free ---
      if (Number(selectedPlan.price) === 0) {
        await API.post("/api/admin/register", { 
          ...signupForm, 
          plan: selectedPlan.planName 
        });
        alert(`Success! ${selectedPlan.planName} account created. Please login.`);
        setShowSignup(false);
        return;
      }

      // --- If Price > 0, Redirect to Payment (Stripe/Razorpay) ---
      const res = await API.post("/api/stripe/create-checkout-session", { 
        plan: selectedPlan, 
        signupForm 
      });
      window.location.href = res.data.url;

    } catch (err) {
      setSignupError(err.response?.data?.message || "Registration failed");
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0a0618] via-[#1a0b2e] to-[#0c1a2e] relative overflow-hidden font-sans p-3 sm:p-4">
      
      {/* Animated Bubbles */}
      <div className="bubbles">
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
      </div>

      {/* Background Blur Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-purple-900/30 rounded-full blur-[100px] sm:blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-indigo-900/30 rounded-full blur-[100px] sm:blur-[120px] animate-pulse delay-1000"></div>

      <div className="container max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8 lg:gap-12 z-10">
        
        {/* LEFT SECTION - Hidden on small screens */}
        <div className="hidden lg:block flex-1 text-white space-y-6 lg:space-y-8 animate-fadeIn">
          <div className="space-y-3 lg:space-y-4">
            <h1 className="text-4xl lg:text-5xl xl:text-7xl font-bold tracking-tight">
              Elevate Your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-400">
                Work Experience
              </span>
            </h1>
            <p className="text-gray-400 text-base lg:text-lg max-w-md leading-relaxed">
              Arah Info Tech vwsync delivers seamless workforce management with AI-powered insights.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 max-w-2xl">
            {[

  { 
    icon: <FaChartBar />, 
    title: "Real-Time Workforce Analytics", 
    desc: "Live workforce insights" 
  },
  { 
    icon: <FaFingerprint />, 
    title: "Multi-Factor Authentication", 
    desc: "Advanced identity verification" 
  },
  { 
    icon: <FaShieldAlt />, 
    title: "Enterprise-Level Data Security", 
    desc: "End-to-end encryption" 
  },
  { 
    icon: <FaUserShield />, 
    title: "Role-Based Access Control", 
    desc: "Granular permission control" 
  },

            ].map((feature, i) => (
              <div 
                key={i} 
                className="flex items-center gap-3 lg:gap-4 bg-white/5 border border-white/10 p-4 lg:p-5 rounded-2xl lg:rounded-1xl hover:bg-white/10 transition-all duration-300 hover:scale-105 cursor-default"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="bg-gradient-to-br from-purple-500/20 to-indigo-500/20 p-2 lg:p-3 rounded-xl lg:rounded-2xl">
                  <span className="text-lg lg:text-xl text-purple-400">{feature.icon}</span>
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm lg:text-base">{feature.title}</h4>
                  <p className="text-xs lg:text-sm text-gray-400">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SECTION: Login Card - Full width on mobile */}
        <div className="w-full lg:max-w-md animate-slideUp">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl sm:rounded-3xl lg:rounded-[2.5rem] shadow-2xl p-6 sm:p-8 lg:p-10 relative overflow-hidden">
            <div className="absolute top-4 sm:top-6 lg:top-8 right-4 sm:right-6 lg:right-8 bg-gradient-to-br from-purple-500 to-indigo-600 text-white px-2 sm:px-3 py-1 sm:py-2 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-xs shadow-lg animate-pulse">
              AI
            </div>

            <div className="mb-6 sm:mb-8 lg:mb-10">
              <div className="flex items-center gap-2 mb-2">

                <span className="text-[8px] sm:text-[10px] font-bold tracking-[0.2em] text-purple-600 uppercase ml-3">
                  Secure Portal
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Welcome Back
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Sign in to continue</p>
            </div>

            {error && (
              <div className="p-3 sm:p-4 rounded-xl mb-4 sm:mb-6 text-xs font-bold border bg-red-50 text-red-600 border-red-100 animate-shake">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5 lg:space-y-6">
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">
                  Work Email
                </label>
                <div className="relative group">
                  <MdEmail className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg sm:text-xl group-hover:text-purple-500 transition-colors" />
                  <input
                    type="email"
                    placeholder="employee@arahinfotech.com"
                    className="w-full bg-white border border-gray-200 pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl outline-none transition-all text-gray-700 shadow-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 text-sm sm:text-base"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Password
                  </label>
                  {/* <button 
                    type="button" 
                    className="text-[10px] sm:text-[11px] font-bold text-purple-600 hover:text-purple-700 transition-colors"
                  >
                    Forgot? &rarr;
                  </button> */}
                </div>
                <div className="relative group">
                  <MdLock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg sm:text-xl group-hover:text-purple-500 transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full bg-white border border-gray-200 pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 rounded-xl sm:rounded-2xl outline-none transition-all text-gray-700 shadow-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 text-sm sm:text-base"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button" 
                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FaEyeSlash size={16} sm:size={18} /> : <FaEye size={16} sm:size={18} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Authenticating...
                  </span>
                ) : "Access Dashboard"}
              </button>
            </form>

            <div className="mt-6 sm:mt-8 flex flex-col items-center gap-3 sm:gap-4 text-center">
              <button 
                onClick={() => setShowSignup(true)} 
                className="text-xs font-bold text-gray-400 hover:text-purple-600 uppercase tracking-widest transition-colors"
              >
                Subscribe Our HRMS
              </button>
        <p className="text-[8px] sm:text-[10px] text-gray-400 pt-4 sm:pt-6 border-t border-gray-100 w-full">
  Need help? 
  <a
    href="https://mail.google.com/mail/?view=cm&fs=1&to=ops@arahinfotech.com&su=I%20need%20help%20in%20your%20vwsync%20platform&body=Hi%2C%20I%20need%20help%20in%20your%20vwsync%20platform.%20Please%20assist%20me."
    target="_blank"
    rel="noopener noreferrer"
    className="text-blue-500 hover:underline ml-1"
  >
    ops@arahinfotech.com
  </a>
</p>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== SIGNUP MODAL (DYNAMIC PLANS) ==================== */}
      {showSignup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl sm:rounded-3xl lg:rounded-[2rem] p-5 sm:p-6 lg:p-8 w-full max-w-md relative max-h-[90vh] overflow-y-auto shadow-2xl animate-scaleIn">
            <button 
              onClick={() => setShowSignup(false)} 
              className="absolute top-4 sm:top-6 right-4 sm:right-6 text-gray-400 hover:text-black transition-colors"
            >
              <FaTimes size={18} sm:size={20} />
            </button>

            <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-900 tracking-tight">Register Admin</h3>

            {signupError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-xs font-medium border border-red-100">
                {signupError}
              </div>
            )}

            <h4 className="font-bold mb-2 sm:mb-3 text-[9px] sm:text-[10px] uppercase tracking-widest text-gray-400 ml-1">
              Choose Subscription
            </h4>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
              {fetchedPlans.length > 0 ? (
                fetchedPlans.map((plan) => (
                  <button
                    key={plan._id}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={`border-2 p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all text-left transform hover:scale-[1.02] ${
                      selectedPlan?._id === plan._id
                        ? "border-purple-600 bg-purple-50 ring-2 ring-purple-100"
                        : "border-gray-100 hover:border-purple-200"
                    }`}
                  >
                    <div className="font-bold text-gray-900 capitalize text-sm sm:text-base">{plan.planName}</div>
                    <div className="text-[9px] sm:text-[10px] font-black text-purple-600 mt-1 uppercase">
                      {Number(plan.price) === 0 ? "Free Access" : `₹${plan.price}`}
                    </div>
                  </button>
                ))
              ) : (
                <div className="col-span-2 text-center text-xs text-gray-400 py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto mb-2"></div>
                  Loading plans...
                </div>
              )}
            </div>

            <form onSubmit={handleAdminRegister} className="space-y-3 sm:space-y-4">
              <input
                placeholder="Full Name"
                pattern="^[A-Za-z\s]+$"
                title="Only alphabets allowed"
                className="w-full bg-gray-50 border border-gray-200 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl outline-none transition-all focus:border-purple-400 text-sm"
                onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                required
              />
              <input
                type="email"
                placeholder="Email Address"
                pattern="^[a-zA-Z0-9._%+-]+@gmail\.com$"
                title="Enter valid Gmail address"
                className="w-full bg-gray-50 border border-gray-200 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl outline-none transition-all focus:border-purple-400 text-sm"
                onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                required
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create Password"
                  pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$"
                  title="Minimum 8 characters with uppercase, lowercase, number and symbol"
                  className="w-full bg-gray-50 border border-gray-200 px-3 sm:px-4 py-2.5 sm:py-3 pr-10 rounded-lg sm:rounded-xl outline-none transition-all focus:border-purple-400 text-sm"
                  onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600"
                >
                  {showPassword ? <FaEyeSlash size={16} sm:size={18} /> : <FaEye size={16} sm:size={18} />}
                </button>
              </div>
              
              <input
                placeholder="Phone"
                pattern="[0-9]{10}"
                title="Enter 10 digit phone number"
                className="w-full bg-gray-50 border border-gray-200 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl outline-none transition-all focus:border-purple-400 text-sm"
                onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
              />

              <button
                type="submit"
                disabled={signupLoading}
                className="w-full bg-purple-600 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold mt-4 sm:mt-6 hover:bg-purple-700 shadow-lg transition-all disabled:opacity-50 transform hover:scale-[1.02] text-sm"
              >
                {signupLoading ? "Processing..." : Number(selectedPlan?.price) === 0 ? "Create Free Account" : "Proceed to Payment"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== SUBSCRIPTION EXPIRED FULL-PAGE MODAL ==================== */}
      {showExpiredModal && expiredAdminDetails && (
        <div className="fixed inset-0 z-[200] bg-gradient-to-br from-[#0f0a1e] via-[#1a0b2e] to-[#0d1b3e] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Decorative blobs */}
          <div className="absolute top-0 left-0 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-red-900/10 rounded-full blur-[100px] sm:blur-[150px] pointer-events-none"></div>
          <div className="absolute bottom-0 right-0 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-purple-900/10 rounded-full blur-[100px] sm:blur-[150px] pointer-events-none"></div>

          <div className="relative w-full max-w-3xl animate-slideUp">

            {/* TOP ALERT BANNER */}
            <div className="bg-gradient-to-r from-red-600/90 to-rose-700/90 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-3 sm:mb-4 border border-red-500/30 shadow-2xl shadow-red-900/30">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="bg-white/10 p-2 sm:p-4 rounded-xl sm:rounded-2xl flex-shrink-0">
                  <FaCalendarTimes className="text-white text-xl sm:text-3xl" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
                    <span className="bg-white/20 text-white text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 sm:py-1 rounded-full">
                      Subscription Expired
                    </span>
                    {expiredAdminDetails.expiredDaysAgo > 0 && (
                      <span className="bg-red-900/50 text-red-200 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 sm:py-1 rounded-full border border-red-500/40">
                        {expiredAdminDetails.expiredDaysAgo} day{expiredAdminDetails.expiredDaysAgo > 1 ? "s" : ""} overdue
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white">Access Suspended</h2>
                  <p className="text-red-200 text-xs sm:text-sm mt-0.5">
                    Your <span className="font-black">{expiredAdminDetails.plan}</span> subscription has ended.
                  </p>
                </div>
              </div>
            </div>

            {/* MAIN GRID: Details + Plans */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">

              {/* LEFT: Subscription Details from DB */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <FaExclamationTriangle className="text-amber-400 text-xs sm:text-sm" />
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Account Details</span>
                </div>

                <div className="bg-white/5 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/10">
                  <p className="text-[8px] sm:text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-1">Account</p>
                  <p className="text-white font-bold text-base sm:text-lg leading-tight">{expiredAdminDetails.name}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{expiredAdminDetails.email}</p>
                </div>

                <div className="bg-white/5 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/10">
                  <p className="text-[8px] sm:text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-2">Previous Plan</p>
                  <span className="inline-block bg-amber-500/20 text-amber-300 text-[10px] sm:text-xs font-black uppercase tracking-widest px-2 sm:px-3 py-1 rounded-full border border-amber-500/30">
                    {expiredAdminDetails.plan}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="bg-emerald-900/20 rounded-xl sm:rounded-2xl p-2 sm:p-3 border border-emerald-500/20">
                    <p className="text-[8px] sm:text-[9px] uppercase tracking-widest text-emerald-400 font-bold mb-1">Activated</p>
                    <p className="text-white font-bold text-xs sm:text-sm">
                      {new Date(expiredAdminDetails.planActivatedAt).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="bg-red-900/20 rounded-xl sm:rounded-2xl p-2 sm:p-3 border border-red-500/20">
                    <p className="text-[8px] sm:text-[9px] uppercase tracking-widest text-red-400 font-bold mb-1">Expired On</p>
                    <p className="text-white font-bold text-xs sm:text-sm">
                      {new Date(expiredAdminDetails.planExpiresAt).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* RIGHT: Upgrade Plans — Paid only, no free */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <FaCrown className="text-amber-400 text-xs sm:text-sm" />
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Renew Subscription</span>
                </div>

                <div className="flex-1 space-y-2 sm:space-y-3 max-h-[300px] overflow-y-auto">
                  {paidPlans.length > 0 ? (
                    paidPlans.map((plan) => (
                      <button
                        key={plan._id}
                        type="button"
                        onClick={() => setSelectedUpgradePlan(plan)}
                        className={`w-full text-left p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all transform hover:scale-[1.02] ${
                          selectedUpgradePlan?._id === plan._id
                            ? "border-purple-500 bg-purple-900/30 ring-1 ring-purple-500/40"
                            : "border-white/10 bg-white/5 hover:border-purple-500/40 hover:bg-purple-900/10"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-bold capitalize text-sm sm:text-base">{plan.planName}</span>
                              {selectedUpgradePlan?._id === plan._id && (
                                <FaCheckCircle className="text-purple-400 text-xs flex-shrink-0" />
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <div className="text-purple-300 font-black text-base sm:text-xl">₹{plan.price}</div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-purple-500 mx-auto mb-2 sm:mb-3"></div>
                        <p className="text-gray-500 text-xs">Loading plans...</p>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleUpgradePlan}
                  disabled={!selectedUpgradePlan || upgradeLoading}
                  className={`w-full mt-4 sm:mt-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all shadow-xl ${
                    selectedUpgradePlan && !upgradeLoading
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-purple-900/40 transform hover:scale-[1.02]"
                      : "bg-white/10 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {upgradeLoading
                    ? "Redirecting..."
                    : selectedUpgradePlan
                    ? `Pay ₹${selectedUpgradePlan.price} — Renew`
                    : "Select a Plan"}
                </button>
              </div>
            </div>

            {/* BACK TO LOGIN */}
            <button
              onClick={() => {
                setShowExpiredModal(false);
                setExpiredAdminDetails(null);
                setSelectedUpgradePlan(null);
              }}
              className="w-full text-center text-gray-600 hover:text-gray-400 text-xs font-bold uppercase tracking-widest transition-colors py-2 sm:py-3"
            >
              ← Back to Login
            </button>
          </div>
        </div>
      )}

      {/* ==================== LOGIN STOPPED MODAL ==================== */}
      {loginStoppedData && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-[#1a0b2e] border border-red-500/30 rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-8 max-w-md w-full relative animate-scaleIn">
            <div className="flex flex-col items-center text-center gap-4 sm:gap-5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-900/30 border border-red-500/30 flex items-center justify-center animate-pulse">
                <svg className="w-8 h-8 sm:w-10 sm:h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <span className="bg-red-500/20 text-red-300 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border border-red-500/30">
                  Access Blocked
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-2 sm:mt-3">Login Stopped</h2>
              </div>
              <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                Your account login has been stopped by the admin.
              </p>
              <div className="w-full bg-red-900/20 border border-red-500/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-left space-y-1">
                <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-red-400 font-black">Action Required</p>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Contact{" "}
                  <a href="mailto:ops@arahinfotech.com" className="text-purple-400 font-bold hover:text-purple-300 transition-colors">
                    ops@arahinfotech.com
                  </a>
                </p>
              </div>
              <button
                onClick={() => setLoginStoppedData(null)}
                className="w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black text-xs sm:text-sm uppercase tracking-widest transition-all shadow-xl transform hover:scale-[1.02]"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom CSS for animations and bubbles */}
      <style jsx>{`
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
          100% { transform: translateY(0px) rotate(360deg); }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }

        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.5s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }

        .bubbles {
          position: absolute;
          width: 100%;
          height: 100%;
          z-index: 0;
          overflow: hidden;
          top: 0;
          left: 0;
        }

        .bubble {
          position: absolute;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 50%;
          backdrop-filter: blur(1px);
          animation: float 8s infinite;
          pointer-events: none;
        }

        .bubble:nth-child(1) {
          width: 40px;
          height: 40px;
          left: 10%;
          top: 20%;
          animation-duration: 8s;
          background: rgba(147, 51, 234, 0.1);
        }

        .bubble:nth-child(2) {
          width: 60px;
          height: 60px;
          left: 20%;
          top: 40%;
          animation-duration: 12s;
          animation-delay: 1s;
          background: rgba(79, 70, 229, 0.1);
        }

        .bubble:nth-child(3) {
          width: 30px;
          height: 30px;
          left: 30%;
          top: 60%;
          animation-duration: 10s;
          animation-delay: 2s;
          background: rgba(139, 92, 246, 0.1);
        }

        .bubble:nth-child(4) {
          width: 50px;
          height: 50px;
          left: 40%;
          top: 80%;
          animation-duration: 14s;
          animation-delay: 0.5s;
          background: rgba(168, 85, 247, 0.1);
        }

        .bubble:nth-child(5) {
          width: 70px;
          height: 70px;
          left: 50%;
          top: 30%;
          animation-duration: 11s;
          animation-delay: 1.5s;
          background: rgba(124, 58, 237, 0.1);
        }

        .bubble:nth-child(6) {
          width: 45px;
          height: 45px;
          left: 60%;
          top: 50%;
          animation-duration: 9s;
          animation-delay: 2.5s;
          background: rgba(99, 102, 241, 0.1);
        }

        .bubble:nth-child(7) {
          width: 55px;
          height: 55px;
          left: 70%;
          top: 70%;
          animation-duration: 13s;
          animation-delay: 0.2s;
          background: rgba(139, 92, 246, 0.1);
        }

        .bubble:nth-child(8) {
          width: 35px;
          height: 35px;
          left: 80%;
          top: 90%;
          animation-duration: 10s;
          animation-delay: 1.8s;
          background: rgba(167, 139, 250, 0.1);
        }

        .bubble:nth-child(9) {
          width: 65px;
          height: 65px;
          left: 90%;
          top: 10%;
          animation-duration: 15s;
          animation-delay: 0.7s;
          background: rgba(192, 132, 252, 0.1);
        }

        .bubble:nth-child(10) {
          width: 25px;
          height: 25px;
          left: 95%;
          top: 45%;
          animation-duration: 7s;
          animation-delay: 2.2s;
          background: rgba(216, 180, 254, 0.1);
        }

        @media (max-width: 640px) {
          .bubble:nth-child(4),
          .bubble:nth-child(5),
          .bubble:nth-child(6),
          .bubble:nth-child(7),
          .bubble:nth-child(8) {
            opacity: 0.3;
          }
        }
      `}</style>
    </div> 
  );
};

export default Login;