import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { generateOfferLetterPdf } from '../../utils/offerLetterPdfGenerator';
import * as api from '../../api';
import {
    Sparkles, X, UploadCloud, FileText, Send,
    Download, AlignLeft, AlignCenter, AlignRight, Pencil
} from 'lucide-react';

// Removed hardcoded COMPANY_NAMES as per user request. Using dynamic state.

const PdfViewer = ({ base64Url }) => {
    const [blobUrl, setBlobUrl] = useState(null);

    useEffect(() => {
        if (!base64Url) return;
        
        let url;
        try {
            // Using fetch to convert base64 data to completely detached Blob bypasses Chrome length limits
            fetch(base64Url)
                .then(res => res.blob())
                .then(blob => {
                    url = URL.createObjectURL(blob);
                    setBlobUrl(url + "#toolbar=0&navpanes=0&zoom=75");
                })
                .catch(console.error);
        } catch (err) {
            console.error(err);
        }
        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [base64Url]);

    if (!blobUrl) return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Rendering PDF...</div>;
    return <iframe src={blobUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Preview" />;
};

const EditableContent = ({ initialContent, onChange }) => {
    const editorRef = React.useRef(null);

    // Initial render only
    React.useEffect(() => {
        if (editorRef.current && initialContent && !editorRef.current.innerHTML) {
            editorRef.current.innerHTML = initialContent;
        }
    }, []);

    // If initialContent changes significantly (e.g. new generation), update it
    // But be careful not to overwrite user edits if it's just a small re-render
    React.useEffect(() => {
        if (editorRef.current && initialContent !== editorRef.current.innerHTML) {
            // Only update if the content is truly different (e.g. from AI generation)
            // avoiding overwriting if the user is typing (which updates state)
            // This is tricky. simpler: only update if the passed initialContent
            // doesn't match what we have, but we need to trust the parent pushes new content only when needed.
            // For now, let's trust the parent only sends new initialContent when it changes from source.

            // Check if the update is coming from our own input (loop)
            if (document.activeElement !== editorRef.current) {
                editorRef.current.innerHTML = initialContent;
            }
        }
    }, [initialContent]);

    const [activeFormats, setActiveFormats] = React.useState({});

    const checkActiveFormats = () => {
        setActiveFormats({
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            justifyLeft: document.queryCommandState('justifyLeft'),
            justifyCenter: document.queryCommandState('justifyCenter'),
            justifyRight: document.queryCommandState('justifyRight'),
        });
    };

    const handleInput = (e) => {
        onChange(e.currentTarget.innerHTML);
        checkActiveFormats();
    };

    const execCmd = (cmd, val = null) => {
        document.execCommand(cmd, false, val);
        if (editorRef.current) onChange(editorRef.current.innerHTML); // Trigger update
        checkActiveFormats();
    };

    const getBtnStyle = (isActive) => ({
        padding: '6px 10px',
        background: isActive ? 'var(--accent-color)' : 'var(--bg-secondary)',
        border: isActive ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
        color: isActive ? 'white' : 'var(--text-primary)',
        borderRadius: '4px',
        cursor: 'pointer',
        minWidth: '32px',
        fontWeight: isActive ? 'bold' : 'normal',
        transition: 'all 0.1s'
    });

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
            {/* TOOLBAR */}
            <div style={{
                display: 'flex', gap: '8px', padding: '8px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', alignItems: 'center', flexWrap: 'wrap'
            }}>
                <button onClick={() => execCmd('bold')} style={getBtnStyle(activeFormats.bold)} title="Bold"><b>B</b></button>
                <button onClick={() => execCmd('italic')} style={getBtnStyle(activeFormats.italic)} title="Italic"><i>I</i></button>
                <button onClick={() => execCmd('underline')} style={getBtnStyle(activeFormats.underline)} title="Underline"><u>U</u></button>

                <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 4px' }} />

                <select onChange={(e) => execCmd('fontName', e.target.value)} style={selectStyle} defaultValue="Arial">
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Tahoma">Tahoma</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Trebuchet MS">Trebuchet MS</option>
                </select>

                <select onChange={(e) => execCmd('fontSize', e.target.value)} style={selectStyle} defaultValue="3">
                    <option value="1">Tiny (1)</option>
                    <option value="2">Small (2)</option>
                    <option value="3">Normal (3)</option>
                    <option value="4">Medium (4)</option>
                    <option value="5">Large (5)</option>
                    <option value="6">X-Large (6)</option>
                    <option value="7">Huge (7)</option>
                </select>

                <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 4px' }} />

                <button onClick={() => execCmd('justifyLeft')} style={getBtnStyle(activeFormats.justifyLeft)} title="Align Left"><AlignLeft size={16} /></button>
                <button onClick={() => execCmd('justifyCenter')} style={getBtnStyle(activeFormats.justifyCenter)} title="Align Center"><AlignCenter size={16} /></button>
                <button onClick={() => execCmd('justifyRight')} style={getBtnStyle(activeFormats.justifyRight)} title="Align Right"><AlignRight size={16} /></button>
            </div>

            {/* EDITOR */}
            <div
                ref={editorRef}
                className="document-editor"
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onKeyUp={checkActiveFormats}
                onMouseUp={checkActiveFormats}
                style={{
                    flex: 1,
                    padding: '3rem',
                    color: '#1e293b',
                    overflowY: 'auto',
                    outline: 'none',
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.02)'
                }}
            />
        </div>
    );
};

