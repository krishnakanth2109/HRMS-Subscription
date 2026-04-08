
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import API from "../api";
import { FaTimes, FaCheckCircle, FaCrown } from "react-icons/fa";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
 :root {
  --text-main: #0f172a;
  --text-muted: #64748b;

  --brand-blue: #2563eb;
  --brand-cyan: #00d4ff;
  --brand-pink: #ec4899;
  --brand-dark: #050505;

  --font-head: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;

  /* Typography scale */
  --h1-size: clamp(44px, 5vw, 64px);
  --h2-size: clamp(32px, 3vw, 40px);
  --h3-size: 24px;

  --body-lg: 18px;
  --body-md: 16px;
  --body-sm: 14px;
}
  
  body { 
    background: #ffffff; 
    color: var(--text-main); 
    font-family: var(--font-body); 
    overflow-x: hidden; 
     -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  }
  
  .root { 
    min-height: 100vh; 
    overflow-x: hidden; 
  }

  /* Container & Grid Utilities */
  .container { max-width: 1200px; margin: 0 auto; padding: 0 5%; }
  .row { display: flex; gap: 40px; flex-wrap: wrap; }
  .row.align-center { align-items: center; }
  .col { flex: 1; min-width: 300px; }
  .img-fluid { width: 100%; height: auto; display: block; border-radius: 12px; }

  /* =========================================
     NAVBAR
     ========================================= */
  .nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 5%; position: absolute; top: 0; left: 0; right: 0; z-index: 300;
  }
  .nav-logo { 
    font-family: var(--font-head); font-size: 24px; font-weight: 800; 
    letter-spacing: 1px; display: flex; align-items: center; 
  }
  .nav-links { display: flex; gap: 40px; margin: 0 auto; }
  .nav-links a { color: var(--text-main);   font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.3px; text-decoration: none; transition: opacity .2s; }
  .nav-links a:hover { opacity: 0.7; }
  
  .nav-right { display: flex; align-items: center; gap: 20px; }
  .theme-toggle { background: transparent; border: none; font-size: 20px; cursor: pointer; }
  .btn-nav-demo {
    background: var(--brand-blue); color: #fff; border: none; border-radius: 8px;
    padding: 10px 24px; font-size: 14px; font-weight: 600; cursor: pointer;
    font-family: var(--font-body); transition: opacity .2s;
  }
  .btn-nav-demo:hover { opacity: .9; }

  /* =========================================
     HERO SECTION
     ========================================= */
  .hero-wrap {
    position: relative;
    padding: 160px 5% 120px;
    background: url('/light mode background.jpg.jpeg') no-repeat top center / cover;
    text-align: center;
  }
  .hero h1 {
     font-family: var(--font-head);
  font-size: var(--h1-size);
  font-weight: 700;
  letter-spacing: -1px;
    line-height: 1.1; margin-bottom: 24px; color: var(--text-main);
  }
  .hero h1 .highlight { color: var(--brand-blue); }
  
  .hero p.sub {
    color: var(--text-muted); font-size: 16px; font-weight: 500; line-height: 1.6;
    max-width: 650px; margin: 0 auto 30px;
  }
  
  .hero-quote {
    color: var(--text-main); font-size: 18px; font-weight: 700; margin-bottom: 40px;
    display: flex; align-items: center; justify-content: center; gap: 8px; flex-direction: column;
  }
  .quote-top { display: flex; align-items: center; gap: 8px; }
  .quote-top::before { content: '"'; color: var(--brand-blue); font-size: 24px; line-height: 1; }
  .quote-top::after { content: '"'; color: var(--brand-blue); font-size: 24px; line-height: 1; }
  .quote-sub { font-size: 16px; font-weight: 600; color: var(--text-main); display:flex; align-items:center; gap:8px;}
  .quote-sub::before, .quote-sub::after { content: '●'; font-size: 10px; color: var(--brand-cyan); }
  
  .hero-btns { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
  .btn-primary {
    background: var(--brand-blue); color: #fff; border: none; border-radius: 8px; 
    padding: 14px 32px; font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity .2s;
  }
  .btn-outline-pink {
    background: transparent; color: var(--brand-pink); border: 1px solid rgba(249, 49, 129, 0.4); 
    border-radius: 8px; padding: 14px 32px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background .2s;
  }
  .btn-primary:hover, .btn-outline-pink:hover { opacity: 0.8; }

  /* =========================================
     DARK SECTIONS WRAPPER
     ========================================= */
  .dark-wrapper {
    background: url('/c1-background image.png') no-repeat center/cover, #050505;
    padding: 80px 0 100px;
  }
  
  /* Cards inside dark background */
  .content-card-white {
    background: #ffffff;
    border-radius: 24px;
    padding: 40px;
    margin-bottom: 60px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
  }
  .content-card-dark {
    background: #0b1120;
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 24px;
    padding: 40px;
    color: #ffffff;
  }
  
  /* Card Typography & Lists */
  .card-content h2 {
    font-family: var(--font-head);
    font-family: var(--font-head);
  font-size: var(--h2-size);
  font-weight: 700;
  letter-spacing: -0.5px;  margin-bottom: 16px; color: inherit;
  }
  .card-content p { font-size: var(--body-md);
  line-height: 1.75;
  color: var(--text-muted); line-height: 1.7; margin-bottom: 30px; color: var(--text-muted); }
  .content-card-dark p { color: #94a3b8; }
  
  .feature-list { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; list-style: none; margin-bottom: 30px; }
  .feature-list li { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 10px; color: inherit; }
  .feature-list li::before { content: '●'; color: var(--brand-blue); font-size: 12px; }
  
  .styled-quote { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
  .styled-quote::before { content: '"'; color: var(--brand-cyan); font-size: 24px; line-height: 1; }
  .styled-quote::after { content: '"'; color: var(--brand-cyan); font-size: 24px; line-height: 1; }

  /* Chart full width image */
  .full-width-chart { max-width: 100%; height: auto; border-radius: 20px; margin-bottom: 60px; display: block; }

  /* Secure Access Banner */
  .secure-banner {
    border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 40px;
    display: flex; align-items: center; justify-content: space-between; gap: 40px;
    margin-bottom: 60px; background: rgba(0, 0, 0, 0.4); flex-wrap: wrap; color: #fff;
  }
  .secure-banner h2 { font-family: var(--font-head); font-size: 32px; font-weight: 800; line-height: 1.2; margin-bottom: 16px; }
  .warn-badge {
    display: inline-flex; align-items: center; gap: 8px; background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 8px;
  }
  .secure-banner p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 16px; max-width: 400px; }

  /* =========================================
     MOBILE ACCESS SECTION
     ========================================= */
  .mobile-section {
    background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #06b6d4 100%);
    padding: 100px 0; color: #fff; overflow: hidden;
  }
  .mobile-text h2 { font-family: var(--font-head); font-size: clamp(36px, 4vw, 56px); font-weight: 800; line-height: 1.1; margin-bottom: 24px; }
  .mobile-text h2 .pink { color: var(--brand-pink); display: block; }
  .mobile-text h2 .outline { -webkit-text-stroke: 1px rgba(255, 255, 255, 0.6); color: transparent; display: block; }
  .mobile-text p { color: #cbd5e1; font-size: 16px; line-height: 1.7; margin-bottom: 32px; max-width: 480px; }
  .btn-contact { background: transparent; color: #00e5ff; border: 1px solid #00e5ff; border-radius: 8px; padding: 12px 28px; font-size: 15px; font-weight: 600; cursor: pointer; }
  
  .mobile-img-wrapper { display: flex; justify-content: flex-end; }
  .mobile-img-wrapper img { max-width: 100%; height: auto; object-fit: contain; transform: scale(1.1); }

  /* =========================================
     SMARTER SECTION (Light Background)
     ========================================= */
  .smarter-section {
    background: url('/light mode background.jpg.jpeg') no-repeat center / cover;
    padding: 100px 0;
  }
  .smarter-text h2 { font-family: var(--font-head); font-size: 36px; font-weight: 800; color: var(--text-main); line-height: 1.2; margin-bottom: 40px; }
  .smarter-text h2 .pink { color: var(--brand-pink); }
  
  .smart-table { display: flex; flex-direction: column; background: rgba(255,255,255,0.6); border-radius: 16px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
  .st-header { display: flex; font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; margin-bottom: 12px;}
  .st-header span { flex: 1; text-align: center; }
  .st-header span:first-child { text-align: left; }
  .st-header span:nth-child(2) { color: var(--brand-blue); }
  
  .st-row { display: flex; align-items: center; padding: 16px 0; border-bottom: 1px solid #e2e8f0; }
  .st-row:last-child { border-bottom: none; }
  .st-col { flex: 1; font-size: 15px; text-align: center; }
  .st-col.icon-lbl { font-weight: 600; color: var(--text-muted); display: flex; align-items: center; gap: 12px; text-align: left; }
  .st-col.bold { font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px; justify-content: center; }
  .st-col.muted { color: var(--text-muted); display: flex; align-items: center; gap: 8px; justify-content: center; }
  
  .st-row .check { color: #10b981; font-weight: 800; }
  .st-row .cross { color: #ef4444; font-weight: 800; }
  .st-row .warn { color: #f59e0b; font-weight: 800; }

  /* =========================================
     PRICING SECTION
     ========================================= */
  .pricing-section {
    background: #f8faff;
    padding: 100px 0;
  }
  .pricing-section .section-title {
    font-family: var(--font-head); font-size: clamp(32px, 4vw, 44px); font-weight: 800;
    color: var(--text-main); text-align: center; margin-bottom: 12px;
  }
  .pricing-section .section-title .highlight { color: var(--brand-blue); }
  .pricing-section .section-sub {
    text-align: center; color: var(--text-muted); font-size: 16px; margin-bottom: 60px;
  }
  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 28px;
    max-width: 1000px;
    margin: 0 auto;
  }
  .pricing-card {
    background: #ffffff;
    border: 2px solid #e2e8f0;
    border-radius: 20px;
    padding: 36px 32px;
    display: flex;
    flex-direction: column;
    transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  }
  .pricing-card:hover {
    border-color: var(--brand-blue);
    box-shadow: 0 12px 40px rgba(37,99,235,0.12);
    transform: translateY(-4px);
  }
  .pricing-card .plan-name {
    font-family: var(--font-head);  font-family: var(--font-head);
  font-size: 24px;
  font-weight: 700;
    color: var(--text-main); text-transform: capitalize; margin-bottom: 4px;
  }
  .pricing-card .plan-duration {
    font-size: 12px; font-weight: 700; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 1px; margin-bottom: 24px;
  }
  .pricing-card .plan-price {
    font-family: var(--font-head); font-size: 42px; font-weight: 800;
    color: var(--text-main); margin-bottom: 4px; line-height: 1;
  }
  .pricing-card .plan-price-sub {
    font-size: 13px; color: var(--text-muted); font-weight: 600; margin-bottom: 28px;
  }
  .pricing-card .plan-features {
    list-style: none; flex: 1; margin-bottom: 32px;
  }
  .pricing-card .plan-features li {
    display: flex; align-items: center; gap: 10px;
    font-size: 14px; color: var(--text-muted); font-weight: 500;
    padding: 6px 0; border-bottom: 1px solid #f1f5f9;
  }
  .pricing-card .plan-features li:last-child { border-bottom: none; }
  .pricing-card .plan-features li::before {
    content: '✓'; color: var(--brand-blue); font-weight: 800; font-size: 14px; flex-shrink: 0;
  }
  .btn-plan {
    width: 100%; padding: 14px; border-radius: 10px; font-size: 14px; font-weight: 700;
    cursor: pointer; border: 2px solid var(--brand-blue); background: transparent;
    color: var(--brand-blue); transition: all 0.2s; font-family: var(--font-body);
    text-transform: uppercase; letter-spacing: 1px;
  }
  .btn-plan:hover { background: var(--brand-blue); color: #fff; }
  .pricing-loading {
    display: flex; justify-content: center; align-items: center; height: 160px;
  }
  .pricing-spinner {
    width: 40px; height: 40px; border: 3px solid #e2e8f0;
    border-top-color: var(--brand-blue); border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* =========================================
     REGISTER MODAL
     ========================================= */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .modal-box {
    background: #ffffff; border-radius: 24px; width: 100%; max-width: 760px;
    max-height: 92vh; overflow-y: auto;
    box-shadow: 0 30px 80px rgba(0,0,0,0.25);
    animation: modalIn 0.3s ease-out forwards;
  }
  @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .modal-header {
    background: linear-gradient(135deg, #eff6ff 0%, #ecfeff 100%);
    border-bottom: 1px solid #e2e8f0; padding: 28px 32px 20px; position: relative;
  }
  .modal-header h2 { font-family: var(--font-head); font-size: 24px; font-weight: 800; color: var(--text-main); margin-bottom: 4px; }
  .modal-header p { font-size: 14px; color: var(--text-muted); }
  .modal-badge { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .modal-badge-dot { width: 28px; height: 28px; background: var(--brand-blue); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; }
  .modal-badge-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: var(--brand-blue); }
  .modal-close {
    position: absolute; top: 20px; right: 20px; width: 34px; height: 34px;
    background: #f1f5f9; border: none; border-radius: 50%; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: var(--text-muted); font-size: 14px; transition: background 0.2s;
  }
  .modal-close:hover { background: #e2e8f0; }
  .modal-body { padding: 28px 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  @media(max-width: 640px) { .modal-body { grid-template-columns: 1fr; } }
  
  .modal-alert { padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
  .modal-alert.error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
  .modal-alert.success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .modal-alert.success button { margin-left: auto; background: none; border: none; color: #16a34a; font-weight: 700; cursor: pointer; text-decoration: underline; }

  /* Plan selector */
  .plan-selector-label { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #d97706; margin-bottom: 14px; }
  .plan-btn {
    width: 100%; text-align: left; padding: 14px 16px; border-radius: 14px;
    border: 2px solid #e2e8f0; background: #fff; cursor: pointer;
    margin-bottom: 10px; transition: all 0.2s; font-family: var(--font-body);
  }
  .plan-btn:hover { border-color: var(--brand-blue); background: #eff6ff; }
  .plan-btn.selected { border-color: var(--brand-blue); background: #eff6ff; }
  .plan-btn-top { display: flex; align-items: center; justify-content: space-between; }
  .plan-btn-name { font-size: 15px; font-weight: 700; color: var(--text-main); text-transform: capitalize; display: flex; align-items: center; gap: 6px; }
  .plan-btn-price { font-size: 18px; font-weight: 800; color: var(--brand-blue); }
  .plan-btn-duration { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
  .plan-btn-features { margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0; }
  .plan-btn-feat-item { font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; }
  .plan-btn-feat-item::before { content: '✓'; color: var(--brand-blue); font-weight: 800; }

  /* Registration form */
  .form-label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: 6px; margin-left: 2px; }
  .form-input {
    width: 100%; padding: 12px 16px; border-radius: 10px;
    border: 1.5px solid #e2e8f0; background: #fff; font-size: 14px;
    color: var(--text-main); outline: none; font-family: var(--font-body);
    transition: border-color 0.2s;
  }
  .form-input:focus { border-color: var(--brand-blue); background: #eff6ff; }
  .form-group { margin-bottom: 14px; position: relative; }
  .pw-toggle { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; }
  .selected-plan-summary { background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .selected-plan-summary .sps-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--brand-blue); }
  .selected-plan-summary .sps-name { font-size: 15px; font-weight: 700; color: var(--text-main); text-transform: capitalize; }
  .selected-plan-summary .sps-price { font-size: 20px; font-weight: 800; color: var(--brand-blue); }
  .btn-submit {
    width: 100%; padding: 14px; border-radius: 12px; border: none;
    background: linear-gradient(135deg, var(--brand-blue) 0%, #0891b2 100%);
    color: #fff; font-size: 13px; font-weight: 800; text-transform: uppercase;
    letter-spacing: 1.5px; cursor: pointer; font-family: var(--font-body);
    transition: opacity 0.2s; box-shadow: 0 4px 20px rgba(37,99,235,0.3);
    margin-top: 6px;
  }
  .btn-submit:hover { opacity: 0.9; }
  .btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }
  .form-footer-note { text-align: center; font-size: 11px; color: var(--text-muted); margin-top: 10px; text-transform: uppercase; letter-spacing: 1px; }
  .form-signin-link { text-align: center; font-size: 13px; color: var(--text-muted); margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  .form-signin-link button { background: none; border: none; color: var(--brand-blue); font-weight: 700; cursor: pointer; font-size: 13px; }

  /* =========================================
     STATS SECTION
     ========================================= */
  .stats-section { background: #faf5ff; padding: 60px 0; border-top: 1px solid #f3e8ff;}
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; text-align: center; }
  .stat-item .num { font-family: var(--font-head);   font-family: var(--font-head);
  font-size: 56px;
  font-weight: 700; color: var(--text-main); }
  .stat-item .lbl { font-size: 13px; font-weight: 600; color: var(--text-muted); letter-spacing: 1px; margin-top: 8px; text-transform: uppercase; }

  /* =========================================
     CTA SECTION
     ========================================= */
  .cta-section { background: #1e3a8a; padding: 100px 0; text-align: center; color: #fff; }
  .cta-section h2 { font-family: var(--font-head); font-size:   font-family: var(--font-head);
  font-size: var(--h2-size);
  font-weight: 700;
  letter-spacing: -0.5px; margin-bottom: 16px; }
  .cta-section h2 .highlight { color: var(--brand-pink); }
  .cta-section p { color: #cbd5e1; font-size: 16px; margin-bottom: 12px; }
  
  .cta-quote { font-size: 15px; font-weight: 600; color: #fff; margin-bottom: 40px; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .cta-quote::before, .cta-quote::after { content: '"'; color: var(--brand-cyan); font-size: 20px; }
  .cta-quote::after { content: '"'; }
  
  .cta-btns { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
  .btn-cta-prim { background: var(--brand-blue); color: #fff; border: none; border-radius: 8px; padding: 14px 32px; font-size: 15px; font-weight: 600; cursor: pointer; }
  .btn-cta-out { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; padding: 14px 32px; font-size: 15px; font-weight: 600; cursor: pointer; }

  /* =========================================
     FOOTER
     ========================================= */
  .footer { background: #000000;
  padding: 120px 0 40px;
  position: relative;
  margin-top: 0; }
  .footer-top { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; transform: translateY(-50%); }
  .support-card { background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
  .sc-title { font-size: 16px; font-weight: 700; color: var(--text-main); margin-bottom: 12px; }
  .sc-text { font-size: 14px; color: var(--text-muted); line-height: 1.6; margin-bottom: 20px; }
  .sc-links { display: flex; justify-content: space-between; font-size: 13px; color: var(--brand-blue); font-weight: 600; cursor: pointer; }
  
  .footer-mid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; padding-bottom: 40px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-top: -30px; }
  .footer-brand .logo { font-family: var(--font-head); font-size: 24px; font-weight: 800; letter-spacing: 1px; color: var(--brand-cyan); margin-bottom: 16px; }
  .footer-brand .logo span { color: var(--brand-pink); }
  .footer-brand p { font-size: 14px; color: #94a3b8; line-height: 1.7; max-width: 300px; margin-bottom: 16px; }
  
  .footer-col h4 { font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 20px; }
  .footer-col a { display: block; color: #94a3b8; font-size: 14px; text-decoration: none; margin-bottom: 12px; transition: color .2s; }
  .footer-col a:hover { color: #ffffff; }
  
  .footer-bottom { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; padding-top: 24px; }
  .footer-bottom p { font-size: 13px; color: #64748b; }
  .footer-right { display: flex; align-items: center; gap: 24px; }
  .social-icon { color: #1a73e8; font-size: 16px; cursor: pointer; transition: color .2s; }
  .social-icon:hover { color: #fff; }
  .thank-you { font-size: 14px; color: #94a3b8; font-weight: 600; display: flex; align-items: center; gap: 8px;}
  .thank-you::before, .thank-you::after { content: '"'; color: var(--brand-cyan); font-size: 18px; }
  .thank-you::after { content: '"'; }

  /* RESPONSIVE */
  @media(max-width: 960px){
    .row { flex-direction: column; }
    .footer-top { grid-template-columns: 1fr; transform: translateY(-20px); }
    .footer-mid { grid-template-columns: 1fr 1fr; margin-top: 0; }
    .stats-grid { grid-template-columns: 1fr 1fr; }
    .nav { flex-wrap: wrap; gap: 20px; justify-content: center; }
    .nav-links { margin: 0; width: 100%; justify-content: center; }
    .secure-banner { flex-direction: column; text-align: center; }
    .st-header span, .st-col { font-size: 13px; }
    .pricing-grid { grid-template-columns: 1fr; max-width: 400px; }
  }
`;

const featureLabels = {
  "/admin/dashboard": "Dashboard",
  "/employees": "Employee Management",
  "/attendance": "Employees Attendance",
  "/admin/settings": "Shift Management",
  "/admin/shifttype": "Location Settings",
  "/admin/leave-summary": "Leave Summary",
  "/admin/holiday-calendar": "Holiday Calendar",
  "/admin/payroll": "Payroll",
  "/admin/notices": "Announcements",
  "/admin/admin-Leavemanage": "Leave Requests",
  "/admin/late-requests": "Attendance Adjustment",
  "/admin/admin-overtime": "Overtime Requests",
  "/admin/live-tracking": "Employee Idle Tracking",
};

export default function HRMSLandingPage() {
  const navigate = useNavigate();

  // --- PLANS STATE ---
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // --- MODAL STATE ---
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState("");
  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "admin",
    department: "",
  });

  // --- FETCH PLANS ---
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await api.get("/api/admin/all-plans");
        const filtered = response.data.filter(
          (plan) => plan.planName?.toLowerCase() !== "owner"
        );
        setPlans(filtered);
      } catch (error) {
        console.error("Error fetching plans:", error);
      } finally {
        setPlansLoading(false);
      }
    };
    fetchPlans();
  }, []);

  // --- OPEN MODAL ---
  const handlePlanClick = (plan) => {
    setSelectedPlan(plan);
    setSignupError("");
    setSignupSuccess("");
    setSignupForm({ name: "", email: "", password: "", phone: "", role: "admin", department: "" });
    setShowRegisterModal(true);
  };

  // --- CLOSE MODAL ---
  const handleCloseModal = () => {
    setShowRegisterModal(false);
    setSelectedPlan(null);
    setSignupError("");
    setSignupSuccess("");
  };

  // --- REGISTER HANDLER ---
  const handleAdminRegister = async (e) => {
    e.preventDefault();
    setSignupError("");
    setSignupSuccess("");
    if (!selectedPlan) return setSignupError("Please select a plan");
    setSignupLoading(true);

    try {
      if (Number(selectedPlan.price) === 0) {
        await API.post("/api/admin/register", {
          ...signupForm,
          plan: selectedPlan.planName,
        });
        setSignupSuccess(`🎉 ${selectedPlan.planName} account created! Please login.`);
        setSignupForm({ name: "", email: "", password: "", phone: "", role: "admin", department: "" });
        return;
      }

      // Paid plan → Stripe redirect
      sessionStorage.setItem("hrms_payment_pending", "true");
      const res = await API.post("/api/stripe/create-checkout-session", {
        plan: selectedPlan,
        signupForm,
      });
      window.location.href = res.data.url;

    } catch (err) {
      sessionStorage.removeItem("hrms_payment_pending");
      setSignupError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="root">
        
        {/* Navigation */}
        <nav className="nav">
          <div className="nav-logo">
            <span style={{color: 'var(--brand-blue)'}}>V</span>
            <span style={{color: 'var(--brand-pink)'}}>—</span>
            <span style={{color: '#000'}}>SYNC</span>
          </div>
          <div className="nav-links">
            <a href="#" style={{color: 'var(--brand-blue)'}}>Feature</a>
            <a href="#pricing">Pricing</a>
            <a href="#">Support</a>
          </div>
          <div className="nav-right">
             <button className="btn-nav-demo" onClick={() => navigate("/login")}>Get Started</button>
          </div>
        </nav>

        {/* Hero Section (Light Gradient Background) */}
        <section className="hero-wrap">
          <div className="container">
            <div className="hero">
              <h1><span className="highlight">Effortless HR,</span><br/>better team management</h1>
              <p className="sub">
                VWSync simplifies workforce, payroll, and performance management in one place.<br/>
                Transforming HR into a seamless digital experience for modern teams.
              </p>
              <div className="hero-quote">
                <div className="quote-top">Welcome to "VW-sync"</div>
                <div className="quote-sub">One HR platform Designed for every business</div>
              </div>
 <div className="hero-btns">
  <button 
    className="btn-primary" 
    onClick={() => document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' })}
  >
    Sign Up to Explore FREE Trial
  </button>

  <button 
    className="btn-outline-pink" 
    onClick={() => navigate("/request-demo")}
  >
    Request Free Demo
  </button>
</div>
            </div>
          </div>
        </section>

        {/* Dark wrapper with dark gradient background */}
        <div className="dark-wrapper">
          <div className="container">
            
            {/* Card 1: Employee Management */}
            <div className="content-card-white row align-center">
              <div className="col">
                <img src="/c1- image.png" className="img-fluid" alt="Employee Management Dashboard" />
              </div>
              <div className="col card-content">
                <h2>Employee Management</h2>
                <p>
                  Easily manage employee profiles, roles, and your organizational
                  structure in one place. Keeping everything clear and up to date.
                  From onboarding new hires to maintaining employee records,
                  access all information quickly and reduce manual work.
                </p>
                <ul className="feature-list">
                  <li>Employee profiles</li>
                  <li>Roles & structure</li>
                  <li>Easy data access</li>
                  <li>Organized records</li>
                </ul>
                <div className="styled-quote">Designed to support your growing team</div>
              </div>
            </div>

            {/* Full width Chart Image */}
            <img src="/c2-1image.png" className="full-width-chart" alt="Monthly and Yearly Overview Charts" />

            {/* Card 3: Attendance Management */}
            <div className="content-card-white row align-center">
              <div className="col card-content">
                <h2>Attendance Management</h2>
                <p>
                  Track employee attendance in real time with seamless biometric
                  integration, keeping records accurate and up to date. From daily
                  check-ins to attendance history, manage everything in one place
                  and reduce manual effort.
                </p>
                <ul className="feature-list">
                  <li>Biometric integration</li>
                  <li>Real-time tracking</li>
                  <li>Accurate records</li>
                  <li>Easy monitoring</li>
                </ul>
                <div className="styled-quote">Ensuring accurate and consistent tracking</div>
              </div>
              <div className="col">
                <img src="/c2-2imag.png" className="img-fluid" alt="Attendance Dashboard" />
              </div>
            </div>

            {/* Card 4: Secure Access */}
            <div className="secure-banner">
              <div style={{flex: 1}}>
                <h2>Secure access,<br/>better control</h2>
                <div className="warn-badge">⚠️ Unauthorized action detected</div>
              </div>
              <div style={{textAlign: 'center', padding: '0 20px'}}>
                <img src="/Security symbol.jpg.jpeg" alt="Security Shield" style={{maxWidth: '120px', borderRadius: '12px'}} />
              </div>
              <div style={{flex: 1}}>
                <p>
                  Manage role-based permissions to ensure the right people have
                  access to the right information at the right time. Control user
                  access easily, protect sensitive data, and maintain proper
                  authorization across your system.
                </p>
                <div className="styled-quote">Ensures reliable and secure access control</div>
              </div>
            </div>

            {/* Card 5: Payroll Management */}
            <div className="content-card-white row align-center" style={{background: '#f8fafc'}}>
              <div className="col">
                <img src="/c3 image.png" className="img-fluid" alt="Payroll Graphic" />
              </div>
              <div className="col card-content">
                <h2>Payroll Management</h2>
                <p>
                  Automate salary calculations with built-in tax compliance,
                  ensuring timely and error-free payroll every cycle. Manage payslips,
                  deductions, and reports easily, all in one place without manual effort.
                </p>
                <ul className="feature-list">
                  <li>Salary calculations</li>
                  <li>Tax compliance</li>
                  <li>Payslip records</li>
                  <li>Organized reports</li>
                </ul>
                <div className="styled-quote">Accurate payroll with built-in compliance</div>
              </div>
            </div>

            {/* Card 6: Performance & Database */}
            <div className="row">
              <div className="col content-card-dark card-content">
                <h2>Performance Management</h2>
                <p>
                  Track goals, conduct reviews, and monitor employee performance
                  with a clear and structured approach. Use analytics dashboards
                  to gain insights, measure progress, and support continuous improvement.
                </p>
                <ul className="feature-list" style={{color: '#fff'}}>
                  <li>Goal tracking</li>
                  <li>Performance reviews</li>
                  <li>Analytics dashboard</li>
                  <li>Growth insights</li>
                </ul>
                <div className="styled-quote" style={{color: '#fff'}}>Built to support performance and growth</div>
              </div>
              
              <div className="col content-card-dark card-content">
                <h2>Database Management</h2>
                <p>
                  Store and manage employee data securely with real-time
                  synchronization and automatic backups. Keep information safe,
                  up to date, and easily accessible whenever needed.
                </p>
                <ul className="feature-list" style={{color: '#fff'}}>
                  <li>Secure data storage</li>
                  <li>Real-time sync</li>
                  <li>Automatic backups</li>
                  <li>Easy data access</li>
                </ul>
                <div className="styled-quote" style={{color: '#fff'}}>Built for secure and reliable data management</div>
              </div>
            </div>

          </div>
        </div>

        {/* Mobile Access Section */}
        <section className="mobile-section">
          <div className="container row align-center">
            <div className="col mobile-text">
              <h2>
                Smart mobile access<br/>
                <span className="pink">Anytime</span>
                <span className="outline">Anywhere</span>
              </h2>
              <p>
                Access and manage your HR tasks seamlessly from your mobile device—
                whether it's checking attendance, approving requests, or viewing
                employee details. Stay connected with real-time updates and keep
                everything running smoothly, even when you're away from your desk.
              </p>
              <button className="btn-contact">Contact our expert for more information</button>
            </div>
            <div className="col mobile-img-wrapper">
              <img src="/mobile mocup.png" alt="Mobile HRMS App Preview" />
            </div>
          </div>
        </section>

        {/* Smarter Section (Light Gradient Background) */}
        <section className="smarter-section">
          <div className="container row align-center">
            <div className="col smarter-text">
              <h2>WHY Our HRMS makes <span className="pink">SMARTER</span> than other HRMS</h2>
              
              <div className="smart-table">
                <div className="st-header">
                  <span>Feature</span>
                  <span>VW-Sync</span>
                  <span>Others</span>
                </div>
                <div className="st-row">
                  <div className="st-col icon-lbl">⚡ Speed</div>
                  <div className="st-col bold">Fast loading <span className="check">✓</span></div>
                  <div className="st-col muted">Heavy systems <span className="warn">⚠️</span></div>
                </div>
                <div className="st-row">
                  <div className="st-col icon-lbl">📍 Geo-tagging</div>
                  <div className="st-col bold">Built-in <span className="check">✓</span></div>
                  <div className="st-col muted">Limited / paid <span className="cross">✗</span></div>
                </div>
                <div className="st-row">
                  <div className="st-col icon-lbl">💰 Cost</div>
                  <div className="st-col bold">Easy <span className="check">✓</span></div>
                  <div className="st-col muted">Expensive <span className="cross">✗</span></div>
                </div>
                <div className="st-row">
                  <div className="st-col icon-lbl">✨ UI Simplicity</div>
                  <div className="st-col bold">simple & clean <span className="check">✓</span></div>
                  <div className="st-col muted">Complex dashboards <span className="cross">✗</span></div>
                </div>
              </div>

            </div>
            <div className="col" style={{display:'flex', justifyContent:'center'}}>
              <img src="/c5 image.png" className="img-fluid" alt="Secure Portal Login Form" style={{maxWidth: '450px'}} />
            </div>
          </div>
        </section>

        {/* =========================================
            PRICING SECTION (Dynamic from DB)
            ========================================= */}
        <section id="pricing" className="pricing-section">
          <div className="container">
            <h2 className="section-title">
              Simple, <span className="highlight">Transparent Pricing</span>
            </h2>
            <p className="section-sub">Plans tailored for your growth. No hidden fees.</p>

            {plansLoading ? (
              <div className="pricing-loading">
                <div className="pricing-spinner"></div>
              </div>
            ) : (
              <div className="pricing-grid">
                {plans.map((plan, index) => (
                  <div key={plan._id || index} className="pricing-card">
                    <div className="plan-name">{plan.planName}</div>
                    <div className="plan-duration">Valid for {plan.durationDays} days</div>
                    <div className="plan-price">
                      {Number(plan.price) === 0 ? "Free" : `₹${plan.price}`}
                    </div>
                    {Number(plan.price) > 0 && (
                      <div className="plan-price-sub">/period</div>
                    )}
                    <ul className="plan-features">
                      {plan.features && plan.features.length > 0 ? (
                        plan.features.map((feature, fIdx) => (
                          <li key={fIdx}>{featureLabels[feature] || feature}</li>
                        ))
                      ) : (
                        <>
                          <li>Core Access</li>
                          <li>Secure Login</li>
                        </>
                      )}
                    </ul>
                    <button className="btn-plan" onClick={() => handlePlanClick(plan)}>
                      {Number(plan.price) === 0 ? "Get Started Free" : "Subscribe Now →"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Stats Section */}
        <section className="stats-section">
          <div className="container stats-grid">
            <div className="stat-item">
              <div className="num">10k +</div>
              <div className="lbl">ACTIVE USERS</div>
            </div>
            <div className="stat-item">
              <div className="num">50 +</div>
              <div className="lbl">COUNTRIES</div>
            </div>
            <div className="stat-item">
              <div className="num">99.9%</div>
              <div className="lbl">UPTIME SLA</div>
            </div>
            <div className="stat-item">
              <div className="num">24/7</div>
              <div className="lbl">SUPPORT</div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <div className="container">
            <h2>All your HR, <span className="highlight">one simple</span> platform</h2>
            <p>Bringing everything together to help you manage, support, and grow your people with ease.</p>
            <div className="cta-quote">We're here to help you</div>
            <div className="cta-btns">
              <button className="btn-cta-prim" onClick={() => document.getElementById('pricing').scrollIntoView({behavior:'smooth'})}>Explore Pricing</button>
              <button className="btn-cta-out">Contact Us</button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="footer">
          <div className="container">
            
            <div className="footer-top">
              <div className="support-card">
                <div className="sc-title">WhatsApp Support</div>
                <div className="sc-text">Get instant answers from our support team, available 24/7.</div>
                <div className="sc-links">
                  <span>Send WhatsApp message</span>
                  <a href="https://wa.me/918919801095?text=Hi%2C%20I%E2%80%99d%20like%20more%20information%20about%20your%20HRMS%20product.%20Please%20share%20the%20details." target="_blank" rel="noopener noreferrer">Start Chat →</a>
                </div>
              </div>
              <div className="support-card">
                <div className="sc-title">Phone Support</div>
                <div className="sc-text">Speak directly with our support specialists for urgent issues.</div>
                <div className="sc-links">
                  <span>8919801095</span>
                  <a href="tel:8919801095">Call Now →</a>
                </div>
              </div>
              <div className="support-card">
                <div className="sc-title">Email Support</div>
                <div className="sc-text">Send us your queries and get detailed responses within hours.</div>
                <div className="sc-links">
                  <span>ops@arahinfotech.net</span>
                  <a href="https://mail.google.com/mail/?view=cm&fs=1&to=ops@arahinfotech.net&su=HRMS%20Enquiry&body=Hi%2C%20I%E2%80%99d%20like%20more%20information%20about%20your%20HRMS%20product.%20Please%20share%20the%20details." target="_blank" rel="noopener noreferrer">Send mail →</a>
                </div>
              </div>
            </div>

            <div className="footer-mid">
              <div className="footer-brand">
                <div className="logo">V—<span>SYNC</span></div>
                <p>
                  Transforming human resource management into seamless digital experiences.
                  Trusted by over 10,000+ companies worldwide.
                </p>
                <a href="mailto:ops@arahinfotech.net" style={{color: 'var(--brand-blue)', fontSize:'14px', textDecoration:'none'}}>ops@arahinfotech.net</a>
              </div>
              
              <div className="footer-col">
                <h4>Resources</h4>
                <a href="#">Features</a>
                <a href="#pricing">Pricing</a>
                <a href="#">Support</a>
              </div>
              <div className="footer-col">
                <h4>Company</h4>
                <a href="#">About</a>
                <a href="#">Blog</a>
                <a href="#">Careers</a>
                <a href="#">Partners</a>
              </div>
              <div className="footer-col">
                <h4>Let's Connect</h4>
                <a href="#">Support</a>
                <a href="#">Request Demo</a>
                <a href="#">Connect with expert</a>
              </div>
            </div>

            <div className="footer-bottom">
              <p>© 2026 V-sync. All rights reserved. | Privacy Policy | Terms of Services | Cookie Policy</p>
              <div className="footer-right">
                <div className="thank-you">Thank you for Exploring Our Website</div>
                <div style={{display:'flex', gap:'12px', marginLeft: '20px'}}>
                  <span className="social-icon">f</span>
                  <span className="social-icon">in</span>
                  <span className="social-icon">tw</span>
                  <span className="social-icon">ig</span>
                  <span className="social-icon">yt</span>
                </div>
              </div>
            </div>

          </div>
        </footer>

      </div>

      {/* ==================== REGISTER ADMIN MODAL ==================== */}
      {showRegisterModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
          <div className="modal-box">

            {/* Modal Header */}
            <div className="modal-header">
              <button className="modal-close" onClick={handleCloseModal}>
                <FaTimes size={13} />
              </button>
              <div className="modal-badge">
                <div className="modal-badge-dot">H</div>
                <span className="modal-badge-label">Admin Registration</span>
              </div>
              <h2>Create Your Account</h2>
              <p>Get started with your HRMS subscription today.</p>
            </div>

            <div className="modal-body">

              {/* Alerts */}
              {(signupError || signupSuccess) && (
                <div style={{gridColumn: '1 / -1'}}>
                  {signupError && (
                    <div className="modal-alert error">{signupError}</div>
                  )}
                  {signupSuccess && (
                    <div className="modal-alert success">
                      <FaCheckCircle />
                      <span>{signupSuccess}</span>
                      <button onClick={() => navigate("/login")}>Go to Login →</button>
                    </div>
                  )}
                </div>
              )}

              {/* LEFT: Plan Selector */}
              <div>
                <div className="plan-selector-label">
                  <FaCrown style={{color: '#d97706'}} size={12} />
                  Choose Plan
                </div>
                <div style={{maxHeight: '340px', overflowY: 'auto'}}>
                  {plans.map((plan) => (
                    <button
                      key={plan._id}
                      type="button"
                      onClick={() => setSelectedPlan(plan)}
                      className={`plan-btn${selectedPlan?._id === plan._id ? ' selected' : ''}`}
                    >
                      <div className="plan-btn-top">
                        <div className="plan-btn-name">
                          {plan.planName}
                          {selectedPlan?._id === plan._id && <FaCheckCircle size={12} style={{color: 'var(--brand-blue)'}} />}
                        </div>
                        <div className="plan-btn-price">
                          {Number(plan.price) === 0 ? "Free" : `₹${plan.price}`}
                        </div>
                      </div>
                      <div className="plan-btn-duration">{plan.durationDays} days access</div>
                      {plan.features && plan.features.length > 0 && (
                        <div className="plan-btn-features">
                          {plan.features.slice(0, 2).map((f, i) => (
                            <div key={i} className="plan-btn-feat-item">
                              {featureLabels[f] || (f.length > 25 ? f.substring(0, 25) + '...' : f)}
                            </div>
                          ))}
                          {plan.features.length > 2 && (
                            <div className="plan-btn-feat-item">+{plan.features.length - 2} more</div>
                          )}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* RIGHT: Registration Form */}
              <div>
                <div style={{fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-muted)', marginBottom: '14px'}}>
                  Your Details
                </div>

                <form onSubmit={handleAdminRegister}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      placeholder="John Smith"
                      pattern="^[A-Za-z\s]+$"
                      title="Only alphabets and spaces are allowed"
                      className="form-input"
                      value={signupForm.name}
                      onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      placeholder="example@gmail.com"
                      className="form-input"
                      value={signupForm.email}
                      onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 8 characters"
                      pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$"
                      title="Password must be at least 8 characters and include uppercase, lowercase, number and symbol"
                      className="form-input"
                      style={{paddingRight: '44px'}}
                      value={signupForm.password}
                      onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                      required
                    />
                    <button type="button" className="pw-toggle" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M17.94 17.94A10.94 10.94 0 0112 19C7 19 2.73 16.11 1 12a11.05 11.05 0 012.29-3.57" />
                          <path d="M9.9 4.24A10.94 10.94 0 0112 5c5 0 9.27 2.89 11 7a11.05 11.05 0 01-4.23 5.07" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      placeholder="+91 98765 43210"
                      className="form-input"
                      value={signupForm.phone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, "");
                        setSignupForm({ ...signupForm, phone: value });
                      }}
                      pattern="[0-9]{10}"
                      maxLength={10}
                      required
                    />
                  </div>

                  {/* Selected plan summary */}
                  {selectedPlan && (
                    <div className="selected-plan-summary">
                      <div>
                        <div className="sps-label">Selected Plan</div>
                        <div className="sps-name">{selectedPlan.planName}</div>
                      </div>
                      <div className="sps-price">
                        {Number(selectedPlan.price) === 0 ? "Free" : `₹${selectedPlan.price}`}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn-submit"
                    disabled={signupLoading || !selectedPlan || !!signupSuccess}
                  >
                    {signupLoading
                      ? "Processing..."
                      : !selectedPlan
                        ? "← Select a Plan"
                        : Number(selectedPlan.price) === 0
                          ? "Create Free Account"
                          : `Pay ₹${selectedPlan.price} & Activate`}
                  </button>

                  <p className="form-footer-note">
                    {Number(selectedPlan?.price) > 0
                      ? "Secured by Stripe · No free trials"
                      : "No credit card required"}
                  </p>
                </form>

                <div className="form-signin-link">
                  Already have an account?{" "}
                  <button onClick={() => navigate("/login")}>Sign in →</button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}