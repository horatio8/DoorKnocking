import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadSession } from "@/lib/auth/session";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  WalkbookRouteMap,
  type RouteStop,
} from "@/components/admin/walkbook-route-map";
import { formatWalkbookName } from "@/lib/walkbooks/display-name";
import { WalkbookAttachments } from "@/components/admin/walkbook-attachments";

export const dynamic = "force-dynamic";

export default async function WalkbookDetail({ params }: { params: { id: string } }) {
  const session = await loadSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    redirect("/app");
  }
  const supabase = getSupabaseServiceRoleClient();

  const { data: walkbook } = await supabase
    .from("walkbooks")
    .select(
      "id, name, status, district_id, household_count, estimated_duration_minutes, target_duration_minutes, kind",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!walkbook) notFound();
  const wb = walkbook as {
    id: string;
    name: string;
    status: string;
    district_id: string;
    household_count: number;
    estimated_duration_minutes: number | null;
    target_duration_minutes: number | null;
    kind: string;
  };

  // Two-step fetch: walkbook_households then households (avoids the nested-
  // join bug that bites on the index page).
  const { data: stopRows } = await supabase
    .from("walkbook_households")
    .select("order_index, household_id")
    .eq("walkbook_id", params.id)
    .order("order_index");
  const ordered = (stopRows ?? []) as Array<{ order_index: number; household_id: string }>;
  const hhIds = ordered.map((r) => r.household_id);

  const { data: hhRows } = hhIds.length
    ? await supabase
        .from("households")
        .select("id, address_line1, city, status, lat, lng")
        .in("id", hhIds)
    : { data: [] as Array<{ id: string; address_line1: string; city: string | null; status: string; lat: number | null; lng: number | null }> };
  const hhById = new Map(
    ((hhRows ?? []) as Array<{
      id: string;
      address_line1: string;
      city: string | null;
      status: string;
      lat: number | null;
      lng: number | null;
    }>).map((h) => [h.id, h]),
  );

  const stops: RouteStop[] = ordered.flatMap((r) => {
    const h = hhById.get(r.household_id);
    if (!h || h.lat == null || h.lng == null) return [];
    return [
      {
        id: h.id,
        lat: Number(h.lat),
        lng: Number(h.lng),
        address: [h.address_line1, h.city].filter(Boolean).join(", "),
        status: h.status,
      },
    ];
  });

  // Available + currently attached surveys / scripts for this walkbook.
  // Include paused alongside active + draft — re-attaching a paused
  // survey is a common workflow and we don't want to force admins to
  // un-pause just to pick it. Archived stays excluded.
  const [availSurveys, availScripts, attachedSurveys, attachedScripts] = await Promise.all([
    supabase
      .from("surveys")
      .select("id, name, status")
      .eq("district_id", wb.district_id)
      .in("status", ["active", "draft", "paused"])
      .order("priority", { ascending: false }),
    supabase
      .from("scripts")
      .select("id, name, status")
      .eq("district_id", wb.district_id)
      .in("status", ["active", "draft", "paused"])
      .order("priority", { ascending: false }),
    supabase
      .from("walkbook_surveys")
      .select("survey_id, pinned")
      .eq("walkbook_id", params.id),
    supabase
      .from("walkbook_scripts")
      .select("script_id, pinned")
      .eq("walkbook_id", params.id),
  ]);

  // Detect the "migration 20260419000005 hasn't run yet" case so we can
  // tell the admin rather than silently showing empty cards. Postgres
  // relation-does-not-exist is SQLSTATE 42P01.
  function isMissingRelation(e: { code?: string; message?: string } | null | undefined) {
    if (!e) return false;
    return e.code === "42P01" || /does not exist|relation .* does not exist/i.test(e.message ?? "");
  }
  const missingScriptsTable = isMissingRelation(availScripts.error);
  const missingAttachmentTables =
    isMissingRelation(attachedSurveys.error) || isMissingRelation(attachedScripts.error);

  // Current active assignees for this walkbook (walkbook_assignments rows
  // with unassigned_at IS NULL). We display names to confirm who the
  // walkbook is currently attached to and link to the bulk assign UI.
  const { data: assignmentRows } = await supabase
    .from("walkbook_assignments")
    .select("user_id, assigned_at")
    .eq("walkbook_id", params.id)
    .is("unassigned_at", null)
    .order("assigned_at", { ascending: false });
  const assignments = (assignmentRows ?? []) as Array<{ user_id: string; assigned_at: string }>;
  const assigneeIds = assignments.map((a) => a.user_id);
  const { data: assigneeRows } = assigneeIds.length
    ? await supabase.from("users").select("id, display_name, email").in("id", assigneeIds)
    : { data: [] as Array<{ id: string; display_name: string | null; email: string | null }> };
  const assignees = (assigneeRows ?? []) as Array<{
    id: string;
    display_name: string | null;
    email: string | null;
  }>;
  const surveysAvailable = (availSurveys.data ?? []) as Array<{
    id: string;
    name: string;
    status: string | null;
  }>;
  const scriptsAvailable = (availScripts.data ?? []) as Array<{
    id: string;
    name: string;
    status: string | null;
  }>;
  const attachedSurveyRows = (attachedSurveys.data ?? []) as Array<{
    survey_id: string;
    pinned: boolean;
  }>;
  const attachedScriptRows = (attachedScripts.data ?? []) as Array<{
    script_id: string;
    pinned: boolean;
  }>;
  const surveyInit = {
    ids: attachedSurveyRows.map((r) => r.survey_id),
    pinnedId: attachedSurveyRows.find((r) => r.pinned)?.survey_id ?? null,
  };
  const scriptInit = {
    ids: attachedScriptRows.map((r) => r.script_id),
    pinnedId: attachedScriptRows.find((r) => r.pinned)?.script_id ?? null,
  };

  const est = wb.estimated_duration_minutes ?? wb.target_duration_minutes;

  return (
    <div className="space-y-5">
      <Link href="/admin/walkbooks" className="inline-flex items-center gap-1 text-sm text-navy-700">
        <ArrowLeft className="h-4 w-4" /> All walkbooks
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-navy-900">
            {formatWalkbookName(wb.name)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {wb.household_count} households · {wb.status}
            {est ? ` · est ${est}m` : ""}
            {assignees.length > 0
              ? ` · assigned to ${assignees
                  .map((u) => u.display_name || u.email || "?")
                  .join(", ")}`
              : " · unassigned"}
          </p>
        </div>
        <Link
          href="/admin/walkbooks/assign"
          className="rounded-md bg-navy px-3 py-2 text-sm font-medium text-white hover:bg-navy-800"
        >
          {assignees.length === 0 ? "Assign to a volunteer" : "Edit assignments"}
        </Link>
      </div>

      <WalkbookRouteMap walkbookId={wb.id} stops={stops} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Assigned to</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {assignees.length === 0
                ? "No volunteers are currently assigned — this walkbook is up for grabs."
                : `${assignees.length} active volunteer${assignees.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <Link
            href="/admin/walkbooks/assign"
            className="rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800"
          >
            {assignees.length === 0 ? "Assign to a volunteer" : "Edit assignments"}
          </Link>
        </CardHeader>
        {assignees.length > 0 ? (
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {assignees.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between border-b border-border py-1.5 last:border-0"
                >
                  <span className="text-navy-900">{u.display_name || u.email || u.id}</span>
                  {u.email ? (
                    <span className="text-xs text-muted-foreground">{u.email}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        ) : null}
      </Card>

      {missingScriptsTable || missingAttachmentTables ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Walkbook-level surveys &amp; scripts aren&rsquo;t available yet.</p>
          <p className="mt-1 text-xs">
            The migration that adds{" "}
            <code className="font-mono">walkbook_surveys</code>,{" "}
            <code className="font-mono">walkbook_scripts</code>, and the{" "}
            <code className="font-mono">scripts</code> table hasn&rsquo;t been applied to
            this database yet. Run{" "}
            <code className="font-mono">
              supabase/migrations/20260419000005_scripts_and_walkbook_targets.sql
            </code>{" "}
            (or <code className="font-mono">supabase db push</code>) and refresh.
          </p>
        </div>
      ) : (
        <WalkbookAttachments
          walkbookId={wb.id}
          entity="surveys"
          available={surveysAvailable}
          initial={surveyInit}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Households in walk order</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1 text-sm">
            {ordered.map((r, i) => {
              const h = hhById.get(r.household_id);
              if (!h) return null;
              return (
                <li
                  key={r.household_id}
                  className="flex justify-between border-b border-border py-1"
                >
                  <span>
                    <span className="mr-2 text-xs font-mono text-muted-foreground">
                      #{i + 1}
                    </span>
                    {h.address_line1}
                    {h.city ? `, ${h.city}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{h.status}</span>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