const btnStyle = {
    padding: '6px 10px', background: 'white', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', minWidth: '32px'
};

const selectStyle = {
    padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none', cursor: 'pointer',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)'
};

const LetterModal = ({ employee, onClose, onSuccess }) => {
    const [letterType, setLetterType] = useState('Offer Letter');
    const [generatedContent, setGeneratedContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('pdf');

    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [companies, setCompanies] = useState([]);
    const [availableTemplates, setAvailableTemplates] = useState([]);

    const prevTemplateRef = React.useRef(selectedTemplate);
    const prevCompanyNameRef = React.useRef(companyName);
    const contentRef = React.useRef(generatedContent);

    // Keep contentRef in sync
    useEffect(() => {
        contentRef.current = generatedContent;
    }, [generatedContent]);

    const [pdfUrl, setPdfUrl] = useState(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const [emailBody, setEmailBody] = useState("");
    const fileInputRef = React.useRef(null);

    // Initial Fetch
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [compList, tempList] = await Promise.all([
                    api.getOfferLetterCompanies(),
                    api.getOfferLetterTemplates()
                ]);
                setCompanies(compList || []);
                setAvailableTemplates(tempList || []);

                if (compList?.length > 0) setCompanyName(compList[0].company_name || compList[0].name);
                if (tempList?.length > 0) setSelectedTemplate(tempList[0].templateUrl || tempList[0].url);
            } catch (err) {
                console.error("Failed to load companies/templates:", err);
            }
        };
        loadInitialData();
    }, []);

    const handleCustomTemplateUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('companyName', companyName);
        try {
            setLoading(true);
            const data = await api.uploadOfferLetterTemplate(formData);
            setSelectedTemplate(data.templateUrl || data.url);

            // We explicitly do NOT auto-extract company name from the filename in HRMS 
            // because the user selects the company directly from the dropdown. 
            // Overwriting it with the raw filename leads to '.pdf' bugs in the email.

            alert(`Custom Template Uploaded! \n${data.filename}`);

            // Refresh template list to include the new one
            const tempList = await api.getOfferLetterTemplates();
            setAvailableTemplates(tempList || []);
        } catch (err) {
            console.error(err);
            alert("Upload failed: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Sync template when company name changes (Auto-select template)
    useEffect(() => {
        if (!companyName || availableTemplates.length === 0) return;
        // Search by exact match first, then by partial if needed
        const matched = availableTemplates.find(t => 
            t.companyName?.toLowerCase() === companyName.toLowerCase() ||
            t.name?.toLowerCase().includes(companyName.toLowerCase())
        );
        if (matched) setSelectedTemplate(matched.templateUrl || matched.url);
    }, [companyName, availableTemplates]);

    useEffect(() => {
        const prevName = prevCompanyNameRef.current;
        // Update the ref to the new company name for next change
        prevCompanyNameRef.current = companyName;

        // Update Email Body
        setEmailBody(
            `Dear ${employee.name},\n\nWe are pleased to offer you the position at ${companyName}.\n\nPlease find the detailed offer letter attached.\n\nBest Regards,\nHR Team`
        );

        // Update Generated HTML Content to reflect new Company Name
        if (generatedContent && prevName !== companyName) {
            let newContent = generatedContent;

            // Build a list of all names to search for: the previous company name + all known names
            const namesToReplace = new Set();
            // Always add the previous name so we catch whatever was in the content before
            if (prevName) namesToReplace.add(prevName);
            // Also add all current company names to catch any variant
            companies.forEach(c => namesToReplace.add(c.company_name || c.name));

            namesToReplace.forEach(name => {
                if (name.toLowerCase() === companyName.toLowerCase()) return; // Don't replace self
                // Escape special chars for regex
                const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // Case-insensitive global replacement to catch UPPERCASE, Title Case, etc.
                const regex = new RegExp(escapedName, 'gi');
                newContent = newContent.replace(regex, companyName);
            });

            if (newContent !== generatedContent) {
                console.log("🏢 Syncing content with new company:", companyName);
                setGeneratedContent(newContent);
            }
        }
    }, [companyName, employee.name]);

    // Auto-Preview when generatedContent changes
    useEffect(() => {
        if (!generatedContent || viewMode !== 'pdf') return;

        // Debounce typing to prevent excessive PDF generation
        const timer = setTimeout(() => {
            generatePreview(generatedContent);
        }, 500); // Reduced to 500ms for faster feedback
        return () => clearTimeout(timer);
    }, [generatedContent, selectedTemplate]);

    const handleGenerate = () => {
        setLoading(true);
        setPdfUrl(null);
        api.generateOfferLetter({
            employeeId: employee.id || employee._id,
            letterType: letterType,
            tone: "Professional",
            companyName: companyName
        })
            .then(async data => {
                setGeneratedContent(data.content || data);
                setLoading(false);
                // Immediate preview
                await generatePreview(data.content || data);
            })
            .catch(err => {
                console.error("Error generating letter:", err);
                setLoading(false);
                setGeneratedContent("Error: Could not connect to AI Service.");
            });
    };

    const generatePreview = async (htmlContent) => {
        if (!htmlContent) return;
        setIsGeneratingPdf(true);
        let dataUri = null;
        try {
            console.log("🎨 PDF Generation Step: Using Template:", selectedTemplate);
            // Clean up header for PDF (which has its own logo in background)
            const contentWithoutHeader = htmlContent.replace(/<div style="text-align: center; border-bottom: 2px solid #0056b3;[\s\S]*?<\/div>/i, '');
            dataUri = await generateOfferLetterPdf(contentWithoutHeader, selectedTemplate);
            setPdfUrl(dataUri);
        } catch (e) {
            console.error("PDF Generator Error:", e);
            alert("Error generating PDF: " + (e.message || "Template might be missing."));
            setPdfUrl(null);
        }
        setIsGeneratingPdf(false);
        if (dataUri) {
            setViewMode('pdf');
        } else {
            setViewMode('editor');
        }
    };

    const handleDownloadPDF = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `${employee.name.replace(/\s+/g, '_')}_${letterType}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadDOCX = async () => {
        if (!generatedContent) return;
        const btn = document.getElementById('docxBtn');
        if(btn) {
            btn.innerText = 'Converting...';
            btn.disabled = true;
        }

        try {
            const blob = await api.downloadOfferLetterDocx({
                htmlContent: generatedContent,
                templateUrl: selectedTemplate
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${employee.name.replace(/\s+/g, '_')}_${letterType}.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            if(btn) {
                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> <span class="hide-mobile"> Words</span> DOCX';
                btn.disabled = false;
            }
        } catch (error) {
            console.error("DOCX download error:", error);
            alert("Error generating DOCX document. Please try again.");
            if(btn) {
                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> <span class="hide-mobile"> Words</span> DOCX';
                btn.disabled = false;
            }
        }
    };

    const handleSendEmail = async () => {
        const btn = document.getElementById('emailBtn');
        btn.innerText = 'Sending...';
        btn.disabled = true;

        try {
            const subject = `${letterType} - ${employee.name}`;
            await api.sendOfferLetterEmail({
                employeeId: employee.id || employee._id,
                emailBody: emailBody,
                pdfBase64: pdfUrl,
                companyName: companyName
            });

            alert("Email Sent Successfully! 🚀");
            btn.innerText = 'Sent ✅';
            if (onSuccess) onSuccess();

        } catch (err) {
            console.error(err);
            alert("Failed: " + err.message);
            btn.innerText = 'Retry ❌';
            btn.disabled = false;
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--modal-overlay)',
            backdropFilter: 'blur(5px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 3000
        }}>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                style={{
                    background: 'var(--bg-secondary)',
                    padding: '0.75rem',
                    width: '100vw',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    border: 'none',
                    borderRadius: 0,
                }}
            >
                {/* COMPACT THEMED HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <div>
                        <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={18} style={{ color: 'var(--accent-color)' }} /> Document Workshop: {employee.name}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#ef4444',
                            border: 'none',
                            color: 'white',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* THEMED CONTROLS */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '12px' }}>
                    <select
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        style={{
                            padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', border: '1px solid var(--border-color)', flex: '1 1 200px', fontSize: '0.9rem', outline: 'none'
                        }}
                    >
                        {companies.map(c => <option key={c.id || c._id} value={c.company_name || c.name}>{c.company_name || c.name}</option>)}
                    </select>

                    <select
                        value={letterType}
                        onChange={(e) => setLetterType(e.target.value)}
                        style={{
                            padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', border: '1px solid var(--border-color)', flex: '1 1 150px', fontSize: '0.9rem', outline: 'none'
                        }}
                    >
                        <option>Offer Letter</option>
                        <option>Internship Letter</option>
                        <option>Appraisal Letter</option>
                        <option>Experience Letter</option>
                        <option>Relieving Letter</option>
                        <option>Others</option>
                    </select>

                    <select
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                        style={{
                            padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', border: '1px solid var(--border-color)', flex: '1 1 150px', fontSize: '0.9rem', outline: 'none'
                        }}
                    >
                        {availableTemplates.length === 0 ? <option value="">No Templates</option> :
                            availableTemplates.map(t => <option key={t._id || t.id} value={t.templateUrl || t.url}>{t.name || t.filename || 'Template'}</option>)}
                    </select>

                    <input type="file" accept="application/pdf" ref={fileInputRef} style={{ display: 'none' }} onChange={handleCustomTemplateUpload} />
                    <button
                        onClick={() => fileInputRef.current.click()}
                        style={{
                            background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)',
                            color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
                            fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', justifyContent: 'center'
                        }}
                    >
                        <UploadCloud size={16} /> <span className="hide-mobile">Custom</span> Template
                    </button>

                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        style={{
                            background: loading ? 'var(--border-color)' : 'var(--accent-color)',
                            color: 'white', border: 'none', padding: '10px 24px',
                            borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer',
                            flex: '1 1 200px', fontSize: '0.95rem', boxShadow: 'var(--card-shadow)',
                            display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center'
                        }}
                    >
                        {loading ? 'AI Working...' : <><Sparkles size={18} /> Generate Draft</>}
                    </button>
                </div>

                {/* SPLIT SCREEN area */}
                <div className="split-screen-container" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div className="split-screen" style={{ flex: 1, display: 'flex', gap: '1rem', minHeight: 0, overflow: 'hidden' }}>

                        {!generatedContent && !loading && (
                            <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '2px dashed var(--border-color)' }}>
                                <p style={{ fontSize: '1.1rem' }}>Choose a template and click <b>Generate</b> to begin mapping the future.</p>
                            </div>
                        )}

                        {loading && (
                            <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)' }}>
                                <div className="spinner" style={{ width: '50px', height: '50px', border: '5px solid var(--border-color)', borderTop: '5px solid var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                <p style={{ marginTop: '1.5rem', fontWeight: 600 }}>Synthesizing professional document...</p>
                            </div>
                        )}

                        {generatedContent && !loading && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                                <div style={{ marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Pencil size={14} /> Rich Text Editor <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>(Auto-Syncing)</span>
                                </div>
                                <div style={{ flex: 1, borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                    <EditableContent initialContent={generatedContent} onChange={setGeneratedContent} />
                                </div>
                            </div>
                        )}

                        {generatedContent && !loading && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                                <div style={{ marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>📄 PDF Synchronizer ({pdfUrl ? '100% ✓' : 'Rendering...'})</span>
                                    {isGeneratingPdf && <span style={{ color: 'var(--accent-color)', animation: 'pulse 1s infinite' }}>● Syncing</span>}
                                </div>
                                <div style={{ flex: 1, background: '#525659', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative' }}>
                                    {pdfUrl ? (
                                        <PdfViewer base64Url={pdfUrl} />
                                    ) : (
                                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Finalizing pixels...</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>{/* END split-screen-container */}

                {/* FOOTER - outside split-screen so it's always visible */}
                {generatedContent && (
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', flexShrink: 0 }}>
                        <div style={{ flex: '1 1 300px' }}>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                                📧 Messaging:
                            </label>
                            <textarea
                                value={emailBody}
                                onChange={e => setEmailBody(e.target.value)}
                                style={{
                                    width: '100%', height: '80px', borderRadius: '10px',
                                    background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)',
                                    padding: '12px', fontSize: '0.9rem', resize: 'none', outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flex: '1 1 auto', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button
                                id="docxBtn"
                                onClick={handleDownloadDOCX}
                                style={{
                                    background: 'var(--bg-secondary)', border: '2px solid #2563eb', color: '#2563eb',
                                    padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem',
                                    display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', justifyContent: 'center'
                                }}
                            >
                                <FileText size={18} /> <span className="hide-mobile">Words</span> DOCX
                            </button>
                            <button
                                onClick={handleDownloadPDF}
                                style={{
                                    background: 'var(--bg-secondary)', border: '2px solid var(--accent-color)', color: 'var(--accent-color)',
                                    padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem',
                                    display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', justifyContent: 'center'
                                }}
                            >
                                <Download size={18} /> <span className="hide-mobile">Download</span> PDF
                            </button>
                            <button
                                id="emailBtn"
                                onClick={handleSendEmail}
                                style={{
                                    background: 'var(--accent-color)', border: 'none', color: 'white',
                                    padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: 'var(--card-shadow)',
                                    display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', justifyContent: 'center'
                                }}
                            >
                                <Send size={18} /> <span className="hide-mobile">Send Email</span>
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default LetterModal;
