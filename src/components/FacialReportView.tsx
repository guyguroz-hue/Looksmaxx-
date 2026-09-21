'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GROUP_LABEL, MUTABILITY_LABEL,
  type FacialMetric, type FacialReport, type MetricGroup, type Mutability,
} from '@/lib/vision/facialReport';
import { Label } from './ui/Label';

/**
 * The measurement report.
 *
 * This is the screen a person opens to have their own face explained to them.
 * Two things keep it from becoming a scorecard: no metric is ever coloured by
 * how close it sits to its reference range, and every one carries a plain
 * statement of whether it can change at all. A number you cannot act on is
 * information; a number you cannot act on dressed as a target is a problem.
 */

const MUTABILITY_STYLE: Record<Mutability, string> = {
  bone: 'bg-surface text-ink-subtle border-line',
  soft: 'bg-accent-wash text-accent-ink border-accent-edge',
  surface: 'bg-good-wash text-good-ink border-good/30',
};

const ORDER: MetricGroup[] = ['proportion', 'jaw', 'eyes', 'brows', 'nose', 'mouth', 'forehead', 'symmetry'];

function Row({ metric }: { metric: FacialMetric }) {
  const [open, setOpen] = useState(false);
  const inRange = metric.typical
    ? metric.value >= metric.typical[0] && metric.value <= metric.typical[1]
    : null;

  return (
    <li className="border-t border-hairline first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-baseline gap-3 py-3.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">
            {metric.label}
            {metric.approximate && (
              <span className="ml-1.5 text-xs font-normal text-ink-subtle">est.</span>
            )}
          </span>
          {metric.typical && (
            <span className="mt-0.5 block text-xs tabular-nums text-ink-subtle">
              typical {metric.typical[0]}–{metric.typical[1]}
              {metric.unit === '°' ? '°' : metric.unit === 'mm' ? ' mm' : ''}
              {inRange === false && <span className="ml-1.5 text-ink-subtle">· yours sits outside</span>}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-lg font-semibold tabular-nums text-ink">
            {metric.value}
            <span className="ml-0.5 text-xs font-normal text-ink-subtle">
              {metric.unit === 'ratio' ? '' : metric.unit}
            </span>
          </span>
        </span>
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-ink-subtle"
        >
          ↓
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-5">
              <span
                className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium ${MUTABILITY_STYLE[metric.mutability]}`}
              >
                {MUTABILITY_LABEL[metric.mutability]}
              </span>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{metric.reading}</p>
              {metric.lever && (
                <p className="mt-3 border-l-2 border-accent-edge pl-3 text-sm leading-relaxed text-ink-muted">
                  <span className="font-medium text-ink">What moves it: </span>
                  {metric.lever}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export function FacialReportView({ report }: { report: FacialReport }) {
  const byGroup = ORDER
    .map((g) => ({ group: g, items: report.metrics.filter((m) => m.group === g) }))
    .filter((g) => g.items.length > 0);

  const changeable = report.metrics.filter((m) => m.mutability !== 'bone').length;

  return (
    <div>
      {report.shape && (
        <div className="rounded-lg border border-line bg-surface p-5">
          <Label>Face shape</Label>
          <h3 className="mt-2 text-h1 text-ink">{report.shape.label}</h3>
          <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{report.shape.detail}</p>
        </div>
      )}

      <p className="mt-6 text-sm leading-relaxed text-ink-muted">
        {report.metrics.length} measurements, taken in millimetres using the iris in your photo as a
        physical ruler. {changeable} of them respond to something you can do; the rest are bone, and
        are here so you know what you are working with rather than guessing at it.
      </p>

      {report.mmPerUnit == null && (
        <p className="mt-4 rounded-md border-l-2 border-warn bg-warn-wash/40 py-3 pl-4 pr-3 text-sm leading-relaxed text-ink-muted">
          The iris was not sharp enough to calibrate millimetres in this frame, so the
          length measurements are left out rather than guessed at. Every ratio and angle below is
          unaffected. A closer, better-lit photo will bring the lengths back.
        </p>
      )}

      <div className="mt-10 space-y-10">
        {byGroup.map(({ group, items }) => (
          <section key={group} aria-labelledby={`g-${group}`}>
            <div className="flex items-center gap-4">
              <h3 id={`g-${group}`} className="text-label uppercase tracking-[0.12em] text-ink-subtle">
                {GROUP_LABEL[group]}
              </h3>
              <span aria-hidden className="h-px flex-1 bg-hairline" />
            </div>
            <ul className="mt-3">
              {items.map((m) => <Row key={m.id} metric={m} />)}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-12 border-t border-hairline pt-6 text-xs leading-relaxed text-ink-subtle">
        Typical ranges are population references, not targets. They come from anthropometric
        literature that skews toward the groups it happened to measure, and sitting outside one is
        information rather than a defect. FORM produces no overall figure, and never compares you
        to another person.
      </p>
    </div>
  );
}
