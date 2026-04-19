// INTERNAL FUNNEL METRICS DASHBOARD

const Spark = ({ data, color = 'var(--navy)', w = 120, h = 36 }) => {
  const max = Math.max(...data);
  const pts = data.map((v, i) => `${(i/(data.length-1))*w},${h - (v/max)*h*0.9 - 2}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.3"/>
    </svg>
  );
};

const FunnelPage = () => {
  const steps = [
    { l: 'Pricing page viewed', n: 8421, pct: 100 },
    { l: 'Signup started', n: 1247, pct: 14.8, target: 8 },
    { l: 'Email verified', n: 1128, pct: 90.5, target: 85 },
    { l: 'Wizard step 1', n: 1092, pct: 96.8 },
    { l: 'Wizard step 2', n: 1041, pct: 95.3 },
    { l: 'Wizard complete', n: 984, pct: 94.5, target: 90 },
    { l: 'Paywall viewed', n: 712, pct: 72.4, target: 60 },
    { l: 'Card captured', n: 327, pct: 45.9, target: 40 },
    { l: 'First voter imported', n: 281, pct: 85.9 },
  ];

  return (
    <div style={{ background: 'var(--paper)', minHeight: 600 }}>
      {/* Internal banner */}
      <div style={{ background: 'var(--ink)', color: 'var(--parchment)', padding: '10px 24px', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
        <span><span className="num" style={{ color: 'var(--oxblood)', letterSpacing: '0.1em' }}>● INTERNAL</span> &nbsp;&nbsp; /admin/internal/signup-funnel &nbsp;·&nbsp; teller.co employees only</span>
        <span className="num" style={{ color: 'rgba(247,243,236,0.5)' }}>Last updated 2m ago · Auto-refresh 15m</span>
      </div>

      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
          <div>
            <div className="eyebrow oxblood" style={{ marginBottom: 4 }}>Growth · Signup funnel</div>
            <h2 style={{ fontSize: 28 }}>Self-serve conversion, last 30 days</h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="select" style={{ width: 180, fontSize: 13 }}>
              <option>Last 30 days</option>
              <option>Last 7 days</option>
              <option>This quarter</option>
            </select>
            <button className="btn btn-ghost btn-sm">Export CSV</button>
          </div>
        </div>

        {/* Headline KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { l: 'New paying customers', n: '327', d: '+18% vs prev', ok: true, spark: [2,5,3,6,4,8,7,9,11,12,14,18] },
            { l: 'Trial → paid conversion', n: '33.2%', d: 'target 25%', ok: true, spark: [22,25,28,26,30,31,29,32,33,33] },
            { l: 'Median time to paid', n: '11m 42s', d: 'target <15m', ok: true, spark: [18,17,15,14,13,12,12,11,11,11] },
            { l: 'Paywall skip rate', n: '54.1%', d: 'retarget @ d7/d12', ok: null, spark: [52,54,55,53,54,54,54] },
          ].map(k => (
            <div key={k.l} className="card" style={{ padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>{k.l}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div className="num" style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, color: 'var(--navy)' }}>{k.n}</div>
                <Spark data={k.spark} color={k.ok === true ? 'var(--navy)' : 'var(--oxblood)'} w={70} h={26}/>
              </div>
              <div style={{ fontSize: 11, color: k.ok ? 'var(--green)' : 'var(--mute)', marginTop: 4 }}>{k.d}</div>
            </div>
          ))}
        </div>

        {/* Funnel */}
        <div className="card" style={{ padding: 0, marginBottom: 24 }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--rule-2)' }}>
            <div className="eyebrow oxblood">§ 3 · Funnel drop-off</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, marginTop: 4 }}>Every step from landing to imported voters</div>
          </div>
          <div style={{ padding: '20px 24px' }}>
            {steps.map((s, i) => {
              const width = (s.n / steps[0].n) * 100;
              const stepPct = i > 0 ? (s.n / steps[i-1].n) * 100 : 100;
              const meetsTarget = s.target ? stepPct >= s.target : null;
              return (
                <div key={s.l} style={{ display: 'grid', gridTemplateColumns: '220px 1fr 90px 90px 110px', alignItems: 'center', gap: 16, padding: '10px 0', borderBottom: i < steps.length-1 ? '1px dashed var(--rule-2)' : 'none' }}>
                  <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="num" style={{ fontSize: 10, color: 'var(--mute)', letterSpacing: '0.1em' }}>{String(i+1).padStart(2,'0')}</span>
                    {s.l}
                  </div>
                  <div style={{ height: 22, background: 'var(--parchment)', position: 'relative' }}>
                    <div style={{
                      height: '100%',
                      width: width + '%',
                      background: i === 0 ? 'var(--navy-3)' :
                                  meetsTarget === false ? 'var(--oxblood)' :
                                  'var(--navy)',
                    }}/>
                  </div>
                  <div className="num" style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{s.n.toLocaleString()}</div>
                  <div className="num" style={{ fontSize: 12, color: 'var(--mute)', textAlign: 'right' }}>
                    {i > 0 ? stepPct.toFixed(1) + '%' : '100%'}
                  </div>
                  <div style={{ fontSize: 10, textAlign: 'right' }}>
                    {s.target && (
                      <span style={{ color: meetsTarget ? 'var(--green)' : 'var(--oxblood)', letterSpacing: '0.08em', fontWeight: 600 }}>
                        {meetsTarget ? '✓' : '✕'} TGT {s.target}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* UTM breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule-2)' }}>
              <div className="eyebrow oxblood">By acquisition source</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, marginTop: 2 }}>Top channels · 30 days</div>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 20 }}>UTM source</th>
                  <th>Pricing views</th>
                  <th>Signups</th>
                  <th>Paid</th>
                  <th>CVR</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['organic', 3120, 441, 127, '4.1%'],
                  ['twitter', 1842, 312, 84, '4.6%'],
                  ['newsletter/punchbowl', 1204, 198, 61, '5.1%'],
                  ['referral', 892, 161, 38, '4.3%'],
                  ['google/cpc', 743, 92, 12, '1.6%'],
                ].map(r => (
                  <tr key={r[0]}>
                    <td style={{ paddingLeft: 20, fontFamily: 'var(--mono)', fontSize: 12 }}>{r[0]}</td>
                    <td className="num">{r[1].toLocaleString()}</td>
                    <td className="num">{r[2]}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{r[3]}</td>
                    <td className="num" style={{ color: parseFloat(r[4]) >= 4 ? 'var(--green)' : 'var(--oxblood)' }}>{r[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div className="eyebrow oxblood" style={{ marginBottom: 6 }}>Friction flags</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Things worth looking at</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10, fontSize: 13 }}>
              {[
                { c: 'oxblood', t: 'Google CPC converting at 1.6%', d: 'Half of the site average. Check landing-page copy.' },
                { c: 'amber', t: 'Paywall skip = 54% on annual', d: 'Monthly default may help; test this week.' },
                { c: 'mute', t: '12 enterprise prospects auto-routed', d: 'F500 domains redirected to sales calendar.' },
              ].map((f, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--paper)', border: '1px solid var(--rule-2)' }}>
                  <span className={'badge ' + f.c}><span className="dot"/></span>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{f.t}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 2 }}>{f.d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { FunnelPage });
