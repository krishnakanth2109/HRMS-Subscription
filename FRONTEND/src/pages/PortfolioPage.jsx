import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Linkedin, Github, Instagram, Globe, AlertCircle, ArrowLeft, Briefcase, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../api';

const getSecureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http:")) {
    return url.replace("http:", "https:");
  }
  return url;
};

const PortfolioPage = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  
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

  // --- Loading State ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-6">
        <div className="animate-spin h-10 w-10 border-4 border-[#0B1320] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // --- Error State ---
  if (error || !employee) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="min-h-screen bg-[#F8F7F4] flex flex-col items-center justify-center p-6"
      >
        <AlertCircle className="w-16 h-16 text-[#0B1320] mb-4 opacity-50" />
        <h2 className="text-2xl font-bold text-[#0B1320] mb-2">Not Found</h2>
        <p className="text-gray-500 mb-8">{error}</p>
        <button 
          onClick={() => navigate(-1)} 
          className="px-6 py-2.5 bg-[#0B1320] text-white rounded-lg hover:bg-opacity-90 transition-all font-semibold"
        >
          Go Back
        </button>
      </motion.div>
    );
  }

  const initials = employee.name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  // Framer Motion Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3,
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }
  };

  const avatarVariants = {
    hidden: { scale: 0.5, opacity: 0, y: 50 },
    show: { 
      scale: 1, opacity: 1, y: 0, 
      transition: { type: "spring", stiffness: 100, damping: 15, delay: 0.1 } 
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen bg-[#F8F7F4] flex flex-col items-center font-sans relative overflow-hidden"
    >
      
      {/* Deep Navy Top Header with Curved Bottom */}
      <motion.div 
        initial={{ y: "-100%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full h-[35vh] sm:h-[40vh] relative z-0 flex items-start justify-between p-6"
        style={{
          backgroundColor: '#0B1320',
          backgroundImage: employee.portfolioBackgroundImageUrl ? `url(${getSecureUrl(employee.portfolioBackgroundImageUrl)})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Overlay to ensure text readability and curve contrast if background image exists */}
        {employee.portfolioBackgroundImageUrl && (
          <div className="absolute inset-0 bg-[#0B1320]/60 z-0"></div>
        )}
         {/* Simple back button */}
         <button 
          onClick={() => navigate(-1)} 
          className="text-white/70 hover:text-white transition-colors flex items-center gap-2 mt-4 z-10"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-semibold tracking-wide text-sm hidden sm:block">Back</span>
        </button>

        {/* Company Logo in Top Right */}
        {employee.companyLogo && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="z-10 mt-3"
          >
            <img 
              src={getSecureUrl(employee.companyLogo)} 
              alt="Company Logo" 
              className="h-8 sm:h-10 w-auto object-contain"
            />
          </motion.div>
        )}

        {/* The Curve SVG */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none translate-y-[99%]">
          <svg className="relative block w-full h-[60px] sm:h-[100px]" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,0 C600,120 1200,0 1200,0 L1200,0 L0,0 Z" fill="#0B1320"></path>
          </svg>
        </div>
      </motion.div>

      {/* Main Content Area */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-lg px-6 flex flex-col items-center relative z-10 -mt-24 sm:-mt-32 pb-24"
      >
        
        {/* Profile Avatar */}
        <motion.div 
          variants={avatarVariants}
          className="w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-white p-2 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] mb-8 flex-shrink-0"
        >
          <div className="w-full h-full rounded-full bg-[#0B1320] flex items-center justify-center text-6xl font-bold text-white overflow-hidden border border-gray-50">
            {employee.profileImageUrl ? (
              <img 
                src={getSecureUrl(employee.profileImageUrl)} 
                alt={employee.name} 
                className="w-full h-full object-cover" 
              />
            ) : (
              initials
            )}
          </div>
        </motion.div>

        {/* Name & Role */}
        <motion.div variants={itemVariants} className="text-center w-full mb-5">
          <h1 className="text-4xl sm:text-5xl font-bold text-[#0B1320] mb-3 tracking-tight">
            {employee.name}
          </h1>
          <h2 className="text-[15px] sm:text-[17px] font-semibold text-[#C4A47C] uppercase tracking-[0.2em] mb-3">
            {employee.role || 'Professional'}
          </h2>
          {employee.email && (
            <div className="flex items-center justify-center gap-2 text-gray-500 font-medium text-sm">
              <Mail className="w-4 h-4" />
              <span>{employee.email}</span>
            </div>
          )}
        </motion.div>

        {/* Small Divider */}
        <motion.div variants={itemVariants} className="w-16 h-[2px] bg-[#0B1320] mb-8"></motion.div>

        {/* Additional Info / Bio */}
        <motion.div variants={itemVariants} className="flex flex-col gap-4 text-[#0B1320] font-medium text-[15px] mb-8 w-full items-center text-center px-2">
          {employee.companyName && (
            <div className="flex items-center gap-2 text-[#0B1320]">
               <Briefcase className="w-4 h-4 text-[#C4A47C]" />
               <span className="font-semibold tracking-wide">{employee.companyName}</span>
            </div>
          )}
          {employee.bio && (
            <p className="text-gray-600 font-normal mt-2 leading-relaxed">
              {employee.bio}
            </p>
          )}
        </motion.div>

        {/* Social Links */}
        {employee.socialLinks && (employee.socialLinks.linkedin || employee.socialLinks.github || employee.socialLinks.instagram || employee.socialLinks.website) && (
          <motion.div variants={itemVariants} className="flex justify-center gap-2.5">
            {employee.socialLinks.linkedin && (
              <motion.a 
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.95 }}
                href={employee.socialLinks.linkedin} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-[38px] h-[38px] bg-[#0B1320] rounded flex items-center justify-center text-white hover:bg-[#1A2640] transition-colors shadow-md"
              >
                <Linkedin className="w-[18px] h-[18px] fill-current" />
              </motion.a>
            )}
            {employee.socialLinks.instagram && (
              <motion.a 
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.95 }}
                href={employee.socialLinks.instagram} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-[38px] h-[38px] bg-[#0B1320] rounded flex items-center justify-center text-white hover:bg-[#1A2640] transition-colors shadow-md"
              >
                <Instagram className="w-[18px] h-[18px]" />
              </motion.a>
            )}
            {employee.socialLinks.github && (
              <motion.a 
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.95 }}
                href={employee.socialLinks.github} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-[38px] h-[38px] bg-[#0B1320] rounded flex items-center justify-center text-white hover:bg-[#1A2640] transition-colors shadow-md"
              >
                <Github className="w-[18px] h-[18px] fill-current" />
              </motion.a>
            )}
            {employee.socialLinks.website && (
              <motion.a 
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.95 }}
                href={employee.socialLinks.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-[38px] h-[38px] bg-[#0B1320] rounded flex items-center justify-center text-white hover:bg-[#1A2640] transition-colors shadow-md"
              >
                <Globe className="w-[18px] h-[18px]" />
              </motion.a>
            )}
          </motion.div>
        )}

      </motion.div>
    </motion.div>
  );
};

export default PortfolioPage;
