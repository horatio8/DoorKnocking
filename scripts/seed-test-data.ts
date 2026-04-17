/**
 * Seeds a handful of fake households + voters + a survey so the app is usable
 * without running a real Airtable import. Useful for local dev + Playwright.
 *
 * Usage: tsx scripts/seed-test-data.ts --district=sc-hd-115
 */
import { createClient } from "@supabase/supabase-js";

function arg(name: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : undefined;
}

async function main() {
  const slug = arg("district") ?? "sc-hd-115";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: district } = await supabase
    .from("districts")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!district) throw new Error("District not found");

  const base = { lat: 33.95, lng: -80.85 };
  const households = Array.from({ length: 20 }, (_, i) => ({
    district_id: district.id,
    airtable_hh_rec_id: `seed-${i}`,
    address_line1: `${100 + i} Main Street`,
    city: "Cameron",
    state: "SC",
    zip: "29030",
    lat: base.lat + (Math.random() - 0.5) * 0.02,
    lng: base.lng + (Math.random() - 0.5) * 0.02,
  }));
  const { data: inserted } = await supabase
    .from("households")
    .upsert(households, { onConflict: "district_id,airtable_hh_rec_id" })
    .select();

  const voters = (inserted ?? []).flatMap((h: { id: string }, i: number) =>
    [
      {
        district_id: district.id,
        household_id: h.id,
        airtable_voter_key: `seed-v-${i}-a`,
        first_name: "Jordan",
        last_name: `Household-${i}`,
        calculated_party: "I",
      },
      {
        district_id: district.id,
        household_id: h.id,
        airtable_voter_key: `seed-v-${i}-b`,
        first_name: "Alex",
        last_name: `Household-${i}`,
        calculated_party: "D",
      },
    ],
  );
  await supabase.from("voters").upsert(voters, { onConflict: "district_id,airtable_voter_key" });

  const { data: survey } = await supabase
    .from("surveys")
    .upsert(
      {
        district_id: district.id,
        name: "Primary voter intent",
        active: true,
        priority: 1,
        visibility: "all_houses",
      },
      { onConflict: "district_id,name" as never },
    )
    .select()
    .maybeSingle();
  if (survey) {
    await supabase.from("survey_questions").upsert(
      [
        {
          survey_id: survey.id,
          order_index: 0,
          question_text: "Who are you supporting in the primary?",
          question_type: "single_choice",
          required: true,
          options: [
            { value: "ours", label: "Our candidate" },
            { value: "opponent", label: "Opponent" },
            { value: "undecided", label: "Undecided" },
          ],
        },
        {
          survey_id: survey.id,
          order_index: 1,
          question_text: "Top issue?",
          question_type: "short_text",
          required: false,
        },
      ],
      { onConflict: "survey_id,order_index" as never },
    );
  }

  console.log("✅ Seed complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
