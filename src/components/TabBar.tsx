'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/results', label: 'Read' },
  { href: '/face', label: 'Face' },
  { href: '/plan', label: 'Plan' },
  { href: '/progress', label: 'Progress' },
] as const;

/** Only shown once there is something to navigate between. */
export function TabBar() {
  const path = usePathname();
  if (!TABS.some((t) => path.startsWith(t.href))) return null;

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas/85 backdrop-blur-lg"
    >
      <ul className="mx-auto flex max-w-[var(--container-app)] px-5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-6">
        {TABS.map((t) => {
          const active = path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-11 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  active ? 'text-ink' : 'text-ink-subtle hover:text-ink-muted'
                }`}
              >
                {t.label}
                {active && <span aria-hidden className="ml-2 size-1 rounded-full bg-accent" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
