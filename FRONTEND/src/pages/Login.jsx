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

const Login = () => {
  const { user, login } = useContext(AuthContext);
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
      if (err.response?.status === 403) {
        setError("Your plan is expired. Please contact support team.");
        setLoading(false);
        return; 
      }
      setError(err.response?.data?.message || "Login failed. Please check credentials.");
    } finally {
      setLoading(false);
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
              <div className={`p-3 rounded-xl mb-6 text-xs font-bold border ${error.includes("expired") ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse" : "bg-red-50 text-red-600 border-red-100"}`}>
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
    </div> 
  );
};

export default Login;