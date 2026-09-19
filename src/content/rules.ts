/**
 * The interpretation catalogue.
 *
 * Every rule states three things separately: what the image SHOWS, what that
 * might MEAN for framing, and what the person could TRY. No rule is permitted
 * to call a feature good, bad, wrong or in need of fixing — read the copy and
 * you will find the subject of every sentence is a photograph, a haircut or a
 * collar, never a person.
 *
 * Rules that describe the camera come first by design. They are the most
 * reliably measurable, the most fixable, and the least loaded.
 */

import type { FaceMeasurements } from '@/lib/vision/faceMeasure';
import type { SkinReading } from '@/lib/vision/skinRead';
import type { Category, Confidence, Effort, Impact } from '@/lib/analysis/types';

export interface RuleContext {
  readonly face: FaceMeasurements;
  readonly skin: SkinReading | null;
  readonly wearsGlasses: boolean | null;
}

export interface Rule {
  readonly id: string;
  readonly category: Category;
  readonly metric: string;
  /** Returns the measured value when the rule applies, or null to stay silent. */
  readonly read: (c: RuleContext) => number | null;
  readonly fires: (value: number, c: RuleContext) => boolean;
  readonly unit?: string;
  /** What the image shows. Descriptive only. */
  readonly observed: (value: number) => string;
  /** What it might mean for how the image reads. Always hedged. */
  readonly inferred: string;
  readonly title: string;
  readonly why: string;
  readonly how: readonly string[];
  readonly impact: Impact;
  readonly effort: Effort;
  readonly confidence: Confidence;
  readonly horizon: 'now' | 'week' | 'month' | 'optional';
  readonly requiresProfessional?: boolean;
}

const mm = (v: number) => `${v.toFixed(1)} mm`;
const deg = (v: number) => `${v.toFixed(1)}°`;

/* ═══════════════════════════ camera & light ═══════════════════════════
   The most actionable category in the product. Nothing here is about the
   person at all — it is entirely about how the photograph was taken. */

const PHOTO: Rule[] = [
  {
    id: 'photo.camera-height',
    category: 'photo',
    metric: 'pitch',
    read: (c) => c.face.capture.pitch,
    fires: (v) => Math.abs(v) > 0.07,
    observed: (v) => `The camera sat ${v > 0 ? 'below' : 'above'} eye level for this shot.`,
    inferred:
      'Camera height changes apparent proportions more than most people expect — a low angle lengthens the jaw and shortens the forehead, a high angle does the reverse.',
    title: 'Bring the camera to eye level',
    why: 'Your camera was off eye level, which stretches whichever part of the face is closest to the lens. Levelling it is the single fastest way to get a photo that looks like you.',
    how: [
      'Hold the phone so the lens is level with your eyes.',
      'If you are propping it up, stack it to eye height rather than tilting it.',
      'Take one at eye level and one at your usual angle, then compare.',
    ],
    impact: 'high',
    effort: 'easy',
    confidence: 'high',
    horizon: 'now',
  },
  {
    id: 'photo.lighting-direction',
    category: 'photo',
    metric: 'lightBalance',
    read: (c) => c.skin?.lightBalance ?? null,
    fires: (v) => v > 9,
    observed: (v) => `One side of the face is noticeably brighter than the other (${v.toFixed(1)} L*).`,
    inferred:
      'Side lighting casts a shadow down one half of the face, which reads as asymmetry even when the underlying structure is even.',
    title: 'Turn toward the light',
    why: 'The light in this photo came from one side, so half your face is in shadow. Soft frontal light removes that shadow and shows more detail.',
    how: [
      'Face a window rather than standing beside or in front of it.',
      'Avoid a single overhead bulb — it drops shadow into the eye sockets.',
      'Overcast daylight is the easiest light there is.',
    ],
    impact: 'high',
    effort: 'easy',
    confidence: 'high',
    horizon: 'now',
  },
  {
    id: 'photo.exposure',
    category: 'photo',
    metric: 'lightness',
    read: (c) => c.skin?.lightness ?? null,
    fires: (v) => v < 34 || v > 84,
    observed: (v) => `Overall exposure reads ${v < 34 ? 'dark' : 'bright'} (L* ${v.toFixed(0)}).`,
    inferred: 'Under- and over-exposure both flatten texture and colour, which hides the detail that makes a photo look three-dimensional.',
    title: 'Fix the exposure',
    why: 'This frame is outside the range where skin tone and texture render properly, so the image loses depth.',
    how: [
      'Tap your face on screen before shooting so the camera meters for you, not the background.',
      'Drag the exposure slider down if the background is bright.',
      'Step away from direct sun into open shade.',
    ],
    impact: 'medium',
    effort: 'easy',
    confidence: 'high',
    horizon: 'now',
  },
  {
    id: 'photo.head-turn',
    category: 'photo',
    metric: 'yaw',
    read: (c) => c.face.capture.yaw,
    fires: (v) => Math.abs(v) > 0.14,
    observed: (v) => `The head was turned ${v > 0 ? 'to one side' : 'to the other side'} of square.`,
    inferred:
      'A turned head compresses the far side of the face in the image. Most apparent left-right difference in a photograph comes from this, not from the face.',
    title: 'Square up to the lens',
    why: 'Your head was turned away from the camera, which makes one side look smaller than it is.',
    how: [
      'Point your nose straight at the lens, then relax.',
      'If you prefer a three-quarter angle for photos, keep it — just take one square-on frame for comparison.',
    ],
    impact: 'medium',
    effort: 'easy',
    confidence: 'high',
    horizon: 'now',
  },
];

