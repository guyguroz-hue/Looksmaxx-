import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { TabBar } from '@/components/TabBar';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FORM — Better habits. Sharper you.',
  description:
    'Scan, understand what already works, and get a practical plan built around what you can actually change. Not a score.',
  applicationName: 'FORM',
  other: { 'color-scheme': 'dark' },
};

export const viewport: Viewport = {
  themeColor: '#0C0B0F',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
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
