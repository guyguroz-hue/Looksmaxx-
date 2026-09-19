import { Shell } from '@/components/Shell';

/** Skeleton rather than a spinner: the shape of the page arrives first. */
export default function Loading() {
  return (
    <Shell className="pt-10" aria-busy>
      <span className="sr-only">Loading</span>
      <div aria-hidden className="space-y-4">
        <div className="h-3 w-24 animate-pulse rounded-full bg-sunken" />
        <div className="h-9 w-3/4 animate-pulse rounded-md bg-sunken" />
        <div className="h-9 w-1/2 animate-pulse rounded-md bg-sunken" />
        <div className="mt-8 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-sunken" />
          ))}
        </div>
      </div>
    </Shell>
  );
}
