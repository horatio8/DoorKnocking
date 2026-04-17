// Canonical domain types. Mirrors the Supabase schema so the rest of the app
// doesn't have to reach into generated types for common reads.

export type UserRole = "admin" | "knocker" | "super_admin";

export type HouseholdStatus =
  | "not_knocked"
  | "no_answer"
  | "come_back_later"
  | "refused"
  | "contacted"
  | "mixed";

export type VoterStatus =
  | "not_contacted"
  | "no_answer"
  | "come_back_later"
  | "refused"
  | "contacted";

export type KnockStatus =
  | "no_answer"
  | "come_back_later"
  | "refused"
  | "contacted"
  | "wrong_address";

export type WalkbookStatus = "open" | "in_progress" | "complete";

export type QuestionType =
  | "single_choice"
  | "multi_choice"
  | "short_text"
  | "long_text"
  | "rating_1_5"
  | "yes_no"
  | "scale_0_10";

export type SurveyVisibility = "all_houses" | "assigned_only";

export interface District {
  id: string;
  slug: string;
  name: string;
  country: string;
  region: string;
  airtable_base_id: string | null;
  airtable_voters_table_id: string | null;
  default_walkbook_size: number;
  timezone: string;
  active: boolean;
  created_at: string;
}

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  default_district_id: string | null;
  district_access: string[];
  assigned_walkbook_ids: string[];
  last_seen_at: string | null;
  created_at: string;
}

export interface Household {
  id: string;
  district_id: string;
  airtable_hh_rec_id: string;
  address_line1: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  zip4: string | null;
  unit: string | null;
  lat: number;
  lng: number;
  neighborhood_id: string | null;
  household_party: string | null;
  status: HouseholdStatus;
  last_knocked_at: string | null;
  updated_at: string;
}

export interface Voter {
  id: string;
  district_id: string;
  household_id: string;
  airtable_voter_key: string;
  state_voter_id: string | null;
  client_id: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  suffix: string | null;
  display_name: string;
  primary_phone: string | null;
  observed_party: string | null;
  official_party: string | null;
  calculated_party: string | null;
  moved: boolean;
  current_status: VoterStatus;
  last_knock_event_id: string | null;
  updated_at: string;
}

export interface Walkbook {
  id: string;
  district_id: string;
  name: string;
  description: string | null;
  household_count: number;
  centroid_lat: number | null;
  centroid_lng: number | null;
  bounding_box: BoundingBox | null;
  estimated_duration_minutes: number | null;
  auto_generated: boolean;
  status: WalkbookStatus;
  created_by: string | null;
  created_at: string;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface WalkbookAssignment {
  id: string;
  walkbook_id: string;
  user_id: string;
  assigned_by: string | null;
  assigned_at: string;
  unassigned_at: string | null;
}

export interface KnockEvent {
  id: string;
  household_id: string;
  voter_id: string | null;
  user_id: string;
  walkbook_id: string | null;
  status: KnockStatus;
  knocked_at: string;
  synced_at: string;
  client_event_id: string;
  duration_seconds: number | null;
  notes: string | null;
  survey_id: string | null;
  survey_completed: boolean;
  survey_partial: boolean;
  conflict_flag: boolean;
  created_at: string;
}

export interface Survey {
  id: string;
  district_id: string;
  airtable_survey_id: string | null;
  name: string;
  description: string | null;
  active: boolean;
  visibility: SurveyVisibility;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  order_index: number;
  question_text: string;
  question_type: QuestionType;
  required: boolean;
  options: Array<{ value: string; label: string }> | null;
  help_text: string | null;
}

export interface SurveyResponse {
  id: string;
  knock_event_id: string;
  voter_id: string;
  survey_id: string;
  question_id: string;
  answer: unknown;
  answered_at: string;
}

export interface Tag {
  id: string;
  district_id: string;
  label: string;
  color: string | null;
  is_standard: boolean;
  created_by: string | null;
  promoted_by: string | null;
  promoted_at: string | null;
  usage_count: number;
  created_at: string;
}

export interface VoterTag {
  id: string;
  voter_id: string;
  tag_id: string;
  applied_by: string | null;
  applied_at: string;
  knock_event_id: string | null;
}

export interface VoterNote {
  id: string;
  voter_id: string;
  knock_event_id: string | null;
  author_id: string | null;
  body: string;
  created_at: string;
}

export const HOUSEHOLD_PIN_COLORS: Record<HouseholdStatus, string> = {
  not_knocked: "#2563EB",
  come_back_later: "#F59E0B",
  no_answer: "#F97316",
  contacted: "#6B7280",
  refused: "#DC2626",
  mixed: "#7C3AED",
};

export const HOUSEHOLD_STATUS_LABELS: Record<HouseholdStatus, string> = {
  not_knocked: "Not knocked",
  no_answer: "No answer",
  come_back_later: "Come back later",
  refused: "Refused",
  contacted: "Contacted",
  mixed: "Mixed",
};
