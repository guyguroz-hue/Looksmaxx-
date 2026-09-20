'use client';

/**
 * The capture loop.
 *
 * A single frame is not a measurement — landmark output jitters, and one shot
 * means a different answer every time you press the button. This runs a live
 * loop, keeps only frames that clear the quality gate, and fuses them with a
 * median so one bad frame cannot move the result.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { measureFace, type FaceMeasurements } from '@/lib/vision/faceMeasure';
import { readSkin, type SkinReading } from '@/lib/vision/skinRead';
import { assessQuality } from '@/lib/analysis/quality';
import { median } from '@/lib/vision/geometry';
import { loadFaceLandmarker } from '@/lib/vision/detector';
import type { AnalysisState, PhotoQuality } from '@/lib/analysis/types';
import type { Landmark } from '@/lib/vision/types';

/* Hold-steady, measured in TIME rather than animation frames.
 *
 * This counted 12 rAF ticks, which at 60fps is 0.2 seconds — the camera opened
 * and the shot was already taken. A face reading needs a settled frame, so the
 * gate must stay satisfied continuously for a real interval, and any failed
 * check resets it. A momentary lock is not a steady one. */
const HOLD_MS = 2600;
/* Below this many accepted samples the median has nothing to reject, so a
 * fast device that clears HOLD_MS quickly still has to supply real frames. */
const MIN_SAMPLES = 24;

export interface CaptureOutput {
  readonly face: FaceMeasurements;
  readonly skin: SkinReading | null;
  readonly quality: PhotoQuality;
  readonly preview: string;
}

/** Median of every numeric leaf across the accepted frames. */
function fuse(samples: readonly FaceMeasurements[]): FaceMeasurements {
  const first = samples[0]!;
  const pick = (get: (m: FaceMeasurements) => number | null): number | null =>
    median(samples.map(get).filter((v): v is number => v != null));

  return {
    capture: {
      ...first.capture,
      roll: pick((m) => m.capture.roll) ?? first.capture.roll,
      yaw: pick((m) => m.capture.yaw) ?? first.capture.yaw,
      pitch: pick((m) => m.capture.pitch) ?? first.capture.pitch,
      interpupillaryMm: pick((m) => m.capture.interpupillaryMm),
    },
    mm: Object.fromEntries(
      Object.keys(first.mm).map((k) => [k, pick((m) => m.mm[k as keyof typeof m.mm])]),
    ) as FaceMeasurements['mm'],
    ratios: Object.fromEntries(
      Object.keys(first.ratios).map((k) => [k, pick((m) => m.ratios[k] ?? null) ?? 0]),
    ),
  };
}

export function useCapture() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const samplesRef = useRef<FaceMeasurements[]>([]);
  const landmarksRef = useRef<Landmark[] | null>(null);
  const resolveRef = useRef<((out: CaptureOutput) => void) | null>(null);

  const [state, setState] = useState<AnalysisState>('idle');
  const holdStartRef = useRef<number | null>(null);
  const [live, setLive] = useState<{
    quality: PhotoQuality | null; progress: number; found: boolean; holding: boolean;
  }>({ quality: null, progress: 0, found: false, holding: false });
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  /** Grab the un-mirrored frame: the preview is flipped for comfort, but the
   *  pixels we sample must agree with the landmarks about which side is which. */
  const grab = useCallback((): { canvas: HTMLCanvasElement; data: ImageData } | null => {
    const video = videoRef.current;
    if (!video?.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return { canvas, data: ctx.getImageData(0, 0, canvas.width, canvas.height) };
  }, []);

  const start = useCallback(async (): Promise<CaptureOutput> => {
    setError(null);
    setState('capturing');
    samplesRef.current = [];
    holdStartRef.current = null;

    const detector = await loadFaceLandmarker();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1706 } },
      audio: false,
    });
    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) throw new Error('no video element');
    video.srcObject = stream;
    await video.play();

    return new Promise<CaptureOutput>((resolve, reject) => {
      resolveRef.current = resolve;

      const tick = () => {
        if (!streamRef.current) return reject(new DOMException('cancelled', 'AbortError'));
        const v = videoRef.current;
        if (!v?.videoWidth) { rafRef.current = requestAnimationFrame(tick); return; }

        let res;
        try { res = detector.detectForVideo(v, performance.now()); }
        catch { rafRef.current = requestAnimationFrame(tick); return; }

        const lm = res.faceLandmarks?.[0] as Landmark[] | undefined;
        if (!lm) {
          // Losing the face resets the hold — a shot stitched across a gap is
          // not the same shot.
          holdStartRef.current = null;
          samplesRef.current = [];
          setLive({ quality: null, progress: 0, found: false, holding: false });
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        landmarksRef.current = lm;
        const face = measureFace(lm, v.videoWidth, v.videoHeight);
        const quality = assessQuality(face.capture);
        const steady = quality.checks.every((c) => c.passed);

        if (steady) {
          holdStartRef.current ??= performance.now();
          samplesRef.current.push(face);
        } else {
          // Any failed check drops the hold back to zero, visibly.
          holdStartRef.current = null;
          samplesRef.current = [];
        }

        const heldFor = holdStartRef.current == null ? 0 : performance.now() - holdStartRef.current;
        setLive({
          quality,
          progress: Math.min(1, heldFor / HOLD_MS),
          found: true,
          holding: steady,
        });

        if (heldFor >= HOLD_MS && samplesRef.current.length >= MIN_SAMPLES) {
          setState('validating');
          const still = grab();
          const skin = still && landmarksRef.current
            ? readSkin(still.data, landmarksRef.current)
            : null;
          const fused = fuse(samplesRef.current);
          const finalQuality = assessQuality(
            fused.capture,
            skin ? { lightness: skin.lightness, balance: skin.lightBalance, detail: skin.localDetail } : undefined,
          );
          stop();
          setState('analyzing');
          resolve({
            face: fused,
            skin,
            quality: finalQuality,
            preview: still?.canvas.toDataURL('image/jpeg', 0.82) ?? '',
          });
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    });
  }, [grab, stop]);

  return { videoRef, state, setState, live, error, setError, start, stop };
}
