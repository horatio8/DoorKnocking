// THREE PAYWALL VARIATIONS + stripe-style elements

const StripeCardInput = ({ variant = 'light' }) => {
  const dark = variant === 'dark';
  const base = {
    background: dark ? 'rgba(247,243,236,0.06)' : 'var(--white)',
    border: '1px solid ' + (dark ? 'rgba(247,243,236,0.2)' : 'var(--rule)'),
    color: dark ? 'var(--parchment)' : 'var(--ink)',
    padding: '11px 12px', fontSize: 14,
    fontFamily: 'var(--mono)',
    borderRadius: 'var(--r-sm)',
  };
  return (
    <div>
      <div style={{...base, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Icon.card className="ic" style={{ color: dark ? 'rgba(247,243,236,0.4)' : 'var(--mute)' }}/>
        <span>4242 4242 4242 4242</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <span style={{ fontSize: 9, letterSpacing: '0.1em', padding: '2px 5px', border: '1px solid currentColor', color: dark ? 'rgba(247,243,236,0.4)' : 'var(--mute)' }}>VISA</span>
          <span style={{ fontSize: 9, letterSpacing: '0.1em', padding: '2px 5px', border: '1px solid currentColor', color: dark ? 'rgba(247,243,236,0.4)' : 'var(--mute)' }}>MC</span>
          <span style={{ fontSize: 9, letterSpacing: '0.1em', padding: '2px 5px', border: '1px solid currentColor', color: dark ? 'rgba(247,243,236,0.4)' : 'var(--mute)' }}>AMEX</span>
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div style={base}>05 / 29</div>
        <div style={base}>•••</div>
        <div style={base}>29401</div>
      </div>
    </div>
  );
};

// --- VARIATION A: "The Respectful Broadside" — single-column, reassuring ---
const PaywallA = ({ onBack, onPay }) => (
  <div style={{ minHeight: 620, background: 'var(--parchment)', padding: '40px 32px' }}>
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <CampaignOSMark size={22} color="var(--navy)"/>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>Campaign OS</span>
        </div>
        <div className="eyebrow oxblood" style={{ marginBottom: 10 }}>★ Activate your plan ★</div>
        <h1 style={{ fontSize: 32, marginBottom: 10 }}>Ready to canvass for real?</h1>
        <p style={{ color: 'var(--ink-2)', fontSize: 15, maxWidth: 420, margin: '0 auto' }}>
          Add a card now to lift the 100-voter cap. We won't charge until your trial ends.
        </p>
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', padding: '28px 32px' }}>
        {/* Summary */}
        <div style={{ background: 'var(--parchment)', padding: 18, border: '1px solid var(--rule-2)', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div>
              <div className="eyebrow oxblood">Your plan</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', marginTop: 2 }}>Pro · Annual</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="num" style={{ fontSize: 24, fontWeight: 500, color: 'var(--navy)' }}>$1,990</div>
              <div style={{ fontSize: 11, color: 'var(--mute)' }}>per year · save $398</div>
            </div>
          </div>
          <hr className="rule" style={{ margin: '10px 0' }}/>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Today</span><span className="num" style={{ fontWeight: 600 }}>$0.00</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span>First charge on <strong style={{ color: 'var(--navy)' }}>May 3, 2026</strong></span>
            <span className="num" style={{ fontWeight: 600 }}>$1,990.00</span>
          </div>
        </div>

        <div className="field">
          <label className="field-label">Card details <span style={{textTransform:'none',letterSpacing:0,fontSize:10,color:'var(--mute)',fontWeight:400,marginLeft:6}}><Icon.lock className="ic" style={{color:'var(--navy)',verticalAlign:'-3px'}}/> Stripe-secured</span></label>
          <StripeCardInput/>
        </div>
        <div className="field">
          <label className="field-label">Name on card</label>
          <input className="input" defaultValue="James E. Sprouse"/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div className="field">
            <label className="field-label">Country</label>
            <select className="select"><option>United States</option></select>
          </div>
          <div className="field">
            <label className="field-label">ZIP</label>
            <input className="input num" defaultValue="29401"/>
          </div>
        </div>

        <label className="check" style={{ margin: '4px 0 20px' }}>
          <input type="checkbox" defaultChecked/>
          <span>Email me a receipt each billing cycle.</span>
        </label>

        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={onPay}>
          <Icon.lock className="ic"/> Start my Pro plan
        </button>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'var(--mute)' }}>
          <a href="#" style={{ marginRight: 16 }}>Change plan</a>
          <a href="#">Questions? Chat with us</a>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <a href="#" onClick={(e)=>{e.preventDefault(); onBack && onBack();}} style={{ fontSize: 13, color: 'var(--mute)' }}>
          Not right now — keep exploring →
        </a>
      </div>
    </div>
  </div>
);

// --- VARIATION B: "The Receipt" — dense two-column, invoice-style ---
const PaywallB = ({ onBack, onPay }) => (
  <div style={{ minHeight: 620, background: 'var(--paper)', padding: '32px' }}>
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CampaignOSMark size={22} color="var(--navy)"/>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>Campaign OS</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--mute)' }}>Secure checkout via <strong>Stripe</strong></div>
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', display: 'grid', gridTemplateColumns: '1fr 420px' }}>
        {/* LEFT - form */}
        <div style={{ padding: '36px 40px' }}>
          <div className="eyebrow oxblood" style={{ marginBottom: 10 }}>Activate</div>
          <h2 style={{ fontSize: 26, marginBottom: 6 }}>Start your Pro plan.</h2>
          <p style={{ fontSize: 14, color: 'var(--mute)', marginBottom: 28 }}>Your 14-day trial stays active. First charge on <strong style={{color:'var(--navy)'}}>May 3, 2026</strong>.</p>

          <div className="eyebrow" style={{ marginBottom: 12 }}>1 · Card</div>
          <StripeCardInput/>

          <div className="field" style={{ marginTop: 16 }}>
            <label className="field-label">Cardholder name</label>
            <input className="input" defaultValue="James E. Sprouse"/>
          </div>

          <div className="eyebrow" style={{ marginTop: 16, marginBottom: 12 }}>2 · Billing address</div>
          <div className="field">
            <input className="input" defaultValue="127 Queen Street"/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr', gap: 12, marginBottom: 24 }}>
            <input className="input" defaultValue="Charleston" placeholder="City"/>
            <select className="select"><option>SC</option></select>
            <input className="input num" defaultValue="29401" placeholder="ZIP"/>
          </div>

          <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule-2)', padding: '12px 14px', fontSize: 12.5, color: 'var(--ink-2)', display: 'flex', gap: 10, marginBottom: 20 }}>
            <Icon.shield className="ic" style={{color:'var(--navy)',flexShrink:0,marginTop:2}}/>
            <span>Card data flows directly to Stripe (PCI-DSS). Campaign OS never sees your number. Billing receipts are emailed and archived under Settings → Billing.</span>
          </div>

          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={onPay}>
            <Icon.lock className="ic"/> Confirm & start Pro
          </button>
          <div style={{ marginTop: 10, textAlign: 'center', fontSize: 12, color: 'var(--mute)' }}>
            <a href="#" onClick={(e)=>{e.preventDefault(); onBack&&onBack();}}>← Not right now, keep exploring</a>
          </div>
        </div>

        {/* RIGHT - receipt */}
        <div style={{ background: 'var(--parchment)', padding: '36px 36px', borderLeft: '1px solid var(--rule)' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Order summary</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', marginBottom: 14 }}>Pro — Annual</div>

          <table className="table" style={{ fontSize: 13, marginBottom: 20 }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px 0', border: 0 }}>Pro plan · annual</td>
                <td style={{ textAlign: 'right', padding: '8px 0', border: 0 }} className="num">$1,990.00</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', border: 0, color: 'var(--oxblood)' }}>Annual discount (17%)</td>
                <td style={{ textAlign: 'right', padding: '8px 0', border: 0, color: 'var(--oxblood)' }} className="num">− $398.00</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', border: 0 }}>Stripe Tax (SC, est.)</td>
                <td style={{ textAlign: 'right', padding: '8px 0', border: 0 }} className="num">$0.00</td>
              </tr>
            </tbody>
          </table>

          <hr className="rule double"/>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '16px 0' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--mute)' }}>Due today</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 600, color: 'var(--navy)' }} className="num">$0.00</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>First charge</div>
              <div className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>$1,990 · May 3</div>
            </div>
          </div>

          <hr className="rule"/>

          <div className="eyebrow" style={{ marginTop: 24, marginBottom: 10 }}>Included</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8, fontSize: 13 }}>
            {['1 district, 20 volunteer seats', '10,000 doors per cycle', 'All AI features', '1,000 minutes transcription', 'Priority email support'].map(x => (
              <li key={x} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Icon.check className="ic" style={{ color: 'var(--oxblood)', marginTop: 2, flexShrink: 0 }}/>
                <span style={{ color: 'var(--ink-2)' }}>{x}</span>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed var(--rule)', fontSize: 11, color: 'var(--mute)' }}>
            <div className="num" style={{ marginBottom: 4 }}>ORDER #COS-2026-0043</div>
            30-day money-back guarantee on annual plans. Cancel any time in Settings → Billing.
          </div>
        </div>
      </div>
    </div>
  </div>
);

// --- VARIATION C: "The Inline Moment" — paywall as a modal over dashboard ---
const PaywallC = ({ onBack, onPay }) => (
  <div style={{ position: 'relative', minHeight: 620 }}>
    {/* Background: faded dashboard */}
    <div style={{ filter: 'blur(2px) saturate(0.8)', opacity: 0.55, pointerEvents: 'none' }}>
      <EmptyDashboard/>
    </div>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(11,37,69,0.55)' }}/>
    {/* Modal */}
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 780,
        background: 'var(--paper)',
        border: '1px solid var(--rule-dark)',
        boxShadow: '0 40px 80px -20px rgba(0,0,0,0.4)',
        display: 'grid', gridTemplateColumns: '280px 1fr',
      }}>
        {/* Side rail — plan toggle */}
        <div style={{ background: 'var(--navy)', color: 'var(--parchment)', padding: '28px 24px', position: 'relative' }}>
          <div className="eyebrow on-navy" style={{ marginBottom: 12 }}>Select your plan</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ border: '1px solid rgba(247,243,236,0.3)', padding: 14, opacity: 0.55 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600 }}>Starter</span>
                <span className="num" style={{ fontSize: 13 }}>$49/mo</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(247,243,236,0.6)', marginTop: 3 }}>1k doors · 5 volunteers</div>
            </div>
            <div style={{ border: '1.5px solid var(--oxblood)', padding: 14, background: 'rgba(139,38,53,0.15)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -8, right: 10, background: 'var(--oxblood)', color: 'var(--parchment)', padding: '1px 6px', fontSize: 9, fontWeight: 600, letterSpacing: '0.1em' }}>SELECTED</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600 }}>Pro</span>
                <span className="num" style={{ fontSize: 13 }}>$199/mo</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(247,243,236,0.75)', marginTop: 3 }}>10k doors · 20 volunteers · all AI</div>
            </div>
          </div>

          <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(247,243,236,0.15)' }}>
            <div className="eyebrow on-navy" style={{ marginBottom: 10 }}>Billing</div>
            <div style={{ display: 'flex', border: '1px solid rgba(247,243,236,0.25)', fontSize: 12 }}>
              <button style={{ flex: 1, padding: '8px', background: 'transparent', color: 'rgba(247,243,236,0.6)', border: 'none', fontFamily: 'var(--sans)', cursor: 'pointer' }}>Monthly</button>
              <button style={{ flex: 1, padding: '8px', background: 'var(--parchment)', color: 'var(--navy)', border: 'none', fontFamily: 'var(--sans)', cursor: 'pointer', fontWeight: 600 }}>Annual · −17%</button>
            </div>
          </div>

          <div style={{ position: 'absolute', bottom: 24, left: 24, right: 24, fontSize: 11, color: 'rgba(247,243,236,0.5)' }}>
            Your 14-day trial continues.<br/>First charge: <strong style={{color:'var(--parchment)'}}>May 3, 2026</strong>.
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: '28px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ fontSize: 22 }}>One more step.</h3>
            <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'var(--mute)', cursor: 'pointer', padding: 4 }}>
              <Icon.x style={{ width: 18, height: 18 }}/>
            </button>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--mute)', marginBottom: 22 }}>
            Import voter files, generate walkbooks, invite your full team — all unlocked as soon as your card is on file.
          </p>

          <div className="field">
            <label className="field-label">Card</label>
            <StripeCardInput/>
          </div>
          <div className="field">
            <label className="field-label">Name & ZIP</label>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
              <input className="input" defaultValue="James E. Sprouse"/>
              <input className="input num" defaultValue="29401"/>
            </div>
          </div>

          <button className="btn btn-oxblood btn-lg" style={{ width: '100%', marginTop: 8 }} onClick={onPay}>
            Unlock Pro — $0 today
          </button>

          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--mute)' }}>
            <span><Icon.shield className="ic" style={{color:'var(--navy)',verticalAlign:'-3px'}}/> Stripe-secured</span>
            <span>30-day money-back · cancel in 1 click</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Paywall picker — switches between A / B / C
