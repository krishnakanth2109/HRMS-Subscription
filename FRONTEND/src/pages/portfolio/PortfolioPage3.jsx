import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { FaLinkedinIn, FaGithub, FaInstagram, FaGlobe } from "react-icons/fa6";
import {
  Mail,
  Building,
  ArrowLeft,
  Download,
  X,
  ExternalLink,
  Award,
  ShieldCheck,
  Briefcase,
  Quote,
  Lightbulb,
  Users,
  Globe,
  ArrowRight,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import api from '../../api';

/* ─────────────────────── Helpers ─────────────────────── */

const getSecureUrl = (url) => {
  if (!url) return "";
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) return `https://${u}`;
  return u.replace(/^http:/i, "https:");
};

const formatDate = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
};

const useFonts = () => {
  useEffect(() => {
    const id = 'portfolio3-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Manrope:wght@500;600;700;800&display=swap';
    document.head.appendChild(link);
  }, []);
};

const IconMap = {
  lightbulb: Lightbulb,
  shield: ShieldCheck,
  award: Award,
  users: Users,
  building: Building,
  globe: Globe,
  briefcase: Briefcase,
};

/* ─────────────────────── Component ─────────────────────── */

const PortfolioPage3 = () => {
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
    if (employeeId) fetchPortfolio();
  }, [employeeId]);

  const portfolioUrl = `${window.location.origin}/portfolio3/${employeeId}`;

  const downloadVcard = () => {
    const nameParts = employee.name ? employee.name.split(' ') : ['Employee'];
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nN:${nameParts.slice(1).join(' ') || ''};${nameParts[0] || ''};;;\nFN:${employee.name || ''}\nORG:${employee.companyName || ''}\nTITLE:${employee.currentRole || employee.designation || employee.experienceDetails?.[employee.experienceDetails.length - 1]?.role || employee.role || ''}\nEMAIL;TYPE=PREF,INTERNET:${employee.email || ''}\nURL:${employee.socialLinks?.website || ''}\nEND:VCARD`;
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${employee.name ? employee.name.replace(/\s+/g, '_') : 'employee'}_vCard.vcf`);
    link.click();
  };

  /* Loading */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center font-['Outfit',sans-serif]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-[2.5px] border-white/10 border-t-white animate-spin" />
          <p className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">Loading Profile</p>
        </div>
      </div>
    );
  }

  /* Error */
  if (error || !employee) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center p-6 font-['Outfit',sans-serif] text-white">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full bg-[#111827] rounded-3xl border border-white/[0.06] p-8 shadow-2xl text-center flex flex-col items-center"
        >
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 border border-white/[0.04]">
            <ShieldCheck className="w-5 h-5 text-gray-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Profile Unavailable</h2>
          <p className="text-xs text-gray-400 mb-6">{error || "This profile is inactive or does not exist."}</p>
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3 bg-white text-[#0B1220] rounded-xl hover:bg-gray-100 transition-colors font-bold text-xs cursor-pointer active:scale-95"
          >
            Go back
          </button>
        </motion.div>
      </div>
    );
  }

  const initials = employee?.name ? employee.name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().substring(0, 2) : '';
  const formattedCompanyName = employee.companyName
    ? employee.companyName.replace(/\s*(pvt\.?\s*ltd\.?|private\s*limited)/i, '').trim()
    : '';

  const customFields = employee.customPortfolioFields || employee.portfolioCustomFields || [];
  const hasCompany = !!(employee.companyName || employee.companyLogo || employee.companyTagline || employee.companyDescription || (employee.companyFeatures && employee.companyFeatures.length > 0));
  const hasSocialLinks = !!(employee.socialLinks && (employee.socialLinks.linkedin || employee.socialLinks.github || employee.socialLinks.instagram || employee.socialLinks.website));
  const hasExperience = !!(employee.experienceDetails && employee.experienceDetails.length > 0);
  const hasCustomFields = customFields.length > 0;
  const backgroundImage = employee?.portfolioBackgroundImageUrl || "";

  /* Motion variants */
  const fadeUp = {
    hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 },
    show: {
      opacity: 1, y: 0,
      transition: shouldReduceMotion
        ? { duration: 0.15 }
        : { type: "spring", stiffness: 110, damping: 18 }
    }
  };
  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } }
  };

  return (
    <div className="min-h-screen bg-[#0B1220] font-['Outfit',sans-serif] text-white pb-20 relative overflow-x-hidden">

      {/* ── BACKGROUND ── */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        {backgroundImage ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${getSecureUrl(backgroundImage)})` }}
            />
            <div className="absolute inset-0 bg-[#0B1220]/70" />
            <div className="absolute inset-0 bg-white/5 backdrop-blur-[18px]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[#0B1220]" />
            <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full bg-indigo-900/20 blur-[160px] -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-violet-900/15 blur-[140px] translate-x-1/3 translate-y-1/3" />
          </>
        )}
      </div>

      {/* Desktop Fixed Header (Back Button & Company Logo) */}
      <div className="hidden lg:flex fixed left-8 right-8 top-8 z-40 items-center justify-between pointer-events-none">
        <button
          onClick={() => navigate('/')}
          aria-label="Go back"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.04] border border-white/[0.07] text-gray-400 hover:text-white shadow-md cursor-pointer transition-all hover:scale-105"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="pointer-events-auto flex h-11 max-w-[200px] items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.04] px-5 shadow-md">
          {employee.companyLogo ? (
            <img
              src={getSecureUrl(employee.companyLogo)}
              alt="Company logo"
              className="h-7 max-w-[160px] object-contain"
            />
          ) : formattedCompanyName ? (
            <span className="text-sm font-bold text-white tracking-wide">{formattedCompanyName}</span>
          ) : null}
        </div>
      </div>

      {/* Mobile/Tablet Header Overlay */}
      <div className="flex lg:hidden absolute left-4 right-4 top-4 z-40 items-center justify-between pointer-events-none">
        <button
          onClick={() => navigate('/')}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] border border-white/[0.07] text-gray-400 hover:text-white shadow-md cursor-pointer active:scale-95"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <div className="pointer-events-auto flex h-9 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.04] px-3.5 shadow-md">
          {employee.companyLogo ? (
            <img src={getSecureUrl(employee.companyLogo)} alt="Company logo" className="h-5 w-auto object-contain" />
          ) : formattedCompanyName ? (
            <span className="text-xs font-bold text-white tracking-wide">{formattedCompanyName}</span>
          ) : null}
        </div>
      </div>

      <div className="w-full max-w-5xl mx-auto px-5 sm:px-8 pt-8 sm:pt-10 lg:pt-12 relative z-10">

        {/* ==============================================
            SECTION 1: HERO (Profile Photo + Identity)
            ============================================== */}
        <motion.section
          variants={container}
          initial="hidden"
          animate="show"
          className="py-4 lg:py-5 flex flex-col sm:flex-row-reverse items-center justify-center gap-4 sm:gap-5 text-center sm:text-right w-full max-w-2xl mx-auto"
        >
          {/* Left - Profile Photo */}
          <motion.div
            variants={fadeUp}
            className="flex justify-center sm:justify-start sm:flex-1 shrink-0"
          >
            <motion.div
              animate={shouldReduceMotion ? {} : { y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
              className="w-44 h-44 sm:w-52 sm:h-52 lg:w-56 lg:h-56 rounded-full border border-white/[0.08] p-2 bg-white/[0.03] shadow-[0_24px_64px_rgba(0,0,0,0.5)] flex-shrink-0"
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-white/5 flex items-center justify-center border border-white/[0.04]">
                {employee.profileImageUrl ? (
                  <img
                    src={getSecureUrl(employee.profileImageUrl)}
                    alt={employee.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-gray-400">{initials}</span>
                )}
              </div>
            </motion.div>
          </motion.div>

          {/* Right - Identity */}
          <motion.div variants={fadeUp} className="flex flex-col text-center sm:text-right items-center sm:items-end sm:flex-1 max-w-xl">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight mb-1.5">
              {employee.name}
            </h1>
            {(employee.currentRole || employee.designation || employee.experienceDetails?.[employee.experienceDetails.length - 1]?.role || employee.role) && (
              <p className="text-sm sm:text-base font-bold tracking-widest text-gray-300 uppercase mb-1">
                {employee.currentRole || employee.designation || employee.experienceDetails?.[employee.experienceDetails.length - 1]?.role || employee.role}
              </p>
            )}
            {(employee.department || employee.experienceDetails?.[0]?.department) && (
              <p className="mt-1 text-xs md:text-sm font-semibold tracking-[0.2em] text-[#00FFFF] uppercase">
                {employee.department || employee.experienceDetails?.[0]?.department}
              </p>
            )}
            {employee.bio && (
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed max-w-xl mb-4 break-words">
                {employee.bio}
              </p>
            )}
          </motion.div>
        </motion.section>

        {/* ══════════════════════════════════════════════
            ROW 2 · CONTACT INFO (Left) + COMPANY (Right)
        ══════════════════════════════════════════════ */}
        <RevealSection>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-4 items-start">

            {/* Card 1: Employee Details */}
            <div className="bg-white/[0.025] border border-white/[0.06] rounded-2xl p-4 lg:p-5 flex flex-col gap-3 lg:gap-2.5">
              <SectionLabel icon={<ShieldCheck size={13} />} label="Employee Details" />
              <div className="flex flex-col divide-y divide-white/[0.04]">
                <ContactRow label="Employee ID" value={employee.employeeId || '--'} />
                <ContactRow label="Department" value={employee.department || employee.experienceDetails?.[0]?.department || '--'} />
                <ContactRow label="Role" value={employee.currentRole || employee.designation || employee.experienceDetails?.[employee.experienceDetails.length - 1]?.role || employee.role || '--'} />
                {customFields.map((field, i) => {
                  const label = field.label || field.fieldName;
                  const value = field.value || field.fieldValue;
                  if (!label || !value) return null;
                  const isUrl = /^https?:\/\//i.test(value.trim());
                  return (
                    <div key={i} className="flex items-center justify-between py-1.5 lg:py-2 gap-3">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest shrink-0">{label}</span>
                      {isUrl ? (
                        <a
                          href={getSecureUrl(value)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                        >
                          Open Link <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-xs font-semibold text-white text-right truncate max-w-[200px]">{value}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 2: Contact Information */}
            <div className="bg-white/[0.025] border border-white/[0.06] rounded-2xl p-4 lg:p-5 flex flex-col gap-3 lg:gap-2.5">
              <SectionLabel icon={<Mail size={13} />} label="Contact Information" />
              <div className="flex flex-col divide-y divide-white/[0.04]">
                <ContactRow label="Official Email" value={employee.email || '--'} />
                <ContactRow label="Mobile Number" value={employee.phone || employee.phoneNumber || '--'} />
                <ContactRow
                  label="Location"
                  value={employee.address || (employee.company?.officeLocation?.address ? `${employee.company.officeLocation.address}${employee.company.officeLocation.city ? `, ${employee.company.officeLocation.city}` : ""}` : '--')}
                />
                <ContactRow label="Blood Group" value={employee.personalDetails?.bloodGroup || '--'} />
              </div>
            </div>

            {/* RIGHT: Company Details */}
            {hasCompany && (
              <div className="lg:col-span-2 bg-white/[0.025] border border-white/[0.06] rounded-2xl p-4 lg:p-5 flex flex-col gap-3 lg:gap-2.5">
                <SectionLabel icon={<Building size={13} />} label="Company Details" />
                <div className="flex items-center gap-3">
                  {employee.companyLogo ? (
                    <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-xl bg-white/5 border border-white/[0.07] p-2 flex items-center justify-center shrink-0">
                      <img src={getSecureUrl(employee.companyLogo)} alt="Company Logo" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-xl bg-white/5 border border-white/[0.07] flex items-center justify-center shrink-0">
                      <Building size={16} className="text-gray-500" />
                    </div>
                  )}
                  <div>
                    {formattedCompanyName && (
                      <h3 className="font-bold text-white text-base">{formattedCompanyName}</h3>
                    )}
                    {employee.companyTagline && (
                      <p className="text-[10px] font-semibold text-gray-500 mt-0.5 uppercase tracking-wider">{employee.companyTagline}</p>
                    )}
                  </div>
                </div>
                {employee.companyDescription && (
                  <p className="text-xs text-gray-400 leading-relaxed">{employee.companyDescription}</p>
                )}
                {employee.companyFeatures && employee.companyFeatures.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {employee.companyFeatures.map((feat, i) => {
                      const Icon = IconMap[feat.icon] || Award;
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                            <Icon size={12} className="text-gray-400" />
                          </span>
                          <div>
                            {feat.title && <p className="text-xs font-bold text-white">{feat.title}</p>}
                            {feat.description && <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{feat.description}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {employee.companyQuote && (
                  <div className="border-l-2 border-white/20 pl-3">
                    <Quote size={12} className="text-gray-500 mb-1" />
                    <p className="text-xs text-gray-400 italic leading-relaxed">"{employee.companyQuote}"</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </RevealSection>

        {/* ══════════════════════════════════════════════
            ROW 3 · EXPERIENCE (if available)
        ══════════════════════════════════════════════ */}
        {hasExperience && (
          <RevealSection>
            <SectionLabel icon={<Briefcase size={13} />} label="Experience" className="mb-3" />
            <div className="relative pl-5 border-l border-white/[0.06] ml-1 flex flex-col gap-4">
              {employee.experienceDetails.map((exp, i) => (
                <div key={i} className="relative">
                  <div className="w-2 h-2 rounded-full bg-white/50 border-2 border-[#0B1220] absolute left-[-25px] top-1.5" />
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                    <h4 className="font-bold text-white text-sm">{exp.role || "Role"}</h4>
                    <span className="text-[10px] font-semibold text-gray-500 bg-white/[0.03] border border-white/[0.05] px-2 py-0.5 rounded-md">
                      {exp.joiningDate ? formatDate(exp.joiningDate) : ""}{exp.joiningDate || exp.lastWorkingDate ? " – " : ""}{exp.lastWorkingDate ? formatDate(exp.lastWorkingDate) : "Present"}
                    </span>
                  </div>
                  {exp.company && <p className="text-xs font-semibold text-indigo-400 mb-0.5">{exp.company}</p>}
                  {exp.department && (
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{exp.department}</p>
                  )}
                </div>
              ))}
            </div>
          </RevealSection>
        )}

        {/* ══════════════════════════════════════════════
            ROW 4 · SKILLS & ATTRIBUTES (if available)
        ══════════════════════════════════════════════ */}
        {/* ══════════════════════════════════════════════
            ROW 5 · PERMANENT FOOTER — Social Links + QR
            ⚠ This section must always remain last.
            Any new admin-added sections go ABOVE this.
        ══════════════════════════════════════════════ */}
        <RevealSection>
          <div className="max-w-xl mx-auto w-full">

            {/* LEFT: Social Links */}
            <div className="flex flex-col gap-2">
              <SectionLabel label="Social Links" className="mb-1.5 justify-center mx-auto" />
              {hasSocialLinks ? (
                <>
                  {employee.socialLinks.linkedin && (
                    <SocialLink href={getSecureUrl(employee.socialLinks.linkedin)} label="LinkedIn">
                      <FaLinkedinIn size={13} />
                    </SocialLink>
                  )}
                  {employee.socialLinks.github && (
                    <SocialLink href={getSecureUrl(employee.socialLinks.github)} label="GitHub">
                      <FaGithub size={13} />
                    </SocialLink>
                  )}
                  {employee.socialLinks.instagram && (
                    <SocialLink href={getSecureUrl(employee.socialLinks.instagram)} label="Instagram">
                      <FaInstagram size={13} />
                    </SocialLink>
                  )}
                  {employee.socialLinks.website && (
                    <SocialLink href={getSecureUrl(employee.socialLinks.website)} label="Website">
                      <FaGlobe size={13} />
                    </SocialLink>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-600 italic">No social links configured.</p>
              )}
            </div>

          </div>
        </RevealSection>

      </div>


    </div>
  );
};

/* ─────────────────────── Sub-components ─────────────────────── */

const RevealSection = ({ children }) => {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.section
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="py-3.5 lg:py-4 border-t border-white/[0.06]"
    >
      {children}
    </motion.section>
  );
};

const SectionLabel = ({ icon, label, className = "" }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    {icon && (
      <span className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-gray-400">
        {icon}
      </span>
    )}
    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
  </div>
);

const ContactRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-1.5 lg:py-2 gap-3">
    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest shrink-0">{label}</span>
    <span className="text-xs font-semibold text-white text-right truncate max-w-[200px]">{value}</span>
  </div>
);

const SocialLink = ({ href, label, children }) => (
  <motion.a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    whileHover={{ y: -2 }}
    className="flex items-center justify-between w-full px-4 py-2.5 bg-white/[0.025] border border-white/[0.05] rounded-xl hover:border-white/15 transition-all group text-xs text-gray-400 hover:text-white hover:no-underline cursor-pointer"
  >
    <div className="flex items-center gap-3">
      <span className="text-gray-400 group-hover:text-white transition-colors">{children}</span>
      <span className="font-bold">{label}</span>
    </div>
    <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
  </motion.a>
);

export default PortfolioPage3;
