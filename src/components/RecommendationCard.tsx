'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Recommendation } from '@/lib/analysis/types';
import { saveState } from '@/lib/supabase/sync';
import { CATEGORY_LABEL } from '@/lib/analysis/pipeline';
import { ConfidenceIndicator, EffortIndicator, ImpactIndicator } from './ui/Indicator';

/**
 * Every card answers four questions (§52): what, why, how, and how much work.
 * The how-steps stay collapsed so the list is scannable — expanding is the
 * commitment, not the reading.
 */
export function RecommendationCard({
  rec, index, saved, done, onSave, onDone,
}: {
  rec: Recommendation;
  index: number;
  saved: boolean;
  done: boolean;
  onSave: () => void;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `how-${rec.id.replace(/\./g, '-')}`;

  return (
    <article className="border-t border-hairline py-7 first:border-t-0 first:pt-0">
      {/* A two-column grid keeps the index and the content aligned at every
          width — the previous hand-computed padding drifted at 320px. */}
      <div className="grid grid-cols-[1.75rem_1fr] gap-x-3">
        <span className="font-display text-sm tabular-nums leading-6 text-ink-subtle">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <p className="text-label font-medium uppercase tracking-[0.1em] text-ink-subtle">
            {CATEGORY_LABEL[rec.category]}
          </p>
          <h3
            className={`mt-1.5 font-display text-h2 font-semibold text-balance ${
              done ? 'text-ink-subtle line-through decoration-ink-subtle/50' : 'text-ink'
            }`}
          >
            {rec.title}
          </h3>

        <p className="mt-4 text-sm leading-relaxed text-ink-muted">{rec.why}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <ImpactIndicator impact={rec.impact} />
          <EffortIndicator effort={rec.effort} />
          <ConfidenceIndicator confidence={rec.confidence} />
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="mt-5 flex items-center gap-1.5 text-sm font-medium text-accent-ink hover:underline"
        >
          {open ? 'Hide steps' : 'How to try it'}
          <motion.span aria-hidden animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            ↓
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={panelId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <ol className="mt-4 space-y-3">
                {rec.how.map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
                    <span
                      aria-hidden
                      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-accent-edge text-[11px] tabular-nums text-accent-ink"
                    >
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>

              {rec.requiresProfessional && (
                <p className="mt-4 rounded-sm border-l-2 border-warn pl-3 text-xs leading-relaxed text-ink-muted">
                  If this is something that concerns you persistently, a qualified healthcare
                  professional can advise on what is appropriate. FORM does not diagnose.
                </p>
              )}

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onDone();
                    void saveState([{ id: rec.id, category: rec.category, state: 'tried' }]).catch(() => {});
                  }}
                  aria-pressed={done}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    done
                      ? 'border-good bg-good-wash text-good-ink'
                      : 'border-line-strong text-ink-muted hover:border-ink hover:text-ink'
                  }`}
                >
                  {done ? 'Tried ✓' : 'Mark as tried'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSave();
                    void saveState([{ id: rec.id, category: rec.category, state: 'saved' }]).catch(() => {});
                  }}
                  aria-pressed={saved}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    saved
                      ? 'border-accent bg-accent-wash text-accent-ink'
                      : 'border-line-strong text-ink-muted hover:border-ink hover:text-ink'
                  }`}
                >
                  {saved ? 'Saved' : 'Save'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </article>
  );
}
