import type { ReactNode } from 'react';

/**
 * The phone-width column the whole product lives in.
 *
 * Desktop gets a wider reading measure rather than a stretched phone (§26) —
 * the content column stays the same, the surrounding space becomes editorial.
 */
export function Shell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <main
      id="main"
      className={`mx-auto w-full max-w-[var(--container-app)] px-5 pb-24 sm:px-6 ${className}`}
    >
      {children}
    </main>
  );
}
