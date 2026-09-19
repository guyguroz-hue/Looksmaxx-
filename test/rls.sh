#!/usr/bin/env bash
# Row-level-security test for the FORM schema.
#
# The anon key shipped in client code is public by design — RLS is the only
# thing that makes that safe. This proves the policies actually isolate users,
# against a real PostgreSQL, before anyone's data depends on it.
#
# Needs a local PostgreSQL reachable as the postgres superuser.
#   bash test/rls.sh
set -uo pipefail
cd "$(dirname "$0")/.."
DB=lmtest_rls
SCHEMA="$PWD/supabase/migrations/0001_form_schema.sql"

# Roles are cluster-wide, so a leftover from a previous run must go first.
su postgres <<SH >/dev/null 2>&1
psql -q -d postgres -c "drop database if exists $DB"
psql -q -d postgres -c "drop database if exists lmtest"
psql -q -d postgres -c "drop owned by app_anon cascade"
psql -q -d postgres -c "drop role if exists app_anon"
psql -q -d postgres -c "create database $DB"
SH

su postgres <<SH >/dev/null 2>&1
psql -q -v ON_ERROR_STOP=1 -d $DB <<'SQL'
create schema if not exists auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
create or replace function auth.uid() returns uuid language sql stable as
  \$\$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid \$\$;
SQL
psql -q -v ON_ERROR_STOP=1 -d $DB -f "$SCHEMA"
SH
if [ $? -ne 0 ]; then echo "  ✗ schema failed to apply"; exit 1; fi

RESULT=$(su postgres <<SH
psql -q -t -A -d $DB <<'SQL'
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','a@test'),
  ('22222222-2222-2222-2222-222222222222','b@test');
insert into public.analyses (user_id, taken_at, quality) values
  ('11111111-1111-1111-1111-111111111111', now(), 'high'),
  ('22222222-2222-2222-2222-222222222222', now(), 'low');
create role app_anon nologin;
grant usage on schema public to app_anon;
grant select, insert, update, delete on public.profiles, public.analyses, public.recommendation_state to app_anon;
set role app_anon;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select 'A_sees=' || count(*) from public.analyses;
select 'A_reads=' || coalesce(max(quality),'x') from public.analyses;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select 'B_reads=' || coalesce(max(quality),'x') from public.analyses;
set request.jwt.claim.sub = '';
select 'anon_sees=' || count(*) from public.analyses;
select 'anon_profiles=' || count(*) from public.profiles;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
delete from public.analyses where user_id='22222222-2222-2222-2222-222222222222';
reset role;
select 'B_survived=' || count(*) from public.analyses where user_id='22222222-2222-2222-2222-222222222222';
SQL
SH
)

# Cross-user INSERT and UPDATE must both be refused.
CROSS=$(su postgres <<SH 2>&1
psql -q -d $DB <<'SQL'
set role app_anon;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.analyses (user_id, taken_at, quality) values ('22222222-2222-2222-2222-222222222222', now(), 'high');
SQL
SH
)
CROSSUP=$(su postgres <<SH 2>&1
psql -q -t -A -d $DB <<'SQL'
set role app_anon;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update public.analyses set quality = 'high' where user_id = '22222222-2222-2222-2222-222222222222';
reset role;
select 'B_untouched=' || count(*) from public.analyses where user_id='22222222-2222-2222-2222-222222222222' and quality = 'low';
SQL
SH
)

fail=0
ALL=$(printf '%s\n%s\n' "$RESULT" "$CROSSUP")
check () { if grep -qx "$1" <<<"$ALL"; then echo "  ✓ $2"; else echo "  ✗ $2 — got: $(grep -E "^${1%%=*}=" <<<"$ALL")"; fail=1; fi; }

echo "row-level security"
check "A_sees=1"        "user A sees exactly one analysis (their own)"
check "A_reads=high"      "user A reads their own row, not user B's"
check "B_reads=low"      "user B reads their own row, not user A's"
check "anon_sees=0"     "an unauthenticated caller sees no analyses"
check "anon_profiles=0" "an unauthenticated caller sees no profiles"
check "B_survived=1"    "user A cannot delete user B's row"
check "B_untouched=1"   "user A cannot update user B's row"

if grep -q "violates row-level security" <<<"$CROSS"; then
  echo "  ✓ user A cannot insert a row belonging to user B"
else
  echo "  ✗ user A CAN insert as user B — RLS is broken"; fail=1
fi

su postgres <<SH >/dev/null 2>&1
psql -q -d postgres -c "drop database if exists $DB"
psql -q -d postgres -c "drop owned by app_anon cascade"
psql -q -d postgres -c "drop role if exists app_anon"
SH

echo
if [ $fail -eq 0 ]; then echo "RLS: all checks passed"; else echo "RLS: FAILURES"; exit 1; fi
