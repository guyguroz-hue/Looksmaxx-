'use client';

import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { Label } from '@/components/ui/Label';
import { RecommendationCard } from '@/components/RecommendationCard';
import { useSession } from '@/lib/store';
import { groupByHorizon } from '@/lib/analysis/pipeline';

/**
 * The plan (§16).
 *
 * Grouped by when a thing is worth doing rather than by category, because the
 * question a person actually has is "what do I do now" — not "show me all the
 * hair items".
 */
export default function PlanPage() {
  const { session, hydrated, toggle } = useSession();
  const result = session.lastResult;

  if (!hydrated) return <Shell className="pt-20"><p className="text-sm text-ink-subtle">Loading…</p></Shell>;

  if (!result) {
    return (
      <Shell className="flex min-h-svh flex-col justify-center">
        <Label>No plan yet</Label>
        <h1 className="mt-3 font-display text-h1 font-semibold text-ink">
          A plan needs a photo first.
        </h1>
        <Link href="/scan" className="mt-8 inline-flex h-14 items-center justify-center rounded-full bg-accent px-8 font-medium text-ink-invert">
          Take a photo
        </Link>
      </Shell>
    );
  }

  const all = [...result.opportunities, ...result.additional]
    .filter((r) => !session.dismissed.includes(r.id));
  const groups = groupByHorizon(all);
  const doneCount = all.filter((r) => session.done.includes(r.id)).length;

  return (
    <Shell className="pt-10">
      <header>
        <Label>Your plan</Label>
        <h1 className="mt-3 font-display text-h1 font-semibold text-balance text-ink">
          Small steps, in order.
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          {doneCount > 0
            ? `You have tried ${doneCount} of ${all.length}. There is no schedule to keep up with.`
            : 'Start with one. Nothing here expires.'}
        </p>
      </header>

      {groups.map((group, gi) => (
        <section key={group.horizon} className="mt-14" aria-labelledby={`g-${group.horizon}`}>
          <div className="flex items-center gap-4">
            <h2
              id={`g-${group.horizon}`}
              className="text-label font-medium uppercase tracking-[0.1em] text-ink-subtle"
            >
              {group.label}
            </h2>
            <span aria-hidden className="h-px flex-1 bg-hairline" />
            <span className="text-xs tabular-nums text-ink-subtle">{group.items.length}</span>
          </div>

          <div className="mt-8">
            {group.items.map((rec, i) => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                index={gi * 100 + i}
                saved={session.saved.includes(rec.id)}
                done={session.done.includes(rec.id)}
                onSave={() => toggle('saved', rec.id)}
                onDone={() => toggle('done', rec.id)}
              />
            ))}
          </div>
        </section>
      ))}

      <p className="mt-16 border-t border-hairline pt-8 text-xs leading-relaxed text-ink-subtle">
        FORM reads presentation, not health. Nothing here is medical advice, and no observation
        here is a diagnosis. For anything that concerns you, speak to a qualified professional.
      </p>
    </Shell>
  );
}
