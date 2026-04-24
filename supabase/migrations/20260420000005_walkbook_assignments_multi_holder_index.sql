-- ============================================================
-- Multi-holder fix: the legacy unique index on
-- walkbook_assignments forced one active assignee per walkbook.
-- Now that exclusivity is dropped (commit 0e1a3d2), we need the
-- uniqueness scoped to (walkbook_id, user_id) so a single user
-- still can't double-claim the same walkbook but different users
-- can share it.
-- ============================================================

drop index if exists public.walkbook_assignments_active_uniq;

create unique index if not exists walkbook_assignments_active_user_uniq
  on public.walkbook_assignments (walkbook_id, user_id)
  where unassigned_at is null;
