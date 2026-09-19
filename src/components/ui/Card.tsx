import type { ReactNode } from 'react';

/**
 * A raised surface. Used sparingly on purpose — §20 says some information
 * should simply exist on the canvas, and a screen of identical cards is the
 * fastest way to look generated.
 */
export function Card({
  children, className = '', as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'article' | 'section' | 'li';
}) {
  return (
    <Tag className={`rounded-lg border border-line bg-surface shadow-xs ${className}`}>
      {children}
    </Tag>
  );
}
