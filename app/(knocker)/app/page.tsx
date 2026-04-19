import { redirect } from "next/navigation";
import { requireOnboardedKnocker } from "@/lib/auth/onboarding";

export const dynamic = "force-dynamic";

export default async function AppIndex() {
  await requireOnboardedKnocker();
  redirect("/app/walkbooks/browse");
}
