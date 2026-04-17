-- Row-level security. Admins (and super_admins) get broad CRUD scoped to their
-- district_access list; knockers get just-enough-to-do-the-job.

-- Helper: current user's role
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_user_role() in ('admin', 'super_admin');
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select public.current_user_role() = 'super_admin';
$$;

create or replace function public.has_district_access(d uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and (d = any(u.district_access) or u.default_district_id = d)
  );
$$;

-- Enable RLS everywhere
alter table public.districts            enable row level security;
alter table public.users                enable row level security;
alter table public.households           enable row level security;
alter table public.voters               enable row level security;
alter table public.walkbooks            enable row level security;
alter table public.walkbook_households  enable row level security;
alter table public.walkbook_assignments enable row level security;
alter table public.knock_events         enable row level security;
alter table public.surveys              enable row level security;
alter table public.survey_questions     enable row level security;
alter table public.survey_responses     enable row level security;
alter table public.tags                 enable row level security;
alter table public.voter_tags           enable row level security;
alter table public.voter_notes          enable row level security;
alter table public.sync_conflicts       enable row level security;
alter table public.audit_log            enable row level security;

-- Districts
drop policy if exists districts_read on public.districts;
create policy districts_read on public.districts for select
  using (public.has_district_access(id) or public.is_super_admin());
drop policy if exists districts_write on public.districts;
create policy districts_write on public.districts for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Users
drop policy if exists users_self_read on public.users;
create policy users_self_read on public.users for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
drop policy if exists users_admin_write on public.users;
create policy users_admin_write on public.users for insert
  with check (public.is_admin());
drop policy if exists users_admin_delete on public.users;
create policy users_admin_delete on public.users for delete using (public.is_admin());

-- Households / voters: readable to any authed user with district access
drop policy if exists households_read on public.households;
create policy households_read on public.households for select
  using (public.has_district_access(district_id));
drop policy if exists households_admin_write on public.households;
create policy households_admin_write on public.households for all
  using (public.is_admin() and public.has_district_access(district_id))
  with check (public.is_admin() and public.has_district_access(district_id));

drop policy if exists voters_read on public.voters;
create policy voters_read on public.voters for select
  using (public.has_district_access(district_id));
drop policy if exists voters_admin_write on public.voters;
create policy voters_admin_write on public.voters for all
  using (public.is_admin() and public.has_district_access(district_id))
  with check (public.is_admin() and public.has_district_access(district_id));

-- Walkbooks
drop policy if exists walkbooks_read on public.walkbooks;
create policy walkbooks_read on public.walkbooks for select
  using (public.has_district_access(district_id));
drop policy if exists walkbooks_admin_write on public.walkbooks;
create policy walkbooks_admin_write on public.walkbooks for all
  using (public.is_admin() and public.has_district_access(district_id))
  with check (public.is_admin() and public.has_district_access(district_id));

drop policy if exists walkbook_households_read on public.walkbook_households;
create policy walkbook_households_read on public.walkbook_households for select
  using (exists (
    select 1 from public.walkbooks w
    where w.id = walkbook_id and public.has_district_access(w.district_id)
  ));
drop policy if exists walkbook_households_admin_write on public.walkbook_households;
create policy walkbook_households_admin_write on public.walkbook_households for all
  using (public.is_admin()) with check (public.is_admin());

-- Knockers see their own assignments, admins see all
drop policy if exists walkbook_assignments_read on public.walkbook_assignments;
create policy walkbook_assignments_read on public.walkbook_assignments for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists walkbook_assignments_admin_write on public.walkbook_assignments;
create policy walkbook_assignments_admin_write on public.walkbook_assignments for all
  using (public.is_admin()) with check (public.is_admin());

-- Knock events: knockers insert own, read all (for live map), update own within 15 min
drop policy if exists knock_events_read on public.knock_events;
create policy knock_events_read on public.knock_events for select
  using (
    exists (
      select 1 from public.households h
      where h.id = household_id and public.has_district_access(h.district_id)
    )
  );
drop policy if exists knock_events_self_insert on public.knock_events;
create policy knock_events_self_insert on public.knock_events for insert
  with check (user_id = auth.uid());
drop policy if exists knock_events_self_update on public.knock_events;
create policy knock_events_self_update on public.knock_events for update
  using (
    (user_id = auth.uid() and knocked_at > now() - interval '15 minutes')
    or public.is_admin()
  )
  with check (
    (user_id = auth.uid() and knocked_at > now() - interval '15 minutes')
    or public.is_admin()
  );
