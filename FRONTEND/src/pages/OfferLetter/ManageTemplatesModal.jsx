import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
    X, UploadCloud, FileText, Trash2, 
    CheckCircle, AlertCircle, Loader2, Plus
} from 'lucide-react';
import * as api from '../../api';

const ManageTemplatesModal = ({ onClose }) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [companyName, setCompanyName] = useState("");
    const fileInputRef = useRef(null);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const data = await api.getOfferLetterTemplates();
            setTemplates(data || []);
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleFileUpload = async (file) => {
        if (!file) return;
        
        const formData = new FormData();
        formData.append('file', file);
        // Extract a clean name from filename
        let cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
        formData.append('name', cleanName);
        formData.append('companyName', companyName || "");

        setUploading(true);
        try {
            const data = await api.uploadOfferLetterTemplate(formData);
            alert(`Template "${data.name}" uploaded successfully!`);
            setCompanyName(""); // Reset
            fetchTemplates();
        } catch (error) {
            alert(`Upload failed: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Are you sure you want to delete the template "${name}"?`)) return;
        
        try {
            await api.deleteOfferLetterTemplate(id);
            setTemplates(templates.filter(t => t._id !== id));
        } catch (error) {
            alert(`Delete failed: ${error.message}`);
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };

    return (
        <div style={overlayStyle}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                style={modalStyle}
            >
                <div style={headerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={iconBoxStyle}>
                            <FileText size={20} color="var(--accent-color)" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Template Manager</h2>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Upload and manage custom offer letter backgrounds</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={closeBtnStyle}>
                        <X size={20} />
                    </button>
                </div>

                <div style={bodyStyle}>
                    {/* OPTIONAL COMPANY NAME INPUT */}
                    <div style={inputSectionStyle}>
                        <label style={labelStyle}>Link to Company (Optional)</label>
                        <input 
                            type="text" 
                            placeholder="Example: Arah Infotech"
                            value={companyName || ""} 
                            onChange={(e) => setCompanyName(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={inputStyle}
                        />
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Linking to a company name helps auto-select the template in the workshop.
                        </p>
                    </div>

                    {/* UPLOAD SECTION */}
                    <div 
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            ...dropZoneStyle,
                            borderColor: dragActive ? 'var(--accent-color)' : 'var(--border-color)',
                            background: dragActive ? 'var(--accent-soft)' : 'var(--bg-tertiary)'
                        }}
                    >
                        {uploading ? (
                            <div style={centerContentStyle}>
                                <Loader2 size={32} className="animate-spin" color="var(--accent-color)" />
                                <p style={{ marginTop: '12px', fontWeight: 600 }}>Uploading to Cloudinary...</p>
                            </div>
                        ) : (
                            <div style={centerContentStyle}>
                                <div style={uploadCircleStyle}>
                                    <UploadCloud size={24} color="var(--accent-color)" />
                                </div>
                                <p style={{ marginTop: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    Click or drag & drop to upload
                                </p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    Supported: PDF, JPG, PNG (Max 5MB)
                                </p>
                            </div>
                        )}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={(e) => handleFileUpload(e.target.files[0])}
                            style={{ display: 'none' }}
                            accept=".pdf,.jpg,.jpeg,.png"
                        />
                    </div>

                    {/* LIST SECTION */}
                    <div style={listContainerStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Existing Templates ({templates.length})
                            </h3>
                            {loading && <Loader2 size={16} className="animate-spin" color="var(--accent-color)" />}
                        </div>

                        {templates.length === 0 && !loading ? (
                            <div style={emptyStateStyle}>
                                <AlertCircle size={32} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                                <p style={{ marginTop: '12px' }}>No custom templates found. Upload your first one above!</p>
                            </div>
                        ) : (
                            <div style={gridStyle}>
                                {templates.map((template) => (
                                    <div key={template._id} style={templateCardStyle}>
                                        <div style={templatePreviewWrapper}>
                                            {template.templateUrl.endsWith('.pdf') ? (
                                                <div style={pdfLabelStyle}>PDF</div>
                                            ) : (
                                                <img src={template.templateUrl} alt={template.name} style={previewImgStyle} />
                                            )}
                                        </div>
                                        <div style={templateInfoStyle}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={templateNameStyle}>{template.name}</div>
                                                <div style={templateMetaStyle}>{template.originalFilename}</div>
                                            </div>
                                            <button 
                                                onClick={() => handleDelete(template._id, template.name)}
                                                style={deleteBtnStyle}
                                                title="Delete Template"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div style={footerStyle}>
                    <button onClick={onClose} style={doneBtnStyle}>Done</button>
                </div>
            </motion.div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    );
};

// --- STYLES ---
const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 4000, padding: '20px'
};

const modalStyle = {
    background: 'var(--card-bg)', width: '100%', maxWidth: '800px',
    maxHeight: '90vh', borderRadius: '24px', display: 'flex',
    flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
};

const headerStyle = {
    padding: '20px 24px', borderBottom: '1px solid var(--border-color)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'var(--bg-secondary)'
};

const iconBoxStyle = {
    width: '40px', height: '40px', borderRadius: '10px',
    background: 'var(--accent-soft)', display: 'flex',
    alignItems: 'center', justifyContent: 'center'
};

const closeBtnStyle = {
    background: 'transparent', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', padding: '4px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s'
};

const bodyStyle = {
    padding: '24px', overflowY: 'auto', flex: 1,
    display: 'flex', flexDirection: 'column', gap: '24px'
};

const inputSectionStyle = {
    display: 'flex', flexDirection: 'column'
};

const labelStyle = {
    fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)',
    marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px'
};

const inputStyle = {
    padding: '12px 16px', borderRadius: '10px', background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)', color: 'var(--text-primary)',
    fontSize: '0.9rem', outline: 'none', transition: 'all 0.2s'
};

const dropZoneStyle = {
    border: '2px dashed var(--border-color)', borderRadius: '16px',
    padding: '40px 20px', cursor: 'pointer', transition: 'all 0.3s ease',
    textAlign: 'center'
};

const uploadCircleStyle = {
    width: '56px', height: '56px', borderRadius: '50%',
    background: 'var(--bg-primary)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', margin: '0 auto',
    boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
};

const centerContentStyle = {
    display: 'flex', flexDirection: 'column', alignItems: 'center'
};

const listContainerStyle = {
    flex: 1
};

const gridStyle = {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '16px'
};

const templateCardStyle = {
    background: 'var(--bg-tertiary)', borderRadius: '12px',
    border: '1px solid var(--border-color)', overflow: 'hidden',
    display: 'flex', flexDirection: 'column'
};

const templatePreviewWrapper = {
    height: '140px', background: '#e2e8f0', display: 'flex',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    position: 'relative'
};

const previewImgStyle = {
    width: '100%', height: '100%', objectFit: 'cover'
};

const pdfLabelStyle = {
    fontSize: '2rem', fontWeight: 900, color: '#ef4444',
    background: 'white', padding: '10px 20px', borderRadius: '8px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
};

const templateInfoStyle = {
    padding: '12px', display: 'flex', alignItems: 'center', gap: '8px'
};

const templateNameStyle = {
    fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
};

const templateMetaStyle = {
    fontSize: '0.7rem', color: 'var(--text-muted)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
};

const deleteBtnStyle = {
    background: 'rgba(239, 68, 68, 0.1)', border: 'none',
    color: '#ef4444', cursor: 'pointer', padding: '6px',
    borderRadius: '6px', display: 'flex', alignItems: 'center',
    justifyContent: 'center'
};

const emptyStateStyle = {
    textAlign: 'center', padding: '40px 20px',
    color: 'var(--text-muted)', fontSize: '0.9rem'
};

const footerStyle = {
    padding: '16px 24px', borderTop: '1px solid var(--border-color)',
    display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-secondary)'
};

const doneBtnStyle = {
    background: 'var(--accent-color)', color: 'white', border: 'none',
    padding: '10px 24px', borderRadius: '8px', fontWeight: 600,
    cursor: 'pointer', fontSize: '0.9rem'
};

export default ManageTemplatesModal;
