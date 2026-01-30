import { useState, useContext, useEffect, useMemo } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import API from "../api";
import {
  FaEye,
  FaEyeSlash,
  FaTimes,
} from "react-icons/fa";

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
  // We handle ALL navigation here. When 'user' state changes in AuthContext, 
  // this effect triggers and sends them to the right dashboard.
  useEffect(() => {
    if (!user) return;

    const userRole = user.role?.toLowerCase(); // Use lowercase to prevent "Employee" vs "employee" bugs
    console.log("Logged in user role:", userRole);

    if (userRole === "admin" || userRole === "manager") {
      navigate("/admin/dashboard", { replace: true });
    } else if (userRole === "employee") {
      navigate("/employee/dashboard", { replace: true });
    } else {
      console.error("Unknown user role:", userRole);
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

      // Defensive check: handle different response structures
      const userData = res?.data?.user || res?.user;
      const token = res?.data?.token || res?.token;

      if (token) sessionStorage.setItem("hrms-token", token);
      if (userData) sessionStorage.setItem("hrmsUser", JSON.stringify(userData));

      // Note: We don't need 'navigate' here because the useEffect above 
      // will fire as soon as 'login' updates the 'user' state in Context.
    } catch (err) {
      console.error("Login failed error:", err);
      setError(err.response?.data?.message || "Login failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  /* ==================== ADMIN REGISTER ==================== */
  const handleAdminRegister = async (e) => {
    e.preventDefault();
    setSignupError("");

    if (!selectedPlan) {
      return setSignupError("Please select a plan");
    }

    setSignupLoading(true);

    try {
      if (selectedPlan.name === "Free") {
        await API.post("/api/admin/register", {
          ...signupForm,
          plan: "Free",
        });

        alert("Free admin created. Please login.");
        setShowSignup(false);
        return;
      }

      const res = await API.post("/api/stripe/create-checkout-session", {
        plan: selectedPlan,
        signupForm,
      });

      window.location.href = res.data.url;
    } catch (err) {
      setSignupError(err.response?.data?.message || "Registration failed");
    } finally {
      setSignupLoading(false);
    }
  };

  const animatedBackground = useMemo(() => <></>, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {animatedBackground}

      {/* ==================== LOGIN CARD ==================== */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl px-10 py-8">
        <h2 className="text-3xl font-bold text-center mb-6">Welcome Back</h2>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <input
            type="email"
            placeholder="Email"
            className="w-full border px-4 py-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="flex items-center border rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-purple-500">
            <input
              type={showPassword ? "text" : "password"}
              className="w-full outline-none"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <span 
              className="cursor-pointer text-gray-500" 
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold transition-colors disabled:bg-purple-300"
          >
            {loading ? "Authenticating..." : "Login"}
          </button>
        </form>

        <button
          onClick={() => setShowSignup(true)}
          className="w-full mt-4 border border-purple-600 text-purple-600 py-2 rounded-xl font-semibold hover:bg-purple-50 transition-colors"
        >
          Create Admin Account
        </button>
      </div>

      {/* ==================== SIGNUP MODAL ==================== */}
      {showSignup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowSignup(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-black"
            >
              <FaTimes />
            </button>

            <h3 className="text-2xl font-bold mb-4">Register Admin</h3>

            {signupError && (
              <div className="bg-red-100 text-red-700 p-2 rounded mb-3 text-sm">
                {signupError}
              </div>
            )}

            {/* ===== PLAN SELECTION ===== */}
            <h4 className="font-bold mb-2 text-sm">Choose Plan</h4>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {PLANS.map((plan) => (
                <button
                  key={plan.name}
                  type="button"
                  onClick={() => setSelectedPlan(plan)}
                  className={`border p-3 rounded-xl transition-all ${
                    selectedPlan?.name === plan.name
                      ? "border-purple-600 bg-purple-100 ring-1 ring-purple-600"
                      : "hover:border-purple-300"
                  }`}
                >
                  <div className="font-semibold">{plan.name}</div>
                  <div className="text-xs text-gray-600">
                    {plan.price === 0 ? "Free" : `₹${plan.price}`}
                  </div>
                </button>
              ))}
            </div>

            {/* ===== FORM ===== */}
            <form onSubmit={handleAdminRegister} className="space-y-3">
              <input
                placeholder="Name"
                className="w-full border px-4 py-2 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                onChange={(e) =>
                  setSignupForm({ ...signupForm, name: e.target.value })
                }
                required
              />
              <input
                type="email"
                placeholder="Email"
                className="w-full border px-4 py-2 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                onChange={(e) =>
                  setSignupForm({ ...signupForm, email: e.target.value })
                }
                required
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full border px-4 py-2 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                onChange={(e) =>
                  setSignupForm({ ...signupForm, password: e.target.value })
                }
                required
              />
              <input
                placeholder="Phone"
                className="w-full border px-4 py-2 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                onChange={(e) =>
                  setSignupForm({ ...signupForm, phone: e.target.value })
                }
              />
              <input
                placeholder="Department"
                className="w-full border px-4 py-2 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                onChange={(e) =>
                  setSignupForm({ ...signupForm, department: e.target.value })
                }
              />

              <button
                type="submit"
                disabled={signupLoading}
                className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold mt-4 hover:bg-purple-700 disabled:bg-purple-300 transition-colors"
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