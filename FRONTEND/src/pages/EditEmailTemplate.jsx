import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, Sparkles, Bold, Italic, Underline, AlignLeft, 
  AlignCenter, AlignRight, AlignJustify, HelpCircle, Palette,Type,
  Maximize2, FileText, CheckCircle, RefreshCw, Plus, Image
} from 'lucide-react';
import Swal from 'sweetalert2';

const DEFAULT_SUBJECT = 'Document Verification Required – [Company Name]';
const DEFAULT_MESSAGE = `<div>Dear [NAME],</div>
<div><br></div>
<div>We are pleased to inform you that you have been selected as part of the onboarding process at <strong>[COMPANY]</strong>.</div>
<div><br></div>
<div>As part of our documentation requirements, we kindly request you to upload your necessary documents using the secure link below.</div>
<div><br></div>
<div><a href="[FORM_LINK]" style="color: #7c3aed; font-weight: bold; text-decoration: underline;">[FORM_LINK]</a></div>
<div><br></div>
<div>Please ensure you upload clear, readable copies of all required documents.</div>
<div><br></div>
<div>You have been invited as <strong>[ROLE]</strong> (<strong>[EMPLOYMENT_TYPE]</strong>) in the <strong>[DEPT]</strong> department.</div>
<div><br></div>
<div>If you face any issues, please reach out to the HR team immediately.</div>
<div><br></div>
<div>Warm regards,</div>
<div><strong>HR Team</strong></div>
<div><strong>[COMPANY]</strong></div>`;

