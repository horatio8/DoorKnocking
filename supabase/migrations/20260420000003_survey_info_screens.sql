-- ============================================================
-- Info screens inside surveys — merge the `scripts` concept into the
-- survey runner as a new question_type. An "info" row is a read-only
-- screen of HTML that the volunteer advances past with a Continue
-- button. No response row is recorded for it.
--
-- Existing scripts + walkbook_scripts + knock_events.script_id stay in
-- place: this migration only adds; it does not remove anything. The UI
-- will hide the old scripts surfaces in a follow-up commit.
-- ============================================================

-- Adding an enum value must happen outside a transaction in Postgres
-- < 12. Supabase's migrator runs each file in its own transaction so we
-- guard with `if not exists` (added in 12) to stay idempotent.
alter type question_type add value if not exists 'info';

-- The HTML body that the info screen renders. Nullable so existing
-- question rows keep working unchanged. For question_type = 'info' the
-- server / UI should prefer body_html over question_text.
alter table public.survey_questions
  add column if not exists body_html text;
