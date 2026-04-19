// MAIN APP — screen router, tweaks, mobile side-by-side

const SCREENS = [
  { key: 'pricing', num: '01', label: 'Pricing', section: 'Acquire' },
  { key: 'signup', num: '02', label: 'Sign up', section: 'Acquire' },
  { key: 'verify', num: '03', label: 'Verify email', section: 'Acquire' },
  { key: 'wizard1', num: '04', label: 'Wizard · You', section: 'Onboard' },
  { key: 'wizard2', num: '05', label: 'Wizard · Campaign', section: 'Onboard' },
  { key: 'wizard3', num: '06', label: 'Wizard · District', section: 'Onboard' },
  { key: 'empty', num: '07', label: 'Empty dashboard', section: 'Onboard' },
  { key: 'paywallA', num: '08', label: 'Paywall · A', section: 'Convert' },
  { key: 'paywallB', num: '09', label: 'Paywall · B', section: 'Convert' },
  { key: 'paywallC', num: '10', label: 'Paywall · C', section: 'Convert' },
  { key: 'billing', num: '11', label: 'Billing mgmt', section: 'Manage' },
  { key: 'trial-ended', num: '12', label: 'Trial ended', section: 'States' },
  { key: 'dunning', num: '13', label: 'Dunning', section: 'States' },
  { key: 'emails', num: '14', label: 'Trial emails', section: 'Comms' },
  { key: 'funnel', num: '15', label: 'Funnel metrics', section: 'Internal' },
];

// Load initial state from hash or localStorage
const readInitialScreen = () => {
  if (typeof window === 'undefined') return 'pricing';
  const hash = window.location.hash.replace('#', '');
  if (hash && SCREENS.find(s => s.key === hash)) return hash;
  const saved = localStorage.getItem('cos_screen');
  if (saved && SCREENS.find(s => s.key === saved)) return saved;
  return 'pricing';
};

// Tweakable defaults (editable via host)
const TWEAKS_DEFAULTS = /*EDITMODE-BEGIN*/{
  "paywallVariant": "A",
  "showMobile": true,
  "navSticky": true
}/*EDITMODE-END*/;

