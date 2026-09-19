-- FORM · schema
--
-- Two rules are enforced here rather than trusted to client code:
--
--   1. There is no column anywhere capable of holding an image. The privacy
--      promise on the welcome screen is structural, not a policy note.
--   2. Row-level security is on for every table with policies scoped to
--      auth.uid(). The anon key is public by design; RLS is the only thing
--      that makes that safe.
--
-- Run once in the Supabase SQL editor.

-- ───────────────────────────── profiles ─────────────────────────────

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  -- Onboarding answers: goals, style, hair, detail level. No free text.
  preferences jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Stated preferences. Nothing here identifies a person beyond their own auth row.';

alter table public.profiles enable row level security;

drop policy if exists "profiles:select" on public.profiles;
drop policy if exists "profiles:insert" on public.profiles;
drop policy if exists "profiles:update" on public.profiles;
drop policy if exists "profiles:delete" on public.profiles;

create policy "profiles:select" on public.profiles for select using (auth.uid() = id);
create policy "profiles:insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles:update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles:delete" on public.profiles for delete using (auth.uid() = id);

-- ──────────────────────────── analyses ────────────────────────────

create table if not exists public.analyses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  taken_at       timestamptz not null,
  -- 'high' | 'medium' | 'low'. Never a percentage.
  quality        text not null,
  -- [{id, category, observed, evidence:{metric,value}, confidence}]
  observations   jsonb not null default '[]'::jsonb,
  -- [{id, category, title, ...}] as shown. No image, no landmarks.
  strengths      jsonb not null default '[]'::jsonb,
  opportunities  jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),

  constraint analyses_quality_valid check (quality in ('high', 'medium', 'low')),
  -- Re-syncing the same local history is a no-op, not a way to duplicate it.
  constraint analyses_unique_per_user unique (user_id, taken_at)
);

comment on table public.analyses is
  'Derived observations only. Images and landmarks never leave the device, and there is no column here that could hold them.';

create index if not exists analyses_user_taken_idx on public.analyses (user_id, taken_at desc);

alter table public.analyses enable row level security;

drop policy if exists "analyses:select" on public.analyses;
drop policy if exists "analyses:insert" on public.analyses;
drop policy if exists "analyses:update" on public.analyses;
drop policy if exists "analyses:delete" on public.analyses;

create policy "analyses:select" on public.analyses for select using (auth.uid() = user_id);
create policy "analyses:insert" on public.analyses for insert with check (auth.uid() = user_id);
create policy "analyses:update" on public.analyses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "analyses:delete" on public.analyses for delete using (auth.uid() = user_id);

-- ─────────────────────── recommendation state ───────────────────────
-- Saved / tried / dismissed. `dismissed` is what feeds §36: a person who keeps
-- rejecting a category should stop being shown it.

create table if not exists public.recommendation_state (
  user_id            uuid not null references auth.users (id) on delete cascade,
  recommendation_id  text not null,
  category           text not null,
  state              text not null,
  updated_at         timestamptz not null default now(),

  primary key (user_id, recommendation_id),
  constraint rec_state_valid check (state in ('saved', 'tried', 'dismissed'))
);

create index if not exists rec_state_user_idx on public.recommendation_state (user_id, state);

alter table public.recommendation_state enable row level security;

drop policy if exists "recstate:select" on public.recommendation_state;
drop policy if exists "recstate:insert" on public.recommendation_state;
drop policy if exists "recstate:update" on public.recommendation_state;
drop policy if exists "recstate:delete" on public.recommendation_state;

create policy "recstate:select" on public.recommendation_state for select using (auth.uid() = user_id);
create policy "recstate:insert" on public.recommendation_state for insert with check (auth.uid() = user_id);
create policy "recstate:update" on public.recommendation_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recstate:delete" on public.recommendation_state for delete using (auth.uid() = user_id);

-- ─────────────────────────── housekeeping ───────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- A new sign-up gets an empty profile, so the client never handles "row missing".
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