/* ═══════════════════════════ hair & framing ═══════════════════════════
   Face shape drives standard styling advice. Framed as what a shape *does*
   to framing, with alternatives offered — never as a shape to correct. */

const HAIR: Rule[] = [
  {
    id: 'hair.width-framing',
    category: 'hair',
    metric: 'widthToHeight',
    read: (c) => c.face.ratios.widthToHeight ?? null,
    fires: (v) => v > 0.78,
    observed: (v) => `Face width and height are close to each other (ratio ${v.toFixed(2)}).`,
    inferred:
      'Broader proportions take visual weight from the sides. Height on top and shorter sides tend to lengthen the frame; volume at the sides tends to widen it.',
    title: 'Try height on top, shorter at the sides',
    why: 'Your proportions are close to square, so hair that adds width at the sides competes with the face rather than framing it. Height changes the read.',
    how: [
      'Ask for more length on top and tapered sides.',
      'Dry with the airflow pointing up and back rather than down.',
      'Bring a photo to your barber — describing it rarely survives translation.',
    ],
    impact: 'high',
    effort: 'moderate',
    confidence: 'medium',
    horizon: 'month',
  },
  {
    id: 'hair.length-framing',
    category: 'hair',
    metric: 'widthToHeight',
    read: (c) => c.face.ratios.widthToHeight ?? null,
    fires: (v) => v < 0.66,
    observed: (v) => `The face reads longer than it is wide (ratio ${v.toFixed(2)}).`,
    inferred:
      'Longer proportions gain from width at the sides and lose from height on top, which extends the vertical line further.',
    title: 'Try width at the sides rather than height',
    why: 'Your proportions run vertical, so volume on top extends that line. Width around the temples balances it.',
    how: [
      'Keep some weight at the sides instead of a tight taper.',
      'A fringe or softer hairline shortens the vertical run.',
      'Avoid very high volume on top unless that is the look you want.',
    ],
    impact: 'medium',
    effort: 'moderate',
    confidence: 'medium',
    horizon: 'month',
  },
];

/* ═══════════════════════════ grooming ═══════════════════════════ */

const GROOMING: Rule[] = [
  {
    id: 'grooming.jaw-definition',
    category: 'grooming',
    metric: 'cheekToJaw',
    read: (c) => c.face.ratios.cheekToJaw ?? null,
    fires: (v) => v > 1.34,
    observed: (v) => `The cheekbone line is wider than the jaw line (ratio ${v.toFixed(2)}).`,
    inferred:
      'When the widest point sits high, the lower third reads softer. A defined beard or neckline adds a visible edge where there is currently a gradient.',
    title: 'Define the lower edge',
    why: 'Your widest point sits at the cheekbones, so the jaw line reads softly by comparison. A clean lower edge creates definition where there is none now.',
    how: [
      'Keep the beard or stubble shorter at the cheeks and slightly longer at the chin.',
      'Set the neckline just above the Adam\'s apple, not under the chin.',
      'Re-trim every three to five days — a grown-out edge undoes the effect.',
    ],
    impact: 'high',
    effort: 'easy',
    confidence: 'medium',
    horizon: 'week',
  },
  {
    id: 'grooming.brow-framing',
    category: 'grooming',
    metric: 'browToEye',
    read: (c) => c.face.ratios.browToEye ?? null,
    fires: (v) => v > 0.62,
    observed: (v) => `There is open space between brow and eye (${v.toFixed(2)} of an eye width).`,
    inferred:
      'Brows are the top edge of the frame around the eyes. Tidy shape and consistent density tend to read as deliberate.',
    title: 'Tidy the brow line',
    why: 'The brows sit well clear of the eyes here, which makes their shape a larger part of how the upper face reads.',
    how: [
      'Follow the shape you already have rather than creating a new one.',
      'A clear brow gel keeps the direction consistent.',
      'One professional shape is enough to learn the line; maintain it yourself after.',
    ],
    impact: 'medium',
    effort: 'easy',
    confidence: 'low',
    horizon: 'week',
  },
];