drop policy if exists knock_events_admin_delete on public.knock_events;
create policy knock_events_admin_delete on public.knock_events for delete
  using (public.is_admin());

-- Surveys: knockers see active ones in their district; admins full CRUD
drop policy if exists surveys_read on public.surveys;
create policy surveys_read on public.surveys for select
  using (public.has_district_access(district_id) and (active or public.is_admin()));
drop policy if exists surveys_admin_write on public.surveys;
create policy surveys_admin_write on public.surveys for all
  using (public.is_admin() and public.has_district_access(district_id))
  with check (public.is_admin() and public.has_district_access(district_id));

drop policy if exists survey_questions_read on public.survey_questions;
create policy survey_questions_read on public.survey_questions for select
  using (
    exists (
      select 1 from public.surveys s
      where s.id = survey_id
        and public.has_district_access(s.district_id)
        and (s.active or public.is_admin())
    )
  );
drop policy if exists survey_questions_admin_write on public.survey_questions;
create policy survey_questions_admin_write on public.survey_questions for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists survey_responses_self_insert on public.survey_responses;
create policy survey_responses_self_insert on public.survey_responses for insert
  with check (
    exists (
      select 1 from public.knock_events ke
      where ke.id = knock_event_id and ke.user_id = auth.uid()
    )
  );
drop policy if exists survey_responses_read on public.survey_responses;
create policy survey_responses_read on public.survey_responses for select
  using (
    exists (
      select 1 from public.voters v
      where v.id = voter_id and public.has_district_access(v.district_id)
    )
  );
drop policy if exists survey_responses_admin_write on public.survey_responses;
create policy survey_responses_admin_write on public.survey_responses for all
  using (public.is_admin()) with check (public.is_admin());

-- Tags
drop policy if exists tags_read on public.tags;
create policy tags_read on public.tags for select
  using (public.has_district_access(district_id));
drop policy if exists tags_insert on public.tags;
create policy tags_insert on public.tags for insert
  with check (public.has_district_access(district_id) and created_by = auth.uid());
drop policy if exists tags_admin_update on public.tags;
create policy tags_admin_update on public.tags for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists tags_admin_delete on public.tags;
create policy tags_admin_delete on public.tags for delete using (public.is_admin());

drop policy if exists voter_tags_read on public.voter_tags;
create policy voter_tags_read on public.voter_tags for select
  using (
    exists (
      select 1 from public.voters v
      where v.id = voter_id and public.has_district_access(v.district_id)
    )
  );
drop policy if exists voter_tags_self_write on public.voter_tags;
create policy voter_tags_self_write on public.voter_tags for insert
  with check (applied_by = auth.uid());
drop policy if exists voter_tags_self_delete on public.voter_tags;
create policy voter_tags_self_delete on public.voter_tags for delete
  using (
    (applied_by = auth.uid() and applied_at > now() - interval '15 minutes')
    or public.is_admin()
  );

-- Voter notes
drop policy if exists voter_notes_read on public.voter_notes;
create policy voter_notes_read on public.voter_notes for select
  using (
    exists (
      select 1 from public.voters v
      where v.id = voter_id and public.has_district_access(v.district_id)
    )
  );
drop policy if exists voter_notes_self_insert on public.voter_notes;
create policy voter_notes_self_insert on public.voter_notes for insert
  with check (author_id = auth.uid());
drop policy if exists voter_notes_admin_write on public.voter_notes;
create policy voter_notes_admin_write on public.voter_notes for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists voter_notes_admin_delete on public.voter_notes;
create policy voter_notes_admin_delete on public.voter_notes for delete
  using (public.is_admin() or (author_id = auth.uid() and created_at > now() - interval '15 minutes'));

-- Sync conflicts + audit log
drop policy if exists sync_conflicts_read on public.sync_conflicts;
create policy sync_conflicts_read on public.sync_conflicts for select
  using (public.is_admin());
drop policy if exists sync_conflicts_admin_write on public.sync_conflicts;
create policy sync_conflicts_admin_write on public.sync_conflicts for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log for select
  using (public.is_admin() or user_id = auth.uid());

-- sync_state is service-role only; deny client access entirely.
alter table public.sync_state enable row level security;
drop policy if exists sync_state_deny on public.sync_state;
create policy sync_state_deny on public.sync_state for all
  using (false) with check (false);
