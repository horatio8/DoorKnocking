import { redirect } from "next/navigation";
import { requireOnboardedKnocker } from "@/lib/auth/onboarding";

export const dynamic = "force-dynamic";

export default async function AppIndex() {
  await requireOnboardedKnocker();
  // Land on the map — the first thing a knocker should see is where they
  // can go today, with their assigned walkbooks highlighted.
  redirect("/app/map");
}
