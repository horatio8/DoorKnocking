-- Profile table extending auth.users
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role user_role not null default 'knocker',
  active boolean not null default true,
  default_district_id uuid references public.districts (id) on delete set null,
  district_access uuid[] not null default '{}',
  assigned_walkbook_ids uuid[] not null default '{}',
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists users_role_idx on public.users (role);
create index if not exists users_default_district_idx on public.users (default_district_id);

-- Helper: auto-create profile row on auth sign-up
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
