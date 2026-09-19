/**
 * Photo quality engine (§5).
 *
 * Runs before anything else. Its job is to be honest about whether the image
 * can support analysis at all — an app that returns confident findings from a
 * dark, angled selfie is lying, and the person cannot tell.
 */

import type { CaptureGeometry } from '@/lib/vision/faceMeasure';
import type { Confidence } from '@/lib/vision/types';
import type { PhotoQuality, QualityCheck } from './types';

/** Tolerances: loose enough to be usable handheld, tight enough to mean something. */
export const GATE = { roll: 6, yaw: 0.16, pitch: 0.09 } as const;

export interface ExposureReading {
  /** Mean cheek lightness in CIE-Lab L*, 0..100. */
  readonly lightness: number;
  /** Left/right lightness difference — high means side-lit. */
  readonly balance: number;
  /** Local contrast; very low suggests heavy smoothing or a filter. */
  readonly detail: number;
}

function checkOf(
  id: string,
  label: string,
  passed: boolean,
  level: number,
  hint: string,
): QualityCheck {
  return { id, label, passed, level: Math.max(0, Math.min(1, level)), hint };
}

/**
 * @param geo  head orientation from the measurement pass
 * @param exp  pixel readings, absent while the live preview is still running
 */
export function assessQuality(geo: CaptureGeometry, exp?: ExposureReading): PhotoQuality {
  const falloff = (v: number, limit: number): number => 1 - Math.abs(v) / (limit * 1.8);

  const checks: QualityCheck[] = [
    checkOf('framing', 'Face fills the frame', geo.hasIris, geo.hasIris ? 1 : 0.2,
      'Move a little closer so your face fills the guide.'),
    checkOf('level', 'Head level', Math.abs(geo.roll) <= GATE.roll, falloff(geo.roll, GATE.roll),
      'Straighten your head slightly.'),
    checkOf('facing', 'Facing the camera', Math.abs(geo.yaw) <= GATE.yaw, falloff(geo.yaw, GATE.yaw),
      geo.yaw > 0 ? 'Turn slightly to your left.' : 'Turn slightly to your right.'),
    checkOf('chin', 'Camera at eye level', Math.abs(geo.pitch) <= GATE.pitch, falloff(geo.pitch, GATE.pitch),
      geo.pitch > 0 ? 'Raise the camera a little.' : 'Lower the camera a little.'),
  ];

  if (exp) {
    const lit = exp.lightness > 32 && exp.lightness < 86;
    checks.push(checkOf('light', 'Even lighting', lit && exp.balance < 12,
      lit ? 1 - exp.balance / 24 : 0.3,
      exp.lightness <= 32 ? 'Find more light — face a window if you can.'
        : exp.lightness >= 86 ? 'This is a little bright. Step out of direct light.'
        : 'Turn toward the light so both sides are lit evenly.'));

    // Near-zero local contrast across skin is what a beauty filter looks like.
    checks.push(checkOf('unfiltered', 'No heavy filtering', exp.detail > 1.4,
      Math.min(1, exp.detail / 3),
      'Turn off beauty filters — they hide the detail we read.'));
  }

  const failed = checks.filter((c) => !c.passed);
  const critical = failed.filter((c) => c.id === 'framing' || c.id === 'light');

  let confidence: Confidence = 'high';
  if (failed.length >= 3 || critical.length > 0) confidence = 'low';
  else if (failed.length >= 1) confidence = 'medium';

  return {
    confidence,
    checks,
    // Low confidence is not a refusal — it downgrades what we claim, per §5.
    usable: geo.hasIris,
    primaryHint: failed[0]?.hint ?? null,
  };
}

/** Copy shown when confidence is low, so the limitation is stated, not buried. */
export const LOW_CONFIDENCE_NOTE =
  'This photo is not ideal for detailed reading, so we have kept the observations general. Retaking it in softer, even light will give you more specific suggestions.';
