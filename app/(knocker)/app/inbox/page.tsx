import { requireOnboardedKnocker } from "@/lib/auth/onboarding";
import { Inbox } from "@/components/knocker/inbox";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const session = await requireOnboardedKnocker();
  return <Inbox userId={session.user.id} districtId={session.district?.id ?? null} />;
}
