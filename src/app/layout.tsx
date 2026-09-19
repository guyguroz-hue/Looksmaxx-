import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import './globals.css';
import { TabBar } from '@/components/TabBar';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

/** One display face carries the editorial voice. Optical sizing keeps the big
 *  headlines tight without the small text turning fussy. */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
});

export const metadata: Metadata = {
  title: 'FORM — Better habits. Sharper you.',
  description:
    'Scan, understand what already works, and get a practical plan built around what you can actually change. Not a score.',
  applicationName: 'FORM',
  other: { 'color-scheme': 'light' },
};

export const viewport: Viewport = {
  themeColor: '#FAFAF8',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-4 focus:py-2 focus:shadow-md"
        >
          Skip to content
        </a>
        {children}
        <TabBar />
      </body>
    </html>
  );
}
