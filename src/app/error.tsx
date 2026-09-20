'use client';

import { useEffect } from 'react';
import { Shell } from '@/components/Shell';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';

/** §41 — errors read like a person wrote them. Detail stays in the console. */
export default function ErrorBoundary({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <Shell className="flex min-h-svh flex-col justify-center">
      <Label>Something broke</Label>
      <h1 className="mt-3 text-h1 font-semibold text-balance text-ink">
        That didn&rsquo;t load.
      </h1>
      <p className="mt-3 text-sm text-ink-muted">
        Nothing you did caused this, and nothing was lost. Trying again usually works.
      </p>
      <div className="mt-8 space-y-2">
        <Button full onClick={reset}>Try again</Button>
        <Button full variant="ghost" size="md" onClick={() => { window.location.href = '/'; }}>
          Start over
        </Button>
      </div>
      {error.digest && (
        <p className="mt-8 font-mono text-xs text-ink-subtle">Reference: {error.digest}</p>
      )}
    </Shell>
  );
}
