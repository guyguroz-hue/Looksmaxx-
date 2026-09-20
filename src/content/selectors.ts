/**
 * Which protocols fire, and why this person specifically.
 *
 * Two inputs, and they answer different questions. The camera says what the
 * face currently looks like; the intake says what is likely causing it. Full
 * cheeks at a healthy body weight and full cheeks at a high one look identical
 * to a lens and need opposite advice — that distinction is the whole reason
 * the intake exists.
 */

import type { FaceMeasurements } from '@/lib/vision/faceMeasure';
import type { SkinReading } from '@/lib/vision/skinRead';
import { bmi, type Intake } from './intake';
import { PROTOCOL_BY_ID, type Protocol } from './protocols';
import type { Observation, Strength } from '@/lib/analysis/types';

export interface Context {
  readonly face: FaceMeasurements;
  readonly skin: SkinReading | null;
  readonly intake: Intake;
}

/* ── skin-tone calibration ──────────────────────────────────────────
   Redness is measured against a neutral baseline. A single baseline for every
   tone reads normal skin as inflamed for some people and misses real redness
   in others. Confidence drops for the deepest tones because erythema is
   genuinely harder to see through melanin in visible light — the honest
   response is to say so, not to pretend otherwise. */
const TONE = {
  1: { base: 11.0, confidence: 1.0 },
  2: { base: 12.0, confidence: 1.0 },
  3: { base: 13.0, confidence: 0.95 },
  4: { base: 13.5, confidence: 0.85 },
  5: { base: 13.0, confidence: 0.7 },
  6: { base: 12.0, confidence: 0.55 },
} as const;

export interface Finding {
  readonly protocol: Protocol;
  /** Replaces the protocol's generic `why` when the cause is known. */
  readonly personalWhy?: string;
  readonly observation?: Observation;
  /** Multiplies ranking weight. Used to surface a known cause. */
  readonly boost: number;
}

const obs = (
  id: string, category: Observation['category'], observed: string,
  metric: string, value: number, confidence: Observation['confidence'],
): Observation => ({ id, category, observed, evidence: { metric, value: Math.round(value * 1000) / 1000 }, confidence });

const P = (id: string): Protocol => {
  const p = PROTOCOL_BY_ID.get(id);
  if (!p) throw new Error(`unknown protocol: ${id}`);
  return p;
};

