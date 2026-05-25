import React, { useState, useEffect, useContext } from 'react';
import Swal from 'sweetalert2';
import { AuthContext } from '../context/AuthContext';
import api, { getRules, createRule, deleteRule } from '../api'; 

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

// --- SUB-COMPONENT: Single Rule Card ---
const RuleCard = ({ rule, onDelete }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

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

  useEffect(() => {
    if (images.length > 1 && !isHovered && !isModalOpen) {
      const timer = setInterval(() => {
        setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [images.length, isHovered, isModalOpen]);

  const handleNext = (e) => {
    if(e) e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handlePrev = (e) => {
    if(e) e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

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
    setModalIndex(currentImageIndex);
    setIsModalOpen(true);
    setIsHovered(true);
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

  return (
    <>
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition duration-300 relative flex flex-col h-full">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase mb-2 ${
              rule.category === 'Safety' ? 'bg-red-100 text-red-700' :
              rule.category === 'HR Policy' ? 'bg-purple-100 text-purple-700' :
              'bg-blue-50 text-blue-700'
            }`}>
              {rule.category}
            </span>
            <h3 className="text-xl font-bold text-gray-800">{rule.title}</h3>
          </div>
          
          <button 
            onClick={() => onDelete(rule._id)} 
            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition duration-200"
            title="Delete Regulation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        <p className="text-gray-600 text-sm leading-relaxed mb-4 whitespace-pre-wrap flex-grow">
          {rule.description}
        </p>

        {images.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div 
              className="relative w-full h-72 bg-gray-900 rounded-lg overflow-hidden group border border-gray-200 cursor-pointer"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={openModal}
            >
              <div className="w-full h-full flex items-center justify-center bg-black">
                {renderFilePreview(images[currentImageIndex])}
              </div>
              <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end items-end h-full pointer-events-none">
                 <button className="bg-white text-gray-900 text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 pointer-events-auto hover:bg-gray-100">
                   {getFileType(images[currentImageIndex]) === 'ppt' ? 'Open in New Tab' : 'Click to Expand'}
                 </button>
              </div>

              {images.length > 1 && (
                <>
                  <button onClick={handlePrev} className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition opacity-0 group-hover:opacity-100 z-10">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button onClick={handleNext} className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition opacity-0 group-hover:opacity-100 z-10">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
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

        <div className="flex items-center justify-end mt-4">
          <span className="text-xs text-gray-400 font-medium">
            {new Date(rule.createdAt).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric'
            })}
          </span>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center">
          <button onClick={closeModal} className="absolute top-3 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all z-[10000]" title="Close Preview">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            {renderFilePreview(images[modalIndex], true)}
            {images.length > 1 && (
              <>
                <button onClick={handleModalPrev} className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-4 rounded-full backdrop-blur-sm transition-all hover:scale-110 z-[10000]">
                   <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button onClick={handleModalNext} className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-4 rounded-full backdrop-blur-sm transition-all hover:scale-110 z-[10000]">
                   <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
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
const AdminRulesPost = () => {
  const { user } = useContext(AuthContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', category: 'General', description: '' });
  const [selectedImages, setSelectedImages] = useState([]);
  const [rules, setRules] = useState([]);
  const [filteredRules, setFilteredRules] = useState([]); 
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false); 
  const [fetching, setFetching] = useState(true); 

  // --- 1. Fetch Rules (UPDATED) ---
  const fetchRulesData = async () => {
    try {
      // USING API.JS FUNCTION
      const data = await getRules();
      setRules(data);
      setFilteredRules(data);
      setFetching(false);
    } catch (error) {
      console.error("Error fetching rules", error);
      setFetching(false);
    }
  };

  useEffect(() => { fetchRulesData(); }, []);

  // --- 2. Dynamic Search ---
  useEffect(() => {
    if (searchTerm === '') {
      setFilteredRules(rules);
    } else {
      const lowerTerm = searchTerm.toLowerCase();
      const filtered = rules.filter(rule => 
        rule.title.toLowerCase().includes(lowerTerm) ||
        rule.category.toLowerCase().includes(lowerTerm)
      );
      setFilteredRules(filtered);
    }
  }, [searchTerm, rules]);

  // --- 3. Handle Inputs ---
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleImageChange = (e) => {
    if (e.target.files) {
      setSelectedImages(Array.from(e.target.files));
    }
  };

  // --- 4. Handle Submit (UPDATED) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const data = new FormData();
    data.append('title', formData.title);
    data.append('category', formData.category);
    data.append('description', formData.description);

    const adminId = user?._id || user?.id || user?.adminId || user?.creatorId;
    const companyId = user?.companyId || user?.company?._id || user?.company;

    if (adminId) data.append('adminId', adminId);
    if (companyId) data.append('companyId', companyId);

    if (selectedImages.length > 0) {
      selectedImages.forEach((image) => data.append('images', image));
    }

    try {
      // USING API.JS FUNCTION
      await createRule(data);
      
      setIsModalOpen(false);
      setFormData({ title: '', category: 'General', description: '' });
      setSelectedImages([]);
      
      Swal.fire({
        icon: 'success',
        title: 'Published!',
        text: 'The regulation has been posted successfully.',
        timer: 1500,
        showConfirmButton: false
      });

      fetchRulesData(); 
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Upload Failed',
        text: 'Something went wrong while posting.'
      });
    } finally {
      setLoading(false);
    }
  };

  // --- 5. Handle Delete (UPDATED) ---
  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        // USING API.JS FUNCTION
        await deleteRule(id);
        
        setRules(rules.filter(rule => rule._id !== id));
        Swal.fire('Deleted!', 'Regulation removed.', 'success');
      } catch (error) {
        Swal.fire('Error!', 'Failed to delete.', 'error');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 font-sans text-slate-800">
      
      {/* HEADER SECTION */}
      <div className="max-w-5xl mx-auto text-center mb-8">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-2">
          Manage Our Company Rules & Regulations
        </h1>
        <p className="text-gray-500">Manage compliance documents and employee guidelines.</p>
      </div>

      {/* CONTROLS */}
      <div className="max-w-5xl mx-auto mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition transform flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Post New Rule
        </button>

        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            type="text" 
            placeholder="Search rules..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none shadow-sm"
          />
        </div>
      </div>

      {/* LIST OF RULES */}
      <div className="max-w-5xl mx-auto space-y-6">
        {fetching ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
            Loading...
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-dashed border-gray-300">
            <p className="text-gray-500">No regulations found matching your criteria.</p>
          </div>
        ) : (
          filteredRules.map((rule) => (
            <RuleCard key={rule._id} rule={rule} onDelete={handleDelete} />
          ))
        )}
      </div>

      {/* --- CREATE MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsModalOpen(false)}
          ></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 flex justify-between items-center shrink-0">
              <h2 className="text-white text-xl font-bold">Create New Policy</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="ruleForm" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                    <input type="text" name="title" value={formData.title} onChange={handleChange} required className="w-full px-4 py-2 rounded-lg bg-gray-50 border focus:border-blue-500 outline-none"/>
                  </div>
                  <div className="group">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                    <select name="category" value={formData.category} onChange={handleChange} className="w-full px-4 py-2 rounded-lg bg-gray-50 border focus:border-blue-500 outline-none">
                      <option value="General">General</option>
                      <option value="HR Policy">HR Policy</option>
                      <option value="Safety">Safety & Compliance</option>
                      <option value="IT Security">IT & Security</option>
                    </select>
                  </div>
                </div>
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} rows="4" required className="w-full px-4 py-3 rounded-lg bg-gray-50 border focus:border-blue-500 outline-none resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Attach Files</label>
                  <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-blue-50 cursor-pointer bg-gray-50">
                    <input type="file" onChange={handleImageChange} accept="image/*,.pdf,.ppt,.pptx" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                    <div className="space-y-1">
                      <svg className="mx-auto h-8 w-8 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-gray-500 text-sm block">
                        {selectedImages.length > 0 ? `${selectedImages.length} files selected` : "Drag files or click to upload"}
                      </span>
                    </div>
                  </div>
                  {selectedImages.length > 0 && (
                     <div className="mt-2 text-xs text-gray-500 max-h-20 overflow-y-auto">
                        {selectedImages.map((f, i) => <div key={i}>{f.name}</div>)}
                     </div>
                  )}
                </div>
              </form>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-gray-50">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 rounded-lg text-gray-600 font-medium hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button 
                form="ruleForm"
                type="submit" 
                disabled={loading}
                className="px-6 py-2 rounded-lg text-white font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg transition disabled:opacity-50"
              >
                {loading ? 'Publishing...' : 'Publish Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRulesPost;