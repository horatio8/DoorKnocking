import { requireOnboardedKnocker } from "@/lib/auth/onboarding";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/knocker/logout-button";
import { PageNav } from "@/components/knocker/page-nav";

export const dynamic = "force-dynamic";

export default async function YourProfilePage() {
  const session = await requireOnboardedKnocker();
  const supabase = getSupabaseServiceRoleClient();

  // Lifetime metrics — all knock events this user has ever recorded.
  const { data: allEvents } = await supabase
    .from("knock_events")
    .select("id, status, voter_id, knocked_at, survey_completed, duration_seconds")
    .eq("user_id", session.user.id)
    .order("knocked_at", { ascending: false });

  const events = (allEvents ?? []) as Array<{
    id: string;
    status: string;
    voter_id: string | null;
    knocked_at: string;
    survey_completed: boolean;
    duration_seconds: number | null;
  }>;
  const doors = events.length;
  const contacts = events.filter((e) => e.status === "contacted").length;
  const surveys = events.filter((e) => e.survey_completed).length;
  const sessionsSpan = events
    .map((e) => e.duration_seconds)
    .filter((s): s is number => typeof s === "number" && s > 0)
    .reduce((a, b) => a + b, 0);
  const hours = Math.round((sessionsSpan / 3600) * 10) / 10;
  const firstKnock = events.length > 0 ? events[events.length - 1]!.knocked_at : null;
  const memberSince =
    firstKnock ?? session.user.created_at ?? new Date().toISOString();

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <h1 className="font-serif text-2xl font-semibold text-navy-900">Your profile</h1>
        <p className="text-sm text-muted-foreground">
          {session.user.full_name ?? session.user.email} · Lifetime knock activity.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Doors" value={doors.toLocaleString()} />
          <Stat
            label="Contacts"
            value={contacts.toLocaleString()}
            note={doors > 0 ? `${Math.round((contacts / doors) * 100)}%` : undefined}
          />
          <Stat label="Surveys" value={surveys.toLocaleString()} />
          <Stat label="Hours" value={hours.toString()} />
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No knocks recorded yet. Start on the Map tab.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {events.slice(0, 10).map((e) => (
                  <li key={e.id} className="flex justify-between">
                    <span className="capitalize">{e.status.replace("_", " ")}</span>
                    <span className="text-muted-foreground">
                      {new Date(e.knocked_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      ·{" "}
                      {new Date(e.knocked_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="mt-4 rounded-md border border-navy-100 bg-navy-50/50 p-3 text-xs text-navy-700">
          Member since{" "}
          {new Date(memberSince).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>

        <div className="mt-8">
          <LogoutButton />
        </div>
      </div>
      <PageNav
        prev={{ href: "/app/walkbooks", label: "Walkbooks" }}
        next={{ href: "/app/map", label: "Map" }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 text-center shadow-sm">
      <p className="font-mono text-[28px] font-semibold leading-none text-navy-900">{value}</p>
      {note ? <p className="mt-1 text-[11px] text-navy-500">{note}</p> : null}
      <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
