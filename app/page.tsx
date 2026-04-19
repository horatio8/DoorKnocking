import type { Metadata } from "next";
import { TopBar } from "@/components/home/top-bar";
import { Hero } from "@/components/home/hero";
import { TrustStrip } from "@/components/home/trust-strip";
import { HowItWorks } from "@/components/home/how-it-works";
import { FeatureWalkbooks } from "@/components/home/feature-walkbooks";
import { FeatureAI } from "@/components/home/feature-ai";
import { PricingTeaser } from "@/components/home/pricing-teaser";
import { Testimonial } from "@/components/home/testimonial";
import { FAQ } from "@/components/home/faq";
import { FinalCTA } from "@/components/home/final-cta";
import { HomeFooter } from "@/components/home/footer";

const DESCRIPTION =
  "District-agnostic field operations for professional campaign teams. Import a voter file, cut turf, print walkbooks, knock, listen, record — all in one place.";

export const metadata: Metadata = {
  title: "Knock — Door-knock software for serious campaigns",
  description: DESCRIPTION,
  openGraph: {
    title: "Knock — Door-knock software for serious campaigns",
    description: DESCRIPTION,
    type: "website",
    images: [{ url: "/og/home", width: 1200, height: 630, alt: "Knock — Campaign OS" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Knock — Door-knock software for serious campaigns",
    description: DESCRIPTION,
    images: ["/og/home"],
  },
};

// Marketing homepage at /. Per handoff §8: authenticated users still see this
// page — no auto-redirect to /app.

export default function HomePage() {
  return (
    <div className="scroll-smooth bg-paper font-sans text-ink antialiased">
      <TopBar />
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <FeatureWalkbooks />
      <FeatureAI />
      <PricingTeaser />
      <Testimonial />
      <FAQ />
      <FinalCTA />
      <HomeFooter />
    </div>
  );
}
