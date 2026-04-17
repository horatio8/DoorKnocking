-- Enumerated types used across the platform
do $$ begin
  create type user_role as enum ('admin', 'knocker', 'super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type household_status as enum (
    'not_knocked', 'no_answer', 'come_back_later',
    'refused', 'contacted', 'mixed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type voter_status as enum (
    'not_contacted', 'no_answer', 'come_back_later',
    'refused', 'contacted'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type knock_status as enum (
    'no_answer', 'come_back_later', 'refused',
    'contacted', 'wrong_address'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type walkbook_status as enum ('open', 'in_progress', 'complete');
exception when duplicate_object then null; end $$;

do $$ begin
  create type survey_visibility as enum ('all_houses', 'assigned_only');
exception when duplicate_object then null; end $$;

do $$ begin
  create type question_type as enum (
    'single_choice', 'multi_choice', 'short_text',
    'long_text', 'rating_1_5', 'yes_no', 'scale_0_10'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type conflict_resolution as enum (
    'unresolved', 'accepted', 'overridden', 'dismissed'
  );
exception when duplicate_object then null; end $$;
