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
} from "react-icons/fa";
import { MdEmail, MdLock } from "react-icons/md";

/* ==================== PLANS ==================== */
const PLANS = [
  { name: "Free", price: 0 },
  { name: "Basic", price: 250 },
  { name: "Premium", price: 500 },
  { name: "Flex", price: 750 },
];

const Login = () => {
  const { user, login } = useContext(AuthContext);
  const navigate = useNavigate();

  /* ==================== LOGIN STATE ==================== */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ==================== SIGNUP STATE ==================== */
  const [showSignup, setShowSignup] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "admin",
    department: "",
  });

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
      setError(err.response?.data?.message || "Login failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  /* ==================== ADMIN REGISTER ==================== */
  const handleAdminRegister = async (e) => {
    e.preventDefault();
    setSignupError("");
    if (!selectedPlan) return setSignupError("Please select a plan");
    setSignupLoading(true);
    try {
      if (selectedPlan.name === "Free") {
        await API.post("/api/admin/register", { ...signupForm, plan: "Free" });
        alert("Free admin created. Please login.");
        setShowSignup(false);
        return;
      }
      const res = await API.post("/api/stripe/create-checkout-session", { plan: selectedPlan, signupForm });
      window.location.href = res.data.url;
    } catch (err) {
      setSignupError(err.response?.data?.message || "Registration failed");
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#1a0b2e] relative overflow-hidden font-sans p-4">
      {/* Decorative Background Circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] height-[500px] bg-purple-900/20 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] height-[600px] bg-indigo-900/20 rounded-full blur-[120px]"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-purple-500/5 to-transparent rounded-full border border-white/5"></div>

      <div className="container max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 z-10">
        
        {/* LEFT SECTION: Features */}
        <div className="flex-1 text-white space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight">
              Elevate Your <br />
              <span className="text-gray-300">Work Experience</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-md leading-relaxed">
              Arah Info Tech HRMS delivers seamless workforce management with AI-powered insights, real-time analytics, and secure role-based access control.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            {[
              { icon: <FaChartBar />, title: "Real-time Analytics", desc: "Live dashboard" },
              { icon: <FaFingerprint />, title: "Biometric Auth", desc: "Multi-factor" },
              { icon: <FaShieldAlt />, title: "Bank-grade Security", desc: "256-bit encryption" },
              { icon: <FaUserShield />, title: "Role Control", desc: "Granular access" },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/5 border border-white/10 p-5 rounded-3xl hover:bg-white/10 transition-all cursor-default group">
                <div className="bg-white/10 p-3 rounded-2xl group-hover:scale-110 transition-transform">
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
            {/* AI Badge */}
            <div className="absolute top-8 right-8 bg-gradient-to-br from-purple-500 to-indigo-600 text-white px-3 py-2 rounded-2xl font-bold text-sm shadow-lg">
              AI
            </div>

            <div className="mb-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                <span className="text-[10px] font-bold tracking-[0.2em] text-purple-600 uppercase">Secure Portal</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-6 text-xs font-medium border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">Work Email</label>
                <div className="relative group">
                  <MdEmail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl group-focus-within:text-purple-600 transition-colors" />
                  <input
                    type="email"
                    placeholder="employee@arahinfotech.com"
                    className="w-full bg-white border border-gray-100 px-12 py-4 rounded-2xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 outline-none transition-all text-gray-700 placeholder:text-gray-300 shadow-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Password</label>
                  <button type="button" className="text-[11px] font-bold text-purple-600 hover:text-purple-800 transition-colors">Forgot Password? &rarr;</button>
                </div>
                <div className="relative group">
                  <MdLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl group-focus-within:text-purple-600 transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    className="w-full bg-white border border-gray-100 px-12 py-4 rounded-2xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 outline-none transition-all text-gray-700 placeholder:text-gray-300 shadow-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600 transition-colors" 
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                  <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors">Remember this device</span>
                </label>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Session Encrypted</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-4 rounded-2xl font-bold shadow-xl shadow-purple-500/20 transform hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? "Authenticating..." : "Access Dashboard"}
              </button>
            </form>

            <div className="mt-8 flex flex-col items-center gap-4">
               <button
                onClick={() => setShowSignup(true)}
                className="text-xs font-bold text-gray-400 hover:text-purple-600 transition-colors uppercase tracking-widest"
              >
                Create Admin Account
              </button>
              
              <div className="flex items-center justify-between w-full pt-6 border-t border-gray-100">
                <p className="text-[10px] text-gray-400">Need help? <a href="mailto:support@arahinfotech.com" className="text-purple-600 font-bold underline">support@arahinfotech.com</a></p>
                <p className="text-[10px] text-gray-400 font-bold">• v2.1 • HRMS</p>
              </div>
            </div>
          </div>
          
          {/* Footer Info */}
          <div className="mt-8 text-center space-y-2 opacity-50">
            <p className="text-white text-[10px] tracking-wide">© 2026 Arah Info Tech. All rights reserved.</p>
            <p className="text-white text-[9px] uppercase tracking-widest">PCI DSS Compliant • GDPR Ready • ISO 27001 Certified</p>
          </div>
        </div>
      </div>

      {/* ==================== SIGNUP MODAL (Kept existing logic) ==================== */}
      {showSignup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <button
              onClick={() => setShowSignup(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-black transition-colors"
            >
              <FaTimes size={20} />
            </button>

            <h3 className="text-2xl font-bold mb-6 text-gray-900">Register Admin</h3>

            {signupError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-xs font-medium border border-red-100">
                {signupError}
              </div>
            )}

            <h4 className="font-bold mb-3 text-xs uppercase tracking-widest text-gray-500">Choose Plan</h4>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {PLANS.map((plan) => (
                <button
                  key={plan.name}
                  type="button"
                  onClick={() => setSelectedPlan(plan)}
                  className={`border-2 p-4 rounded-2xl transition-all text-left ${
                    selectedPlan?.name === plan.name
                      ? "border-purple-600 bg-purple-50"
                      : "border-gray-100 hover:border-purple-200"
                  }`}
                >
                  <div className="font-bold text-gray-900">{plan.name}</div>
                  <div className="text-xs font-medium text-purple-600">
                    {plan.price === 0 ? "Free Forever" : `₹${plan.price}/mo`}
                  </div>
                </button>
              ))}
            </div>

            <form onSubmit={handleAdminRegister} className="space-y-4">
              <input
                placeholder="Full Name"
                className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all"
                onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                required
              />
              <input
                type="email"
                placeholder="Email Address"
                className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all"
                onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Create Password"
                className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all"
                onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                  <input
                    placeholder="Phone"
                    className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all"
                    onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                  />
                  <input
                    placeholder="Department"
                    className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all"
                    onChange={(e) => setSignupForm({ ...signupForm, department: e.target.value })}
                  />
              </div>

              <button
                type="submit"
                disabled={signupLoading}
                className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold mt-6 hover:bg-purple-700 shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
              >
                {signupLoading
                  ? "Processing..."
                  : selectedPlan?.name === "Free"
                  ? "Create Free Account"
                  : "Proceed to Payment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div> 
  );
};

export default Login;