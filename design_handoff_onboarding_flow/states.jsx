// EDGE-CASE STATES: trial-ended (read-only), dunning (payment failed)

const TrialEndedBanner = () => (
  <div style={{
    background: 'var(--oxblood)', color: 'var(--parchment)',
    padding: '10px 24px', fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
    borderBottom: '1px solid var(--oxblood-2)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Icon.warn className="ic" style={{ color: 'var(--parchment)' }}/>
      <span>
        <strong>Your trial has ended.</strong> Your account is in read-only mode. Add a card to continue canvassing, or export your data within the next <span className="num">27 days</span>.
      </span>
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <button className="btn btn-sm" style={{ background: 'var(--parchment)', color: 'var(--oxblood)', fontWeight: 600 }}>Add a card</button>
      <button className="btn btn-sm" style={{ background: 'transparent', color: 'var(--parchment)', border: '1px solid rgba(247,243,236,0.4)' }}>Export data</button>
    </div>
  </div>
);

const TrialEndedView = () => (
  <AdminShell active="Voters" banner={<TrialEndedBanner/>} planBadge="TRIAL · ENDED">
    <div style={{ marginBottom: 20 }}>
      <div className="eyebrow" style={{ marginBottom: 4, color: 'var(--oxblood)' }}>Read-only mode</div>
      <h2 style={{ fontSize: 28 }}>Voter roll · <span className="num" style={{ color: 'var(--mute)', fontWeight: 400 }}>94 voters</span></h2>
    </div>
    <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', padding: 16, marginBottom: 16, fontSize: 13.5, color: 'var(--ink-2)', display: 'flex', gap: 12 }}>
      <Icon.lock className="ic" style={{ color: 'var(--oxblood)', marginTop: 2 }}/>
      <div>
        <strong>What's locked:</strong> new imports, walkbook generation, knock sessions, new volunteer invites, Airtable sync writes.<br/>
        <strong>What's still live:</strong> viewing data, exporting CSVs, billing changes, support chat.
      </div>
    </div>
    <table className="table" style={{ background: 'var(--white)', border: '1px solid var(--rule)' }}>
      <thead>
        <tr>
          <th style={{ paddingLeft: 20 }}>Name</th>
          <th>Address</th>
          <th>Party</th>
          <th>Turf</th>
          <th>Last knock</th>
        </tr>
      </thead>
      <tbody>
        {[
          ['Ashford, Margaret H.', '127 Queen St, Charleston', 'R', 'Turf 3 — North', '—'],
          ['Beauchamp, Everett L.', '219 Meeting St, Charleston', 'I', 'Turf 3 — North', 'Apr 11'],
          ['Crawford, Henrietta', '44 Broad St, Charleston', 'D', 'Turf 1 — Waterfront', '—'],
          ['Dennison, Robert W. III', '2 King St, Charleston', 'R', 'Turf 1 — Waterfront', 'Apr 09'],
          ['Ellington, Margaret', '81 Tradd St, Charleston', 'R', 'Turf 2 — Historic', '—'],
        ].map((r, i) => (
          <tr key={i} style={{ opacity: 0.75 }}>
            <td style={{ paddingLeft: 20, fontFamily: 'var(--serif)', fontWeight: 600 }}>{r[0]}</td>
            <td className="num" style={{ fontSize: 12 }}>{r[1]}</td>
            <td><span className="badge" style={{ color: r[2]==='R'?'var(--oxblood)':r[2]==='D'?'var(--navy)':'var(--mute)' }}>{r[2]}</span></td>
            <td style={{ fontSize: 12 }}>{r[3]}</td>
            <td className="num" style={{ fontSize: 12, color: 'var(--mute)' }}>{r[4]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </AdminShell>
);

const DunningBanner = () => (
  <div style={{
    background: '#FBF3D9', color: 'var(--ink)',
    padding: '10px 24px', fontSize: 13,
    borderBottom: '1px solid #DBC789',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Icon.warn className="ic" style={{ color: 'var(--amber)' }}/>
      <span>
        <strong>Payment failed on May 3 — your card was declined.</strong> We'll retry on May 5. Until then you can keep working.
      </span>
    </div>
    <button className="btn btn-oxblood btn-sm">Update card →</button>
  </div>
);

const DunningView = () => (
  <AdminShell active="Billing" banner={<DunningBanner/>} planBadge="PRO · PAST DUE">
    <div style={{ marginBottom: 24 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>Settings</div>
      <h2 style={{ fontSize: 28 }}>Billing & Plan</h2>
    </div>

    <div className="card" style={{ padding: 24, marginBottom: 20, borderColor: 'var(--amber)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6, color: 'var(--amber)' }}>Payment issue</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)' }}>We couldn't charge your card.</div>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 8, maxWidth: 560 }}>
            Stripe reported <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, background: 'var(--parchment)', padding: '1px 5px' }}>card_declined: insufficient_funds</span>. We'll retry automatically on <strong>May 5</strong> and <strong>May 8</strong>. After May 17 your account moves to read-only.
          </p>
        </div>
        <span className="badge amber"><span className="dot"/>PAST DUE</span>
      </div>

      <hr className="rule" style={{ margin: '14px 0' }}/>

      <div className="eyebrow" style={{ marginBottom: 12 }}>Retry schedule</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { d: 'May 3', s: 'Failed', ok: false, done: true },
          { d: 'May 5', s: 'Retry #1', ok: null, done: false, next: true },
          { d: 'May 8', s: 'Retry #2', ok: null, done: false },
        ].map((r, i) => (
          <div key={i} style={{
            padding: '12px 14px',
            background: r.next ? 'var(--parchment)' : 'var(--white)',
            border: '1px solid ' + (r.next ? 'var(--navy)' : 'var(--rule)'),
          }}>
            <div className="num" style={{ fontSize: 11, color: 'var(--mute)', letterSpacing: '0.08em' }}>{r.d.toUpperCase()}</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 600, marginTop: 2 }}>{r.s}</div>
            <div style={{ fontSize: 11, color: r.done ? 'var(--oxblood)' : r.next ? 'var(--navy)' : 'var(--mute)', marginTop: 2 }}>
              {r.done ? '✕ Declined' : r.next ? 'Scheduled' : 'Pending'}
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-oxblood">Update payment method →</button>
      <button className="btn btn-link" style={{ marginLeft: 8 }}>Contact support</button>
    </div>

    <div className="card" style={{ padding: 20 }}>
      <div className="eyebrow oxblood" style={{ marginBottom: 6 }}>Recent activity</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10, fontSize: 13 }}>
        {[
          ['May 3 · 09:12', 'invoice.payment_failed', 'card_declined: insufficient_funds'],
          ['May 3 · 09:12', 'Email sent — "Your payment failed"', 'james@teller.co'],
          ['May 3 · 09:12', 'subscription.status = past_due', 'automatic'],
        ].map((r, i) => (
          <li key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr', gap: 12, padding: '8px 0', borderBottom: '1px dashed var(--rule-2)' }}>
            <span className="num" style={{ fontSize: 11, color: 'var(--mute)' }}>{r[0]}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>{r[1]}</span>
            <span style={{ color: 'var(--mute)', fontSize: 12 }}>{r[2]}</span>
          </li>
        ))}
      </ul>
    </div>
  </AdminShell>
);

Object.assign(window, { TrialEndedView, DunningView });
