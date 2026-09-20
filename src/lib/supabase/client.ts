'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Cloud sync is optional. Unconfigured, every call here is a no-op. */
export const isConfigured = Boolean(URL && KEY);

let cached: SupabaseClient<Database> | null = null;

export function supabase(): SupabaseClient<Database> | null {
  if (!isConfigured) return null;
  cached ??= createBrowserClient<Database>(URL!, KEY!);
  return cached;
}

/** Supabase speaks English error codes; people do not. */
export function explain(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many requests. Try again in a minute.';
  if (m.includes('invalid') && m.includes('email')) return "That email address doesn't look right.";
  if (m.includes('row-level security') || m.includes('permission')) {
    return 'Permission denied. Check that the schema was installed, including its RLS policies.';
  }
  if (m.includes('network') || m.includes('fetch')) return 'No connection. Your data is safe on this device.';
  return 'Sync failed. Your data is safe on this device.';
}
