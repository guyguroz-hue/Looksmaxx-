'use client';

import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { Label } from '@/components/ui/Label';
import { FacialReportView } from '@/components/FacialReportView';
import { useSession } from '@/lib/store';

export default function FacePage() {
  const { session, hydrated } = useSession();
  const report = session.lastResult?.report ?? null;

  if (!hydrated) return <Shell className="pt-20"><p className="text-sm text-ink-subtle">Loading…</p></Shell>;

  if (!report) {
    return (
      <Shell className="flex min-h-svh flex-col justify-center">
        <Label>Nothing measured yet</Label>
        <h1 className="mt-3 text-h1 text-balance text-ink">Your measurements start with a photo.</h1>
        <p className="mt-3 text-sm text-ink-muted">
          One frame gives every number on this page.
        </p>
        <Link
          href="/scan"
          className="mt-8 inline-flex h-14 items-center justify-center rounded-full bg-accent px-8 font-medium text-ink-invert"
        >
          Take a photo
        </Link>
      </Shell>
    );
  }

  return (
    <Shell className="pt-10">
      <header className="mb-8">
        <Label>Measurements</Label>
        <h1 className="mt-3 text-h1 text-balance text-ink">Your face, in numbers.</h1>
      </header>
      <FacialReportView report={report} />
    </Shell>
  );
}