/* ═══════════════════════════ skin (presentation only) ═══════════════════════════
   Nothing here names a condition. Habits only, with a neutral pointer to a
   professional when something looks persistent. */

const SKIN: Rule[] = [
  {
    id: 'skin.under-eye',
    category: 'skin',
    metric: 'underEyeContrast',
    read: (c) => c.skin?.underEyeContrast ?? null,
    fires: (v) => v > 5,
    observed: (v) => `The area under the eyes reads darker than the cheek in this image (Δ${v.toFixed(1)}).`,
    inferred:
      'Under-eye contrast responds strongly to lighting angle, hydration and sleep, and is also simply structural for many people. A single photo cannot separate those.',
    title: 'Softer light, and a steadier sleep window',
    why: 'This area reads dark in the image. Overhead light exaggerates it, and short sleep tends to as well — both are worth ruling out before assuming it is structural.',
    how: [
      'Re-shoot facing a window and see how much of it remains.',
      'Aim for a consistent sleep and wake time for a couple of weeks.',
      'If it persists regardless, a qualified healthcare professional can advise on what is appropriate.',
    ],
    impact: 'medium',
    effort: 'moderate',
    confidence: 'low',
    horizon: 'week',
    requiresProfessional: true,
  },
  {
    id: 'skin.basics',
    category: 'skin',
    metric: 'toneSpread',
    read: (c) => c.skin?.toneSpread ?? null,
    fires: (v) => v > 6.5,
    observed: (v) => `Lightness varies across the face in this image (spread ${v.toFixed(1)}).`,
    inferred:
      'Visible variation in a photo comes from texture and from lighting in roughly equal measure, so it is read here as a prompt for basics rather than as a finding.',
    title: 'Keep the routine short and consistent',
    why: 'A simple routine done daily outperforms a complicated one done occasionally. Consistency is the part that matters.',
    how: [
      'Gentle cleanser, moisturiser, and daily broad-spectrum sun protection.',
      'Change one thing at a time so you can tell what did what.',
      'Give any change six to eight weeks before judging it.',
      'For anything persistent or uncomfortable, ask a qualified healthcare professional.',
    ],
    impact: 'medium',
    effort: 'easy',
    confidence: 'low',
    horizon: 'week',
    requiresProfessional: true,
  },
];

/* ═══════════════════════════ eyewear & style ═══════════════════════════ */

const STYLE: Rule[] = [
  {
    id: 'eyewear.frame-width',
    category: 'eyewear',
    metric: 'bizygomatic',
    read: (c) => c.face.mm.bizygomatic,
    fires: (_v, c) => c.wearsGlasses !== false && c.face.mm.bizygomatic != null,
    unit: 'mm',
    observed: (v) => `Cheekbone width measures about ${mm(v)}.`,
    inferred:
      'Frames read best when their total width is close to the widest part of the face — narrower makes the face look wider, wider makes it look narrower.',
    title: 'Match frame width to your cheekbones',
    why: `Your cheekbone width is around ${'{value}'}, which is the number to take shopping. Frames near that width sit level and stay put.`,
    how: [
      'Look for a total frame width within a few millimetres of that figure.',
      'The outer edge of the frame should land close to the outer edge of your face.',
      'Check that the arms are not pressing — that is what slides frames down.',
    ],
    impact: 'medium',
    effort: 'moderate',
    confidence: 'medium',
    horizon: 'month',
  },
  {
    id: 'style.neckline',
    category: 'style',
    metric: 'widthToHeight',
    read: (c) => c.face.ratios.widthToHeight ?? null,
    fires: (v) => v > 0.74,
    observed: (v) => `Face proportions read broad-ish (ratio ${v.toFixed(2)}).`,
    inferred:
      'A neckline is the line directly beneath the face, so its shape carries into how the face reads. Open necklines lengthen; high round ones shorten.',
    title: 'Open the neckline',
    why: 'A crew neck sits as a horizontal line right under a face whose proportions are already wide. A V or open collar breaks that line.',
    how: [
      'Try a V-neck, or an open collar with the top button undone.',
      'Avoid high round necks close to the jaw.',
      'A lapel or open placket does the same job on a jacket.',
    ],
    impact: 'medium',
    effort: 'easy',
    confidence: 'low',
    horizon: 'now',
  },
];

