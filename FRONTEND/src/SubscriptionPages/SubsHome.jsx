import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import api from "../api";
import API from "../api";
import { FaTimes, FaCheckCircle, FaCrown, FaFacebookF, FaTwitter, FaLinkedinIn, FaInstagram, FaYoutube, FaHeart, FaSun, FaMoon } from "react-icons/fa";

const DynamicHRMSLandingPage = () => {
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const [scrollProgress, setScrollProgress] = useState(0);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        return savedTheme ? savedTheme === 'dark' : true; // default to dark
    });

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
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
    };

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

    // Theme-based classes
    const themeClasses = {
        bg: isDarkMode ? 'bg-[#030712]' : 'bg-gradient-to-br from-gray-50 via-white to-blue-50',
        text: isDarkMode ? 'text-white' : 'text-gray-800',
        textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
        textMuted: isDarkMode ? 'text-gray-500' : 'text-gray-500',
        border: isDarkMode ? 'border-white/5' : 'border-gray-200',
        cardBg: isDarkMode ? 'bg-white/5' : 'bg-white',
        cardBorder: isDarkMode ? 'border-white/10' : 'border-gray-200',
        cardHover: isDarkMode ? 'hover:border-blue-500/30' : 'hover:border-blue-400',
        sectionBg: isDarkMode ? 'bg-[#080c14]' : 'bg-gray-50',
        sectionAltBg: isDarkMode ? 'bg-gradient-to-b from-[#080c14] to-[#030712]' : 'bg-gradient-to-b from-gray-50 to-white',
        navBg: isDarkMode ? 'bg-gray-950/80 backdrop-blur-md border-white/5' : 'bg-white/80 backdrop-blur-md border-blue-100',
        footerBg: isDarkMode ? 'bg-gradient-to-b from-[#030712] to-[#010409] border-white/5' : 'bg-gradient-to-b from-gray-50 to-white border-gray-200',
        inputBg: isDarkMode ? 'bg-white/5' : 'bg-white',
        inputBorder: isDarkMode ? 'border-white/10' : 'border-gray-300',
        inputFocus: isDarkMode ? 'focus:border-blue-500/60 focus:bg-white/10' : 'focus:border-blue-500 focus:bg-blue-50',
        modalBg: isDarkMode ? 'bg-[#0d1117] border-white/10' : 'bg-white border-gray-200',
        modalHeader: isDarkMode ? 'bg-gradient-to-r from-blue-600/20 to-cyan-600/10 border-white/10' : 'bg-gradient-to-r from-blue-50 to-cyan-50 border-gray-200',
    };

    return (
        <div className={`min-h-screen ${themeClasses.bg} ${themeClasses.text} selection:bg-blue-500/30 font-sans transition-colors duration-300`}>
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
            <nav className={`fixed w-full z-40 py-4 px-4 md:px-8 ${themeClasses.navBg}`}>
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <span className="text-lg md:text-xl font-bold tracking-tight"><span className="text-blue-400">vwsync</span></span>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex space-x-8 text-sm font-medium">
                        {['Features', 'Benefits', 'Pricing', 'Support'].map((item) => (
                            <a key={item} href={`#${item.toLowerCase()}`} className={`${themeClasses.textSecondary} hover:text-blue-400 transition-colors`}>
                                {item}
                            </a>
                        ))}
                    </div>

                    {/* Right side buttons */}
                    <div className="flex items-center space-x-2 md:space-x-4">
                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className={`p-2 rounded-lg ${isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}
                            aria-label="Toggle theme"
                        >
                            {isDarkMode ? <FaSun className="text-yellow-400" size={18} /> : <FaMoon className="text-gray-600" size={18} />}
                        </button>

                        {/* Mobile Menu Button (simplified - just shows theme toggle and get started) */}
                        <button onClick={() => navigate("/login")} className="px-4 md:px-6 py-2 rounded-full bg-blue-600 text-white text-xs md:text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30">
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 md:pt-40 pb-16 md:pb-20 px-4 md:px-8">
                <div className="container mx-auto grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
                    <div className="animate-content order-2 lg:order-1">
                        <div className="inline-block px-3 md:px-4 py-1.5 mb-6 rounded-full bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold tracking-widest uppercase">
                            New: AI Payroll Automation 2.0
                        </div>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-extrabold leading-[1.1] mb-6 md:mb-8">
                            Transforming HR<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700">Into seamless Digital experience</span>
                        </h1>
                        <p className={`text-base md:text-xl ${themeClasses.textSecondary} mb-8 md:mb-10 max-w-lg leading-relaxed`}>
                            This vwsync platform to manage your global workforce, automate payroll, and track performance without the spreadsheet chaos.
                        </p>
                        <div className="flex flex-wrap gap-4 md:gap-5">
                            <button onClick={() => navigate("/login")} className="px-6 md:px-8 py-3 md:py-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all transform hover:-translate-y-1 shadow-lg shadow-blue-600/30 text-sm md:text-base">
                                Sign In
                            </button>
                            <a href="#pricing">
                                <button className={`px-6 md:px-8 py-3 md:py-4 rounded-xl font-bold transition-all transform hover:-translate-y-1 text-sm md:text-base ${isDarkMode
                                    ? 'bg-white text-black hover:bg-blue-400 hover:text-white'
                                    : 'bg-white text-blue-600 hover:bg-blue-50 border-2 border-blue-600'
                                    }`}>
                                    View Pricing
                                </button>
                            </a>
                        </div>
                    </div>

                    <div className="relative animate-content order-1 lg:order-2" style={{ animationDelay: '0.2s' }}>
                        <div className="absolute -inset-4 bg-blue-500/10 rounded-[2.5rem] blur-3xl"></div>
                        <div className={`relative ${themeClasses.cardBg} rounded-2xl ${themeClasses.cardBorder} shadow-2xl overflow-hidden`}>
                            <div className={`flex items-center justify-between px-4 md:px-6 py-3 md:py-4 ${isDarkMode ? 'bg-white/5' : 'bg-blue-50'} ${themeClasses.border}`}>
                                <div className="flex space-x-2">
                                    <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-red-400"></div>
                                    <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-yellow-400"></div>
                                    <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-green-400"></div>
                                </div>
                                <div className={`text-[8px] md:text-[10px] ${themeClasses.textMuted} font-mono tracking-widest uppercase`}>Admin Dashboard</div>
                                <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}></div>
                            </div>
                            <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                                <div className="grid grid-cols-3 gap-2 md:gap-4">
                                    <div className={`${isDarkMode ? 'bg-white/5' : 'bg-gray-50'} p-2 md:p-4 rounded-xl ${themeClasses.cardBorder} text-center`}>
                                        <p className={`text-[10px] md:text-xs ${themeClasses.textMuted} mb-1`}>Staff</p>
                                        <p className={`text-sm md:text-xl font-bold ${themeClasses.text}`}>1,284</p>
                                    </div>
                                    <div className={`${isDarkMode ? 'bg-white/5' : 'bg-gray-50'} p-2 md:p-4 rounded-xl ${themeClasses.cardBorder} text-center`}>
                                        <p className={`text-[10px] md:text-xs ${themeClasses.textMuted} mb-1`}>Live</p>
                                        <p className="text-sm md:text-xl font-bold text-green-600">98%</p>
                                    </div>
                                    <div className={`${isDarkMode ? 'bg-white/5' : 'bg-gray-50'} p-2 md:p-4 rounded-xl ${themeClasses.cardBorder} text-center`}>
                                        <p className={`text-[10px] md:text-xs ${themeClasses.textMuted} mb-1`}>Tasks</p>
                                        <p className="text-sm md:text-xl font-bold text-yellow-600">12</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 md:gap-4">
                                    <div className={`${isDarkMode ? 'bg-white/5' : 'bg-gray-50'} p-2 md:p-4 rounded-xl ${themeClasses.cardBorder} ${themeClasses.cardHover} transition`}>
                                        <div className="text-blue-500 text-base md:text-lg mb-1 md:mb-2">👨‍💼</div>
                                        <h4 className={`text-xs md:text-sm font-semibold ${themeClasses.text} mb-0.5 md:mb-1`}>Employee Management</h4>
                                        <p className={`text-[8px] md:text-xs ${themeClasses.textSecondary}`}>Manage staff records, roles, and permissions.</p>
                                    </div>
                                    <div className={`${isDarkMode ? 'bg-white/5' : 'bg-gray-50'} p-2 md:p-4 rounded-xl ${themeClasses.cardBorder} ${themeClasses.cardHover} transition`}>
                                        <div className="text-green-500 text-base md:text-lg mb-1 md:mb-2">⏱️</div>
                                        <h4 className={`text-xs md:text-sm font-semibold ${themeClasses.text} mb-0.5 md:mb-1`}>Attendance Tracking</h4>
                                        <p className={`text-[8px] md:text-xs ${themeClasses.textSecondary}`}>Monitor daily attendance with real-time updates.</p>
                                    </div>
                                    <div className={`${isDarkMode ? 'bg-white/5' : 'bg-gray-50'} p-2 md:p-4 rounded-xl ${themeClasses.cardBorder} ${themeClasses.cardHover} transition`}>
                                        <div className="text-yellow-500 text-base md:text-lg mb-1 md:mb-2">📧</div>
                                        <h4 className={`text-xs md:text-sm font-semibold ${themeClasses.text} mb-0.5 md:mb-1`}>Email Notifications</h4>
                                        <p className={`text-[8px] md:text-xs ${themeClasses.textSecondary}`}>Automated alerts for punch-in, leave, approvals.</p>
                                    </div>
                                    <div className={`${isDarkMode ? 'bg-white/5' : 'bg-gray-50'} p-2 md:p-4 rounded-xl ${themeClasses.cardBorder} ${themeClasses.cardHover} transition`}>
                                        <div className="text-purple-500 text-base md:text-lg mb-1 md:mb-2">📊</div>
                                        <h4 className={`text-xs md:text-sm font-semibold ${themeClasses.text} mb-0.5 md:mb-1`}>Analytics Dashboard</h4>
                                        <p className={`text-[8px] md:text-xs ${themeClasses.textSecondary}`}>Visual insights on performance and productivity.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className={`py-16 md:py-24 px-4 md:px-8 ${themeClasses.sectionBg}`}>
                <div className="container mx-auto text-center">
                    <h2 className={`text-2xl md:text-3xl lg:text-4xl font-bold mb-12 md:mb-16 ${themeClasses.text}`}>
                        Enterprise-Grade <span className="text-blue-600">Features</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
                        {[
                          
                                                        { icon: '👥', title: 'Employee Management', desc: 'Manage employee profiles, roles, and organizational structure efficiently.', color: 'indigo' },
                            { icon: '⏰', title: 'Attendance Management', desc: 'Biometric integration and real-time attendance tracking.', color: 'yellow' },
                            { icon: '📊', title: 'Performance Management', desc: 'Goal tracking, reviews, and performance analytics dashboard.', color: 'purple' },
  { icon: '🗄️', title: 'Database Management', desc: 'Secure employee data storage with real-time sync and backup.', color: 'blue' },
                            { icon: '📅', title: 'Leave Management', desc: 'Apply, approve, and track employee leaves with automated workflows.', color: 'red' },
                            { icon: '🔐', title: 'Access Control', desc: 'Role-based access to ensure data security and proper authorization.', color: 'pink' },
                                                        { icon: '💰', title: 'Payroll Management', desc: 'Automated salary processing with tax compliance and reports.', color: 'green' },        
                            { icon: '📈', title: 'Reports & Analytics', desc: 'Generate detailed reports and insights for better decision making.', color: 'teal' }
                        ].map((feature, i) => (
                            <div key={i} className={`${themeClasses.cardBg} p-4 md:p-6 rounded-2xl ${themeClasses.cardBorder} ${themeClasses.cardHover} transition-all group shadow-sm`}>
                                <div className={`text-2xl md:text-4xl mb-2 md:mb-4 group-hover:scale-110 transition-transform text-${feature.color}-600`}>
                                    {feature.icon}
                                </div>
                                <h3 className={`font-bold mb-1 md:mb-2 text-sm md:text-base ${themeClasses.text}`}>{feature.title}</h3>
                                <p className={`text-[10px] md:text-xs ${themeClasses.textSecondary} leading-relaxed`}>{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section id="benefits" className={`py-16 md:py-24 px-4 md:px-8 ${themeClasses.sectionAltBg}`}>
                <div className="container mx-auto">
                    <div className="text-center mb-12 md:mb-16">
                        <h2 className={`text-2xl md:text-3xl lg:text-4xl font-bold mb-2 md:mb-4 ${themeClasses.text}`}>
                            Why Choose <span className="text-blue-600">vwsync</span>
                        </h2>
                        <p className={`${themeClasses.textSecondary} max-w-2xl mx-auto text-sm md:text-base`}>
                            Discover the advantages that make us the preferred choice for modern businesses
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8 max-w-5xl mx-auto">
                        {[
                            {
                                icon: '⚡',
                                title: '70% Time Saved',
                                desc: 'Automate repetitive HR tasks and reduce manual work by up to 70%.',
                                color: 'yellow'
                            },
                            {
                                icon: '🔒',
                                title: 'Enterprise Security',
                                desc: 'Bank-level encryption and compliance with global data protection regulations.',
                                color: 'blue'
                            },
                            {
                                icon: '📈',
                                title: 'Scalability',
                                desc: 'From 10 to 10,000+ employees - our platform grows with your business.',
                                color: 'green'
                            },
                            {
                                icon: '💡',
                                title: '24/7 AI Support',
                                desc: 'Intelligent chatbots and human experts available round-the-clock.',
                                color: 'purple'
                            },
                            {
                                icon: '🌐',
                                title: 'Global Compliance',
                                desc: 'Stay compliant with local labor laws across 50+ countries.',
                                color: 'cyan'
                            },
                            {
                                icon: '🎯',
                                title: '99.9% Uptime',
                                desc: 'Reliable infrastructure with guaranteed 99.9% uptime.',
                                color: 'red'
                            }
                        ].map((benefit, i) => (
                            <div key={i} className={`group relative ${themeClasses.cardBg} p-4 md:p-6 lg:p-8 rounded-2xl ${themeClasses.cardBorder} ${themeClasses.cardHover} transition-all hover:transform hover:-translate-y-2 duration-300 shadow-sm`}>
                                <div className={`absolute -top-3 -right-3 w-8 h-8 md:w-12 md:h-12 bg-${benefit.color}-100 rounded-full blur-xl group-hover:bg-${benefit.color}-200 transition-all`}></div>
                                <div className={`text-2xl md:text-4xl mb-2 md:mb-4 group-hover:scale-110 transition-transform text-${benefit.color}-600`}>
                                    {benefit.icon}
                                </div>
                                <h3 className={`text-base md:text-lg lg:text-xl font-bold mb-2 md:mb-3 ${themeClasses.text}`}>{benefit.title}</h3>
                                <p className={`text-xs md:text-sm ${themeClasses.textSecondary} leading-relaxed`}>{benefit.desc}</p>
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 scale-x-0 group-hover:scale-x-100 transition-transform rounded-b-2xl"></div>
                            </div>
                        ))}
                    </div>

                    {/* Stats Section */}
                    <div className="mt-16 md:mt-20 grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-8 max-w-4xl mx-auto">
                        {[
                            { value: '10K+', label: 'Active Users', color: 'blue' },
                            { value: '50+', label: 'Countries', color: 'green' },
                            { value: '99.9%', label: 'Uptime SLA', color: 'purple' },
                            { value: '24/7', label: 'Support', color: 'cyan' }
                        ].map((stat, i) => (
                            <div key={i} className="text-center">
                                <div className={`text-xl md:text-2xl lg:text-3xl font-black text-${stat.color}-600 mb-1 md:mb-2`}>{stat.value}</div>
                                <div className={`text-[8px] md:text-xs ${themeClasses.textMuted} uppercase tracking-widest`}>{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className={`py-16 md:py-24 px-4 md:px-8 ${themeClasses.sectionAltBg}`}>
                <div className="container mx-auto">
                    <div className="text-center mb-12 md:mb-16">
                        <h2 className={`text-2xl md:text-3xl lg:text-4xl font-bold mb-2 md:mb-4 ${themeClasses.text}`}>
                            Simple, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">Transparent Pricing</span>
                        </h2>
                        <p className={`${themeClasses.textSecondary} max-w-2xl mx-auto text-sm md:text-base`}>
                            Plans tailored for your growth. No hidden fees.
                        </p>
                    </div>

                    {plansLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <div className="animate-spin rounded-full h-8 w-8 md:h-10 md:w-10 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <div className={`grid gap-4 md:gap-6 lg:gap-8 max-w-6xl mx-auto ${plans.length === 1 ? 'grid-cols-1 max-w-md' :
                            plans.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-3xl' :
                                'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                            }`}>
                            {plans.map((plan, index) => {
                                return (
                                    <div
                                        key={plan._id || index}
                                        className={`relative ${themeClasses.cardBg} p-4 md:p-6 lg:p-8 rounded-2xl md:rounded-3xl ${themeClasses.cardBorder} ${themeClasses.cardHover} transition-all flex flex-col group shadow-lg`}
                                    >
                                        <h3 className={`text-lg md:text-xl lg:text-2xl font-bold mb-1 md:mb-2 capitalize tracking-tight ${themeClasses.text}`}>
                                            {plan.planName}
                                        </h3>
                                        <p className={`${themeClasses.textMuted} text-[10px] md:text-xs mb-4 md:mb-6 font-bold uppercase tracking-widest`}>
                                            Valid for {plan.durationDays} days
                                        </p>

                                        <div className="mb-4 md:mb-6 lg:mb-8 flex items-baseline gap-1">
                                            <span className={`text-2xl md:text-3xl lg:text-5xl font-black tracking-tighter ${themeClasses.text}`}>
                                                {Number(plan.price) === 0 ? "Free" : `₹${plan.price}`}
                                            </span>
                                            {Number(plan.price) > 0 && (
                                                <span className={`${themeClasses.textMuted} text-xs md:text-sm font-bold`}>/period</span>
                                            )}
                                        </div>

                                        <ul className="space-y-2 md:space-y-3 lg:space-y-4 mb-6 md:mb-8 lg:mb-10 flex-grow">
                                            {plan.features && plan.features.length > 0 ? (
                                                plan.features.map((feature, fIdx) => (
                                                    <li key={fIdx} className="flex items-start text-xs md:text-sm group">
                                                        <span className="text-blue-600 mr-2 md:mr-3 font-bold text-sm md:text-lg leading-none">✓</span>
                                                        <span className={`${themeClasses.textSecondary} group-hover:${themeClasses.text} transition-colors`}>
                                                            {featureLabels[feature] || feature}
                                                        </span>
                                                    </li>
                                                ))
                                            ) : (
                                                <>
                                                    <li className="flex items-center text-xs md:text-sm ${themeClasses.textSecondary}">
                                                        <span className="text-blue-400 mr-2 md:mr-3">✓</span> Core Access
                                                    </li>
                                                    <li className="flex items-center text-xs md:text-sm ${themeClasses.textSecondary}">
                                                        <span className="text-blue-400 mr-2 md:mr-3">✓</span> Secure Login
                                                    </li>
                                                </>
                                            )}
                                        </ul>

                                        <button
                                            onClick={() => handlePlanClick(plan)}
                                            className={`w-full py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs md:text-xs uppercase tracking-widest transition-all shadow-sm ${isDarkMode
                                                ? 'border border-white/10 hover:bg-white/10 text-white'
                                                : 'border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white'
                                                }`}
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

            {/* Support Section */}
            <section id="support" className={`py-16 md:py-24 px-4 md:px-8 ${themeClasses.sectionBg}`}>
                <div className="container mx-auto">
                    <div className="text-center mb-12 md:mb-16">
                        <h2 className={`text-2xl md:text-3xl lg:text-4xl font-bold mb-2 md:mb-4 ${themeClasses.text}`}>
                            We're Here to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">Help You</span>
                        </h2>
                        <p className={`${themeClasses.textSecondary} max-w-2xl mx-auto text-sm md:text-base`}>
                            Get the support you need, when you need it most
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8 max-w-5xl mx-auto">
                        {/* WhatsApp Support */}
                        <div className={`group relative ${themeClasses.cardBg} p-4 md:p-6 lg:p-8 rounded-2xl ${themeClasses.cardBorder} hover:border-blue-400 transition-all hover:transform hover:-translate-y-2 duration-300 shadow-sm`}>
                            <h3 className={`text-base md:text-lg lg:text-xl font-bold mb-2 md:mb-3 ${themeClasses.text}`}>WhatsApp Support</h3>
                            <p className={`text-xs md:text-sm ${themeClasses.textSecondary} mb-3 md:mb-4`}>
                                Get instant answers from our support team, available 24/7.
                            </p>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] md:text-xs text-blue-600 font-bold">Send Whatsapp Message</span>
                                <a
                                    href="https://wa.me/918919801095?text=Hi%2C%20I%E2%80%99d%20like%20more%20information%20about%20your%20HRMS%20product.%20Please%20share%20the%20details."
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Start Chat →
                                </a>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 scale-x-0 group-hover:scale-x-100 transition-transform rounded-b-2xl"></div>
                        </div>

                        {/* Email Support */}
                        <div className={`group relative ${themeClasses.cardBg} p-4 md:p-6 lg:p-8 rounded-2xl ${themeClasses.cardBorder} hover:border-green-400 transition-all hover:transform hover:-translate-y-2 duration-300 shadow-sm`}>
                            <h3 className={`text-base md:text-lg lg:text-xl font-bold mb-2 md:mb-3 ${themeClasses.text}`}>Email Support</h3>
                            <p className={`text-xs md:text-sm ${themeClasses.textSecondary} mb-3 md:mb-4`}>
                                Send us your queries and get detailed responses within hours.
                            </p>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] md:text-xs text-green-600 font-bold break-all">ops@arahinfotech.net</span>
                                <a
                                    href="https://mail.google.com/mail/?view=cm&fs=1&to=ops@arahinfotech.net&su=HRMS%20Enquiry&body=Hi%2C%20I%E2%80%99d%20like%20more%20information%20about%20your%20HRMS%20product.%20Please%20share%20the%20details."
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`text-[10px] md:text-xs ${themeClasses.textSecondary} hover:text-green-600 transition-colors font-bold`}
                                >
                                    Send Email →
                                </a>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-500 scale-x-0 group-hover:scale-x-100 transition-transform rounded-b-2xl"></div>
                        </div>

                        {/* Phone Support */}
                        <div className={`group relative ${themeClasses.cardBg} p-4 md:p-6 lg:p-8 rounded-2xl ${themeClasses.cardBorder} hover:border-purple-400 transition-all hover:transform hover:-translate-y-2 duration-300 shadow-sm`}>
                            <h3 className={`text-base md:text-lg lg:text-xl font-bold mb-2 md:mb-3 ${themeClasses.text}`}>Phone Support</h3>
                            <p className={`text-xs md:text-sm ${themeClasses.textSecondary} mb-3 md:mb-4`}>
                                Speak directly with our support specialists for urgent issues.
                            </p>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] md:text-xs text-purple-600 font-bold">8919801095</span>
                                <a
                                    href="tel:8919801095"
                                    className={`text-[10px] md:text-xs ${themeClasses.textSecondary} hover:text-purple-600 transition-colors font-bold`}
                                >
                                    Call Now →
                                </a>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 scale-x-0 group-hover:scale-x-100 transition-transform rounded-b-2xl"></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className={`relative pt-16 md:pt-20 pb-6 md:pb-10 px-4 md:px-8 ${themeClasses.footerBg} overflow-hidden`}>
                {/* Background decorative elements */}
                <div className={`absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent`}></div>
                <div className={`absolute -top-40 -left-40 w-60 md:w-80 h-60 md:h-80 ${isDarkMode ? 'bg-blue-500/5' : 'bg-blue-200'} rounded-full blur-[100px] ${isDarkMode ? '' : 'opacity-30'}`}></div>
                <div className={`absolute -bottom-40 -right-40 w-60 md:w-80 h-60 md:h-80 ${isDarkMode ? 'bg-cyan-500/5' : 'bg-cyan-200'} rounded-full blur-[100px] ${isDarkMode ? '' : 'opacity-30'}`}></div>

                <div className="container mx-auto relative z-10">
                    {/* Main Footer Content */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 md:gap-8 mb-12 md:mb-16">
                        {/* Brand Column */}
                        <div className="lg:col-span-2">
                            <div className="flex items-center space-x-2 mb-4 md:mb-6">
                     
                                <span className={`text-lg md:text-xl lg:text-2xl font-bold tracking-tight bg-gradient-to-r ${isDarkMode ? 'from-white to-gray-300' : 'from-gray-800 to-gray-600'} bg-clip-text text-transparent`}>
                                    <span className="text-blue-600">vwsync</span>
                                </span>
                            </div>
                            <p className={`${themeClasses.textMuted} text-xs md:text-sm leading-relaxed mb-4 md:mb-6 max-w-md`}>
                                Transforming human resource management into seamless digital experiences. Trusted by over 10,000+ companies worldwide.
                            </p>

                            {/* Social Links */}
                            <div className="flex space-x-2 md:space-x-4">
                                {[
                                    { icon: FaFacebookF, color: 'hover:text-blue-600', href: '#' },
                                    { icon: FaTwitter, color: 'hover:text-blue-400', href: '#' },
                                    { icon: FaLinkedinIn, color: 'hover:text-blue-500', href: '#' },
                                    { icon: FaInstagram, color: 'hover:text-pink-500', href: '#' },
                                    { icon: FaYoutube, color: 'hover:text-red-500', href: '#' }
                                ].map((social, i) => (
                                    <a
                                        key={i}
                                        href={social.href}
                                        className={`w-8 h-8 md:w-10 md:h-10 rounded-full ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'} flex items-center justify-center ${themeClasses.textSecondary} hover:text-blue-600 transition-all hover:scale-110`}
                                    >
                                        <social.icon size={14} />
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* Product Links */}
                        <div>
                            <h4 className={`${themeClasses.text} font-bold text-xs md:text-sm mb-3 md:mb-4 uppercase tracking-wider`}>Product</h4>
                            <ul className="space-y-2 md:space-y-3">
                                {['Features', 'Pricing', 'Integrations', 'API', 'Changelog'].map((item) => (
                                    <li key={item}>
                                        <a href={`#${item.toLowerCase()}`} className={`${themeClasses.textMuted} hover:text-blue-600 text-xs md:text-sm transition-colors`}>
                                            {item}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Company Links */}
                        <div>
                            <h4 className={`${themeClasses.text} font-bold text-xs md:text-sm mb-3 md:mb-4 uppercase tracking-wider`}>Company</h4>
                            <ul className="space-y-2 md:space-y-3">
                                {['About', 'Blog', 'Careers', 'Press', 'Partners'].map((item) => (
                                    <li key={item}>
                                        <a href="#" className={`${themeClasses.textMuted} hover:text-blue-600 text-xs md:text-sm transition-colors`}>
                                            {item}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Resources Links */}
                        <div>
                            <h4 className={`${themeClasses.text} font-bold text-xs md:text-sm mb-3 md:mb-4 uppercase tracking-wider`}>Resources</h4>
                            <ul className="space-y-2 md:space-y-3">
                                {['Documentation', 'Guides', 'Support', 'Status', 'Security'].map((item) => (
                                    <li key={item}>
                                        <a href={`#${item.toLowerCase() === 'support' ? 'support' : '#'}`} className={`${themeClasses.textMuted} hover:text-blue-600 text-xs md:text-sm transition-colors`}>
                                            {item}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>



                    {/* Bottom Bar */}
                    <div className={`mt-6 md:mt-8 pt-6 md:pt-8 border-t ${themeClasses.border} flex flex-col md:flex-row justify-between items-center text-[8px] md:text-xs ${themeClasses.textMuted}`}>
                        <div className="flex flex-wrap items-center justify-center gap-2 mb-2 md:mb-0">
                            <span>© 2026 vwsync. All rights reserved.</span>
                            <span className={isDarkMode ? 'text-gray-700' : 'text-gray-300'}>|</span>
                            <a href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</a>
                            <span className={isDarkMode ? 'text-gray-700' : 'text-gray-300'}>|</span>
                            <a href="#" className="hover:text-blue-600 transition-colors">Terms of Service</a>
                            <span className={isDarkMode ? 'text-gray-700' : 'text-gray-300'}>|</span>
                            <a href="#" className="hover:text-blue-600 transition-colors">Cookie Policy</a>
                        </div>
                        <div className="flex items-center space-x-1">
                            <span>Made with</span>
                            <FaHeart className="text-red-500 mx-1" size={10} />
                            <span>by vwsync Team</span>
                        </div>
                    </div>
                </div>
            </footer>

            {/* ==================== REGISTER ADMIN MODAL ==================== */}
            {showRegisterModal && (
                <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
                    {/* Decorative blobs */}
                    <div className={`absolute top-0 left-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] ${isDarkMode ? 'bg-blue-900/10' : 'bg-blue-200'} rounded-full blur-[100px] md:blur-[150px] ${isDarkMode ? '' : 'opacity-30'} pointer-events-none`}></div>
                    <div className={`absolute bottom-0 right-0 w-[250px] md:w-[400px] h-[250px] md:h-[400px] ${isDarkMode ? 'bg-cyan-900/10' : 'bg-cyan-200'} rounded-full blur-[100px] md:blur-[150px] ${isDarkMode ? '' : 'opacity-30'} pointer-events-none`}></div>

                    <div className="modal-animate relative w-full max-w-lg md:max-w-2xl max-h-[95vh] overflow-y-auto">
                        <div className={`${themeClasses.modalBg} rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden`}>

                            {/* Modal Header */}
                            <div className={`relative ${themeClasses.modalHeader} px-4 md:px-8 pt-6 md:pt-8 pb-4 md:pb-6`}>
                                <button
                                    onClick={handleCloseModal}
                                    className={`absolute top-3 md:top-6 right-3 md:right-6 w-7 h-7 md:w-9 md:h-9 flex items-center justify-center rounded-full ${isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'} ${themeClasses.textSecondary} hover:${themeClasses.text} transition-all`}
                                >
                                    <FaTimes size={12} />
                                </button>
                                <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                                    <div className="w-6 h-6 md:w-8 md:h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xs md:text-sm text-white shadow-lg shadow-blue-500/30">H</div>
                                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.25em] text-blue-600">Admin Registration</span>
                                </div>
                                <h2 className={`text-lg md:text-2xl font-extrabold ${themeClasses.text}`}>Create Your Account</h2>
                                <p className={`${themeClasses.textSecondary} text-xs md:text-sm mt-0.5 md:mt-1`}>Get started with your HRMS subscription today.</p>
                            </div>

                            <div className="p-4 md:p-8">
                                {/* Error / Success */}
                                {signupError && (
                                    <div className="bg-red-50 border border-red-200 text-red-600 px-3 md:px-4 py-2 md:py-3 rounded-xl md:rounded-2xl mb-4 md:mb-6 text-[10px] md:text-xs font-bold">
                                        {signupError}
                                    </div>
                                )}
                                {signupSuccess && (
                                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 px-3 md:px-4 py-2 md:py-3 rounded-xl md:rounded-2xl mb-4 md:mb-6 text-[10px] md:text-xs font-bold flex items-center gap-2">
                                        <FaCheckCircle />
                                        {signupSuccess}
                                        <button onClick={() => navigate("/login")} className="ml-auto underline underline-offset-2 hover:text-emerald-700 transition-colors">
                                            Go to Login →
                                        </button>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">

                                    {/* LEFT: Plan Selector */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2 md:mb-4">
                                            <FaCrown className="text-amber-500 text-xs" />
                                            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Choose Plan</span>
                                        </div>
                                        <div className="space-y-2 md:space-y-3 max-h-60 md:max-h-none overflow-y-auto">
                                            {plans.map((plan) => (
                                                <button
                                                    key={plan._id}
                                                    type="button"
                                                    onClick={() => setSelectedPlan(plan)}
                                                    className={`w-full text-left p-2 md:p-4 rounded-xl md:rounded-2xl border-2 transition-all ${selectedPlan?._id === plan._id
                                                        ? 'border-blue-500 bg-blue-50'
                                                        : `${isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'} hover:border-blue-300 hover:bg-blue-50`
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1 md:gap-2">
                                                                <span className={`${themeClasses.text} font-bold capitalize text-xs md:text-sm`}>{plan.planName}</span>
                                                                {selectedPlan?._id === plan._id && (
                                                                    <FaCheckCircle className="text-blue-500 text-[8px] md:text-xs flex-shrink-0" />
                                                                )}
                                                            </div>
                                                            <p className={`${themeClasses.textMuted} text-[8px] md:text-[10px] mt-0.5 uppercase tracking-wide font-bold`}>
                                                                {plan.durationDays} days access
                                                            </p>
                                                        </div>
                                                        <div className="text-right flex-shrink-0 ml-1 md:ml-3">
                                                            <div className="text-blue-600 font-black text-sm md:text-lg">
                                                                {Number(plan.price) === 0 ? "Free" : `₹${plan.price}`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Features preview */}
                                                    {plan.features && plan.features.length > 0 && (
                                                        <div className="mt-1 md:mt-2 pt-1 md:pt-2 border-t border-gray-200 space-y-0.5">
                                                            {plan.features.slice(0, 2).map((f, i) => (
                                                                <p key={i} className={`${themeClasses.textMuted} text-[8px] md:text-[10px] flex items-center gap-1`}>
                                                                    <span className="text-blue-500">✓</span> {f.length > 20 ? f.substring(0, 20) + '...' : f}
                                                                </p>
                                                            ))}
                                                            {plan.features.length > 2 && (
                                                                <p className={`${themeClasses.textMuted} text-[8px] md:text-[10px]`}>+{plan.features.length - 2} more</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* RIGHT: Registration Form */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2 md:mb-4">
                                            <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] ${themeClasses.textMuted}`}>Your Details</span>
                                        </div>

                                        <form onSubmit={handleAdminRegister} className="space-y-2 md:space-y-3">
                                            <div>
                                                <label className={`text-[8px] md:text-[10px] font-bold uppercase tracking-wider ${themeClasses.textMuted} ml-1 mb-0.5 md:mb-1 block`}>Full Name</label>
                                                <input
                                                    type="text"
                                                    placeholder="John Smith"
                                                    pattern="^[A-Za-z\s]+$"
                                                    title="Only alphabets and spaces are allowed"
                                                    className={`w-full ${themeClasses.inputBg} ${themeClasses.inputBorder} ${themeClasses.text} placeholder-gray-400 px-3 md:px-4 py-2 md:py-3 rounded-xl outline-none ${themeClasses.inputFocus} transition-all text-xs md:text-sm`}
                                                    value={signupForm.name}
                                                    onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className={`text-[8px] md:text-[10px] font-bold uppercase tracking-wider ${themeClasses.textMuted} ml-1 mb-0.5 md:mb-1 block`}>Email Address</label>
                                                <input
                                                    type="email"
                                                    placeholder="example@gmail.com"
                                                    className={`w-full ${themeClasses.inputBg} ${themeClasses.inputBorder} ${themeClasses.text} placeholder-gray-400 px-3 md:px-4 py-2 md:py-3 rounded-xl outline-none ${themeClasses.inputFocus} transition-all text-xs md:text-sm`}
                                                    value={signupForm.email}
                                                    onChange={(e) =>
                                                        setSignupForm({ ...signupForm, email: e.target.value })
                                                    }
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className={`text-[8px] md:text-[10px] font-bold uppercase tracking-wider ${themeClasses.textMuted} ml-1 mb-0.5 md:mb-1 block`}>Password</label>
                                                <div className="relative">
                                                    <input
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder="Min 8 characters"
                                                        pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$"
                                                        title="Password must be at least 8 characters and include uppercase, lowercase, number and symbol"
                                                        className={`w-full ${themeClasses.inputBg} ${themeClasses.inputBorder} ${themeClasses.text} placeholder-gray-400 px-3 md:px-4 py-2 md:py-3 pr-8 md:pr-12 rounded-xl outline-none ${themeClasses.inputFocus} transition-all text-xs md:text-sm`}
                                                        value={signupForm.password}
                                                        onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className={`absolute right-2 md:right-4 top-1/2 -translate-y-1/2 ${themeClasses.textMuted} hover:${themeClasses.text}`}
                                                    >
                                                        {showPassword ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                                <path d="M17.94 17.94A10.94 10.94 0 0112 19C7 19 2.73 16.11 1 12a11.05 11.05 0 012.29-3.57" />
                                                                <path d="M9.9 4.24A10.94 10.94 0 0112 5c5 0 9.27 2.89 11 7a11.05 11.05 0 01-4.23 5.07" />
                                                                <line x1="1" y1="1" x2="23" y2="23" />
                                                            </svg>
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                                                                <circle cx="12" cy="12" r="3" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className={`text-[8px] md:text-[10px] font-bold uppercase tracking-wider ${themeClasses.textMuted} ml-1 mb-0.5 md:mb-1 block`}>Phone</label>
                                                <input
                                                    placeholder="+91 98765 43210"
                                                    className={`w-full ${themeClasses.inputBg} ${themeClasses.inputBorder} ${themeClasses.text} placeholder-gray-400 px-3 md:px-4 py-2 md:py-3 rounded-xl outline-none ${themeClasses.inputFocus} transition-all text-xs md:text-sm`}
                                                    value={signupForm.phone}
                                                    onChange={(e) => {
                                                        // Allow only numbers
                                                        const value = e.target.value.replace(/[^0-9]/g, "");
                                                        setSignupForm({ ...signupForm, phone: value });
                                                    }}
                                                    pattern="[0-9]{10}"
                                                    maxLength={10}
                                                    required
                                                />
                                            </div>

                                            {/* Selected plan summary */}
                                            {selectedPlan && (
                                                <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 md:px-4 py-2 md:py-3 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[8px] md:text-[10px] uppercase tracking-widest text-blue-600 font-bold">Selected Plan</p>
                                                        <p className={`${themeClasses.text} font-bold text-xs md:text-sm capitalize`}>{selectedPlan.planName}</p>
                                                    </div>
                                                    <div className="text-blue-600 font-black text-base md:text-xl">
                                                        {Number(selectedPlan.price) === 0 ? "Free" : `₹${selectedPlan.price}`}
                                                    </div>
                                                </div>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={signupLoading || !selectedPlan || !!signupSuccess}
                                                className="w-full mt-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {signupLoading
                                                    ? "Processing..."
                                                    : !selectedPlan
                                                        ? "← Select a Plan"
                                                        : Number(selectedPlan.price) === 0
                                                            ? "Create Free Account"
                                                            : `Pay ₹${selectedPlan.price} & Activate`}
                                            </button>

                                            <p className={`text-center text-[8px] md:text-[10px] ${themeClasses.textMuted} uppercase tracking-wider pt-0.5 md:pt-1`}>
                                                {Number(selectedPlan?.price) > 0 ? "Secured by Stripe · No free trials" : "No credit card required"}
                                            </p>
                                        </form>

                                        <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-200 text-center">
                                            <p className={`${themeClasses.textMuted} text-[10px] md:text-xs`}>
                                                Already have an account?{" "}
                                                <button onClick={() => navigate("/login")} className="text-blue-600 font-bold hover:text-blue-700 transition-colors">
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