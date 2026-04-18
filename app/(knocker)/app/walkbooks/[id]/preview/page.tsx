import { redirect, notFound } from "next/navigation";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PreviewWalkbook } from "@/components/knocker/preview-walkbook";

export const dynamic = "force-dynamic";

export default async function WalkbookPreviewPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await loadSession();
  if (!session) redirect("/login");

  const supabase = getSupabaseServerClient();
  const { data: wb } = await supabase
    .from("walkbooks")
    .select(
      "id, name, description, household_count, estimated_duration_minutes, target_duration_minutes, centroid_lat, centroid_lng, bounding_box, kind",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!wb) notFound();

  return (
    <PreviewWalkbook
      walkbook={{
        id: wb.id as string,
        name: wb.name as string,
        description: (wb.description as string | null) ?? "",
        household_count: wb.household_count as number,
        estimated_duration_minutes: (wb.estimated_duration_minutes as number | null) ?? null,
        centroid: {
          lat: (wb.centroid_lat as number | null) ?? null,
          lng: (wb.centroid_lng as number | null) ?? null,
        },
      }}
    />
  );
}
