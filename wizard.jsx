// ONBOARDING WIZARD — 3 steps

const WizardShell = ({ step, total, title, children, onBack, onContinue, continueLabel = 'Continue' }) => (
  <div style={{ minHeight: 600, background: 'var(--parchment)', padding: '48px 32px' }}>
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CampaignOSMark size={22} color="var(--navy)" />
          <span style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, color: 'var(--navy)' }}>Campaign OS</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--mute)' }}>
          Logged in as <strong style={{ color: 'var(--navy)' }}>james@teller.co</strong> · <a href="#">Sign out</a>
        </div>
      </div>

      {/* Progress rib */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="eyebrow oxblood">Setup · Step {step} of {total}</div>
          <div className="num" style={{ fontSize: 11, color: 'var(--mute)', letterSpacing: '0.12em' }}>{Math.round((step/total)*100)}% COMPLETE</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4,
              background: i < step ? 'var(--navy)' : 'var(--rule-2)',
            }}/>
          ))}
        </div>
      </div>

      {/* Card */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', padding: '40px 44px' }}>
        <h2 style={{ fontSize: 28, marginBottom: 6 }}>{title}</h2>
        <hr className="rule double" style={{ margin: '14px 0 28px' }}/>
        {children}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
        {step > 1
          ? <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
          : <span/>
        }
        <button className="btn btn-primary" onClick={onContinue}>{continueLabel} <Icon.arrow className="ic"/></button>
      </div>
    </div>
  </div>
);

const WizardStep1 = ({ onNext, onBack }) => {
  const [role, setRole] = useState('consultant');
  const [name, setName] = useState('James Sprouse');
  return (
    <WizardShell step={1} total={3} title="About you." onBack={onBack} onContinue={onNext}>
      <div className="field">
        <label className="field-label">Your name</label>
        <input className="input" value={name} onChange={e=>setName(e.target.value)}/>
      </div>
      <div className="field">
        <label className="field-label">Your role</label>
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            ['campaign_staff', 'Campaign staff', 'Working on a single race full-time.'],
            ['consultant', 'Political consultant', 'Running multiple races for different candidates.'],
            ['party_staff', 'Party / PAC staff', 'Party committee or advocacy organization.'],
            ['other', 'Other', 'Volunteer, academic, vendor, press.'],
          ].map(([v, l, d]) => (
            <label key={v}
              style={{
                display: 'flex', gap: 12, padding: '12px 14px',
                border: '1px solid ' + (role === v ? 'var(--navy)' : 'var(--rule)'),
                background: role === v ? 'var(--parchment)' : 'var(--white)',
                cursor: 'pointer',
              }}>
              <input type="radio" name="role" checked={role === v} onChange={() => setRole(v)} style={{ marginTop: 3, accentColor: 'var(--navy)' }}/>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{l}</div>
                <div style={{ fontSize: 12.5, color: 'var(--mute)' }}>{d}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
      <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule-2)', padding: 14, fontSize: 12.5, color: 'var(--mute)', marginTop: 4 }}>
        <Icon.info className="ic" style={{ color: 'var(--navy)', verticalAlign: '-3px', marginRight: 6 }}/>
        Your role helps us show the right templates and examples. It's never shared.
      </div>
    </WizardShell>
  );
};

