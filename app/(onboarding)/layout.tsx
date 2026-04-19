// Onboarding route group — civic-palette shell, no masthead/footer. Each
// page (signup, verify, wizard steps) provides its own chrome per the
// handoff.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper font-sans text-ink antialiased">{children}</div>
  );
}
