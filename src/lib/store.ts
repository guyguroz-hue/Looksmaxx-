'use client';

/**
 * Client-side session state.
 *
 * Deliberately plain: the flow is linear and small, and a state library here
 * would be more machinery than the problem needs. Photos live in memory only —
 * the object URL dies with the tab, and nothing writes image data to storage.
 */

import { useCallback, useEffect, useState } from 'react';
import type { AnalysisResult, UserPreferences } from './analysis/types';
import { DEFAULT_PREFERENCES } from './analysis/types';

const KEY = 'form.session.v1';

export interface Session {
  readonly preferences: UserPreferences;
  readonly onboarded: boolean;
  readonly lastResult: AnalysisResult | null;
  /** Ids the person chose to keep. */
  readonly saved: readonly string[];
  /** Ids they have marked done. */
  readonly done: readonly string[];
  /** Ids they said were not for them — these stop being suggested. */
  readonly dismissed: readonly string[];
  readonly history: readonly { at: number; opportunityCount: number; quality: string }[];
}

const EMPTY: Session = {
  preferences: DEFAULT_PREFERENCES,
  onboarded: false,
  lastResult: null,
  saved: [],
  done: [],
  dismissed: [],
  history: [],
};

function read(): Session {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Session>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function write(s: Session): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode or quota — the app keeps working from memory */
  }
}

let memory: Session = EMPTY;
const listeners = new Set<(s: Session) => void>();

function publish(next: Session): void {
  memory = next;
  write(next);
  listeners.forEach((fn) => fn(next));
}

export function useSession() {
  const [session, setLocal] = useState<Session>(memory);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Read once on mount so server and client markup match on first paint.
    memory = read();
    setLocal(memory);
    setHydrated(true);
    listeners.add(setLocal);
    return () => { listeners.delete(setLocal); };
  }, []);

  const update = useCallback((patch: Partial<Session> | ((s: Session) => Partial<Session>)) => {
    const next = typeof patch === 'function' ? patch(memory) : patch;
    publish({ ...memory, ...next });
  }, []);

  const toggle = useCallback((list: 'saved' | 'done' | 'dismissed', id: string) => {
    const current = memory[list];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    publish({ ...memory, [list]: next });
  }, []);

  const reset = useCallback(() => {
    try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
    publish(EMPTY);
  }, []);

  return { session, hydrated, update, toggle, reset };
}