export function select(ctx: Context): Finding[] {
  const { face, skin, intake } = ctx;
  const out: Finding[] = [];
  const add = (id: string, boost = 1, personalWhy?: string, observation?: Observation) =>
    out.push({ protocol: P(id), boost, personalWhy, observation });

  const weight = bmi(intake);
  const fullness = face.ratios.fullness ?? 0;
  const underEye = skin?.underEyeContrast ?? null;
  const toneSpread = skin?.toneSpread ?? null;

  /* ── facial fullness: fluid or composition? ─────────────────────── */
  if (fullness > 0.755) {
    const o = obs('fullness', 'presentation',
      'The outline of the face reads full through the cheeks and lower third.',
      'fullness', fullness, 'medium');

    if (weight != null && weight < 25) {
      // Full face at a healthy weight is a fluid pattern. Telling this person
      // to change their body composition would be both useless and harmful.
      add('nutrition.sodium', 2.0,
        'Your face reads full, but your height and weight sit in the healthy range — which points at overnight fluid rather than body composition. Evening salt is the usual driver, and it reverses within a day or two.', o);
      add('facial.lymphatic', 1.8);
      add('nutrition.water', 1.4);
      add('nutrition.alcohol', intake.alcohol === 'frequent' || intake.alcohol === 'weekly' ? 1.6 : 0.8);
    } else if (weight != null && weight >= 27) {
      add('body.composition', 1.5,
        'Facial fullness tracks body composition closely, and yours suggests that is the larger lever here. Gradual change is the point — fast loss costs muscle and shows in the skin.', o);
      add('nutrition.protein', 1.2);
    } else {
      add('nutrition.sodium', 1.3, undefined, o);
      add('facial.lymphatic', 1.2);
    }
  }

  /* ── jaw and neck definition ────────────────────────────────────── */
  const cheekToJaw = face.ratios.cheekToJaw ?? 0;
  if (cheekToJaw > 1.32) {
    const o = obs('lower-third', 'grooming',
      'The cheekbone line sits wider than the jaw line, so the lower third reads softer by comparison.',
      'cheekToJaw', cheekToJaw, 'medium');
    add('grooming.jawline', 1.6, undefined, o);
    add('facial.posture', 1.4);
    add('facial.exercise', 0.9);
  }

  /* ── head carriage ──────────────────────────────────────────────── */
  if (Math.abs(face.capture.roll) > 5) {
    add('facial.posture', 1.3, undefined, obs('head-tilt', 'presentation',
      `The head was carried about ${Math.abs(face.capture.roll).toFixed(1)}° off level.`,
      'roll', face.capture.roll, 'medium'));
  }

  /* ── under-eye: the intake decides what this means ──────────────── */
  if (underEye != null && underEye > 5) {
    const o = obs('under-eye', 'skin',
      'The area beneath the eyes reads darker than the cheek in this frame.',
      'underEyeContrast', underEye, 'low');

    if (intake.sleepHours != null && intake.sleepHours < 6.5) {
      add('sleep.duration', 2.2,
        `The under-eye area reads dark and you are sleeping around ${intake.sleepHours} hours. That is the first thing to rule out, and it is also the fastest-moving one — a controlled study found the same people were rated as looking less healthy after a short night.`, o);
      add('facial.lymphatic', 1.3);
    } else if (intake.waterLitres != null && intake.waterLitres < 1.5) {
      add('nutrition.water', 1.8,
        'The under-eye area reads dark despite reasonable sleep, and your fluid intake is on the low side. Mild dehydration deepens that hollow — worth ruling out before assuming it is structural.', o);
      add('facial.lymphatic', 1.2);
    } else {
      add('facial.lymphatic', 1.4,
        'The under-eye area reads dark even though sleep and fluids look reasonable. For many people this is simply how the skin and vessels sit there — drainage and lighting will shift how it photographs, and the rest is worth accepting rather than chasing.', o);
      add('skin.moisturise', 1.0);
    }
    if (intake.alcohol === 'frequent') add('nutrition.alcohol', 1.5);
  }

  /* ── tone evenness ──────────────────────────────────────────────── */
  const toneCeiling = 6.0 + Math.max(0, (intake.age ?? 30) - 20) * 0.07;
  if (toneSpread != null && toneSpread > toneCeiling) {
    const o = obs('tone', 'skin',
      'Lightness varies across the face in this image.',
      'toneSpread', toneSpread, 'low');

    if (intake.sunProtection === 'never') {
      add('skin.spf', 2.4,
        'Tone reads uneven and you are not using sun protection. This is the single highest-evidence change available to you — a controlled trial measured roughly a quarter less visible ageing in daily users over four and a half years.', o);
    } else if (intake.sunProtection === 'sometimes') {
      add('skin.spf', 1.6,
        'You reach for sun protection in strong sun. The trial evidence is specifically about daily use — most cumulative exposure is the incidental kind, not the beach kind.', o);
    }
    add('skin.moisturise', 1.3, undefined, intake.sunProtection === 'daily' ? o : undefined);
    if ((intake.age ?? 0) >= 25) add('skin.retinol', 1.2);
    add('skin.vitc', 0.9);
  }

  /* ── redness, calibrated to declared skin tone ──────────────────── */
  if (skin && intake.skinTone) {
    const tone = TONE[intake.skinTone];
    const cheekRedness = Math.max(0, (skin.localDetail ?? 0) - tone.base * 0.15);
    if (cheekRedness > 1.6 || intake.skinType === 'sensitive') {
      add('skin.calm', intake.skinType === 'sensitive' ? 1.7 : 1.2,
        intake.skinType === 'sensitive'
          ? 'You describe your skin as sensitive. When redness is persistent, the usual cause is a barrier that has been worked too hard — doing less for a fortnight changes more than adding anything.'
          : undefined);
      add('skin.niacinamide', 1.2);
    }
  }

  /* ── things true regardless of what the camera saw ───────────────── */
  if (intake.sunProtection !== 'daily') add('skin.spf', 1.4);
  if (intake.sleepHours != null && intake.sleepHours < 6.5) add('sleep.duration', 1.5);
  if (intake.smokes) {
    add('nutrition.smoking', 1.8,
      'Smoking narrows the vessels that feed the skin. It works directly against everything else in this plan, which is why it appears near the top of it.');
  }
  if (intake.trainingDays != null && intake.trainingDays === 0) add('body.composition', 0.9);
  if (intake.waterLitres != null && intake.waterLitres < 1.5) add('nutrition.water', 1.2);

  /* Foundations. Always relevant, deliberately ranked below anything with a
     measured cause behind it. */
  add('skin.cleanse', 0.6);
  add('skin.moisturise', 0.7);
  add('nutrition.protein', 0.6);
  add('nutrition.omega3', 0.5);
  add('grooming.brows', 0.5);
  add('hair.framing', 0.6);

  // Collapse duplicates, keeping the strongest boost and any personal copy.
  const best = new Map<string, Finding>();
  for (const f of out) {
    const prev = best.get(f.protocol.id);
    if (!prev || f.boost > prev.boost) {
      best.set(f.protocol.id, {
        ...f,
        personalWhy: f.personalWhy ?? prev?.personalWhy,
        observation: f.observation ?? prev?.observation,
      });
    } else if (f.personalWhy && !prev.personalWhy) {
      best.set(f.protocol.id, { ...prev, personalWhy: f.personalWhy });
    }
  }
  return [...best.values()];
}

