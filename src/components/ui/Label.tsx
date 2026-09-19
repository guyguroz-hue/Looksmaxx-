import type { ReactNode } from 'react';

/** The small tracked-out label that sits above a section heading. */
export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-label font-medium uppercase tracking-[0.1em] text-ink-subtle ${className}`}>
      {children}
    </p>
  );
}
