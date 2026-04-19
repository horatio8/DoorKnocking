// TRIAL EMAIL TEMPLATES (visual)

const EmailTpl = ({ day, subject, kicker, headline, body, cta, footer }) => (
  <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', width: '100%', overflow: 'hidden' }}>
    <div style={{ background: 'var(--parchment-2)', padding: '8px 16px', fontSize: 11, color: 'var(--mute)', borderBottom: '1px solid var(--rule-2)', display: 'flex', justifyContent: 'space-between' }}>
      <span><strong>Campaign OS</strong> &lt;hello@campaignos.com&gt;</span>
      <span className="num">DAY {day}</span>
    </div>
    <div style={{ padding: '6px 16px', fontSize: 13, borderBottom: '1px solid var(--rule-2)' }}>
      <strong>Subject:</strong> {subject}
    </div>
    <div style={{ padding: '28px 28px 24px', background: 'var(--paper)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        <CampaignOSMark size={18} color="var(--navy)" />
        <span style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>Campaign OS</span>
      </div>
      <div className="eyebrow oxblood" style={{ marginBottom: 8 }}>{kicker}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)', lineHeight: 1.2, marginBottom: 14 }}>{headline}</div>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 18 }}>{body}</div>
      <button className="btn btn-primary btn-sm" style={{ pointerEvents: 'none' }}>{cta} →</button>
      <div style={{ marginTop: 22, paddingTop: 14, borderTop: '1px solid var(--rule-2)', fontSize: 11, color: 'var(--mute)' }}>{footer}</div>
    </div>
  </div>
);

const EmailsPage = () => (
  <div style={{ padding: '32px', background: 'var(--paper)' }}>
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div className="eyebrow oxblood" style={{ marginBottom: 8 }}>§9.1 · Trial cadence via Resend</div>
        <h2 style={{ fontSize: 30 }}>Six emails over fourteen days.</h2>
        <p style={{ fontSize: 14, color: 'var(--mute)', maxWidth: 520, margin: '12px auto 0' }}>
          Each email is short, serif-led, and carries a single CTA. No emoji, no stock photos. The language escalates from welcome → nudge → urgency.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        <EmailTpl day="0" subject="Welcome to Campaign OS — here's your quick start" kicker="Welcome"
          headline="Fourteen days. One district. Your move."
          body="You're set up for Sprouse for SC 115. Three things to do first: import your voter file (CSV or Airtable), generate a sample walkbook, and invite your first two volunteers."
          cta="Open the quick-start guide"
          footer="You're on a 14-day free trial. No card required until day 14."
        />
        <EmailTpl day="3" subject="Your first walkbook is waiting" kicker="Activation"
          headline="The product gets good at the second walkbook."
          body="You haven't generated a walkbook yet. Here's one we built from your district — takes 30 seconds to preview. Customize branding, turf cuts, and volunteer assignments from there."
          cta="Preview my walkbook"
          footer="You'll stop receiving activation emails once you generate your first walkbook."
        />
        <EmailTpl day="7" subject="Halfway through your trial" kicker="Mid-trial"
          headline="A week in. How's it feeling?"
          body="You've imported 94 voters and generated 2 walkbooks. At this pace you'll hit your trial cap (100 voters) in about 36 hours. Add a card now and nothing gets interrupted — we won't charge until day 14."
          cta="Add a card to continue"
          footer="Questions? Reply to this email — a real person reads every response."
        />
        <EmailTpl day="12" subject="Your trial ends in 2 days" kicker="Conversion"
          headline="Two days left."
          body="Your Pro trial ends Thursday at 11:59 PM Eastern. After that, walkbook generation, new imports, and knock sessions are locked until you activate a plan. Your data stays put."
          cta="Activate Pro — $199/mo"
          footer="Need more time? Reply and we'll extend your trial once, no sales call required."
        />
        <EmailTpl day="13" subject="Don't lose your data" kicker="Final urgency"
          headline="Tomorrow your account goes read-only."
          body="We're not going to keep nagging you. After tomorrow, you can still view and export your 94 voters, 2 walkbooks, and 38 knock events for 30 days. To keep canvassing live, add a card before midnight."
          cta="Add a card now"
          footer="Export everything to CSV anytime from Settings → Export."
        />
        <EmailTpl day="14" subject="Your trial has ended" kicker="Read-only"
          headline="Your trial has ended — your data is safe."
          body="No card on file yet, so your account is now read-only. You have 30 days to activate a plan before the data is archived, and 90 days before final deletion. Need an extension? Just ask."
          cta="Activate a plan"
          footer="This is the last email you'll receive unless you reply or reactivate."
        />
      </div>
    </div>
  </div>
);

Object.assign(window, { EmailsPage });
