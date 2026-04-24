-- ============================================================
-- Drop the conflict-detection machinery. Walkbooks are now multi-holder
-- by design so two knockers hitting the same voter in the same window
-- isn't a bug to flag — it's routine. We keep every knock_event row
-- untouched; the household status trigger still recomputes from voter
-- statuses, but we stop flagging concurrent writes.
--
-- knock_events.conflict_flag stays in place (nullable, unused going
-- forward) to avoid rewriting historical rows. New rows land with the
-- default false.
-- ============================================================

create or replace function public.on_knock_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.voter_id is not null then
    update public.voters
       set current_status = public.status_from_knock(new.status),
           last_knock_event_id = new.id,
           updated_at = now()
     where id = new.voter_id;
  end if;

  perform public.recompute_household_status(new.household_id);

  insert into public.audit_log (user_id, action, entity_type, entity_id, metadata)
  values (new.user_id, 'knock.create', 'knock_event', new.id,
          jsonb_build_object('status', new.status, 'voter_id', new.voter_id,
                             'household_id', new.household_id));
  return new;
end;
$$;

-- sync_conflicts is unused after the trigger rewrite above. Drop it.
-- If you want to keep historical conflict rows for audit, skip this
-- statement — nothing else in the app depends on the table existing.
drop table if exists public.sync_conflicts cascade;
