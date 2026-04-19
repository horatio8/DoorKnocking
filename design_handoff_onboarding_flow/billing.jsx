// BILLING MANAGEMENT PAGE

const BillingPage = () => (
  <AdminShell active="Billing" banner={null} planBadge="PRO · ACTIVE">
    <div style={{ marginBottom: 24 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>Settings</div>
      <h2 style={{ fontSize: 28 }}>Billing & Plan</h2>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 20 }}>
      {/* Current plan */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div className="eyebrow oxblood" style={{ marginBottom: 6 }}>Current plan</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, color: 'var(--navy)' }}>Pro — Annual</div>
            <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 2 }}>Sprouse for SC 115 · client subscription</div>
          </div>
          <span className="badge green"><span className="dot"/>ACTIVE</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, padding: '16px 0', borderTop: '1px solid var(--rule-2)', borderBottom: '1px solid var(--rule-2)' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Price</div>
            <div className="num" style={{ fontSize: 18, fontWeight: 600 }}>$1,990<span style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 400 }}>/yr</span></div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Next charge</div>
            <div className="num" style={{ fontSize: 14, fontWeight: 600 }}>May 3, 2027</div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Started</div>
            <div className="num" style={{ fontSize: 14, fontWeight: 600 }}>May 3, 2026</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-primary btn-sm">Change plan</button>
          <button className="btn btn-ghost btn-sm">Open Stripe portal ↗</button>
          <button className="btn btn-link btn-sm" style={{ marginLeft: 'auto', color: 'var(--mute)' }}>Cancel subscription</button>
        </div>
      </div>

      {/* Payment method */}
      <div className="card" style={{ padding: 24 }}>
        <div className="eyebrow oxblood" style={{ marginBottom: 6 }}>Payment method</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0' }}>
          <div style={{ width: 44, height: 30, border: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--navy)' }}>VISA</div>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500 }}>•••• •••• •••• 4242</div>
            <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>Expires 05/29 · James E. Sprouse</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ width: '100%' }}>Update payment method</button>

        <hr className="rule" style={{ margin: '16px 0' }}/>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Billing email</div>
        <div style={{ fontSize: 13, fontFamily: 'var(--mono)' }}>james@teller.co</div>
      </div>
    </div>

    {/* Usage meters */}
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
        <div>
          <div className="eyebrow oxblood">Usage this period</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)', marginTop: 4 }}>May 3 – June 3, 2026</div>
        </div>
        <button className="btn btn-ghost btn-sm">View full history →</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
        {[
          { l: 'Doors imported', n: 6480, c: 10000, u: '' },
          { l: 'Active volunteers', n: 14, c: 20, u: '' },
          { l: 'Voice minutes', n: 812.4, c: 1000, u: 'min' },
          { l: 'AI calls', n: 2410, c: 10000, u: '' },
        ].map(m => {
          const p = Math.min(100, (m.n / m.c) * 100);
          const warn = p > 80;
          return (
            <div key={m.l}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>{m.l}</div>
              <div style={{ display: 'baseline', fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: warn ? 'var(--oxblood)' : 'var(--navy)' }} className="num">
                {m.n.toLocaleString()}<span style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 400 }}> / {m.c.toLocaleString()}{m.u && ' ' + m.u}</span>
              </div>
              <div className="progress" style={{ marginTop: 8 }}>
                <span style={{ width: p + '%', background: warn ? 'var(--oxblood)' : 'var(--navy)' }}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Invoices */}
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--rule-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="eyebrow oxblood">Invoices</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, marginTop: 4 }}>Billing history</div>
        </div>
        <button className="btn btn-ghost btn-sm">Open in Stripe ↗</button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th style={{ paddingLeft: 24 }}>Invoice</th>
            <th>Date</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {[
            ['INV-0043', 'May 3, 2026', 'Pro · Annual', '$1,990.00', 'paid'],
            ['INV-0042', 'May 3, 2026', 'Trial started', '$0.00', 'paid'],
          ].map(r => (
            <tr key={r[0]}>
              <td style={{ paddingLeft: 24 }} className="num">{r[0]}</td>
              <td>{r[1]}</td>
              <td>{r[2]}</td>
              <td className="num" style={{ fontWeight: 600 }}>{r[3]}</td>
              <td><span className="badge green"><span className="dot"/>{r[4].toUpperCase()}</span></td>
              <td style={{ textAlign: 'right', paddingRight: 24 }}>
                <a href="#" style={{ fontSize: 12 }}><Icon.download className="ic" style={{ verticalAlign: '-3px' }}/> PDF</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </AdminShell>
);

Object.assign(window, { BillingPage });