/* ═════════════════════════ strengths ═════════════════════════
   Named first in the UI. The point is not reassurance — it is that people
   change things that were already working, by accident. */

export function strengths(ctx: Context): Strength[] {
  const { face, skin, intake } = ctx;
  const found: Strength[] = [];
  const weight = bmi(intake);

  if ((face.ratios.thirdsSpread ?? 1) < 0.16) {
    found.push({
      id: 'st.proportions', category: 'presentation',
      title: 'Your proportions are even',
      detail: 'The three vertical sections of your face fall close to equal. That is worth knowing because it means most hair shapes and frame styles will suit you — you have room to experiment rather than compensate.',
    });
  }
  if (face.mm.asymmetryMean != null && face.mm.asymmetryMean < 2 && Math.abs(face.capture.yaw) < 0.1) {
    found.push({
      id: 'st.symmetry', category: 'presentation',
      title: 'You read as even left to right',
      detail: 'Mirrored landmarks sit within about two millimetres of each other. Everyone is asymmetric to some degree; yours is well inside the range nobody perceives.',
    });
  }
  const c2j = face.ratios.cheekToJaw;
  if (c2j != null && c2j >= 1.12 && c2j <= 1.3) {
    found.push({
      id: 'st.jaw', category: 'grooming',
      title: 'Your jaw line already holds its width',
      detail: 'The lower third carries its own width against the cheekbones, so it reads clearly without any help. Keeping the neckline clean is enough to maintain that.',
    });
  }
  if (skin && (skin.toneSpread ?? 99) < 5) {
    found.push({
      id: 'st.tone', category: 'skin',
      title: 'Your skin tone is even',
      detail: 'Lightness varies little across your face. Even tone is most of what reads as healthy skin in a photograph, and it is harder to build than to keep.',
    });
  }
  if (intake.sunProtection === 'daily') {
    found.push({
      id: 'st.spf', category: 'skin',
      title: 'You already wear sun protection daily',
      detail: 'This is the highest-evidence habit in the entire product and you are already doing it. Whatever else changes, keep this one.',
    });
  }
  if (intake.sleepHours != null && intake.sleepHours >= 7.5) {
    found.push({
      id: 'st.sleep', category: 'routine',
      title: 'You are sleeping enough',
      detail: 'Seven or more hours is the input that moves facial appearance faster than anything else here — and it is already covered.',
    });
  }
  if (weight != null && weight >= 18.5 && weight <= 24.9 && intake.trainingDays != null && intake.trainingDays >= 3) {
    found.push({
      id: 'st.body', category: 'routine',
      title: 'Your habits are already doing the slow work',
      detail: 'Regular training with a healthy body composition supports skin blood flow, sleep quality and facial structure at once. None of the slow levers need your attention.',
    });
  }
  return found;
}
