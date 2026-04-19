import { Masthead } from "@/components/marketing/masthead";
import { SiteFooter } from "@/components/marketing/site-footer";

// Marketing route group shell — civic palette, full-bleed, masthead + footer.
// Sits outside the knocker data-shell, so the viewport-lock rules in
// globals.css don't apply here.

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper font-sans text-ink antialiased">
      <Masthead />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
