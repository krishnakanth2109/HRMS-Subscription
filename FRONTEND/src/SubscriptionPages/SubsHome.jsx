import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import api from "../api";
import API from "../api";
import { FaTimes, FaCheckCircle, FaCrown } from "react-icons/fa";

const DynamicHRMSLandingPage = () => {
    const navigate = useNavigate();
    const [scrollProgress, setScrollProgress] = useState(0);

    // --- STATE FOR DYNAMIC PLANS ---
    const [plans, setPlans] = useState([]);
    const [plansLoading, setPlansLoading] = useState(true);

    // --- REGISTER MODAL STATE ---
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [signupLoading, setSignupLoading] = useState(false);
    const [signupError, setSignupError] = useState("");
    const [signupSuccess, setSignupSuccess] = useState("");
    const [signupForm, setSignupForm] = useState({
        name: "",
        email: "",
        password: "",
        phone: "",
        role: "admin",
        department: "",
    });

    useEffect(() => {
        const handleScroll = () => {
            const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
            setScrollProgress((window.scrollY / totalScroll) * 100);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // --- FETCH PLANS FROM DB ---
    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const response = await api.get("/api/admin/all-plans");
                setPlans(response.data);
            } catch (error) {
                console.error("Error fetching plans:", error);
            } finally {
                setPlansLoading(false);
            }
        };
        fetchPlans();
    }, []);

    // --- OPEN MODAL & PRE-SELECT THE CLICKED PLAN ---
    const handlePlanClick = (plan) => {
        setSelectedPlan(plan);
        setSignupError("");
        setSignupSuccess("");
        setSignupForm({ name: "", email: "", password: "", phone: "", role: "admin", department: "" });
        setShowRegisterModal(true);
    };

    const handleCloseModal = () => {
        setShowRegisterModal(false);
        setSelectedPlan(null);
        setSignupError("");
        setSignupSuccess("");
    };

    // --- REGISTER HANDLER (same logic as Login.jsx) ---
    const handleAdminRegister = async (e) => {
        e.preventDefault();
        setSignupError("");
        setSignupSuccess("");
        if (!selectedPlan) return setSignupError("Please select a plan");
        setSignupLoading(true);

        try {
            if (Number(selectedPlan.price) === 0) {
                await API.post("/api/admin/register", {
                    ...signupForm,
                    plan: selectedPlan.planName,
                });
                setSignupSuccess(`🎉 ${selectedPlan.planName} account created! Please login.`);
                setSignupForm({ name: "", email: "", password: "", phone: "", role: "admin", department: "" });
                return;
            }

            // Paid plan → Stripe redirect
            sessionStorage.setItem("hrms_payment_pending", "true");
            const res = await API.post("/api/stripe/create-checkout-session", {
                plan: selectedPlan,
                signupForm,
            });
            window.location.href = res.data.url;

        } catch (err) {
            sessionStorage.removeItem("hrms_payment_pending");
            setSignupError(err.response?.data?.message || "Registration failed. Please try again.");
        } finally {
            setSignupLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#030712] text-white selection:bg-blue-500/30 font-sans">
            <style>{`
                html { scroll-behavior: smooth; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-content { animation: fadeIn 0.8s ease-out forwards; }
                @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                .modal-animate { animation: modalIn 0.3s ease-out forwards; }
            `}</style>

            {/* Progress Bar */}
            <div className="fixed top-0 left-0 w-full h-1 z-50">
                <div className="h-full bg-blue-500 transition-all duration-200" style={{ width: `${scrollProgress}%` }}></div>
            </div>

            {/* Navigation */}
            <nav className="fixed w-full z-40 py-4 px-8 backdrop-blur-md bg-gray-950/80 border-b border-white/5">
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/20">H</div>
                        <span className="text-xl font-bold tracking-tight">HR<span className="text-blue-400">360*</span></span>
                    </div>
                    <div className="hidden md:flex space-x-8 text-sm font-medium text-gray-400">
                        {['Features', 'Pricing', 'Benefits', 'Support'].map((item) => (
                            <a key={item} href={`#${item.toLowerCase()}`} className="hover:text-white transition-colors">{item}</a>
                        ))}
                    </div>
                    <button onClick={() => navigate("/login")} className="px-6 py-2 rounded-full bg-blue-600 text-sm font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20">
                        Get Started
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-40 pb-20 px-8">
                <div className="container mx-auto grid lg:grid-cols-2 gap-16 items-center">
                    <div className="animate-content">
                        <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold tracking-widest uppercase">
                            New: AI Payroll Automation 2.0
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-extrabold leading-[1.1] mb-8">
                           Transforming HR<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500">Into seamless Digital experience</span>
                        </h1>
                        <p className="text-xl text-gray-400 mb-10 max-w-lg leading-relaxed">
                            This HR360* platform to manage your global workforce, automate payroll, and track performance without the spreadsheet chaos.
                        </p>
                        <div className="flex flex-wrap gap-5">
                            <button onClick={() => navigate("/login")} className="px-8 py-4 rounded-xl bg-white text-black font-bold hover:bg-blue-400 hover:text-white transition-all transform hover:-translate-y-1">
                                Sign In
                            </button>
                            <a href="#pricing">
                                <button className="px-8 py-4 rounded-xl bg-white text-black font-bold hover:bg-blue-400 hover:text-white transition-all transform hover:-translate-y-1">
                                    View Pricing
                                </button>
                            </a>

                        </div>
                    </div>

                    <div className="relative animate-content" style={{ animationDelay: '0.2s' }}>
                        <div className="absolute -inset-4 bg-blue-500/10 rounded-[2.5rem] blur-3xl"></div>
                        <div className="relative bg-[#0d1117] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4 bg-white/5 border-b border-white/5">
                                <div className="flex space-x-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500/40"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/40"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500/40"></div>
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Admin Dashboard</div>
                                <div className="w-6 h-6 rounded-full bg-blue-500/20"></div>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-center">
                                        <p className="text-xs text-gray-500 mb-1">Staff</p>
                                        <p className="text-xl font-bold">1,284</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-center">
                                        <p className="text-xs text-gray-500 mb-1">Live</p>
                                        <p className="text-xl font-bold text-green-400">98%</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-center">
                                        <p className="text-xs text-gray-500 mb-1">Tasks</p>
                                        <p className="text-xl font-bold text-yellow-500">12</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-blue-500/30 transition">
                                        <div className="text-blue-400 text-lg mb-2">👨‍💼</div>
                                        <h4 className="text-sm font-semibold text-white mb-1">Employee Management</h4>
                                        <p className="text-xs text-gray-400">Manage staff records, roles, and permissions easily.</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-blue-500/30 transition">
                                        <div className="text-green-400 text-lg mb-2">⏱️</div>
                                        <h4 className="text-sm font-semibold text-white mb-1">Attendance Tracking</h4>
                                        <p className="text-xs text-gray-400">Monitor daily attendance with real-time updates.</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-blue-500/30 transition">
                                        <div className="text-yellow-400 text-lg mb-2">📧</div>
                                        <h4 className="text-sm font-semibold text-white mb-1">Email Notifications</h4>
                                        <p className="text-xs text-gray-400">Automated alerts for punch-in, leave, and approvals.</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-blue-500/30 transition">
                                        <div className="text-purple-400 text-lg mb-2">📊</div>
                                        <h4 className="text-sm font-semibold text-white mb-1">Analytics Dashboard</h4>
                                        <p className="text-xs text-gray-400">Visual insights on performance and productivity.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 px-8 bg-[#080c14]">
                <div className="container mx-auto text-center">
                    <h2 className="text-4xl font-bold mb-16">Enterprise-Grade <span className="text-blue-400">Features</span></h2>
                    <div className="grid md:grid-cols-4 gap-8">
                        {[
                            { icon: '🗄️', title: 'Database Management', desc: 'Secure employee data storage with real-time sync and backup.', color: 'blue' },
                            { icon: '💰', title: 'Payroll Management', desc: 'Automated salary processing with tax compliance and reports.', color: 'green' },
                            { icon: '⏰', title: 'Attendance Management', desc: 'Biometric integration and real-time attendance tracking.', color: 'yellow' },
                            { icon: '📊', title: 'Performance Management', desc: 'Goal tracking, reviews, and performance analytics dashboard.', color: 'purple' }
                        ].map((feature, i) => (
                            <div key={i} className="bg-white/5 p-6 rounded-2xl border border-white/10 hover:border-blue-400/50 transition-all group">
                                <div className={`text-4xl mb-4 group-hover:scale-110 transition-transform text-${feature.color}-400`}>
                                    {feature.icon}
                                </div>
                                <h3 className="font-bold mb-2">{feature.title}</h3>
                                <p className="text-xs text-gray-400 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-24 px-8 bg-gradient-to-b from-[#030712] to-[#080c14]">
                <div className="container mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold mb-4">Simple, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Transparent Pricing</span></h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">Plans tailored for your growth. No hidden fees.</p>
                    </div>

                    {plansLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
                        </div>
                    ) : (
                        <div className={`grid gap-8 max-w-6xl mx-auto ${plans.length === 1 ? 'md:grid-cols-1 max-w-md' :
                                plans.length === 2 ? 'md:grid-cols-2 max-w-3xl' : 'md:grid-cols-3'
                            }`}>
                            {plans.map((plan, index) => {
                                return (
                                    <div
                                        key={plan._id || index}
                                        className="relative bg-white/5 p-8 rounded-3xl border border-white/10 hover:border-blue-500/30 transition-all flex flex-col group"
                                    >
                                        <h3 className="text-2xl font-bold mb-2 capitalize tracking-tight">{plan.planName}</h3>
                                        <p className="text-gray-500 text-xs mb-6 font-bold uppercase tracking-widest">
                                            Valid for {plan.durationDays} days
                                        </p>

                                        <div className="mb-8 flex items-baseline gap-1">
                                            <span className="text-5xl font-black tracking-tighter text-white">
                                                {Number(plan.price) === 0 ? "Free" : `₹${plan.price}`}
                                            </span>
                                            {Number(plan.price) > 0 && (
                                                <span className="text-gray-500 text-sm font-bold">/period</span>
                                            )}
                                        </div>

                                        <ul className="space-y-4 mb-10 flex-grow">
                                            {plan.features && plan.features.length > 0 ? (
                                                plan.features.map((feature, fIdx) => (
                                                    <li key={fIdx} className="flex items-start text-sm group">
                                                        <span className="text-blue-500 mr-3 font-bold text-lg leading-none">✓</span>
                                                        <span className="text-gray-300 group-hover:text-white transition-colors">{feature}</span>
                                                    </li>
                                                ))
                                            ) : (
                                                <>
                                                    <li className="flex items-center text-sm text-gray-400">
                                                        <span className="text-blue-900 mr-3">✓</span> Core Access
                                                    </li>
                                                    <li className="flex items-center text-sm text-gray-400">
                                                        <span className="text-blue-900 mr-3">✓</span> Secure Login
                                                    </li>
                                                </>
                                            )}
                                        </ul>

                                        {/* ✅ OPENS REGISTER MODAL with this plan pre-selected */}
                                        <button
                                            onClick={() => handlePlanClick(plan)}
                                            className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg border border-white/10 hover:bg-white/10 text-white"
                                        >
                                            {Number(plan.price) === 0 ? "Get Started Free" : "Subscribe Now →"}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* Footer */}
            <footer className="py-16 px-8 bg-[#030712] border-t border-white/5">
                <div className="container mx-auto text-center">
                    <div className="flex justify-center items-center space-x-2 mb-8">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">H</div>
                        <span className="text-lg font-bold tracking-tighter uppercase">HR<span className="text-blue-400">360*</span></span>
                    </div>
                    <p className="text-xs text-gray-600 font-bold tracking-[0.3em] uppercase mb-8">Secure • Reliable • Enterprise Grade</p>
                    <div className="text-[10px] text-gray-700 uppercase tracking-widest">
                        © 2026 HRMS Pro. All rights reserved.
                    </div>
                </div>
            </footer>

            {/* ==================== REGISTER ADMIN MODAL ==================== */}
            {showRegisterModal && (
                <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
                    {/* Decorative blobs */}
                    <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[150px] pointer-events-none"></div>
                    <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-cyan-900/10 rounded-full blur-[150px] pointer-events-none"></div>

                    <div className="modal-animate relative w-full max-w-2xl max-h-[95vh] overflow-y-auto">
                        <div className="bg-[#0d1117] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">

                            {/* Modal Header */}
                            <div className="relative bg-gradient-to-r from-blue-600/20 to-cyan-600/10 border-b border-white/10 px-8 pt-8 pb-6">
                                <button
                                    onClick={handleCloseModal}
                                    className="absolute top-6 right-6 w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                                >
                                    <FaTimes size={14} />
                                </button>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm shadow-lg shadow-blue-500/30">H</div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400">Admin Registration</span>
                                </div>
                                <h2 className="text-2xl font-extrabold text-white">Create Your Account</h2>
                                <p className="text-gray-400 text-sm mt-1">Get started with your HRMS subscription today.</p>
                            </div>

                            <div className="p-8">
                                {/* Error / Success */}
                                {signupError && (
                                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-2xl mb-6 text-xs font-bold">
                                        {signupError}
                                    </div>
                                )}
                                {signupSuccess && (
                                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-2xl mb-6 text-xs font-bold flex items-center gap-2">
                                        <FaCheckCircle />
                                        {signupSuccess}
                                        <button onClick={() => navigate("/login")} className="ml-auto underline underline-offset-2 hover:text-emerald-300 transition-colors">
                                            Go to Login →
                                        </button>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                                    {/* LEFT: Plan Selector */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <FaCrown className="text-amber-400 text-xs" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Choose Plan</span>
                                        </div>
                                        <div className="space-y-3">
                                            {plans.map((plan) => (
                                                <button
                                                    key={plan._id}
                                                    type="button"
                                                    onClick={() => setSelectedPlan(plan)}
                                                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${selectedPlan?._id === plan._id
                                                            ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
                                                            : 'border-white/10 bg-white/5 hover:border-blue-500/30 hover:bg-white/10'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-white font-bold capitalize text-sm">{plan.planName}</span>
                                                                {selectedPlan?._id === plan._id && (
                                                                    <FaCheckCircle className="text-blue-400 text-xs flex-shrink-0" />
                                                                )}
                                                            </div>
                                                            <p className="text-gray-500 text-[10px] mt-0.5 uppercase tracking-wide font-bold">
                                                                {plan.durationDays} days access
                                                            </p>
                                                        </div>
                                                        <div className="text-right flex-shrink-0 ml-3">
                                                            <div className="text-blue-400 font-black text-lg">
                                                                {Number(plan.price) === 0 ? "Free" : `₹${plan.price}`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Features preview */}
                                                    {plan.features && plan.features.length > 0 && (
                                                        <div className="mt-2 pt-2 border-t border-white/5 space-y-0.5">
                                                            {plan.features.slice(0, 3).map((f, i) => (
                                                                <p key={i} className="text-gray-500 text-[10px] flex items-center gap-1">
                                                                    <span className="text-blue-500/60">✓</span> {f}
                                                                </p>
                                                            ))}
                                                            {plan.features.length > 3 && (
                                                                <p className="text-gray-600 text-[10px]">+{plan.features.length - 3} more</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* RIGHT: Registration Form */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Your Details</span>
                                        </div>

                                        <form onSubmit={handleAdminRegister} className="space-y-3">
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 ml-1 mb-1 block">Full Name</label>
                                                <input
                                                    placeholder="John Smith"
                                                    className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 px-4 py-3 rounded-xl outline-none focus:border-blue-500/60 focus:bg-white/10 transition-all text-sm"
                                                    value={signupForm.name}
                                                    onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 ml-1 mb-1 block">Email Address</label>
                                                <input
                                                    type="email"
                                                    placeholder="admin@company.com"
                                                    className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 px-4 py-3 rounded-xl outline-none focus:border-blue-500/60 focus:bg-white/10 transition-all text-sm"
                                                    value={signupForm.email}
                                                    onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 ml-1 mb-1 block">Password</label>
                                                <input
                                                    type="password"
                                                    placeholder="Min. 6 characters"
                                                    className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 px-4 py-3 rounded-xl outline-none focus:border-blue-500/60 focus:bg-white/10 transition-all text-sm"
                                                    value={signupForm.password}
                                                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 ml-1 mb-1 block">Phone</label>
                                                <input
                                                    placeholder="+91 98765 43210"
                                                    className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-600 px-4 py-3 rounded-xl outline-none focus:border-blue-500/60 focus:bg-white/10 transition-all text-sm"
                                                    value={signupForm.phone}
                                                    onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                                                />
                                            </div>

                                            {/* Selected plan summary */}
                                            {selectedPlan && (
                                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Selected Plan</p>
                                                        <p className="text-white font-bold text-sm capitalize">{selectedPlan.planName}</p>
                                                    </div>
                                                    <div className="text-blue-400 font-black text-xl">
                                                        {Number(selectedPlan.price) === 0 ? "Free" : `₹${selectedPlan.price}`}
                                                    </div>
                                                </div>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={signupLoading || !selectedPlan || !!signupSuccess}
                                                className="w-full mt-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {signupLoading
                                                    ? "Processing..."
                                                    : !selectedPlan
                                                        ? "← Select a Plan"
                                                        : Number(selectedPlan.price) === 0
                                                            ? "Create Free Account"
                                                            : `Pay ₹${selectedPlan.price} & Activate`}
                                            </button>

                                            <p className="text-center text-[10px] text-gray-600 uppercase tracking-wider pt-1">
                                                {Number(selectedPlan?.price) > 0 ? "Secured by Stripe · No free trials" : "No credit card required"}
                                            </p>
                                        </form>

                                        <div className="mt-4 pt-4 border-t border-white/5 text-center">
                                            <p className="text-gray-600 text-xs">
                                                Already have an account?{" "}
                                                <button onClick={() => navigate("/login")} className="text-blue-400 font-bold hover:text-blue-300 transition-colors">
                                                    Sign in →
                                                </button>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DynamicHRMSLandingPage;