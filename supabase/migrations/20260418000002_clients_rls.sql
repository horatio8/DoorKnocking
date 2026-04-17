-- RLS helpers and policy updates for the clients layer.

create or replace function public.has_client_access(c uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
      or exists (
        select 1 from public.users u
        where u.id = auth.uid()
          and c = any(coalesce(u.client_access, '{}'::uuid[]))
      );
$$;

-- Re-derive has_district_access so it also honours client membership, in case
-- a user only has client_access (the future state) with no explicit district.
create or replace function public.has_district_access(d uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
      or exists (
        select 1
          from public.users u
          join public.districts dd on dd.id = d
         where u.id = auth.uid()
           and (
             d = any(coalesce(u.district_access, '{}'::uuid[]))
             or u.default_district_id = d
             or dd.client_id = any(coalesce(u.client_access, '{}'::uuid[]))
           )
      );
$$;

-- Clients table: super-admins full CRUD; anyone with client_access may read
-- their own client.
alter table public.clients enable row level security;

drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients for select
  using (public.has_client_access(id));

drop policy if exists clients_super_write on public.clients;
create policy clients_super_write on public.clients for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Districts: tighten to also require client access.
drop policy if exists districts_read on public.districts;
create policy districts_read on public.districts for select
  using (public.has_client_access(client_id));

drop policy if exists districts_write on public.districts;
drop policy if exists districts_super_write on public.districts;
create policy districts_super_write on public.districts for all
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists districts_admin_write on public.districts;
create policy districts_admin_write on public.districts for update
  using (public.is_admin() and public.has_client_access(client_id))
  with check (public.is_admin() and public.has_client_access(client_id));
