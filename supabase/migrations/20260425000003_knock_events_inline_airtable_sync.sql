-- Inline mirroring infrastructure for knock_events → Airtable Knocks.
--
-- 1. airtable_knock_rec_id stores the Airtable record id returned by
--    the first successful mirror. Subsequent syncs PATCH that record
--    instead of creating a duplicate — necessary now that the API
--    endpoints fire the mirror immediately on every write (insert
--    creates, survey completion updates, etc.) plus the cron still
--    runs as a backstop.
--
-- 2. The trigger nulls airtable_synced_at whenever a column the
--    Airtable row reflects actually changes (status, notes,
--    survey_completed, survey_partial). The cron picks up
--    airtable_synced_at IS NULL rows, so this gives us "automatic
--    re-sync on update" via the existing partial index. The inline
--    trigger fires from the API for the common case; the cron sweep
--    handles anything that fails inline or that's mutated outside
--    the API surface (e.g. an admin UI that updates a status
--    column directly).

alter table public.knock_events
  add column if not exists airtable_knock_rec_id text;

create or replace function public.knock_events_reset_airtable_sync()
returns trigger
language plpgsql
as $$
begin
  if NEW.status is distinct from OLD.status
     or NEW.notes is distinct from OLD.notes
     or NEW.survey_completed is distinct from OLD.survey_completed
     or NEW.survey_partial is distinct from OLD.survey_partial then
    NEW.airtable_synced_at := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists knock_events_reset_airtable_sync_trg on public.knock_events;
create trigger knock_events_reset_airtable_sync_trg
  before update on public.knock_events
  for each row
  execute function public.knock_events_reset_airtable_sync();
