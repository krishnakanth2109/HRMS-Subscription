import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from "react-router-dom";

import api from "../api";
import API from "../api";
import { FaTimes, FaCheckCircle, FaCrown, FaFacebookF, FaTwitter, FaLinkedinIn, FaInstagram, FaYoutube, FaHeart, FaChevronDown, FaWhatsapp, FaEnvelope, FaPhone } from "react-icons/fa";
import { Sun, SunMoon, Users, Clock, Database, BarChart3, Lock, Coins, Calendar, TrendingUp, Zap, Shield, Globe, Cpu, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DotField } from "@/components/DotField";

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


const AnimateIcon = ({ children, animateOnHover }) => {
    if (!animateOnHover) return children;
    return (
        <motion.div
            whileHover={{ scale: 1.18, rotate: 15 }}
            transition={{ type: "spring", stiffness: 400, damping: 12 }}
            className="flex items-center justify-center"
        >
            {children}
        </motion.div>
    );
};

const getBillingCycleMultiplier = (plan) => {
    if (!plan) return 1;
    const cycle = plan.billingCycle;
    if (cycle === "monthly") return 1;
    if (cycle === "quarterly") return 3;
    if (cycle === "halfYearly") return 6;
    if (cycle === "yearly") return 12;

    const days = Number(plan.durationDays);
    if (days >= 360) return 12;
    if (days >= 180) return 6;
    if (days >= 90) return 3;

    const name = (plan.planName || "").toLowerCase();
    if (name.includes("quarterly") || name.includes("quarter")) return 3;
    if (name.includes("half") || name.includes("semi")) return 6;
    if (name.includes("annual") || name.includes("yearly") || name.includes("year")) return 12;

    return 1;
};

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

const FEATURES_DATA = [
    {
        title: "Employee Management",
        icon: Users,
        desc: "Manage employee profiles, roles, and organizational structure efficiently with automated hierarchy mapping.",
        image: IMAGES.employeeManagement,
        badge: "Hierarchy · 3 Levels Active",
        badgeClass: "bg-white/95 text-gray-800 text-[10px] font-bold px-3 py-1.5 rounded-lg shadow",
        iconClass: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
        animClass: "group-hover-animate-float",
        showIndicator: true,
    },
    {
        title: "Attendance Tracking",
        icon: Clock,
        desc: "Biometric integration and real-time attendance tracking for hybrid workforces.",
        image: IMAGES.attendance,
        badge: "Live ●",
        badgeClass: "bg-cyan-600 text-white text-[9px] font-extrabold tracking-wider uppercase px-2.5 py-1 rounded shadow-md",
        iconClass: "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10",
        animClass: "group-hover-animate-pulse-glow",
    },
    {
        title: "Database Management",
        icon: Database,
        desc: "Secure employee data storage with real-time sync and encrypted cloud backup.",
        image: IMAGES.database,
        badge: "256-bit Encrypted",
        badgeClass: "bg-white/95 text-gray-800 text-[10px] font-bold px-2.5 py-1 rounded shadow",
        iconClass: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10",
        animClass: "group-hover-animate-pulse-glow",
    },
    {
        title: "Performance Management",
        icon: BarChart3,
        desc: "Goal tracking, peer reviews, and automated performance analytics dashboards.",
        image: IMAGES.performance,
        iconClass: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10",
        animClass: "group-hover-animate-float",
        showProgress: true,
    },
    {
        title: "Access Control",
        icon: Lock,
        desc: "Role-based access to ensure data security and proper authorization across teams.",
        image: IMAGES.accessControl,
        badge: "Secured ✓",
        badgeClass: "bg-green-500 text-white text-[9px] font-extrabold tracking-wider uppercase px-2.5 py-1 rounded shadow-md",
        iconClass: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10",
        animClass: "group-hover-animate-swing",
    },
    {
        title: "Payroll Management",
        icon: Coins,
        desc: "Automated salary processing with tax compliance and detailed digital paystubs.",
        image: IMAGES.payroll,
        badge: "₹ Auto-Processed",
        subBadge: "Last run: Today",
        badgeClass: "bg-white/95 text-gray-800 text-[10px] font-black px-3 py-1.5 rounded-lg shadow",
        iconClass: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
        animClass: "group-hover-animate-swing",
        showPayrollBadges: true,
    },
    {
        title: "Leave Management",
        icon: Calendar,
        desc: "Apply, approve, and track employee leaves with automated workflows and balance sync.",
        image: IMAGES.leaveManagement,
        badge: "📅 Leaves Synced",
        badgeClass: "bg-white/95 text-gray-700 text-[10px] font-bold px-2.5 py-1 rounded shadow",
        iconClass: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10",
        animClass: "group-hover-animate-float",
    },
    {
        title: "Reports & Analytics",
        icon: TrendingUp,
        desc: "Generate detailed reports and insights for better decision making. Predictive modeling for churn and growth forecasting.",
        image: IMAGES.analytics,
        badge: "+24% Growth",
        subBadge: "This Quarter ↑",
        badgeClass: "bg-white/95 text-gray-800 text-[10px] font-black px-4 py-2 rounded-xl shadow-lg",
        iconClass: "text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-500/10",
        animClass: "group-hover-animate-pulse-glow",
    }
];

const BENEFITS_DATA = [
    {
        title: "70% Time Saved",
        icon: Zap,
        desc: "Automate repetitive HR tasks and reduce manual work significantly. Free your team to focus on strategic initiatives.",
        image: IMAGES.automation,
        badge: "🚀 Automation Engine Active",
        badgeClass: "text-white text-[10px] font-bold mt-2 opacity-90 tracking-widest uppercase",
        iconClass: "text-white bg-blue-650",
        animClass: "group-hover-animate-pulse-glow",
    },
    {
        title: "Enterprise Security",
        icon: Shield,
        desc: "Bank-level encryption and compliance with global data protection regulations.",
        image: IMAGES.security,
        badge: "Secure",
        badgeClass: "text-green-400 text-[10px] font-extrabold uppercase",
        iconClass: "text-white bg-red-650",
        animClass: "group-hover-animate-swing",
        isDarkCard: true,
    },
    {
        title: "Global Compliance",
        icon: Globe,
        desc: "Stay compliant with local labor laws across 50+ countries effortlessly.",
        image: IMAGES.global,
        badge: "50+ Countries",
        badgeClass: "text-gray-700 text-[10px] font-bold px-2.5 py-1 bg-white/95 rounded shadow",
        iconClass: "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10",
        animClass: "group-hover-animate-spin-slow",
    },
    {
        title: "Scalability",
        icon: Cpu,
        desc: "From 10 to 10,000+ employees — our platform grows with your business without losing performance.",
        image: IMAGES.scalability,
        badge: "10K+ Employees",
        badgeClass: "text-gray-700 text-[10px] font-bold px-2.5 py-1 bg-white/95 rounded shadow",
        iconClass: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10",
        animClass: "group-hover-animate-float",
    },
    {
        title: "24/7 AI Support",
        icon: Bot,
        desc: "Intelligent chatbots and human experts available round-the-clock to solve your HR queries instantly.",
        image: IMAGES.aiSupport,
        badge: "AI-Powered",
        badgeClass: "text-white text-[9px] font-extrabold tracking-wider uppercase px-2.5 py-1 bg-blue-600 rounded shadow-md",
        iconClass: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
        animClass: "group-hover-animate-bounce-custom",
    }
];


/* ─────────────────────────────────────────────────────────────────
   WebGL Shader Dot-Wave Background  (adapted from CanvasRevealEffect)
   ───────────────────────────────────────────────────────────────── */

/** Inner Three.js mesh — must live inside <Canvas> */
const AmbientBackground = ({ isDarkMode }) => {
    return (
        <div
            className={`fixed inset-0 pointer-events-none z-0 transition-colors duration-500 ${isDarkMode ? 'bg-[#030712]' : 'bg-[#fafafa]'
                }`}
        >
            {/* Interactive DotField background */}
            <DotField
                dotRadius={1.5}
                dotSpacing={30}
                cursorRadius={550}
                cursorForce={0.14}
                bulgeOnly={true}
                bulgeStrength={66}
                glowRadius={160}
                sparkle={true}
                waveAmplitude={0}
                gradientFrom={isDarkMode ? 'rgba(168, 85, 247, 0.45)' : 'rgba(109, 40, 217, 0.85)'}
                gradientTo={isDarkMode ? 'rgba(6, 182, 212, 0.35)' : 'rgba(29, 78, 216, 0.8)'}
                glowColor={isDarkMode ? '#3b82f6' : '#ffffff'}
            />

            {/* Hero spotlight */}
            <div
                className={`absolute top-[-5%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full blur-[140px] pointer-events-none ${isDarkMode
                    ? 'opacity-30 bg-[radial-gradient(circle,rgba(59,130,246,0.30)_0%,rgba(139,92,246,0.14)_50%,transparent_100%)]'
                    : 'opacity-20 bg-[radial-gradient(circle,rgba(59,130,246,0.18)_0%,rgba(139,92,246,0.08)_50%,transparent_100%)]'
                    }`}
            />

            {/* Side ambient glows */}
            <div
                className={`absolute top-[20%] left-[2%] w-[550px] h-[550px] rounded-full blur-[160px] pointer-events-none ${isDarkMode
                    ? 'opacity-20 bg-[radial-gradient(circle,rgba(59,130,246,0.25)_0%,transparent_100%)]'
                    : 'opacity-10 bg-[radial-gradient(circle,rgba(59,130,246,0.15)_0%,transparent_100%)]'
                    }`}
            />
            <div
                className={`absolute top-[30%] right-[2%] w-[600px] h-[600px] rounded-full blur-[160px] pointer-events-none ${isDarkMode
                    ? 'opacity-20 bg-[radial-gradient(circle,rgba(139,92,246,0.22)_0%,transparent_100%)]'
                    : 'opacity-10 bg-[radial-gradient(circle,rgba(139,92,246,0.12)_0%,transparent_100%)]'
                    }`}
            />
        </div>
    );
};




