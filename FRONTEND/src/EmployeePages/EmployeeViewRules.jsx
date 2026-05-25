import React, { useState, useEffect } from 'react';
// 1. Remove axios
// 2. Import the getRules function from your api.js
import api, { getRules } from '../api'; 
import Swal from 'sweetalert2';

const getProxyUrl = (url) => {
  if (!url) return '';
  return `${api.defaults.baseURL || ''}/api/doc-verification/proxy-doc?url=${encodeURIComponent(url)}`;
};

const getFileType = (url) => {
  const path = (url || '').split('?')[0].toLowerCase();
  if (path.endsWith('.pdf')) return 'pdf';
  if (path.endsWith('.ppt') || path.endsWith('.pptx')) return 'ppt';
  if ((url || '').includes('/raw/upload/')) {
    if ((url || '').toLowerCase().includes('pdf')) return 'pdf';
    if ((url || '').toLowerCase().includes('ppt') || (url || '').toLowerCase().includes('pptx')) return 'ppt';
    return 'raw';
  }
  return 'image';
};

const PptPreview = ({ url, isModal }) => {
  const [signedUrl, setSignedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchSigned = async () => {
      try {
        const res = await api.get(`/api/doc-verification/sign-url?url=${encodeURIComponent(url)}`);
        if (active) {
          setSignedUrl(res.data.signedUrl);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    };
    fetchSigned();
    return () => { active = false; };
  }, [url]);

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-6 select-none rounded-xl border border-slate-200/60 shadow-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2" />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Loading Slide Preview...</span>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-orange-50 text-orange-950 p-6 select-none rounded-xl border border-orange-100 shadow-sm relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-orange-200/30 rounded-full blur-xl" />
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-orange-600 mb-2 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 00-2 2z" />
        </svg>
        <span className="font-extrabold text-slate-800 text-xs tracking-wide uppercase">PowerPoint Presentation</span>
        <span className="text-[10px] text-orange-600/70 mt-1 font-medium bg-white/80 px-2 py-0.5 rounded-full shadow-sm">Click card to download file</span>
      </div>
    );
  }

  const pptViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`;

  if (isModal) {
    return (
      <div className="w-full h-full flex flex-col bg-slate-900 overflow-hidden">
        <div className="bg-slate-950 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800 pr-16">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
            <span className="text-xs font-bold text-slate-300 ml-2 tracking-wide uppercase">Interactive Slide Viewer</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.open(pptViewerUrl, '_blank')}
              className="text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
              Open in New Tab
            </button>
            <span className="text-[10px] font-extrabold bg-orange-600/30 text-orange-400 px-3 py-1 rounded-full border border-orange-500/20 uppercase tracking-wider">All Slides</span>
          </div>
        </div>
        <iframe 
          src={pptViewerUrl} 
          title="PPT Preview" 
          className="w-full flex-1 border-0 bg-white"
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden relative shadow-sm group-hover:shadow-md transition-shadow duration-300">
      <div className="bg-slate-100 px-3 py-2 flex items-center gap-1.5 border-b border-slate-200/50">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />
        <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider ml-1">Slide deck</span>
      </div>
      <div className="flex-grow relative overflow-hidden bg-white">
        <iframe 
          src={pptViewerUrl}
          title="PPT Slide 1 Preview" 
          className="w-full h-full border-0 pointer-events-none scale-105 origin-top"
        />
        <div className="absolute inset-0 bg-transparent" />
      </div>
    </div>
  );
};

const renderFilePreview = (url, isModal = false) => {
  const type = getFileType(url);
  const proxyUrl = getProxyUrl(url);
  
  if (type === 'pdf') {
    if (isModal) {
      return (
        <div className="w-full h-full flex flex-col bg-slate-900 overflow-hidden">
          <div className="bg-slate-950 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800 pr-16">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
              <span className="text-xs font-bold text-slate-300 ml-2 tracking-wide uppercase">Interactive PDF Viewer</span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => window.open(proxyUrl, '_blank')}
                className="text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                Open in New Tab
              </button>
              <span className="text-[10px] font-extrabold bg-rose-600/30 text-rose-400 px-3 py-1 rounded-full border border-rose-500/20 uppercase tracking-wider">All Pages</span>
            </div>
          </div>
          <iframe 
            src={proxyUrl} 
            title="PDF Preview" 
            className="w-full flex-1 border-0 bg-white"
          />
        </div>
      );
    }
    return (
      <div className="w-full h-full flex flex-col bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden relative shadow-sm group-hover:shadow-md transition-shadow duration-300">
        <div className="bg-slate-100 px-3 py-2 flex items-center gap-1.5 border-b border-slate-200/50">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />
          <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider ml-1">Document Preview</span>
        </div>
        <div className="flex-grow relative overflow-hidden bg-white">
          <iframe 
            src={`${proxyUrl}#page=1&toolbar=0&navpanes=0`}
            title="PDF Page 1 Preview" 
            className="w-full h-full border-0 pointer-events-none scale-105 origin-top"
          />
          <div className="absolute inset-0 bg-transparent" />
        </div>
      </div>
    );
  }
  
  if (type === 'ppt') {
    return <PptPreview url={url} isModal={isModal} />;
  }

  if (isModal) {
    return (
      <div className="w-full h-full flex flex-col bg-slate-900 overflow-hidden">
        <div className="bg-slate-950 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800 pr-16">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
            <span className="text-xs font-bold text-slate-300 ml-2 tracking-wide uppercase">Image Viewer</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.open(proxyUrl, '_blank')}
              className="text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
              Open in New Tab
            </button>
            <span className="text-[10px] font-extrabold bg-blue-600/30 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 uppercase tracking-wider">Image</span>
          </div>
        </div>
        <div className="flex-grow w-full h-full flex items-center justify-center p-6 bg-slate-950/20 relative">
          <img 
            src={proxyUrl} 
            alt="Preview" 
            className="max-w-full max-h-full object-contain" 
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
      </div>
    );
  }

  return (
    <img 
      src={proxyUrl} 
      alt="Preview" 
      className="max-w-full max-h-full object-contain" 
      onError={(e) => { e.target.style.display = 'none'; }}
    />
  );
};

