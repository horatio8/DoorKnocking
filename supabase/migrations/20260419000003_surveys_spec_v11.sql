-- Phase S2 — Survey spec v1.1 additions
-- See SURVEYS.md §4 for rationale. Long-format response storage, version
-- snapshots, and an Airtable-ID map to support the one-way mirror sync.

-- ===== Surveys =====
alter table public.surveys
  add column if not exists slug text,
  add column if not exists current_version int not null default 0,
  add column if not exists status text not null default 'draft',
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references public.users (id),
  add column if not exists airtable_record_id text,
  add column if not exists created_by uuid references public.users (id);

do $$ begin
  alter table public.surveys
    add constraint surveys_status_check
    check (status in ('draft', 'active', 'paused', 'archived'));
exception when duplicate_object then null; end $$;

create unique index if not exists surveys_district_slug_uq
  on public.surveys (district_id, slug)
  where slug is not null;

-- ===== Survey questions =====
alter table public.survey_questions
  add column if not exists question_key text,
  add column if not exists min_value int,
  add column if not exists max_value int,
  add column if not exists airtable_record_id text;

create unique index if not exists survey_questions_survey_key_uq
  on public.survey_questions (survey_id, question_key)
  where question_key is not null;

-- ===== Survey responses — long-format enhancements =====
alter table public.survey_responses
  add column if not exists answer_numeric numeric,
  add column if not exists answer_text text,
  add column if not exists survey_version_number int not null default 1,
  add column if not exists partial boolean not null default false,
  add column if not exists airtable_record_id text,
  add column if not exists knocker_id uuid references public.users (id) on delete set null;

-- Generated composite id = "<knock_event_id>-<question_key>" so upserts are
-- idempotent. Uses a function because Postgres generated columns can't
-- subquery; instead we keep a trigger that fills it in.
alter table public.survey_responses
  add column if not exists response_id_composite text;

create or replace function public.populate_survey_response_fields()
returns trigger as $$
declare
  q record;
begin
  select question_type, question_key
    into q
    from public.survey_questions
    where id = NEW.question_id;

  -- Composite response id (§3.4).
  if q.question_key is not null then
    NEW.response_id_composite := NEW.knock_event_id::text || '-' || q.question_key;
  end if;

  -- Answer text (stringified) and numeric for rating/scale.
  if NEW.answer is not null then
    NEW.answer_text := coalesce(
      NEW.answer_text,
      case jsonb_typeof(NEW.answer)
        when 'string' then NEW.answer#>>'{}'
        when 'number' then NEW.answer::text
        when 'boolean' then NEW.answer::text
        when 'array' then (
          select string_agg(coalesce(elem#>>'{}', elem::text), ', ')
          from jsonb_array_elements(NEW.answer) elem
        )
        else NEW.answer::text
      end
    );
  end if;

  if q.question_type in ('rating_1_5', 'scale_0_10') then
    begin
      NEW.answer_numeric := (NEW.answer#>>'{}')::numeric;
    exception when others then
      NEW.answer_numeric := null;
    end;
  end if;

  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_survey_response_fields on public.survey_responses;
create trigger trg_survey_response_fields
  before insert or update on public.survey_responses
  for each row execute function public.populate_survey_response_fields();

create unique index if not exists survey_responses_composite_uq
  on public.survey_responses (response_id_composite)
  where response_id_composite is not null;

-- ===== Historical version snapshots (§4.4) =====
create table if not exists public.survey_versions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  version_number int not null,
  snapshot jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references public.users (id),
  unique (survey_id, version_number)
);

create index if not exists survey_versions_survey_idx
  on public.survey_versions (survey_id, version_number desc);

-- ===== Airtable ID map (§4.5) =====
create table if not exists public.airtable_id_map (
  supabase_table text not null,
  supabase_id uuid not null,
  airtable_table text not null,
  airtable_record_id text not null,
  created_at timestamptz not null default now(),
  primary key (supabase_table, supabase_id)
);

create index if not exists airtable_id_map_airtable_idx
  on public.airtable_id_map (airtable_record_id);

-- ===== RLS (§4.6, adapted to the is_admin / is_super_admin helpers) =====
alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_versions enable row level security;
alter table public.airtable_id_map enable row level security;

drop policy if exists surveys_knocker_read on public.surveys;
create policy surveys_knocker_read on public.surveys for select
  using (
    status = 'active'
    and (
      public.has_district_access(district_id)
      or public.is_admin()
      or public.is_super_admin()
    )
  );

drop policy if exists surveys_admin_all on public.surveys;
create policy surveys_admin_all on public.surveys for all
  using (public.is_admin() or public.is_super_admin())
  with check (public.is_admin() or public.is_super_admin());

drop policy if exists survey_questions_read on public.survey_questions;
create policy survey_questions_read on public.survey_questions for select
  using (
    survey_id in (
      select id from public.surveys
      where status = 'active'
        and (public.has_district_access(district_id) or public.is_admin() or public.is_super_admin())
    )
    or public.is_admin()
    or public.is_super_admin()
  );

drop policy if exists survey_questions_admin_write on public.survey_questions;
create policy survey_questions_admin_write on public.survey_questions for all
  using (public.is_admin() or public.is_super_admin())
  with check (public.is_admin() or public.is_super_admin());

drop policy if exists survey_responses_self_insert on public.survey_responses;
create policy survey_responses_self_insert on public.survey_responses for insert
  with check (
    knocker_id = auth.uid()
    or public.is_admin()
    or public.is_super_admin()
  );

drop policy if exists survey_responses_self_read on public.survey_responses;
create policy survey_responses_self_read on public.survey_responses for select
  using (
    knocker_id = auth.uid()
    or public.is_admin()
    or public.is_super_admin()
  );

drop policy if exists survey_responses_self_update on public.survey_responses;
create policy survey_responses_self_update on public.survey_responses for update
  using (knocker_id = auth.uid() or public.is_admin() or public.is_super_admin())
  with check (knocker_id = auth.uid() or public.is_admin() or public.is_super_admin());

drop policy if exists survey_versions_admin on public.survey_versions;
create policy survey_versions_admin on public.survey_versions for all
  using (public.is_admin() or public.is_super_admin())
  with check (public.is_admin() or public.is_super_admin());

drop policy if exists survey_versions_knocker_read on public.survey_versions;
create policy survey_versions_knocker_read on public.survey_versions for select
  using (
    survey_id in (
      select id from public.surveys where public.has_district_access(district_id)
    )
  );

drop policy if exists airtable_id_map_admin on public.airtable_id_map;
create policy airtable_id_map_admin on public.airtable_id_map for all
  using (public.is_admin() or public.is_super_admin())
  with check (public.is_admin() or public.is_super_admin());

-- Back-fill status for any rows that predate this migration:
update public.surveys set status = case when active then 'active' else 'draft' end
  where status is null;
