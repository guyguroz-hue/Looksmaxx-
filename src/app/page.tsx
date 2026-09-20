import Link from 'next/link';
import { Shell } from '@/components/Shell';

/**
 * Welcome.
 *
 * One idea per screen (§21): what this is, and what it refuses to be. The
 * second half of that is the whole positioning, so it goes above the fold
 * rather than into a footnote.
 */
export default function WelcomePage() {
  return (
    <Shell className="flex min-h-svh flex-col pt-14">
      <header className="flex-1">
        <p className="text-[1.375rem] font-semibold tracking-[0.18em] text-ink">
          FORM
        </p>

        <h1 className="mt-16 text-display text-balance text-ink">
          Small changes.
          <br />
          <span className="text-accent-ink">Real ones.</span>
        </h1>

        <p className="mt-6 max-w-[33ch] text-body text-ink-muted">
          One photo and a few honest answers. FORM reads what it can actually
          measure, then tells you what is worth doing about it — and how long
          it will take.
        </p>

        <ul className="mt-12 space-y-4 border-t border-hairline pt-8">
          {[
            ['Never a score.', 'No rating, no ranking, no comparison to anyone else.'],
            ['Evidence, graded honestly.', 'Every suggestion says how strong the evidence behind it is — including when it is weak.'],
            ['Your photo stays here.', 'Read on your device, never uploaded, gone when you close the tab.'],
          ].map(([bold, rest]) => (
            <li key={bold} className="flex gap-3 text-sm leading-relaxed">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
              <span className="text-ink-muted">
                <strong className="font-semibold text-ink">{bold}</strong> {rest}
              </span>
            </li>
          ))}
        </ul>
      </header>

      <div className="sticky bottom-0 -mx-5 mt-12 bg-canvas px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:-mx-6 sm:px-6">
        <Link
          href="/onboarding"
          className="flex h-14 w-full items-center justify-center rounded-full bg-accent text-base font-medium text-ink-invert transition-colors duration-200 hover:bg-accent-hover active:scale-[0.985]"
        >
          Start
        </Link>
        <p className="mt-3 text-center text-xs text-ink-subtle">
Four quick steps, then one photo. Under two minutes.
        </p>
      </div>
    </Shell>
  );
}
