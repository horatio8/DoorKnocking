// SIGNUP + EMAIL VERIFICATION + CHECK-YOUR-EMAIL

const SignupPage = ({ plan, onCreated, onNavLogin }) => {
  const [tos, setTos] = useState(false);
  const [email, setEmail] = useState('james@teller.co');
  const [pw, setPw] = useState('••••••••••');
  return (
    <div style={{ minHeight: 600, background: 'var(--paper)', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      {/* Left: form */}
      <div style={{ padding: '64px 56px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ maxWidth: 420, width: '100%', margin: '0 auto' }}>
          <a href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 36 }}>
            <CampaignOSMark size={22} color="var(--navy)" />
            <span style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, color: 'var(--navy)' }}>Campaign OS</span>
          </a>
          <div className="eyebrow oxblood" style={{ marginBottom: 10 }}>Begin — Step 1 of 4</div>
          <h1 style={{ fontSize: 34, marginBottom: 10 }}>Start your {plan?.name || 'Pro'} plan.</h1>
          <p style={{ color: 'var(--ink-2)', marginBottom: 28, fontSize: 15 }}>
            14-day free trial — no card needed until day 14. Cancel in one click.
          </p>

          <form onSubmit={(e)=>{e.preventDefault(); onCreated && onCreated({ email });}}>
            <div className="field">
              <label className="field-label">Email address</label>
              <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@campaign.com" />
            </div>
            <div className="field">
              <label className="field-label">Password</label>
              <input className="input" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="8+ characters" />
              <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 6 }}>Must contain a letter, number, and special character.</div>
            </div>
            <label className="check" style={{ margin: '8px 0 20px' }}>
              <input type="checkbox" checked={tos} onChange={e=>setTos(e.target.checked)} />
              <span>I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.</span>
            </label>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={!tos}>
              Create my account <Icon.arrow className="ic"/>
            </button>
            <div style={{ marginTop: 20, fontSize: 13, color: 'var(--mute)', textAlign: 'center' }}>
              Already have an account? <a href="#" onClick={(e)=>{e.preventDefault(); onNavLogin&&onNavLogin();}}>Log in</a>
            </div>
          </form>

          <div style={{ marginTop: 36, paddingTop: 20, borderTop: '1px solid var(--rule-2)', display: 'flex', gap: 18, fontSize: 11, color: 'var(--mute)' }}>
            <span><Icon.shield className="ic" style={{color:'var(--navy)', verticalAlign:'-3px'}}/> SOC 2 Type II</span>
            <span><Icon.lock className="ic" style={{color:'var(--navy)', verticalAlign:'-3px'}}/> Encrypted at rest</span>
            <span><Icon.flag className="ic" style={{color:'var(--navy)', verticalAlign:'-3px'}}/> US-hosted</span>
          </div>
        </div>
      </div>

      {/* Right: testimonial / broadside */}
      <div style={{ background: 'var(--navy)', color: 'var(--parchment)', padding: '64px 56px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 24, right: 24, fontSize: 10, letterSpacing: '0.2em', color: 'rgba(247,243,236,0.4)' }}>
          VOL. I · NO. 47
        </div>
        <div style={{ maxWidth: 440 }}>
          <div className="stars" style={{ color: 'var(--oxblood)', fontSize: 14, letterSpacing: '0.4em', marginBottom: 24 }}>★ ★ ★ ★ ★</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 28, lineHeight: 1.25, letterSpacing: '-0.01em', marginBottom: 28 }}>
            “We knocked <span style={{color:'var(--oxblood)'}}>11,400 doors</span> in six weeks with eleven volunteers. Nothing we'd used before came close.”
          </div>
          <div style={{ borderTop: '1px solid rgba(247,243,236,0.2)', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--parchment)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 16 }}>MH</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Marcus Hallman</div>
              <div style={{ fontSize: 12, color: 'rgba(247,243,236,0.6)' }}>Campaign Manager · Pritchett for SC Senate</div>
            </div>
          </div>

          <div style={{ marginTop: 64, paddingTop: 24, borderTop: '1px solid rgba(247,243,236,0.15)' }}>
            <div className="eyebrow on-navy" style={{ marginBottom: 14 }}>What you'll get</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12, fontSize: 14 }}>
              {[
                'Unlimited knock events across your full trial',
                'Import up to 100 voters without a card',
                'Cloned walkbooks with custom branding',
                'Real-time sync with your Airtable base',
              ].map(x => (
                <li key={x} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Icon.check className="ic" style={{ color: 'var(--oxblood)', flexShrink: 0, marginTop: 2 }}/>
                  <span style={{ color: 'rgba(247,243,236,0.9)' }}>{x}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const CheckEmailPage = ({ email, onVerified }) => {
  return (
    <div style={{ padding: '80px 32px', background: 'var(--paper)', minHeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, border: '1.5px solid var(--navy)', borderRadius: '50%', position: 'relative', marginBottom: 24 }}>
          <Icon.mail style={{ width: 28, height: 28, color: 'var(--navy)' }}/>
          <div style={{ position: 'absolute', inset: 5, border: '1px solid var(--navy)', borderRadius: '50%' }}/>
        </div>
        <div className="eyebrow oxblood" style={{ marginBottom: 10 }}>Step 2 of 4 — Verify</div>
        <h1 style={{ fontSize: 32, marginBottom: 12 }}>Check your email.</h1>
        <p style={{ color: 'var(--ink-2)', fontSize: 15.5, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
          We sent a verification link to <strong style={{ color: 'var(--navy)', fontFamily: 'var(--mono)', fontSize: 14 }}>{email || 'james@teller.co'}</strong>. Click it to continue.
        </p>

        <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', padding: 20, textAlign: 'left', marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Preview of email you'll receive</div>
          <div style={{ background: 'var(--white)', border: '1px solid var(--rule-2)', padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 4 }}>From: Campaign OS &lt;no-reply@campaignos.com&gt;</div>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, marginBottom: 10 }}>Verify your email to start canvassing</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 14 }}>Hi James — tap the button below to verify this email and activate your Campaign OS account.</div>
            <button className="btn btn-primary btn-sm" style={{ pointerEvents: 'none' }}>Verify email →</button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, fontSize: 13 }}>
          <a href="#" onClick={(e)=>{e.preventDefault(); onVerified && onVerified();}}>
            → Simulate verification (prototype)
          </a>
          <a href="#">Resend email</a>
        </div>
        <div style={{ marginTop: 40, fontSize: 12, color: 'var(--mute)' }}>
          Didn't receive? Check spam, or <a href="#">contact support</a>.
        </div>
      </div>
    </div>
  );
};

const SignupMobile = ({ onCreated }) => (
  <div style={{ padding: 20 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', margin: '20px 0 28px' }}>
      <CampaignOSMark size={20} color="var(--navy)" />
      <span style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600 }}>Campaign OS</span>
    </div>
    <div className="eyebrow oxblood" style={{ marginBottom: 6 }}>Step 1 of 4</div>
    <h2 style={{ fontSize: 22, marginBottom: 4 }}>Start your Pro plan.</h2>
    <p style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 20 }}>14-day free trial. No card.</p>
    <div className="field"><label className="field-label">Email</label><input className="input" defaultValue="james@teller.co"/></div>
    <div className="field"><label className="field-label">Password</label><input className="input" type="password" defaultValue="••••••••"/></div>
    <label className="check" style={{ margin: '4px 0 16px', fontSize: 12 }}>
      <input type="checkbox" defaultChecked/>
      <span>I agree to Terms + Privacy</span>
    </label>
    <button className="btn btn-primary" style={{ width: '100%' }} onClick={onCreated}>Create account →</button>
  </div>
);

Object.assign(window, { SignupPage, CheckEmailPage, SignupMobile });
