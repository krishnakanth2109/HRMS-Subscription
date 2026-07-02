import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Linkedin, Github, Instagram, Globe, ArrowLeft, UserCircle, Briefcase, Mail } from 'lucide-react';
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

  // --- Loading State (Dark Theme) ---
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px] mix-blend-screen"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen"></div>
        <div className="relative z-10 animate-spin h-12 w-12 border-4 border-cyan-400 border-t-transparent rounded-full shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
      </div>
    );
  }

  // --- Error State (Dark Theme) ---
  if (error || !employee) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black"></div>
        
        <div className="relative z-10 bg-white/5 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] p-10 text-center max-w-md w-full border border-white/10">
          <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-red-500/30">
            <UserCircle className="w-12 h-12 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Not Found</h2>
          <p className="text-slate-400 mb-8">{error}</p>
          <button 
            onClick={() => navigate(-1)} 
            className="px-8 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 border border-white/10 transition-all font-semibold shadow-lg hover:shadow-white/5"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const initials = employee.name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden font-sans">
      
      {/* Dynamic Ambient Background (Glowing Orbs) */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-600/20 rounded-full blur-[140px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-700/20 rounded-full blur-[140px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)} 
        className="absolute top-6 left-6 flex items-center gap-2 px-5 py-2.5 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-full shadow-lg border border-white/5 transition-all group z-20"
      >
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        <span className="font-semibold hidden sm:inline tracking-wide">Back</span>
      </button>

      {/* Main Glassmorphism Card */}
      <div className="w-full max-w-3xl bg-white/5 backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] overflow-hidden border border-white/10 relative z-10 transition-transform duration-500 hover:shadow-[0_16px_64px_0_rgba(0,0,0,0.6)]">
        
        {/* Header Cover Banner */}
        <div className="h-48 sm:h-56 relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
          {/* Abstract geometric overlay */}
          <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent"></div>
          
          {/* Company Badge floating in corner */}
          {employee.companyName && (
            <div className="absolute top-6 right-6 px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center gap-2 shadow-lg">
              <Briefcase className="w-4 h-4 text-cyan-300" />
              <span className="text-xs font-bold text-cyan-100 uppercase tracking-widest">
                {employee.companyName}
              </span>
            </div>
          )}
        </div>

        {/* Profile Content */}
        <div className="px-6 sm:px-12 pb-12 relative">
          
          {/* Glowing Avatar */}
          <div className="flex justify-center -mt-24 sm:-mt-28 mb-8 relative z-10">
            <div className="group relative">
              {/* Glow effect behind avatar */}
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-full blur opacity-50 group-hover:opacity-100 transition duration-500"></div>
              
              <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full p-1 bg-slate-900">
                <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-800 text-5xl font-extrabold text-cyan-400 border border-white/10 shadow-inner">
                  {employee.profileImageUrl ? (
                    <img 
                      src={getSecureUrl(employee.profileImageUrl)} 
                      alt={employee.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    />
                  ) : (
                    initials
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Name & Role */}
          <div className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-cyan-300">
              {employee.name}
            </h1>
            <p className="text-xl text-cyan-400 font-medium tracking-wide">
              {employee.role || 'Team Member'}
            </p>
          </div>

          {/* Bio Section */}
          {employee.bio && (
            <div className="mb-12 text-center px-4">
              <div className="w-16 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent mx-auto rounded-full mb-8 opacity-50"></div>
              <p className="text-slate-300 leading-relaxed text-lg sm:text-xl max-w-2xl mx-auto font-light">
                {employee.bio}
              </p>
              <div className="w-16 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent mx-auto rounded-full mt-8 opacity-50"></div>
            </div>
          )}

          {/* Social Links (Glass Pills) */}
          {employee.socialLinks && (employee.socialLinks.linkedin || employee.socialLinks.github || employee.socialLinks.instagram || employee.socialLinks.website) && (
            <div className="flex flex-wrap justify-center gap-4 sm:gap-5 pt-4">
              {employee.socialLinks.linkedin && (
                <a 
                  href={employee.socialLinks.linkedin} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-14 h-14 bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 hover:border-cyan-400/50 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(6,182,212,0.2)]"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="w-6 h-6" />
                </a>
              )}
              {employee.socialLinks.github && (
                <a 
                  href={employee.socialLinks.github} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-14 h-14 bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 hover:border-white/50 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(255,255,255,0.1)]"
                  aria-label="GitHub"
                >
                  <Github className="w-6 h-6" />
                </a>
              )}
              {employee.socialLinks.instagram && (
                <a 
                  href={employee.socialLinks.instagram} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-14 h-14 bg-white/5 border border-white/10 text-slate-300 hover:text-pink-400 hover:bg-white/10 hover:border-pink-500/50 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(236,72,153,0.2)]"
                  aria-label="Instagram"
                >
                  <Instagram className="w-6 h-6" />
                </a>
              )}
              {employee.socialLinks.website && (
                <a 
                  href={employee.socialLinks.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-14 h-14 bg-white/5 border border-white/10 text-slate-300 hover:text-indigo-400 hover:bg-white/10 hover:border-indigo-500/50 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(99,102,241,0.2)]"
                  aria-label="Personal Website"
                >
                  <Globe className="w-6 h-6" />
                </a>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PortfolioPage;
