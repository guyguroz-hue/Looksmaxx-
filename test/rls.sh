#!/usr/bin/env bash
# Row-level-security test for supabase/schema.sql.
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
SCHEMA="$PWD/supabase/schema.sql"

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
insert into public.scans (user_id, taken_at, overall) values
  ('11111111-1111-1111-1111-111111111111', now(), 77),
  ('22222222-2222-2222-2222-222222222222', now(), 42);
create role app_anon nologin;
grant usage on schema public to app_anon;
grant select, insert, update, delete on public.profiles, public.scans to app_anon;
set role app_anon;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select 'A_sees=' || count(*) from public.scans;
select 'A_score=' || coalesce(max(overall)::text,'x') from public.scans;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select 'B_score=' || coalesce(max(overall)::text,'x') from public.scans;
set request.jwt.claim.sub = '';
select 'anon_sees=' || count(*) from public.scans;
select 'anon_profiles=' || count(*) from public.profiles;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
delete from public.scans where user_id='22222222-2222-2222-2222-222222222222';
reset role;
select 'B_survived=' || count(*) from public.scans where user_id='22222222-2222-2222-2222-222222222222';
SQL
SH
)

# Cross-user INSERT and UPDATE must both be refused.
CROSS=$(su postgres <<SH 2>&1
psql -q -d $DB <<'SQL'
set role app_anon;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.scans (user_id, taken_at, overall) values ('22222222-2222-2222-2222-222222222222', now(), 99);
SQL
SH
)
CROSSUP=$(su postgres <<SH 2>&1
psql -q -t -A -d $DB <<'SQL'
set role app_anon;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update public.scans set overall = 1 where user_id = '22222222-2222-2222-2222-222222222222';
reset role;
select 'B_untouched=' || count(*) from public.scans where user_id='22222222-2222-2222-2222-222222222222' and overall = 42;
SQL
SH
)

fail=0
ALL=$(printf '%s\n%s\n' "$RESULT" "$CROSSUP")
check () { if grep -qx "$1" <<<"$ALL"; then echo "  ✓ $2"; else echo "  ✗ $2 — got: $(grep -E "^${1%%=*}=" <<<"$ALL")"; fail=1; fi; }

echo "row-level security"
check "A_sees=1"        "user A sees exactly one scan (their own)"
check "A_score=77"      "user A sees their own score, not user B's"
check "B_score=42"      "user B sees their own score, not user A's"
check "anon_sees=0"     "an unauthenticated caller sees no scans"
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