const FONT_FAMILIES = [
  { name: 'System UI', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { name: 'Outfit', value: '"Outfit", sans-serif' },
  { name: 'Inter', value: '"Inter", sans-serif' },
  { name: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Courier New', value: '"Courier New", Courier, monospace' },
  { name: 'Times New Roman', value: '"Times New Roman", Times, serif' }
];

const FONT_SIZES = [
  { name: '12px', value: '3' }, // map to standard execCommand sizes
  { name: '14px', value: '4' },
  { name: '16px', value: '5' },
  { name: '18px', value: '6' },
  { name: '24px', value: '7' }
];

const PLACEHOLDERS = [
  { label: '[NAME]', desc: 'Candidate Name' },
  { label: '[ROLE]', desc: 'Designation' },
  { label: '[DEPT]', desc: 'Department (IT/NON-IT)' },
  { label: '[EMPLOYMENT_TYPE]', desc: 'Full-Time/Intern/Contract' },
  { label: '[COMPANY]', desc: 'Selected Company Name' },
  { label: '[FORM_LINK]', desc: 'Secure document upload link' }
];

const EditEmailTemplate = () => {
  const navigate = useNavigate();
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);

  const [templates, setTemplates] = useState(() => {
    const list = localStorage.getItem('doc_verify_templates_list');
    if (list) {
      try {
        return JSON.parse(list);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      { id: 'default', name: 'Default Template', subject: DEFAULT_SUBJECT, message: DEFAULT_MESSAGE }
    ];
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState(() => {
    return localStorage.getItem('doc_verify_selected_template_id') || 'default';
  });

  const [subject, setSubject] = useState('');
  const [editorFont, setEditorFont] = useState('Outfit');
  const [textColor, setTextColor] = useState('#334155');

  useEffect(() => {
    // Initialise editor content
    if (editorRef.current) {
      const activeTpl = templates.find(t => t.id === selectedTemplateId) || templates[0];
      setSubject(activeTpl.subject);
      editorRef.current.innerHTML = activeTpl.message;
    }
  }, [selectedTemplateId]);

  const handleSelectTemplate = (id) => {
    const tpl = templates.find(t => t.id === id);
    if (tpl) {
      setSelectedTemplateId(tpl.id);
      localStorage.setItem('doc_verify_selected_template_id', tpl.id);
      setSubject(tpl.subject);
      if (editorRef.current) {
        editorRef.current.innerHTML = tpl.message;
      }
    }
  };

  // Format Helper
  const executeCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const handleSave = () => {
    if (!subject.trim()) {
      return Swal.fire({
        icon: 'error',
        title: 'Validation Failed',
        text: 'Subject line cannot be empty.',
        confirmButtonColor: '#7c3aed'
      });
    }

    const htmlContent = editorRef.current ? editorRef.current.innerHTML : '';
    
    const updated = templates.map(t => {
      if (t.id === selectedTemplateId) {
        return { ...t, subject, message: htmlContent };
      }
      return t;
    });

    setTemplates(updated);
    localStorage.setItem('doc_verify_templates_list', JSON.stringify(updated));
    localStorage.setItem('doc_verify_email_subject', subject);
    localStorage.setItem('doc_verify_email_message', htmlContent);

    Swal.fire({
      icon: 'success',
      title: 'Template Saved!',
      text: 'Your document verification email template has been updated.',
      confirmButtonColor: '#7c3aed',
      timer: 1500,
      showConfirmButton: false
    });

    setTimeout(() => {
      navigate('/admin/doc-verify-invite');
    }, 1500);
  };

  const insertPlaceholder = (placeholder) => {
    if (editorRef.current) {
      editorRef.current.focus();
      // Insert HTML at current cursor position
      document.execCommand('insertHTML', false, `<strong>${placeholder}</strong>`);
    }
  };

  const handleRestoreDefault = () => {
    Swal.fire({
      title: 'Restore Default?',
      text: 'This will reset your selected template subject and message to the default structure. Are you sure?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#7c3aed',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, restore it'
    }).then((result) => {
      if (result.isConfirmed) {
        setSubject(DEFAULT_SUBJECT);
        if (editorRef.current) {
          editorRef.current.innerHTML = DEFAULT_MESSAGE;
        }
      }
    });
  };

  const handleCreateNew = () => {
    Swal.fire({
      title: 'Enter Template Name',
      input: 'text',
      inputPlaceholder: 'e.g. Software Engineer Invite',
      showCancelButton: true,
      confirmButtonColor: '#7c3aed',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Create',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Template name cannot be empty!';
        }
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const name = result.value.trim();
        const newId = Date.now().toString();
        const newTpl = {
          id: newId,
          name,
          subject: `Document Verification Required – ${name}`,
          message: '<div>Dear [NAME],</div><div><br></div><div>Type your custom message here...</div>'
        };

        const updated = [...templates, newTpl];
        setTemplates(updated);
        localStorage.setItem('doc_verify_templates_list', JSON.stringify(updated));
        setSelectedTemplateId(newId);
        localStorage.setItem('doc_verify_selected_template_id', newId);
        
        setSubject(newTpl.subject);
        if (editorRef.current) {
          editorRef.current.innerHTML = newTpl.message;
        }

        Swal.fire({
          icon: 'success',
          title: 'Template Created!',
          text: `"${name}" template has been loaded.`,
          confirmButtonColor: '#7c3aed',
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      Swal.fire({
        icon: 'error',
        title: 'Image Too Large',
        text: 'Please upload an image smaller than 2MB to ensure compatibility.',
        confirmButtonColor: '#7c3aed'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      if (editorRef.current) {
        editorRef.current.focus();
        
        // Create styled img tag for insertion at cursor
        const imgHtml = `<div style="margin-top: 12px; margin-bottom: 12px;"><img src="${base64}" style="max-width: 140px; height: auto; border-radius: 8px; border: 1px solid #e2e8f0; padding: 4px; background-color: #ffffff; display: block;" alt="Company Logo" /></div>`;
        
        document.execCommand('insertHTML', false, imgHtml);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset selection
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans antialiased text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/admin/doc-verify-invite')}
              className="p-2.5 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200 transition-all cursor-pointer"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <FileText className="text-violet-600" size={24} /> Template Editor
              </h1>
              <p className="text-xs text-slate-500 font-medium">Design and format verification email notifications</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={handleRestoreDefault}
              className="flex-1 sm:flex-none px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} /> Restore Default
            </button>
            <button 
              onClick={handleCreateNew}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg"
            >
              <Plus size={14} /> Create New
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save size={14} /> Save Template
            </button>
          </div>
        </div>

        {/* WORKSPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* EDITOR COLUMN */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              
              {/* Subject Input Banner */}
              <div className="p-5 border-b border-slate-200/80 bg-slate-50/50">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Subject Line</label>
                <input 
                  type="text" 
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Enter email subject line..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none font-bold text-slate-800 transition-all shadow-sm"
                />
              </div>

              {/* WORD-STYLE TOOLBAR */}
              <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-1.5">
                
                {/* Font Selector */}
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
                  <Type size={13} className="text-slate-400" />
                  <select 
                    onChange={e => {
                      setEditorFont(e.target.value);
                      executeCommand('fontName', e.target.value);
                    }}
                    className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer py-0.5"
                  >
                    {FONT_FAMILIES.map(f => (
                      <option key={f.name} value={f.value}>{f.name}</option>
                    ))}
                  </select>
                </div>

                {/* Font Size Selector */}
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Size</span>
                  <select 
                    onChange={e => executeCommand('fontSize', e.target.value)}
                    defaultValue="4"
                    className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer py-0.5"
                  >
                    {FONT_SIZES.map(s => (
                      <option key={s.name} value={s.value}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Vertical Divider */}
                <div className="h-6 w-px bg-slate-200 mx-1"></div>

                {/* Style Group */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
                  {[
                    { icon: <Bold size={14} />, cmd: 'bold', title: 'Bold' },
                    { icon: <Italic size={14} />, cmd: 'italic', title: 'Italic' },
                    { icon: <Underline size={14} />, cmd: 'underline', title: 'Underline' }
                  ].map(btn => (
                    <button 
                      key={btn.cmd}
                      onClick={() => executeCommand(btn.cmd)}
                      className="p-1.5 hover:bg-slate-50 text-slate-600 hover:text-violet-600 rounded-lg transition-all cursor-pointer"
                      title={btn.title}
                    >
                      {btn.icon}
                    </button>
                  ))}
                </div>

                {/* Text Color Picker */}
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
                  <Palette size={13} className="text-slate-400" />
                  <input 
                    type="color" 
                    value={textColor}
                    onChange={e => {
                      setTextColor(e.target.value);
                      executeCommand('foreColor', e.target.value);
                    }}
                    className="w-5 h-5 border border-slate-200 rounded cursor-pointer p-0 bg-transparent"
                    title="Text Color"
                  />
                </div>

                {/* Upload Image / Logo option */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
                  <button 
                    onClick={() => imageInputRef.current?.click()}
                    type="button"
                    className="p-1.5 hover:bg-slate-50 text-slate-600 hover:text-violet-600 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                    title="Upload & Insert Company Logo / Image"
                  >
                    <Image size={14} className="text-violet-600" />
                    <span className="text-[10px] font-bold text-slate-500 pr-0.5">Upload Logo</span>
                  </button>
                  <input 
                    type="file"
                    ref={imageInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                {/* Vertical Divider */}
                <div className="h-6 w-px bg-slate-200 mx-1"></div>

                {/* Align Group */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
                  {[
                    { icon: <AlignLeft size={14} />, cmd: 'justifyLeft', title: 'Align Left' },
                    { icon: <AlignCenter size={14} />, cmd: 'justifyCenter', title: 'Align Center' },
                    { icon: <AlignRight size={14} />, cmd: 'justifyRight', title: 'Align Right' },
                    { icon: <AlignJustify size={14} />, cmd: 'justifyFull', title: 'Align Justify' }
                  ].map(btn => (
                    <button 
                      key={btn.cmd}
                      onClick={() => executeCommand(btn.cmd)}
                      className="p-1.5 hover:bg-slate-50 text-slate-600 hover:text-violet-600 rounded-lg transition-all cursor-pointer"
                      title={btn.title}
                    >
                      {btn.icon}
                    </button>
                  ))}
                </div>

              </div>

              {/* EDITOR VISUAL VIEWPORT */}
              <div className="p-6 bg-white min-h-[450px]">
                <div 
                  ref={editorRef}
                  contentEditable
                  className="w-full min-h-[400px] outline-none prose prose-slate max-w-none text-slate-800 leading-relaxed font-medium focus:ring-0"
                  style={{ 
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '15px'
                  }}
                  placeholder="Design your email body..."
                />
              </div>

            </div>
          </div>

          {/* PLACEHOLDER / INSTRUCTION COLUMN */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Custom Templates Dropdown Selection */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <FileText className="text-violet-600" size={18} />
                <h2 className="font-black text-sm text-slate-800 uppercase tracking-wider">Select Template</h2>
              </div>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                Choose a template to load it into the editor workspace, or create custom templates.
              </p>
              <select
                value={selectedTemplateId}
                onChange={e => handleSelectTemplate(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none font-bold text-slate-700 text-sm cursor-pointer shadow-sm animate-pulse hover:animate-none"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Dynamic Placeholders Helper */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Sparkles className="text-violet-600 animate-pulse" size={18} />
                <h2 className="font-black text-sm text-slate-800 uppercase tracking-wider">Dynamic Placeholders</h2>
              </div>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                Click any tag below to insert it at the cursor position. The system replaces these tags with candidate data when invitations are sent.
              </p>
              <div className="space-y-2">
                {PLACEHOLDERS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => insertPlaceholder(p.label)}
                    className="w-full text-left p-3 border border-slate-100 hover:border-violet-100 hover:bg-violet-50/50 rounded-2xl transition-all cursor-pointer group flex items-start justify-between"
                  >
                    <div>
                      <span className="font-mono text-xs font-bold text-violet-600 group-hover:text-violet-700 block mb-0.5">{p.label}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{p.desc}</span>
                    </div>
                    <span className="text-[10px] text-violet-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Insert +</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Formatting Guide */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <HelpCircle className="text-blue-500" size={18} />
                <h2 className="font-black text-sm text-slate-800 uppercase tracking-wider">Editor Tips</h2>
              </div>
              <ul className="text-xs text-slate-500 space-y-3 font-medium list-disc list-inside leading-relaxed">
                <li>Double click text inside the editor viewport to format specific sections.</li>
                <li>Highlight content to apply custom font families, colors, sizes, or weight modifications.</li>
                <li>Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-600">Enter</kbd> to start a new paragraph block, and <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-600">Shift + Enter</kbd> to add a single line break.</li>
                <li>Always ensure the <strong className="text-violet-600 font-mono">[FORM_LINK]</strong> tag is present so candidates can open their upload form.</li>
              </ul>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default EditEmailTemplate;
