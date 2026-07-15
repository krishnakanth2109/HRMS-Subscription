import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaLinkedinIn, FaGithub, FaInstagram, FaGlobe } from "react-icons/fa6";
import {
  Linkedin,
  Github,
  Instagram,
  Globe,
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Mail,
  User,
  Download,
  QrCode,
  FileText,
  ChevronRight,
  Lightbulb,
  ShieldCheck,
  Award,
  Users,
  X,
  ExternalLink,
  Lock,
  Send,
  Building,
  Quote,
  MapPin,
  Heart,
  Phone
} from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../api';
import { createPortal } from 'react-dom';

const getSecureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http:")) {
    return url.replace("http:", "https:");
  }
  return url;
};

// Map of string keys to Lucide icon components for dynamic company feature list
const IconMap = {
  lightbulb: Lightbulb,
  shield: ShieldCheck,
  award: Award,
  users: Users,
  building: Building,
  globe: Globe,
  briefcase: Briefcase
};

// SVG Laurel Branches for Verified Badge
const LaurelLeft = () => (
  <svg className="w-6 h-8 text-[#2563EB] hidden sm:block" viewBox="0 0 24 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 28C10 28 6 22 6 14C6 8.5 9 4.5 12 2" />
    <path d="M6 14c-2-1-4 0-3 2s3 1 3-2z" fill="currentColor" />
    <path d="M7 19c-2-1-4 1-3 3s3 0 3-3z" fill="currentColor" />
    <path d="M9 24c-2 0-3 2-2 3s3-1 2-3z" fill="currentColor" />
    <path d="M7 9c-2-1-3-3-1-4s3 2 1 4z" fill="currentColor" />
    <path d="M10 5c-1-2-3-2-3-.5s2 2.5 3 .5z" fill="currentColor" />
  </svg>
);

const LaurelRight = () => (
  <svg className="w-6 h-8 text-[#2563EB] hidden sm:block" viewBox="0 0 24 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 28C14 28 18 22 18 14C18 8.5 15 4.5 12 2" />
    <path d="M18 14c2-1 4 0 3 2s-3 1-3-2z" fill="currentColor" />
    <path d="M17 19c2-1 4 1 3 3s-3 0-3-3z" fill="currentColor" />
    <path d="M15 24c2 0 3 2 2 3s-3-1-2-3z" fill="currentColor" />
    <path d="M17 9c2-1 3-3 1-4s-3 2-1 4z" fill="currentColor" />
    <path d="M14 5c1-2 3-2 3-.5s-2 2.5-3 .5z" fill="currentColor" />
  </svg>
);

// Dotted Decorative Pattern (5x5 dot grid)
const DottedPattern = ({ className }) => (
  <svg className={`w-16 h-16 ${className}`} viewBox="0 0 80 80" fill="currentColor">
    <circle cx="10" cy="10" r="2" />
    <circle cx="25" cy="10" r="2" />
    <circle cx="40" cy="10" r="2" />
    <circle cx="55" cy="10" r="2" />
    <circle cx="70" cy="10" r="2" />
    <circle cx="10" cy="25" r="2" />
    <circle cx="25" cy="25" r="2" />
    <circle cx="40" cy="25" r="2" />
    <circle cx="55" cy="25" r="2" />
    <circle cx="70" cy="25" r="2" />
    <circle cx="10" cy="40" r="2" />
    <circle cx="25" cy="40" r="2" />
    <circle cx="40" cy="40" r="2" />
    <circle cx="55" cy="40" r="2" />
    <circle cx="70" cy="40" r="2" />
    <circle cx="10" cy="55" r="2" />
    <circle cx="25" cy="55" r="2" />
    <circle cx="40" cy="55" r="2" />
    <circle cx="55" cy="55" r="2" />
    <circle cx="70" cy="55" r="2" />
    <circle cx="10" cy="70" r="2" />
    <circle cx="25" cy="70" r="2" />
    <circle cx="40" cy="70" r="2" />
    <circle cx="55" cy="70" r="2" />
    <circle cx="70" cy="70" r="2" />
  </svg>
);

