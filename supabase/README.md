# Cloud sync setup

Optional. Skip all of this and the app works exactly as before — everything in
`localStorage`, nothing leaves the device.

## 1. Create the project

[supabase.com](https://supabase.com) → New project. The free tier covers this
app comfortably: the schema stores a few hundred bytes per scan, so the 500 MB
database ceiling is thousands of users deep.

## 2. Install the schema

Dashboard → **SQL Editor** → New query → paste all of `schema.sql` → Run.

This creates both tables **and their row-level-security policies**. Do not skip
it: the anon key in client code is public by design, and RLS is the only thing
standing between it and everyone else's rows.

## 3. Configure the client

Settings → API, then fill in `js/config.js`:

```js
export const SUPABASE_URL = 'https://xxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGci...';
```

Or per-deployment, without editing the file:

```html
<body data-supabase-url="https://xxxxx.supabase.co" data-supabase-key="eyJhbGci...">
```

The `anon` key is the public one. Never put the `service_role` key in client
code — it bypasses RLS entirely.

## 4. Point the magic link back at your site

Authentication → URL Configuration → **Site URL**: your deployed origin
(e.g. `https://looksmaxx-seven.vercel.app`), and add it under Redirect URLs.
Without this the sign-in link will bounce people to localhost.

## What syncs

| Synced | Not synced |
|---|---|
| Questionnaire answers | Photos and video frames |
| Score, potential, coverage | Face/pose landmarks |
| Per-domain and per-metric scores | Anything that could reconstruct a face |

The `scans` table has no column capable of holding an image. That is deliberate
— the privacy promise is enforced by the schema, not by client-side good
intentions.
