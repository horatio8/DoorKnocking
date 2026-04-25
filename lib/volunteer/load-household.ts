import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export interface VolunteerVoter {
  id: string;
  displayName: string;
  party: string | null;
  priorNote: string | null;
}

export interface VolunteerHousehold {
  id: string;
  addressLine1: string;
  city: string | null;
  state: string | null;
  voters: VolunteerVoter[];
}

export async function loadVolunteerHousehold(
  householdId: string,
): Promise<VolunteerHousehold | null> {
  const supabase = getSupabaseServiceRoleClient();
  const { data: hh } = await supabase
    .from("households")
    .select("id, address_line1, city, state")
    .eq("id", householdId)
    .maybeSingle();
  if (!hh) return null;
  const hhRow = hh as {
    id: string;
    address_line1: string;
    city: string | null;
    state: string | null;
  };

  const { data: voters } = await supabase
    .from("voters")
    .select("id, display_name, observed_party, calculated_party, official_party, current_status")
    .eq("household_id", householdId)
    .order("display_name");

  const voterRows = (voters ?? []) as Array<{
    id: string;
    display_name: string | null;
    observed_party: string | null;
    calculated_party: string | null;
    official_party: string | null;
    current_status: string | null;
  }>;

  const list: VolunteerVoter[] = voterRows.map((v) => ({
    id: v.id,
    displayName: v.display_name?.trim() || "Unnamed voter",
    party: v.observed_party ?? v.calculated_party ?? v.official_party ?? null,
    priorNote: priorNoteFor(v.current_status),
  }));

  return {
    id: hhRow.id,
    addressLine1: hhRow.address_line1,
    city: hhRow.city,
    state: hhRow.state,
    voters: list,
  };
}

function priorNoteFor(status: string | null): string | null {
  switch (status) {
    case "contacted":
      return "Spoke previously";
    case "no_answer":
      return "Knocked before — no answer";
    case "come_back_later":
      return "Asked us to come back";
    case "refused":
      return "Declined a previous knock";
    default:
      return null;
  }
}
