'use client';

import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/lib/store';
import { CATEGORY_LABEL } from '@/lib/analysis/pipeline';

/**
 * Progress (§18).
 *
 * Counts what you explored, never how you rate. There is no trend line here on
 * purpose — a chart of a person's face over time is an invitation to check it
 * daily, and the product explicitly asks people not to.
 */
export default function ProgressPage() {
  const { session, hydrated, reset, toggle } = useSession();

  if (!hydrated) return <Shell className="pt-20"><p className="text-sm text-ink-subtle">Loading…</p></Shell>;

  const all = session.lastResult
    ? [...session.lastResult.opportunities, ...session.lastResult.additional]
    : [];
  const tried = all.filter((r) => session.done.includes(r.id));
  const saved = all.filter((r) => session.saved.includes(r.id));
  const lastScan = session.history.at(-1);
  const daysSince = lastScan ? Math.floor((Date.now() - lastScan.at) / 86_400_000) : null;

  return (
    <Shell className="pt-10">
      <header>
        <Label>Progress</Label>
        <h1 className="mt-3 font-display text-h1 font-semibold text-balance text-ink">
          What you&rsquo;ve explored.
        </h1>
      </header>

      <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {[
          ['Things tried', tried.length],
          ['Saved for later', saved.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-surface p-5">
            <dd className="font-display text-[2rem] font-semibold tabular-nums leading-none text-ink">
              {value}
            </dd>
            <dt className="mt-2 text-xs text-ink-subtle">{label}</dt>
          </div>
        ))}
      </dl>

      {/* Deliberately discourages daily checking. */}
      <p className="mt-4 text-xs leading-relaxed text-ink-subtle">
        {daysSince === null
          ? 'No read yet.'
          : daysSince < 14
            ? `Last read ${daysSince === 0 ? 'today' : `${daysSince} day${daysSince === 1 ? '' : 's'} ago`}. Give changes a few weeks before looking again — most of them need that long to show.`
            : `Last read ${daysSince} days ago. A good moment for another, if you want one.`}
      </p>

      {tried.length > 0 && (
        <section className="mt-14" aria-labelledby="tried-h">
          <Label>Tried</Label>
          <h2 id="tried-h" className="mt-2 font-display text-h2 font-semibold text-ink">
            You gave these a go
          </h2>
          <ul className="mt-6 divide-y divide-hairline">
            {tried.map((r) => (
              <li key={r.id} className="flex items-start gap-3 py-4">
                <span aria-hidden className="mt-1 text-good">✓</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{r.title}</p>
                  <p className="mt-0.5 text-xs text-ink-subtle">{CATEGORY_LABEL[r.category]}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {saved.length > 0 && (
        <section className="mt-14" aria-labelledby="saved-h">
          <Label>Saved</Label>
          <h2 id="saved-h" className="mt-2 font-display text-h2 font-semibold text-ink">
            Kept for later
          </h2>
          <ul className="mt-6 divide-y divide-hairline">
            {saved.map((r) => (
              <li key={r.id} className="flex items-start gap-3 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{r.title}</p>
                  <p className="mt-0.5 text-xs text-ink-subtle">{CATEGORY_LABEL[r.category]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle('saved', r.id)}
                  className="shrink-0 text-xs text-ink-subtle underline hover:text-ink"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tried.length === 0 && saved.length === 0 && (
        <div className="mt-14 rounded-lg border border-dashed border-line p-8 text-center">
          <p className="text-sm text-ink-muted">
            Nothing marked yet. Try something from your plan and it will show up here.
          </p>
          <Link href="/plan" className="mt-4 inline-block text-sm font-medium text-accent-ink underline">
            Open the plan
          </Link>
        </div>
      )}

      <section className="mt-16 border-t border-hairline pt-8" aria-labelledby="data-h">
        <h2 id="data-h" className="text-sm font-semibold text-ink">Your data</h2>
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          Everything lives in this browser. Photos were never stored at all — they are read in
          memory and discarded when the tab closes.
        </p>
        <div className="mt-4">
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              if (confirm('Delete everything FORM has stored? This cannot be undone.')) reset();
            }}
          >
            Delete everything
          </Button>
        </div>
      </section>
    </Shell>
  );
}
