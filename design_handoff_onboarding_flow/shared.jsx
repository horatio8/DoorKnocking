// Shared primitives, icons, chrome
const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;

// ---- Icons (monoline, no emoji) ----
const Icon = {
  check: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8.5L6.5 12 13 4.5"/></svg>,
  x: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8"/></svg>,
  arrow: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg>,
  star: (p) => <svg {...p} viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l2.1 4.5L15 6.2l-3.5 3.5.9 5L8 12.3 3.6 14.7l.9-5L1 6.2l4.9-.7z"/></svg>,
  shield: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M8 1.5l5.5 2v4.2c0 3.2-2.2 5.8-5.5 6.8-3.3-1-5.5-3.6-5.5-6.8V3.5z"/><path d="M5.5 8l2 2 3-3.5"/></svg>,
  lock: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="7" width="10" height="7" rx="0.5"/><path d="M5 7V5a3 3 0 016 0v2"/></svg>,
  mail: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="3.5" width="13" height="9" rx="0.5"/><path d="M1.5 4.5l6.5 4.5 6.5-4.5"/></svg>,
  map: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M1 3.5l5-1.5 4 1.5 5-1.5v11l-5 1.5-4-1.5-5 1.5z"/><path d="M6 2v12M10 3.5v12"/></svg>,
  doc: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M3.5 1.5h6L12.5 4.5v10h-9z"/><path d="M9.5 1.5v3h3M5.5 7.5h5M5.5 10h5M5.5 12.5h3"/></svg>,
  card: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="3.5" width="13" height="9" rx="0.5"/><path d="M1.5 6.5h13M4 10h3"/></svg>,
  warn: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M8 2l6.5 11.5h-13z"/><path d="M8 6.5v3.5M8 11.8v.2"/></svg>,
  user: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="5.5" r="2.5"/><path d="M2.5 14c.5-3 2.8-4.5 5.5-4.5s5 1.5 5.5 4.5"/></svg>,
  flag: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M3 14V2M3 3h9l-2 3 2 3H3"/></svg>,
  chart: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 14h12M4 14V8M7 14V4M10 14V10M13 14V6"/></svg>,
  gear: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4"/></svg>,
  download: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M8 2v9M4.5 7.5L8 11l3.5-3.5M2.5 13.5h11"/></svg>,
  chevron: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 4-4 4"/></svg>,
  info: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="6.5"/><path d="M8 7v4.5M8 5v.2"/></svg>,
  sparkle: (p) => <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M8 2v4M8 10v4M2 8h4M10 8h4M4 4l2.5 2.5M9.5 9.5l2.5 2.5M4 12l2.5-2.5M9.5 6.5L12 4"/></svg>,
};

