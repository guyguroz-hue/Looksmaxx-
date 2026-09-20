'use client';

/**
 * Sync.
 *
 * The rule this module exists to enforce: numbers and text go up, images never
 * do. `preview` is a data URL held in sessionStorage for the current reveal and
 * is deliberately absent from everything below.
 */

import { supabase, explain } from './client';

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];
import type { AnalysisResult, Category } from '@/lib/analysis/types';
import type { Intake } from '@/content/intake';
import type { RecommendationState, StoredAnalysis } from './database.types';
import { parseList, recommendationSchema, strengthSchema } from './schemas';

export async function currentUser() {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

export async function sendMagicLink(email: string): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error('Cloud sync is not configured for this deployment.');
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${location.origin}/results` },
  });
  if (error) throw new Error(explain(error.message));
}

export async function signOut(): Promise<void> {
  await supabase()?.auth.signOut();
}

export function onAuthChange(fn: (signedIn: boolean) => void): () => void {
  const sb = supabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_e, session) => fn(Boolean(session)));
  return () => data.subscription.unsubscribe();
}

export async function saveProfile(preferences: Intake): Promise<void> {
  const sb = supabase();
  const user = await currentUser();
  if (!sb || !user) return;
  const { error } = await sb.from('profiles').upsert({ id: user.id, preferences: preferences as unknown as Json });
  if (error) throw new Error(explain(error.message));
}

export async function saveAnalysis(result: AnalysisResult): Promise<void> {
  const sb = supabase();
  const user = await currentUser();
  if (!sb || !user) return;
  const { error } = await sb.from('analyses').insert({
    user_id: user.id,
    taken_at: new Date(result.createdAt).toISOString(),
    quality: result.quality.confidence,
    // Observations keep their evidence so the report can be redrawn. No frame,
    // no landmark array, nothing that could reconstruct a face.
    observations: result.observations as unknown as Json,
    strengths: result.strengths as unknown as Json,
    opportunities: [...result.opportunities, ...result.additional] as unknown as Json,
  });
  // A duplicate timestamp means this analysis is already stored — not an error.
  if (error && !error.message.includes('duplicate')) throw new Error(explain(error.message));
}

export async function saveState(
  entries: readonly { id: string; category: Category; state: RecommendationState }[],
): Promise<void> {
  const sb = supabase();
  const user = await currentUser();
  if (!sb || !user || entries.length === 0) return;
  const { error } = await sb.from('recommendation_state').upsert(
    entries.map((e) => ({
      user_id: user.id,
      recommendation_id: e.id,
      category: e.category,
      state: e.state,
    })),
    { onConflict: 'user_id,recommendation_id' },
  );
  if (error) throw new Error(explain(error.message));
}

export async function fetchHistory(): Promise<readonly StoredAnalysis[]> {
  const sb = supabase();
  const user = await currentUser();
  if (!sb || !user) return [];
  const { data, error } = await sb
    .from('analyses')
    .select('taken_at, quality, strengths, opportunities')
    .eq('user_id', user.id)
    .order('taken_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(explain(error.message));
  // Validated rather than cast: a row written by an older build should degrade
  // to fewer items, never to a crash.
  return (data ?? []).map((r) => ({
    takenAt: new Date(r.taken_at).getTime(),
    quality: r.quality,
    strengths: parseList(r.strengths, strengthSchema),
    opportunities: parseList(r.opportunities, recommendationSchema),
  }));
}

/** Deleting locally must delete remotely too, or the button is a lie. */
export async function deleteEverything(): Promise<void> {
  const sb = supabase();
  const user = await currentUser();
  if (!sb || !user) return;
  await sb.from('recommendation_state').delete().eq('user_id', user.id);
  await sb.from('analyses').delete().eq('user_id', user.id);
  await sb.from('profiles').delete().eq('id', user.id);
}
