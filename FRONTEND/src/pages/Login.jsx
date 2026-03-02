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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#1a0b2e] relative overflow-hidden font-sans p-4">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] height-[500px] bg-purple-900/20 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] height-[600px] bg-indigo-900/20 rounded-full blur-[120px]"></div>

      <div className="container max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 z-10">
        
        {/* LEFT SECTION */}
        <div className="flex-1 text-white space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight">
              Elevate Your <br />
              <span className="text-gray-300">Work Experience</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-md leading-relaxed">
              Arah Info Tech HRMS delivers seamless workforce management with AI-powered insights.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            {[
              { icon: <FaChartBar />, title: "Real-time Analytics", desc: "Live dashboard" },
              { icon: <FaFingerprint />, title: "Biometric Auth", desc: "Multi-factor" },
              { icon: <FaShieldAlt />, title: "Bank-grade Security", desc: "256-bit encryption" },
              { icon: <FaUserShield />, title: "Role Control", desc: "Granular access" },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/5 border border-white/10 p-5 rounded-3xl">
                <div className="bg-white/10 p-3 rounded-2xl">
                  <span className="text-xl text-purple-400">{feature.icon}</span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">{feature.title}</h4>
                  <p className="text-sm text-gray-400">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SECTION: Login Card */}
        <div className="w-full max-w-md">
          <div className="bg-[#f8f9ff] rounded-[2.5rem] shadow-2xl p-10 relative overflow-hidden">
            <div className="absolute top-8 right-8 bg-gradient-to-br from-purple-500 to-indigo-600 text-white px-3 py-2 rounded-2xl font-bold text-sm shadow-lg">AI</div>

            <div className="mb-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                <span className="text-[10px] font-bold tracking-[0.2em] text-purple-600 uppercase">Secure Portal</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
            </div>

            {error && (
              <div className="p-3 rounded-xl mb-6 text-xs font-bold border bg-red-50 text-red-600 border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">Work Email</label>
                <div className="relative group">
                  <MdEmail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
                  <input
                    type="email"
                    placeholder="employee@arahinfotech.com"
                    className="w-full bg-white border border-gray-100 px-12 py-4 rounded-2xl outline-none transition-all text-gray-700 shadow-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Password</label>
                  <button type="button" className="text-[11px] font-bold text-purple-600">Forgot Password? &rarr;</button>
                </div>
                <div className="relative group">
                  <MdLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    className="w-full bg-white border border-gray-100 px-12 py-4 rounded-2xl outline-none transition-all text-gray-700 shadow-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-2xl font-bold shadow-xl">
                {loading ? "Authenticating..." : "Access Dashboard"}
              </button>
            </form>

            <div className="mt-8 flex flex-col items-center gap-4 text-center">
               <button onClick={() => setShowSignup(true)} className="text-xs font-bold text-gray-400 hover:text-purple-600 uppercase tracking-widest transition-colors">
                Subscribe Our HRMS
              </button>
              <p className="text-[10px] text-gray-400 pt-6 border-t border-gray-100 w-full">Need help? support@arahinfotech.com</p>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== SIGNUP MODAL (DYNAMIC PLANS) ==================== */}
      {showSignup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <button onClick={() => setShowSignup(false)} className="absolute top-6 right-6 text-gray-400 hover:text-black">
              <FaTimes size={20} />
            </button>

            <h3 className="text-2xl font-bold mb-6 text-gray-900 tracking-tight">Register Admin</h3>

            {signupError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-xs font-medium border border-red-100 italic">
                {signupError}
              </div>
            )}

            <h4 className="font-bold mb-3 text-[10px] uppercase tracking-widest text-gray-400 ml-1">Choose Subscription</h4>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {fetchedPlans.length > 0 ? (
                fetchedPlans.map((plan) => (
                  <button
                    key={plan._id}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={`border-2 p-4 rounded-2xl transition-all text-left ${
                      selectedPlan?._id === plan._id
                        ? "border-purple-600 bg-purple-50 ring-2 ring-purple-100"
                        : "border-gray-100 hover:border-purple-200"
                    }`}
                  >
                    <div className="font-bold text-gray-900 capitalize">{plan.planName}</div>
                    <div className="text-[10px] font-black text-purple-600 mt-1 uppercase">
                      {Number(plan.price) === 0 ? "Free Access" : `₹${plan.price}`}
                    </div>
                  </button>
                ))
              ) : (
                <div className="col-span-2 text-center text-xs text-gray-400 py-4 italic">Loading plans...</div>
              )}
            </div>

            <form onSubmit={handleAdminRegister} className="space-y-4">
              <input placeholder="Full Name" className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl outline-none transition-all" onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })} required />
              <input type="email" placeholder="Email Address" className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl outline-none transition-all" onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })} required />
              <input type="password" placeholder="Create Password" className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl outline-none transition-all" onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })} required />
      
              <input placeholder="Phone" className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl outline-none transition-all" onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })} />

              <button
                type="submit"
                disabled={signupLoading}
                className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold mt-6 hover:bg-purple-700 shadow-lg transition-all disabled:opacity-50"
              >
                {signupLoading ? "Processing..." : Number(selectedPlan?.price) === 0 ? "Create Free Account" : "Proceed to Payment"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== SUBSCRIPTION EXPIRED FULL-PAGE MODAL ==================== */}
      {showExpiredModal && expiredAdminDetails && (
        <div className="fixed inset-0 z-[200] bg-gradient-to-br from-[#0f0a1e] via-[#1a0b2e] to-[#0d1b3e] flex items-center justify-center p-4 overflow-y-auto">
          {/* Decorative blobs */}
          <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-red-900/10 rounded-full blur-[150px] pointer-events-none"></div>
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[150px] pointer-events-none"></div>

          <div className="relative w-full max-w-3xl">

            {/* TOP ALERT BANNER */}
            <div className="bg-gradient-to-r from-red-600/90 to-rose-700/90 backdrop-blur-sm rounded-3xl p-6 mb-4 border border-red-500/30 shadow-2xl shadow-red-900/30">
              <div className="flex items-center gap-4">
                <div className="bg-white/10 p-4 rounded-2xl flex-shrink-0">
                  <FaCalendarTimes className="text-white text-3xl" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="bg-white/20 text-white text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full">
                      Subscription Expired
                    </span>
                    {expiredAdminDetails.expiredDaysAgo > 0 && (
                      <span className="bg-red-900/50 text-red-200 text-[9px] font-black uppercase tracking-[0.15em] px-2 py-1 rounded-full border border-red-500/40">
                        {expiredAdminDetails.expiredDaysAgo} day{expiredAdminDetails.expiredDaysAgo > 1 ? "s" : ""} overdue
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-extrabold text-white">Access Suspended</h2>
                  <p className="text-red-200 text-sm mt-0.5">
                    Your <span className="font-black">{expiredAdminDetails.plan}</span> subscription has ended. Renew now to restore full access.
                  </p>
                </div>
              </div>
            </div>

            {/* MAIN GRID: Details + Plans */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

              {/* LEFT: Subscription Details from DB */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <FaExclamationTriangle className="text-amber-400 text-sm" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Account Details</span>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-1">Account</p>
                  <p className="text-white font-bold text-lg leading-tight">{expiredAdminDetails.name}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{expiredAdminDetails.email}</p>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-2">Previous Plan</p>
                  <span className="inline-block bg-amber-500/20 text-amber-300 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border border-amber-500/30">
                    {expiredAdminDetails.plan}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-900/20 rounded-2xl p-3 border border-emerald-500/20">
                    <p className="text-[9px] uppercase tracking-widest text-emerald-400 font-bold mb-1">Activated</p>
                    <p className="text-white font-bold text-sm">
                      {new Date(expiredAdminDetails.planActivatedAt).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </p>
                    <p className="text-emerald-400/70 text-[10px] mt-0.5">
                      {new Date(expiredAdminDetails.planActivatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="bg-red-900/20 rounded-2xl p-3 border border-red-500/20">
                    <p className="text-[9px] uppercase tracking-widest text-red-400 font-bold mb-1">Expired On</p>
                    <p className="text-white font-bold text-sm">
                      {new Date(expiredAdminDetails.planExpiresAt).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </p>
                    <p className="text-red-400/70 text-[10px] mt-0.5">
                      {new Date(expiredAdminDetails.planExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                <div className="bg-blue-900/20 rounded-2xl p-4 border border-blue-500/20 text-center">
                  <p className="text-[9px] uppercase tracking-widest text-blue-400 font-bold mb-1">Need Help?</p>
                  <a href="mailto:ops@arahinfotech.com" className="text-blue-300 text-xs font-bold hover:text-blue-200 transition-colors">
                    ops@arahinfotech.net
                  </a>
                </div>
              </div>

              {/* RIGHT: Upgrade Plans — Paid only, no free */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <FaCrown className="text-amber-400 text-sm" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Renew Subscription</span>
                </div>

                <div className="flex-1 space-y-3">
                  {paidPlans.length > 0 ? (
                    paidPlans.map((plan) => (
                      <button
                        key={plan._id}
                        type="button"
                        onClick={() => setSelectedUpgradePlan(plan)}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                          selectedUpgradePlan?._id === plan._id
                            ? "border-purple-500 bg-purple-900/30 ring-1 ring-purple-500/40"
                            : "border-white/10 bg-white/5 hover:border-purple-500/40 hover:bg-purple-900/10"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-bold capitalize">{plan.planName}</span>
                              {selectedUpgradePlan?._id === plan._id && (
                                <FaCheckCircle className="text-purple-400 text-sm flex-shrink-0" />
                              )}
                            </div>
                            {plan.durationDays && (
                              <p className="text-gray-400 text-[10px] mt-0.5 uppercase tracking-wide">
                                {plan.durationDays} days access
                              </p>
                            )}
                            {plan.features && plan.features.length > 0 && (
                              <p className="text-gray-500 text-[10px] mt-1 truncate">
                                {plan.features.slice(0, 2).join(" · ")}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0 ml-3">
                            <div className="text-purple-300 font-black text-xl">₹{plan.price}</div>
                            <div className="text-gray-500 text-[9px] uppercase tracking-wider">one-time</div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-3"></div>
                        <p className="text-gray-500 text-xs">Loading plans...</p>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleUpgradePlan}
                  disabled={!selectedUpgradePlan || upgradeLoading}
                  className={`w-full mt-5 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl ${
                    selectedUpgradePlan && !upgradeLoading
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-purple-900/40"
                      : "bg-white/10 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {upgradeLoading
                    ? "Redirecting to Payment..."
                    : selectedUpgradePlan
                    ? `Pay ₹${selectedUpgradePlan.price} — Renew Now`
                    : "Select a Plan to Continue"}
                </button>

                <p className="text-gray-600 text-[9px] text-center mt-3 uppercase tracking-wider">
                  Secured by Stripe · No free trials
                </p>
              </div>
            </div>

            {/* BACK TO LOGIN */}
            <button
              onClick={() => {
                setShowExpiredModal(false);
                setExpiredAdminDetails(null);
                setSelectedUpgradePlan(null);
              }}
              className="w-full text-center text-gray-600 hover:text-gray-400 text-xs font-bold uppercase tracking-widest transition-colors py-3"
            >
              ← Back to Login
            </button>
          </div>
        </div>
      )}
      {/* ==================== LOGIN STOPPED MODAL ==================== */}
      {loginStoppedData && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1a0b2e] border border-red-500/30 rounded-3xl shadow-2xl p-8 max-w-md w-full relative">
            <div className="flex flex-col items-center text-center gap-5">
              <div className="w-20 h-20 rounded-full bg-red-900/30 border border-red-500/30 flex items-center justify-center">
                <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <span className="bg-red-500/20 text-red-300 text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-red-500/30">
                  Access Blocked
                </span>
                <h2 className="text-2xl font-extrabold text-white mt-3">Login Stopped</h2>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Your account login has been stopped by the admin. Please contact the support team to restore access.
              </p>
              <div className="w-full bg-red-900/20 border border-red-500/20 rounded-2xl p-4 text-left space-y-1">
                <p className="text-[9px] uppercase tracking-[0.2em] text-red-400 font-black">Action Required</p>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Reach out to your administrator or contact{" "}
                  <a href="mailto:support@arahinfotech.com" className="text-purple-400 font-bold hover:text-purple-300 transition-colors">
                    support@arahinfotech.com
                  </a>{" "}
                  to get your login access restored.
                </p>
              </div>
              <button
                onClick={() => setLoginStoppedData(null)}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black text-sm uppercase tracking-widest transition-all shadow-xl"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      )}

    </div> 
  );
};

export default Login;