'use client';

import { motion } from 'motion/react';
import type { RefObject } from 'react';
import type { PhotoQuality } from '@/lib/analysis/types';

/**
 * The camera stage.
 *
 * Guidance sits outside the frame, never on top of the face — a capture screen
 * that covers what you are trying to photograph is a capture screen nobody can
 * use. The guide ellipse firms up rather than flashing red: a normal face is
 * never an error state (§51).
 */
export function CaptureStage({
  videoRef, quality, found, progress, measuring,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  quality: PhotoQuality | null;
  found: boolean;
  progress: number;
  measuring: boolean;
}) {
  const locked = Boolean(quality?.checks.every((c) => c.passed));

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#111015]">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 size-full -scale-x-100 object-cover"
      />

      {/* Framing guide */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute inset-y-[9%] inset-x-[16%] rounded-[46%/38%] border"
          animate={{
            borderColor: locked ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.32)',
            borderWidth: locked ? 2 : 1,
          }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        />
        {measuring && (
          <motion.div
            className="absolute inset-x-0 h-24"
            style={{
              background:
                'linear-gradient(to bottom, transparent, rgba(255,255,255,0.14) 45%, rgba(255,255,255,0.34) 50%, rgba(255,255,255,0.14) 55%, transparent)',
            }}
            initial={{ top: '-10%' }}
            animate={{ top: '100%' }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </div>

      {/* Progress: a hairline, not a percentage */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
        <motion.div
          className="h-full bg-white"
          animate={{ width: `${Math.round(progress * 100)}%` }}
          transition={{ duration: 0.25 }}
        />
      </div>

      {/* One correction at a time — a list of faults is not guidance */}
      <div className="absolute inset-x-0 bottom-6 flex justify-center px-6">
        <motion.p
          key={found ? (quality?.primaryHint ?? 'good') : 'searching'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          role="status"
          aria-live="polite"
          className="rounded-full bg-black/55 px-4 py-2 text-center text-sm text-white backdrop-blur-sm"
        >
          {!found
            ? 'Looking for your face…'
            : measuring
              ? 'Hold still — measuring'
              : (quality?.primaryHint ?? 'Looks good. Hold it there.')}
        </motion.p>
      </div>
    </div>
  );
}