const App = () => {
  const [screen, setScreen] = useState(readInitialScreen);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [tweaksVisible, setTweaksVisible] = useState(false);
  const [tweaks, setTweaks] = useState(TWEAKS_DEFAULTS);

  useEffect(() => {
    localStorage.setItem('cos_screen', screen);
    try { window.location.hash = screen; } catch (e) {}
  }, [screen]);

  // Host edit-mode protocol
  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data || {};
      if (d.type === '__activate_edit_mode') setTweaksVisible(true);
      if (d.type === '__deactivate_edit_mode') setTweaksVisible(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const updateTweak = (k, v) => {
    setTweaks(t => ({ ...t, [k]: v }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
  };

  const nav = (k) => setScreen(k);

  // Build desktop screen
  const renderDesktop = () => {
    switch (screen) {
      case 'pricing': return <PricingPage onSelect={() => nav('signup')} />;
      case 'signup': return <SignupPage onCreated={() => nav('verify')} onNavLogin={() => nav('signup')}/>;
      case 'verify': return <CheckEmailPage email="james@teller.co" onVerified={() => nav('wizard1')}/>;
      case 'wizard1': return <WizardStep1 onNext={() => nav('wizard2')} onBack={() => nav('verify')}/>;
      case 'wizard2': return <WizardStep2 onNext={() => nav('wizard3')} onBack={() => nav('wizard1')}/>;
      case 'wizard3': return <WizardStep3 onNext={() => nav('empty')} onBack={() => nav('wizard2')}/>;
      case 'empty': return <EmptyDashboard onImport={() => nav('paywall' + tweaks.paywallVariant)} onUpgrade={() => nav('paywall' + tweaks.paywallVariant)}/>;
      case 'paywallA': return <PaywallA onBack={() => nav('empty')} onPay={() => nav('billing')}/>;
      case 'paywallB': return <PaywallB onBack={() => nav('empty')} onPay={() => nav('billing')}/>;
      case 'paywallC': return <PaywallC onBack={() => nav('empty')} onPay={() => nav('billing')}/>;
      case 'billing': return <BillingPage/>;
      case 'trial-ended': return <TrialEndedView/>;
      case 'dunning': return <DunningView/>;
      case 'emails': return <EmailsPage/>;
      case 'funnel': return <FunnelPage/>;
      default: return <PricingPage onSelect={() => nav('signup')}/>;
    }
  };

  // Mobile companion: only for a few screens
  const renderMobile = () => {
    switch (screen) {
      case 'pricing': return <PricingMobile onSelect={() => nav('signup')}/>;
      case 'signup': return <SignupMobile onCreated={() => nav('verify')}/>;
      case 'paywallA':
      case 'paywallB':
      case 'paywallC': return <PaywallMobile/>;
      default: return null;
    }
  };

  const mobileNode = tweaks.showMobile ? renderMobile() : null;

  const currentScreen = SCREENS.find(s => s.key === screen) || SCREENS[0];
  const desktopUrl = {
    pricing: 'app.campaignos.com/pricing',
    signup: 'app.campaignos.com/signup',
    verify: 'app.campaignos.com/verify',
    wizard1: 'app.campaignos.com/setup/role',
    wizard2: 'app.campaignos.com/setup/campaign',
    wizard3: 'app.campaignos.com/setup/district',
    empty: 'app.campaignos.com/admin/voters',
    paywallA: 'app.campaignos.com/billing/activate',
    paywallB: 'app.campaignos.com/billing/activate',
    paywallC: 'app.campaignos.com/admin/voters · paywall',
    billing: 'app.campaignos.com/admin/billing',
    'trial-ended': 'app.campaignos.com/admin/voters',
    dunning: 'app.campaignos.com/admin/billing',
    emails: 'mail-previews/trial-cadence',
    funnel: 'app.campaignos.com/admin/internal/signup-funnel',
  }[screen];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top manifest ribbon */}
      <div style={{ background: 'var(--ink)', color: 'var(--parchment)', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, borderBottom: '1px solid var(--rule-dark)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="num" style={{ color: 'var(--oxblood)', letterSpacing: '0.14em' }}>CAMPAIGN OS</span>
          <span style={{ opacity: 0.5 }}>/</span>
          <span>Self-serve onboarding & billing · prototype</span>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', color: 'rgba(247,243,236,0.6)' }}>
          <span className="num">15 screens</span>
          <span>·</span>
          <span>3 paywall variations</span>
          <span>·</span>
          <span>Desktop + mobile</span>
        </div>
      </div>

      {/* Screen nav */}
      <div style={{
        position: tweaks.navSticky ? 'sticky' : 'static',
        top: 0, zIndex: 50,
        background: 'var(--parchment)',
        borderBottom: '1px solid var(--rule)',
      }}>
        <div style={{ padding: '12px 20px 10px', display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto' }}>
          {SCREENS.map(s => (
            <button key={s.key}
              onClick={() => nav(s.key)}
              style={{
                background: screen === s.key ? 'var(--navy)' : 'transparent',
                color: screen === s.key ? 'var(--parchment)' : 'var(--ink-2)',
                border: '1px solid ' + (screen === s.key ? 'var(--navy)' : 'transparent'),
                padding: '6px 11px', fontSize: 12, fontFamily: 'var(--sans)',
                fontWeight: 500, cursor: 'pointer', borderRadius: 2, whiteSpace: 'nowrap',
              }}>
              <span className="num" style={{ color: screen === s.key ? 'rgba(247,243,236,0.55)' : 'var(--mute)', marginRight: 6, fontSize: 10 }}>{s.num}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area — desktop + mobile side-by-side */}
      <div style={{ padding: '24px 20px 40px', background: '#EDE8DC', flex: 1 }}>
        <div style={{ maxWidth: 1480, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div className="eyebrow oxblood">{currentScreen.section}</div>
              <h2 style={{ fontSize: 22, marginTop: 2, color: 'var(--navy)' }}>
                <span className="num" style={{ color: 'var(--oxblood)', marginRight: 10, fontSize: 14 }}>§ {currentScreen.num}</span>
                {currentScreen.label}
              </h2>
            </div>
            <div style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--mono)', textAlign: 'right' }}>
              <div>Screen {parseInt(currentScreen.num,10)} of {SCREENS.length}</div>
              <div style={{ fontSize: 10, marginTop: 2 }}>/{screen}</div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: mobileNode ? 'minmax(0, 1fr) 360px' : '1fr',
            gap: 24,
            alignItems: 'start',
          }}>
            <BrowserFrame url={desktopUrl}>
              {renderDesktop()}
            </BrowserFrame>
            {mobileNode && <PhoneFrame label={'iPhone · ' + currentScreen.label}>{mobileNode}</PhoneFrame>}
          </div>
        </div>
      </div>

      {/* Tweaks panel */}
      {tweaksVisible && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, width: 320,
          background: 'var(--paper)', border: '1px solid var(--rule-dark)',
          boxShadow: '0 20px 40px -16px rgba(0,0,0,0.35)',
          zIndex: 100,
        }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--rule)', background: 'var(--navy)', color: 'var(--parchment)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 600 }}>Tweaks</span>
            <button onClick={() => setTweaksOpen(o => !o)} style={{ background: 'transparent', border: 'none', color: 'var(--parchment)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--sans)' }}>
              {tweaksOpen ? 'Collapse' : 'Expand'}
            </button>
          </div>
          {!tweaksOpen ? null : (
            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 14 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Default paywall variant</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['A','B','C'].map(v => (
                    <button key={v}
                      onClick={() => { updateTweak('paywallVariant', v); if (screen.startsWith('paywall')) nav('paywall'+v); }}
                      style={{
                        flex: 1, padding: '8px', fontSize: 13, fontWeight: 600,
                        background: tweaks.paywallVariant === v ? 'var(--navy)' : 'var(--white)',
                        color: tweaks.paywallVariant === v ? 'var(--parchment)' : 'var(--ink)',
                        border: '1px solid ' + (tweaks.paywallVariant === v ? 'var(--navy)' : 'var(--rule)'),
                        cursor: 'pointer', fontFamily: 'var(--sans)',
                      }}>{v === 'A' ? 'Broadside' : v === 'B' ? 'Receipt' : 'Modal'}</button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 6 }}>
                  Sets which paywall the "Empty dashboard" CTA opens.
                </div>
              </div>

              <label className="check" style={{ marginBottom: 12 }}>
                <input type="checkbox" checked={tweaks.showMobile} onChange={(e) => updateTweak('showMobile', e.target.checked)}/>
                <span>Show mobile companion (where available)</span>
              </label>
              <label className="check" style={{ marginBottom: 12 }}>
                <input type="checkbox" checked={tweaks.navSticky} onChange={(e) => updateTweak('navSticky', e.target.checked)}/>
                <span>Sticky screen nav</span>
              </label>

              <hr className="rule" style={{ margin: '12px 0' }}/>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Jump to state</div>
              <div style={{ display: 'grid', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => nav('trial-ended')}>Trial-ended state</button>
                <button className="btn btn-ghost btn-sm" onClick={() => nav('dunning')}>Dunning state</button>
                <button className="btn btn-ghost btn-sm" onClick={() => nav('funnel')}>Funnel dashboard</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
