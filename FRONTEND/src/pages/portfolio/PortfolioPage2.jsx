import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaLinkedinIn, FaGithub, FaInstagram, FaGlobe } from "react-icons/fa6";
import {
  Mail,
  Phone,
  Building,
  Calendar,
  ArrowLeft,
  Download,
  FileText,
  X,
  ExternalLink,
  Award,
  ShieldCheck,
  Lock,
  Send,
  Briefcase,
  Quote,
  Heart,
  Lightbulb,
  Users,
  Globe
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import api from '../../api';
import { createPortal } from 'react-dom';

const IconMap = {
  lightbulb: Lightbulb,
  shield: ShieldCheck,
  award: Award,
  users: Users,
  building: Building,
  globe: Globe,
  briefcase: Briefcase
};

const getSecureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http:")) {
    return url.replace("http:", "https:");
  }
  return url;
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  const options = { year: 'numeric', month: 'long' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

/* Fraunces (display) + Manrope (body) — loaded once, scoped to this page */
const useFonts = () => {
  useEffect(() => {
    const id = 'portfolio-fonts-link';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@500;600;700;800&display=swap';
    document.head.appendChild(link);
  }, []);
};

const PortfolioPage2 = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  useFonts();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Motion variants — respects prefers-reduced-motion automatically
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: shouldReduceMotion
        ? { duration: 0.15 }
        : { staggerChildren: 0.09, delayChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 22 },
    show: {
      opacity: 1,
      y: 0,
      transition: shouldReduceMotion
        ? { duration: 0.2 }
        : { type: "spring", stiffness: 120, damping: 18 }
    }
  };

  const portfolioUrl = `${window.location.origin}/portfolio2/${employeeId}`;
  const backgroundImage =
    employee?.portfolioBackgroundImageUrl ||
    "";

  /* -------------------------- Loading state -------------------------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F7FB] flex flex-col items-center justify-center p-6 font-['Manrope',sans-serif]">
        <div className="flex flex-col items-center">
          <div className="w-11 h-11 rounded-full border-[3px] border-[#16213B]/15 border-t-[#B8874B] animate-spin mb-4" />
          <p className="text-xs font-bold text-slate-400 tracking-widest uppercase">Loading Profile</p>
        </div>
      </div>
    );
  }

  /* --------------------------- Error state ---------------------------- */
  if (error || !employee) {
    return (
      <div className="min-h-screen bg-[#F6F7FB] flex flex-col items-center justify-center p-6 font-['Manrope',sans-serif]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full bg-white rounded-3xl border border-slate-200/70 p-8 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.15)] text-center flex flex-col items-center"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-2xl bg-[#16213B]/5 flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-[#16213B]/40" />
          </div>
          <h2 className="text-xl font-bold text-[#16213B] mb-1.5" style={{ fontFamily: "'Fraunces', serif" }}>
            Profile unavailable
          </h2>
          <p className="text-slate-500 mb-7 text-sm leading-relaxed">{error || "This employee profile could not be loaded."}</p>
          <button
            onClick={() => navigate(-1)}
            className="w-full py-2.5 lg:py-3.5 bg-[#16213B] hover:bg-[#0F1729] text-white rounded-xl transition-colors font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go back</span>
          </button>
        </motion.div>
      </div>
    );
  }

  const initials = employee?.name ? employee.name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().substring(0, 2) : '';
  const formattedCompanyName = employee.companyName
    ? employee.companyName.replace(/\s*(pvt\.?\s*ltd\.?|private\s*limited)/i, '').trim()
    : 'Arah Infotech';

  const renderCompanyDetails = (isMobile = false) => {
    if (!(employee.companyName || employee.companyLogo || employee.companyTagline || employee.companyDescription || (employee.companyFeatures && employee.companyFeatures.length > 0))) {
      return null;
    }
    return (
      <div className={`${isMobile ? 'lg:hidden' : 'hidden lg:flex'} flex-col gap-4 lg:gap-3.5 bg-white rounded-2xl lg:rounded-[2rem] border border-slate-200/60 p-4 lg:p-5 shadow-[0_16px_48px_-16px_rgba(22,33,59,0.08)]`}>
        <div className="flex items-center gap-4">
          {employee.companyLogo ? (
            <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-200/40 p-2.5 shrink-0">
              <img
                src={getSecureUrl(employee.companyLogo)}
                alt="Company Logo"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            employee.companyName && (
              <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-200/40 shrink-0">
                <Building className="w-6 h-6 text-[#16213B]" />
              </div>
            )
          )}
          <div>
            {employee.companyName && (
              <h3 className="text-base font-bold text-[#16213B]" style={{ fontFamily: "'Fraunces', serif" }}>
                {formattedCompanyName}
              </h3>
            )}
            {employee.companyTagline && (
              <p className="text-[10px] text-[#96692F] font-bold uppercase tracking-widest mt-0.5">
                {employee.companyTagline}
              </p>
            )}
          </div>
        </div>

        {employee.companyDescription && (
          <p className="text-xs text-slate-500 leading-relaxed text-left">
            {employee.companyDescription}
          </p>
        )}

        {employee.company?.officeLocation?.address && (
          <div className="w-full text-left p-4 lg:p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Company Address</span>
            <span className="text-xs font-semibold text-slate-600 leading-relaxed block">
              {employee.company.officeLocation.address}
              {employee.company.officeLocation.city && `, ${employee.company.officeLocation.city}`}
              {employee.company.officeLocation.state && `, ${employee.company.officeLocation.state}`}
              {employee.company.officeLocation.zipCode && ` - ${employee.company.officeLocation.zipCode}`}
            </span>
          </div>
        )}

        {employee.companyFeatures && employee.companyFeatures.length > 0 && (
          <div className="flex flex-col gap-3 lg:gap-2.5 text-left w-full border-t border-slate-100 pt-4">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Key Features</span>
            {employee.companyFeatures.map((feature, idx) => {
              const IconComponent = IconMap[feature.icon?.toLowerCase()] || Award;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#16213B]/5 flex items-center justify-center text-[#16213B] shrink-0">
                    <IconComponent className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-600">{feature.title}</span>
                </div>
              );
            })}
          </div>
        )}

        {employee.companyQuote && (
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 text-left">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Company Quote</span>
            <div className="flex gap-3">
              <Quote className="w-4 h-4 text-[#16213B]/40 shrink-0 mt-1" />
              <p className="text-xs font-medium text-slate-600 italic leading-relaxed">
                "{employee.companyQuote.text || employee.companyQuote}"
              </p>
            </div>
            {employee.companyQuote.author && (
              <div className="text-[9px] font-extrabold text-[#96692F] tracking-widest uppercase pl-7">
                — {employee.companyQuote.author}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] font-['Manrope',sans-serif] text-[#16213B] pb-14 relative overflow-x-hidden">

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
              alt="Company logo"
              className="h-7 max-w-[160px] object-contain"
            />
          ) : (
            <span className="text-sm font-bold text-slate-700">{formattedCompanyName}</span>
          )}
        </div>
      </div>

      {/* Mobile/Tablet Header Bar (Visible on mobile/tablet, hidden on desktop) */}
      <div className="w-full max-w-5xl mx-auto flex lg:hidden items-center justify-between px-4 pt-4 pb-3 relative z-30">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 bg-white/90 backdrop-blur px-4 rounded-xl border border-slate-200/70 shadow-sm text-slate-600 hover:text-[#16213B] active:scale-95 transition-all cursor-pointer h-10"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-semibold text-xs">Back</span>
        </button>

        <div className="flex items-center gap-3 bg-white/90 backdrop-blur px-4 rounded-xl border border-slate-200/70 shadow-sm h-10">
          {employee.companyLogo ? (
            <img src={getSecureUrl(employee.companyLogo)} alt="Company logo" className="h-6 w-auto object-contain" />
          ) : formattedCompanyName ? (
            <span className="font-bold text-[#16213B] text-xs tracking-wide">{formattedCompanyName}</span>
          ) : null}
        </div>
      </div>

      {/* ================= PREMIUM MINIMAL BACKGROUND ================= */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-[#FAFBFC]">
        {backgroundImage ? (
          <div className="absolute inset-0 w-full h-full">
            {/* Full-quality background image */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${getSecureUrl(backgroundImage)})` }}
            />
            {/* Dark overlay 20% for depth */}
            <div className="absolute inset-0 bg-[#0B1320]/20" />
            {/* Frosted glass overlay for premium contrast */}
            <div className="absolute inset-0 bg-white/35 backdrop-blur-[20px]" />
          </div>
        ) : (
          <>
            {/* Base Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-white via-[#FAFBFC] to-[#F5F7FB]" />

            {/* Aurora Light - Left */}
            <motion.div
              animate={{
                x: [0, 60, -40, 0],
                y: [0, 30, -20, 0],
                scale: [1, 1.08, 0.95, 1],
              }}
              transition={{
                duration: 24,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute -top-56 -left-56 w-[700px] h-[700px] rounded-full bg-violet-400/15 blur-[180px]"
            />

            {/* Aurora Light - Right */}
            <motion.div
              animate={{
                x: [0, -50, 40, 0],
                y: [0, -20, 20, 0],
                scale: [1, 0.95, 1.08, 1],
              }}
              transition={{
                duration: 28,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute top-20 -right-64 w-[750px] h-[750px] rounded-full bg-sky-400/14 blur-[200px]"
            />

            {/* Gold Accent */}
            <motion.div
              animate={{
                x: [0, 40, -20, 0],
                y: [0, -20, 20, 0],
              }}
              transition={{
                duration: 32,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute bottom-[-250px] left-1/3 w-[600px] h-[600px] rounded-full bg-amber-300/10 blur-[170px]"
            />

            {/* Small Accent */}
            <motion.div
              animate={{
                x: [0, 20, -20, 0],
                y: [0, 15, -15, 0],
              }}
              transition={{
                duration: 18,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute top-[45%] left-[15%] w-[260px] h-[260px] rounded-full bg-cyan-300/10 blur-[120px]"
            />

            {/* Soft Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_60%,rgba(15,23,42,0.04)_100%)]" />
          </>
        )}

      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-0 sm:pt-0 lg:pt-12 relative z-10"
      >

        {/* ================= SECTION 1: EMPLOYEE HERO (Full Width) ================= */}
        <motion.div variants={itemVariants} className="mb-3 lg:mb-4">
          <div className="bg-white rounded-2xl lg:rounded-[2rem] border border-slate-200/60 shadow-[0_16px_48px_-16px_rgba(22,33,59,0.08),0_0_1px_rgba(22,33,59,0.06)] overflow-hidden">
            {/* Cover banner */}
            <div className="relative h-24 sm:h-32 lg:h-36">
              {backgroundImage ? (
                <img
                  src={getSecureUrl(backgroundImage)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-r from-[#16213B] via-[#1E2C4D] to-[#0F1729]" />
              )}
              <div className="absolute inset-0 bg-black/10" />



              {/* Avatar overlapping banner */}
              <div className="absolute -bottom-10 sm:-bottom-13 lg:-bottom-15 left-4 sm:left-6">
                <div className="w-20 h-20 sm:w-26 sm:h-26 lg:w-30 lg:h-30 rounded-2xl bg-white p-1 shadow-lg border border-slate-100">
                  {employee.profileImageUrl ? (
                    <img
                      src={getSecureUrl(employee.profileImageUrl)}
                      alt={employee.name}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-[#16213B]/5 flex items-center justify-center">
                      <span className="text-2xl font-bold text-[#16213B]" style={{ fontFamily: "'Fraunces', serif" }}>{initials}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Identity & Actions row */}
            <div className="pt-12 sm:pt-14 lg:pt-16 pb-4 px-4 sm:px-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="text-left">
                <h1
                  className="text-xl sm:text-2xl font-semibold leading-tight text-[#16213B]"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  {employee.name}
                </h1>
                <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-widest">
                  {employee.role || 'Team Member'}
                </p>
                {employee.department && (
                  <p className="text-[11px] font-semibold text-[#96692F] mt-0.5 uppercase tracking-widest">
                    {employee.department}
                  </p>
                )}
                {employee.bio && (
                  <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-xl leading-relaxed break-words text-left">
                    {employee.bio}
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ================= SECTION 2: Two Columns Grid ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-4 items-start mb-4">

          {/* LEFT COLUMN: Employee Basic Information + Company Details */}
          <motion.div
            variants={itemVariants}
            className="col-span-1 lg:col-span-7 flex flex-col gap-4"
          >
            {/* ---- EMPLOYEE BASIC INFORMATION ---- */}
            <div className="bg-white rounded-2xl lg:rounded-[2rem] border border-slate-200/60 p-4 lg:p-5 flex flex-col gap-4 lg:gap-3.5">
              <SectionHeading icon={<ShieldCheck size={14} />} label="Employee Details" />
              <div className="flex flex-col text-sm text-[#16213B] divide-y divide-slate-100">
                <div className="flex items-center justify-between py-2 lg:py-2.5">
                  <span className="text-xs font-semibold text-slate-400">Full Name</span>
                  <span className="font-bold">{employee.name || '--'}</span>
                </div>
                <div className="flex items-center justify-between py-2 lg:py-2.5">
                  <span className="text-xs font-semibold text-slate-400">Employee ID</span>
                  <span className="font-bold">{employee.employeeId || '--'}</span>
                </div>
                <div className="flex items-center justify-between py-2 lg:py-2.5">
                  <span className="text-xs font-semibold text-slate-400">Department</span>
                  <span className="font-bold">{employee.department || '--'}</span>
                </div>
                {/* Dynamic Custom Fields in Employee Details */}
                {employee.customPortfolioFields && employee.customPortfolioFields.map((field, i) => (
                  field.value && (
                    <div key={i} className="flex items-center justify-between py-2 lg:py-2.5">
                      <span className="text-xs font-semibold text-slate-400">{field.label}</span>
                      {field.value?.startsWith('http') ? (
                        <a
                          href={field.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-[#2563EB] hover:underline flex items-center gap-1 text-right max-w-[65%] break-all"
                        >
                          View Link <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="font-bold text-right max-w-[65%] break-all">{field.value}</span>
                      )}
                    </div>
                  )
                ))}
              </div>
            </div>

            {/* ---- COMPANY DETAILS (Desktop only) ---- */}
            {renderCompanyDetails(false)}
          </motion.div>

          {/* ================= RIGHT COLUMN: Contact Information, Custom Fields & Social Links ================= */}
          <motion.div
            variants={itemVariants}
            className="col-span-1 lg:col-span-5 flex flex-col gap-4"
          >
            <div className="bg-white rounded-2xl lg:rounded-[2rem] border border-slate-200/60 p-4 lg:p-5 flex flex-col gap-4 lg:gap-3.5">
              <SectionHeading icon={<Mail size={14} />} label="Contact Information" />

              <div className="flex flex-col text-sm text-[#16213B] divide-y divide-slate-100">
                {employee.email && (
                  <div className="flex items-center justify-between py-2 lg:py-2.5">
                    <span className="text-xs font-semibold text-slate-400">Official Email</span>
                    <a href={`mailto:${employee.email}`} className="font-bold text-[#16213B] hover:text-[#B8874B] transition-colors break-all text-right max-w-[65%]">
                      {employee.email}
                    </a>
                  </div>
                )}
                {(employee.phone || employee.phoneNumber) && (
                  <div className="flex items-center justify-between py-2 lg:py-2.5">
                    <span className="text-xs font-semibold text-slate-400">Mobile Number</span>
                    <a href={`tel:${employee.phone || employee.phoneNumber}`} className="font-bold text-[#16213B] hover:text-[#B8874B] transition-colors">
                      {employee.phone || employee.phoneNumber}
                    </a>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 lg:py-2.5">
                  <span className="text-xs font-semibold text-slate-400">Blood Group</span>
                  <span className="font-bold">{employee.personalDetails?.bloodGroup || '--'}</span>
                </div>
                <div className="flex items-center justify-between py-2 lg:py-2.5 gap-3">
                  <span className="text-xs font-semibold text-slate-400 shrink-0">Location</span>
                  <span className="font-bold text-[#16213B] text-right max-w-[65%] break-all">
                    {employee.address || (employee.company?.officeLocation?.address
                      ? `${employee.company.officeLocation.address}${employee.company.officeLocation.city ? `, ${employee.company.officeLocation.city}` : ""}`
                      : '--')}
                  </span>
                </div>


              </div>

              {/* Social Links at the bottom of Contact Information section */}
              {employee.socialLinks && (employee.socialLinks.linkedin || employee.socialLinks.github || employee.socialLinks.instagram || employee.socialLinks.website) && (
                <div className="hidden lg:block border-t border-slate-100 pt-4 text-center">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2.5 text-center">Social Links</span>
                  <div className="flex flex-wrap gap-4 justify-center">
                    {employee.socialLinks.linkedin && (
                      <SocialLink href={employee.socialLinks.linkedin} label="LinkedIn" hoverColor="#0077b5">
                        <FaLinkedinIn size={18} />
                      </SocialLink>
                    )}
                    {employee.socialLinks.github && (
                      <SocialLink href={employee.socialLinks.github} label="GitHub" hoverColor="#171515">
                        <FaGithub size={18} />
                      </SocialLink>
                    )}
                    {employee.socialLinks.instagram && (
                      <SocialLink href={employee.socialLinks.instagram} label="Instagram" hoverColor="#e1306c">
                        <FaInstagram size={18} />
                      </SocialLink>
                    )}
                    {employee.socialLinks.website && (
                      <SocialLink href={employee.socialLinks.website} label="Website" hoverColor="#16213B">
                        <FaGlobe size={18} />
                      </SocialLink>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ---- COMPANY DETAILS (Mobile only, placed after Contact Info) ---- */}
            {renderCompanyDetails(true)}
          </motion.div>

        </div>

        {/* ================= SECTION 3: EXPERIENCE (Full Width) ================= */}
        {employee.experienceDetails && employee.experienceDetails.length > 0 && (
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-2xl lg:rounded-[2rem] border border-slate-200/60 p-4 lg:p-5 mb-4"
          >
            <SectionHeading icon={<Briefcase size={14} />} label="Experience" />

            <div className="relative pl-5 border-l-2 border-slate-100 ml-2 space-y-3 lg:space-y-4">
              {employee.experienceDetails.map((exp, i) => (
                <div key={i} className="relative">
                  <div className="w-3 h-3 rounded-full bg-[#16213B] border-[3px] border-white absolute left-[-27px] top-1 shadow-sm" />

                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-bold text-[#16213B] text-[15px]">{exp.role || "Role"}</h4>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md tracking-wide">
                        {exp.joiningDate ? formatDate(exp.joiningDate) : ""} – {exp.lastWorkingDate ? formatDate(exp.lastWorkingDate) : "Present"}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#96692F] tracking-wide">{exp.company || "Company"}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 bg-slate-50/60 rounded-xl p-3 border border-slate-100">
                      <div>
                        <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Department</p>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5">{exp.department || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Position CTC</p>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5">{exp.salary || "—"}</p>
                      </div>
                      {exp.reason && (
                        <div className="col-span-1 sm:col-span-2 pt-2 border-t border-slate-100 mt-1">
                          <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Reason for transition</p>
                          <p className="text-xs font-semibold text-slate-700 mt-0.5 leading-relaxed">{exp.reason}</p>
                        </div>
                      )}
                    </div>

                    {exp.experienceLetterUrl && (
                      <a
                        href={exp.experienceLetterUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#16213B] hover:text-white bg-slate-50 hover:bg-[#16213B] border border-slate-200 px-3.5 py-2 rounded-lg transition-colors mt-2 w-fit hover:no-underline"
                      >
                        <FileText size={12} /> View experience letter
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ================= SECTION 4: SKILLS & ATTRIBUTES (Full Width) ================= */}
        {employee.customPortfolioFields && employee.customPortfolioFields.length > 0 && (
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-2xl lg:rounded-[2rem] border border-slate-200/60 p-4 lg:p-5"
          >
            <SectionHeading icon={<Award size={14} />} label="Skills & Attributes" />

            <div className="flex flex-wrap gap-2">
              {employee.customPortfolioFields.map((field, i) => (
                <div key={i} className="flex flex-col bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">{field.label}</span>
                  {field.value?.startsWith('http') ? (
                    <a
                      href={field.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-[#16213B] flex items-center gap-1 mt-0.5 hover:no-underline hover:text-[#96692F]"
                    >
                      Open link <ExternalLink size={10} />
                    </a>
                  ) : (
                    <span className="text-xs font-semibold text-slate-800 mt-0.5">{field.value}</span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ================= SOCIAL LINKS (Mobile only, separate card at the bottom) ================= */}
        {employee.socialLinks && (employee.socialLinks.linkedin || employee.socialLinks.github || employee.socialLinks.instagram || employee.socialLinks.website) && (
          <motion.div
            variants={itemVariants}
            className="lg:hidden p-2 mt-2 flex flex-col items-center justify-center"
          >
            <SectionHeading label="Social Links" center={true} textSize="text-[10px]" />
            <div className="flex flex-wrap gap-4 justify-center mt-2">
              {employee.socialLinks.linkedin && (
                <SocialLink href={employee.socialLinks.linkedin} label="LinkedIn" hoverColor="#0077b5">
                  <FaLinkedinIn size={18} />
                </SocialLink>
              )}
              {employee.socialLinks.github && (
                <SocialLink href={employee.socialLinks.github} label="GitHub" hoverColor="#171515">
                  <FaGithub size={18} />
                </SocialLink>
              )}
              {employee.socialLinks.instagram && (
                <SocialLink href={employee.socialLinks.instagram} label="Instagram" hoverColor="#e1306c">
                  <FaInstagram size={18} />
                </SocialLink>
              )}
              {employee.socialLinks.website && (
                <SocialLink href={employee.socialLinks.website} label="Website" hoverColor="#16213B">
                  <FaGlobe size={18} />
                </SocialLink>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>


    </div>
  );
};

/* ------------------------------- Small parts ------------------------------- */

const SectionHeading = ({ icon, label, noMargin, center, textSize }) => (
  <div className={`flex items-center gap-2.5 ${center ? 'justify-center mx-auto' : ''} ${noMargin ? '' : 'mb-2 lg:mb-3'}`}>
    {icon && (
      <span className="w-8 h-8 rounded-lg bg-[#16213B]/5 text-[#16213B] flex items-center justify-center">{icon}</span>
    )}
    <h3 className={`font-bold ${textSize || 'text-sm'} uppercase tracking-widest text-[#16213B]`}>{label}</h3>
  </div>
);

const InfoRow = ({ icon, label, value, accent }) => (
  <div className="flex items-center gap-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-100">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent ? 'bg-[#B8874B]/10 text-[#96692F]' : 'bg-[#16213B]/5 text-[#16213B]'}`}>
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-semibold text-slate-700 truncate mt-0.5">{value}</p>
    </div>
  </div>
);

const SocialLink = ({ href, label, children, hoverColor }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="relative flex flex-col items-center">
      {/* Animated Tooltip Popup */}
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.9 }}
        animate={hovered ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 8, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="pointer-events-none absolute bottom-full mb-3 px-2.5 py-1.5 bg-[#16213B] text-white text-[9px] font-extrabold tracking-wider uppercase rounded-lg shadow-md whitespace-nowrap z-30"
      >
        {label}
        {/* Tooltip arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-[#16213B]" />
      </motion.div>

      {/* Icon Button */}
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        whileHover={{ y: -4 }}
        style={{ '--hover-color': hoverColor }}
        className="w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 flex items-center justify-center transition-colors text-slate-500 hover:text-[color:var(--hover-color)] hover:no-underline cursor-pointer"
      >
        {children}
      </motion.a>
    </div>
  );
};

export default PortfolioPage2;