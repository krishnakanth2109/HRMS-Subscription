import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import api from "../api"; // Import the configured axios instance

const DynamicHRMSLandingPage = () => {
    const navigate = useNavigate();
    const [scrollProgress, setScrollProgress] = useState(0);
    
    // --- STATE FOR DYNAMIC PLANS ---
    const [plans, setPlans] = useState([]);
    const [plansLoading, setPlansLoading] = useState(true);

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
                // This now fetches the planName, price, durationDays, AND features array
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

    return (
        <div className="min-h-screen bg-[#030712] text-white selection:bg-blue-500/30 font-sans">
            <style>{`
                html { scroll-behavior: smooth; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-content { animation: fadeIn 0.8s ease-out forwards; }
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
                        <span className="text-xl font-bold tracking-tight">HRMS<span className="text-blue-400">Pro</span></span>
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
                            Modern HR for <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500">Fast-Growing Teams</span>
                        </h1>
                        <p className="text-xl text-gray-400 mb-10 max-w-lg leading-relaxed">
                            A single platform to manage your global workforce, automate payroll, and track performance without the spreadsheet chaos.
                        </p>
                        <div className="flex flex-wrap gap-5">
                            <button onClick={() => navigate("/login")} className="px-8 py-4 rounded-xl bg-white text-black font-bold hover:bg-blue-400 hover:text-white transition-all transform hover:-translate-y-1">
                                Start Free Trial
                            </button>
                            <button className="px-8 py-4 rounded-xl border border-white/10 font-bold hover:bg-white/5 transition-all">
                                View Demo Video
                            </button>
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
        <p className="text-xs text-gray-400">
            Manage staff records, roles, and permissions easily.
        </p>
    </div>

    <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-blue-500/30 transition">
        <div className="text-green-400 text-lg mb-2">⏱️</div>
        <h4 className="text-sm font-semibold text-white mb-1">Attendance Tracking</h4>
        <p className="text-xs text-gray-400">
            Monitor daily attendance with real-time updates.
        </p>
    </div>

    <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-blue-500/30 transition">
        <div className="text-yellow-400 text-lg mb-2">📧</div>
        <h4 className="text-sm font-semibold text-white mb-1">Email Notifications</h4>
        <p className="text-xs text-gray-400">
            Automated alerts for punch-in, leave, and approvals.
        </p>
    </div>

    <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-blue-500/30 transition">
        <div className="text-purple-400 text-lg mb-2">📊</div>
        <h4 className="text-sm font-semibold text-white mb-1">Analytics Dashboard</h4>
        <p className="text-xs text-gray-400">
            Visual insights on performance and productivity.
        </p>
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

            {/* Pricing Section - DYNAMIC FETCHING OF FEATURES */}
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
                        <div className={`grid gap-8 max-w-6xl mx-auto ${
                            plans.length === 1 ? 'md:grid-cols-1 max-w-md' : 
                            plans.length === 2 ? 'md:grid-cols-2 max-w-3xl' : 'md:grid-cols-3'
                        }`}>
                            {plans.map((plan, index) => {
                                const isPopular = plan.planName.toLowerCase().includes('professional') || plan.planName.toLowerCase().includes('premium');
                                
                                return (
                                  <div 
    key={plan._id || index} 
    className="bg-white/5 p-8 rounded-3xl border border-white/10 hover:border-blue-500/30 transition-all flex flex-col"
>
    <h3 className="text-2xl font-bold mb-2 capitalize tracking-tight">
        {plan.planName}
    </h3>

    <p className="text-gray-500 text-xs mb-6 font-bold uppercase tracking-widest">
        Valid for {plan.durationDays} days
    </p>
    
    <div className="mb-8 flex items-baseline gap-1">
        <span className="text-5xl font-black tracking-tighter text-white">
            ₹{plan.price}
        </span>
        <span className="text-gray-500 text-sm font-bold">/period</span>
    </div>

    <ul className="space-y-4 mb-10 flex-grow">
        {plan.features && plan.features.length > 0 ? (
            plan.features.map((feature, fIdx) => (
                <li key={fIdx} className="flex items-start text-sm group">
                    <span className="text-blue-500 mr-3 font-bold text-lg leading-none">✓</span> 
                    <span className="text-gray-300 group-hover:text-white transition-colors">
                        {feature}
                    </span>
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

    <button 
        onClick={() => navigate("/login")}
        className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg border border-white/10 hover:bg-white/5 text-white"
    >
        {plan.price === 0 ? "Get Started Free" : "Subscribe Now"}
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
                        <span className="text-lg font-bold tracking-tighter uppercase">HRMS<span className="text-blue-400">Pro</span></span>
                    </div>
                    <p className="text-xs text-gray-600 font-bold tracking-[0.3em] uppercase mb-8">Secure • Reliable • Enterprise Grade</p>
                    <div className="text-[10px] text-gray-700 uppercase tracking-widest">
                        © 2026 HRMS Pro. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default DynamicHRMSLandingPage;