/* Supabase client + the sync layer.
 *
 * The rule this file exists to enforce: **numbers go up, images never do.**
 * Frames and landmarks stay in page memory and die with the tab. What syncs is
 * the questionnaire and the derived scores — enough to move between devices and
 * keep a history, and not enough to reconstruct a face.
 *
 * Everything degrades: with no configuration, every function here is a no-op
 * and the app is exactly the offline-only tool it was before.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm';

function readConfig() {
  const d = document.body?.dataset ?? {};
  return {
    url: d.supabaseUrl || SUPABASE_URL,
    key: d.supabaseKey || SUPABASE_ANON_KEY,
  };
}

export const isConfigured = () => {
  const { url, key } = readConfig();
  return Boolean(url && key);
};

let clientPromise = null;
async function client() {
  if (!isConfigured()) return null;
  if (!clientPromise) {
    const { url, key } = readConfig();
    clientPromise = import(/* @vite-ignore */ CDN).then(({ createClient }) =>
      createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }));
  }
  return clientPromise;
}

/* ─────────────────────────── auth ─────────────────────────── */

/** Passwordless sign-in. No password to leak, reset, or store. */
export async function sendMagicLink(email) {
  const sb = await client();
  if (!sb) throw new Error('סנכרון ענן אינו מוגדר בפרויקט הזה');
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw new Error(translate(error.message));
  return true;
}

export async function currentUser() {
  const sb = await client();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data?.session?.user ?? null;
}

export async function signOut() {
  const sb = await client();
  await sb?.auth.signOut();
}

/** Fires whenever the session changes — including when a magic link lands. */
export async function onAuthChange(fn) {
  const sb = await client();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_e, session) => fn(session?.user ?? null));
  return () => data?.subscription?.unsubscribe();
}

/* ─────────────────────────── data ─────────────────────────── */

/**
 * A scan row. Note what is absent: no image, no landmark array, nothing that
 * could rebuild the face. `metrics` keeps id/value/score triples so the report
 * can be redrawn, and that is the whole payload.
 */
const scanRow = (result) => ({
  taken_at: new Date(result.at).toISOString(),
  overall: result.overall,
  potential: result.potential,
  coverage: result.coverage?.pct ?? null,
  domains: Object.fromEntries(Object.entries(result.domains ?? {})
    .map(([k, d]) => [k, { score: d.score, potential: d.potential }])),
  metrics: (result.metrics ?? [])
    .filter(m => m.available)
    .map(m => ({ id: m.id, value: m.value, score: m.score })),
});

export async function saveProfile(answers) {
  const sb = await client();
  const user = await currentUser();
  if (!sb || !user) return null;
  const { error } = await sb.from('profiles')
    .upsert({ id: user.id, answers, updated_at: new Date().toISOString() });
  if (error) throw new Error(translate(error.message));
  return true;
}

export async function saveScan(result) {
  const sb = await client();
  const user = await currentUser();
  if (!sb || !user) return null;
  const { error } = await sb.from('scans').insert({ user_id: user.id, ...scanRow(result) });
  if (error) throw new Error(translate(error.message));
  return true;
}

/** Push everything held locally. Used once, right after sign-up. */
export async function pushLocal({ answers, history }) {
  const sb = await client();
  const user = await currentUser();
  if (!sb || !user) return { pushed: 0 };
  if (answers) await saveProfile(answers);
  if (!history?.length) return { pushed: 0 };

  const rows = history.map(h => ({
    user_id: user.id,
    taken_at: new Date(h.at).toISOString(),
    overall: h.overall, potential: h.potential, coverage: h.coverage,
    domains: h.domains ?? {}, metrics: [],
  }));
  // taken_at is unique per user, so a repeated sync cannot duplicate history.
  const { error } = await sb.from('scans')
    .upsert(rows, { onConflict: 'user_id,taken_at', ignoreDuplicates: true });
  if (error) throw new Error(translate(error.message));
  return { pushed: rows.length };
}

export async function fetchAll() {
  const sb = await client();
  const user = await currentUser();
  if (!sb || !user) return null;
  const [{ data: profile }, { data: scans, error }] = await Promise.all([
    sb.from('profiles').select('answers').eq('id', user.id).maybeSingle(),
    sb.from('scans').select('*').eq('user_id', user.id).order('taken_at', { ascending: true }),
  ]);
  if (error) throw new Error(translate(error.message));
  return {
    answers: profile?.answers ?? null,
    history: (scans ?? []).map(r => ({
      at: new Date(r.taken_at).getTime(),
      overall: r.overall, potential: r.potential, coverage: r.coverage,
      domains: r.domains ?? {},
    })),
  };
}

/** Deleting the account deletes the rows — the cascade is in the schema. */
export async function deleteRemote() {
  const sb = await client();
  const user = await currentUser();
  if (!sb || !user) return null;
  await sb.from('scans').delete().eq('user_id', user.id);
  await sb.from('profiles').delete().eq('id', user.id);
  return true;
}

/* Supabase speaks English; the user does not have to. */
function translate(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('rate limit') || m.includes('too many')) return 'נשלחו יותר מדי בקשות. נסה שוב בעוד דקה.';
  if (m.includes('invalid') && m.includes('email')) return 'כתובת האימייל אינה תקינה.';
  if (m.includes('network') || m.includes('fetch')) return 'אין חיבור לשרת. הנתונים נשמרו מקומית.';
  if (m.includes('row-level security') || m.includes('permission')) return 'אין הרשאה. ודא שהסכימה הותקנה כולל מדיניות ה-RLS.';
  return 'שגיאה בסנכרון. הנתונים נשמרו מקומית.';
}
