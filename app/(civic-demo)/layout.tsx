// Civic-demo route group — admin/paywall/billing previews from the
// onboarding handoff. Bare shell so each preview can render its own sidebar
// or modal without a masthead fighting the layout.
export default function CivicDemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper font-sans text-ink antialiased">{children}</div>
  );
}
