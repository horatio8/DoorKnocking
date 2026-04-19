import type { Metadata } from "next";
import { VerifyView } from "@/components/marketing/verify-view";

export const metadata: Metadata = {
  title: "Check your email — Campaign OS",
};

export default function VerifyPage({
  searchParams,
}: {
  searchParams?: { email?: string };
}) {
  return <VerifyView email={searchParams?.email ?? "you@campaign.com"} />;
}
