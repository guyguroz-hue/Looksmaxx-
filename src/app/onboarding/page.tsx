'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Shell } from '@/components/Shell';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/lib/store';
import type { Category, UserPreferences } from '@/lib/analysis/types';

const GOALS: { id: Category; label: string; hint: string }[] = [
  { id: 'hair', label: 'Hair', hint: 'Shape and framing' },
  { id: 'grooming', label: 'Grooming', hint: 'Beard, brows, edges' },
  { id: 'skin', label: 'Skin', hint: 'Simple, steady habits' },
  { id: 'style', label: 'Style', hint: 'Fit and silhouette' },
  { id: 'photo', label: 'Photos', hint: 'Light and angle' },
  { id: 'presentation', label: 'Presentation', hint: 'How you carry it' },
];

const STYLES: { id: NonNullable<UserPreferences['style']>; label: string }[] = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'classic', label: 'Classic' },
  { id: 'street', label: 'Street' },
  { id: 'sporty', label: 'Sporty' },
  { id: 'smart', label: 'Smart' },
  { id: 'experimental', label: 'Experimental' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { session, update } = useSession();
  const [step, setStep] = useState<0 | 1>(0);
  const [goals, setGoals] = useState<Category[]>([...session.preferences.goals]);
  const [style, setStyle] = useState<UserPreferences['style']>(session.preferences.style);
  const [glasses, setGlasses] = useState<boolean | null>(session.preferences.wearsGlasses);

  const toggleGoal = (id: Category) =>
    setGoals((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));

  const finish = () => {
    update({
      preferences: { ...session.preferences, goals, style, wearsGlasses: glasses },
      onboarded: true,
    });
    router.push('/scan');
  };

  return (
    <Shell className="flex min-h-svh flex-col pt-10">
      {/* Progress: two marks, not a percentage. */}
      <div className="flex gap-1.5" aria-hidden>
        {[0, 1].map((i) => (
          <span
            key={i}
            className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${
              i <= step ? 'bg-accent' : 'bg-hairline'
            }`}
          />
        ))}
      </div>

      <div className="flex-1 pt-10">
        {step === 0 ? (
          <>
            <Label>Step 1 of 2</Label>
            <h1 className="mt-3 font-display text-h1 font-semibold text-balance text-ink">
              What would you like to work on?
            </h1>
            <p className="mt-3 text-sm text-ink-muted">
              Pick any that apply. This changes the order of what you see, not the findings.
            </p>

            <ul className="mt-8 grid grid-cols-2 gap-2.5">
              {GOALS.map((g) => {
                const on = goals.includes(g.id);
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => toggleGoal(g.id)}
                      aria-pressed={on}
                      className={`h-full w-full rounded-md border p-4 text-left transition-[border-color,background-color] duration-200 ${
                        on
                          ? 'border-accent bg-accent-wash'
                          : 'border-line bg-surface hover:border-line-strong'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-ink">{g.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-subtle">{g.hint}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <>
            <Label>Step 2 of 2</Label>
            <h1 className="mt-3 font-display text-h1 font-semibold text-balance text-ink">
              How would you describe your style?
            </h1>
            <p className="mt-3 text-sm text-ink-muted">
              So suggestions sound like you. You can skip this.
            </p>

            <ul className="mt-8 flex flex-wrap gap-2">
              {STYLES.map((s) => {
                const on = style === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setStyle(on ? null : s.id)}
                      aria-pressed={on}
                      className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-[border-color,background-color] duration-200 ${
                        on
                          ? 'border-accent bg-accent-wash text-accent-ink'
                          : 'border-line bg-surface text-ink-muted hover:border-line-strong'
                      }`}
                    >
                      {s.label}
                    </button>
                  </li>
                );
              })}
            </ul>

            <fieldset className="mt-10">
              <legend className="text-sm font-semibold text-ink">Do you wear glasses?</legend>
              <p className="mt-1 text-xs text-ink-subtle">
                Frames change facial framing more than almost anything else, so it is worth knowing.
              </p>
              <div className="mt-4 flex gap-2">
                {[
                  { v: true, l: 'Yes' },
                  { v: false, l: 'No' },
                  { v: null, l: 'Sometimes' },
                ].map(({ v, l }) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setGlasses(v)}
                    aria-pressed={glasses === v}
                    className={`flex-1 rounded-full border px-4 py-2.5 text-sm font-medium transition-[border-color,background-color] duration-200 ${
                      glasses === v
                        ? 'border-accent bg-accent-wash text-accent-ink'
                        : 'border-line bg-surface text-ink-muted hover:border-line-strong'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 mt-10 space-y-2 bg-canvas px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:-mx-6 sm:px-6">
        <Button full onClick={() => (step === 0 ? setStep(1) : finish())}>
          {step === 0 ? 'Continue' : 'Take the photo'}
        </Button>
        <Button
          full
          variant="ghost"
          size="md"
          onClick={() => (step === 0 ? router.push('/') : setStep(0))}
        >
          Back
        </Button>
      </div>
    </Shell>
  );
}
