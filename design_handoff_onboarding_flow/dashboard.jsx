// ADMIN DASHBOARD SHELL + EMPTY STATE + TRIAL BANNER

const AdminShell = ({ children, active = 'Voters', banner, planBadge = 'TRIAL · 13 DAYS LEFT' }) => {
  const nav = [
    { l: 'Overview', icon: Icon.chart },
    { l: 'Voters', icon: Icon.user },
    { l: 'Walkbooks', icon: Icon.doc },
    { l: 'Turf', icon: Icon.map },
    { l: 'Volunteers', icon: Icon.user },
    { l: 'Reports', icon: Icon.chart },
    { l: 'Settings', icon: Icon.gear },
    { l: 'Billing', icon: Icon.card },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 600, background: 'var(--paper)' }}>
      <aside style={{ background: 'var(--navy)', color: 'var(--parchment)', padding: '20px 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid rgba(247,243,236,0.12)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CampaignOSMark size={20} color="var(--parchment)" />
            <span style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>Campaign OS</span>
          </div>
          <div style={{ marginTop: 12, padding: '8px 10px', border: '1px solid rgba(247,243,236,0.2)', borderRadius: 2 }}>
            <div style={{ fontSize: 10, color: 'rgba(247,243,236,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Campaign</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>Sprouse for SC 115</div>
          </div>
        </div>
        <nav style={{ padding: '0 10px', display: 'grid', gap: 2 }}>
          {nav.map(n => (
            <a key={n.l} href="#" style={{
              padding: '8px 12px', fontSize: 13, color: 'var(--parchment)',
              textDecoration: 'none', borderRadius: 2,
              background: active === n.l ? 'rgba(247,243,236,0.1)' : 'transparent',
              display: 'flex', alignItems: 'center', gap: 10,
              fontWeight: active === n.l ? 600 : 400,
            }}>
              <n.icon className="ic" style={{ color: active === n.l ? 'var(--oxblood)' : 'rgba(247,243,236,0.6)' }}/>
              {n.l}
            </a>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: '14px 16px', borderTop: '1px solid rgba(247,243,236,0.12)', fontSize: 11 }}>
          <div style={{ color: 'rgba(247,243,236,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 9, marginBottom: 4 }}>Plan</div>
          <div style={{ color: 'var(--oxblood)', fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 11 }}>{planBadge}</div>
        </div>
      </aside>
      <main style={{ minWidth: 0 }}>
        {banner}
        <div style={{ padding: '24px 32px' }}>
          {children}
        </div>
      </main>
    </div>
  );
};

const TrialBanner = ({ daysLeft = 13, onUpgrade }) => (
  <div style={{
    background: 'var(--parchment)', borderBottom: '1px solid var(--rule)',
    padding: '10px 24px', fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="stars" style={{ fontSize: 9, letterSpacing: '0.3em' }}>★★★</span>
      <span style={{ color: 'var(--ink-2)' }}>
        You're on a <strong style={{ color: 'var(--navy)' }}>14-day free trial</strong> · <span className="num">{daysLeft} days</span> remaining · Import up to 100 voters before adding a card.
      </span>
    </div>
    <button className="btn btn-oxblood btn-sm" onClick={onUpgrade}>Add card & unlock →</button>
  </div>
);

const EmptyDashboard = ({ onImport, onUpgrade }) => (
  <AdminShell active="Voters" banner={<TrialBanner onUpgrade={onUpgrade}/>}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 4 }}>SC House District 115 · General · Driving</div>
        <h2 style={{ fontSize: 28 }}>Voter roll <span style={{ color: 'var(--mute)', fontWeight: 400 }}>· 0 of ~460</span></h2>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost btn-sm">Connect Airtable</button>
        <button className="btn btn-primary btn-sm" onClick={onImport}>Import voters →</button>
      </div>
    </div>

    {/* Empty state */}
    <div style={{
      border: '1.5px dashed var(--rule)', background: 'var(--parchment)',
      padding: '56px 32px', textAlign: 'center',
    }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, border: '1.5px solid var(--navy)', borderRadius: '50%', position: 'relative', marginBottom: 18 }}>
        <Icon.user style={{ width: 24, height: 24, color: 'var(--navy)' }}/>
        <div style={{ position: 'absolute', inset: 4, border: '1px solid var(--navy)', borderRadius: '50%' }}/>
      </div>
      <h3 style={{ fontSize: 22, marginBottom: 8 }}>Bring in your first voters.</h3>
      <p style={{ color: 'var(--ink-2)', fontSize: 14, maxWidth: 440, margin: '0 auto 24px' }}>
        Import a CSV from your state voter file, or start with a test file of up to 100 addresses. We'll geocode them and map them for you.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={onImport}>Upload CSV</button>
        <button className="btn btn-ghost">Download sample file</button>
      </div>
      <div style={{ marginTop: 28, fontSize: 11, color: 'var(--mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Or · explore the product with sample data
      </div>
    </div>

    {/* Preview grid */}
    <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {[
        { t: 'Generate walkbooks', d: 'Create printable walkbooks from turf & voter lists.', i: Icon.doc, locked: false },
        { t: 'Invite volunteers', d: 'Up to 2 free during trial; 20 on your Pro plan.', i: Icon.user, locked: false },
        { t: 'Start a knock session', d: 'Logs offline, syncs when reconnected.', i: Icon.map, locked: true },
      ].map(c => (
        <div key={c.t} style={{ background: 'var(--white)', border: '1px solid var(--rule)', padding: 18, position: 'relative', opacity: c.locked ? 0.6 : 1 }}>
          {c.locked && (
            <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--oxblood)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
              <Icon.lock className="ic" style={{ width: 11, height: 11 }}/> After card
            </div>
          )}
          <c.i style={{ width: 20, height: 20, color: 'var(--oxblood)', marginBottom: 10 }}/>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, color: 'var(--navy)', marginBottom: 4 }}>{c.t}</div>
          <div style={{ fontSize: 12.5, color: 'var(--mute)' }}>{c.d}</div>
        </div>
      ))}
    </div>
  </AdminShell>
);

Object.assign(window, { AdminShell, TrialBanner, EmptyDashboard });
