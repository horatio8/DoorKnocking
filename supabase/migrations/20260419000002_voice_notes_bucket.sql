-- Voice-note audio bucket + per-user RLS. Objects are pathed as
-- `<user_id>/<knock_event_id>/<ts>.<ext>` and that first path segment is the
-- owner gate.

insert into storage.buckets (id, name, public)
values ('conversation-recordings', 'conversation-recordings', false)
on conflict (id) do nothing;

-- Owner read: the uploader can read their own files.
drop policy if exists voice_notes_owner_read on storage.objects;
create policy voice_notes_owner_read on storage.objects for select
  using (
    bucket_id = 'conversation-recordings'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or public.is_admin()
      or public.is_super_admin()
    )
  );

-- Owner insert: the uploader writes into their own folder.
drop policy if exists voice_notes_owner_insert on storage.objects;
create policy voice_notes_owner_insert on storage.objects for insert
  with check (
    bucket_id = 'conversation-recordings'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Owner delete so a knocker can remove a recording they uploaded by mistake.
drop policy if exists voice_notes_owner_delete on storage.objects;
create policy voice_notes_owner_delete on storage.objects for delete
  using (
    bucket_id = 'conversation-recordings'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or public.is_super_admin()
    )
  );
