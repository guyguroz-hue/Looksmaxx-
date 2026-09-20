# Cloud sync setup

Optional. Without it the app works completely — everything stays in
`localStorage` and the account panel says so.

## 1 · Install the schema

Supabase dashboard → **SQL Editor** → New query → paste all of
[`migrations/0001_form_schema.sql`](migrations/0001_form_schema.sql) → **Run**.

This creates three tables **and their row-level-security policies**. Do not skip
it. The anon key that ships in client code is public by design, and RLS is the
only thing standing between it and everyone else's rows.

It is safe to run more than once — every policy and trigger is dropped and
recreated, and the tables use `create table if not exists`.

## 2 · Point the app at the project

Dashboard → **Project Settings → API**, then set these as environment variables
(Vercel: Project → Settings → Environment Variables):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Locally, copy `.env.example` to `.env.local` and fill the same two values.

Use the **anon** key. Never put the `service_role` key in client code — it
bypasses RLS entirely and would expose every row to anyone who opens devtools.

## 3 · Make the sign-in link come back to your site

Dashboard → **Authentication → URL Configuration**:

- **Site URL**: your deployed origin, e.g. `https://looksmaxx-seven.vercel.app`
- **Redirect URLs**: add the same origin, plus `http://localhost:3000` for local work

Without this the magic link sends people to localhost.

## What syncs

| Synced | Never synced |
|---|---|
| Onboarding preferences | Photos and video frames |
| Observations and their evidence | Face landmarks |
| Strengths and recommendations as shown | Anything that could reconstruct a face |
| Saved / tried / dismissed state | |

The `analyses` table has no column capable of holding an image. That is the
point: the privacy promise is enforced by the schema, not by client-side good
intentions.

## Verifying the policies

```bash
bash test/rls.sh
```

Applies the schema to a local PostgreSQL and proves eight isolation properties —
that one user cannot read, insert, update or delete another's rows, and that an
unauthenticated caller sees nothing at all.
