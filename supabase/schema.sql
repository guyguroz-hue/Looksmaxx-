-- Looksmaxx · database schema
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Two design rules are enforced here rather than trusted to the client:
--   1. No image, landmark set or anything else that could reconstruct a face
--      has a column to live in. The schema makes the privacy promise literal.
--   2. Row-level security is ON for both tables, with policies scoped to
--      auth.uid(). The anon key is public by design; RLS is what makes that safe.
--      Without these policies the key would expose every row to everyone.

-- ─────────────────────────────── profiles ───────────────────────────────

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  answers     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Questionnaire answers. No free text is collected, so nothing here identifies a person beyond their own auth row.';

alter table public.profiles enable row level security;

drop policy if exists "own profile: read"   on public.profiles;
drop policy if exists "own profile: write"  on public.profiles;
drop policy if exists "own profile: update" on public.profiles;
drop policy if exists "own profile: delete" on public.profiles;

create policy "own profile: read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile: write"  on public.profiles for insert with check (auth.uid() = id);
create policy "own profile: update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "own profile: delete" on public.profiles for delete using (auth.uid() = id);

-- ───────────────────────────────── scans ────────────────────────────────

create table if not exists public.scans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  taken_at    timestamptz not null,
  overall     smallint,
  potential   smallint,
  coverage    smallint,
  domains     jsonb not null default '{}'::jsonb,
  -- [{id, value, score}] only. Deriving a face from this is not possible.
  metrics     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),

  constraint scans_overall_range   check (overall   is null or overall   between 0 and 100),
  constraint scans_potential_range check (potential is null or potential between 0 and 100),
  constraint scans_coverage_range  check (coverage  is null or coverage  between 0 and 100),
  -- One scan per instant per user: re-syncing the same local history is a no-op
  -- rather than a way to duplicate it.
  constraint scans_unique_per_user unique (user_id, taken_at)
);

comment on table public.scans is
  'Derived measurements only. Images and landmarks never leave the device.';

create index if not exists scans_user_taken_idx on public.scans (user_id, taken_at desc);

alter table public.scans enable row level security;

drop policy if exists "own scans: read"   on public.scans;
drop policy if exists "own scans: write"  on public.scans;
drop policy if exists "own scans: update" on public.scans;
drop policy if exists "own scans: delete" on public.scans;

create policy "own scans: read"   on public.scans for select using (auth.uid() = user_id);
create policy "own scans: write"  on public.scans for insert with check (auth.uid() = user_id);
create policy "own scans: update" on public.scans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own scans: delete" on public.scans for delete using (auth.uid() = user_id);

-- ─────────────────────────── housekeeping ───────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- A new sign-up gets an empty profile row automatically, so the client never
-- has to handle "row missing" as a special case.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
