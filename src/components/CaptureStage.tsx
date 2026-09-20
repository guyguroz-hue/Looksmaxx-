'use client';

import { motion } from 'motion/react';
import type { RefObject } from 'react';
import type { PhotoQuality } from '@/lib/analysis/types';

/**
 * The camera stage.
 *
 * Guidance sits outside the frame, never over the face — a capture screen that
 * covers what you are photographing is one nobody can use. The ring shows how
 * much of the hold is banked, and visibly empties the moment a check drops, so
 * "hold still" is a state you can see rather than an instruction you are given.
 */
export function CaptureStage({
  videoRef, quality, found, progress, holding,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  quality: PhotoQuality | null;
  found: boolean;
  progress: number;
  holding: boolean;
}) {
  const R = 47;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-sunken ring-1 ring-line">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 size-full -scale-x-100 object-cover"
      />

      {/* Vignette so the guidance text always has something to sit on */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 90% at 50% 40%, transparent 52%, rgb(0 0 0 / 0.55))' }}
      />

      {/* Framing guide + hold ring */}
      <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
        <svg viewBox="0 0 100 100" className="h-[82%] -rotate-90" style={{ overflow: 'visible' }}>
          <ellipse
            cx="50" cy="50" rx="34" ry="44"
            fill="none"
            stroke={holding ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}
            strokeWidth="0.6"
            strokeDasharray={holding ? undefined : '3 4'}
            className="transition-all duration-300"
          />
          <circle cx="50" cy="50" r={R} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="1.6" />
          <motion.circle
            cx="50" cy="50" r={R}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray={C}
            animate={{ strokeDashoffset: C * (1 - progress) }}
            transition={{ duration: holding ? 0.2 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
      </div>

      {/* One correction at a time — a list of faults is not guidance */}
      <div className="absolute inset-x-0 bottom-5 flex justify-center px-6">
        <motion.p
          key={!found ? 'searching' : holding ? 'hold' : (quality?.primaryHint ?? 'idle')}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          role="status"
          aria-live="polite"
          className={`rounded-full px-4 py-2 text-center text-sm backdrop-blur-md ${
            holding ? 'bg-accent text-ink-invert font-medium' : 'bg-black/60 text-ink'
          }`}
        >
          {!found
            ? 'Looking for your face…'
            : holding
              ? 'Hold it right there'
              : (quality?.primaryHint ?? 'Line up with the guide')}
        </motion.p>
      </div>
    </div>
  );
}
