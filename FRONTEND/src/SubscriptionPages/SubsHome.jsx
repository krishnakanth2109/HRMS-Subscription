import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import api from "../api";
import API from "../api";
import { FaTimes, FaCheckCircle, FaCrown, FaFacebookF, FaTwitter, FaLinkedinIn, FaInstagram, FaYoutube, FaHeart, FaSun, FaMoon, FaChevronDown, FaWhatsapp, FaEnvelope, FaPhone } from "react-icons/fa";

/* ─────────────────────────────────────────────────────────────────
   Helper: dynamically load Razorpay checkout script
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

// ── Curated Unsplash image URLs relevant to each section ──
const IMAGES = {
    // Hero – person at laptop in bright modern office
    hero: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&q=80&auto=format&fit=crop",
    // Employee management – team portrait
    employeeManagement: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80&auto=format&fit=crop",
    // Attendance – punch clock / time tracking
    attendance: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&q=80&auto=format&fit=crop",
    // Database – server room / data centre
    database: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&q=80&auto=format&fit=crop",
    // Performance – growth chart / analytics on screen
    performance: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80&auto=format&fit=crop",
    // Access control – security lock / key card
    accessControl: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=600&q=80&auto=format&fit=crop",
    // Payroll – finance / currency / calculator
    payroll: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80&auto=format&fit=crop",
    // Leave management – calendar planning
    leaveManagement: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=600&q=80&auto=format&fit=crop",
    // Reports & analytics – data dashboard
    analytics: "https://images.unsplash.com/photo-1543286386-713bdd548da4?w=1200&q=80&auto=format&fit=crop",
    // Benefits – rocket / growth / automation
    automation: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80&auto=format&fit=crop",
    // Security – padlock cyber
    security: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=600&q=80&auto=format&fit=crop",
    // Global compliance – world map
    global: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80&auto=format&fit=crop",
    // Scalability – skyscraper / large team
    scalability: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80&auto=format&fit=crop",
    // AI support – robot / AI
    aiSupport: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=80&auto=format&fit=crop",
    // Uptime – server / infrastructure
    uptime: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=900&q=80&auto=format&fit=crop",
    // Digital excellence / crafting – design workspace
    craftingExcellence: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80&auto=format&fit=crop",
    // Support headset / customer service
    supportHero: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80&auto=format&fit=crop",
    // Pricing – business handshake / contract
    pricing: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80&auto=format&fit=crop",
};

const DynamicHRMSLandingPage = () => {
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState('home');
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        return savedTheme ? savedTheme === 'dark' : false;
    });
    const [activeFaq, setActiveFaq] = useState(null);
    const [hoveredPlan, setHoveredPlan] = useState(null);

    const [plans, setPlans] = useState([]);
    const [plansLoading, setPlansLoading] = useState(true);

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
        sessionStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    const toggleTheme = () => setIsDarkMode(!isDarkMode);

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

    const filteredPlans = plans.filter(
        (plan) => plan.planName?.toLowerCase() !== "owner"
    );

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
        "/admin/overtime": "Overtime Requests",
        "/admin/live-tracking": "Employee Idle Tracking",
        "/admin/induction": "Induction",
    };

    /* ─── RAZORPAY ─── */
    const handleRazorpayPayment = async (planInfo) => {
        const sdkReady = await loadRazorpayScript();
        if (!sdkReady) {
            setSignupError("Failed to load payment gateway. Please check your connection.");
            setSignupLoading(false);
            return;
        }

        let orderData;
        try {
            const res = await API.post("/api/razorpay/create-order", { plan: selectedPlan, signupForm });
            orderData = res.data;
        } catch (err) {
            setSignupError(err.response?.data?.message || "Could not create payment order.");
            setSignupLoading(false);
            return;
        }

        const options = {
            key: orderData.keyId,
            amount: orderData.amount,
            currency: orderData.currency,
            name: "HRMS vwsync",
            description: `${planInfo.planName} Plan — ${planInfo.durationDays} days`,
            order_id: orderData.orderId,
            prefill: { name: signupForm.name, email: signupForm.email, contact: signupForm.phone },
            theme: { color: "#2563eb" },
            handler: async (paymentResponse) => {
                try {
                    setSignupLoading(true);
                    await API.post("/api/razorpay/verify-payment", {
                        razorpay_order_id: paymentResponse.razorpay_order_id,
                        razorpay_payment_id: paymentResponse.razorpay_payment_id,
                        razorpay_signature: paymentResponse.razorpay_signature,
                        signupForm,
                        plan: selectedPlan,
                    });
                    navigate(`/payment-success?payment_id=${paymentResponse.razorpay_payment_id}`);
                } catch (verifyErr) {
                    setSignupError(
                        verifyErr.response?.data?.message ||
                        "Payment received but verification failed. Contact support with your payment ID: " +
                        paymentResponse.razorpay_payment_id
                    );
                } finally {
                    setSignupLoading(false);
                }
            },
            modal: {
                ondismiss: () => {
                    setSignupError("Payment cancelled. You can try again.");
                    setSignupLoading(false);
                },
            },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (response) => {
            setSignupError(response.error?.description || "Payment failed. Please try again.");
            setSignupLoading(false);
        });
        rzp.open();
    };

    const handleAdminRegister = async (e) => {
        e.preventDefault();
        setSignupError("");
        setSignupSuccess("");
        if (!selectedPlan) return setSignupError("Please select a plan");
        setSignupLoading(true);

        try {
            if (Number(selectedPlan.price) === 0) {
                await API.post("/api/admin/register", { ...signupForm, plan: selectedPlan.planName });
                setSignupSuccess(`🎉 ${selectedPlan.planName} account created! Please login.`);
                setSignupForm({ name: "", email: "", password: "", phone: "", role: "admin", department: "" });
                setSignupLoading(false);
                return;
            }
            await handleRazorpayPayment(selectedPlan);
        } catch (err) {
            setSignupError(err.response?.data?.message || "Registration failed. Please try again.");
            setSignupLoading(false);
        }
    };

    const getMostPopularIndex = () => {
        if (filteredPlans.length === 3) return 1;
        if (filteredPlans.length === 2) return 1;
        return -1;
    };
    const mostPopularIdx = getMostPopularIndex();

    /* ── Theme classes ── */
    const bg = isDarkMode ? 'bg-[#0f172a]' : 'bg-[#f0f4ff]';
    const text = isDarkMode ? 'text-white' : 'text-gray-900';
    const textSec = isDarkMode ? 'text-gray-400' : 'text-gray-600';
    const textMuted = isDarkMode ? 'text-gray-500' : 'text-gray-500';
    const navBg = isDarkMode ? 'bg-[#0f172a]/90 border-white/10' : 'bg-white/90 border-gray-200';
    const cardBg = isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200';
    const sectionBg = isDarkMode ? 'bg-[#0f172a]' : 'bg-[#f0f4ff]';
    const inputBg = isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-300';
    const inputFocus = isDarkMode ? 'focus:border-blue-500 focus:bg-white/10' : 'focus:border-blue-500 focus:bg-blue-50/50';
    const modalBg = isDarkMode ? 'bg-[#0d1117] border-white/10' : 'bg-white border-gray-200';

    const faqs = [
        { q: "Can I change my plan later?", a: "Yes, you can upgrade or downgrade your plan at any time from your account settings. Changes take effect on your next billing cycle." },
        { q: "What happens after the Free Trial?", a: "After the 60-day free trial ends, your account will be paused. You can subscribe to a paid plan anytime to continue using all features." },
        { q: "Do you offer discounts for non-profits?", a: "Yes! We offer special pricing for non-profit organizations. Contact our sales team at ops@arahinfotech.net for more information." },
    ];

    return (
        <div className={`min-h-screen ${bg} ${text} font-sans transition-colors duration-300`} style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
                html { scroll-behavior: smooth; }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
                .fade-up { animation: fadeUp 0.7s ease-out forwards; }
                @keyframes modalIn { from { opacity: 0; transform: scale(0.96) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                .modal-animate { animation: modalIn 0.25s ease-out forwards; }
                .gradient-text { background: linear-gradient(135deg, #2563eb 0%, #06b6d4 50%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
                .badge-glow { box-shadow: 0 0 0 1px rgba(37,99,235,0.3), 0 2px 8px rgba(37,99,235,0.15); }
                .card-hover { transition: box-shadow 0.25s, transform 0.25s, border-color 0.25s; }
                .card-hover:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(37,99,235,0.12); }
                .plan-popular { background: linear-gradient(135deg, #1d4ed8, #0284c7); }
                .plan-active-free { background: linear-gradient(135deg, #1d4ed8, #0284c7); }
                .plan-active-premium { background: linear-gradient(135deg, #1d4ed8, #0ea5e9); }
                .btn-primary { background: linear-gradient(135deg, #2563eb, #0ea5e9); transition: all 0.2s; }
                .btn-primary:hover { background: linear-gradient(135deg, #1d4ed8, #0284c7); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(37,99,235,0.35); }
                .btn-outline { border: 2px solid #2563eb; color: #2563eb; transition: all 0.2s; }
                .btn-outline:hover { background: #2563eb; color: white; transform: translateY(-1px); }
                .nav-link { position: relative; font-weight: 500; transition: color 0.2s; }
                .nav-link.active::after { content: ''; position: absolute; bottom: -4px; left: 0; right: 0; height: 2px; background: #2563eb; border-radius: 999px; }
                .stat-card { border-radius: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
                .hero-badge { background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.25); }
                .feature-icon-wrap { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .support-icon-wrap { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
                .faq-item { border-radius: 14px; overflow: hidden; transition: all 0.2s; }
                .check-circle { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .glassmorphic { backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
                @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                .float { animation: float 5s ease-in-out infinite; }
                .img-card { width:100%; height:100%; object-fit:cover; border-radius:inherit; }
                .img-overlay { position:absolute; inset:0; border-radius:inherit; }
            `}</style>

            {/* ─── NAVIGATION ─── */}
            <nav className={`sticky top-0 w-full z-40 px-6 md:px-10 py-3.5 border-b glassmorphic ${navBg}`}>
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <img
                        src="https://image2url.com/r2/default/images/1774247571292-e7459e42-1868-4206-bd5c-bb4c59de5716.png"
                        alt="V-Sync"
                        className="h-12 md:h-14 object-contain"
                    />
                    <div className="hidden md:flex items-center gap-8">
                        {[
                            { label: 'Home', id: 'home' },
                            { label: 'Features', id: 'features' },
                            { label: 'Benefits', id: 'benefits' },
                            { label: 'Pricing', id: 'pricing' },
                            { label: 'Support', id: 'support' },
                        ].map((item) => (
                            <a
                                key={item.id}
                                href={item.id === 'home' ? '#' : `#${item.id}`}
                                onClick={() => setActiveSection(item.id)}
                                className={`nav-link text-sm ${activeSection === item.id ? 'text-blue-600 active' : textSec} hover:text-blue-600`}
                            >
                                {item.label}
                            </a>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleTheme}
                            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}
                        >
                            {isDarkMode ? <FaSun className="text-yellow-400" size={16} /> : <FaMoon className="text-gray-600" size={16} />}
                        </button>
                        <button
                            onClick={() => navigate("/request-demo")}
                            className={`hidden md:block px-5 py-2 rounded-full text-sm font-semibold transition-all ${isDarkMode ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                            Request Demo
                        </button>
                        <button
                            onClick={() => navigate("/login")}
                            className="btn-primary px-5 py-2 rounded-full text-sm font-bold text-white shadow-md"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* ─── HERO / HOME ─── */}
            <section id="home" className={`pt-16 pb-20 px-6 md:px-10 ${sectionBg}`}>
                <div className="max-w-7xl mx-auto">

                    {/* Badge */}
                    <div className="flex justify-center mb-6 fade-up">
                        <span className="hero-badge inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-blue-600 text-xs font-bold uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                            NEW: AI PAYROLL AUTOMATION 2.0
                        </span>
                    </div>

                    {/* Headline */}
                    <div className="text-center mb-6 fade-up" style={{ animationDelay: '0.1s' }}>
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.1] mb-6">
                            Enterprise-Grade <span className="gradient-text">Features</span><br />
                            for Modern HR
                        </h1>
                        <p className={`${textSec} text-base md:text-lg max-w-2xl mx-auto leading-relaxed`}>
                            Streamline your global workforce with VW Sync's precision-engineered HR suite.
                            Automated payroll, real-time attendance, and predictive analytics in one glassmorphic dashboard.
                        </p>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex flex-wrap items-center justify-center gap-4 mb-10 fade-up" style={{ animationDelay: '0.2s' }}>
                        <button onClick={() => navigate("/login")} className="btn-primary px-8 py-3.5 rounded-xl font-bold text-white text-sm shadow-lg">
                            Sign In
                        </button>
                        <a href="#pricing">
                            <button className="btn-outline px-8 py-3.5 rounded-xl font-bold text-sm">
                                View Pricing
                            </button>
                        </a>
                    </div>

                    {/* Hero Banner Image */}
                    <div className="relative rounded-2xl overflow-hidden mb-10 fade-up" style={{ animationDelay: '0.25s', height: '340px' }}>
                        <img
                            src={IMAGES.hero}
                            alt="Modern HR team collaborating"
                            className="w-full h-full object-cover"
                        />
                        <div className={`absolute inset-0 ${isDarkMode ? 'bg-gradient-to-r from-[#0f172a]/80 via-[#0f172a]/40 to-transparent' : 'bg-gradient-to-r from-blue-900/60 via-blue-900/20 to-transparent'}`}></div>
                        <div className="absolute inset-0 flex items-center px-10">
                            <div>
                                <p className="text-white text-xs font-bold uppercase tracking-widest mb-2 opacity-80">TRUSTED BY ENTERPRISES WORLDWIDE</p>
                                <p className="text-white text-2xl md:text-3xl font-black max-w-xs leading-tight">HR Simplified.<br />Workforce Amplified.</p>
                                <div className="flex items-center gap-3 mt-4">
                                    <div className="flex -space-x-2">
                                        {[
                                            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&q=80&auto=format&fit=crop&crop=face',
                                            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&q=80&auto=format&fit=crop&crop=face',
                                            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&q=80&auto=format&fit=crop&crop=face',
                                        ].map((src, i) => (
                                            <img key={i} src={src} alt="user" className="w-9 h-9 rounded-full border-2 border-white object-cover" />
                                        ))}
                                    </div>
                                    <p className="text-white text-xs font-semibold opacity-90">10,000+ teams onboarded</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Features Grid */}
                    <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-5 fade-up" style={{ animationDelay: '0.3s' }}>

                        {/* Employee Management – large card with real image */}
                        <div className={`md:col-span-2 rounded-2xl overflow-hidden card-hover border ${cardBg}`}>
                            <div className="p-6">
                                <div className="feature-icon-wrap bg-blue-50 mb-3">
                                    <span className="text-xl">👥</span>
                                </div>
                                <h3 className={`text-xl font-bold mb-2 ${text}`}>Employee Management</h3>
                                <p className={`${textSec} text-sm mb-4`}>Manage employee profiles, roles, and organizational structure efficiently with automated hierarchy mapping.</p>
                            </div>
                            <div className="relative h-48 mx-4 mb-4 rounded-xl overflow-hidden">
                                <img src={IMAGES.employeeManagement} alt="Team collaboration" className="w-full h-full object-cover" />
                                <div className={`absolute inset-0 ${isDarkMode ? 'bg-blue-900/40' : 'bg-blue-600/10'}`}></div>
                                <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur rounded-lg px-3 py-1.5 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    <span className="text-xs font-bold text-gray-700">Hierarchy · 3 Levels Active</span>
                                </div>
                            </div>
                        </div>

                        {/* Attendance Tracking */}
                        <div className={`rounded-2xl overflow-hidden card-hover border ${cardBg}`}>
                            <div className="p-6">
                                <div className="feature-icon-wrap bg-cyan-50 mb-3">
                                    <span className="text-xl">⏰</span>
                                </div>
                                <h3 className={`text-lg font-bold mb-2 ${text}`}>Attendance Tracking</h3>
                                <p className={`${textSec} text-sm mb-3`}>Biometric integration and real-time attendance tracking for hybrid workforces.</p>
                            </div>
                            <div className="relative h-32 mx-4 mb-4 rounded-xl overflow-hidden">
                                <img src={IMAGES.attendance} alt="Time tracking" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-cyan-900/30"></div>
                                <div className="absolute bottom-2 right-2 bg-cyan-500 text-white text-xs font-bold px-2 py-1 rounded-md">Live ●</div>
                            </div>
                        </div>

                        {/* Database Management */}
                        <div className={`rounded-2xl overflow-hidden card-hover border ${cardBg}`}>
                            <div className="relative h-36 overflow-hidden">
                                <img src={IMAGES.database} alt="Database server" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-red-900/40"></div>
                                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur rounded-lg px-2 py-1">
                                    <span className="text-xs font-bold text-gray-700">256-bit Encrypted</span>
                                </div>
                            </div>
                            <div className="p-5">
                                <div className="feature-icon-wrap bg-red-50 mb-2">
                                    <span className="text-xl">🗄️</span>
                                </div>
                                <h3 className={`text-lg font-bold mb-1 ${text}`}>Database Management</h3>
                                <p className={`${textSec} text-sm`}>Secure employee data storage with real-time sync and encrypted cloud backup.</p>
                            </div>
                        </div>

                        {/* Performance Management */}
                        <div className={`rounded-2xl overflow-hidden card-hover border ${cardBg}`}>
                            <div className="relative h-36 overflow-hidden">
                                <img src={IMAGES.performance} alt="Performance analytics dashboard" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-purple-900/30"></div>
                            </div>
                            <div className="p-5">
                                <div className="feature-icon-wrap bg-purple-50 mb-2">
                                    <span className="text-xl">📊</span>
                                </div>
                                <h3 className={`text-lg font-bold mb-1 ${text}`}>Performance Management</h3>
                                <p className={`${textSec} text-sm mb-3`}>Goal tracking, peer reviews, and automated performance analytics dashboards.</p>
                                <div className="space-y-1.5">
                                    <div className="h-1.5 rounded-full bg-blue-600" style={{ width: '75%' }}></div>
                                    <div className="h-1.5 rounded-full bg-gray-200" style={{ width: '100%' }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Access Control */}
                        <div className={`rounded-2xl overflow-hidden card-hover border ${cardBg}`}>
                            <div className="relative h-36 overflow-hidden">
                                <img src={IMAGES.accessControl} alt="Security access control" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-green-900/40"></div>
                                <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-md">Secured ✓</div>
                            </div>
                            <div className="p-5">
                                <div className="feature-icon-wrap bg-green-50 mb-2">
                                    <span className="text-xl">🔐</span>
                                </div>
                                <h3 className={`text-lg font-bold mb-1 ${text}`}>Access Control</h3>
                                <p className={`${textSec} text-sm`}>Role-based access to ensure data security and proper authorization across teams.</p>
                            </div>
                        </div>

                        {/* Payroll Management – wide card with image */}
                        <div className={`md:col-span-2 rounded-2xl overflow-hidden card-hover border ${cardBg}`}>
                            <div className="flex flex-col md:flex-row">
                                <div className="p-6 flex-1">
                                    <div className="feature-icon-wrap bg-blue-50 mb-3">
                                        <span className="text-xl">💰</span>
                                    </div>
                                    <h3 className={`text-lg font-bold mb-2 ${text}`}>Payroll Management</h3>
                                    <p className={`${textSec} text-sm mb-3`}>Automated salary processing with tax compliance and detailed digital paystubs.</p>
                                    <div className="flex gap-2">
                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">Compliance Ready</span>
                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-100 text-cyan-700">Instant Payouts</span>
                                    </div>
                                </div>
                                <div className="relative w-full md:w-52 h-44 md:h-auto flex-shrink-0">
                                    <img src={IMAGES.payroll} alt="Payroll and finance" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-blue-900/30"></div>
                                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur rounded-lg px-3 py-1.5">
                                        <p className="text-xs font-black text-gray-800">₹ Auto-Processed</p>
                                        <p className="text-xs text-green-600 font-semibold">Last run: Today</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Leave Management */}
                        <div className={`rounded-2xl overflow-hidden card-hover border ${cardBg}`}>
                            <div className="relative h-36 overflow-hidden">
                                <img src={IMAGES.leaveManagement} alt="Leave calendar planning" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-indigo-900/40"></div>
                                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur rounded-lg px-2 py-1">
                                    <span className="text-xs font-bold text-gray-700">📅 Leaves Synced</span>
                                </div>
                            </div>
                            <div className="p-5">
                                <div className="feature-icon-wrap bg-indigo-50 mb-2">
                                    <span className="text-xl">📅</span>
                                </div>
                                <h3 className={`text-lg font-bold mb-1 ${text}`}>Leave Management</h3>
                                <p className={`${textSec} text-sm`}>Apply, approve, and track employee leaves with automated workflows and balance sync.</p>
                            </div>
                        </div>

                        {/* Reports & Analytics – full width with image banner */}
                        <div className={`md:col-span-3 rounded-2xl overflow-hidden card-hover border ${cardBg}`}>
                            <div className="flex flex-col md:flex-row">
                                <div className="p-8 flex-1">
                                    <div className="feature-icon-wrap bg-pink-50 mb-3">
                                        <span className="text-xl">📈</span>
                                    </div>
                                    <h3 className={`text-xl font-bold mb-2 ${text}`}>Reports & Analytics</h3>
                                    <p className={`${textSec} text-sm max-w-lg`}>Generate detailed reports and insights for better decision making. Predictive modeling for churn and growth forecasting.</p>
                                </div>
                                <div className="relative w-full md:w-80 h-52 md:h-auto flex-shrink-0">
                                    <img src={IMAGES.analytics} alt="Analytics dashboard" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-pink-900/25"></div>
                                    <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur rounded-xl px-4 py-2 shadow-lg">
                                        <p className="text-xs font-black text-gray-800">+24% Growth</p>
                                        <p className="text-xs text-green-600 font-semibold">This Quarter ↑</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── BENEFITS ─── */}
            <section id="benefits" className={`py-20 px-6 md:px-10 ${isDarkMode ? 'bg-[#0a0f1e]' : 'bg-white'}`}>
                <div className="max-w-7xl mx-auto">
                    {/* Hero Banner */}
                    <div className={`relative rounded-2xl overflow-hidden mb-12 p-10 text-center ${isDarkMode ? 'bg-gradient-to-br from-slate-800 to-slate-700' : 'bg-gradient-to-br from-gray-100 to-gray-200'}`}>
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #2563eb 0%, transparent 60%), radial-gradient(circle at 70% 50%, #06b6d4 0%, transparent 60%)' }}></div>
                        <div className="relative">
                            <span className={`inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase ${textMuted} mb-4`}>✦ THE FUTURE OF HR</span>
                            <h2 className={`text-3xl md:text-4xl font-black mb-4 ${text}`}>
                                Why Choose <span className="gradient-text">VW Sync?</span>
                            </h2>
                            <p className={`${textSec} max-w-2xl mx-auto`}>
                                Empowering forward-thinking enterprises with a high-performance engine for modern workflows.
                            </p>
                        </div>
                    </div>

                    {/* Benefits Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">

                        {/* 70% Time Saved – image card */}
                        <div className={`md:col-span-2 rounded-2xl overflow-hidden card-hover border ${cardBg}`}>
                            <div className="p-8">
                                <div className="feature-icon-wrap bg-blue-600 mb-5">
                                    <span className="text-white text-xl">⚡</span>
                                </div>
                                <h3 className={`text-2xl font-black mb-3 ${text}`}>70% Time Saved</h3>
                                <p className={`${textSec} text-sm mb-5 max-w-sm`}>Automate repetitive HR tasks and reduce manual work significantly. Free your team to focus on strategic initiatives.</p>
                            </div>
                            <div className="relative h-44 mx-4 mb-4 rounded-xl overflow-hidden">
                                <img src={IMAGES.automation} alt="Automation rocket launch" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-blue-900/40"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center">
                                        <span className="text-5xl float">🚀</span>
                                        <p className="text-white text-xs font-bold mt-2 opacity-90">Automation Engine Active</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Enterprise Security – dark card with image */}
                        <div className="rounded-2xl overflow-hidden card-hover bg-gray-900 text-white border border-gray-800">
                            <div className="relative h-44 overflow-hidden">
                                <img src={IMAGES.security} alt="Cybersecurity padlock" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gray-900/50"></div>
                                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-500/20 border border-green-500/40 rounded-lg px-3 py-1.5">
                                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                    <span className="text-green-400 text-xs font-bold">Secure</span>
                                </div>
                            </div>
                            <div className="p-8">
                                <div className="feature-icon-wrap bg-red-600 mb-5">
                                    <span className="text-white text-xl">🔒</span>
                                </div>
                                <h3 className="text-xl font-black mb-3">Enterprise Security</h3>
                                <p className="text-gray-400 text-sm mb-6">Bank-level encryption and compliance with global data protection regulations.</p>
                                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/30">
                                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                    <span className="text-green-400 text-xs font-bold">GDPR & SOC2 Compliant</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                        {/* Global Compliance */}
                        <div className={`rounded-2xl overflow-hidden card-hover border ${cardBg}`}>
                            <div className="relative h-36 overflow-hidden">
                                <img src={IMAGES.global} alt="Global world map compliance" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-cyan-900/40"></div>
                                <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur rounded-lg px-2 py-1">
                                    <span className="text-xs font-bold text-gray-700">50+ Countries</span>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="feature-icon-wrap bg-cyan-50 mb-3">
                                    <span className="text-xl">🌐</span>
                                </div>
                                <h3 className={`text-lg font-black mb-2 ${text}`}>Global Compliance</h3>
                                <p className={`${textSec} text-sm`}>Stay compliant with local labor laws across <span className="text-blue-600 font-bold">50+ countries</span> effortlessly.</p>
                            </div>
                        </div>

                        {/* Scalability */}
                        <div className={`rounded-2xl overflow-hidden card-hover border ${cardBg}`}>
                            <div className="relative h-36 overflow-hidden">
                                <img src={IMAGES.scalability} alt="Large team scalability office" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-green-900/30"></div>
                                <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur rounded-lg px-2 py-1">
                                    <span className="text-xs font-bold text-gray-700">10K+ Employees</span>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="feature-icon-wrap bg-green-50 mb-3">
                                    <span className="text-xl">📈</span>
                                </div>
                                <h3 className={`text-lg font-black mb-2 ${text}`}>Scalability</h3>
                                <p className={`${textSec} text-sm`}>From 10 to 10,000+ employees — our platform grows with your business without losing performance.</p>
                            </div>
                        </div>

                        {/* 24/7 AI Support */}
                        <div className={`rounded-2xl overflow-hidden card-hover border ${cardBg}`}>
                            <div className="relative h-36 overflow-hidden">
                                <img src={IMAGES.aiSupport} alt="AI artificial intelligence support" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-blue-900/40"></div>
                                <div className="absolute bottom-2 left-2 bg-blue-600 rounded-lg px-2 py-1">
                                    <span className="text-xs font-bold text-white">AI-Powered</span>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="feature-icon-wrap bg-blue-600 mb-3">
                                    <span className="text-white text-xl">🤖</span>
                                </div>
                                <h3 className={`text-lg font-black mb-2 ${text}`}>24/7 AI Support</h3>
                                <p className={`${textSec} text-sm`}>Intelligent chatbots and human experts available round-the-clock to solve your HR queries instantly.</p>
                            </div>
                        </div>
                    </div>

                    {/* Uptime Banner */}
                    <div className={`rounded-2xl overflow-hidden card-hover border ${cardBg} mb-10`}>
                        <div className="relative h-32 overflow-hidden">
                            <img src={IMAGES.uptime} alt="Server infrastructure uptime" className="w-full h-full object-cover" />
                            <div className={`absolute inset-0 ${isDarkMode ? 'bg-[#0f172a]/70' : 'bg-white/70'}`}></div>
                            <div className="absolute inset-0 flex items-center px-8 justify-between">
                                <div>
                                    <h3 className={`text-2xl md:text-3xl font-black mb-1 ${text}`}>99.9% Uptime Guarantee</h3>
                                    <p className={`${textSec} text-sm max-w-lg`}>Reliable infrastructure with guaranteed availability. Your HR operations never sleep, and neither does V-Sync.</p>
                                </div>
                                <div className="hidden md:flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-2">
                                    <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
                                    <span className="text-green-500 text-sm font-black">ONLINE</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-14">
                        {[
                            { value: '70%', label: 'TIME SAVED', sub: 'Automate repetitive HR tasks and reduce manual work significantly.', color: 'text-blue-600' },
                            { value: '99.9%', label: 'UPTIME SLA', sub: 'Reliable infrastructure with guaranteed availability for global teams.', color: 'text-blue-600' },
                            { value: '10K+', label: 'ACTIVE USERS', sub: 'Trusted by leading enterprises to manage their most valuable assets.', color: 'text-red-500' },
                        ].map((s, i) => (
                            <div key={i} className={`stat-card rounded-2xl p-7 text-center ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
                                <div className={`text-4xl font-black ${s.color} mb-1`}>{s.value}</div>
                                <div className={`text-xs font-bold uppercase tracking-widest ${textMuted} mb-3`}>{s.label}</div>
                                <p className={`text-xs ${textSec}`}>{s.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* Crafting Digital Excellence */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                        <div className="relative rounded-2xl overflow-hidden h-72">
                            <img src={IMAGES.craftingExcellence} alt="Team crafting digital excellence" className="w-full h-full object-cover" />
                            <div className={`absolute inset-0 ${isDarkMode ? 'bg-blue-900/40' : 'bg-blue-600/10'}`}></div>
                            <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
                                <div className="flex -space-x-2">
                                    {[
                                        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&q=80&auto=format&fit=crop&crop=face',
                                        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&q=80&auto=format&fit=crop&crop=face',
                                    ].map((src, i) => (
                                        <img key={i} src={src} alt="team" className="w-8 h-8 rounded-full border-2 border-white object-cover" />
                                    ))}
                                </div>
                                <div>
                                    <p className="text-xs font-black text-gray-800">Built for People</p>
                                    <p className="text-xs text-blue-600 font-semibold">Human-centered design</p>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h3 className={`text-2xl md:text-3xl font-black mb-4 ${text}`}>Crafting Digital Excellence for Your People</h3>
                            <p className={`${textSec} text-sm mb-6 leading-relaxed`}>V-Sync isn't just another HR tool. It's a meticulously designed ecosystem that respects the human element while leveraging the power of automation. Every feature is a building block for your company's growth.</p>
                            <ul className="space-y-3">
                                {[
                                    'Intuitive design that requires zero training for employees.',
                                    'Real-time insights to make data-driven people decisions.',
                                    'Seamless integration with your existing tech stack.',
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <div className="check-circle bg-blue-600 flex-shrink-0 mt-0.5">
                                            <FaCheckCircle className="text-white text-xs" />
                                        </div>
                                        <span className={`text-sm ${textSec}`}>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── PRICING ─── */}
            <section id="pricing" className={`py-20 px-6 md:px-10 ${sectionBg}`}>
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-12">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4 hero-badge text-blue-600">
                            ✦ Simple, Transparent Pricing
                        </span>
                        <h2 className={`text-3xl md:text-4xl font-black mb-4 ${text}`}>
                            Plans tailored for <span className="gradient-text">your growth</span>
                        </h2>
                        <p className={`${textSec} max-w-xl mx-auto text-sm`}>
                            Transforming human resource management into seamless digital experiences.
                        </p>
                    </div>

                    {/* Pricing top image banner */}
                    <div className="relative rounded-2xl overflow-hidden mb-10 h-40">
                        <img src={IMAGES.pricing} alt="Business contract pricing" className="w-full h-full object-cover" />
                        <div className={`absolute inset-0 ${isDarkMode ? 'bg-[#0f172a]/70' : 'bg-blue-900/50'}`}></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <p className="text-white text-xl md:text-2xl font-black text-center">No hidden fees. Cancel anytime.</p>
                        </div>
                    </div>

                    {plansLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <div className={`grid gap-5 max-w-6xl mx-auto ${
                            filteredPlans.length === 1 ? 'grid-cols-1 max-w-sm' :
                            filteredPlans.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-3xl' :
                            'grid-cols-1 md:grid-cols-3'
                        }`}>
                            {filteredPlans.map((plan, index) => {
                                const isPopular = index === mostPopularIdx;
                                const isFree = Number(plan.price) === 0;
                                const isHovered = hoveredPlan === index;

                                return (
                                    <div
                                        key={plan._id || index}
                                        className={`relative rounded-2xl overflow-hidden flex flex-col transition-all duration-300 ${
                                            isPopular
                                                ? 'plan-popular text-white shadow-2xl shadow-blue-500/30 scale-105'
                                                : isHovered
                                                    ? (isFree ? 'plan-active-free text-white shadow-xl shadow-blue-400/25' : 'plan-active-premium text-white shadow-xl shadow-blue-400/25')
                                                    : `${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`
                                        }`}
                                        onMouseEnter={() => setHoveredPlan(index)}
                                        onMouseLeave={() => setHoveredPlan(null)}
                                        style={{ cursor: 'default' }}
                                    >
                                        {isPopular && (
                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                                <span className="bg-white text-blue-600 text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
                                                    MOST POPULAR
                                                </span>
                                            </div>
                                        )}

                                        <div className="p-7 flex-1 flex flex-col">
                                            <div className={`text-xs font-bold uppercase tracking-widest mb-2 ${isPopular || isHovered ? 'text-blue-200' : 'text-blue-600'}`}>
                                                VALID FOR {plan.durationDays} DAYS
                                            </div>
                                            <h3 className={`text-2xl font-black mb-4 ${isPopular || isHovered ? 'text-white' : text}`}>
                                                {plan.planName}
                                            </h3>
                                            <div className="mb-6 flex items-baseline gap-1">
                                                {isFree ? (
                                                    <span className={`text-4xl font-black ${isPopular || isHovered ? 'text-white' : text}`}>Free</span>
                                                ) : (
                                                    <>
                                                        <span className={`text-sm font-bold ${isPopular || isHovered ? 'text-blue-200' : textMuted}`}>₹</span>
                                                        <span className={`text-4xl font-black ${isPopular || isHovered ? 'text-white' : text}`}>{plan.price}</span>
                                                        <span className={`text-sm ${isPopular || isHovered ? 'text-blue-200' : textMuted}`}>/period</span>
                                                    </>
                                                )}
                                            </div>
                                            <ul className="space-y-2.5 mb-8 flex-1">
                                                <li className="flex items-center gap-2.5">
                                                    <div className={`check-circle flex-shrink-0 ${isPopular || isHovered ? 'bg-white/20' : 'bg-blue-100'}`}>
                                                        <FaCheckCircle className={`text-xs ${isPopular || isHovered ? 'text-white' : 'text-blue-600'}`} />
                                                    </div>
                                                    <span className={`text-sm font-semibold ${isPopular || isHovered ? 'text-white' : text}`}>
                                                        {plan.maxUsers === null ? "Unlimited Users" : `${plan.maxUsers} Users`}
                                                    </span>
                                                </li>
                                                {plan.features && plan.features.length > 0 ? (
                                                    plan.features
                                                        .filter(f => f !== "/admin/users-limit")
                                                        .map((feature, fIdx) => (
                                                            <li key={fIdx} className="flex items-center gap-2.5">
                                                                <div className={`check-circle flex-shrink-0 ${isPopular || isHovered ? 'bg-white/20' : 'bg-blue-100'}`}>
                                                                    <FaCheckCircle className={`text-xs ${isPopular || isHovered ? 'text-white' : 'text-blue-600'}`} />
                                                                </div>
                                                                <span className={`text-sm ${isPopular || isHovered ? 'text-blue-100' : textSec}`}>
                                                                    {featureLabels[feature] || feature}
                                                                </span>
                                                            </li>
                                                        ))
                                                ) : (
                                                    <>
                                                        <li className="flex items-center gap-2.5">
                                                            <div className={`check-circle flex-shrink-0 ${isPopular || isHovered ? 'bg-white/20' : 'bg-blue-100'}`}><FaCheckCircle className={`text-xs ${isPopular || isHovered ? 'text-white' : 'text-blue-600'}`} /></div>
                                                            <span className={`text-sm ${isPopular || isHovered ? 'text-blue-100' : textSec}`}>Core Access</span>
                                                        </li>
                                                        <li className="flex items-center gap-2.5">
                                                            <div className={`check-circle flex-shrink-0 ${isPopular || isHovered ? 'bg-white/20' : 'bg-blue-100'}`}><FaCheckCircle className={`text-xs ${isPopular || isHovered ? 'text-white' : 'text-blue-600'}`} /></div>
                                                            <span className={`text-sm ${isPopular || isHovered ? 'text-blue-100' : textSec}`}>Secure Login</span>
                                                        </li>
                                                    </>
                                                )}
                                            </ul>
                                            <button
                                                onClick={() => handlePlanClick(plan)}
                                                className={`w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
                                                    isPopular || isHovered
                                                        ? 'bg-white text-blue-600 hover:bg-blue-50 shadow-md'
                                                        : 'border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white'
                                                }`}
                                            >
                                                {isFree ? "GET STARTED FREE" : "SUBSCRIBE NOW →"}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* FAQ */}
                    <div className="max-w-3xl mx-auto mt-20">
                        <h2 className={`text-3xl font-black text-center mb-10 ${text}`}>Frequently Asked Questions</h2>
                        <div className="space-y-3">
                            {faqs.map((faq, i) => (
                                <div key={i} className={`faq-item border ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                                    <button
                                        className={`w-full flex items-center justify-between p-5 text-left ${text}`}
                                        onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                                    >
                                        <span className="font-semibold text-sm">{faq.q}</span>
                                        <FaChevronDown className={`text-xs flex-shrink-0 ml-4 transition-transform ${activeFaq === i ? 'rotate-180' : ''} ${textMuted}`} />
                                    </button>
                                    {activeFaq === i && (
                                        <div className={`px-5 pb-5 text-sm ${textSec} leading-relaxed`}>{faq.a}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── SUPPORT ─── */}
            <section id="support" className={`py-20 px-6 md:px-10 ${isDarkMode ? 'bg-[#0a0f1e]' : 'bg-white'}`}>
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className={`text-3xl md:text-4xl font-black mb-4 ${text}`}>
                            We're Here to <span className="gradient-text">Help You</span>
                        </h2>
                        <p className={`${textSec} max-w-xl mx-auto text-sm`}>
                            Get the support you need, when you need it most. Our team is dedicated to ensuring your VW Sync experience is flawless.
                        </p>
                    </div>

                    {/* Search Bar */}
                    <div className="max-w-xl mx-auto mb-14">
                        <div className={`flex gap-3 p-2 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'} shadow-md`}>
                            <input
                                type="text"
                                placeholder="Search for documentation, guides, or tutorials..."
                                className={`flex-1 bg-transparent outline-none text-sm px-3 ${text}`}
                            />
                            <button className="btn-primary px-5 py-2.5 rounded-xl text-white text-sm font-bold flex-shrink-0">
                                Search
                            </button>
                        </div>
                    </div>

                    {/* Support Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-5xl mx-auto mb-14">
                        <div className={`rounded-2xl p-7 card-hover border ${cardBg}`}>
                            <div className="support-icon-wrap bg-green-100 mb-4">
                                <FaWhatsapp className="text-green-600 text-xl" />
                            </div>
                            <h3 className={`text-lg font-black mb-2 ${text}`}>WhatsApp Support</h3>
                            <p className={`${textSec} text-sm mb-5`}>Get instant answers from our support team, available 24/7.</p>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-blue-600">Send WhatsApp Message</span>
                                <a
                                    href="https://wa.me/918919801095?text=Hi%2C%20I%E2%80%99d%20like%20more%20information%20about%20your%20HRMS%20product.%20Please%20share%20the%20details."
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700"
                                >
                                    Start Chat →
                                </a>
                            </div>
                        </div>

                        <div className={`rounded-2xl p-7 card-hover border ${cardBg}`}>
                            <div className="support-icon-wrap bg-blue-100 mb-4">
                                <FaEnvelope className="text-blue-600 text-xl" />
                            </div>
                            <h3 className={`text-lg font-black mb-2 ${text}`}>Email Support</h3>
                            <p className={`${textSec} text-sm mb-5`}>Send us your queries and get detailed responses within hours.</p>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-blue-600">ops@arahinfotech.net</span>
                                <a
                                    href="https://mail.google.com/mail/?view=cm&fs=1&to=ops@arahinfotech.net&su=HRMS%20Enquiry&body=Hi%2C%20I%E2%80%99d%20like%20more%20information%20about%20your%20HRMS%20product."
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700"
                                >
                                    Send Email →
                                </a>
                            </div>
                        </div>

                        <div className={`rounded-2xl p-7 card-hover border ${cardBg}`}>
                            <div className="support-icon-wrap bg-pink-100 mb-4">
                                <FaPhone className="text-pink-600 text-xl" />
                            </div>
                            <h3 className={`text-lg font-black mb-2 ${text}`}>Phone Support</h3>
                            <p className={`${textSec} text-sm mb-5`}>Speak directly with our support specialists for urgent issues.</p>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-blue-600">8919801095</span>
                                <a href="tel:8919801095" className="text-xs font-bold text-blue-600 hover:text-blue-700">
                                    Call Now →
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Support Ticket + Image */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-14">
                        <div className={`rounded-2xl p-8 border ${cardBg}`}>
                            <h3 className={`text-2xl font-black mb-2 ${text}`}>Open a Support Ticket</h3>
                            <p className={`${textSec} text-sm mb-6`}>Can't find what you're looking for? Fill out the form and we'll get back to you.</p>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={`text-xs font-semibold ${textMuted} block mb-1.5`}>Full Name</label>
                                        <input placeholder="John Doe" className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none border ${inputBg} ${inputFocus} transition-all ${text}`} />
                                    </div>
                                    <div>
                                        <label className={`text-xs font-semibold ${textMuted} block mb-1.5`}>Work Email</label>
                                        <input placeholder="john@company.com" className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none border ${inputBg} ${inputFocus} transition-all ${text}`} />
                                    </div>
                                </div>
                                <div>
                                    <label className={`text-xs font-semibold ${textMuted} block mb-1.5`}>Category</label>
                                    <select className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none border ${inputBg} ${inputFocus} transition-all ${text}`}>
                                        <option>Technical Issue</option>
                                        <option>Billing</option>
                                        <option>General Inquiry</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`text-xs font-semibold ${textMuted} block mb-1.5`}>Message</label>
                                    <textarea placeholder="How can we help?" rows={3} className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none border ${inputBg} ${inputFocus} transition-all resize-none ${text}`}></textarea>
                                </div>
                                <button className="w-full btn-primary py-3.5 rounded-xl text-white font-black text-sm uppercase tracking-widest">
                                    SUBMIT REQUEST
                                </button>
                            </div>
                        </div>

                        {/* Support image panel */}
                        <div className="relative rounded-2xl overflow-hidden">
                            <img src={IMAGES.supportHero} alt="Customer support team" className="w-full h-full object-cover" style={{ minHeight: '320px' }} />
                            <div className={`absolute inset-0 ${isDarkMode ? 'bg-blue-900/60' : 'bg-blue-900/40'}`}></div>
                            <div className="absolute inset-0 flex flex-col justify-end p-6">
                                <div className={`rounded-xl p-4 flex items-center gap-3 ${isDarkMode ? 'bg-black/50' : 'bg-white/95'} backdrop-blur shadow-lg`}>
                                    <div className="flex -space-x-2">
                                        {[
                                            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&q=80&auto=format&fit=crop&crop=face',
                                            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&q=80&auto=format&fit=crop&crop=face',
                                            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&q=80&auto=format&fit=crop&crop=face',
                                        ].map((src, i) => (
                                            <img key={i} src={src} alt="agent" className="w-9 h-9 rounded-full border-2 border-white object-cover" />
                                        ))}
                                    </div>
                                    <div>
                                        <p className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Active Support Team</p>
                                        <p className="text-xs text-green-500 font-semibold flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                                            Responds in &lt; 2 hours
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FAQ Grid */}
                    <div className="max-w-5xl mx-auto">
                        <h3 className="text-2xl font-black text-center mb-2 gradient-text">Frequently Asked Questions</h3>
                        <p className={`text-center text-sm ${textSec} mb-8`}>Find quick answers to common support queries.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { icon: '🔑', q: 'How do I reset my organizational password?' },
                                { icon: '🔗', q: 'Integrating VW Sync with Microsoft Teams' },
                                { icon: '💰', q: 'Payroll automation compliance in EU' },
                                { icon: '👥', q: 'Adding new employees to the dashboard' },
                            ].map((item, i) => (
                                <div key={i} className={`rounded-2xl p-5 border flex items-center justify-between card-hover cursor-pointer ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`feature-icon-wrap ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
                                            <span>{item.icon}</span>
                                        </div>
                                        <span className={`text-sm font-semibold ${text}`}>{item.q}</span>
                                    </div>
                                    <span className="text-blue-600 text-lg flex-shrink-0 ml-4">›</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── FOOTER ─── */}
            <footer className={`pt-14 pb-6 px-6 md:px-10 border-t ${isDarkMode ? 'bg-[#0f172a] border-white/10' : 'bg-[#f8fafc] border-gray-200'}`}>
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
                        <div className="lg:col-span-2">
                            <img
                                src="https://image2url.com/r2/default/images/1774247571292-e7459e42-1868-4206-bd5c-bb4c59de5716.png"
                                alt="V-Sync"
                                className="h-12 object-contain mb-4"
                            />
                            <p className={`${textMuted} text-xs leading-relaxed mb-5 max-w-xs`}>
                                Transforming human resource management into seamless digital experiences. Trusted by over 10,000+ companies worldwide.
                            </p>
                            <div className="flex gap-2">
                                {[
                                    { icon: FaFacebookF, href: '#' },
                                    { icon: FaTwitter, href: '#' },
                                    { icon: FaLinkedinIn, href: '#' },
                                    { icon: FaInstagram, href: '#' },
                                    { icon: FaYoutube, href: '#' },
                                ].map((s, i) => (
                                    <a key={i} href={s.href} className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all hover:border-blue-600 hover:text-blue-600 ${isDarkMode ? 'border-white/10 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
                                        <s.icon size={12} />
                                    </a>
                                ))}
                            </div>
                        </div>
                        {[
                            { title: 'PRODUCT', links: ['Features', 'Pricing', 'Integrations', 'API', 'Changelog'] },
                            { title: 'COMPANY', links: ['About', 'Blog', 'Careers', 'Press', 'Partners'] },
                            { title: 'RESOURCES', links: ['Documentation', 'Guides', 'Support', 'Status', 'Security'] },
                        ].map((col, i) => (
                            <div key={i}>
                                <h5 className={`text-xs font-black uppercase tracking-widest ${textMuted} mb-4`}>{col.title}</h5>
                                <ul className="space-y-2.5">
                                    {col.links.map((link) => (
                                        <li key={link}>
                                            <a href="#" className={`text-xs ${textSec} hover:text-blue-600 transition-colors`}>{link}</a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                    <div className={`pt-6 border-t flex flex-col md:flex-row justify-between items-center gap-3 ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                        <p className={`text-xs ${textMuted}`}>© 2024 VW SYNC. ALL RIGHTS RESERVED. TRANSFORMING HR INTO DIGITAL EXCELLENCE.</p>
                        <div className="flex gap-5">
                            {['PRIVACY POLICY', 'TERMS OF SERVICE', 'COOKIE POLICY'].map((item) => (
                                <a key={item} href="#" className={`text-xs ${textMuted} hover:text-blue-600 transition-colors`}>{item}</a>
                            ))}
                        </div>
                    </div>
                </div>
            </footer>

            {/* ─── REGISTER MODAL ─── */}
            {showRegisterModal && (
                <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="modal-animate relative w-full max-w-2xl max-h-[95vh] overflow-y-auto">
                        <div className={`${modalBg} rounded-2xl shadow-2xl overflow-hidden border`}>
                            {/* Modal Header */}
                            <div className={`relative px-8 pt-8 pb-6 border-b ${isDarkMode ? 'bg-gradient-to-r from-blue-900/30 to-cyan-900/10 border-white/10' : 'bg-gradient-to-r from-blue-50 to-cyan-50 border-gray-200'}`}>
                                <button
                                    onClick={handleCloseModal}
                                    className={`absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'} transition-all`}
                                >
                                    <FaTimes size={12} />
                                </button>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xs text-white">H</div>
                                    <span className="text-xs font-black uppercase tracking-widest text-blue-600">Admin Registration</span>
                                </div>
                                <h2 className={`text-2xl font-black ${text}`}>Create Your Account</h2>
                                <p className={`${textSec} text-sm mt-1`}>Get started with your HRMS subscription today.</p>
                            </div>

                            <div className="p-8">
                                {signupError && (
                                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-5 text-xs font-bold">
                                        {signupError}
                                    </div>
                                )}
                                {signupSuccess && (
                                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 px-4 py-3 rounded-xl mb-5 text-xs font-bold flex items-center gap-2">
                                        <FaCheckCircle />
                                        {signupSuccess}
                                        <button onClick={() => navigate("/login")} className="ml-auto underline hover:text-emerald-700 transition-colors">
                                            Go to Login →
                                        </button>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Plan Selector */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <FaCrown className="text-amber-500 text-xs" />
                                            <span className="text-xs font-black uppercase tracking-widest text-amber-600">Choose Plan</span>
                                        </div>
                                        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                                            {plans
                                                .filter(p => p.planName.toLowerCase() !== "owner")
                                                .map(plan => (
                                                    <button
                                                        key={plan._id}
                                                        type="button"
                                                        onClick={() => setSelectedPlan(plan)}
                                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedPlan?._id === plan._id
                                                            ? 'border-blue-500 bg-blue-50'
                                                            : `${isDarkMode ? 'border-white/10 bg-white/5 hover:border-blue-400' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'}`
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={`font-bold capitalize text-sm ${text}`}>{plan.planName}</span>
                                                                    {selectedPlan?._id === plan._id && <FaCheckCircle className="text-blue-500 text-xs" />}
                                                                </div>
                                                                <p className={`text-xs mt-0.5 uppercase tracking-wide font-bold ${textMuted}`}>{plan.durationDays} days access</p>
                                                            </div>
                                                            <div className="text-blue-600 font-black text-lg">
                                                                {Number(plan.price) === 0 ? "Free" : `₹${plan.price}`}
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                        </div>
                                    </div>

                                    {/* Registration Form */}
                                    <div>
                                        <p className={`text-xs font-black uppercase tracking-widest ${textMuted} mb-4`}>Your Details</p>
                                        <form onSubmit={handleAdminRegister} className="space-y-3">
                                            <div>
                                                <label className={`text-xs font-bold uppercase tracking-wider ${textMuted} mb-1 block`}>Full Name</label>
                                                <input
                                                    type="text"
                                                    placeholder="John Smith"
                                                    pattern="^[A-Za-z\s]+$"
                                                    title="Only alphabets and spaces are allowed"
                                                    className={`w-full border px-4 py-2.5 rounded-xl outline-none text-sm transition-all ${inputBg} ${inputFocus} ${text} placeholder:text-gray-400`}
                                                    value={signupForm.name}
                                                    onChange={e => setSignupForm({ ...signupForm, name: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className={`text-xs font-bold uppercase tracking-wider ${textMuted} mb-1 block`}>Email Address</label>
                                                <input
                                                    type="email"
                                                    placeholder="example@gmail.com"
                                                    className={`w-full border px-4 py-2.5 rounded-xl outline-none text-sm transition-all ${inputBg} ${inputFocus} ${text} placeholder:text-gray-400`}
                                                    value={signupForm.email}
                                                    onChange={e => setSignupForm({ ...signupForm, email: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className={`text-xs font-bold uppercase tracking-wider ${textMuted} mb-1 block`}>Password</label>
                                                <div className="relative">
                                                    <input
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder="Min 8 characters"
                                                        pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$"
                                                        title="Must be 8+ chars with uppercase, lowercase, number & symbol"
                                                        className={`w-full border px-4 py-2.5 pr-10 rounded-xl outline-none text-sm transition-all ${inputBg} ${inputFocus} ${text} placeholder:text-gray-400`}
                                                        value={signupForm.password}
                                                        onChange={e => setSignupForm({ ...signupForm, password: e.target.value })}
                                                        required
                                                    />
                                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${textMuted}`}>
                                                        {showPassword ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.94 10.94 0 0112 19C7 19 2.73 16.11 1 12a11.05 11.05 0 012.29-3.57"/><path d="M9.9 4.24A10.94 10.94 0 0112 5c5 0 9.27 2.89 11 7a11.05 11.05 0 01-4.23 5.07"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className={`text-xs font-bold uppercase tracking-wider ${textMuted} mb-1 block`}>Phone</label>
                                                <input
                                                    placeholder="+91 98765 43210"
                                                    className={`w-full border px-4 py-2.5 rounded-xl outline-none text-sm transition-all ${inputBg} ${inputFocus} ${text} placeholder:text-gray-400`}
                                                    value={signupForm.phone}
                                                    onChange={e => setSignupForm({ ...signupForm, phone: e.target.value.replace(/[^0-9]/g, "") })}
                                                    pattern="[0-9]{10}"
                                                    maxLength={10}
                                                    required
                                                />
                                            </div>

                                            {selectedPlan && (
                                                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-xs uppercase tracking-widest text-blue-600 font-bold">Selected Plan</p>
                                                        <p className={`font-bold text-sm capitalize ${text}`}>{selectedPlan.planName}</p>
                                                    </div>
                                                    <div className="text-blue-600 font-black text-xl">
                                                        {Number(selectedPlan.price) === 0 ? "Free" : `₹${selectedPlan.price}`}
                                                    </div>
                                                </div>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={signupLoading || !selectedPlan || !!signupSuccess}
                                                className="w-full mt-1 btn-primary text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {signupLoading ? "Processing..." : !selectedPlan ? "← Select a Plan" : Number(selectedPlan.price) === 0 ? "Create Free Account" : `Pay ₹${selectedPlan.price} & Activate`}
                                            </button>

                                            <p className={`text-center text-xs ${textMuted} uppercase tracking-wider pt-1`}>
                                                {Number(selectedPlan?.price) > 0 ? "Secured by Razorpay · 100% Safe & Encrypted" : "No credit card required"}
                                            </p>
                                        </form>

                                        <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'} text-center`}>
                                            <p className={`${textSec} text-xs`}>
                                                Already have an account?{" "}
                                                <button onClick={() => navigate("/login")} className="text-blue-600 font-bold hover:text-blue-700">
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