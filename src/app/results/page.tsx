'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Shell } from '@/components/Shell';
import { Label } from '@/components/ui/Label';
import { RecommendationCard } from '@/components/RecommendationCard';
import { useSession } from '@/lib/store';
import { LOW_CONFIDENCE_NOTE } from '@/lib/analysis/quality';

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export default function ResultsPage() {
  const { session, hydrated, toggle } = useSession();
  const [preview, setPreview] = useState<string | null>(null);
  const result = session.lastResult;

  useEffect(() => {
    setPreview(sessionStorage.getItem('form.preview'));
  }, []);

  if (!hydrated) return <Shell className="pt-20"><p className="text-sm text-ink-subtle">Loading…</p></Shell>;

  if (!result) {
    return (
      <Shell className="flex min-h-svh flex-col justify-center">
        <Label>Nothing here yet</Label>
        <h1 className="mt-3 text-h1 font-semibold text-ink">
          Your first read starts here.
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          One photo is all it takes.
        </p>
        <div className="mt-8">
          <Link href="/scan" className="inline-flex h-14 items-center justify-center rounded-full bg-accent px-8 font-medium text-ink-invert">
            Take a photo
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell className="pt-10">
      {/* ── the moment ───────────────────────────────────────────── */}
      <motion.header {...fadeUp} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <Label>Your read</Label>
        <h1 className="mt-3 text-h1 font-semibold text-balance text-ink">
          Here&rsquo;s what stands out.
        </h1>
      </motion.header>

      {preview && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-7 overflow-hidden rounded-xl border border-line"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="The photo you just took" className="w-full -scale-x-100" />
        </motion.div>
      )}

      {result.quality.confidence === 'low' && (
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-5 rounded-md border-l-2 border-warn bg-warn-wash/50 py-3 pl-4 pr-3 text-sm leading-relaxed text-ink-muted"
        >
          {LOW_CONFIDENCE_NOTE}
        </motion.p>
      )}

      {/* ── what already works — named first, on purpose ─────────── */}
      {result.strengths.length > 0 && (
        <motion.section
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mt-14"
          aria-labelledby="strengths-h"
        >
          <Label>Already working</Label>
          <h2 id="strengths-h" className="mt-2 text-h2 font-semibold text-ink">
            Keep doing this
          </h2>
          <ul className="mt-6 space-y-6">
            {result.strengths.map((s) => (
              <li key={s.id} className="flex gap-4">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-good" />
                <div>
                  <h3 className="text-sm font-semibold text-ink">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">{s.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {/* ── opportunities ─────────────────────────────────────────── */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.5, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mt-16"
        aria-labelledby="opps-h"
      >
        <Label>Worth trying</Label>
        <h2 id="opps-h" className="mt-2 text-h1 font-semibold text-balance text-ink">
          {result.opportunities.length} things you could experiment with
        </h2>
        <p className="mt-3 text-sm text-ink-muted">
          Ordered by what is likely to matter most for the least effort. Nothing here is a verdict.
        </p>

        <div className="mt-10">
          {result.opportunities.map((rec, i) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              index={i}
              saved={session.saved.includes(rec.id)}
              done={session.done.includes(rec.id)}
              onSave={() => toggle('saved', rec.id)}
              onDone={() => toggle('done', rec.id)}
            />
          ))}
        </div>
      </motion.section>

      <div className="mt-14 space-y-2">
        <Link
          href="/plan"
          className="flex h-14 w-full items-center justify-center rounded-full bg-accent font-medium text-ink-invert transition-colors hover:bg-accent-hover"
        >
          See the full plan
        </Link>
        <Link
          href="/scan"
          className="flex h-11 w-full items-center justify-center rounded-full text-sm font-medium text-ink-muted hover:text-ink"
        >
          Retake the photo
        </Link>
      </div>
    </Shell>
  );
}
