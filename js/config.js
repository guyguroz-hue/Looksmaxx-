/* Cloud sync configuration.
 *
 * Fill these in from your Supabase project (Settings → API). The anon key is
 * designed to be public — it is safe in client code *because* row-level
 * security decides what it can reach, not because it is secret. The schema in
 * supabase/schema.sql sets those policies up; do not skip it.
 *
 * Leave these empty and the app still works completely: everything stays in
 * localStorage, exactly as it did before, and the sign-up prompt is hidden.
 *
 * These can also be set per-deployment without editing this file:
 *   <body data-supabase-url="..." data-supabase-key="...">
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
