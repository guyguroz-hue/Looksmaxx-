'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';

/**
 * The analysis moment (§7).
 *
 * Not a spinner. The stages are real — each line names work the pipeline is
 * actually doing — and they advance on a schedule long enough to read. The
 * point is that the person understands something was examined, not that they
 * are entertained.
 */
const STAGES = [
  'Reading the frame',
  'Mapping proportions',
  'Checking light and angle',
  'Finding what already works',
  'Building your plan',
] as const;

export function AnalysisSequence({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (stage >= STAGES.length) { onDone(); return; }
    const t = setTimeout(() => setStage((s) => s + 1), stage === 0 ? 900 : 680);
    return () => clearTimeout(t);
  }, [stage, onDone]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-8">
      <motion.div
        aria-hidden
        className="relative mb-14 size-16"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      >
        <span className="absolute inset-0 rounded-full border border-accent-edge" />
        <span className="absolute inset-2 rounded-full border border-accent/40" />
        <span className="absolute inset-[26px] rounded-full bg-accent" />
      </motion.div>

      <div className="h-8 w-full text-center" role="status" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.p
            key={stage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="text-h2 font-semibold text-ink"
          >
            {STAGES[Math.min(stage, STAGES.length - 1)]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div aria-hidden className="mt-10 flex gap-1.5">
        {STAGES.map((_, i) => (
          <motion.span
            key={i}
            className="h-1 rounded-full"
            animate={{
              width: i === stage ? 22 : 6,
              backgroundColor: i <= stage ? 'var(--color-accent)' : 'var(--color-hairline)',
            }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </div>
  );
}