const Paywall = ({ variant = 'A', onBack, onPay }) => {
  if (variant === 'B') return <PaywallB onBack={onBack} onPay={onPay}/>;
  if (variant === 'C') return <PaywallC onBack={onBack} onPay={onPay}/>;
  return <PaywallA onBack={onBack} onPay={onPay}/>;
};

// Mobile paywall
const PaywallMobile = () => (
  <div style={{ padding: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 20px' }}>
      <CampaignOSMark size={18} color="var(--navy)"/>
      <span style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 600 }}>Campaign OS</span>
    </div>
    <div className="eyebrow oxblood" style={{ fontSize: 10 }}>Activate plan</div>
    <h2 style={{ fontSize: 20, marginTop: 4, marginBottom: 6 }}>Start your Pro plan.</h2>
    <p style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 14 }}>First charge May 3, 2026.</p>
    <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', padding: 12, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 14 }}>Pro · Annual</span>
        <span className="num" style={{ fontSize: 15, fontWeight: 600 }}>$1,990/yr</span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--oxblood)', marginTop: 2 }}>saves $398</div>
    </div>
    <label className="field-label">Card</label>
    <StripeCardInput/>
    <div style={{ height: 10 }}/>
    <input className="input" defaultValue="James E. Sprouse" style={{ marginBottom: 8 }}/>
    <input className="input num" defaultValue="29401" style={{ marginBottom: 14 }}/>
    <button className="btn btn-primary" style={{ width: '100%' }}>
      <Icon.lock className="ic"/> Confirm · $0 today
    </button>
    <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--mute)' }}>
      <a href="#">Not right now</a>
    </div>
  </div>
);

Object.assign(window, { PaywallA, PaywallB, PaywallC, Paywall, PaywallMobile });