/* ═══════════════════════════ presentation ═══════════════════════════ */

const PRESENTATION: Rule[] = [
  {
    id: 'presentation.head-tilt',
    category: 'presentation',
    metric: 'roll',
    read: (c) => c.face.capture.roll,
    fires: (v) => Math.abs(v) > 5,
    observed: (v) => `The head was tilted about ${deg(Math.abs(v))} from level.`,
    inferred:
      'A consistent tilt across photos usually reflects a habitual head position rather than the moment. It changes the eye line, which is the first thing a viewer reads.',
    title: 'Level the eye line',
    why: 'Your head was tilted in this frame. A level eye line reads as settled, and it is worth checking whether the tilt is habitual.',
    how: [
      'Before the shutter, level your eye line and let your shoulders drop.',
      'Compare a few recent photos — if the tilt is always the same direction, it is a habit worth noticing.',
      'If you have ongoing neck discomfort, a qualified professional is the right person to assess it.',
    ],
    impact: 'medium',
    effort: 'easy',
    confidence: 'medium',
    horizon: 'now',
    requiresProfessional: true,
  },
];

export const RULES: readonly Rule[] = [...PHOTO, ...HAIR, ...GROOMING, ...SKIN, ...STYLE, ...PRESENTATION];

/* ═══════════════════════════ strengths ═══════════════════════════
   Named FIRST in the UI. Not consolation — the point is that a person should
   learn what already works so they stop changing it by accident. */

export interface StrengthRule {
  readonly id: string;
  readonly category: Category;
  readonly title: string;
  readonly detail: string;
  readonly fires: (c: RuleContext) => boolean;
}

export const STRENGTH_RULES: readonly StrengthRule[] = [
  {
    id: 'strength.capture',
    category: 'photo',
    title: 'You took a clean photo',
    detail:
      'Head level, square to the lens and evenly lit. That is the hard part of a good photo, and it means everything else here is read from solid material.',
    fires: (c) =>
      Math.abs(c.face.capture.roll) <= 4 &&
      Math.abs(c.face.capture.yaw) <= 0.1 &&
      (c.skin?.lightBalance ?? 99) < 7,
  },
  {
    id: 'strength.lighting',
    category: 'photo',
    title: 'Your lighting is even',
    detail:
      'Both sides of your face are lit within a few points of each other. Even light is what lets structure read naturally instead of being carved by shadow.',
    fires: (c) => (c.skin?.lightBalance ?? 99) < 6 && (c.skin?.lightness ?? 0) > 40,
  },
  {
    id: 'strength.proportions',
    category: 'presentation',
    title: 'Your proportions are balanced',
    detail:
      'The three vertical sections of your face fall close to even. This is a useful thing to know because it means most hair and eyewear shapes will work on you — you have room to experiment.',
    fires: (c) => (c.face.ratios.thirdsSpread ?? 1) < 0.16,
  },
  {
    id: 'strength.jaw',
    category: 'grooming',
    title: 'Your jaw line is already defined',
    detail:
      'The lower third holds its own width against the cheekbones, so it reads clearly in photographs. Keeping the neckline clean is enough to maintain it.',
    fires: (c) => {
      const r = c.face.ratios.cheekToJaw;
      return r != null && r >= 1.12 && r <= 1.3;
    },
  },
  {
    id: 'strength.eye-frame',
    category: 'grooming',
    title: 'Your eye area frames well',
    detail:
      'Brow-to-eye spacing and eye spacing both sit in a range that reads open and settled. Shapes that draw attention upward tend to work with this.',
    fires: (c) => {
      const s = c.face.ratios.eyeSpacing;
      const b = c.face.ratios.browToEye;
      return s != null && b != null && s >= 0.9 && s <= 1.12 && b >= 0.4 && b <= 0.62;
    },
  },
  {
    id: 'strength.symmetry',
    category: 'presentation',
    title: 'You read as even left to right',
    detail:
      'Mirrored landmarks sit within a couple of millimetres of each other. Everyone is asymmetric to some degree; yours is well inside the range nobody notices.',
    fires: (c) => {
      const a = c.face.mm.asymmetryMean;
      return a != null && a < 2 && Math.abs(c.face.capture.yaw) < 0.1;
    },
  },
];
