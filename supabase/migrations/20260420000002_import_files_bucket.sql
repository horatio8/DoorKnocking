-- Storage bucket for admin-uploaded voter files (CSV / XLSX) before they
-- are pushed into the client's Airtable base. Private bucket, path-
-- scoped by district: `<district_id>/<timestamp>-<filename>`.

insert into storage.buckets (id, name, public)
values ('import-files', 'import-files', false)
on conflict (id) do nothing;

drop policy if exists import_files_admin_read on storage.objects;
create policy import_files_admin_read on storage.objects for select
  using (
    bucket_id = 'import-files'
    and (public.is_admin() or public.is_super_admin())
  );

drop policy if exists import_files_admin_insert on storage.objects;
create policy import_files_admin_insert on storage.objects for insert
  with check (
    bucket_id = 'import-files'
    and (public.is_admin() or public.is_super_admin())
  );

drop policy if exists import_files_admin_delete on storage.objects;
create policy import_files_admin_delete on storage.objects for delete
  using (
    bucket_id = 'import-files'
    and (public.is_admin() or public.is_super_admin())
  );
