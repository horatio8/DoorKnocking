import { redirect } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { WalkFromHere } from "@/components/knocker/walk-from-here";

export const dynamic = "force-dynamic";

export default async function DynamicWalkbookPage() {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (!session.district) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
        No district assigned to your account. Ask your admin.
      </div>
    );
  }
  return <WalkFromHere districtId={session.district.id} />;
}
