// PRICING PAGE

const PLANS = [
  {
    tier: 'starter',
    name: 'Starter',
    pitchLine: 'For the first-time candidate.',
    monthly: 49, annual: 490,
    features: [
      { t: '1 district', i: true },
      { t: '5 volunteer seats', i: true },
      { t: '1,000 doors / cycle', i: true },
      { t: 'Basic AI (voter one-liners)', i: true },
      { t: 'Offline canvassing', i: true },
      { t: 'Airtable sync', i: true },
      { t: 'Voice transcription', i: false },
      { t: 'Session debriefs', i: false },
      { t: 'API access', i: false },
    ],
    cta: 'Start 14-day trial',
  },
  {
    tier: 'pro',
    name: 'Pro',
    recommended: true,
    pitchLine: 'For the consultant running multiple races.',
    monthly: 199, annual: 1990,
    features: [
      { t: '1 district (+$99/mo extra)', i: true },
      { t: '20 volunteer seats', i: true },
      { t: '10,000 doors / cycle', i: true },
      { t: 'All AI features', i: true },
      { t: 'Voice transcription (1,000 min)', i: true },
      { t: 'Session debriefs', i: true },
      { t: 'Priority email support', i: true },
      { t: 'Custom walkbook branding', i: true },
      { t: 'API access', i: false },
    ],
    cta: 'Start 14-day trial',
  },
  {
    tier: 'agency',
    name: 'Agency',
    pitchLine: 'For parties, committees, & firms.',
    custom: true,
    features: [
      { t: 'Unlimited districts', i: true },
      { t: 'Unlimited volunteer seats', i: true },
      { t: 'Unlimited doors', i: true },
      { t: 'All AI + API access', i: true },
      { t: 'SSO / SAML', i: true },
      { t: 'Dedicated success manager', i: true },
      { t: 'Annual contracts', i: true },
      { t: 'Custom SLAs', i: true },
      { t: 'Data residency options', i: true },
    ],
    cta: 'Talk to sales',
  },
];

const FEATURE_MATRIX = [
  { group: 'Core', rows: [
    ['Districts', '1', '1', 'Unlimited'],
    ['Volunteer seats', '5', '20', 'Unlimited'],
    ['Doors per cycle', '1,000', '10,000', 'Unlimited'],
    ['Offline canvassing', true, true, true],
    ['Voter file import (CSV)', true, true, true],
    ['Airtable sync', true, true, true],
  ]},
  { group: 'AI & automation', rows: [
    ['Voter one-liners', true, true, true],
    ['Voice transcription', false, '1,000 min/mo', 'Unlimited'],
    ['Session debriefs', false, true, true],
    ['Custom AI prompts', false, false, true],
  ]},
  { group: 'Collaboration', rows: [
    ['Walkbook generation', true, true, true],
    ['Custom branding', false, true, true],
    ['Turf assignment', true, true, true],
    ['Volunteer analytics', false, true, true],
  ]},
  { group: 'Support & security', rows: [
    ['Email support', true, true, true],
    ['Priority support', false, true, true],
    ['Dedicated CSM', false, false, true],
    ['SSO / SAML', false, false, true],
    ['API access', false, false, true],
  ]},
];