const WizardStep2 = ({ onNext, onBack }) => {
  const [etype, setEtype] = useState('general');
  const [travel, setTravel] = useState('driving');
  return (
    <WizardShell step={2} total={3} title="Your first campaign." onBack={onBack} onContinue={onNext}>
      <div className="field">
        <label className="field-label">Campaign or organization name</label>
        <input className="input" defaultValue="Sprouse for SC House 115"/>
      </div>
      <div className="field">
        <label className="field-label">Candidate <span style={{ color: 'var(--mute)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(if applicable)</span></label>
        <input className="input" defaultValue="James Sprouse"/>
      </div>

      <div className="field">
        <label className="field-label">Election type</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[['primary','Primary'],['general','General'],['advocacy','Advocacy / PAC']].map(([v, l]) => (
            <button key={v} onClick={()=>setEtype(v)}
              style={{
                padding: 12, border: '1px solid ' + (etype===v ? 'var(--navy)':'var(--rule)'),
                background: etype===v ? 'var(--navy)':'var(--white)',
                color: etype===v ? 'var(--parchment)':'var(--ink)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--sans)',
              }}>{l}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="field-label">Default travel mode</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[['walking','Walking','Dense urban routes'],['driving','Driving','Rural & suburban']].map(([v, l, d]) => (
            <button key={v} onClick={()=>setTravel(v)}
              style={{
                padding: '14px', textAlign: 'left',
                border: '1px solid ' + (travel===v ? 'var(--navy)':'var(--rule)'),
                background: travel===v ? 'var(--parchment)':'var(--white)',
                cursor: 'pointer', fontFamily: 'var(--sans)',
              }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{l}</div>
              <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>{d}</div>
            </button>
          ))}
        </div>
      </div>
    </WizardShell>
  );
};

const WizardStep3 = ({ onNext, onBack }) => {
  const [byo, setByo] = useState(true);
  return (
    <WizardShell step={3} total={3} title="Your first district." onBack={onBack} onContinue={onNext} continueLabel="Finish setup">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="field">
          <label className="field-label">Country</label>
          <select className="select"><option>United States</option><option>Australia</option><option>Canada</option></select>
        </div>
        <div className="field">
          <label className="field-label">State / Region</label>
          <select className="select"><option>South Carolina</option></select>
        </div>
      </div>
      <div className="field">
        <label className="field-label">District name</label>
        <input className="input" defaultValue="SC House District 115"/>
      </div>
      <div className="field">
        <label className="field-label">Target voter count <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,fontSize:11,color:'var(--mute)'}}>(approximate)</span></label>
        <input className="input num" defaultValue="460" style={{ maxWidth: 160 }}/>
        <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 6 }}>
          We use this to suggest the right plan tier at checkout.
        </div>
      </div>

      <hr className="rule" style={{ margin: '24px 0' }}/>

      <div className="eyebrow" style={{ marginBottom: 12 }}>Airtable integration</div>
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ display: 'flex', gap: 12, padding: '12px 14px', border: '1px solid ' + (byo ? 'var(--navy)':'var(--rule)'), background: byo ? 'var(--parchment)':'var(--white)', cursor: 'pointer' }}>
          <input type="radio" checked={byo} onChange={()=>setByo(true)} style={{ marginTop: 3, accentColor: 'var(--navy)' }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Connect my own Airtable base</div>
            <div style={{ fontSize: 12.5, color: 'var(--mute)', marginBottom: byo ? 10 : 0 }}>Recommended. Full ownership of your data.</div>
            {byo && (
              <input className="input num" defaultValue="appz0KOPIaQFCxxw3" style={{ fontSize: 13, padding: '8px 10px', marginTop: 6 }}/>
            )}
          </div>
        </label>
        <label style={{ display: 'flex', gap: 12, padding: '12px 14px', border: '1px solid ' + (!byo ? 'var(--navy)':'var(--rule)'), background: !byo ? 'var(--parchment)':'var(--white)', cursor: 'pointer' }}>
          <input type="radio" checked={!byo} onChange={()=>setByo(false)} style={{ marginTop: 3, accentColor: 'var(--navy)' }}/>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>We'll store your data <span className="badge mute" style={{ marginLeft: 6, fontSize: 9 }}>DEFAULT</span></div>
            <div style={{ fontSize: 12.5, color: 'var(--mute)' }}>Skip Airtable — use our in-app reporting. You can connect later.</div>
          </div>
        </label>
      </div>
    </WizardShell>
  );
};

Object.assign(window, { WizardStep1, WizardStep2, WizardStep3 });