const AnimatedNavLink = ({ href, active, children, isDarkMode, onClick }) => {
    const defaultTextColor = isDarkMode ? 'text-zinc-400' : 'text-zinc-650';
    const hoverTextColor = 'text-blue-600 dark:text-blue-400';

    return (
        <a
            href={href}
            onClick={onClick}
            className="group relative inline-block overflow-hidden text-xs tracking-wider uppercase font-semibold transition-all px-3"
        >
            <div className="relative py-1 transition-transform duration-400 ease-out transform group-hover:-translate-y-full">
                <span className={`block ${active ? 'text-blue-600 dark:text-blue-400' : defaultTextColor}`}>{children}</span>
                <span className={`absolute top-full left-0 block ${hoverTextColor}`}>{children}</span>
            </div>
        </a>
    );
};

const DynamicHRMSLandingPage = () => {
    const featuresTrackRef = useRef(null);
    const benefitsTrackRef = useRef(null);

    const handleMarqueeHover = (ref, isHovered) => {
        if (!ref.current) return;
        const animations = ref.current.getAnimations();
        animations.forEach((anim) => {
            const targetRate = isHovered ? 0.25 : 1.0;
            if (anim._rafId) cancelAnimationFrame(anim._rafId);

            let start = null;
            const initialRate = anim.playbackRate;
            const duration = 400;

            const step = (timestamp) => {
                if (!start) start = timestamp;
                const progress = Math.min((timestamp - start) / duration, 1);
                anim.playbackRate = initialRate + (targetRate - initialRate) * progress;
                if (progress < 1) {
                    anim._rafId = requestAnimationFrame(step);
                }
            };
            anim._rafId = requestAnimationFrame(step);
        });
    };

    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState('home');

    useEffect(() => {
        const sectionIds = ['home', 'features', 'benefits', 'pricing', 'support'];
        const elements = sectionIds.map(id => document.getElementById(id)).filter(Boolean);

        if (elements.length === 0) return;

        const observerOptions = {
            root: null,
            rootMargin: '-25% 0px -45% 0px',
            threshold: 0
        };

        const observerCallback = (entries) => {
            const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100;
            if (isAtBottom) {
                setActiveSection('support');
                return;
            }
            if (window.scrollY < 80) {
                setActiveSection('home');
                return;
            }

            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.id);
                }
            });
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);
        elements.forEach(el => observer.observe(el));

        const handleScroll = () => {
            const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100;
            if (isAtBottom) {
                setActiveSection('support');
            } else if (window.scrollY < 80) {
                setActiveSection('home');
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            elements.forEach(el => observer.unobserve(el));
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        return savedTheme ? savedTheme === 'dark' : false;
    });
    const [activeFaq, setActiveFaq] = useState(null);
    const [hoveredPlan, setHoveredPlan] = useState(null);
    const [plansExpanded, setPlansExpanded] = useState(false);

    const [plans, setPlans] = useState([]);
    const [plansLoading, setPlansLoading] = useState(true);

    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [userLimit, setUserLimit] = useState(30);
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
    const [supportForm, setSupportForm] = useState({
        name: "",
        email: "",
        category: "Technical Issue",
        message: "",
    });

    const handleSupportSubmit = (e) => {
        e.preventDefault();
        alert(`Support ticket submitted successfully for ${supportForm.name}!`);
        setSupportForm({ name: "", email: "", category: "Technical Issue", message: "" });
    };

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
        (plan) => plan.planName?.toLowerCase() !== "owner" && plan.isActive !== false
    );

    const handlePlanClick = (plan) => {
        setSelectedPlan(plan);
        setUserLimit(30);
        setSignupError("");
        setSignupSuccess("");
        setSignupForm({ name: "", email: "", password: "", phone: "", role: "admin", department: "" });
        setShowRegisterModal(true);
    };

    const handleCloseModal = () => {
        setShowRegisterModal(false);
        setSelectedPlan(null);
        setUserLimit(30);
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
        "/admin/admin-overtime": "Overtime Requests",
        "/admin/expense": "Expense Management",
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
            const res = await API.post("/api/razorpay/create-order", { plan: selectedPlan, signupForm, userLimit });
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
        if (!userLimit || Number(userLimit) < 30) {
            return setSignupError("User Limit is a required field and must be at least 30");
        }
        setSignupLoading(true);

        try {
            if (Number(selectedPlan.price) === 0) {
                await API.post("/api/admin/register", { ...signupForm, plan: selectedPlan.planName, userLimit });
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
    const bg = isDarkMode ? 'bg-[#030712]' : 'bg-[#fafafa]';
    const text = isDarkMode ? 'text-zinc-50' : 'text-slate-900';
    const textSec = isDarkMode ? 'text-zinc-400' : 'text-slate-600';
    const textMuted = isDarkMode ? 'text-zinc-500' : 'text-slate-400';
    const navBg = isDarkMode ? 'bg-[#030712]/75 border-white/[0.04]' : 'bg-white/75 border-slate-200/50';
    const cardBg = isDarkMode ? 'bg-zinc-900/40 border-white/[0.08] backdrop-blur-md' : 'bg-white border-slate-200/50';
    const sectionBg = 'bg-transparent';
    const inputBg = isDarkMode ? 'bg-zinc-900/40 border-white/10' : 'bg-slate-50 border-slate-200';
    const inputFocus = isDarkMode ? 'focus:border-blue-500 focus:bg-white/[0.04] ring-1 ring-blue-500/20' : 'focus:border-blue-500 focus:bg-white ring-1 ring-blue-500/20';
    const modalBg = isDarkMode ? 'bg-[#090d16] border-white/10' : 'bg-white border-slate-200';

    const faqs = [
        { q: "Can I change my plan later?", a: "Yes, you can upgrade or downgrade your plan at any time from your account settings. Changes take effect on your next billing cycle." },
        { q: "What happens after the Free Trial?", a: "After the 60-day free trial ends, your account will be paused. You can subscribe to a paid plan anytime to continue using all features." },
        { q: "Do you offer discounts for non-profits?", a: "Yes! We offer special pricing for non-profit organizations. Contact our sales team at ops@arahinfotech.net for more information." },
    ];

    return (
        <div className={`min-h-screen relative ${text} font-sans transition-colors duration-500 overflow-x-hidden`} style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
                html { scroll-behavior: smooth; }
                .no-spin::-webkit-outer-spin-button,
                .no-spin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                .no-spin { -moz-appearance: textfield; }
                
                /* Custom Premium Scrollbar */
                ::-webkit-scrollbar {
                    width: 6px;
                }
                ::-webkit-scrollbar-track {
                    background: transparent;
                }
                ::-webkit-scrollbar-thumb {
                    background: ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)'};
                    border-radius: 99px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: ${isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.15)'};
                }

                .text-gradient-primary {
                    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #d946ef 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                
                .glass-card {
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }

                /* Smooth Premium Box Shadow */
                .shadow-premium-sm {
                    box-shadow: ${isDarkMode ? '0 2px 8px rgba(0, 0, 0, 0.4)' : '0 2px 8px rgba(15, 23, 42, 0.02)'};
                }
                .shadow-premium-md {
                    box-shadow: ${isDarkMode ? '0 12px 24px -10px rgba(0, 0, 0, 0.5)' : '0 12px 24px -10px rgba(15, 23, 42, 0.04)'};
                }
                .shadow-premium-lg {
                    box-shadow: ${isDarkMode ? '0 30px 60px -15px rgba(0, 0, 0, 0.6)' : '0 30px 60px -15px rgba(15, 23, 42, 0.08)'};
                }

                /* Custom Icon Animations */
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                @keyframes pulseGlow {
                    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 2px rgba(59, 130, 246, 0.3)); }
                    50% { transform: scale(1.1); filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.6)); }
                }
                @keyframes swing {
                    0%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(8deg); }
                    75% { transform: rotate(-8deg); }
                }
                @keyframes spinSlow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes bounceCustom {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                }

                .group:hover .group-hover-animate-float {
                    animation: float 2s ease-in-out infinite;
                }
                .group:hover .group-hover-animate-pulse-glow {
                    animation: pulseGlow 1.5s ease-in-out infinite;
                }
                .group:hover .group-hover-animate-swing {
                    animation: swing 1.8s ease-in-out infinite;
                }
                .group:hover .group-hover-animate-spin-slow {
                    animation: spinSlow 5s linear infinite;
                }
                .group:hover .group-hover-animate-bounce-custom {
                    animation: bounceCustom 1s ease-in-out infinite;
                }

                /* Marquee core */
                @keyframes marquee {
                    0% { transform: translate3d(0, 0, 0); }
                    100% { transform: translate3d(-50%, 0, 0); }
                }
                .animate-marquee-premium {
                    display: flex;
                    width: max-content;
                    animation: marquee 30s linear infinite;
                    will-change: transform;
                }
                
                /* Hide scrollbar utility */
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>

            {/* Premium Ambient Background */}
            <AmbientBackground isDarkMode={isDarkMode} />

            {/* Main Page Content (z-index: 10 overlaying background z-0) */}
            <div className="relative z-10 flex flex-col w-full">
                {/* ─── NAVIGATION ─── */}
                <nav className={`fixed top-0 left-0 right-0 w-full z-40 px-6 md:px-10 py-3 border-b glass-card ${isDarkMode ? 'bg-[#030712]/75 border-white/[0.04]' : 'bg-[#fafafa]/85 border-zinc-200/50'} transition-all duration-300`}>
                    <div className="max-w-5xl mx-auto flex items-center justify-between">
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                setActiveSection('home');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="flex items-center gap-2 group"
                        >
                            <img
                                src="https://image2url.com/r2/default/images/1774247571292-e7459e42-1868-4206-bd5c-bb4c59de5716.png"
                                alt="V-Sync"
                                className="h-9 md:h-11 object-contain transition-transform group-hover:scale-[1.02]"
                            />
                        </a>

                        {/* Navigation Items */}
                        <div className="hidden md:flex items-center gap-4 bg-zinc-500/5 border border-zinc-500/10 px-4 py-2 rounded-full backdrop-blur-md">
                            {[
                                { label: 'Home', id: 'home' },
                                { label: 'Features', id: 'features' },
                                { label: 'Benefits', id: 'benefits' },
                                { label: 'Pricing', id: 'pricing' },
                                { label: 'Support', id: 'support' },
                            ].map((item) => (
                                <AnimatedNavLink
                                    key={item.id}
                                    href={item.id === 'home' ? '#' : `#${item.id}`}
                                    active={activeSection === item.id}
                                    isDarkMode={isDarkMode}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setActiveSection(item.id);
                                        if (item.id === 'home') {
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        } else {
                                            const element = document.getElementById(item.id);
                                            if (element) {
                                                element.scrollIntoView({ behavior: 'smooth' });
                                            }
                                        }
                                    }}
                                >
                                    {item.label}
                                </AnimatedNavLink>
                            ))}
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={toggleTheme}
                                className={`p-2.5 rounded-full transition-all border ${isDarkMode
                                    ? 'bg-zinc-900 border-zinc-800 text-yellow-400 hover:bg-zinc-800 hover:border-zinc-700'
                                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300'
                                    }`}
                            >
                                {isDarkMode ? (
                                    <AnimateIcon animateOnHover>
                                        <Sun size={16} />
                                    </AnimateIcon>
                                ) : (
                                    <AnimateIcon animateOnHover>
                                        <SunMoon size={16} />
                                    </AnimateIcon>
                                )}
                            </button>

                            <button
                                onClick={() => navigate("/request-demo")}
                                className={`hidden md:block px-5 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase border transition-all ${isDarkMode
                                    ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800'
                                    : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                                    }`}
                            >
                                Request Demo
                            </button>

                            <button
                                onClick={() => navigate("/login")}
                                className="bg-blue-600 text-white px-6 py-2.5 rounded-full text-xs font-bold tracking-wider uppercase shadow-md hover:bg-blue-500 transition-all transform active:scale-95"
                            >
                                Get Started
                            </button>
                        </div>
                    </div>
                </nav>

                {/* ─── HERO SECTION ─── */}
                <section id="home" className="pt-24 pb-16 px-6 md:px-10">
                    <div className="max-w-7xl mx-auto flex flex-col items-center">

                        {/* Upper Badge */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            className="mb-8"
                        >
                            <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-extrabold uppercase tracking-widest ${isDarkMode
                                ? 'bg-blue-950/30 border-blue-500/20 text-blue-400'
                                : 'bg-blue-50 border-blue-200 text-blue-600'
                                } shadow-premium-sm`}
                            >
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                </span>
                                NEW: AI PAYROLL AUTOMATION 2.0
                            </span>
                        </motion.div>

                        {/* Headline & Description */}
                        <div className="text-center max-w-4xl mb-10">
                            <motion.h1
                                initial={{ opacity: 0, y: 24 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6"
                            >
                                Enterprise-Grade <span className="text-gradient-primary">Features</span><br />
                                for Modern HR
                            </motion.h1>

                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                className={`${textSec} text-sm md:text-base max-w-2xl mx-auto leading-relaxed`}
                            >
                                Streamline your global workforce with VW Sync's precision-engineered HR suite.
                                Automated payroll, real-time attendance, and predictive analytics in one glassmorphic dashboard.
                            </motion.p>
                        </div>

                        {/* Action buttons */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="flex flex-wrap items-center justify-center gap-4 mb-20"
                        >
                            <button
                                onClick={() => navigate("/login")}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-full font-bold text-xs uppercase tracking-widest shadow-premium-md transform active:scale-95 transition-all"
                            >
                                Sign In
                            </button>
                            <a href="#pricing">
                                <button className={`px-8 py-3.5 rounded-full font-bold text-xs uppercase tracking-widest border transition-all ${isDarkMode
                                    ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800'
                                    : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 shadow-premium-sm'
                                    }`}
                                >
                                    View Pricing
                                </button>
                            </a>
                        </motion.div>

                        {/* Elegant Browser Frame Mockup */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            className={`w-full relative rounded-2xl overflow-hidden shadow-premium-lg border ${isDarkMode ? 'border-white/[0.04] bg-zinc-950/80' : 'border-zinc-200/50 bg-white'
                                } p-2`}
                        >
                            <div className={`flex items-center gap-1.5 px-4 py-2 border-b rounded-t-xl ${isDarkMode ? 'border-white/[0.04] bg-white/[0.02]' : 'border-zinc-200/40 bg-zinc-50'
                                }`}>
                                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
                                <div className={`mx-auto text-[10px] font-mono uppercase tracking-widest px-4 py-0.5 rounded ${isDarkMode ? 'bg-black/40 text-zinc-500' : 'bg-zinc-200/40 text-zinc-600'
                                    }`}>vw-sync.hrms</div>
                            </div>
                            <div className="relative h-64 md:h-[420px] rounded-b-xl overflow-hidden">
                                <img
                                    src={IMAGES.hero}
                                    alt="Modern HR team collaborating"
                                    className="w-full h-full object-cover"
                                />
                                <div className={`absolute inset-0 bg-gradient-to-r ${isDarkMode
                                    ? 'from-[#030712]/80 via-[#030712]/30 to-transparent'
                                    : 'from-blue-950/50 via-transparent to-transparent'
                                    }`} />
                                <div className="absolute inset-0 flex items-center px-8 md:px-16">
                                    <div className="max-w-md">
                                        <p className="text-white text-[9px] font-black uppercase tracking-widest mb-2 opacity-80">TRUSTED BY ENTERPRISES WORLDWIDE</p>
                                        <h2 className="text-white text-xl md:text-3xl font-extrabold leading-tight mb-4">HR Simplified.<br />Workforce Amplified.</h2>
                                        <div className="flex items-center gap-3">
                                            <div className="flex -space-x-2">
                                                {[
                                                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&q=80&auto=format&fit=crop&crop=face',
                                                    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&q=80&auto=format&fit=crop&crop=face',
                                                    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&q=80&auto=format&fit=crop&crop=face',
                                                ].map((src, i) => (
                                                    <img key={i} src={src} alt="user" className="w-8 h-8 rounded-full border border-zinc-950 object-cover" />
                                                ))}
                                            </div>
                                            <p className="text-white text-[11px] font-bold opacity-90">10,000+ teams onboarded</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                    </div>
                </section>

                {/* ─── FEATURES GRID ─── */}
                <section id="features" className="py-24 px-6 md:px-10 overflow-visible">
                    <div className="max-w-7xl mx-auto overflow-visible">

                        <div className="text-center mb-16">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-widest mb-4 bg-blue-500/5 border-blue-500/20 text-blue-600 dark:text-blue-400">
                                ✦ Powerful Modules
                            </span>
                            <h2 className={`text-3xl md:text-5xl font-extrabold tracking-tight ${text}`}>
                                A Complete Human Resource System
                            </h2>
                            <p className={`mt-3 ${textSec} text-sm max-w-xl mx-auto`}>
                                Every feature is built for high-performance and absolute enterprise compliance.
                            </p>
                        </div>

                        {/* Google Workspace-inspired Showcase Row */}
                        <div className="flex flex-wrap md:flex-nowrap items-center justify-center gap-8 md:gap-14 overflow-visible py-16 px-6 pb-0 max-w-full">
                            {FEATURES_DATA.map((item, idx) => {
                                const Icon = item.icon;
                                const shortTitle = item.title.includes("Reports") ? "Analytics" : item.title.split(" ")[0];
                                const textColors = item.iconClass.split(" ").filter(c => c.startsWith("text-")).join(" ");
                                return (
                                    <div
                                        key={idx}
                                        className="relative group flex flex-col items-center justify-center flex-shrink-0 cursor-pointer select-none w-24 h-24 overflow-visible"
                                    >
                                        {/* Floating Glassmorphism Card (Appears Directly Over on Hover, extending downward) */}
                                        <div className="absolute top-[-16px] left-1/2 -translate-x-1/2 pointer-events-none z-50 transition-all duration-300 ease-out transform opacity-0 scale-95 origin-top group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto">
                                            <div className={`w-[155px] md:w-[175px] pt-7 pb-6 px-4 rounded-[2rem] border ${isDarkMode ? 'bg-zinc-950/95 border-white/[0.08] shadow-2xl' : 'bg-white border-zinc-200/80 shadow-[0_12px_36px_rgba(0,0,0,0.06)]'} flex flex-col items-center text-center`}>
                                                <Icon className={`w-11 h-11 ${textColors} ${item.animClass} mb-3`} />
                                                <h4 className={`text-xs font-bold tracking-wide mb-1 ${text}`}>{item.title}</h4>
                                                <p className={`${textSec} text-[9px] leading-relaxed max-w-[130px] mb-3`}>{item.desc}</p>
                                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer">Learn More</span>
                                            </div>
                                        </div>

                                        {/* Default Icon & Label (Fades out when hovered card overlays it) */}
                                        <div className="flex flex-col items-center gap-3 transition-all duration-300 group-hover:opacity-0 group-hover:scale-90">
                                            <Icon className={`w-9 h-9 ${textColors} transition-transform duration-300`} />
                                            <span className={`text-[10px] font-extrabold tracking-wider uppercase transition-colors duration-300 ${textMuted}`}>
                                                {shortTitle}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                    </div>
                </section>

                {/* ─── BENEFITS SECTION ─── */}
                <section id="benefits" className="py-24 px-6 md:px-10">
                    <div className="max-w-7xl mx-auto">

                        {/* Upper Header Box */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className={`relative rounded-3xl overflow-hidden mb-16 p-10 text-center border glass-card ${isDarkMode ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-white border-zinc-200/50'} shadow-premium-md`}
                        >
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #2563eb 0%, transparent 60%), radial-gradient(circle at 70% 50%, #06b6d4 0%, transparent 60%)' }}></div>
                            <div className="relative z-10">
                                <span className={`inline-flex items-center gap-2 text-[10px] font-extrabold tracking-widest uppercase ${textMuted} mb-4`}>✦ THE FUTURE OF HR</span>
                                <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
                                    Why Choose <span className="text-gradient-primary">VW Sync?</span>
                                </h2>
                                <p className={`${textSec} max-w-2xl mx-auto text-xs md:text-sm leading-relaxed`}>
                                    Empowering forward-thinking enterprises with a high-performance engine for modern workflows.
                                </p>
                            </div>
                        </motion.div>

                        {/* Benefits Grid */}
                        {/* Marquee Container */}
                        <div
                            className="relative w-full overflow-hidden py-4"
                            onMouseEnter={() => handleMarqueeHover(benefitsTrackRef, true)}
                            onMouseLeave={() => handleMarqueeHover(benefitsTrackRef, false)}
                        >
                            {/* Left & Right Gradient Shadows */}
                            <div className={`absolute left-0 top-0 bottom-0 w-16 md:w-32 z-10 pointer-events-none bg-gradient-to-r ${isDarkMode ? 'from-[#030712] to-transparent' : 'from-[#fafafa] to-transparent'}`} />
                            <div className={`absolute right-0 top-0 bottom-0 w-16 md:w-32 z-10 pointer-events-none bg-gradient-to-l ${isDarkMode ? 'from-[#030712] to-transparent' : 'from-[#fafafa] to-transparent'}`} />

                            {/* Scrolling track */}
                            <div
                                ref={benefitsTrackRef}
                                className="animate-marquee-premium flex gap-6"
                            >
                                {/* Render twice for seamless loop */}
                                {[...BENEFITS_DATA, ...BENEFITS_DATA].map((item, idx) => {
                                    const Icon = item.icon;
                                    return (
                                        <div
                                            key={idx}
                                            className={`w-[280px] md:w-[320px] rounded-2xl overflow-hidden border glass-card transition-all duration-400 ease-out cursor-pointer flex-shrink-0 group hover:scale-[1.02] ${item.isDarkCard ? 'bg-zinc-900/90 text-white border-zinc-800/80 hover:shadow-[0_0_25px_rgba(239,68,68,0.12)]' : `${cardBg} hover:shadow-[0_0_25px_rgba(59,130,246,0.18)] hover:border-blue-500/30`} flex flex-col justify-between h-[340px]`}
                                        >
                                            <div className="p-6">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.iconClass} mb-4`}>
                                                    <Icon className={`w-5 h-5 transition-transform duration-300 ${item.animClass}`} />
                                                </div>
                                                <h3 className={`text-xl font-bold mb-2 ${item.isDarkCard ? 'text-white' : text}`}>{item.title}</h3>
                                                <p className={`${item.isDarkCard ? 'text-zinc-400' : textSec} text-xs md:text-sm leading-relaxed`}>{item.desc}</p>
                                                {item.title === "Enterprise Security" && (
                                                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded bg-green-500/10 border border-green-500/20 mt-4">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                                                        <span className="text-green-400 text-[9px] font-extrabold uppercase">GDPR & SOC2 Compliant</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="relative h-32 mx-5 mb-5 rounded-xl overflow-hidden shadow-inner border border-zinc-200/20 dark:border-white/[0.04] mt-auto">
                                                <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                                                {item.title === "70% Time Saved" && <div className="absolute inset-0 bg-blue-950/30"></div>}
                                                {item.title === "Enterprise Security" && <div className="absolute inset-0 bg-black/40"></div>}
                                                {item.title === "Global Compliance" && <div className="absolute inset-0 bg-cyan-950/20"></div>}
                                                {item.title === "Scalability" && <div className="absolute inset-0 bg-green-950/25"></div>}
                                                {item.title === "24/7 AI Support" && <div className="absolute inset-0 bg-blue-950/20"></div>}

                                                {item.title === "70% Time Saved" && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="text-center">
                                                            <span className="text-5xl float-slow inline-block group-hover:scale-110 transition-transform duration-300">🚀</span>
                                                            <p className="text-white text-[10px] font-bold mt-2 opacity-90 tracking-widest uppercase">Automation Engine Active</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {item.title === "Enterprise Security" && (
                                                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-500/20 border border-green-500/40 rounded px-3 py-1.5">
                                                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                                        <span className="text-green-400 text-[10px] font-extrabold uppercase">Secure</span>
                                                    </div>
                                                )}

                                                {item.badge && item.title !== "70% Time Saved" && item.title !== "Enterprise Security" && (
                                                    <div className={`absolute bottom-3 ${item.title === "Scalability" ? 'right-3' : 'left-3'} ${item.badgeClass || 'bg-white/95 backdrop-blur-sm rounded px-2.5 py-1 shadow'}`}>
                                                        <span className="text-[10px] font-bold text-gray-800">{item.badge}</span>
                                                    </div>
                                                )}

                                                {item.title === "24/7 AI Support" && (
                                                    <div className="absolute bottom-3 left-3 bg-blue-600 text-white text-[9px] font-extrabold tracking-wider uppercase px-2.5 py-1 rounded shadow-md">AI-Powered</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Uptime Guarantee Bar */}
                        <motion.div
                            initial={{ opacity: 0, y: 25 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className={`rounded-2xl overflow-hidden border glass-card ${cardBg} mb-12 shadow-premium-md`}
                        >
                            <div className="relative h-32 overflow-hidden shadow-inner">
                                <img src={IMAGES.uptime} alt="Server infrastructure uptime" className="w-full h-full object-cover" />
                                <div className={`absolute inset-0 ${isDarkMode ? 'bg-zinc-950/80' : 'bg-white/85'}`}></div>
                                <div className="absolute inset-0 flex items-center px-8 justify-between z-10">
                                    <div>
                                        <h3 className={`text-lg md:text-xl font-bold mb-1 ${text}`}>99.9% Uptime Guarantee</h3>
                                        <p className={`${textSec} text-[10px] md:text-xs max-w-lg leading-relaxed`}>Reliable infrastructure with guaranteed availability. Your HR operations never sleep, and neither does V-Sync.</p>
                                    </div>
                                    <div className="hidden md:flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2">
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                        <span className="text-green-600 dark:text-green-400 text-[10px] font-extrabold tracking-widest uppercase">ONLINE</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Stats Matrix */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
                            {[
                                { value: '70%', label: 'TIME SAVED', sub: 'Automate repetitive HR tasks and reduce manual work significantly.', color: 'text-blue-600 dark:text-blue-400' },
                                { value: '99.9%', label: 'UPTIME SLA', sub: 'Reliable infrastructure with guaranteed availability for global teams.', color: 'text-indigo-600 dark:text-indigo-400' },
                                { value: '10K+', label: 'ACTIVE USERS', sub: 'Trusted by leading enterprises to manage their most valuable assets.', color: 'text-purple-650 dark:text-purple-400' },
                            ].map((s, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: "-50px" }}
                                    transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                                    className={`rounded-2xl p-8 text-center border glass-card premium-card ${cardBg}`}
                                >
                                    <div className={`text-4xl font-extrabold ${s.color} mb-2`}>{s.value}</div>
                                    <div className={`text-[10px] font-extrabold uppercase tracking-widest ${textMuted} mb-3`}>{s.label}</div>
                                    <p className={`text-xs ${textSec} leading-relaxed`}>{s.sub}</p>
                                </motion.div>
                            ))}
                        </div>

                        {/* Crafting digital excellence */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98, x: -20 }}
                                whileInView={{ opacity: 1, scale: 1, x: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                className="relative rounded-3xl overflow-hidden h-72 shadow-premium-lg border border-zinc-200/20 dark:border-white/[0.04]"
                            >
                                <img src={IMAGES.craftingExcellence} alt="Team crafting digital excellence" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-blue-950/10"></div>
                                <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
                                    <div className="flex -space-x-2">
                                        {[
                                            'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&q=80&auto=format&fit=crop&crop=face',
                                            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&q=80&auto=format&fit=crop&crop=face',
                                        ].map((src, i) => (
                                            <img key={i} src={src} alt="team" className="w-7 h-7 rounded-full border border-white object-cover" />
                                        ))}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-800">Built for People</p>
                                        <p className="text-[9px] text-blue-600 font-semibold">Human-centered design</p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <h3 className={`text-2xl md:text-3xl font-extrabold mb-4 leading-tight ${text}`}>Crafting Digital Excellence for Your People</h3>
                                <p className={`${textSec} text-xs md:text-sm mb-6 leading-relaxed`}>V-Sync isn't just another HR tool. It's a meticulously designed ecosystem that respects the human element while leveraging the power of automation. Every feature is a building block for your company's growth.</p>
                                <ul className="space-y-3.5">
                                    {[
                                        'Intuitive design that requires zero training for employees.',
                                        'Real-time insights to make data-driven people decisions.',
                                        'Seamless integration with your existing tech stack.',
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                                <FaCheckCircle className="text-white text-[10px]" />
                                            </div>
                                            <span className={`text-xs md:text-sm ${textSec}`}>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        </div>

                    </div>
                </section>

                {/* ─── PRICING SECTION ─── */}
                <section id="pricing" className="py-24 px-6 md:px-10">
                    <div className="max-w-7xl mx-auto">

                        <div className="text-center mb-12">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-widest mb-4 bg-blue-500/5 border-blue-500/20 text-blue-600 dark:text-blue-400">
                                ✦ Simple, Transparent Pricing
                            </span>
                            <h2 className={`text-3xl md:text-5xl font-extrabold tracking-tight mb-4 ${text}`}>
                                Plans Tailored for <span className="text-gradient-primary">Your Growth</span>
                            </h2>
                            <p className={`${textSec} max-w-xl mx-auto text-xs md:text-sm`}>
                                Transforming human resource management into seamless digital experiences.
                            </p>
                        </div>

                        {/* Pricing Banner */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.99, y: 15 }}
                            whileInView={{ opacity: 1, scale: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className={`relative rounded-3xl overflow-hidden mb-12 h-36 border ${isDarkMode ? 'border-white/[0.04]' : 'border-zinc-200/50'
                                } shadow-premium-md`}
                        >
                            <img src={IMAGES.pricing} alt="Business contract pricing" className="w-full h-full object-cover" />
                            <div className={`absolute inset-0 ${isDarkMode ? 'bg-[#030712]/80' : 'bg-blue-900/60'}`}></div>
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                <p className="text-white text-lg md:text-2xl font-extrabold text-center tracking-wider px-6">No hidden fees. Cancel anytime.</p>
                            </div>
                        </motion.div>

                        {plansLoading ? (
                            <div className="flex justify-center items-center h-40">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : (
                            <div className="plans-scroll flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth">
                                {filteredPlans.map((plan, index) => {
                                    const isPopular = index === mostPopularIdx;
                                    const isFree = Number(plan.price) === 0;
                                    const isHovered = hoveredPlan === index;

                                    return (
                                        <motion.div
                                            key={plan._id || index}
                                            initial={{ opacity: 0, y: 30 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true, margin: "-50px" }}
                                            transition={{ duration: 0.8, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                                            className={`relative rounded-3xl p-8 flex flex-col border transition-all duration-500 flex-shrink-0 snap-start ${isPopular
                                                ? 'bg-gradient-to-b from-blue-600 to-indigo-700 text-white shadow-premium-lg scale-[1.03] border-blue-500 plan-popular-glow'
                                                : isHovered
                                                    ? (isFree
                                                        ? 'bg-gradient-to-b from-zinc-800 to-zinc-900 text-white border-zinc-700 shadow-premium-lg'
                                                        : 'bg-gradient-to-b from-indigo-900 to-zinc-950 text-white border-indigo-500 shadow-premium-lg')
                                                    : `${isDarkMode ? 'bg-zinc-900/40 border-white/[0.04] text-white shadow-premium-sm' : 'bg-white border-zinc-200 text-zinc-900 shadow-premium-sm'}`
                                                }`}
                                            onMouseEnter={() => setHoveredPlan(index)}
                                            onMouseLeave={() => setHoveredPlan(null)}
                                            style={{ cursor: 'default', minWidth: '300px', width: '300px' }}
                                        >
                                            {isPopular && (
                                                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                                                    <span className="bg-white text-blue-600 text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow border border-blue-500/10">
                                                        MOST POPULAR
                                                    </span>
                                                </div>
                                            )}

                                            <div className="flex-1 flex flex-col relative z-10">
                                                <div className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isPopular || isHovered ? 'text-blue-200' : 'text-blue-600 dark:text-blue-400'
                                                    }`}>
                                                    VALID FOR {plan.durationDays} DAYS
                                                </div>

                                                <h3 className="text-2xl font-bold mb-4">
                                                    {plan.planName}
                                                </h3>

                                                <div className="mb-6 flex flex-col gap-1">
                                                    <div className="flex items-baseline gap-1">
                                                        {isFree ? (
                                                            <span className="text-4xl font-extrabold">Free</span>
                                                        ) : (
                                                            <>
                                                                <span className={`text-sm font-bold opacity-80`}>₹</span>
                                                                <span className="text-4xl font-extrabold">{plan.price}</span>
                                                                <span className={`text-xs opacity-70 ml-1`}>/User</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    {!isFree && (
                                                        <span className={`text-[10px] font-bold tracking-tight ${isPopular || isHovered ? 'text-blue-100/90' : 'text-slate-500 dark:text-zinc-400'}`}>
                                                            + 18% GST (Total: ₹{(plan.price * 1.18).toFixed(2)})
                                                        </span>
                                                    )}
                                                </div>

                                                <ul className="space-y-3.5 mb-8 flex-1">
                                                    <li className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isPopular || isHovered ? 'bg-white/20' : 'bg-blue-50 dark:bg-blue-950/40'
                                                            }`}>
                                                            <FaCheckCircle className={`text-[10px] ${isPopular || isHovered ? 'text-white' : 'text-blue-600'}`} />
                                                        </div>
                                                        <span className="text-xs font-semibold">
                                                            30 Users
                                                        </span>
                                                    </li>

                                                    {plan.features && plan.features.length > 0 ? (
                                                        (() => {
                                                            const filtered = plan.features.filter(f => f !== "/admin/users-limit");
                                                            const isExpanded = plansExpanded;
                                                            const displayed = isExpanded ? filtered : filtered.slice(0, 5);

                                                            return (
                                                                <>
                                                                    {displayed.map((feature, fIdx) => (
                                                                        <li key={fIdx} className="flex items-center gap-3">
                                                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isPopular || isHovered ? 'bg-white/20' : 'bg-blue-50 dark:bg-blue-950/40'
                                                                                }`}>
                                                                                <FaCheckCircle className={`text-[10px] ${isPopular || isHovered ? 'text-white' : 'text-blue-600'}`} />
                                                                            </div>
                                                                            <span className={`text-xs ${isPopular || isHovered ? 'text-blue-150' : 'text-zinc-600 dark:text-zinc-300'}`}>
                                                                                {featureLabels[feature] || feature}
                                                                            </span>
                                                                        </li>
                                                                    ))}

                                                                    {filtered.length > 5 && (
                                                                        <li className="pt-1.5">
                                                                            <button
                                                                                onClick={() => setPlansExpanded(!plansExpanded)}
                                                                                className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:underline cursor-pointer ${isPopular || isHovered ? 'text-white' : 'text-blue-600 dark:text-blue-400'
                                                                                    }`}
                                                                            >
                                                                                {isExpanded ? '− Show Less' : `+ ${filtered.length - 5} More Features`}
                                                                            </button>
                                                                        </li>
                                                                    )}
                                                                </>
                                                            );
                                                        })()
                                                    ) : (
                                                        <>
                                                            <li className="flex items-center gap-3">
                                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isPopular || isHovered ? 'bg-white/20' : 'bg-blue-100'}`}><FaCheckCircle className="text-[10px] text-blue-600" /></div>
                                                                <span className="text-xs">Core Access</span>
                                                            </li>
                                                            <li className="flex items-center gap-3">
                                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isPopular || isHovered ? 'bg-white/20' : 'bg-blue-100'}`}><FaCheckCircle className="text-[10px] text-blue-600" /></div>
                                                                <span className="text-xs">Secure Login</span>
                                                            </li>
                                                        </>
                                                    )}
                                                </ul>

                                                <button
                                                    onClick={() => handlePlanClick(plan)}
                                                    className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-premium-sm transition-all transform active:scale-98 ${isPopular || isHovered
                                                        ? 'bg-white text-zinc-950 hover:bg-zinc-100'
                                                        : 'border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500'
                                                        }`}
                                                >
                                                    {isFree ? "GET STARTED FREE" : "SUBSCRIBE NOW"}
                                                </button>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}

                        {/* General FAQ Accordion */}
                        <div className="max-w-3xl mx-auto mt-24">
                            <h2 className={`text-2xl md:text-3xl font-extrabold text-center mb-10 tracking-tight ${text}`}>Frequently Asked Questions</h2>
                            <div className="space-y-4">
                                {faqs.map((faq, i) => (
                                    <div key={i} className={`rounded-2xl border ${isDarkMode ? 'border-white/[0.04] bg-zinc-900/30' : 'border-zinc-200/50 bg-white'} overflow-hidden shadow-premium-sm transition-all duration-300`}>
                                        <button
                                            className={`w-full flex items-center justify-between p-5 text-left ${text} font-medium`}
                                            onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                                        >
                                            <span className="font-bold text-xs md:text-sm">{faq.q}</span>
                                            <FaChevronDown className={`text-[10px] flex-shrink-0 ml-4 transition-transform duration-300 ${activeFaq === i ? 'rotate-180 text-blue-600' : textMuted}`} />
                                        </button>
                                        <AnimatePresence initial={false}>
                                            {activeFaq === i && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className={`px-5 pb-5 pt-1 text-xs ${textSec} leading-relaxed border-t border-zinc-100 dark:border-white/[0.04] mt-1 pt-3`}>
                                                        {faq.a}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </section>

                {/* ─── SUPPORT SECTION ─── */}
                <section id="support" className="py-24 px-6 md:px-10">
                    <div className="max-w-7xl mx-auto">

                        <div className="text-center mb-12">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-widest mb-4 bg-blue-500/5 border-blue-500/20 text-blue-600 dark:text-blue-400">
                                ✦ Dedicated Assistance
                            </span>
                            <h2 className={`text-3xl md:text-5xl font-extrabold tracking-tight mb-4 ${text}`}>
                                We're Here to <span className="text-gradient-primary">Help You</span>
                            </h2>
                            <p className={`${textSec} max-w-xl mx-auto text-xs md:text-sm`}>
                                Get the support you need, when you need it most. Our team is dedicated to ensuring your VW Sync experience is flawless.
                            </p>
                        </div>

                        {/* Search Bar */}
                        <div className="max-w-xl mx-auto mb-16">
                            <div className={`flex gap-3 p-2 rounded-2xl border ${isDarkMode ? 'bg-zinc-950/40 border-white/[0.04]' : 'bg-white border-zinc-200'
                                } shadow-premium-sm`}>
                                <input
                                    type="text"
                                    placeholder="Search for documentation, guides, or tutorials..."
                                    className={`flex-1 bg-transparent outline-none text-xs px-3 ${text}`}
                                />
                                <button className="bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl text-white text-xs font-bold uppercase tracking-wider flex-shrink-0">
                                    Search
                                </button>
                            </div>
                        </div>

                        {/* Support Channels cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">

                            {/* Whatsapp */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.6, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                                className={`rounded-2xl p-8 border glass-card premium-card ${cardBg}`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600'} mb-5`}>
                                    <FaWhatsapp className="text-lg" />
                                </div>
                                <h3 className={`text-lg font-bold mb-2 ${text}`}>WhatsApp Support</h3>
                                <p className={`${textSec} text-xs mb-6 leading-relaxed`}>Get instant answers from our support team, available 24/7.</p>
                                <div className="flex items-center justify-between border-t border-zinc-150 dark:border-white/[0.04] pt-4">
                                    <span className="text-[10px] font-extrabold uppercase text-blue-600 dark:text-blue-400">Instant Chat</span>
                                    <a
                                        href="https://wa.me/918919801095?text=Hi%2C%20I%E2%80%99d%20like%20more%20information%20about%20your%20HRMS%20product.%20Please%20share%20the%20details."
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-bold text-blue-650 dark:text-blue-400 hover:underline"
                                    >
                                        Start Chat →
                                    </a>
                                </div>
                            </motion.div>

                            {/* Email */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                                className={`rounded-2xl p-8 border glass-card premium-card ${cardBg}`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'} mb-5`}>
                                    <FaEnvelope className="text-lg" />
                                </div>
                                <h3 className={`text-lg font-bold mb-2 ${text}`}>Email Support</h3>
                                <p className={`${textSec} text-xs mb-6 leading-relaxed`}>Send us your queries and get detailed responses within hours.</p>
                                <div className="flex items-center justify-between border-t border-zinc-150 dark:border-white/[0.04] pt-4">
                                    <span className="text-[10px] font-extrabold uppercase text-blue-605 dark:text-blue-400">ops@arahinfotech.net</span>
                                    <a
                                        href="https://mail.google.com/mail/?view=cm&fs=1&to=ops@arahinfotech.net&su=HRMS%20Enquiry&body=Hi%2C%20I%E2%80%99d%20like%20more%20information%20about%20your%20HRMS%20product."
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-bold text-blue-655 dark:text-blue-400 hover:underline"
                                    >
                                        Send Email →
                                    </a>
                                </div>
                            </motion.div>

                            {/* Phone */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                                className={`rounded-2xl p-8 border glass-card premium-card ${cardBg}`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-pink-500/10 text-pink-400' : 'bg-pink-50 text-pink-600'} mb-5`}>
                                    <FaPhone className="text-lg" />
                                </div>
                                <h3 className={`text-lg font-bold mb-2 ${text}`}>Phone Support</h3>
                                <p className={`${textSec} text-xs mb-6 leading-relaxed`}>Speak directly with our support specialists for urgent issues.</p>
                                <div className="flex items-center justify-between border-t border-zinc-150 dark:border-white/[0.04] pt-4">
                                    <span className="text-[10px] font-extrabold uppercase text-blue-605 dark:text-blue-400">8919801095</span>
                                    <a href="tel:8919801095" className="text-xs font-bold text-blue-655 dark:text-blue-400 hover:underline">
                                        Call Now →
                                    </a>
                                </div>
                            </motion.div>
                        </div>

                        {/* Support ticket submission form */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-20">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                className={`rounded-3xl p-8 border glass-card ${cardBg} shadow-premium-md`}
                            >
                                <h3 className={`text-2xl font-bold mb-2 ${text}`}>Open a Support Ticket</h3>
                                <p className={`${textSec} text-xs md:text-sm mb-6 leading-relaxed`}>Can't find what you're looking for? Fill out the form and we'll get back to you.</p>
                                <form onSubmit={handleSupportSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={`text-[10px] font-extrabold uppercase tracking-wider ${textMuted} block mb-1.5`}>Full Name</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="John Doe"
                                                value={supportForm.name}
                                                onChange={e => setSupportForm({ ...supportForm, name: e.target.value.replace(/[^a-zA-Z\s]/g, "") })}
                                                className={`w-full px-4 py-2.5 rounded-xl text-xs outline-none border transition-all duration-200 ${inputBg} ${inputFocus} ${text}`}
                                            />
                                        </div>
                                        <div>
                                            <label className={`text-[10px] font-extrabold uppercase tracking-wider ${textMuted} block mb-1.5`}>Work Email</label>
                                            <input
                                                type="email"
                                                required
                                                placeholder="john@company.com"
                                                value={supportForm.email}
                                                onChange={e => setSupportForm({ ...supportForm, email: e.target.value.replace(/[^a-zA-Z0-9@._+-]/g, "") })}
                                                className={`w-full px-4 py-2.5 rounded-xl text-xs outline-none border transition-all duration-200 ${inputBg} ${inputFocus} ${text}`}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={`text-[10px] font-extrabold uppercase tracking-wider ${textMuted} block mb-1.5`}>Category</label>
                                        <select
                                            value={supportForm.category}
                                            onChange={e => setSupportForm({ ...supportForm, category: e.target.value })}
                                            className={`w-full px-4 py-2.5 rounded-xl text-xs outline-none border transition-all duration-200 ${inputBg} ${inputFocus} ${text}`}
                                        >
                                            <option value="Technical Issue">Technical Issue</option>
                                            <option value="Billing">Billing</option>
                                            <option value="General Inquiry">General Inquiry</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={`text-[10px] font-extrabold uppercase tracking-wider ${textMuted} block mb-1.5`}>Message</label>
                                        <textarea
                                            required
                                            placeholder="How can we help?"
                                            rows={3}
                                            value={supportForm.message}
                                            onChange={e => setSupportForm({ ...supportForm, message: e.target.value })}
                                            className={`w-full px-4 py-2.5 rounded-xl text-xs outline-none border transition-all duration-200 resize-none ${inputBg} ${inputFocus} ${text}`}
                                        />
                                    </div>
                                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-premium-md transform active:scale-98 transition-all">
                                        SUBMIT REQUEST
                                    </button>
                                </form>
                            </motion.div>

                            {/* Customer support agent image container */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                className="relative rounded-3xl overflow-hidden min-h-[340px] shadow-premium-lg border border-zinc-200/20 dark:border-white/[0.04]"
                            >
                                <img src={IMAGES.supportHero} alt="Customer support team" className="w-full h-full object-cover" />
                                <div className={`absolute inset-0 ${isDarkMode ? 'bg-blue-950/30' : 'bg-blue-900/25'}`}></div>
                                <div className="absolute inset-0 flex flex-col justify-end p-6 z-10">
                                    <div className={`rounded-2xl p-4 flex items-center gap-3 ${isDarkMode ? 'bg-[#090d16]/95 border border-white/5' : 'bg-white/95 border border-zinc-200/50'
                                        } backdrop-blur-sm shadow-xl`}>
                                        <div className="flex -space-x-2">
                                            {[
                                                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&q=80&auto=format&fit=crop&crop=face',
                                                'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&q=80&auto=format&fit=crop&crop=face',
                                                'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&q=80&auto=format&fit=crop&crop=face',
                                            ].map((src, i) => (
                                                <img key={i} src={src} alt="agent" className="w-8 h-8 rounded-full border border-white object-cover" />
                                            ))}
                                        </div>
                                        <div>
                                            <p className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Active Support Team</p>
                                            <p className="text-[9px] text-green-500 font-bold uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>
                                                Responds in &lt; 2 hours
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Support Specific FAQ Grid */}
                        <div className="max-w-5xl mx-auto">
                            <h3 className="text-xl font-bold text-center mb-2 text-gradient-primary uppercase tracking-widest text-xs">Support Center</h3>
                            <p className={`text-center text-xs ${textSec} mb-8`}>Find quick answers to common support queries.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[
                                    {
                                        icon: '🔑',
                                        q: 'How do I reset my organizational password?',
                                        a: "To reset your organizational password, click the 'Forgot Password' link on the login screen. Enter your registered work email address, and our secure system will immediately send you a password reset link. Alternatively, your system administrator can reset your credentials directly from the Manage Logins panel in the master settings."
                                    },
                                    {
                                        icon: '🔗',
                                        q: 'Integrating VW Sync with Microsoft Teams',
                                        a: "Integrating VW Sync with Microsoft Teams is a seamless, one-click process. Navigate to the Integrations section within your Admin Settings, click 'Connect to Microsoft Teams', and log in with your Microsoft 365 enterprise account. Once connected, your team will receive real-time automated notifications for shifts, leaves, announcements, and payroll status updates directly inside your preferred Teams channels."
                                    },
                                    {
                                        icon: '💰',
                                        q: 'Payroll automation compliance in EU',
                                        a: "VW Sync is fully compliant with EU payroll regulations, GDPR guidelines, and statutory labor laws. Our platform automatically calculates regional tax structures, pension contributions, social security payments, and holiday allowances according to localized mandates. We also support compliant electronic payslip delivery, SEPA bank transfers, and automated reporting formats for local EU tax authorities."
                                    },
                                    {
                                        icon: '👥',
                                        q: 'Adding new employees to the dashboard',
                                        a: "Admins can add employees in two easy ways: 1. Manually add individual employees by navigating to the Employee Management tab and clicking the 'Add Employee' button to fill in their role, shift, and department details. 2. Invite employees to complete their own profiles by clicking 'Send Onboarding Email', letting them securely upload credentials and setup authentication before joining."
                                    },
                                ].map((item, i) => (
                                    <div
                                        key={i}
                                        onClick={() => setActiveFaq(activeFaq === (i + 10) ? null : (i + 10))}
                                        className={`rounded-2xl p-5 border flex flex-col gap-3 transition-all duration-300 card-hover cursor-pointer ${activeFaq === (i + 10)
                                            ? (isDarkMode ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50/50 border-blue-200 shadow-premium-sm')
                                            : (isDarkMode ? 'bg-zinc-900/30 border-white/[0.04]' : 'bg-white border-zinc-200')
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                                    <span className="text-sm">{item.icon}</span>
                                                </div>
                                                <span className={`text-xs md:text-sm font-bold ${text}`}>{item.q}</span>
                                            </div>
                                            <span className={`text-blue-600 text-lg font-black transition-transform duration-300 flex-shrink-0 ml-4 ${activeFaq === (i + 10) ? 'rotate-90' : ''}`}>
                                                ›
                                            </span>
                                        </div>
                                        <AnimatePresence initial={false}>
                                            {activeFaq === (i + 10) && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className={`pl-11 text-xs font-semibold leading-relaxed border-t pt-3 mt-1 transition-all ${isDarkMode ? 'text-zinc-300 border-white/[0.04]' : 'text-zinc-600 border-zinc-150'}`}>
                                                        {item.a}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </section>

                {/* ─── FOOTER ─── */}
                <footer className={`pt-16 pb-8 px-6 md:px-10 border-t ${isDarkMode ? 'bg-zinc-950 border-white/[0.04]' : 'bg-[#fafafa] border-zinc-200'}`}>
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">

                            <div className="lg:col-span-2">
                                <img
                                    src="https://image2url.com/r2/default/images/1774247571292-e7459e42-1868-4206-bd5c-bb4c59de5716.png"
                                    alt="V-Sync"
                                    className="h-9 object-contain mb-4"
                                />
                                <p className={`${textMuted} text-xs leading-relaxed mb-5 max-w-xs`}>
                                    Transforming human resource management into seamless digital experiences. Trusted by over 10,000+ companies worldwide.
                                </p>
                                <div className="flex gap-2.5">
                                    {[
                                        { icon: FaFacebookF, href: '#' },
                                        { icon: FaTwitter, href: '#' },
                                        { icon: FaLinkedinIn, href: '#' },
                                        { icon: FaInstagram, href: '#' },
                                        { icon: FaYoutube, href: '#' },
                                    ].map((s, i) => (
                                        <a key={i} href={s.href} className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all hover:border-blue-600 hover:text-blue-600 ${isDarkMode ? 'border-white/10 text-zinc-500' : 'border-zinc-350 text-zinc-450'}`}>
                                            <s.icon size={11} />
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
                                    <h5 className={`text-[10px] font-black uppercase tracking-widest ${textMuted} mb-4`}>{col.title}</h5>
                                    <ul className="space-y-2.5">
                                        {col.links.map((link) => (
                                            <li key={link}>
                                                <a href="#" className={`text-xs ${textSec} hover:text-blue-600 dark:hover:text-blue-400 transition-colors`}>{link}</a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}

                        </div>

                        <div className={`pt-6 border-t flex flex-col md:flex-row justify-between items-center gap-3 ${isDarkMode ? 'border-white/[0.04]' : 'border-zinc-200'}`}>
                            <p className={`text-[10px] font-semibold uppercase tracking-wider ${textMuted}`}>© 2026 VW SYNC. ALL RIGHTS RESERVED. TRANSFORMING HR INTO DIGITAL EXCELLENCE.</p>
                            <div className="flex gap-5">
                                {['PRIVACY POLICY', 'TERMS OF SERVICE', 'COOKIE POLICY'].map((item) => (
                                    <a key={item} href="#" className={`text-[10px] font-semibold uppercase tracking-wider ${textMuted} hover:text-blue-600 transition-colors`}>{item}</a>
                                ))}
                            </div>
                        </div>
                    </div>
                </footer>

            </div>

            {/* ─── REGISTER MODAL ─── */}
            {showRegisterModal && (
                <div className="fixed inset-0 z-[100] bg-zinc-950/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="modal-animate relative w-full max-w-2xl max-h-[95vh] overflow-y-auto">
                        <div className={`${modalBg} rounded-3xl shadow-premium-lg overflow-hidden border`}>

                            {/* Modal Header */}
                            <div className={`relative px-8 pt-8 pb-6 border-b ${isDarkMode ? 'bg-gradient-to-r from-blue-950/20 to-indigo-950/10 border-white/[0.04]' : 'bg-gradient-to-r from-blue-50/50 to-indigo-50/30 border-zinc-100'}`}>
                                <button
                                    onClick={handleCloseModal}
                                    className={`absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-zinc-400' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-500'} transition-all`}
                                >
                                    <FaTimes size={12} />
                                </button>

                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xs text-white">H</div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Admin Registration</span>
                                </div>
                                <h2 className={`text-2xl font-bold ${text}`}>Create Your Account</h2>
                                <p className={`${textSec} text-xs mt-1`}>Get started with your HRMS subscription today.</p>
                            </div>

                            <div className="p-8">
                                {signupError && (
                                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30 text-red-650 dark:text-red-400 px-4 py-3 rounded-xl mb-5 text-xs font-bold">
                                        {signupError}
                                    </div>
                                )}
                                {signupSuccess && (
                                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/30 text-emerald-650 dark:text-emerald-400 px-4 py-3 rounded-xl mb-5 text-xs font-bold flex items-center gap-2">
                                        <FaCheckCircle />
                                        {signupSuccess}
                                        <button onClick={() => navigate("/login")} className="ml-auto underline hover:text-emerald-700 transition-colors">
                                            Go to Login →
                                        </button>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                                    {/* Modal Plan selection column */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <FaCrown className="text-amber-500 text-xs" />
                                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400">Choose Plan</span>
                                        </div>

                                        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                                            {plans
                                                .filter(p => p.planName.toLowerCase() !== "owner")
                                                .map(plan => (
                                                    <button
                                                        key={plan._id}
                                                        type="button"
                                                        onClick={() => setSelectedPlan(plan)}
                                                        className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${selectedPlan?._id === plan._id
                                                            ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/30'
                                                            : `${isDarkMode ? 'border-white/[0.04] bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02]' : 'border-zinc-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'}`
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={`font-bold capitalize text-sm ${text}`}>{plan.planName}</span>
                                                                    {selectedPlan?._id === plan._id && <FaCheckCircle className="text-blue-500 text-xs" />}
                                                                </div>
                                                                <p className={`text-[10px] mt-0.5 uppercase tracking-wider font-bold ${textMuted}`}>{plan.durationDays} days access</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-blue-600 dark:text-blue-400 font-bold text-base">
                                                                    {Number(plan.price) === 0 ? "Free" : `₹${plan.price}`}
                                                                </div>
                                                                {Number(plan.price) > 0 && (
                                                                    <div className={`text-[9px] font-bold ${textMuted} mt-0.5`}>
                                                                        + 18% GST (Total: ₹{(plan.price * 1.18).toFixed(2)})
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                        </div>

                                        <div className="mt-5">
                                            <label className={`text-[10px] font-extrabold uppercase tracking-wider ${textMuted} mb-1 block`}>
                                                User Limit <span className="text-red-500">*</span>
                                            </label>
                                            <div className={`flex items-center gap-2 rounded-xl border p-2.5 transition-all duration-200 ${isDarkMode ? 'bg-zinc-950/40 border-white/[0.04]' : 'bg-white border-zinc-200'}`}>
                                                <input
                                                    type="number"
                                                    required
                                                    form="signup-form"
                                                    value={userLimit}
                                                    onChange={e => {
                                                        const val = e.target.value.replace(/[^0-9]/g, "");
                                                        if (val.length <= 3) {
                                                            setUserLimit(val === "" ? "" : Number(val));
                                                        }
                                                    }}
                                                    className={`w-full bg-transparent font-bold outline-none text-xs no-spin ${text}`}
                                                    placeholder="Enter limit (minimum 30)"
                                                />
                                            </div>
                                            {userLimit !== "" && Number(userLimit) < 30 ? (
                                                <p className="text-red-500 text-[9px] mt-1 font-bold animate-pulse">
                                                    ⚠ Limit should be at least 30 to proceed.
                                                </p>
                                            ) : (
                                                <p className={`text-[9px] ${textMuted} mt-1 font-semibold`}>
                                                    * Minimum 30 users required. Bill is calculated dynamically.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Modal form input fields column */}
                                    <div>
                                        <p className={`text-[10px] font-extrabold uppercase tracking-widest ${textMuted} mb-4`}>Your Details</p>
                                        <form id="signup-form" onSubmit={handleAdminRegister} className="space-y-3">
                                            <div>
                                                <label className={`text-[10px] font-extrabold uppercase tracking-wider ${textMuted} mb-1 block`}>Full Name</label>
                                                <input
                                                    type="text"
                                                    placeholder="John Smith"
                                                    pattern="^[A-Za-z\s]+$"
                                                    title="Only alphabets and spaces are allowed"
                                                    className={`w-full border px-4 py-2.5 rounded-xl outline-none text-xs transition-all duration-200 ${inputBg} ${inputFocus} ${text} placeholder:text-zinc-500`}
                                                    value={signupForm.name}
                                                    onChange={e => setSignupForm({ ...signupForm, name: e.target.value.replace(/[^a-zA-Z\s]/g, "") })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className={`text-[10px] font-extrabold uppercase tracking-wider ${textMuted} mb-1 block`}>Email Address</label>
                                                <input
                                                    type="email"
                                                    placeholder="example@gmail.com"
                                                    className={`w-full border px-4 py-2.5 rounded-xl outline-none text-xs transition-all duration-200 ${inputBg} ${inputFocus} ${text} placeholder:text-zinc-500`}
                                                    value={signupForm.email}
                                                    onChange={e => setSignupForm({ ...signupForm, email: e.target.value.replace(/[^a-zA-Z0-9@._+-]/g, "") })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className={`text-[10px] font-extrabold uppercase tracking-wider ${textMuted} mb-1 block`}>Password</label>
                                                <div className="relative">
                                                    <input
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder="Min 8 characters"
                                                        pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$"
                                                        title="Must be 8+ chars with uppercase, lowercase, number & symbol"
                                                        className={`w-full border px-4 py-2.5 pr-10 rounded-xl outline-none text-xs transition-all duration-200 ${inputBg} ${inputFocus} ${text} placeholder:text-zinc-500`}
                                                        value={signupForm.password}
                                                        onChange={e => setSignupForm({ ...signupForm, password: e.target.value })}
                                                        required
                                                    />
                                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${textMuted}`}>
                                                        {showPassword ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.94 10.94 0 0112 19C7 19 2.73 16.11 1 12a11.05 11.05 0 012.29-3.57" /><path d="M9.9 4.24A10.94 10.94 0 0112 5c5 0 9.27 2.89 11 7a11.05 11.05 0 01-4.23 5.07" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className={`text-[10px] font-extrabold uppercase tracking-wider ${textMuted} mb-1 block`}>Phone</label>
                                                <input
                                                    placeholder="9876543210"
                                                    className={`w-full border px-4 py-2.5 rounded-xl outline-none text-xs transition-all duration-200 ${inputBg} ${inputFocus} ${text} placeholder:text-zinc-500`}
                                                    value={signupForm.phone}
                                                    onChange={e => setSignupForm({ ...signupForm, phone: e.target.value.replace(/[^0-9]/g, "") })}
                                                    pattern="[0-9]{10}"
                                                    maxLength={10}
                                                    required
                                                />
                                            </div>

                                            {selectedPlan && (
                                                <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl px-4 py-3 flex flex-col gap-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-[9px] uppercase tracking-widest text-blue-600 dark:text-blue-400 font-extrabold">Selected Plan</p>
                                                            <p className={`font-bold text-xs capitalize ${text}`}>{selectedPlan.planName}</p>
                                                        </div>
                                                        <div className={`font-bold text-xs ${text}`}>
                                                            {Number(selectedPlan.price) === 0 ? "Free" : `₹${(selectedPlan.price * userLimit * getBillingCycleMultiplier(selectedPlan)).toFixed(2)}`}
                                                        </div>
                                                    </div>
                                                    {Number(selectedPlan.price) > 0 && (
                                                        <>
                                                            <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                                                                <span>GST (18%)</span>
                                                                <span>+ ₹{(selectedPlan.price * userLimit * getBillingCycleMultiplier(selectedPlan) * 0.18).toFixed(2)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between pt-1.5 border-t border-zinc-200/50 dark:border-zinc-800/50 font-bold text-xs text-blue-600 dark:text-blue-400">
                                                                <span>Total Bill (incl. GST)</span>
                                                                <span>₹{(selectedPlan.price * userLimit * getBillingCycleMultiplier(selectedPlan) * 1.18).toFixed(2)}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={signupLoading || !selectedPlan || !!signupSuccess}
                                                className="w-full mt-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-premium-md transform active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {signupLoading ? "Processing..." : !selectedPlan ? "Select a Plan" : Number(selectedPlan.price) === 0 ? "Create Free Account" : `Pay ₹${(selectedPlan.price * userLimit * getBillingCycleMultiplier(selectedPlan) * 1.18).toFixed(2)} & Activate`}
                                            </button>

                                            <p className={`text-center text-[9px] ${textMuted} uppercase tracking-wider pt-1 font-bold`}>
                                                {Number(selectedPlan?.price) > 0 ? "Secured by Razorpay · 100% Safe & Encrypted" : "No credit card required"}
                                            </p>
                                        </form>

                                        <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-white/10' : 'border-zinc-205'} text-center`}>
                                            <p className={`${textSec} text-xs`}>
                                                Already have an account?{" "}
                                                <button onClick={() => navigate("/login")} className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
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