const PricingCard = ({ plan, interval, onPick }) => {
  const annualSave = plan.monthly && interval === 'annual';
  const price = plan.custom ? null : (interval === 'annual' ? Math.round(plan.annual / 12) : plan.monthly);

  return (
    <div style={{
      background: plan.recommended ? 'var(--navy)' : 'var(--white)',
      color: plan.recommended ? 'var(--parchment)' : 'var(--ink)',
      border: '1px solid ' + (plan.recommended ? 'var(--navy)' : 'var(--rule)'),
      padding: '28px 26px',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 520,
    }}>
      {plan.recommended && (
        <div style={{
          position: 'absolute', top: -12, left: 24,
          background: 'var(--oxblood)',
          color: 'var(--parchment)',
          padding: '4px 10px',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}>
          ★ Most chosen
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h3 style={{
          fontSize: 24, color: plan.recommended ? 'var(--parchment)' : 'var(--navy)',
          fontFamily: 'var(--serif)',
        }}>{plan.name}</h3>
        {plan.tier === 'starter' && <span className="eyebrow" style={{ color: plan.recommended ? 'rgba(247,243,236,0.5)' : 'var(--mute)' }}>I</span>}
        {plan.tier === 'pro' && <span className="eyebrow on-navy">II</span>}
        {plan.tier === 'agency' && <span className="eyebrow">III</span>}
      </div>
      <p style={{
        fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14,
        color: plan.recommended ? 'rgba(247,243,236,0.7)' : 'var(--mute)',
        marginBottom: 20,
      }}>{plan.pitchLine}</p>

      <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid ' + (plan.recommended ? 'rgba(247,243,236,0.15)' : 'var(--rule-2)') }}>
        {plan.custom ? (
          <div style={{ fontFamily: 'var(--serif)', fontSize: 40, fontWeight: 500, lineHeight: 1 }}>Custom</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="num" style={{ fontSize: 44, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.02em' }}>
                ${price}
              </span>
              <span style={{ fontSize: 14, color: plan.recommended ? 'rgba(247,243,236,0.6)' : 'var(--mute)' }}>
                /month
              </span>
            </div>
            <div style={{ fontSize: 12, color: plan.recommended ? 'rgba(247,243,236,0.6)' : 'var(--mute)', marginTop: 6 }}>
              {interval === 'annual' ? (
                <>${plan.annual} billed annually · <span style={{ color: plan.recommended ? 'var(--parchment)' : 'var(--oxblood)', fontWeight: 600 }}>save 17%</span></>
              ) : (
                <>Billed monthly · cancel any time</>
              )}
            </div>
          </>
        )}
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10, flex: 1 }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, lineHeight: 1.4, opacity: f.i ? 1 : 0.45 }}>
            {f.i
              ? <Icon.check className="ic" style={{ flexShrink: 0, marginTop: 2, color: plan.recommended ? 'var(--parchment)' : 'var(--oxblood)' }} />
              : <Icon.x className="ic" style={{ flexShrink: 0, marginTop: 2, color: plan.recommended ? 'rgba(247,243,236,0.4)' : 'var(--mute-2)' }} />}
            <span>{f.t}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onPick(plan)}
        className={plan.recommended ? 'btn btn-oxblood btn-lg' : (plan.custom ? 'btn btn-ghost btn-lg' : 'btn btn-primary btn-lg')}
        style={{ marginTop: 24, width: '100%' }}>
        {plan.cta} <Icon.arrow className="ic" />
      </button>
    </div>
  );
};

const PricingPage = ({ onSelect, compact = false }) => {
  const [interval, setInterval] = useState('annual');

  return (
    <div style={{ background: 'var(--paper)' }}>
      {/* Hero */}
      <section style={{ padding: compact ? '48px 32px 24px' : '72px 32px 32px', background: 'var(--parchment)', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <div className="eyebrow oxblood" style={{ marginBottom: 14 }}>★   Pricing   ★</div>
          <h1 style={{ fontSize: compact ? 40 : 52, marginBottom: 16, lineHeight: 1.05 }}>
            Honest pricing for <em style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--oxblood)' }}>serious campaigns.</em>
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ink-2)', maxWidth: 560, margin: '0 auto', lineHeight: 1.5 }}>
            Fourteen days free. No credit card until the last day of your trial. Cancel with one click.
          </p>

          {/* Interval toggle */}
          <div style={{ display: 'inline-flex', marginTop: 28, border: '1px solid var(--rule)', background: 'var(--white)', padding: 3 }}>
            {['monthly','annual'].map(v => (
              <button key={v}
                onClick={() => setInterval(v)}
                style={{
                  padding: '9px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--sans)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  background: interval === v ? 'var(--navy)' : 'transparent',
                  color: interval === v ? 'var(--parchment)' : 'var(--ink-2)',
                  border: 'none',
                  cursor: 'pointer',
                }}>
                {v === 'monthly' ? 'Monthly' : 'Annual'}
                {v === 'annual' && <span style={{ marginLeft: 8, fontSize: 10, color: interval === 'annual' ? 'var(--parchment)' : 'var(--oxblood)' }}>− 17%</span>}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Plan cards */}
      <section style={{ padding: '48px 32px', background: 'var(--paper)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {PLANS.map(p => <PricingCard key={p.tier} plan={p} interval={interval} onPick={onSelect} />)}
        </div>
        <div style={{ maxWidth: 1120, margin: '24px auto 0', textAlign: 'center', fontSize: 13, color: 'var(--mute)' }}>
          <Icon.shield className="ic" style={{ color: 'var(--navy)', verticalAlign: '-3px' }}/> Stripe-secured · PCI-DSS compliant · Data stored in US-East facilities
        </div>
      </section>

      {/* Feature matrix */}
      {!compact && (
        <section style={{ padding: '48px 32px 72px', background: 'var(--parchment)', borderTop: '1px solid var(--rule)' }}>
          <div style={{ maxWidth: 1120, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Compare plans</div>
              <h2 style={{ fontSize: 32 }}>Every feature, on the table.</h2>
            </div>
            <div style={{ background: 'var(--white)', border: '1px solid var(--rule)' }}>
              <table className="table" style={{ fontSize: 13.5 }}>
                <thead>
                  <tr>
                    <th style={{ width: '40%', padding: '16px 20px', background: 'var(--parchment-2)' }}>Feature</th>
                    <th style={{ textAlign: 'center', padding: '16px 20px', background: 'var(--parchment-2)' }}>Starter</th>
                    <th style={{ textAlign: 'center', padding: '16px 20px', background: 'var(--navy)', color: 'var(--parchment)', borderBottom: '1px solid var(--navy)' }}>Pro</th>
                    <th style={{ textAlign: 'center', padding: '16px 20px', background: 'var(--parchment-2)' }}>Agency</th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_MATRIX.map(g => (
                    <React.Fragment key={g.group}>
                      <tr>
                        <td colSpan={4} style={{
                          padding: '14px 20px 6px',
                          fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600,
                          color: 'var(--oxblood)', borderBottom: '1px solid var(--rule)',
                          background: 'var(--paper)',
                        }}>
                          {g.group}
                        </td>
                      </tr>
                      {g.rows.map((row, i) => (
                        <tr key={i}>
                          <td style={{ padding: '12px 20px', fontSize: 14, color: 'var(--ink-2)' }}>{row[0]}</td>
                          {row.slice(1).map((cell, j) => (
                            <td key={j} style={{ textAlign: 'center', padding: '12px 20px', fontSize: 13, background: j === 1 ? 'rgba(11, 37, 69, 0.03)' : 'transparent' }}>
                              {cell === true ? <Icon.check className="ic" style={{ color: 'var(--oxblood)' }}/>
                                : cell === false ? <span style={{ color: 'var(--mute-2)' }}>—</span>
                                : <span className={typeof cell === 'string' && /\d/.test(cell) ? 'num' : ''} style={{ color: 'var(--ink-2)' }}>{cell}</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Trust strip */}
      {!compact && (
        <section style={{ padding: '48px 32px', background: 'var(--navy)', color: 'var(--parchment)' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, textAlign: 'center' }}>
            {[
              { n: '347', l: 'campaigns run on Campaign OS' },
              { n: '1.2M', l: 'doors knocked in 2024–26' },
              { n: '28', l: 'states served' },
              { n: '99.9%', l: 'uptime, verified' },
            ].map(s => (
              <div key={s.l}>
                <div className="num" style={{ fontSize: 36, fontWeight: 500, fontFamily: 'var(--serif)', color: 'var(--parchment)', marginBottom: 6 }}>{s.n}</div>
                <div className="eyebrow on-navy">{s.l}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// Mobile pricing (one card)
const PricingMobile = ({ onSelect }) => (
  <div style={{ padding: '20px 16px 40px' }}>
    <div style={{ padding: '16px 0 8px', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
        <CampaignOSMark size={20} color="var(--navy)" />
        <span style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>Campaign OS</span>
      </div>
      <div className="eyebrow oxblood">★  Pricing  ★</div>
      <h2 style={{ fontSize: 26, marginTop: 10, marginBottom: 6 }}>Honest pricing.</h2>
      <p style={{ fontSize: 13, color: 'var(--mute)' }}>14-day free trial · no card required</p>
    </div>
    <div style={{ padding: '12px 0', display: 'grid', gap: 12 }}>
      {PLANS.map(p => (
        <div key={p.tier} style={{
          background: p.recommended ? 'var(--navy)' : 'var(--white)',
          color: p.recommended ? 'var(--parchment)' : 'var(--ink)',
          border: '1px solid ' + (p.recommended ? 'var(--navy)' : 'var(--rule)'),
          padding: 18,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <h3 style={{ fontSize: 18, color: p.recommended ? 'var(--parchment)' : 'var(--navy)' }}>{p.name}</h3>
            <div className="num" style={{ fontSize: 20, fontWeight: 600 }}>
              {p.custom ? 'Custom' : '$' + p.monthly}<span style={{ fontSize: 11, opacity: 0.6 }}>{p.custom ? '' : '/mo'}</span>
            </div>
          </div>
          <p style={{ fontSize: 12, fontStyle: 'italic', marginBottom: 10, opacity: 0.75 }}>{p.pitchLine}</p>
          <button
            onClick={() => onSelect(p)}
            className={p.recommended ? 'btn btn-oxblood btn-sm' : 'btn btn-primary btn-sm'}
            style={{ width: '100%' }}>
            {p.cta}
          </button>
        </div>
      ))}
    </div>
  </div>
);

Object.assign(window, { PricingPage, PricingMobile, PLANS });
