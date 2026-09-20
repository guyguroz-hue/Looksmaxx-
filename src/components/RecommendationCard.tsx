'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Recommendation } from '@/lib/analysis/types';
import { saveState } from '@/lib/supabase/sync';
import { CATEGORY_LABEL, timeframe } from '@/lib/analysis/pipeline';
import { EVIDENCE_LABEL } from '@/content/protocols';
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
        <span className="text-sm tabular-nums leading-6 text-ink-subtle">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <p className="text-label font-medium uppercase tracking-[0.1em] text-ink-subtle">
            {CATEGORY_LABEL[rec.category]}
          </p>
          <h3
            className={`mt-1.5 text-h2 font-semibold text-balance ${
              done ? 'text-ink-subtle line-through decoration-ink-subtle/50' : 'text-ink'
            }`}
          >
            {rec.title}
          </h3>
          {rec.personalised && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent-wash px-2.5 py-1 text-xs font-medium text-accent-ink">
              <span aria-hidden className="size-1.5 rounded-full bg-accent" />
              Based on your reading
            </p>
          )}

        <p className="mt-4 text-sm leading-relaxed text-ink-muted">{rec.why}</p>

        {/* Evidence grade and time-to-effect sit together because they answer
            the same question: how much should I believe this, and by when? */}
        <dl className="mt-5 grid grid-cols-2 gap-x-4 rounded-md border border-hairline bg-surface/60 p-3.5">
          <div>
            <dt className="text-label uppercase tracking-[0.12em] text-ink-subtle">Evidence</dt>
            <dd className={`mt-1 text-sm font-medium ${
              rec.evidence === 'A' ? 'text-good-ink' : rec.evidence === 'B' ? 'text-ink' : 'text-warn-ink'
            }`}>
              {EVIDENCE_LABEL[rec.evidence]}
            </dd>
          </div>
          <div>
            <dt className="text-label uppercase tracking-[0.12em] text-ink-subtle">Expect change</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{timeframe(rec.weeks)}</dd>
          </div>
        </dl>

        <div className="mt-3 flex flex-wrap gap-2">
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

              {rec.caution && (
                <p className="mt-4 rounded-sm border-l-2 border-warn bg-warn-wash/40 py-2.5 pl-3 pr-2 text-xs leading-relaxed text-ink-muted">
                  {rec.caution}
                </p>
              )}

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
