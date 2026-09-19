import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { Label } from '@/components/ui/Label';

export default function NotFound() {
  return (
    <Shell className="flex min-h-svh flex-col justify-center">
      <Label>Not found</Label>
      <h1 className="mt-3 font-display text-h1 font-semibold text-balance text-ink">
        There&rsquo;s nothing here.
      </h1>
      <p className="mt-3 text-sm text-ink-muted">The page you were after doesn&rsquo;t exist.</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-14 items-center justify-center rounded-full bg-accent px-8 font-medium text-ink-invert"
      >
        Go to the start
      </Link>
    </Shell>
  );
}
