'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { CaptureStage } from '@/components/CaptureStage';
import { AnalysisSequence } from '@/components/AnalysisSequence';
import { useCapture, type CaptureOutput } from '@/hooks/useCapture';
import { explainCameraError, warmUp } from '@/lib/vision/detector';
import { runPipeline } from '@/lib/analysis/pipeline';
import { useSession } from '@/lib/store';

type Phase = 'prep' | 'live' | 'analyzing' | 'error';

export default function ScanPage() {
  const router = useRouter();
  const { session, update } = useSession();
  const [phase, setPhase] = useState<Phase>('prep');
  const [message, setMessage] = useState<string | null>(null);
  const [captured, setCaptured] = useState<CaptureOutput | null>(null);
  const { videoRef, live, start, stop } = useCapture();

  useEffect(() => { warmUp(); }, []);
  useEffect(() => stop, [stop]);

  const begin = useCallback(async () => {
    setPhase('live');
    setMessage(null);
    try {
      const out = await start();
      setCaptured(out);
      setPhase('analyzing');
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setMessage(explainCameraError(err));
      setPhase('error');
    }
  }, [start]);

  const complete = useCallback(() => {
    if (!captured) return;
    const result = runPipeline({
      face: captured.face,
      skin: captured.skin,
      quality: captured.quality,
      preferences: session.preferences,
    });
    update((s) => ({
      lastResult: result,
      history: [
        ...s.history,
        { at: result.createdAt, opportunityCount: result.opportunities.length, quality: result.quality.confidence },
      ].slice(-40),
    }));
    // The preview lives in memory only, for this session's reveal screen.
    sessionStorage.setItem('form.preview', captured.preview);
    router.replace('/results');
  }, [captured, session.preferences, update, router]);

  if (phase === 'analyzing') return <AnalysisSequence onDone={complete} />;

  return (
    <Shell className="flex min-h-svh flex-col pt-10">
      {phase === 'prep' && (
        <>
          <Label>Before you start</Label>
          <h1 className="mt-3 font-display text-h1 font-semibold text-balance text-ink">
            One photo, taken well.
          </h1>
          <p className="mt-3 max-w-[36ch] text-sm text-ink-muted">
            How the photo is taken changes what can be read from it more than anything else.
            Four things get you most of the way.
          </p>

          <ul className="mt-8 space-y-5 border-t border-hairline pt-8">
            {[
              ['Face a window', 'Soft frontal daylight. Not a lamp above you.'],
              ['Camera at eye level', 'Not looking up at you, not down.'],
              ['Neutral expression', 'Relaxed. No need to smile.'],
              ['Nothing covering your face', 'Hat and sunglasses off; hair off your forehead.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="mt-0.5 font-display text-sm tabular-nums text-ink-subtle">
                  0{i + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{t}</span>
                  <span className="mt-0.5 block text-sm text-ink-muted">{d}</span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-8 rounded-md border border-line bg-surface p-4 text-xs leading-relaxed text-ink-muted">
            Your photo is read on this device and is never uploaded. Closing this tab deletes it.
          </p>

          <div className="sticky bottom-0 -mx-5 mt-auto bg-canvas px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:-mx-6 sm:px-6">
            <Button full onClick={begin}>Open camera</Button>
          </div>
        </>
      )}

      {phase === 'live' && (
        <>
          <Label>Capturing</Label>
          <h1 className="mt-3 font-display text-h2 font-semibold text-ink">
            Line up and hold still
          </h1>

          <div className="mt-6">
            <CaptureStage
              videoRef={videoRef}
              quality={live.quality}
              found={live.found}
              progress={live.progress}
              measuring={live.progress > 0}
            />
          </div>

          <ul className="mt-6 space-y-2.5">
            {(live.quality?.checks ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4">
                <span className={`text-sm ${c.passed ? 'text-ink' : 'text-ink-subtle'}`}>
                  {c.label}
                </span>
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-[11px] ${
                    c.passed ? 'bg-good-wash text-good-ink' : 'bg-sunken text-ink-subtle'
                  }`}
                >
                  <span aria-hidden>{c.passed ? '✓' : '·'}</span>
                  <span className="sr-only">{c.passed ? 'ready' : 'adjust'}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-auto pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
            <Button full variant="ghost" size="md" onClick={() => { stop(); setPhase('prep'); }}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {phase === 'error' && (
        <div className="flex flex-1 flex-col justify-center py-20">
          <Label>Camera</Label>
          <h1 className="mt-3 font-display text-h1 font-semibold text-balance text-ink">
            That didn&rsquo;t open.
          </h1>
          <p className="mt-3 text-sm text-ink-muted">{message}</p>
          <div className="mt-8 space-y-2">
            <Button full onClick={begin}>Try again</Button>
            <Button full variant="ghost" size="md" onClick={() => router.push('/')}>
              Back
            </Button>
          </div>
        </div>
      )}
    </Shell>
  );
}
