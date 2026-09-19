'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant;
  readonly size?: Size;
  readonly loading?: boolean;
  readonly full?: boolean;
  readonly children: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-accent text-ink-invert hover:bg-accent-hover active:bg-accent-hover disabled:bg-ink-subtle',
  secondary:
    'bg-surface text-ink border border-line-strong hover:border-ink hover:bg-sunken',
  ghost: 'text-ink-muted hover:text-ink hover:bg-sunken',
};

const SIZE: Record<Size, string> = {
  md: 'h-11 px-5 text-sm',
  lg: 'h-14 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'lg', loading = false, full = false, children, className = '', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-full font-medium',
        'transition-[background-color,border-color,color,transform] duration-200',
        'active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100',
        VARIANT[variant],
        SIZE[size],
        full ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
        />
      )}
      {children}
    </button>
  );
});
