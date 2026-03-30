import { useState } from "react";
import { submitDemoRequest } from "../api";

const INITIAL = {
  fullName: "", email: "", phone: "",
  companyName: "", preferredDemoTime: "", message: "",
};

// Min datetime = right now (no past selection)
function getMinDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30); // at least 30 min from now
  return now.toISOString().slice(0, 16);  // "YYYY-MM-DDTHH:MM"
}

const VALIDATORS = {
  fullName:          (v) => v.trim().length >= 2,
  email:             (v) => /^\S+@\S+\.\S+$/.test(v.trim()),
  phone:             (v) => /^\+?[\d\s\-().]{7,20}$/.test(v.trim()),
  companyName:       (v) => v.trim().length >= 1,
  preferredDemoTime: (v) => {
    if (!v) return false;
    const d = new Date(v);
    return !isNaN(d.getTime()) && d > new Date();
  },
};
const ERROR_MSGS = {
  fullName:          "Enter your full name (min 2 chars)",
  email:             "Enter a valid email address",
  phone:             "Enter a valid phone number",
  companyName:       "Company name is required",
  preferredDemoTime: "Please pick a future date and time",
};

const style = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  
  .rd-root *, .rd-root *::before, .rd-root *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  .rd-root {
    --white: #ffffff;
    --gray-50: #f9fafb;
    --gray-100: #f3f4f6;
    --gray-200: #e5e7eb;
    --gray-300: #d1d5db;
    --gray-400: #9ca3af;
    --gray-500: #6b7280;
    --gray-600: #4b5563;
    --gray-700: #374151;
    --gray-800: #1f2937;
    --gray-900: #111827;
    --primary: #3b82f6;
    --primary-dark: #2563eb;
    --primary-light: #60a5fa;
    --success: #10b981;
    --error: #ef4444;
    --warning: #f59e0b;
    
    font-family: 'Inter', sans-serif;
    background: var(--gray-50);
    min-height: 100vh;
    display: grid;
    grid-template-columns: 420px 1fr;
    position: relative;
  }
  
  /* LEFT SIDE */
  .rd-left {
    background: var(--white);
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 4px 40px;
    position: relative;
    animation: slideInLeft 0.6s ease-out;
    box-shadow: 2px 0 20px rgba(0, 0, 0, 0.03);

  }
  
  .rd-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 64px;
    animation: fadeInUp 0.6s ease-out 0.1s both;
  }
  
  .rd-logo-box {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    border-radius: 12px;
    display: grid;
    place-items: center;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
  }
  
  .rd-logo-box svg {
    width: 20px;
    height: 20px;
  }
  
  .rd-logo-name {
    font-size: 1.25rem;
    font-weight: 800;
    background: linear-gradient(135deg, var(--gray-800), var(--gray-600));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .rd-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, #eff6ff, #dbeafe);
    border-radius: 50px;
    padding: 6px 16px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--primary-dark);
    margin-bottom: 32px;
    width: fit-content;
    animation: fadeInUp 0.6s ease-out 0.2s both;
  }
  
  .rd-badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--success);
    animation: pulse 2s infinite;
  }
  
  .rd-left h1 {
    font-size: clamp(2rem, 4vw, 2.5rem);
    font-weight: 800;
    line-height: 1.2;
    color: var(--gray-900);
    margin-bottom: 20px;
    animation: fadeInUp 0.6s ease-out 0.3s both;
  }
  
  .rd-left h1 em {
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-style: italic;
  }
  
  .rd-left p {
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--gray-600);
    max-width: 320px;
    margin-bottom: 48px;
    animation: fadeInUp 0.6s ease-out 0.4s both;
  }
  
  .rd-feats {
    display: flex;
    flex-direction: column;
    gap: 20px;
    animation: fadeInUp 0.6s ease-out 0.5s both;
  }
  
  .rd-feat {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 0.875rem;
    color: var(--gray-700);
    transition: transform 0.2s ease;
  }
  
  .rd-feat:hover {
    transform: translateX(4px);
  }
  
  .rd-feat-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--gray-100);
    display: grid;
    place-items: center;
    flex-shrink: 0;
    font-size: 1.1rem;
    transition: all 0.2s ease;
  }
  
  .rd-feat:hover .rd-feat-icon {
    background: var(--primary-light);
    color: white;
    transform: scale(1.05);
  }
  
  /* RIGHT SIDE */
  .rd-right {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 40px;
    background: var(--gray-50);
  }
  
  .rd-card {
    width: 100%;
    max-width: 540px;
    background: var(--white);
    border-radius: 24px;
    padding: 48px;
    box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.02);
    animation: slideInRight 0.6s ease-out;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  
  .rd-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.12);
  }
  
  .rd-card-hd {
    margin-bottom: 32px;
    text-align: center;
  }
  
  .rd-card-hd h2 {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--gray-900);
    margin-bottom: 8px;
  }
  
  .rd-card-hd p {
    font-size: 0.875rem;
    color: var(--gray-500);
  }
  
  .rd-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  
  .rd-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
    animation: fadeInUp 0.5s ease-out both;
  }
  
  .rd-field.full {
    grid-column: 1 / -1;
  }
  
  .rd-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--gray-600);
  }
  
  .rd-req {
    color: var(--error);
  }
  
  .rd-inp-wrap {
    position: relative;
  }
  
  .rd-ic {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--gray-400);
    pointer-events: none;
    display: flex;
    transition: color 0.2s ease;
  }
  
  .rd-ta-ic {
    top: 14px;
    transform: none;
  }
  
  .rd-inp,
  .rd-ta,
  .rd-datetime {
    width: 100%;
    background: var(--white);
    border: 1.5px solid var(--gray-200);
    border-radius: 12px;
    color: var(--gray-900);
    font-family: 'Inter', sans-serif;
    font-size: 0.875rem;
    padding: 12px 14px 12px 42px;
    outline: none;
    transition: all 0.2s ease;
  }
  
  .rd-ta {
    resize: vertical;
    min-height: 88px;
    padding-top: 14px;
    line-height: 1.6;
  }
  
  .rd-inp:focus,
  .rd-ta:focus,
  .rd-datetime:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .rd-inp:hover,
  .rd-ta:hover,
  .rd-datetime:hover {
    border-color: var(--gray-300);
  }
  
  .rd-datetime {
    padding: 12px 14px 12px 42px;
    cursor: pointer;
  }
  
  .rd-datetime::-webkit-calendar-picker-indicator {
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.2s ease;
  }
  
  .rd-datetime::-webkit-calendar-picker-indicator:hover {
    opacity: 1;
  }
  
  .rd-dt-preview {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #ecfdf5;
    border-radius: 50px;
    padding: 4px 12px;
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--success);
    margin-top: 6px;
    animation: slideInUp 0.3s ease-out;
  }
  
  .rd-field.rd-err .rd-inp,
  .rd-field.rd-err .rd-ta,
  .rd-field.rd-err .rd-datetime {
    border-color: var(--error);
  }
  
  .rd-field.rd-err .rd-inp:focus,
  .rd-field.rd-err .rd-ta:focus,
  .rd-field.rd-err .rd-datetime:focus {
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  }
  
  .rd-errmsg {
    font-size: 0.7rem;
    color: var(--error);
    display: none;
    animation: shake 0.3s ease-out;
  }
  
  .rd-field.rd-err .rd-errmsg {
    display: block;
  }
  
  .rd-btn {
    width: 100%;
    padding: 14px;
    margin-top: 8px;
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    border: none;
    border-radius: 12px;
    color: white;
    font-family: 'Inter', sans-serif;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }
  
  .rd-btn::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    transform: translate(-50%, -50%);
    transition: width 0.6s ease, height 0.6s ease;
  }
  
  .rd-btn:hover::before {
    width: 300px;
    height: 300px;
  }
  
  .rd-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
  }
  
  .rd-btn:active {
    transform: translateY(0);
  }
  
  .rd-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  
  .rd-spin {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  
  /* Success State */
  .rd-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 20px;
    animation: scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }
  
  .rd-success-ico {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ecfdf5, #d1fae5);
    display: grid;
    place-items: center;
    font-size: 2.5rem;
    animation: bounceIn 0.6s ease-out;
  }
  
  .rd-success h3 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--gray-900);
  }
  
  .rd-success p {
    font-size: 0.875rem;
    color: var(--gray-600);
    line-height: 1.6;
  }
  
  .rd-success p strong {
    color: var(--gray-800);
    font-weight: 600;
  }
  
  .rd-dt-chip {
    background: var(--gray-100);
    border-radius: 12px;
    padding: 12px 20px;
    font-size: 0.875rem;
    color: var(--primary-dark);
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
  }
  
  .rd-reset {
    margin-top: 8px;
    background: transparent;
    border: 1.5px solid var(--gray-200);
    border-radius: 10px;
    color: var(--gray-600);
    font-family: 'Inter', sans-serif;
    font-size: 0.8125rem;
    padding: 8px 24px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .rd-reset:hover {
    border-color: var(--primary);
    color: var(--primary);
    transform: translateY(-1px);
  }
  
  /* Toast */
  .rd-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--white);
    border-radius: 12px;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 340px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
    z-index: 999;
    transform: translateX(400px);
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    animation: slideInRight 0.4s ease-out;
  }
  
  .rd-toast.show {
    transform: translateX(0);
  }
  
  .rd-toast-ic {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    font-size: 1.125rem;
  }
  
  .rd-toast.ok .rd-toast-ic {
    background: #ecfdf5;
  }
  
  .rd-toast.fail .rd-toast-ic {
    background: #fef2f2;
  }
  
  .rd-toast-body strong {
    display: block;
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--gray-900);
    margin-bottom: 2px;
  }
  
  .rd-toast-body span {
    font-size: 0.75rem;
    color: var(--gray-500);
  }
  
  /* Animations */
  @keyframes slideInLeft {
    from {
      opacity: 0;
      transform: translateX(-40px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(40px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.1);
    }
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  @keyframes bounceIn {
    0% {
      opacity: 0;
      transform: scale(0.3);
    }
    50% {
      opacity: 0.9;
      transform: scale(1.1);
    }
    80% {
      opacity: 1;
      transform: scale(0.95);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  @keyframes shake {
    0%, 100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-4px);
    }
    75% {
      transform: translateX(4px);
    }
  }
  
  /* Responsive */
  @media (max-width: 860px) {
    .rd-root {
      grid-template-columns: 1fr;
    }
    
    .rd-left {
      padding: 40px 32px;
    }
    
    .rd-right {
      padding: 32px 24px;
    }
    
    .rd-card {
      padding: 32px 24px;
    }
  }
  
  @media (max-width: 480px) {
    .rd-row {
      grid-template-columns: 1fr;
    }
    
    .rd-card {
      padding: 24px 20px;
    }
  }
`;

// Format datetime for the success screen
function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    weekday: "short", day: "2-digit", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function RequestDemo() {
  const [form, setForm]       = useState(INITIAL);
  const [errors, setErrors]   = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [toast, setToast]     = useState(null);

  const showToast = (type, title, msg) => {
    setToast({ type, title, msg });
    setTimeout(() => setToast(null), 4500);
  };

  const validate = (name, val) => {
    if (!VALIDATORS[name]) return true;
    const ok = VALIDATORS[name](val);
    setErrors((e) => ({ ...e, [name]: !ok }));
    return ok;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (touched[name]) validate(name, value);
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((t) => ({ ...t, [name]: true }));
    validate(name, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const required = ["fullName", "email", "phone", "companyName", "preferredDemoTime"];
    let valid = true;
    required.forEach((k) => { if (!validate(k, form[k])) valid = false; });
    setTouched(required.reduce((a, k) => ({ ...a, [k]: true }), {}));
    if (!valid) return;

setLoading(true);
    try {
      // 1. Prepare the payload
      const payload = {
        ...form,
        preferredDemoTime: new Date(form.preferredDemoTime).toISOString(),
      };
      
      // 2. Call the API using the function from api.js
      const data = await submitDemoRequest(payload);
      
      // 3. Handle successful response
      if (data.success) {
        setSuccess(true);
        showToast("ok", "Request Submitted!", "We'll confirm your session shortly.");
      } else {
        showToast("fail", "Submission Failed", data.message || "Please try again.");
      }
    } catch (error) {
      // 4. Handle Axios error appropriately
      const errorMsg = error.response?.data?.message || "Could not connect. Please try again.";
      showToast("fail", "Network Error", errorMsg);
    } finally {
      setLoading(false);
    }
};
  const textField = (name, label, type, placeholder, icon, required = true, full = false) => (
    <div className={`rd-field${full ? " full" : ""}${errors[name] && touched[name] ? " rd-err" : ""}`}
         style={{ animationDelay: `${Math.random() * 0.2}s` }}>
      <label className="rd-label">{label} {required && <span className="rd-req">*</span>}</label>
      <div className="rd-inp-wrap">
        {type === "textarea" ? (
          <textarea className="rd-ta" name={name} value={form[name]}
            placeholder={placeholder} onChange={handleChange} onBlur={handleBlur}/>
        ) : (
          <input className="rd-inp" type={type} name={name} value={form[name]}
            placeholder={placeholder} onChange={handleChange} onBlur={handleBlur}/>
        )}
        <span className={`rd-ic${type === "textarea" ? " rd-ta-ic" : ""}`}>{icon}</span>
      </div>
      <span className="rd-errmsg">{ERROR_MSGS[name]}</span>
    </div>
  );

  const Icon = ({ d }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );

  return (
    <>
      <style>{style}</style>
      <div className="rd-root">

        {/* LEFT SIDE - Content */}
        <section className="rd-left">
          <div className="rd-logo">
            <div className="rd-logo-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            </div>
            <span className="rd-logo-name">Welcome to V-Sync Platform</span>
          </div>
          
          <span className="rd-badge">
            <span className="rd-badge-dot"/>
            🚀 Live Demo Sessions
          </span>
          
          <h1>
            Transform your<br/>
            <em>HR Operations</em>
          </h1>
          
          <p>
            Experience the future of workforce management with our intelligent 
            HRMS platform. Get a personalized demo tailored to your business needs.
          </p>
          
          <div className="rd-feats">
            {[
              { icon: "🎯", text: "Tailored to your industry & team size" },
              { icon: "⚡", text: "30-minute interactive walkthrough" },
              { icon: "💬", text: "Live Q&A with HRMS experts" },
              { icon: "🔒", text: "No credit card required" },
            
            ].map((item, idx) => (
              <div className="rd-feat" key={idx} style={{ animationDelay: `${0.5 + idx * 0.05}s` }}>
                <span className="rd-feat-icon">{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT SIDE - Form */}
        <section className="rd-right">
          <div className="rd-card">
            {!success ? (
              <>
                <div className="rd-card-hd">
                  <h2>Request a Demo</h2>
                  <p>Fill in your details to schedule a personalized session</p>
                </div>
                
                <form onSubmit={handleSubmit} noValidate>
                  <div className="rd-row">
                    {textField("fullName", "Full Name", "text", "Enter your full name",
                      <Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>)}
                    
                    {textField("email", "Work Email", "email", "name@company.com",
                      <Icon d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6"/>)}
                  </div>
                  
                  <div className="rd-row">
                    {textField("phone", "Phone Number", "tel", "+1 (555) 000-0000",
                      <Icon d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>)}
                    
                    {textField("companyName", "Company Name", "text", "Your company name",
                      <Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-5v-8H7v8H2a2 2 0 0 1-2-2zM9 22h6"/>)}
                  </div>

                  {/* Date & Time Picker */}
                  <div className={`rd-field full${errors.preferredDemoTime && touched.preferredDemoTime ? " rd-err" : ""}`}>
                    <label className="rd-label">
                      Preferred Demo Time <span className="rd-req">*</span>
                    </label>
                    <div className="rd-inp-wrap">
                      <input
                        className="rd-datetime"
                        type="datetime-local"
                        name="preferredDemoTime"
                        value={form.preferredDemoTime}
                        min={getMinDateTime()}
                        onChange={handleChange}
                        onBlur={handleBlur}
                      />
                      <span className="rd-ic">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                      </span>
                    </div>
                    {form.preferredDemoTime && VALIDATORS.preferredDemoTime(form.preferredDemoTime) && (
                      <span className="rd-dt-preview">
                        ✓ {fmtDateTime(form.preferredDemoTime)}
                      </span>
                    )}
                    <span className="rd-errmsg">{ERROR_MSGS.preferredDemoTime}</span>
                  </div>

                  {textField("message", "Message (Optional)", "textarea", 
                    "Tell us about your team size, current HR challenges, or specific features you're interested in...",
                    <Icon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>, false, true)}

                  <button className="rd-btn" type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="rd-spin"/>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <span>Schedule Your Demo</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="5" y1="12" x2="19" y2="12"/>
                          <polyline points="12 5 19 12 12 19"/>
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="rd-success">
                <div className="rd-success-ico">🎉</div>
                <h3>Demo Request Sent!</h3>
                <p>
                  Thanks <strong>{form.fullName}</strong>! We've received your request and will 
                  confirm your demo slot at <strong>{form.email}</strong>.
                </p>
                <div className="rd-dt-chip">
                  📅 <strong>{fmtDateTime(form.preferredDemoTime)}</strong>
                </div>
                <p style={{ fontSize: "0.75rem" }}>
                  Our team will reach out within 24 hours to confirm or suggest an alternative time.
                </p>
                <button className="rd-reset" onClick={() => { 
                  setForm(INITIAL); 
                  setErrors({}); 
                  setTouched({}); 
                  setSuccess(false); 
                }}>
                  Submit Another Request
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Toast Notification */}
        {toast && (
          <div className={`rd-toast show ${toast.type}`}>
            <div className="rd-toast-ic">{toast.type === "ok" ? "✓" : "⚠"}</div>
            <div className="rd-toast-body">
              <strong>{toast.title}</strong>
              <span>{toast.msg}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}