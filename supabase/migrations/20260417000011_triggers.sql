-- Derive voter.current_status + household.status from knock_events,
-- flag concurrent-write conflicts, increment tag usage counts, and
-- emit audit log rows.

create or replace function public.status_from_knock(k knock_status)
returns voter_status
language sql
immutable
as $$
  select case k
    when 'no_answer'       then 'no_answer'
    when 'come_back_later' then 'come_back_later'
    when 'refused'         then 'refused'
    when 'contacted'       then 'contacted'
    when 'wrong_address'   then 'not_contacted'
  end::voter_status;
$$;

create or replace function public.recompute_household_status(hh uuid)
returns void
language plpgsql
as $$
declare
  distinct_statuses int;
  single_status voter_status;
  new_status household_status;
begin
  select count(distinct current_status), min(current_status)
    into distinct_statuses, single_status
    from public.voters
   where household_id = hh;

  if distinct_statuses is null or distinct_statuses = 0 then
    new_status := 'not_knocked';
  elsif distinct_statuses = 1 then
    new_status := case single_status
      when 'not_contacted'   then 'not_knocked'
      when 'no_answer'       then 'no_answer'
      when 'come_back_later' then 'come_back_later'
      when 'refused'         then 'refused'
      when 'contacted'       then 'contacted'
    end;
  else
    new_status := 'mixed';
  end if;

  update public.households
     set status = new_status,
         last_knocked_at = (
           select max(knocked_at) from public.knock_events
            where household_id = hh
         ),
         updated_at = now()
   where id = hh;
end;
$$;

create or replace function public.on_knock_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_within_5m uuid;
begin
  if new.voter_id is not null then
    select ke.id into prior_within_5m
      from public.knock_events ke
     where ke.voter_id = new.voter_id
       and ke.user_id <> new.user_id
       and ke.knocked_at between new.knocked_at - interval '5 minutes'
                             and new.knocked_at + interval '5 minutes'
       and ke.id <> new.id
     order by ke.knocked_at desc
     limit 1;

    if prior_within_5m is not null then
      update public.knock_events set conflict_flag = true where id in (new.id, prior_within_5m);
      insert into public.sync_conflicts (entity_type, entity_id, description)
      values ('knock_event', new.id,
        format('Knock event %s conflicts with %s for voter %s', new.id, prior_within_5m, new.voter_id));
    end if;

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

drop trigger if exists trg_knock_events_after_insert on public.knock_events;
create trigger trg_knock_events_after_insert
  after insert on public.knock_events
  for each row execute function public.on_knock_event_insert();

-- Maintain tags.usage_count
create or replace function public.on_voter_tag_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.tags set usage_count = usage_count + 1 where id = new.tag_id;
    insert into public.audit_log (user_id, action, entity_type, entity_id, metadata)
    values (new.applied_by, 'tag.apply', 'voter_tag', new.id,
            jsonb_build_object('tag_id', new.tag_id, 'voter_id', new.voter_id));
    return new;
  elsif tg_op = 'DELETE' then
    update public.tags set usage_count = greatest(usage_count - 1, 0) where id = old.tag_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_voter_tags_change on public.voter_tags;
create trigger trg_voter_tags_change
  after insert or delete on public.voter_tags
  for each row execute function public.on_voter_tag_change();

-- Keep walkbooks.household_count in sync
create or replace function public.on_walkbook_hh_change()
returns trigger
language plpgsql
as $$
declare
  wb uuid;
begin
  wb := coalesce(new.walkbook_id, old.walkbook_id);
  update public.walkbooks
     set household_count = (
       select count(*) from public.walkbook_households where walkbook_id = wb
     )
   where id = wb;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_walkbook_households_change on public.walkbook_households;
create trigger trg_walkbook_households_change
  after insert or delete on public.walkbook_households
  for each row execute function public.on_walkbook_hh_change();
