-- Voice-note recording defaults to ON.
--
-- Background: voice_note_consent was originally a soft software toggle
-- volunteers had to flip from /app/me before the conversation recorder
-- would let them record. The OS-level microphone prompt
-- (getUserMedia({audio: true})) is the real consent gate — it always
-- fires before any audio is captured, regardless of this flag — so the
-- in-app toggle was redundant friction. Defaulting it on aligns the
-- default behaviour with the actual consent model and removes the
-- "you haven't enabled voice-note recording" dead-end on the door
-- screen.
--
-- Two changes:
--   1. Flip the column default to true so new users are immediately
--      enabled.
--   2. Backfill existing rows to true and stamp consent_at when null,
--      so already-onboarded volunteers also see the recorder enabled
--      after this migration runs.
--
-- A volunteer can still opt OUT from /app/me — the toggle stays.

alter table public.users
  alter column voice_note_consent set default true;

update public.users
   set voice_note_consent = true,
       voice_note_consent_at = coalesce(voice_note_consent_at, now())
 where voice_note_consent is distinct from true;