const PortfolioPage = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/employees/portfolio/${employeeId}`);
        setEmployee(res.data);
      } catch (err) {
        console.error("Failed to fetch portfolio:", err);
        setError("Employee not found or portfolio is unavailable.");
      } finally {
        setLoading(false);
      }
    };

    if (employeeId) {
      fetchPortfolio();
    }
  }, [employeeId]);

  // Framer Motion Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.05,
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }
  };

  const avatarVariants = {
    hidden: { scale: 0.9, opacity: 0 },
    show: {
      scale: 1, opacity: 1,
      transition: { type: "spring", stiffness: 120, damping: 14, delay: 0.1 }
    }
  };

  const portfolioUrl = `${window.location.origin}/portfolio/${employeeId}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(portfolioUrl)}`;

  // --- Loading State ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Soft Background Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-blue-100/40 to-indigo-100/30 blur-3xl opacity-70 pointer-events-none z-0" />
        <div className="absolute bottom-[10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-blue-50/50 to-sky-100/30 blur-3xl opacity-80 pointer-events-none z-0" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="animate-spin h-12 w-12 border-4 border-[#2563EB] border-t-transparent rounded-full mb-4"></div>
          <p className="text-sm font-semibold text-gray-500 tracking-wide">Loading Digital ID...</p>
        </div>
      </div>
    );
  }

  // --- Error State ---
  if (error || !employee) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Soft Background Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-blue-100/40 to-indigo-100/30 blur-3xl opacity-70 pointer-events-none z-0" />
        <div className="absolute bottom-[10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-blue-50/50 to-sky-100/30 blur-3xl opacity-80 pointer-events-none z-0" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-md w-full bg-white rounded-[28px] border border-slate-200/60 p-4 lg:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] text-center flex flex-col items-center"
        >
          <AlertCircle className="w-16 h-16 text-[#2563EB] mb-4 opacity-75" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Digital ID Not Found</h2>
          <p className="text-gray-500 mb-8 text-sm">{error || "This employee profile could not be loaded."}</p>
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3.5 bg-[#2563EB] text-white rounded-2xl hover:bg-[#1E40AF] transition-all font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        </motion.div>
      </div>
    );
  }

  const initials = employee?.name ? employee.name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().substring(0, 2) : '';
  const formattedCompanyName = employee.companyName
    ? employee.companyName.replace(/\s*(pvt\.?\s*ltd\.?|private\s*limited)/i, '').trim()
    : 'Arah Infotech';

  return (
    <div className="min-h-screen bg-[#FAFBFF] flex flex-col font-sans relative overflow-hidden text-[#0F172A]">

      {/* Desktop Fixed Header (Back Button & Company Logo) */}
      <div className="hidden lg:flex fixed left-8 right-8 top-8 z-40 items-center justify-between pointer-events-none">
        <button
          onClick={() => navigate('/')}
          aria-label="Go back"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/60 backdrop-blur-md border border-slate-200/60 text-slate-700 shadow-md hover:bg-white hover:text-[#2563EB] cursor-pointer transition-all hover:scale-105"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="pointer-events-auto flex h-11 max-w-[200px] items-center justify-center rounded-full border border-slate-200/60 bg-white/60 backdrop-blur-md px-5 shadow-md">
          {employee.companyLogo ? (
            <img
              src={getSecureUrl(employee.companyLogo)}
              alt={`${formattedCompanyName} logo`}
              className="h-7 max-w-[160px] object-contain"
            />
          ) : (
            <span className="text-sm font-bold text-slate-700">{formattedCompanyName}</span>
          )}
        </div>
      </div>

      {/* ================= BACKGROUND (Desktop & Mobile) ================= */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 select-none">
        {/* Large Soft Mesh Gradients - Desktop */}
        <div className="hidden lg:block">
          <div className="absolute top-[-10%] left-[-15%] w-[800px] h-[800px] rounded-full bg-gradient-to-tr from-[#DBEAFE] via-[#D2E4FF]/60 to-transparent blur-3xl opacity-85" />
          <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#BFDBFE]/50 via-[#DCEBFF]/20 to-transparent blur-3xl opacity-80" />
          <div className="absolute bottom-[-10%] left-[10%] w-[700px] h-[700px] rounded-full bg-gradient-to-tr from-[#D2E4FF]/60 via-[#EAF3FF]/30 to-transparent blur-3xl opacity-75" />
        </div>

        {/* Soft Gradients - Mobile */}
        <div className="lg:hidden">
          <div className="absolute top-[-5%] left-[-10%] w-[320px] h-[320px] rounded-full bg-gradient-to-tr from-[#DBEAFE] via-[#D2E4FF]/50 to-transparent blur-3xl opacity-80" />
          <div className="absolute bottom-[15%] right-[-15%] w-[320px] h-[320px] rounded-full bg-gradient-to-br from-[#BFDBFE]/40 via-[#DCEBFF]/20 to-transparent blur-3xl opacity-75" />
        </div>

        {/* Desktop SVGs & Waves */}
        <div className="hidden lg:block">
          <svg className="absolute w-[150%] h-[120%] -top-[20%] -left-[25%]" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M-100,0 C250,50 450,300 850,220 C1250,140 1400,280 1600,320 L1600,0 L-100,0 Z" fill="url(#d-wave-1)" opacity="0.7" />
            <path d="M-50,0 C300,100 550,250 950,180 C1350,110 1500,240 1650,260 L1650,0 L-50,0 Z" fill="url(#d-wave-2)" opacity="0.5" />
            <path d="M1540,800 C1190,750 990,500 590,580 C190,660 40,520 -160,480 L-160,800 L1540,800 Z" fill="url(#d-wave-3)" opacity="0.4" />
            <path d="M1490,800 C1140,700 890,550 490,620 C90,690 -60,560 -210,540 L-210,800 L1490,800 Z" fill="url(#d-wave-4)" opacity="0.25" />
            <circle cx="150" cy="180" r="120" stroke="url(#d-circle-1)" strokeWidth="1.5" opacity="0.15" />
            <circle cx="1300" cy="620" r="160" stroke="url(#d-circle-2)" strokeWidth="1" opacity="0.12" />
            <circle cx="920" cy="280" r="5" fill="#3B82F6" opacity="0.85" />
            <circle cx="280" cy="540" r="4" fill="#2563EB" opacity="0.6" />
            <defs>
              <linearGradient id="d-wave-1" x1="0" y1="0" x2="1440" y2="800" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.85" />
                <stop offset="40%" stopColor="#C3DAFF" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#FAFBFF" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="d-wave-2" x1="1440" y1="0" x2="0" y2="800" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#D2E4FF" stopOpacity="0.75" />
                <stop offset="50%" stopColor="#B9D7FF" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="d-wave-3" x1="1440" y1="800" x2="0" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#C3DAFF" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#FAFBFF" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="d-wave-4" x1="0" y1="800" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#D2E4FF" stopOpacity="0.65" />
                <stop offset="50%" stopColor="#B9D7FF" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="d-circle-1" x1="30" y1="60" x2="270" y2="300" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="d-circle-2" x1="1140" y1="460" x2="1460" y2="780" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#818CF8" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Mobile-Optimized SVG & Waves */}
        <div className="lg:hidden">
          <svg className="absolute w-full h-full" viewBox="0 0 390 844" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M-50,0 C80,40 180,180 320,120 C360,105 380,130 440,140 L440,0 L-50,0 Z" fill="url(#m-wave-1)" opacity="0.65" />
            <path d="M440,844 C310,810 240,680 100,720 C60,735 20,710 -90,700 L-90,844 L440,844 Z" fill="url(#m-wave-2)" opacity="0.45" />
            <circle cx="80" cy="180" r="50" stroke="url(#m-circle-grad)" strokeWidth="1" opacity="0.1" />
            <circle cx="280" cy="220" r="3" fill="#3B82F6" opacity="0.6" />
            <circle cx="90" cy="620" r="2.5" fill="#2563EB" opacity="0.5" />
            <defs>
              <linearGradient id="m-wave-1" x1="0" y1="0" x2="390" y2="400" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.85" />
                <stop offset="60%" stopColor="#C3DAFF" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#FAFBFF" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="m-wave-2" x1="390" y1="844" x2="0" y2="444" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#D2E4FF" stopOpacity="0.65" />
                <stop offset="70%" stopColor="#B9D7FF" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="m-circle-grad" x1="30" y1="130" x2="130" y2="230" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Decorative floating circles - Desktop */}
        <div className="hidden lg:block">
          <motion.div
            animate={{ y: [0, -10, 0], rotate: 360 }}
            transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
            className="absolute top-[22%] left-[10%] w-32 h-32 rounded-full border border-blue-200/50"
          />
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 7, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-[25%] right-[8%] w-48 h-48 rounded-full border border-indigo-100/40"
          />
          <DottedPattern className="absolute top-12 left-10 text-blue-200/40" />
          <DottedPattern className="absolute top-12 right-10 text-blue-200/40" />
        </div>

        {/* Decorative floating circles - Mobile */}
        <div className="lg:hidden">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
            className="absolute top-[28%] left-[6%] w-16 h-16 rounded-full border border-blue-200/30"
          />
          <motion.div
            animate={{ y: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 8, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-[20%] right-[10%] w-24 h-24 rounded-full border border-indigo-100/30"
          />
          <div className="absolute top-4 lg:p-8 right-6 opacity-30 transform scale-75 origin-top-right">
            <DottedPattern className="text-blue-200/40" />
          </div>
        </div>
      </div>

      {/* Full-width cover Hero */}
      <section className="relative isolate z-10 h-[210px] sm:h-[240px] w-full overflow-hidden text-center lg:hidden">
        <div
          className="absolute -top-[1px] left-0 right-0 -bottom-[2px] bg-cover bg-center bg-no-repeat transition-transform duration-[8000ms] ease-out lg:group-hover:scale-[1.03]"
          style={{
            backgroundImage: employee?.portfolioBackgroundImageUrl
              ? `linear-gradient(
                to bottom,
                rgba(15,23,42,0.15) 0%,
                rgba(15,23,42,0.05) 45%,
                rgba(250,251,255,0) 70%,
                rgba(250,251,255,0.12) 82%,
                rgba(250,251,255,0.45) 92%,
                rgba(250,251,255,0.75) 97%,
                rgba(250,251,255,1) 100%
              ), url(${getSecureUrl(employee.portfolioBackgroundImageUrl)})`
              : "linear-gradient(135deg, #bfdbfe 0%, #dbeafe 48%, #eff6ff 100%)",
          }}
        />

        <div className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between sm:left-5 sm:right-5 sm:top-5 lg:left-8 lg:right-8 lg:top-8 lg:px-2">
          <button
            onClick={() => navigate('/')}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-[0_3px_12px_rgba(15,23,42,0.12)] transition-all hover:bg-white hover:text-[#2563EB] cursor-pointer lg:h-11 lg:w-11 lg:bg-white/10 lg:backdrop-blur-md lg:border lg:border-white/20 lg:text-white lg:hover:bg-white lg:hover:text-slate-900 lg:hover:border-white lg:shadow-[0_4px_20px_rgba(15,23,42,0.15)]"
          >
            <ArrowLeft className="h-4 w-4 lg:h-5 lg:w-5" />
          </button>
          <div className="flex h-9 sm:h-10 max-w-[170px] items-center justify-center rounded-full border border-white/35 bg-white/20 px-3 shadow-[0_4px_16px_rgba(15,23,42,0.18)] backdrop-blur-md sm:px-4 lg:h-11 lg:max-w-[200px] lg:bg-white/10 lg:border lg:border-white/20 lg:px-5 lg:shadow-[0_4px_20px_rgba(15,23,42,0.15)]">
            {employee.companyLogo ? (
              <img
                src={getSecureUrl(employee.companyLogo)}
                alt={`${formattedCompanyName} logo`}
                className="h-5 max-w-[120px] object-contain sm:h-6 sm:max-w-[145px] lg:h-7 lg:max-w-[160px]"
              />
            ) : (
              <span className="text-xs font-bold text-white [text-shadow:0_1px_3px_rgba(15,23,42,0.55)] sm:text-sm lg:text-base">{formattedCompanyName}</span>
            )}
          </div>
        </div>

        {/* Centered Hero content wrapper */}
        <div className="relative z-10 w-full flex flex-col items-center justify-end text-center h-[210px] sm:h-[240px] px-5 pb-5">
          <div className="flex flex-col items-center">
            <motion.div
              variants={avatarVariants}
              initial="hidden"
              animate="show"
              className="mb-1 h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-full border-2 border-white/40 bg-blue-50 shadow-[0_8px_24px_rgba(0,0,0,0.25)] shrink-0"
            >
              {employee.profileImageUrl ? (
                <img src={getSecureUrl(employee.profileImageUrl)} alt={employee.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-[#2563EB] sm:text-4xl">{initials}</div>
              )}
            </motion.div>
            <h1 className="mb-0 px-2 text-sm font-bold leading-tight tracking-tight text-white [text-shadow:0_1px_4px_rgba(15,23,42,0.75)] sm:mb-0.5 sm:text-xl">{employee.name}</h1>
            <p className="mb-0.5 text-[8.5px] font-bold uppercase tracking-[0.20em] text-white [text-shadow:0_1px_3px_rgba(15,23,42,0.7)] sm:mb-1 sm:text-xs sm:tracking-[0.25em]">{employee.currentRole || employee.designation || employee.experienceDetails?.[employee.experienceDetails.length - 1]?.role || employee.role || 'Professional'}</p>
            <div className="mt-1 h-0.5 w-6 rounded-full bg-[#2563EB] sm:w-8" />
          </div>
        </div>
      </section>

      {/* Previous page header is replaced by the cover Hero controls. */}
      <div className="hidden w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 items-center justify-between relative z-20">
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center bg-white p-3 sm:px-4 sm:py-2.5 rounded-2xl border border-slate-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.02)] text-gray-700 hover:text-[#2563EB] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline font-semibold text-sm ml-2">Back</span>
        </button>

        <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          {employee.companyLogo ? (
            <img
              src={getSecureUrl(employee.companyLogo)}
              alt="Company Logo"
              className="h-8 w-auto object-contain"
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#2563EB] flex items-center justify-center text-white font-black text-xs">AI</div>
              <span className="font-bold text-gray-900 text-sm">{formattedCompanyName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-0 sm:py-2 lg:pt-14 lg:pb-12 lg:flex-1 block lg:flex lg:flex-col lg:justify-start relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >

          {/* LEFT SIDEBAR (Desktop) */}
          <motion.div
            variants={itemVariants}
            className="hidden lg:flex lg:col-span-3 flex-col gap-3"
          >
            {(employee.companyName || employee.companyLogo || employee.companyTagline || employee.companyDescription || (employee.companyFeatures && employee.companyFeatures.length > 0)) && (
              <div className="bg-white/80 backdrop-blur-md rounded-[28px] border border-slate-200/60 p-4 lg:p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] hover:shadow-[0_25px_70px_rgba(15,23,42,0.12)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col items-center text-center lg:min-h-[300px] lg:justify-center">
                {employee.companyLogo ? (
                  <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4 border border-blue-100/50">
                    <img
                      src={getSecureUrl(employee.companyLogo)}
                      alt="Company Logo"
                      className="w-10 h-10 object-contain"
                    />
                  </div>
                ) : (
                  employee.companyName && (
                    <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4 border border-blue-100/50">
                      <Building className="w-8 h-8 text-[#2563EB]" />
                    </div>
                  )
                )}

                {employee.companyName && (
                  <h3 className="text-lg font-bold text-[#0F172A] mb-1">{formattedCompanyName}</h3>
                )}

                {employee.companyTagline && (
                  <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-widest mb-4">{employee.companyTagline}</p>
                )}

                {employee.companyDescription && (
                  <p className="text-xs text-gray-500 mb-4 leading-relaxed">{employee.companyDescription}</p>
                )}

                {employee.company?.officeLocation?.address && (
                  <div className="w-full text-left mb-4 p-4 lg:p-3 rounded-2xl bg-slate-50 border border-slate-100/80">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Company Address</span>
                    <span className="text-xs font-semibold text-gray-600 leading-relaxed block">
                      {employee.company.officeLocation.address}
                      {employee.company.officeLocation.city && `, ${employee.company.officeLocation.city}`}
                      {employee.company.officeLocation.state && `, ${employee.company.officeLocation.state}`}
                      {employee.company.officeLocation.zipCode && ` - ${employee.company.officeLocation.zipCode}`}
                    </span>
                  </div>
                )}

                {((employee.companyName || employee.companyLogo) && employee.companyFeatures && employee.companyFeatures.length > 0) && (
                  <div className="w-full h-px bg-slate-100 mb-4" />
                )}

                {employee.companyFeatures && employee.companyFeatures.length > 0 && (
                  <div className="flex flex-col gap-3 text-left w-full">
                    {employee.companyFeatures.map((feature, idx) => {
                      const IconComponent = IconMap[feature.icon?.toLowerCase()] || Award;
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50/50 flex items-center justify-center text-[#2563EB]">
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-gray-600">{feature.title}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Dynamic Company Quote */}
            {employee.companyQuote && (
              <div className="bg-white/80 backdrop-blur-md rounded-[28px] border border-slate-200/60 p-6 lg:p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] hover:shadow-[0_25px_70px_rgba(15,23,42,0.12)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col gap-4 lg:gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50/50 flex items-center justify-center text-[#2563EB]">
                  <Quote className="w-4 h-4" />
                </div>
                <p className="text-sm font-medium text-gray-600 italic leading-relaxed">
                  "{employee.companyQuote.text || employee.companyQuote}"
                </p>
                {employee.companyQuote.author && (
                  <div className="text-[11px] font-bold text-[#C28B53] tracking-widest uppercase mt-1">
                    — {employee.companyQuote.author}
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* CENTER COLUMN (Profile) */}
          <motion.div
            variants={itemVariants}
            className="col-span-1 lg:col-span-6 block w-full animate-none"
          >
            <div className="w-full block">

              {/* Desktop Hero Card */}
              <div className="hidden lg:block w-full overflow-hidden rounded-t-[28px] bg-transparent mb-4 relative h-[260px] lg:h-[280px] group">
                {/* Background Cover image/gradient */}
                <div
                  className="absolute -top-[1px] left-0 right-0 -bottom-[2px] bg-cover bg-center bg-no-repeat transition-transform duration-[8000ms] ease-out group-hover:scale-[1.03]"
                  style={{
                    backgroundImage: employee?.portfolioBackgroundImageUrl
                      ? `linear-gradient(
                  to bottom,
                  rgba(15,23,42,0.20) 0%,
                  rgba(15,23,42,0.05) 45%,
                  rgba(250,251,255,0) 70%,
                  rgba(250,251,255,0.12) 82%,
                  rgba(250,251,255,0.45) 92%,
                  rgba(250,251,255,0.75) 97%,
                  rgba(250,251,255,1) 100%
                ), url(${getSecureUrl(employee.portfolioBackgroundImageUrl)})`
                      : "linear-gradient(135deg, #bfdbfe 0%, #dbeafe 48%, #eff6ff 100%)",
                  }}
                />

                {/* Vertically centered Hero content */}
                <div className="relative z-10 w-full flex flex-col items-center justify-end text-center h-[260px] lg:h-[280px] px-6 pb-6">
                  <div className="flex flex-col items-center">
                    <motion.div
                      variants={avatarVariants}
                      initial="hidden"
                      animate="show"
                      className="mb-2 h-28 w-28 lg:h-32 lg:w-32 overflow-hidden rounded-full border-[3px] border-white/40 bg-blue-50 shadow-[0_12px_36px_rgba(0,0,0,0.3)] shrink-0"
                    >
                      {employee.profileImageUrl ? (
                        <img src={getSecureUrl(employee.profileImageUrl)} alt={employee.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl lg:text-4xl font-bold text-[#2563EB]">{initials}</div>
                      )}
                    </motion.div>
                    <h1 className="mb-1 text-2xl font-bold text-white [text-shadow:0_1px_4px_rgba(15,23,42,0.75)]">{employee.name}</h1>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-white [text-shadow:0_1px_3px_rgba(15,23,42,0.7)]">{employee.currentRole || employee.designation || employee.experienceDetails?.[employee.experienceDetails.length - 1]?.role || employee.role || 'Professional'}</p>
                    <div className="mt-2 h-1 w-10 rounded-full bg-[#2563EB] shadow-[0_2px_8px_rgba(37,99,235,0.4)]" />
                  </div>
                </div>
              </div>

              <motion.div
                variants={avatarVariants}
                className="hidden"
              >
                <div className="w-full h-full rounded-full bg-blue-50 flex items-center justify-center text-5xl font-bold text-[#2563EB] overflow-hidden border border-slate-100">
                  {employee.profileImageUrl ? (
                    <img
                      src={getSecureUrl(employee.profileImageUrl)}
                      alt={employee.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    initials
                  )}
                </div>
              </motion.div>

              <div className="hidden">
                <h1 className="text-3xl sm:text-4xl lg:text-[56px] font-bold text-[#0F172A] tracking-tight leading-none text-center px-2">
                  {employee.name}
                </h1>
              </div>

              <h2 className="hidden">
                {employee.currentRole || employee.designation || employee.experienceDetails?.[employee.experienceDetails.length - 1]?.role || employee.role || 'Professional'}
              </h2>

              <div className="hidden" />

              <div className="w-full flex flex-col gap-2 sm:gap-2.5 lg:gap-2.5 mt-4 lg:mt-0 mb-0 px-2 sm:px-0">
                {/* About / Bio Section */}
                {employee.bio && (
                  <div className="bg-transparent rounded-[20px] sm:rounded-[24px] px-3.5 py-2.5 sm:p-5 lg:p-6 shadow-none flex flex-col">
                    <p className="text-center text-xs sm:text-sm font-medium text-gray-600 leading-relaxed break-words whitespace-pre-line">
                      {employee.bio}
                    </p>
                  </div>
                )}

                {/* Full Name */}
                <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-[14px] sm:rounded-[24px] p-2.5 sm:p-5 lg:p-3.5 shadow-[0_4px_20px_rgba(15,23,42,0.02)] flex items-center hover:shadow-[0_8px_30px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 transition-all duration-300">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-blue-50/60 text-[#2563EB] flex items-center justify-center mr-3 border border-blue-100/20 shadow-inner flex-shrink-0">
                    <User className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Full Name</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-700 break-all">{employee.name || '--'}</span>
                  </div>
                </div>

                {/* Employee ID */}
                <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-[14px] sm:rounded-[24px] p-2.5 sm:p-5 lg:p-3.5 shadow-[0_4px_20px_rgba(15,23,42,0.02)] flex items-center hover:shadow-[0_8px_30px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 transition-all duration-300">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-blue-50/60 text-[#2563EB] flex items-center justify-center mr-3 border border-blue-100/20 shadow-inner flex-shrink-0">
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Employee ID</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-700 break-all">{employee.employeeId || '--'}</span>
                  </div>
                </div>

                {/* Department */}
                <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-[14px] sm:rounded-[24px] p-2.5 sm:p-5 lg:p-3.5 shadow-[0_4px_20px_rgba(15,23,42,0.02)] flex items-center hover:shadow-[0_8px_30px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 transition-all duration-300">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-blue-50/60 text-[#2563EB] flex items-center justify-center mr-3 border border-blue-100/20 shadow-inner flex-shrink-0">
                    <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Department</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-700 break-all">{employee.department || employee.experienceDetails?.[0]?.department || '--'}</span>
                  </div>
                </div>

                {/* Dynamic Custom Fields (added into Employee Details / Info) */}
                {employee.customPortfolioFields && employee.customPortfolioFields.map((field, i) => (
                  field.value && (
                    <div key={i} className="bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-[14px] sm:rounded-[24px] p-2.5 sm:p-5 lg:p-3.5 shadow-[0_4px_20px_rgba(15,23,42,0.02)] flex items-center hover:shadow-[0_8px_30px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 transition-all duration-300">
                      <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-blue-50/60 text-[#2563EB] flex items-center justify-center mr-3 border border-blue-100/20 shadow-inner flex-shrink-0">
                        <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{field.label}</span>
                        {field.value?.startsWith('http') ? (
                          <a
                            href={field.value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs sm:text-sm font-semibold text-[#2563EB] hover:underline break-all"
                          >
                            View Link <ExternalLink className="inline w-3 h-3 ml-0.5" />
                          </a>
                        ) : (
                          <span className="text-xs sm:text-sm font-semibold text-gray-700 break-all">{field.value}</span>
                        )}
                      </div>
                    </div>
                  )
                ))}

                {/* Official Email (Mobile only) */}
                {employee.email && (
                  <div className="lg:hidden bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-[14px] sm:rounded-[24px] p-2.5 sm:p-5 shadow-[0_4px_20px_rgba(15,23,42,0.02)] flex items-center hover:shadow-[0_8px_30px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 transition-all duration-300">
                    <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-blue-50/60 text-[#2563EB] flex items-center justify-center mr-3 border border-blue-100/20 shadow-inner flex-shrink-0">
                      <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Official Email</span>
                      <a href={`mailto:${employee.email}`} className="text-xs sm:text-sm font-semibold text-gray-700 hover:text-[#2563EB] hover:underline break-all">
                        {employee.email}
                      </a>
                    </div>
                  </div>
                )}

                {/* Mobile Number (Mobile only) */}
                {(employee.phone || employee.phoneNumber) && (
                  <div className="lg:hidden bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-[14px] sm:rounded-[24px] p-2.5 sm:p-5 shadow-[0_4px_20px_rgba(15,23,42,0.02)] flex items-center hover:shadow-[0_8px_30px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 transition-all duration-300">
                    <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-blue-50/60 text-[#2563EB] flex items-center justify-center mr-3 border border-blue-100/20 shadow-inner flex-shrink-0">
                      <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Mobile Number</span>
                      <a href={`tel:${employee.phone || employee.phoneNumber}`} className="text-xs sm:text-sm font-semibold text-gray-700 hover:text-[#2563EB] hover:underline break-all">
                        {employee.phone || employee.phoneNumber}
                      </a>
                    </div>
                  </div>
                )}

                {/* Blood Group (Mobile only) */}
                <div className="lg:hidden bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-[14px] sm:rounded-[24px] p-2.5 sm:p-5 shadow-[0_4px_20px_rgba(15,23,42,0.02)] flex items-center hover:shadow-[0_8px_30px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 transition-all duration-300">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-red-50/60 text-[#EF4444] flex items-center justify-center mr-3 border border-red-100/20 shadow-inner flex-shrink-0">
                    <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Blood Group</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-700 break-all">{employee.personalDetails?.bloodGroup || '--'}</span>
                  </div>
                </div>


              </div>

              {employee.socialLinks && (employee.socialLinks.linkedin || employee.socialLinks.github || employee.socialLinks.instagram || employee.socialLinks.website) && (
                <div className="w-full block text-center mt-5 mb-5 lg:mt-0 lg:mb-0">
                  <div className="flex items-center justify-center gap-4 w-full lg:my-6">
                    <div className="flex items-center flex-1 justify-end">
                      <div className="h-px bg-gradient-to-r from-transparent to-blue-200 w-16" />
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-300 ml-1" />
                    </div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest px-2 whitespace-nowrap">Social Links</span>
                    <div className="flex items-center flex-1 justify-start">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-300 mr-1" />
                      <div className="h-px bg-gradient-to-l from-transparent to-blue-200 w-16" />
                    </div>
                  </div>

                  <div className="flex justify-center gap-4 mb-6">
                    {employee.socialLinks.linkedin && (
                      <motion.a
                        whileTap={{ scale: 0.95 }}
                        href={employee.socialLinks.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white dark:bg-slate-100 shadow-sm flex items-center justify-start pl-[8px] text-[#64748B] hover:text-[#0077b5] hover:shadow-[0_10px_20px_rgba(0,119,181,0.12)] hover:-translate-y-[2px] transition-all duration-300 ease-in-out cursor-pointer hover:w-[150px] hover:pr-4 group"
                      >
                        <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-all duration-300 group-hover:bg-[#0077b5]/10">
                          <FaLinkedinIn className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 transition-transform duration-300 group-hover:scale-110" />
                        </span>
                        <span className="max-w-0 opacity-0 -translate-x-2 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap font-semibold text-sm group-hover:max-w-[100px] group-hover:opacity-100 group-hover:translate-x-0 group-hover:ml-3">
                          LinkedIn
                        </span>
                      </motion.a>
                    )}
                    {employee.socialLinks.instagram && (
                      <motion.a
                        whileTap={{ scale: 0.95 }}
                        href={employee.socialLinks.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white dark:bg-slate-100 shadow-sm flex items-center justify-start pl-[8px] text-[#64748B] hover:text-[#e1306c] hover:shadow-[0_10px_20px_rgba(225,48,108,0.12)] hover:-translate-y-[2px] transition-all duration-300 ease-in-out cursor-pointer hover:w-[155px] hover:pr-4 group border border-slate-200/40"
                      >
                        <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-all duration-300 group-hover:bg-[#e1306c]/10">
                          <FaInstagram className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 transition-transform duration-300 group-hover:scale-110" />
                        </span>
                        <span className="max-w-0 opacity-0 -translate-x-2 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap font-semibold text-sm group-hover:max-w-[100px] group-hover:opacity-100 group-hover:translate-x-0 group-hover:ml-3">
                          Instagram
                        </span>
                      </motion.a>
                    )}
                    {employee.socialLinks.github && (
                      <motion.a
                        whileTap={{ scale: 0.95 }}
                        href={employee.socialLinks.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white dark:bg-slate-100 shadow-sm flex items-center justify-start pl-[8px] text-[#64748B] hover:text-[#171515] dark:hover:text-[#0f172a] hover:shadow-[0_10px_20px_rgba(23,21,21,0.12)] dark:hover:shadow-[0_10px_20px_rgba(15,23,42,0.12)] hover:-translate-y-[2px] transition-all duration-300 ease-in-out cursor-pointer hover:w-[135px] hover:pr-4 group border border-slate-200/40"
                      >
                        <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-all duration-300 group-hover:bg-[#171515]/10">
                          <FaGithub className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 transition-transform duration-300 group-hover:scale-110" />
                        </span>
                        <span className="max-w-0 opacity-0 -translate-x-2 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap font-semibold text-sm group-hover:max-w-[100px] group-hover:opacity-100 group-hover:translate-x-0 group-hover:ml-3">
                          GitHub
                        </span>
                      </motion.a>
                    )}
                    {employee.socialLinks.website && (
                      <motion.a
                        whileTap={{ scale: 0.95 }}
                        href={employee.socialLinks.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white dark:bg-slate-100 shadow-sm flex items-center justify-start pl-[8px] text-[#64748B] hover:text-[#2563eb] hover:shadow-[0_10px_20px_rgba(37,99,235,0.12)] hover:-translate-y-[2px] transition-all duration-300 ease-in-out cursor-pointer hover:w-[140px] hover:pr-4 group border border-slate-200/40"
                      >
                        <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-all duration-300 group-hover:bg-[#2563eb]/10">
                          <FaGlobe className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 transition-transform duration-300 group-hover:scale-110" />
                        </span>
                        <span className="max-w-0 opacity-0 -translate-x-2 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap font-semibold text-sm group-hover:max-w-[100px] group-hover:opacity-100 group-hover:translate-x-0 group-hover:ml-3">
                          Portfolio
                        </span>
                      </motion.a>
                    )}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
          {/* RIGHT SIDEBAR (Contact Details) */}
          <motion.div
            variants={itemVariants}
            className="hidden lg:flex lg:col-span-3 flex-col gap-3"
          >
            <div className="bg-white/80 backdrop-blur-md rounded-[28px] border border-slate-200/60 p-4 lg:p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] hover:shadow-[0_25px_70px_rgba(15,23,42,0.12)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col w-full lg:min-h-[300px] lg:justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0F172A] mb-2 text-center">Contact Information</h3>
                <div className="w-8 h-0.5 bg-[#2563EB] mx-auto mb-4 rounded-full" />
              </div>

              <div className="flex flex-col gap-3 lg:gap-2 flex-grow lg:justify-center">

                {/* Official Email */}
                <div className="bg-white/75 backdrop-blur-md border border-slate-200/40 rounded-2xl p-4 lg:p-2.5 flex items-center hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  <div className="w-9 h-9 rounded-xl bg-blue-50/60 text-[#2563EB] flex items-center justify-center mr-3 border border-blue-100/10 shadow-inner flex-shrink-0">
                    <Mail className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Official Email</span>
                    {employee.email ? (
                      <a href={`mailto:${employee.email}`} className="text-xs xl:text-sm font-semibold text-gray-700 hover:text-[#2563EB] hover:underline break-all">
                        {employee.email}
                      </a>
                    ) : (
                      <span className="text-xs xl:text-sm font-semibold text-gray-400">--</span>
                    )}
                  </div>
                </div>

                {/* Mobile Number */}
                <div className="bg-white/75 backdrop-blur-md border border-slate-200/40 rounded-2xl p-4 lg:p-2.5 flex items-center hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  <div className="w-9 h-9 rounded-xl bg-blue-50/60 text-[#2563EB] flex items-center justify-center mr-3 border border-blue-100/10 shadow-inner flex-shrink-0">
                    <Phone className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Mobile Number</span>
                    {employee.phone || employee.phoneNumber ? (
                      <a href={`tel:${employee.phone || employee.phoneNumber}`} className="text-xs xl:text-sm font-semibold text-gray-700 hover:text-[#2563EB] hover:underline break-all">
                        {employee.phone || employee.phoneNumber}
                      </a>
                    ) : (
                      <span className="text-xs xl:text-sm font-semibold text-gray-400">--</span>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div className="bg-white/75 backdrop-blur-md border border-slate-200/40 rounded-2xl p-4 lg:p-2.5 flex items-center hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  <div className="w-9 h-9 rounded-xl bg-blue-50/60 text-[#2563EB] flex items-center justify-center mr-3 border border-blue-100/10 shadow-inner flex-shrink-0">
                    <MapPin className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Location</span>
                    <span className="text-xs xl:text-sm font-semibold text-gray-700 break-all">
                      {employee.address || '--'}
                    </span>
                  </div>
                </div>

                {/* Blood Group */}
                <div className="bg-white/75 backdrop-blur-md border border-slate-200/40 rounded-2xl p-4 lg:p-2.5 flex items-center hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  <div className="w-9 h-9 rounded-xl bg-red-50/60 text-[#EF4444] flex items-center justify-center mr-3 border border-red-100/10 shadow-inner flex-shrink-0">
                    <Heart className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Blood Group</span>
                    <span className="text-xs xl:text-sm font-semibold text-gray-700 break-all">{employee.personalDetails?.bloodGroup || '--'}</span>
                  </div>
                </div>


              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Modal Portals (Keep functions active) */}
        {showQrModal && createPortal(
          <div
            onClick={() => setShowQrModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[28px] border border-slate-200/60 p-4 lg:p-8 shadow-2xl w-full max-w-sm flex flex-col items-center relative cursor-default"
            >
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-bold text-[#0F172A] mt-2 mb-1">Portfolio QR Code</h3>
              <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-widest mb-6">Scan to view Digital ID</p>
              <div className="bg-slate-50 border border-slate-200/60 rounded-[24px] p-6 mb-6 shadow-inner relative">
                <img
                  src={qrCodeUrl}
                  alt="Employee Portfolio QR Code"
                  className="w-44 h-44 object-contain bg-white rounded-xl shadow-sm border border-gray-50 p-2"
                />
              </div>
              <div className="flex flex-col gap-2 w-full mt-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(portfolioUrl);
                    alert("Portfolio URL copied to clipboard!");
                  }}
                  className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-[#0F172A] bg-white border border-slate-200/60 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm w-full cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Copy Link</span>
                </button>
                <a
                  href={qrCodeUrl}
                  download={`${employee.name ? employee.name.replace(/\s+/g, '_') : 'employee'}_QR_Code.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white bg-[#2563EB] rounded-2xl hover:bg-[#1E40AF] transition-colors shadow-sm w-full cursor-pointer text-center"
                >
                  <Download className="w-4 h-4" />
                  <span>Download QR</span>
                </a>
              </div>
            </div>
          </div>,
          document.body
        )}

        {showDocsModal && createPortal(
          <div
            onClick={() => setShowDocsModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[28px] border border-slate-200/60 p-4 lg:p-8 shadow-2xl w-full max-w-md flex flex-col relative cursor-default"
            >
              <button
                onClick={() => setShowDocsModal(false)}
                className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-bold text-[#0F172A] mt-2 mb-1">Employee Documents</h3>
              <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-widest mb-6">Shared Professional Credentials</p>
              <div className="flex flex-col gap-3 my-2">
                {[
                  { name: 'Curriculum Vitae / Resume.pdf', type: 'PDF', icon: FileText },
                  { name: 'Academic Certifications.pdf', type: 'PDF', icon: Award },
                  { name: 'Work Reference Letter.pdf', type: 'PDF', icon: ShieldCheck }
                ].map((doc, idx) => (
                  <div
                    key={idx}
                    onClick={() => alert(`Access to "${doc.name}" is restricted. Please contact the employee.`)}
                    className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/60 bg-slate-50/50 hover:bg-blue-50/20 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="w-9 h-9 rounded-xl bg-blue-50/50 flex items-center justify-center text-[#2563EB] mr-3">
                        <doc.icon className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-bold text-gray-700 leading-tight">{doc.name}</span>
                        <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{doc.type}</span>
                      </div>
                    </div>
                    <Lock className="w-4 h-4 text-gray-400" />
                  </div>
                ))}
              </div>
              <p className="mt-6 text-xs text-[#64748B] leading-relaxed text-center font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100">
                To request official copies or permissions to view these documents, please use the <strong className="text-[#2563EB]">Contact Me</strong> action.
              </p>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

export default PortfolioPage;
