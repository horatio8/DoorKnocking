-- Column-level documentation for the walkbook lifecycle fields added in
-- migration 006. Shows up in psql \d+, Supabase table editor, and
-- generated docs tools.
--
-- Also: deliberate canary for the Supabase GitHub integration — pure
-- metadata, guaranteed idempotent, zero data impact. If this one auto-
-- applies, future schema changes will too.

comment on column public.walkbooks.kind is
  'Walkbook lifecycle: preset (admin auto-gen), custom (admin hand-drawn), or dynamic (knocker "walk from here")';
comment on column public.walkbooks.target_duration_minutes is
  'Minutes of walking work the generator was asked to fit; used as the sort anchor on the knocker browse view';
comment on column public.walkbooks.actual_knock_minutes is
  'Wall-clock minutes observed on the ground, populated after completion for calibration';
comment on column public.walkbooks.ephemeral is
  'True for dynamic walkbooks that expire if no knocks land — cron purges these nightly';
comment on column public.walkbooks.expires_at is
  'Cutoff timestamp for ephemeral walkbooks; ignored when ephemeral = false';
comment on column public.walkbooks.optimized_route_version is
  'Monotonically increasing; bumped by the reoptimize endpoint so clients know when to re-fetch the polyline';
