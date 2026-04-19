import { requireOnboardedKnocker } from "@/lib/auth/onboarding";
import { BrowseWalkbooks } from "@/components/knocker/browse-walkbooks";

export const dynamic = "force-dynamic";

export default async function BrowseWalkbooksPage() {
  const session = await requireOnboardedKnocker();
  if (!session.district) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
        No district assigned to your account. Ask your admin.
      </div>
    );
  }
  return <BrowseWalkbooks districtId={session.district.id} />;
}