// ---- Campaign OS mark (eagle-over-rule monogram, original) ----
const CampaignOSMark = ({ size = 32, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    {/* shield */}
    <path d="M20 3 L35 8 V20 C35 29 28 35 20 37 C12 35 5 29 5 20 V8 Z"
          stroke={color} strokeWidth="1.5" fill="none"/>
    {/* stripes */}
    <path d="M5 14 H35 M5 20 H35 M5 26 H35" stroke={color} strokeWidth="0.6" opacity="0.35"/>
    {/* star */}
    <path d="M20 11 L21.4 14.2 L24.8 14.5 L22.3 16.8 L23 20.1 L20 18.4 L17 20.1 L17.7 16.8 L15.2 14.5 L18.6 14.2 Z"
          fill={color}/>
  </svg>
);

// ---- Masthead / marketing nav ----
const Masthead = ({ onNav, current }) => (
  <header className="masthead" style={{ padding: '14px 32px', borderBottom: '1px solid var(--rule)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1240, margin: '0 auto' }}>
      <a href="#" onClick={(e)=>{e.preventDefault(); onNav('pricing');}} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--navy)' }}>
        <CampaignOSMark size={28} color="var(--navy)" />
        <span style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>Campaign OS</span>
      </a>
      <nav style={{ display: 'flex', gap: 28, fontSize: 14 }}>
        <a href="#" onClick={(e)=>{e.preventDefault(); onNav('pricing');}}>Pricing</a>
        <a href="#">Features</a>
        <a href="#">Customers</a>
        <a href="#">Docs</a>
      </nav>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav('signup')}>Log in</button>
        <button className="btn btn-primary btn-sm" onClick={()=>onNav('pricing')}>Start free trial</button>
      </div>
    </div>
  </header>
);

// ---- Footer ----
const SiteFooter = () => (
  <footer style={{ background: 'var(--parchment)', borderTop: '1px solid var(--rule)', padding: '40px 32px', marginTop: 'auto' }}>
    <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 40 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <CampaignOSMark size={24} color="var(--navy)" />
          <span style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600 }}>Campaign OS</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--mute)', maxWidth: 280 }}>
          Door-to-door canvassing software built for down-ballot campaigns who take their data seriously.
        </p>
      </div>
      {[
        { h: 'Product', l: ['Pricing', 'Features', 'Security', 'Changelog'] },
        { h: 'Company', l: ['About', 'Customers', 'Contact', 'Careers'] },
        { h: 'Legal', l: ['Terms', 'Privacy', 'DPA', 'Status'] },
      ].map((col, i) => (
        <div key={i}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{col.h}</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {col.l.map(x => <li key={x}><a href="#" style={{ fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none' }}>{x}</a></li>)}
          </ul>
        </div>
      ))}
    </div>
    <div style={{ maxWidth: 1240, margin: '32px auto 0', borderTop: '1px solid var(--rule)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mute)' }}>
      <span>© 2026 Teller Consulting LLC · Established in the several States</span>
      <span className="num">v1.0 · Paid for by Campaign OS</span>
    </div>
  </footer>
);

// ---- Browser chrome for desktop framing ----
const BrowserFrame = ({ url = 'app.campaignos.com/pricing', children, small = false }) => (
  <div className="device" style={{ width: '100%' }}>
    <div className="device-bar">
      <span className="dot" style={{ background: '#D96D5C' }}/>
      <span className="dot" style={{ background: '#D9A83C' }}/>
      <span className="dot" style={{ background: '#6E9C5B' }}/>
      <span className="url">{url}</span>
    </div>
    <div style={{ background: 'var(--paper)', minHeight: small ? 400 : 600 }}>
      {children}
    </div>
  </div>
);

// ---- Phone frame ----
const PhoneFrame = ({ children, label }) => (
  <div style={{ width: 320, margin: '0 auto' }}>
    {label && <div className="eyebrow" style={{ textAlign: 'center', marginBottom: 10 }}>{label}</div>}
    <div style={{
      width: 320, height: 650,
      background: 'var(--ink)',
      borderRadius: 38,
      padding: 10,
      boxShadow: '0 20px 40px -20px rgba(0,0,0,0.35), 0 0 0 1px var(--rule-dark)',
    }}>
      <div style={{
        width: '100%', height: '100%',
        background: 'var(--paper)',
        borderRadius: 30,
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 110, height: 22, background: 'var(--ink)',
          borderBottomLeftRadius: 14, borderBottomRightRadius: 14, zIndex: 10,
        }}/>
        <div style={{ width: '100%', height: '100%', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  </div>
);

// ---- Side-by-side device showcase (desktop + mobile) ----
const ShowcaseFrame = ({ desktop, mobile, desktopUrl, mobileLabel = 'Mobile' }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 340px',
    gap: 28,
    alignItems: 'start',
  }}>
    <BrowserFrame url={desktopUrl}>{desktop}</BrowserFrame>
    {mobile && <PhoneFrame label={mobileLabel}>{mobile}</PhoneFrame>}
  </div>
);

// ---- Section scaffold used in docs-style prototype ----
const SectionHead = ({ kicker, title, num, desc }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
      {num && <span className="num" style={{ fontSize: 12, color: 'var(--oxblood)', fontWeight: 600, letterSpacing: '0.12em' }}>§ {num}</span>}
      <span className="eyebrow">{kicker}</span>
    </div>
    <h2 style={{ fontSize: 34, marginBottom: 10 }}>{title}</h2>
    {desc && <p style={{ fontSize: 16, color: 'var(--ink-2)', maxWidth: 680, lineHeight: 1.55 }}>{desc}</p>}
  </div>
);

// ---- Clickable prototype: jumps to a screen by key ----
const ScreenNav = ({ screens, current, onPick }) => (
  <div style={{
    position: 'sticky', top: 0, zIndex: 50,
    background: 'var(--parchment)',
    borderBottom: '1px solid var(--rule)',
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    overflowX: 'auto',
    fontSize: 12,
  }}>
    {screens.map(s => (
      <button key={s.key}
        onClick={() => onPick(s.key)}
        style={{
          background: current === s.key ? 'var(--navy)' : 'transparent',
          color: current === s.key ? 'var(--parchment)' : 'var(--ink-2)',
          border: '1px solid ' + (current === s.key ? 'var(--navy)' : 'transparent'),
          padding: '5px 10px',
          fontSize: 12,
          fontFamily: 'var(--sans)',
          fontWeight: 500,
          cursor: 'pointer',
          borderRadius: 2,
          whiteSpace: 'nowrap',
        }}>
        <span className="num" style={{ color: current === s.key ? 'rgba(247,243,236,0.55)' : 'var(--mute)', marginRight: 6 }}>{s.num}</span>
        {s.label}
      </button>
    ))}
  </div>
);

Object.assign(window, { Icon, CampaignOSMark, Masthead, SiteFooter, BrowserFrame, PhoneFrame, ShowcaseFrame, SectionHead, ScreenNav });
