import { useState } from "react";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg-primary:  #05071a;
    --bg-secondary:#080c22;
    --bg-card:     #0b1028;
    --bg-card2:    #0d1230;
    --cyan:        #00d4ff;
    --cyan-light:  #5ee7ff;
    --magenta:     #ff2d78;
    --green:       #00e696;
    --purple:      #7c3aed;
    --text-primary:#ffffff;
    --text-muted:  #8898b8;
    --border:      rgba(0,212,255,0.12);
    --font-head:   'Syne', sans-serif;
    --font-body:   'DM Sans', sans-serif;
  }
  body { background: var(--bg-primary); color:#fff; font-family: var(--font-body); }
  .root { background: var(--bg-primary); min-height:100vh; overflow-x:hidden; font-family: var(--font-body); }

  /* ══ NAV ══════════════════════════════ */
  .nav {
    display:flex; align-items:center; justify-content:space-between;
    padding:14px 48px;
    background:rgba(5,7,26,0.97);
    border-bottom:1px solid var(--border);
    position:sticky; top:0; z-index:300;
    backdrop-filter:blur(14px);
  }
  .nav-logo { font-family:var(--font-head); font-size:22px; font-weight:800; letter-spacing:2px; color:var(--magenta); }
  .nav-logo span { color:#fff; }
  .nav-links { display:flex; gap:32px; }
  .nav-links a { color:var(--text-muted); font-size:13px; font-weight:500; text-decoration:none; transition:color .2s; }
  .nav-links a.active,
  .nav-links a:hover { color:#fff; }
  .btn-demo {
    background:var(--magenta); color:#fff; border:none; border-radius:6px;
    padding:9px 20px; font-size:13px; font-weight:600; cursor:pointer;
    font-family:var(--font-body); transition:opacity .2s;
  }
  .btn-demo:hover { opacity:.85; }

  /* ══ HERO + EMP OVERLAP WRAPPER ══════ */
  /*
   * Strategy:
   *   1. .hero-wrap  is a normal flow block that provides the gradient bg + extra
   *      bottom padding (pb-hero) so the hero text sits in the upper portion.
   *   2. .emp-overlap-card uses a NEGATIVE top margin to pull itself up
   *      into the hero area, creating the overlap.  z-index keeps it on top.
   *   3. .hero-section-bg extends the hero colour seamlessly behind the card.
   */
  .hero-wrap {
    position: relative;
    /* gradient background that spans hero visually */
    background:
      radial-gradient(ellipse 80% 55% at 50% 0%, rgba(0,170,255,.10) 0%, transparent 68%),
      var(--bg-primary);
    /* enough padding so hero text has room above the overlapping card */
    padding-bottom: 130px;
  }

  .hero {
    text-align:center;
    padding: 80px 24px 48px;
    position:relative; z-index:2;
  }
  .hero h1 {
    font-family:var(--font-head);
    font-size:clamp(34px,5vw,56px); font-weight:800; line-height:1.15;
    background:linear-gradient(135deg,var(--cyan) 0%,#a3f0ff 50%,var(--cyan) 100%);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    background-clip:text; margin-bottom:18px;
  }
  .hero p.sub {
    color:var(--text-muted); font-size:14px; line-height:1.7;
    max-width:520px; margin:0 auto 10px;
  }
  .hero-badge { color:var(--text-muted); font-size:12px; margin-bottom:5px; }
  .hero-badge span { color:var(--cyan); font-weight:600; }
  .hero-tagline {
    color:var(--text-muted); font-size:13px; margin-bottom:32px;
    display:flex; align-items:center; justify-content:center; gap:6px;
  }
  .hero-tagline .dot { color:var(--cyan); }
  .hero-btns { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
  .btn-primary {
    background:linear-gradient(135deg,var(--cyan),#0099cc); color:#fff;
    border:none; border-radius:6px; padding:12px 28px;
    font-size:13px; font-weight:700; cursor:pointer; font-family:var(--font-body);
    box-shadow:0 4px 20px rgba(0,212,255,.35); transition:transform .2s,box-shadow .2s;
  }
  .btn-primary:hover { transform:translateY(-1px); box-shadow:0 6px 28px rgba(0,212,255,.5); }
  .btn-outline {
    background:transparent; color:var(--cyan-light);
    border:1.5px solid var(--cyan); border-radius:6px; padding:12px 28px;
    font-size:13px; font-weight:600; cursor:pointer; font-family:var(--font-body); transition:background .2s;
  }
  .btn-outline:hover { background:rgba(0,212,255,.08); }

  /* ── THE OVERLAPPING EMPLOYEE CARD ── */
  .emp-overlap-card {
    /* pull card UP into the hero — negative margin is the key */
    position: relative;
    z-index: 10;
    margin: -90px auto 0;          /* ← overlap amount */
    max-width: 1160px;
    width: calc(100% - 80px);
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid rgba(0,212,255,.22);
    box-shadow:
      0 0 0 1px rgba(0,212,255,.06),
      0 28px 90px rgba(0,0,0,.80),
      0 4px 24px rgba(0,212,255,.10);
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 300px;
  }

  /* left pane — dark gradient + dashboard widget */
  .eoc-visual {
    background: linear-gradient(140deg, #091540 0%, #050d30 55%, #030820 100%);
    border-right: 1px solid rgba(0,212,255,.12);
    display: flex; align-items: center; justify-content: center;
    padding: 40px 32px;
    position: relative; overflow: hidden;
  }
  .eoc-visual::before {
    content:''; position:absolute; top:-30%; left:-15%;
    width:70%; height:120%;
    background:radial-gradient(ellipse,rgba(0,180,255,.08) 0%,transparent 70%);
    pointer-events:none;
  }

  /* right pane — text */
  .eoc-content {
    background: linear-gradient(140deg, #0b1230 0%, #080e26 100%);
    padding: 48px 44px;
    display: flex; flex-direction: column; justify-content: center;
  }
  .eoc-content h2 {
    font-family:var(--font-head);
    font-size:26px; font-weight:700; color:#fff; margin-bottom:14px;
  }
  .eoc-content p { color:var(--text-muted); font-size:13px; line-height:1.75; margin-bottom:18px; }

  /* spacer — sits BELOW the card, continuing with background colour */
  .emp-below-spacer {
    background: var(--bg-primary);
    height: 60px;
  }

  /* shared small components */
  .badge {
    display:inline-block;
    background:rgba(0,212,255,.08); border:1px solid var(--border);
    color:var(--cyan); font-size:10px; font-weight:700;
    padding:4px 12px; border-radius:20px; margin-bottom:14px;
    letter-spacing:.8px; width:fit-content;
  }
  .feature-list { list-style:none; margin-bottom:18px; }
  .feature-list li {
    color:var(--text-muted); font-size:12.5px;
    padding:3px 0; display:flex; align-items:center; gap:8px;
  }
  .feature-list li::before { content:'✦'; color:var(--cyan); font-size:10px; flex-shrink:0; }
  .learn-link {
    color:var(--cyan); font-size:12px; font-weight:700;
    text-decoration:none; display:inline-flex; align-items:center; gap:5px;
  }
  .learn-link::after { content:'→'; font-size:14px; }
  .tagline-note { font-size:12px; color:var(--cyan); font-weight:600; margin-bottom:14px; }

  /* ─── DASHBOARD MOCK ─── */
  .dash-mock {
    background:rgba(13,21,53,.96); border-radius:12px;
    border:1px solid rgba(0,212,255,.18);
    padding:16px; width:100%; max-width:330px;
    box-shadow:0 8px 40px rgba(0,0,0,.6);
    position:relative; z-index:2;
  }
  .dmh { display:flex; gap:6px; margin-bottom:12px; align-items:center; }
  .dmh-dot { width:8px; height:8px; border-radius:50%; }
  .dmh-title { font-size:10px; color:var(--text-muted); margin-left:6px; }
  .dash-stats { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
  .ds-card {
    background:rgba(17,27,64,.9); border-radius:7px;
    padding:10px; border:1px solid var(--border);
  }
  .ds-label { font-size:9px; color:var(--text-muted); margin-bottom:4px; }
  .ds-val   { font-size:18px; font-weight:700; color:var(--cyan); font-family:var(--font-head); }
  .ds-bar   { height:3px; background:rgba(0,212,255,.10); border-radius:2px; margin-top:6px; }
  .ds-fill  { height:100%; background:linear-gradient(90deg,var(--cyan),#0099cc); border-radius:2px; }
  .dl-item {
    display:flex; justify-content:space-between; align-items:center;
    padding:6px 0; border-bottom:1px solid rgba(0,212,255,.07);
  }
  .dl-item:last-child { border-bottom:none; }
  .dl-name { font-size:11px; color:#aabcd0; }
  .dl-status { font-size:10px; padding:2px 8px; border-radius:10px; font-weight:600; }
  .s-active { background:rgba(0,230,150,.12); color:var(--green); }
  .s-leave  { background:rgba(255,196,0,.10);  color:#ffc400; }
  .s-remote { background:rgba(0,212,255,.10);  color:var(--cyan); }

  /* ══ ATTENDANCE ══════════════════════ */
  .attend-section { background:var(--bg-primary); border-bottom:1px solid var(--border); padding:0; }
  .attend-inner { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; align-items:center; }
  .attend-content { padding:56px 5%; }
  .attend-content h2 { font-family:var(--font-head); font-size:28px; font-weight:700; color:#fff; margin-bottom:14px; }
  .attend-visual { padding:40px 5% 40px 40px; display:flex; flex-direction:column; gap:14px; }

  .chart-mock {
    background:#0d1535; border-radius:10px;
    border:1px solid rgba(0,212,255,.12);
    padding:16px; box-shadow:0 8px 40px rgba(0,0,0,.5);
  }
  .chart-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
  .chart-title  { font-size:11px; font-weight:600; color:var(--text-muted); }
  .chart-legend { display:flex; gap:10px; }
  .cl-item  { display:flex; align-items:center; gap:4px; font-size:10px; color:var(--text-muted); }
  .cl-dot   { width:7px; height:7px; border-radius:50%; }
  .donut-row{ display:flex; align-items:center; gap:16px; margin-bottom:12px; }
  .donut {
    width:60px; height:60px; border-radius:50%; flex-shrink:0;
    background:conic-gradient(var(--cyan) 0deg 252deg,#1a2550 252deg 360deg);
    display:flex; align-items:center; justify-content:center;
  }
  .donut-inner {
    width:40px; height:40px; border-radius:50%;
    background:#0d1535; display:flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:700; color:var(--cyan);
  }
  .donut-stats { display:flex; flex-direction:column; gap:4px; }
  .dst { font-size:10px; color:var(--text-muted); display:flex; align-items:center; gap:5px; }
  .dst-val { font-weight:600; color:#fff; }
  .bc-row { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
  .bc-label { font-size:10px; color:var(--text-muted); width:24px; text-align:right; }
  .bc-track { flex:1; height:8px; background:#1a2550; border-radius:4px; }
  .bc-fill  { height:100%; border-radius:4px; }
  .bc-val   { font-size:10px; color:var(--text-muted); width:28px; }
  .table-mock {
    background:#0d1535; border-radius:10px;
    border:1px solid rgba(0,212,255,.12);
    padding:14px; box-shadow:0 8px 40px rgba(0,0,0,.5);
  }
  .tm-title { font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom:10px; }
  .tm-row {
    display:grid; grid-template-columns:2fr 1fr 1fr 1fr;
    gap:8px; padding:6px 0;
    border-bottom:1px solid rgba(0,212,255,.07); font-size:10px;
  }
  .tm-row.hdr  { color:var(--cyan); font-weight:600; }
  .tm-row.data { color:var(--text-muted); }
  .tm-in  { color:var(--green); }
  .tm-out { color:var(--magenta); }

  /* ══ SECURE ACCESS ═══════════════════ */
  .secure-section { background:var(--bg-secondary); border-bottom:1px solid var(--border); padding:0; }
  .secure-inner   { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; align-items:center; }
  .secure-content { padding:56px 5%; }
  .secure-content h2 { font-family:var(--font-head); font-size:28px; font-weight:700; color:#fff; line-height:1.2; margin-bottom:6px; }
  .secure-content h3 { font-family:var(--font-head); font-size:22px; font-weight:600; color:#fff; margin-bottom:14px; }
  .warn-badge {
    display:inline-flex; align-items:center; gap:6px;
    background:rgba(255,196,0,.10); border:1px solid rgba(255,196,0,.30);
    color:#ffc400; font-size:11px; font-weight:600;
    padding:5px 14px; border-radius:6px; margin-top:10px;
  }
  .secure-visual { padding:56px 5%; display:flex; align-items:center; justify-content:center; }
  .shield-hex {
    width:120px; height:140px;
    background:linear-gradient(135deg,#0d2060,#1a3a80);
    clip-path:polygon(50% 0%,100% 20%,100% 70%,50% 100%,0% 70%,0% 20%);
    display:flex; align-items:center; justify-content:center; flex-shrink:0;
    box-shadow:0 0 40px rgba(0,212,255,.30), inset 0 0 20px rgba(0,212,255,.10);
  }
  .shield-icon { font-size:40px; }
  .shield-right { margin-left:32px; }
  .sr-item { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
  .sr-dot  { width:8px; height:8px; border-radius:50%; background:var(--cyan); flex-shrink:0; }
  .sr-text { font-size:12px; color:var(--text-muted); }
  .sr-text strong { color:#fff; }

  /* ══ PAYROLL ═════════════════════════ */
  .payroll-section { background:var(--bg-primary); border-bottom:1px solid var(--border); padding:0; }
  .payroll-inner   { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; align-items:center; }
  .payroll-visual  { padding:56px 40px; }
  .payroll-content { padding:56px 5% 56px 40px; }
  .payroll-content h2 { font-family:var(--font-head); font-size:26px; font-weight:700; color:#fff; margin-bottom:14px; }
  .payroll-mock {
    background:#0d1535; border-radius:10px;
    border:1px solid rgba(0,212,255,.12);
    padding:16px; box-shadow:0 8px 40px rgba(0,0,0,.5);
  }
  .pm-header { display:flex; gap:8px; margin-bottom:14px; }
  .pm-btn         { padding:5px 14px; border-radius:5px; font-size:11px; font-weight:600; cursor:pointer; }
  .pm-btn.cyan    { background:var(--cyan); color:#000; border:none; }
  .pm-btn.outline { background:transparent; color:var(--cyan); border:1px solid var(--cyan); }
  .pm-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:12px; }
  .pm-card { background:#111b40; border-radius:6px; padding:10px; border:1px solid var(--border); text-align:center; }
  .pm-card .val { font-size:16px; font-weight:700; color:var(--cyan); font-family:var(--font-head); }
  .pm-card .lbl { font-size:10px; color:var(--text-muted); margin-top:2px; }
  .pm-payslip { background:#111b40; border-radius:6px; padding:10px; border:1px solid var(--border); }
  .pps-row { display:flex; justify-content:space-between; font-size:11px; padding:4px 0; border-bottom:1px solid var(--border); color:var(--text-muted); }
  .pps-row:last-child { border-bottom:none; }
  .pps-row .amt { color:var(--green); font-weight:600; }

  /* ══ DUAL CARDS ══════════════════════ */
  .dual-section { background:var(--bg-primary); padding:56px 5%; border-bottom:1px solid var(--border); }
  .dual-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; max-width:1200px; margin:0 auto; }
  .dual-card {
    background:var(--bg-card2); border:1px solid var(--border);
    border-radius:14px; padding:36px 32px; transition:border-color .3s;
  }
  .dual-card:hover { border-color:rgba(0,212,255,.30); }
  .dual-card h2 { font-family:var(--font-head); font-size:22px; font-weight:700; color:#fff; margin-bottom:12px; }
  .dual-card p  { color:var(--text-muted); font-size:13px; line-height:1.7; margin-bottom:18px; }
  .dual-icon    { font-size:28px; margin-bottom:14px; }

  /* ══ MOBILE ACCESS ═══════════════════ */
  .mobile-section {
    background:linear-gradient(135deg,#060c30 0%,#0a1540 40%,#030a1c 100%);
    border-bottom:1px solid var(--border); padding:72px 5%;
    position:relative; overflow:hidden;
  }
  .mobile-section::before {
    content:''; position:absolute; top:-50%; left:-10%; width:50%; height:200%;
    background:radial-gradient(ellipse,rgba(0,180,255,.06) 0%,transparent 70%);
    pointer-events:none;
  }
  .mobile-inner { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; align-items:center; gap:48px; }
  .mobile-content h2 { font-family:var(--font-head); font-size:clamp(30px,4vw,46px); font-weight:800; color:#fff; line-height:1.15; }
  .mobile-content h2 .cyan         { color:var(--cyan); }
  .mobile-content h2 .outline-text { -webkit-text-stroke:2px var(--magenta); -webkit-text-fill-color:transparent; }
  .mobile-content p { color:var(--text-muted); font-size:13px; line-height:1.75; margin:16px 0 24px; max-width:420px; }
  .btn-contact {
    background:transparent; color:var(--cyan);
    border:1.5px solid rgba(0,212,255,.40); border-radius:6px;
    padding:11px 24px; font-size:13px; font-weight:600;
    cursor:pointer; font-family:var(--font-body); transition:background .2s;
  }
  .btn-contact:hover { background:rgba(0,212,255,.08); }
  .mobile-visual { display:flex; justify-content:center; }
  .phone-mock {
    background:linear-gradient(180deg,#1a2a6c 0%,#0d1535 100%);
    border-radius:30px; border:2px solid rgba(0,212,255,.30);
    padding:16px; width:200px;
    box-shadow:0 20px 60px rgba(0,0,0,.70),0 0 40px rgba(0,212,255,.12);
  }
  .phone-notch { width:60px; height:10px; background:#0a0f28; border-radius:6px; margin:0 auto 12px; }
  .phone-screen { background:#0d1535; border-radius:16px; padding:12px; }
  .ps-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
  .ps-title  { font-size:10px; font-weight:700; color:#fff; }
  .ps-time   { font-size:9px; color:var(--cyan); }
  .ps-stats  { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px; }
  .pss-card  { background:#111b40; border-radius:8px; padding:8px; }
  .pss-label { font-size:8px; color:var(--text-muted); }
  .pss-value { font-size:14px; font-weight:700; color:var(--cyan); font-family:var(--font-head); }
  .ps-bar    { margin-bottom:8px; }
  .psb-label { font-size:9px; color:var(--text-muted); margin-bottom:4px; }
  .psb-track { height:5px; background:#1a2550; border-radius:3px; }
  .psb-fill  { height:100%; border-radius:3px; background:linear-gradient(90deg,var(--cyan),var(--magenta)); }
  .ps-bottom { font-size:9px; color:var(--text-muted); text-align:center; }

  /* ══ SMARTER ═════════════════════════ */
  .smarter-section { background:var(--bg-primary); padding:64px 5%; border-bottom:1px solid var(--border); }
  .smarter-inner   { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; gap:64px; align-items:center; }
  .smarter-content h2 { font-family:var(--font-head); font-size:clamp(22px,3.5vw,36px); font-weight:800; color:#fff; line-height:1.2; margin-bottom:32px; }
  .smarter-content h2 .hi { color:var(--magenta); }
  .ct-row { display:grid; grid-template-columns:1fr 1fr 1fr; padding:12px 0; border-bottom:1px solid var(--border); align-items:center; }
  .ct-row.hdr  { color:var(--text-muted); font-size:11px; font-weight:600; letter-spacing:.5px; }
  .ct-label { font-size:13px; color:var(--text-muted); display:flex; align-items:center; gap:8px; }
  .ct-ours  { font-size:13px; color:var(--cyan); font-weight:600; }
  .ct-theirs{ font-size:13px; color:var(--text-muted); opacity:.5; }
  .bad-x    { color:var(--magenta); font-weight:700; }
  .smarter-visual { display:flex; justify-content:center; }
  .emp-card-mock {
    background:var(--bg-card2); border-radius:14px;
    border:1px solid rgba(0,212,255,.20);
    padding:20px; width:260px;
    box-shadow:0 16px 48px rgba(0,0,0,.50);
  }
  .ecm-header { font-size:11px; font-weight:700; color:var(--text-muted); margin-bottom:14px; display:flex; align-items:center; gap:8px; }
  .ecm-card { background:#111b40; border-radius:10px; padding:14px; border:1px solid var(--border); margin-bottom:10px; display:flex; align-items:center; gap:12px; }
  .ecm-avatar { width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,var(--cyan),var(--purple)); display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; color:#fff; flex-shrink:0; }
  .ecm-name   { font-size:12px; font-weight:600; color:#fff; }
  .ecm-role   { font-size:10px; color:var(--text-muted); }
  .ecm-status { font-size:10px; padding:2px 8px; border-radius:10px; font-weight:600; }
  .status-online { background:rgba(0,230,150,.15); color:var(--green); }
  .ecm-actions { display:flex; gap:6px; margin-top:8px; }
  .ecm-btn     { flex:1; padding:6px; border-radius:5px; font-size:10px; font-weight:600; cursor:pointer; text-align:center; }
  .ecm-btn.prim{ background:var(--cyan); color:#000; border:none; }
  .ecm-btn.sec { background:transparent; color:var(--cyan); border:1px solid var(--cyan); }

  /* ══ STATS ═══════════════════════════ */
  .stats-section { background:var(--bg-primary); padding:64px 5%; border-bottom:1px solid var(--border); }
  .stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:32px; max-width:900px; margin:0 auto; text-align:center; }
  .stat-item .num { font-family:var(--font-head); font-size:42px; font-weight:800; color:#fff; }
  .stat-item .lbl { font-size:11px; color:var(--text-muted); letter-spacing:1px; margin-top:4px; }

  /* ══ CTA ═════════════════════════════ */
  .cta-section { background:var(--bg-secondary); border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:80px 5%; text-align:center; }
  .cta-section h2 { font-family:var(--font-head); font-size:clamp(24px,4vw,40px); font-weight:800; color:#fff; margin-bottom:10px; }
  .cta-section h2 .orange { color:#ff8c42; }
  .cta-section p   { color:var(--text-muted); font-size:13px; margin-bottom:6px; }
  .cta-section .sub2 { color:var(--text-muted); font-size:12px; margin-bottom:28px; display:flex; align-items:center; justify-content:center; gap:6px; }
  .cta-btns { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }

  /* ══ FOOTER ══════════════════════════ */
  .footer { background:#030614; border-top:1px solid var(--border); padding:56px 5% 24px; }
  .footer-top { display:grid; grid-template-columns:1fr 1fr 1fr; gap:24px; margin-bottom:40px; }
  .support-card { background:var(--bg-card2); border:1px solid var(--border); border-radius:12px; padding:20px; }
  .sc-icon  { font-size:20px; margin-bottom:8px; }
  .sc-title { font-size:13px; font-weight:700; color:#fff; margin-bottom:6px; }
  .sc-text  { font-size:11px; color:var(--text-muted); line-height:1.6; margin-bottom:12px; }
  .sc-btn   { background:#111b40; color:var(--cyan); border:1px solid var(--border); border-radius:6px; padding:7px 16px; font-size:11px; font-weight:600; cursor:pointer; font-family:var(--font-body); transition:background .2s; }
  .sc-btn:hover { background:rgba(0,212,255,.10); }
  .footer-mid { display:grid; grid-template-columns:1.5fr 1fr 1fr 1fr; gap:32px; padding:32px 0 24px; border-top:1px solid var(--border); }
  .footer-brand .logo { font-family:var(--font-head); font-size:20px; font-weight:800; letter-spacing:2px; color:var(--magenta); margin-bottom:10px; }
  .footer-brand .logo span { color:#fff; }
  .footer-brand p { font-size:11px; color:var(--text-muted); line-height:1.7; }
  .footer-col h4  { font-size:12px; font-weight:700; color:#fff; margin-bottom:12px; letter-spacing:.5px; }
  .footer-col a   { display:block; color:var(--text-muted); font-size:11.5px; text-decoration:none; margin-bottom:7px; transition:color .2s; }
  .footer-col a:hover { color:var(--cyan); }
  .footer-bottom {
    display:flex; justify-content:space-between; align-items:center;
    padding-top:20px; border-top:1px solid var(--border); flex-wrap:wrap; gap:12px;
  }
  .footer-bottom p { font-size:11px; color:var(--text-muted); }
  .footer-right   { display:flex; align-items:center; gap:20px; }
  .footer-socials { display:flex; gap:10px; }
  .social-icon {
    width:30px; height:30px; border-radius:6px;
    background:var(--bg-card2); border:1px solid var(--border);
    display:flex; align-items:center; justify-content:center;
    color:var(--text-muted); font-size:13px; cursor:pointer; transition:border-color .2s,color .2s;
  }
  .social-icon:hover { border-color:var(--cyan); color:var(--cyan); }
  .thank-you { font-size:11px; color:var(--text-muted); padding-left:16px; border-left:1px solid var(--border); }
  .thank-you span { color:var(--cyan); font-weight:600; }

  /* ── RESPONSIVE ── */
  @media(max-width:960px){
    .emp-overlap-card { grid-template-columns:1fr; width:calc(100% - 32px); margin:-60px auto 0; }
    .eoc-visual { min-height:220px; }
    .attend-inner,.secure-inner,.payroll-inner,.mobile-inner,.smarter-inner,.dual-grid { grid-template-columns:1fr; }
    .footer-top,.footer-mid { grid-template-columns:1fr; }
    .stats-grid { grid-template-columns:1fr 1fr; }
    .nav { padding:12px 20px; }
    .nav-links { display:none; }
  }
`;

/* ─── Sub-components ─── */
const DashboardMock = () => (
  <div className="dash-mock">
    <div className="dmh">
      <div className="dmh-dot" style={{background:'#ff5f56'}}/>
      <div className="dmh-dot" style={{background:'#ffbd2e'}}/>
      <div className="dmh-dot" style={{background:'#27c93f'}}/>
      <span className="dmh-title">Employee Overview</span>
    </div>
    <div className="dash-stats">
      {[{l:'Total Staff',v:'248',p:82},{l:'Active Today',v:'196',p:79},{l:'On Leave',v:'14',p:15},{l:'Remote',v:'38',p:34}].map(s=>(
        <div className="ds-card" key={s.l}>
          <div className="ds-label">{s.l}</div>
          <div className="ds-val">{s.v}</div>
          <div className="ds-bar"><div className="ds-fill" style={{width:`${s.p}%`}}/></div>
        </div>
      ))}
    </div>
    {[{n:'Sarah K.',s:'Active',c:'s-active'},{n:'James R.',s:'Leave',c:'s-leave'},{n:'Priya M.',s:'Remote',c:'s-remote'},{n:'Tom B.',s:'Active',c:'s-active'}].map(e=>(
      <div className="dl-item" key={e.n}>
        <span className="dl-name">{e.n}</span>
        <span className={`dl-status ${e.c}`}>{e.s}</span>
      </div>
    ))}
  </div>
);

const AttendanceVisual = () => (
  <>
    <div className="chart-mock">
      <div className="chart-header">
        <span className="chart-title">Monthly Overview</span>
        <div className="chart-legend">
          <div className="cl-item"><div className="cl-dot" style={{background:'#00d4ff'}}/> Present</div>
          <div className="cl-item"><div className="cl-dot" style={{background:'#ff2d78'}}/> Absent</div>
        </div>
      </div>
      <div className="donut-row">
        <div className="donut"><div className="donut-inner">70%</div></div>
        <div className="donut-stats">
          <div className="dst"><div className="cl-dot" style={{background:'#00d4ff'}}/><span className="dst-val">Present:</span> 196/248</div>
          <div className="dst"><div className="cl-dot" style={{background:'#ff2d78'}}/><span className="dst-val">Absent:</span> 14/248</div>
          <div className="dst"><div className="cl-dot" style={{background:'#00e696'}}/><span className="dst-val">WFH:</span> 38/248</div>
        </div>
      </div>
      {[{l:'Mon',v:88},{l:'Tue',v:92},{l:'Wed',v:78},{l:'Thu',v:95},{l:'Fri',v:85}].map(d=>(
        <div className="bc-row" key={d.l}>
          <span className="bc-label">{d.l}</span>
          <div className="bc-track"><div className="bc-fill" style={{width:`${d.v}%`,background:d.v>90?'#00e696':d.v>80?'#00d4ff':'#ff8c42'}}/></div>
          <span className="bc-val">{d.v}%</span>
        </div>
      ))}
    </div>
    <div className="table-mock">
      <div className="tm-title">Yearly Overview — 2025</div>
      <div className="tm-row hdr"><span>Employee</span><span>In</span><span>Out</span><span>Hrs</span></div>
      {[{n:'S. Kumar',i:'9:02',o:'18:05',h:'8.5'},{n:'P. Mehta',i:'8:55',o:'17:50',h:'8.2'},{n:'R. Singh',i:'9:15',o:'18:30',h:'8.7'}].map(r=>(
        <div className="tm-row data" key={r.n}>
          <span>{r.n}</span><span className="tm-in">{r.i}</span><span className="tm-out">{r.o}</span>
          <span style={{color:'#fff',fontWeight:600}}>{r.h}</span>
        </div>
      ))}
    </div>
  </>
);

const PayrollMock = () => (
  <div className="payroll-mock">
    <div className="pm-header">
      <button className="pm-btn cyan">Run Payroll</button>
      <button className="pm-btn outline">Save Draft</button>
      <button className="pm-btn outline">Export</button>
    </div>
    <div className="pm-grid">
      {[{v:'₹2.4L',l:'Gross Pay'},{v:'248',l:'Employees'},{v:'98.4%',l:'Accuracy'}].map(c=>(
        <div className="pm-card" key={c.l}><div className="val">{c.v}</div><div className="lbl">{c.l}</div></div>
      ))}
    </div>
    <div className="pm-payslip">
      {[{k:'Basic Salary',v:'₹45,000'},{k:'HRA',v:'₹18,000'},{k:'Tax Deduction',v:'-₹5,200'},{k:'Net Pay',v:'₹57,800'}].map(r=>(
        <div className="pps-row" key={r.k}><span>{r.k}</span><span className="amt">{r.v}</span></div>
      ))}
    </div>
  </div>
);

const PhoneMock = () => (
  <div className="phone-mock">
    <div className="phone-notch"/>
    <div className="phone-screen">
      <div className="ps-header"><span className="ps-title">HRMS Mobile</span><span className="ps-time">9:41 AM</span></div>
      <div className="ps-stats">
        <div className="pss-card"><div className="pss-label">Present</div><div className="pss-value">196</div></div>
        <div className="pss-card"><div className="pss-label">On Leave</div><div className="pss-value" style={{color:'#ff8c42'}}>14</div></div>
      </div>
      <div className="ps-bar"><div className="psb-label">Attendance Rate</div><div className="psb-track"><div className="psb-fill" style={{width:'79%'}}/></div></div>
      <div className="ps-bar"><div className="psb-label">Task Completion</div><div className="psb-track"><div className="psb-fill" style={{width:'65%',background:'linear-gradient(90deg,#00e696,#00d4ff)'}}/></div></div>
      <div className="ps-bottom">37% ▲ vs last month</div>
    </div>
  </div>
);

/* ─── Main Page ─── */
export default function HRMSPage() {
  const [active, setActive] = useState("Features");

  return (
    <>
      <style>{styles}</style>
      <div className="root">

        {/* NAV */}
        <nav className="nav">
          <div className="nav-logo">V—<span>SYNC</span></div>
          <div className="nav-links">
            {["Features","Pricing","Support"].map(l=>(
              <a key={l} href="#"
                 className={active===l?"active":""}
                 onClick={e=>{e.preventDefault();setActive(l)}}>{l}</a>
            ))}
          </div>
          <button className="btn-demo">Request a Demo</button>
        </nav>

        {/* ══════════════════════════════════════════════════════
            HERO WRAP — hero text + the overlapping card live here
            ══════════════════════════════════════════════════════ */}
        <div className="hero-wrap">

          {/* Hero text */}
          <section className="hero">
            <h1>Effortless HR,<br/>better team management</h1>
            <p className="sub">
              VWSyne simplifies workforce, payroll, and performance management in one place.
              Transforming HR into a seamless digital experience for modern teams.
            </p>
            <div className="hero-badge"><span>Welcome to "VW-sync"</span> &nbsp;✦</div>
            <div className="hero-tagline">
              <span className="dot">◆</span>
              One HR platform Designed for every business
              <span className="dot">◆</span>
            </div>
            <div className="hero-btns">
              <button className="btn-primary">Sign up to Explore FREE Trial</button>
              <button className="btn-outline">Request Free Demo</button>
            </div>
          </section>

          {/* Employee Management card — pulled up over the hero gradient */}
          <div className="emp-overlap-card">

            {/* LEFT: dashboard mock */}
            <div className="eoc-visual">
              <DashboardMock />
            </div>

            {/* RIGHT: text content */}
            <div className="eoc-content">
              <div className="badge">EMPLOYEE MODULE</div>
              <h2>Employee Management</h2>
              <p>
                Easily manage employee profiles, data, and your organisational structure using a clean,
                streamlined interface. Keep up-to-date employee directories and role hierarchies,
                and access information quickly to reduce manual work.
              </p>
              <ul className="feature-list">
                <li>Employee Profiles &nbsp;◆&nbsp; Roles &amp; Divisions</li>
                <li>Easy data access &nbsp;&nbsp;◆&nbsp; Organised records</li>
              </ul>
              <div className="tagline-note">✦ Designed to support your growing team</div>
              <a href="#" className="learn-link">Learn more</a>
            </div>

          </div>
        </div>

        {/* Spacer that picks up background after the card */}
        <div className="emp-below-spacer"/>

        {/* ATTENDANCE MANAGEMENT */}
        <section className="attend-section">
          <div className="attend-inner">
            <div className="attend-content">
              <div className="badge">ATTENDANCE MODULE</div>
              <h2>Attendance Management</h2>
              <p style={{color:'var(--text-muted)',fontSize:13,lineHeight:1.75,marginBottom:18}}>
                Track employee attendance in real time with seamless biometric integrations,
                keeping records and overview up-to-date. Have quick access to attendance history,
                manage everything in one place and reduce manual effort.
              </p>
              <ul className="feature-list">
                <li>Biometric integration &nbsp;◆&nbsp; Real-time tracking</li>
                <li>Accuracy records &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;◆&nbsp; Easy monitoring</li>
              </ul>
              <div className="tagline-note">✦ Ensuring accurate and consistent tracking</div>
              <a href="#" className="learn-link">Learn more</a>
            </div>
            <div className="attend-visual"><AttendanceVisual/></div>
          </div>
        </section>

        {/* SECURE ACCESS */}
        <section className="secure-section">
          <div className="secure-inner">
            <div className="secure-content">
              <h2>Secure access,</h2>
              <h3>better control</h3>
              <p style={{color:'var(--text-muted)',fontSize:13,lineHeight:1.7,marginBottom:14}}>
                Manage role-based permissions to ensure the right people have access to the right
                information at the right time. Control user access easily, protect sensitive data,
                and maintain proper distributions across your system.
              </p>
              <div className="warn-badge">⚠ Unauthorized action detected</div>
            </div>
            <div className="secure-visual">
              <div style={{display:'flex',alignItems:'center'}}>
                <div className="shield-hex"><span className="shield-icon">🛡</span></div>
                <div className="shield-right">
                  {[
                    {c:'var(--cyan)',   t:'Role-Based Access',   s:'Control'},
                    {c:'var(--green)',  t:'Multi-Factor',        s:'Authentication'},
                    {c:'#ff8c42',      t:'Audit Log',           s:'Monitoring'},
                  ].map(r=>(
                    <div className="sr-item" key={r.t}>
                      <div className="sr-dot" style={{background:r.c}}/>
                      <span className="sr-text"><strong>{r.t}</strong> {r.s}</span>
                    </div>
                  ))}
                  <div style={{marginTop:14,fontSize:12,color:'var(--cyan)',fontWeight:600}}>
                    ✦ Ensures reliable and secure access control
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PAYROLL */}
        <section className="payroll-section">
          <div className="payroll-inner">
            <div className="payroll-visual">
              <h3 style={{fontFamily:'var(--font-head)',fontSize:26,fontWeight:800,color:'#fff',lineHeight:1.2,marginBottom:20}}>
                Simple payroll,<br/><span style={{color:'var(--cyan)'}}>accurate processing</span>
              </h3>
              <PayrollMock/>
            </div>
            <div className="payroll-content">
              <div className="badge">PAYROLL MODULE</div>
              <h2>Payroll Management</h2>
              <p style={{color:'var(--text-muted)',fontSize:13,lineHeight:1.75,marginBottom:18}}>
                Automate salary calculations with full compliance, ensuring timely and error-free
                payroll every cycle. Manage payslips, deductions, and reports easily all in one
                place without manual effort.
              </p>
              <ul className="feature-list">
                <li>Employee profiles &nbsp;◆&nbsp; Roles &amp; structure</li>
                <li>Easy data access &nbsp;&nbsp;◆&nbsp; Organised records</li>
              </ul>
              <div className="tagline-note">✦ Accurate payroll with built-in compliance</div>
              <a href="#" className="learn-link">Learn more</a>
            </div>
          </div>
        </section>

        {/* PERFORMANCE + DATABASE */}
        <section className="dual-section">
          <div className="dual-grid">
            <div className="dual-card">
              <div className="dual-icon">📈</div>
              <h2>Performance Management</h2>
              <p>Track, assess, reward, and develop employee performance with a clear and structured approach. Set analytics dashboards for targets, progress, and objectives to support individual growth.</p>
              <ul className="feature-list">
                <li>Goal tracking &nbsp;&nbsp;&nbsp;◆&nbsp; Performance metrics</li>
                <li>Review cycles &nbsp;◆&nbsp; Development plans</li>
              </ul>
              <div style={{fontSize:12,color:'var(--cyan)',fontWeight:600,marginTop:12}}>✦ Built to support performance and growth</div>
            </div>
            <div className="dual-card">
              <div className="dual-icon">🗄</div>
              <h2>Database Management</h2>
              <p>Store and manage employee data synchronised and automated backup; keep data secure with real-time reports. All on structured and easily accessible databases whenever needed.</p>
              <ul className="feature-list">
                <li>Secure data export &nbsp;◆&nbsp; Real-time sync</li>
                <li>Automatic backups &nbsp;◆&nbsp; Easy data access</li>
              </ul>
              <div style={{fontSize:12,color:'var(--cyan)',fontWeight:600,marginTop:12}}>✦ Built for secure and reliable data management</div>
            </div>
          </div>
        </section>

        {/* MOBILE ACCESS */}
        <section className="mobile-section">
          <div className="mobile-inner">
            <div className="mobile-content">
              <h2>Smart mobile access</h2>
              <h2 className="cyan">Anytime</h2>
              <h2 className="outline-text">Anywhere</h2>
              <p>Access and manage your HR tasks anytime from your mobile device — whether checking attendance, approvals, or viewing employee details. Stay connected with real-time updates and keep everything running smoothly.</p>
              <button className="btn-contact">Contact us for more information</button>
            </div>
            <div className="mobile-visual"><PhoneMock/></div>
          </div>
        </section>

        {/* SMARTER */}
        <section className="smarter-section">
          <div className="smarter-inner">
            <div className="smarter-content">
              <h2>WHY Our HRMS makes <span className="hi">SMARTER</span> than other HRMS</h2>
              <div>
                <div className="ct-row hdr"><span>FEATURE</span><span style={{color:'var(--cyan)'}}>VW-Sync</span><span>Others</span></div>
                {[
                  {i:'⚡',l:'Speed',      ours:'Fast loading',    theirs:'Heavy systems'},
                  {i:'🌍',l:'Geo-logging',ours:'Built-in',        theirs:'Limited / paid'},
                  {i:'💰',l:'Cost',       ours:'Easy',            theirs:'Expensive'},
                  {i:'✨',l:'Simplicity', ours:'simple & clean',  theirs:'Complex dashboards'},
                ].map(r=>(
                  <div className="ct-row" key={r.l}>
                    <span className="ct-label"><span>{r.i}</span>{r.l}</span>
                    <span className="ct-ours">✓ {r.ours}</span>
                    <span className="ct-theirs"><span className="bad-x">✗</span> {r.theirs}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="smarter-visual">
              <div className="emp-card-mock">
                <div className="ecm-header">👤 Employee Manager <span style={{marginLeft:'auto',background:'rgba(0,212,255,.1)',color:'#00d4ff',fontSize:10,padding:'2px 8px',borderRadius:10}}>Live</span></div>
                {[{i:'AK',n:'Arjun K.',r:'Sr. Developer'},{i:'PM',n:'Priya M.',r:'HR Manager'}].map(e=>(
                  <div className="ecm-card" key={e.n}>
                    <div className="ecm-avatar">{e.i}</div>
                    <div style={{flex:1}}><div className="ecm-name">{e.n}</div><div className="ecm-role">{e.r}</div></div>
                    <span className="ecm-status status-online">Online</span>
                  </div>
                ))}
                <div className="ecm-actions">
                  <button className="ecm-btn prim">+ Add Employee</button>
                  <button className="ecm-btn sec">View All</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="stats-section">
          <div className="stats-grid">
            {[{n:'10k +',l:'ACTIVE USERS'},{n:'50 +',l:'COUNTRIES'},{n:'99.9%',l:'UPTIME SLA'},{n:'24/7',l:'SUPPORT'}].map(s=>(
              <div className="stat-item" key={s.l}>
                <div className="num">{s.n}</div>
                <div className="lbl">{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="cta-section">
          <h2>All your HR, <span className="orange">one simple</span> platform</h2>
          <p>Bringing everything together to help you manage, support, and grow your people with ease.</p>
          <div className="sub2"><span>◆</span> We're here to help you <span>◆</span></div>
          <div className="cta-btns">
            <button className="btn-primary">Explore Pricing</button>
            <button className="btn-outline">Contact Us</button>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <div className="footer-top">
            {[
              {icon:'💬',t:'WhatsApp Support', d:'Get instant answers from our support team, available anytime.'},
              {icon:'📞',t:'Phone Support',    d:'Send us your number and get detailed support whenever you need it.'},
              {icon:'✉', t:'Email Support',   d:'Send your queries and get detailed support on any issue.'},
            ].map(c=>(
              <div className="support-card" key={c.t}>
                <div className="sc-icon">{c.icon}</div>
                <div className="sc-title">{c.t}</div>
                <div className="sc-text">{c.d}</div>
                <button className="sc-btn">Contact</button>
              </div>
            ))}
          </div>
          <div className="footer-mid">
            <div className="footer-brand">
              <div className="logo">V—<span>SYNC</span></div>
              <p>Simplifying HR processes for modern businesses. One platform for all your workforce needs.</p>
            </div>
            {[
              {h:'Resources', links:['Documentation','API Reference','Blog','Case Studies','Help Center']},
              {h:'Company',   links:['About Us','Careers','Press','Partners','Contact']},
              {h:'Let\'s Connect', links:['LinkedIn','Twitter/X','Instagram','YouTube']},
            ].map(col=>(
              <div className="footer-col" key={col.h}>
                <h4>{col.h}</h4>
                {col.links.map(l=><a key={l} href="#">{l}</a>)}
              </div>
            ))}
          </div>
          <div className="footer-bottom">
            <p>© 2025 VW-Sync. All rights reserved. | Privacy Policy | Terms of Service</p>
            <div className="footer-right">
              <div className="footer-socials">
                {['f','in','▶','🐦'].map((s,i)=><div key={i} className="social-icon">{s}</div>)}
              </div>
              <div className="thank-you">✦ <span>Thank you for Exploring Our Website</span></div>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}