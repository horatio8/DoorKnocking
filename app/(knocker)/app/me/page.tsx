import { requireOnboardedKnocker } from "@/lib/auth/onboarding";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoutButton } from "@/components/knocker/logout-button";

export const dynamic = "force-dynamic";

export default async function MyDayPage() {
  const session = await requireOnboardedKnocker();
  const supabase = getSupabaseServerClient();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: todayEvents } = await supabase
    .from("knock_events")
    .select("id, status, voter_id, knocked_at, survey_completed")
    .eq("user_id", session.user.id)
    .gte("knocked_at", startOfDay.toISOString());

  const events = todayEvents ?? [];
  const doors = events.length;
  const contacts = events.filter((e) => e.status === "contacted").length;
  const surveys = events.filter((e) => e.survey_completed).length;

  return (
    <div className="h-full overflow-y-auto p-4">
      <h1 className="font-serif text-2xl font-semibold text-navy-900">Your day</h1>
      <p className="text-sm text-muted-foreground">
        Hi {session.user.full_name ?? session.user.email}. Here is what you have logged today.
      </p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Doors" value={doors} />
        <Stat label="Contacts" value={contacts} />
        <Stat label="Surveys" value={surveys} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No knocks yet today. Get out there.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {events.slice(0, 10).map((e) => (
                <li key={e.id} className="flex justify-between">
                  <span>{e.status.replace("_", " ")}</span>
                  <span className="text-muted-foreground">
                    {new Date(e.knocked_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="mt-8">
        <LogoutButton />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 text-center shadow-sm">
      <p className="text-3xl font-semibold text-navy-900">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