// --- SUB-COMPONENT: Single Rule Card (Handles Slider & Full Screen Logic) ---
const RuleCard = ({ rule }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  
  // New State for Full Screen Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

  // --- ROBUST IMAGE DATA HANDLING ---
  const getImages = () => {
    if (rule.images && rule.images.length > 0) {
      return typeof rule.images[0] === 'string' 
        ? rule.images 
        : rule.images.map(img => img.url);
    }
    if (rule.fileUrl) return [rule.fileUrl];
    return [];
  };

  const images = getImages();

  // --- Auto-Slide Logic (Card Only) ---
  useEffect(() => {
    // Stop auto-slide if hovered OR if modal is open
    if (images.length > 1 && !isHovered && !isModalOpen) {
      const timer = setInterval(() => {
        setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      }, 5000); 
      return () => clearInterval(timer);
    }
  }, [images.length, isHovered, isModalOpen]);

  // --- Card Navigation Handlers ---
  const handleNext = () => setCurrentImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
  const handlePrev = () => setCurrentImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));

  // --- Modal Navigation Handlers ---
  const openModal = async () => {
    const currentUrl = images[currentImageIndex];
    if (getFileType(currentUrl) === 'ppt') {
      try {
        Swal.fire({
          title: 'Opening presentation...',
          html: 'Generating secure viewer link...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
        const res = await api.get(`/api/doc-verification/sign-url?url=${encodeURIComponent(currentUrl)}`);
        Swal.close();
        if (res.data.signedUrl) {
          const pptViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(res.data.signedUrl)}`;
          window.open(pptViewerUrl, '_blank');
        }
      } catch (err) {
        Swal.close();
        const proxyUrl = getProxyUrl(currentUrl);
        window.open(proxyUrl, '_blank');
      }
      return;
    }
    setModalIndex(currentImageIndex); // Start from the image user is looking at
    setIsModalOpen(true);
    setIsHovered(true); // Pause background slider
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsHovered(false);
  };

  const handleModalNext = (e) => {
    e.stopPropagation();
    setModalIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleModalPrev = (e) => {
    e.stopPropagation();
    setModalIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  // Helper for Category Colors
  const getCategoryColor = (cat) => {
    switch(cat) {
      case 'Safety': return 'bg-red-100 text-red-700 border-red-200';
      case 'HR Policy': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'IT Security': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'Management': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <>
      {/* --- NORMAL CARD VIEW --- */}
      <div className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-100 flex flex-col h-full">
        
        {/* Card Header */}
        <div className="p-6 pb-2">
          <div className="flex justify-between items-start mb-4">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getCategoryColor(rule.category)}`}>
              {rule.category}
            </span>
            <span className="text-xs text-gray-400 font-medium">
              {new Date(rule.createdAt).toLocaleDateString()}
            </span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 leading-tight">
            {rule.title}
          </h3>
        </div>

        {/* Card Body */}
        <div className="p-6 pt-2 flex-grow">
          <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
            {rule.description}
          </p>
        </div>

        {/* Attachment / Slider Section */}
        {images.length > 0 && (
          <div className="bg-gray-50 p-4 border-t border-gray-100 mt-auto">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              Attachments ({images.length})
            </p>
            
            <div 
              className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-900 h-64 cursor-pointer"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={openModal} // Clicking container opens modal
            >
              {/* Image Display */}
              <div className="w-full h-full flex items-center justify-center relative bg-black">
                  {renderFilePreview(images[currentImageIndex])}
                 
                 {/* Overlay Trigger */}
                 <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end items-end h-full">
                     <button 
                        onClick={(e) => { e.stopPropagation(); openModal(); }}
                        className="bg-white text-gray-900 text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 hover:bg-gray-100 transition-colors"
                     >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                       {getFileType(images[currentImageIndex]) === 'ppt' ? 'Open in New Tab' : 'Click to Expand'}
                     </button>
                 </div>
              </div>

              {/* Card Controls (Only if > 1 image) */}
              {images.length > 1 && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                    className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition opacity-0 group-hover:opacity-100 z-10"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>

                  <button 
                    onClick={(e) => { e.stopPropagation(); handleNext(); }}
                    className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition opacity-0 group-hover:opacity-100 z-10"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>

                  {/* Dots */}
                  <div className="absolute top-2 right-2 flex gap-1 z-10">
                    {images.map((_, idx) => (
                      <div key={idx} className={`h-1.5 w-1.5 rounded-full shadow-sm ${idx === currentImageIndex ? 'bg-white' : 'bg-white/30'}`} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center">
          
          {/* Close Button */}
          <button 
            onClick={closeModal}
            className="absolute top-3 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all z-[10000]"
            title="Close Preview"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
 
          {/* Main Image Container */}
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            
            {renderFilePreview(images[modalIndex], true)}
 
            {/* Modal Navigation (Only if > 1 image) */}
            {images.length > 1 && (
              <>
                {/* Prev Button */}
                <button 
                  onClick={handleModalPrev}
                  className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-4 rounded-full backdrop-blur-sm transition-all hover:scale-110 z-[10000]"
                >
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
 
                {/* Next Button */}
                <button 
                  onClick={handleModalNext}
                  className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-4 rounded-full backdrop-blur-sm transition-all hover:scale-110 z-[10000]"
                >
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                
                {/* Counter */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-1 rounded-full text-white text-sm border border-white/20 z-[10000]">
                  {modalIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// --- MAIN PARENT COMPONENT ---
const EmployeeViewRules = () => {
  const [rules, setRules] = useState([]);
  const [filteredRules, setFilteredRules] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // --- 1. Fetch Rules (UPDATED) ---
  useEffect(() => {
    const fetchRules = async () => {
      try {
        // UPDATED: Used getRules from api.js instead of axios.get with localhost
        const data = await getRules();
        setRules(data);
        setFilteredRules(data);
      } catch (error) {
        console.error("Error fetching rules", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRules();
  }, []);

  // --- 2. Search Logic ---
  useEffect(() => {
    const lowerTerm = searchTerm.toLowerCase();
    const filtered = rules.filter(rule => 
      rule.title.toLowerCase().includes(lowerTerm) ||
      rule.category.toLowerCase().includes(lowerTerm)
    );
    setFilteredRules(filtered);
  }, [searchTerm, rules]);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 font-sans text-gray-800">
      
      {/* --- Header Section --- */}
      <div className="max-w-6xl mx-auto mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
          📋 Company <span className="text-blue-600">Rules & Regulations</span>
        </h1>
        <p className="text-gray-500 max-w-2xl mx-auto mb-8 text-lg">
          Stay updated with the latest policies, safety guidelines, and operational procedures.
        </p>

        {/* Search Bar */}
        <div className="relative max-w-xl mx-auto">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-full leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition duration-150 ease-in-out sm:text-sm"
            placeholder="Search policies (e.g., 'Holiday', 'Safety')..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* --- Content Section --- */}
      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-gray-200 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-dashed border-gray-300">
            <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-4 text-lg text-gray-500 font-medium">No regulations found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-8">
            {filteredRules.map((rule) => (
              <RuleCard key={rule._id} rule={rule} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeViewRules;