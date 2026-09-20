'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shell } from '@/components/Shell';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/lib/store';
import { saveProfile } from '@/lib/supabase/sync';
import { INTAKE_STEPS, missingIn, type Intake } from '@/content/intake';

/**
 * Intake.
 *
 * One step per screen, with a "why we ask" on anything non-obvious. Volunteering
 * your weight to an app about your face is a real ask — the least it can do is
 * say what the number is for, before you type it.
 */
export default function IntakePage() {
  const router = useRouter();
  const { session, update } = useSession();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Intake>(session.intake);
  const [shown, setShown] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const current = INTAKE_STEPS[step]!;
  const missing = missingIn(current, draft);
  const isLast = step === INTAKE_STEPS.length - 1;

  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setTouched(false);
  };

  const next = () => {
    if (missing.length > 0) { setTouched(true); return; }
    if (!isLast) { setStep((s) => s + 1); window.scrollTo({ top: 0 }); return; }
    update({ intake: draft, onboarded: true });
    void saveProfile(draft).catch(() => {});
    router.push('/scan');
  };

  return (
    <Shell className="flex min-h-svh flex-col pt-8">
      <div className="flex gap-1.5" aria-hidden>
        {INTAKE_STEPS.map((s, i) => (
          <motion.span
            key={s.id}
            className="h-[3px] flex-1 rounded-full"
            animate={{ backgroundColor: i <= step ? 'var(--color-accent)' : 'var(--color-hairline)' }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 pb-8 pt-9"
        >
          <Label>Step {step + 1} of {INTAKE_STEPS.length}</Label>
          <h1 className="mt-3 text-h1 text-balance text-ink">{current.title}</h1>
          <p className="mt-2.5 max-w-[38ch] text-sm text-ink-muted">{current.lede}</p>

          <div className="mt-9 space-y-8">
            {current.fields.map((f) => {
              const missingThis = touched && missing.includes(f.id);
              return (
                <div key={String(f.id)}>
                  <div className="flex items-baseline justify-between gap-3">
                    <label
                      htmlFor={`f-${String(f.id)}`}
                      className="text-h3 text-ink"
                    >
                      {f.label}
                      {!('required' in f && f.required) && (
                        <span className="ml-1.5 text-xs font-normal text-ink-subtle">optional</span>
                      )}
                    </label>
                    {'why' in f && f.why && (
                      <button
                        type="button"
                        onClick={() => setShown((s) => (s === String(f.id) ? null : String(f.id)))}
                        aria-expanded={shown === String(f.id)}
                        className="shrink-0 text-xs text-ink-subtle underline decoration-dotted underline-offset-4 hover:text-accent-ink"
                      >
                        why we ask
                      </button>
                    )}
                  </div>

                  <AnimatePresence initial={false}>
                    {shown === String(f.id) && 'why' in f && f.why && (
                      <motion.p
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden text-sm leading-relaxed text-ink-muted"
                      >
                        <span className="mt-3 block border-l-2 border-accent-edge pl-3">{f.why}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <div className="mt-3.5">
                    {f.kind === 'number' && (
                      <div className="flex items-center gap-3">
                        <input
                          id={`f-${String(f.id)}`}
                          type="number"
                          inputMode="decimal"
                          min={f.min}
                          max={f.max}
                          step={f.step ?? 1}
                          placeholder={f.placeholder}
                          value={(draft[f.id] as number | null) ?? ''}
                          onChange={(e) => set(f.id, (e.target.value === '' ? null : Number(e.target.value)) as never)}
                          aria-invalid={missingThis}
                          className={`h-14 w-full rounded-md border bg-surface px-4 text-2xl tabular-nums text-ink placeholder:text-ink-subtle/50 focus:outline-none ${
                            missingThis ? 'border-danger' : 'border-line focus:border-accent'
                          }`}
                        />
                        <span className="shrink-0 text-sm text-ink-subtle">{f.unit}</span>
                      </div>
                    )}

                    {f.kind === 'choice' && (
                      <div className="grid gap-2" role="radiogroup" aria-labelledby={`f-${String(f.id)}`}>
                        {f.options.map((o) => {
                          const on = draft[f.id] === o.value;
                          return (
                            <button
                              key={String(o.label)}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              onClick={() => set(f.id, o.value as never)}
                              className={`flex items-center gap-3 rounded-md border px-4 py-3.5 text-left transition-colors duration-150 ${
                                on ? 'border-accent bg-accent-wash' : 'border-line bg-surface hover:border-line-strong'
                              }`}
                            >
                              <span
                                aria-hidden
                                className={`size-4 shrink-0 rounded-full border-2 transition-colors ${
                                  on ? 'border-accent bg-accent' : 'border-line-strong'
                                }`}
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-ink">{o.label}</span>
                                {o.note && <span className="mt-0.5 block text-xs text-ink-subtle">{o.note}</span>}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {f.kind === 'multi' && (
                      <div className="flex flex-wrap gap-2">
                        {f.options.map((o) => {
                          const list = (draft[f.id] as unknown[]) ?? [];
                          const on = list.includes(o.value);
                          return (
                            <button
                              key={String(o.label)}
                              type="button"
                              aria-pressed={on}
                              onClick={() => {
                                const cur = [...list];
                                const i = cur.indexOf(o.value);
                                if (i >= 0) cur.splice(i, 1);
                                else if (cur.length < f.max) cur.push(o.value);
                                set(f.id, cur as never);
                              }}
                              className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
                                on ? 'border-accent bg-accent-wash text-accent-ink' : 'border-line bg-surface text-ink-muted hover:border-line-strong'
                              }`}
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {touched && missing.length > 0 && (
            <p role="alert" className="mt-6 text-sm text-danger-ink">
              Fill in the required fields above to continue.
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="sticky bottom-0 -mx-5 mt-10 space-y-2 bg-canvas/90 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-lg sm:-mx-6 sm:px-6">
        <Button full onClick={next}>{isLast ? 'Take the photo' : 'Continue'}</Button>
        <Button
          full
          variant="ghost"
          size="md"
          onClick={() => (step === 0 ? router.push('/') : setStep((s) => s - 1))}
        >
          Back
        </Button>
      </div>
    </Shell>
  );
}
